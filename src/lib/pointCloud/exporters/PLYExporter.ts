/**
 * PLY Exporter - Export point clouds to PLY format
 * 
 * PLY FORMAT:
 * - ASCII or binary
 * - Header with element definitions
 * - Point properties: x, y, z, r, g, b
 * - Widely supported (CloudCompare, MeshLab, etc.)
 * 
 * STRUCTURE:
 * ply
 * format ascii 1.0
 * element vertex <count>
 * property float x
 * property float y
 * property float z
 * property uchar red
 * property uchar green
 * property uchar blue
 * end_header
 * <point data>
 */

import type { PointCloudScan, PointCloudFrame } from '../types';

export interface PLYExportOptions {
  format?: 'ascii' | 'binary';
  includeColors?: boolean;
  includeNormals?: boolean;
  chunkSize?: number;
}

export function exportToPLY(
  scan: PointCloudScan,
  frames: PointCloudFrame[],
  options: PLYExportOptions = {}
): Blob {
  const {
    format = 'ascii',
    includeColors = true,
    includeNormals = false,
  } = options;

  if (frames.length === 0) {
    throw new Error('No frames to export');
  }

  const totalPoints = frames.reduce((sum, frame) => sum + frame.pointCount, 0);

  if (format === 'ascii') {
    return exportPLYAscii(scan, frames, totalPoints, includeColors, includeNormals);
  } else {
    return exportPLYBinary(scan, frames, totalPoints, includeColors, includeNormals);
  }
}

function exportPLYAscii(
  scan: PointCloudScan,
  frames: PointCloudFrame[],
  totalPoints: number,
  includeColors: boolean,
  includeNormals: boolean
): Blob {
  const lines: string[] = [];

  lines.push('ply');
  lines.push('format ascii 1.0');
  lines.push(`comment MeasurePRO 3D Scan: ${scan.name}`);
  lines.push(`comment Scan ID: ${scan.id}`);
  lines.push(`comment Total Frames: ${scan.totalFrames}`);
  lines.push(`comment Scan Date: ${new Date(scan.startTime).toISOString()}`);
  lines.push(`element vertex ${totalPoints}`);
  lines.push('property float x');
  lines.push('property float y');
  lines.push('property float z');

  if (includeColors) {
    lines.push('property uchar red');
    lines.push('property uchar green');
    lines.push('property uchar blue');
  }

  if (includeNormals) {
    lines.push('property float nx');
    lines.push('property float ny');
    lines.push('property float nz');
  }

  lines.push('end_header');

  const header = lines.join('\n') + '\n';

  const chunks: string[] = [header];

  for (const frame of frames) {
    const points = frame.points;
    const colors = frame.colors;

    for (let i = 0; i < frame.pointCount; i++) {
      const x = points[i * 3];
      const y = points[i * 3 + 1];
      const z = points[i * 3 + 2];

      let line = `${x.toFixed(6)} ${y.toFixed(6)} ${z.toFixed(6)}`;

      if (includeColors && colors) {
        const r = colors[i * 3];
        const g = colors[i * 3 + 1];
        const b = colors[i * 3 + 2];
        line += ` ${r} ${g} ${b}`;
      } else if (includeColors) {
        line += ' 128 128 128';
      }

      if (includeNormals) {
        line += ' 0 0 1';
      }

      chunks.push(line + '\n');
    }
  }

  return new Blob(chunks, { type: 'text/plain' });
}

function exportPLYBinary(
  scan: PointCloudScan,
  frames: PointCloudFrame[],
  totalPoints: number,
  includeColors: boolean,
  includeNormals: boolean
): Blob {
  const lines: string[] = [];

  lines.push('ply');
  lines.push('format binary_little_endian 1.0');
  lines.push(`comment MeasurePRO 3D Scan: ${scan.name}`);
  lines.push(`comment Scan ID: ${scan.id}`);
  lines.push(`comment Total Frames: ${scan.totalFrames}`);
  lines.push(`element vertex ${totalPoints}`);
  lines.push('property float x');
  lines.push('property float y');
  lines.push('property float z');

  if (includeColors) {
    lines.push('property uchar red');
    lines.push('property uchar green');
    lines.push('property uchar blue');
  }

  if (includeNormals) {
    lines.push('property float nx');
    lines.push('property float ny');
    lines.push('property float nz');
  }

  lines.push('end_header');
  const header = lines.join('\n') + '\n';

  const headerBlob = new Blob([header], { type: 'text/plain' });

  const bytesPerPoint = 12 + (includeColors ? 3 : 0) + (includeNormals ? 12 : 0);
  const dataBuffer = new ArrayBuffer(totalPoints * bytesPerPoint);
  const dataView = new DataView(dataBuffer);
  const colorArray = new Uint8Array(dataBuffer);

  let offset = 0;

  for (const frame of frames) {
    const points = frame.points;
    const colors = frame.colors;

    for (let i = 0; i < frame.pointCount; i++) {
      const x = points[i * 3];
      const y = points[i * 3 + 1];
      const z = points[i * 3 + 2];

      dataView.setFloat32(offset, x, true);
      dataView.setFloat32(offset + 4, y, true);
      dataView.setFloat32(offset + 8, z, true);
      offset += 12;

      if (includeColors && colors) {
        colorArray[offset] = colors[i * 3];
        colorArray[offset + 1] = colors[i * 3 + 1];
        colorArray[offset + 2] = colors[i * 3 + 2];
        offset += 3;
      } else if (includeColors) {
        colorArray[offset] = 128;
        colorArray[offset + 1] = 128;
        colorArray[offset + 2] = 128;
        offset += 3;
      }

      if (includeNormals) {
        dataView.setFloat32(offset, 0, true);
        dataView.setFloat32(offset + 4, 0, true);
        dataView.setFloat32(offset + 8, 1, true);
        offset += 12;
      }
    }
  }

  const dataBlob = new Blob([dataBuffer], { type: 'application/octet-stream' });

  return new Blob([headerBlob, dataBlob], { type: 'application/octet-stream' });
}

export function estimatePLYFileSize(
  totalPoints: number,
  format: 'ascii' | 'binary',
  includeColors: boolean,
  includeNormals: boolean
): number {
  const headerSize = 500;

  if (format === 'ascii') {
    const avgBytesPerPoint = 40 + (includeColors ? 12 : 0) + (includeNormals ? 18 : 0);
    return headerSize + totalPoints * avgBytesPerPoint;
  } else {
    const bytesPerPoint = 12 + (includeColors ? 3 : 0) + (includeNormals ? 12 : 0);
    return headerSize + totalPoints * bytesPerPoint;
  }
}
