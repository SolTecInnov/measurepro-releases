/**
 * LAS Exporter - Export point clouds to LAS 1.2 format
 * 
 * LAS FORMAT:
 * - Binary format for LIDAR data
 * - Standard: ASPRS LAS 1.2
 * - Header + Variable Length Records + Point Data
 * - GPS time, classification, intensity support
 * 
 * LAS 1.2 POINT FORMAT 2:
 * - X, Y, Z (scaled integers)
 * - Intensity
 * - Return number, number of returns
 * - Classification
 * - Scan angle
 * - User data
 * - Point source ID
 * - GPS time
 * - RGB color
 */

import type { PointCloudScan, PointCloudFrame } from '../types';

export interface LASExportOptions {
  pointFormat?: 2 | 3;
  systemIdentifier?: string;
  generatingSoftware?: string;
  classification?: number;
}

const LAS_HEADER_SIZE = 227;
const LAS_POINT_FORMAT_2_SIZE = 26;
const LAS_POINT_FORMAT_3_SIZE = 34;

export function exportToLAS(
  scan: PointCloudScan,
  frames: PointCloudFrame[],
  options: LASExportOptions = {}
): Blob {
  const {
    pointFormat = 3,
    systemIdentifier = 'MeasurePRO',
    generatingSoftware = 'MeasurePRO 3D Scanner v1.0',
    classification = 1,
  } = options;

  if (frames.length === 0) {
    throw new Error('No frames to export');
  }

  const totalPoints = frames.reduce((sum, frame) => sum + frame.pointCount, 0);
  const pointDataRecordLength = pointFormat === 2 ? LAS_POINT_FORMAT_2_SIZE : LAS_POINT_FORMAT_3_SIZE;

  const { min, max } = scan.bounds;

  const xScale = 0.001;
  const yScale = 0.001;
  const zScale = 0.001;
  const xOffset = min.x;
  const yOffset = min.y;
  const zOffset = min.z;

  const headerBuffer = new ArrayBuffer(LAS_HEADER_SIZE);
  const headerView = new DataView(headerBuffer);
  const headerBytes = new Uint8Array(headerBuffer);

  let offset = 0;

  headerBytes[offset++] = 'L'.charCodeAt(0);
  headerBytes[offset++] = 'A'.charCodeAt(0);
  headerBytes[offset++] = 'S'.charCodeAt(0);
  headerBytes[offset++] = 'F'.charCodeAt(0);

  headerView.setUint16(offset, 0, true);
  offset += 2;

  headerView.setUint32(offset, 0, true);
  offset += 4;

  headerView.setUint16(offset, 0, true);
  offset += 2;

  headerView.setUint16(offset, 0, true);
  offset += 2;

  const sysId = systemIdentifier.padEnd(32, '\0').substring(0, 32);
  for (let i = 0; i < 32; i++) {
    headerBytes[offset++] = sysId.charCodeAt(i);
  }

  const genSoft = generatingSoftware.padEnd(32, '\0').substring(0, 32);
  for (let i = 0; i < 32; i++) {
    headerBytes[offset++] = genSoft.charCodeAt(i);
  }

  const now = new Date();
  headerView.setUint16(offset, now.getDate(), true);
  offset += 2;
  headerView.setUint16(offset, now.getFullYear(), true);
  offset += 2;

  headerView.setUint16(offset, 1, true);
  offset += 2;
  headerView.setUint8(offset++, 2);

  headerView.setUint16(offset, LAS_HEADER_SIZE, true);
  offset += 2;

  headerView.setUint32(offset, LAS_HEADER_SIZE, true);
  offset += 4;

  headerView.setUint32(offset, 0, true);
  offset += 4;

  headerView.setUint8(offset++, pointFormat);
  headerView.setUint16(offset, pointDataRecordLength, true);
  offset += 2;

  headerView.setUint32(offset, totalPoints, true);
  offset += 4;

  for (let i = 0; i < 5; i++) {
    headerView.setUint32(offset, 0, true);
    offset += 4;
  }

  headerView.setFloat64(offset, xScale, true);
  offset += 8;
  headerView.setFloat64(offset, yScale, true);
  offset += 8;
  headerView.setFloat64(offset, zScale, true);
  offset += 8;

  headerView.setFloat64(offset, xOffset, true);
  offset += 8;
  headerView.setFloat64(offset, yOffset, true);
  offset += 8;
  headerView.setFloat64(offset, zOffset, true);
  offset += 8;

  headerView.setFloat64(offset, max.x, true);
  offset += 8;
  headerView.setFloat64(offset, min.x, true);
  offset += 8;
  headerView.setFloat64(offset, max.y, true);
  offset += 8;
  headerView.setFloat64(offset, min.y, true);
  offset += 8;
  headerView.setFloat64(offset, max.z, true);
  offset += 8;
  headerView.setFloat64(offset, min.z, true);
  offset += 8;

  const pointDataSize = totalPoints * pointDataRecordLength;
  const pointDataBuffer = new ArrayBuffer(pointDataSize);
  const pointDataView = new DataView(pointDataBuffer);
  const pointDataBytes = new Uint8Array(pointDataBuffer);

  let pointOffset = 0;
  let gpsTimeBase = scan.startTime / 1000.0;

  for (const frame of frames) {
    const points = frame.points;
    const colors = frame.colors;
    const gpsTime = (frame.timestamp - scan.startTime) / 1000.0;

    for (let i = 0; i < frame.pointCount; i++) {
      const x = points[i * 3];
      const y = points[i * 3 + 1];
      const z = points[i * 3 + 2];

      const xInt = Math.round((x - xOffset) / xScale);
      const yInt = Math.round((y - yOffset) / yScale);
      const zInt = Math.round((z - zOffset) / zScale);

      pointDataView.setInt32(pointOffset, xInt, true);
      pointDataView.setInt32(pointOffset + 4, yInt, true);
      pointDataView.setInt32(pointOffset + 8, zInt, true);

      pointDataView.setUint16(pointOffset + 12, 0, true);

      pointDataBytes[pointOffset + 14] = 0x01;

      pointDataBytes[pointOffset + 15] = classification;

      pointDataBytes[pointOffset + 16] = 0;

      pointDataBytes[pointOffset + 17] = 0;

      pointDataView.setUint16(pointOffset + 18, 0, true);

      pointDataView.setFloat64(pointOffset + 20, gpsTimeBase + gpsTime, true);

      if (pointFormat === 3 && colors) {
        const r = colors[i * 3];
        const g = colors[i * 3 + 1];
        const b = colors[i * 3 + 2];

        pointDataView.setUint16(pointOffset + 28, r << 8, true);
        pointDataView.setUint16(pointOffset + 30, g << 8, true);
        pointDataView.setUint16(pointOffset + 32, b << 8, true);
      }

      pointOffset += pointDataRecordLength;
    }
  }

  return new Blob([headerBuffer, pointDataBuffer], { type: 'application/octet-stream' });
}

export function estimateLASFileSize(totalPoints: number, pointFormat: number): number {
  const pointSize = pointFormat === 2 ? LAS_POINT_FORMAT_2_SIZE : LAS_POINT_FORMAT_3_SIZE;
  return LAS_HEADER_SIZE + totalPoints * pointSize;
}
