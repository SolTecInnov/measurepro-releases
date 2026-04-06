/**
 * Shapefile Export Writer
 * Zipped shapefile package with .prj file
 * Note: Uses a minimal inline shapefile writer for browser compatibility
 */

import JSZip from 'jszip';
import type { Alignment, LinkedProfile } from '@/lib/alignment/types';
import type { ExportOptions, ExportResult } from '../types';
import { transformCoordinates, isProjectedCRS, getWKT } from '../utils/crs';
import { samplesToExportSamples, resampleProfile } from '../utils/sampling';
import { getGradeClass, getGradeColor } from '../utils/gradeColor';

function encodeDBFField(value: unknown, fieldType: string, fieldLength: number): Uint8Array {
  const buffer = new Uint8Array(fieldLength);
  let str = '';

  if (value === null || value === undefined) {
    str = '';
  } else if (fieldType === 'N') {
    str = String(value).substring(0, fieldLength);
  } else {
    str = String(value).substring(0, fieldLength);
  }

  for (let i = 0; i < Math.min(str.length, fieldLength); i++) {
    buffer[i] = str.charCodeAt(i);
  }
  for (let i = str.length; i < fieldLength; i++) {
    buffer[i] = 0x20;
  }

  return buffer;
}

function createShapefilePoint(
  points: Array<{ x: number; y: number; z: number; properties: Record<string, unknown> }>,
  fieldDefs: Array<{ name: string; type: string; length: number; decimals: number }>
): { shp: Uint8Array; shx: Uint8Array; dbf: Uint8Array } {
  const shpParts: Uint8Array[] = [];
  const shxParts: Uint8Array[] = [];

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  points.forEach(p => {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  });

  const headerBuffer = new ArrayBuffer(100);
  const headerView = new DataView(headerBuffer);

  headerView.setInt32(0, 9994, false);
  headerView.setInt32(24, 0, false);
  headerView.setInt32(28, 1000, true);
  headerView.setInt32(32, 1, true);
  headerView.setFloat64(36, minX, true);
  headerView.setFloat64(44, minY, true);
  headerView.setFloat64(52, maxX, true);
  headerView.setFloat64(60, maxY, true);

  shpParts.push(new Uint8Array(headerBuffer));

  let offset = 50;
  const shxRecords: { offset: number; length: number }[] = [];

  points.forEach((pt, idx) => {
    const recordLength = 10;
    const recordBuffer = new ArrayBuffer(8 + 20);
    const recordView = new DataView(recordBuffer);

    recordView.setInt32(0, idx + 1, false);
    recordView.setInt32(4, recordLength, false);
    recordView.setInt32(8, 1, true);
    recordView.setFloat64(12, pt.x, true);
    recordView.setFloat64(20, pt.y, true);

    shpParts.push(new Uint8Array(recordBuffer));
    shxRecords.push({ offset, length: recordLength });
    offset += recordLength + 4;
  });

  const shxHeaderBuffer = new ArrayBuffer(100);
  const shxHeaderView = new DataView(shxHeaderBuffer);
  shxHeaderView.setInt32(0, 9994, false);
  shxHeaderView.setInt32(24, 50 + points.length * 4, false);
  shxHeaderView.setInt32(28, 1000, true);
  shxHeaderView.setInt32(32, 1, true);
  shxHeaderView.setFloat64(36, minX, true);
  shxHeaderView.setFloat64(44, minY, true);
  shxHeaderView.setFloat64(52, maxX, true);
  shxHeaderView.setFloat64(60, maxY, true);

  shxParts.push(new Uint8Array(shxHeaderBuffer));

  shxRecords.forEach(rec => {
    const recBuffer = new ArrayBuffer(8);
    const recView = new DataView(recBuffer);
    recView.setInt32(0, rec.offset, false);
    recView.setInt32(4, rec.length, false);
    shxParts.push(new Uint8Array(recBuffer));
  });

  const recordSize = fieldDefs.reduce((sum, f) => sum + f.length, 1);
  const dbfHeaderSize = 32 + fieldDefs.length * 32 + 1;
  const dbfSize = dbfHeaderSize + points.length * recordSize + 1;

  const dbfBuffer = new ArrayBuffer(dbfSize);
  const dbfView = new DataView(dbfBuffer);
  const dbfArray = new Uint8Array(dbfBuffer);

  dbfView.setUint8(0, 0x03);
  const now = new Date();
  dbfView.setUint8(1, now.getFullYear() - 1900);
  dbfView.setUint8(2, now.getMonth() + 1);
  dbfView.setUint8(3, now.getDate());
  dbfView.setUint32(4, points.length, true);
  dbfView.setUint16(8, dbfHeaderSize, true);
  dbfView.setUint16(10, recordSize, true);

  let fieldOffset = 32;
  fieldDefs.forEach(field => {
    for (let i = 0; i < Math.min(field.name.length, 11); i++) {
      dbfView.setUint8(fieldOffset + i, field.name.charCodeAt(i));
    }
    dbfView.setUint8(fieldOffset + 11, field.type.charCodeAt(0));
    dbfView.setUint8(fieldOffset + 16, field.length);
    dbfView.setUint8(fieldOffset + 17, field.decimals);
    fieldOffset += 32;
  });
  dbfView.setUint8(fieldOffset, 0x0D);

  let recordOffset = dbfHeaderSize;
  points.forEach(pt => {
    dbfView.setUint8(recordOffset, 0x20);
    let fieldPos = recordOffset + 1;

    fieldDefs.forEach(field => {
      const value = pt.properties[field.name];
      const encoded = encodeDBFField(value, field.type, field.length);
      dbfArray.set(encoded, fieldPos);
      fieldPos += field.length;
    });

    recordOffset += recordSize;
  });

  dbfView.setUint8(dbfSize - 1, 0x1A);

  const totalShpLength = shpParts.reduce((sum, arr) => sum + arr.length, 0);
  const shpResult = new Uint8Array(totalShpLength);
  let shpOffset = 0;
  shpParts.forEach(part => {
    shpResult.set(part, shpOffset);
    shpOffset += part.length;
  });

  const shpView = new DataView(shpResult.buffer);
  shpView.setInt32(24, totalShpLength / 2, false);

  const totalShxLength = shxParts.reduce((sum, arr) => sum + arr.length, 0);
  const shxResult = new Uint8Array(totalShxLength);
  let shxOffset = 0;
  shxParts.forEach(part => {
    shxResult.set(part, shxOffset);
    shxOffset += part.length;
  });

  return {
    shp: shpResult,
    shx: shxResult,
    dbf: new Uint8Array(dbfBuffer),
  };
}

export async function exportAsShapefile(
  alignment: Alignment,
  profile: LinkedProfile,
  options: ExportOptions
): Promise<ExportResult> {
  let samples = options.samplingMode === 'resample' && options.resampleInterval_m
    ? resampleProfile(profile.samples, options.resampleInterval_m, alignment.id, profile.id, profile.projectId)
    : samplesToExportSamples(profile.samples, alignment.id, profile.id, profile.projectId);

  const includeGrade = options.includeGradeColor === true;

  const points = samples.map(s => {
    let x = s.lon_deg;
    let y = s.lat_deg;

    if (isProjectedCRS(options.crs)) {
      const transformed = transformCoordinates([[x, y]], 'EPSG:4326', options.crs);
      [x, y] = transformed[0];
    }

    const props: Record<string, unknown> = {
      STATION_M: s.station_m,
      STATION_KM: s.station_km,
      ALT_RAW: s.altitude_raw_m ?? 0,
      ALT_SEL: s.altitude_selected_m ?? 0,
      ALT_CORR: s.altitude_corrected_m ?? 0,
      GRADE_PCT: s.grade_pct ?? 0,
      SPEED_MPS: s.speed_mps ?? 0,
      HEADING: s.heading_deg ?? 0,
    };

    if (includeGrade) {
      props['GRADE_CLS'] = getGradeClass(s.grade_pct);
      props['GRADE_COL'] = getGradeColor(s.grade_pct);
    }

    return { x, y, z: s.altitude_corrected_m ?? 0, properties: props };
  });

  const fieldDefs: Array<{ name: string; type: string; length: number; decimals: number }> = [
    { name: 'STATION_M', type: 'N', length: 16, decimals: 3 },
    { name: 'STATION_KM', type: 'N', length: 12, decimals: 6 },
    { name: 'ALT_RAW', type: 'N', length: 12, decimals: 3 },
    { name: 'ALT_SEL', type: 'N', length: 12, decimals: 3 },
    { name: 'ALT_CORR', type: 'N', length: 12, decimals: 3 },
    { name: 'GRADE_PCT', type: 'N', length: 10, decimals: 2 },
    { name: 'SPEED_MPS', type: 'N', length: 10, decimals: 2 },
    { name: 'HEADING', type: 'N', length: 10, decimals: 1 },
  ];

  if (includeGrade) {
    fieldDefs.push(
      { name: 'GRADE_CLS', type: 'C', length: 12, decimals: 0 },
      { name: 'GRADE_COL', type: 'C', length: 10, decimals: 0 }
    );
  }

  const { shp, shx, dbf } = createShapefilePoint(points, fieldDefs);
  const prj = getWKT(options.crs);

  const zip = new JSZip();
  const baseName = 'profile_points';

  zip.file(`${baseName}.shp`, shp);
  zip.file(`${baseName}.shx`, shx);
  zip.file(`${baseName}.dbf`, dbf);
  zip.file(`${baseName}.prj`, prj);

  const blob = await zip.generateAsync({ type: 'blob' });
  const filename = `${profile.name.replace(/[^a-zA-Z0-9]/g, '_')}_shapefile.zip`;

  return {
    format: 'shapefile',
    filename,
    blob,
    mimeType: 'application/zip',
  };
}
