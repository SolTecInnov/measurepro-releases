/**
 * CSV Export Writer
 * Full profile data export compatible with Civil 3D and analysis tools
 */

import type { Alignment, LinkedProfile } from '@/lib/alignment/types';
import type { ExportOptions, ExportSample, ExportResult } from '../types';
import { samplesToExportSamples, resampleProfile } from '../utils/sampling';
import { getGradeClass, getGradeColor } from '../utils/gradeColor';

const CSV_HEADERS_BASE = [
  'station_m',
  'station_km',
  'lat_deg',
  'lon_deg',
  'altitude_raw_m',
  'altitude_selected_m',
  'altitude_corrected_m',
  'grade_pct',
  'roll_deg',
  'pitch_deg',
  'yaw_deg',
  'speed_mps',
  'heading_deg',
  'timestamp_utc',
  'fix_quality',
  'sats',
  'hdop',
  'alignment_id',
  'profile_id',
  'project_id',
  // Heavy haul safety fields
  'crossSlope_deg',
  'bankingAlert',
  'curveRadius_m',
  'radiusAlert',
];

const CSV_HEADERS_GRADE = ['grade_class', 'grade_color_hex'];

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') {
    if (Number.isInteger(value)) return value.toString();
    return value.toFixed(6);
  }
  return String(value);
}

function sampleToCSVRow(sample: ExportSample, headers: string[]): string {
  return headers.map(header => {
    const value = (sample as Record<string, unknown>)[header];
    return formatValue(value);
  }).join(',');
}

export function exportProfileAsCSV(
  alignment: Alignment,
  profile: LinkedProfile,
  options: ExportOptions
): ExportResult {
  let samples: ExportSample[];

  if (options.samplingMode === 'resample' && options.resampleInterval_m) {
    samples = resampleProfile(
      profile.samples,
      options.resampleInterval_m,
      alignment.id,
      profile.id,
      profile.projectId
    );
  } else {
    samples = samplesToExportSamples(
      profile.samples,
      alignment.id,
      profile.id,
      profile.projectId
    );
  }

  const includeGrade = options.includeGradeColor === true;
  const headers = includeGrade ? [...CSV_HEADERS_BASE, ...CSV_HEADERS_GRADE] : CSV_HEADERS_BASE;

  if (includeGrade) {
    samples = samples.map(s => ({
      ...s,
      grade_class: getGradeClass(s.grade_pct),
      grade_color_hex: getGradeColor(s.grade_pct),
    } as ExportSample & { grade_color_hex: string }));
  }

  const headerRow = headers.join(',');
  const dataRows = samples.map(s => sampleToCSVRow(s as ExportSample, headers));
  const csvContent = [headerRow, ...dataRows].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
  const filename = `${profile.name.replace(/[^a-zA-Z0-9]/g, '_')}_profile.csv`;

  return {
    format: 'csv',
    filename,
    blob,
    mimeType: 'text/csv',
  };
}
