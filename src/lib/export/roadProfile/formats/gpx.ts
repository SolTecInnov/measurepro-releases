/**
 * GPX Export Writer
 * GPS Exchange Format 1.1 — compatible with Garmin, OsmAnd, QGIS, BaseCamp
 *
 * Structure:
 *   <gpx> → <trk> → <trkseg> → <trkpt lat lon>
 *     <ele>, <time>, <cmt> (station km), <desc> (grade class when ON)
 *     <extensions> with grade_class when colour mode is ON
 */

import type { Alignment, LinkedProfile } from '@/lib/alignment/types';
import type { ExportOptions, ExportResult } from '../types';
import { samplesToExportSamples, resampleProfile } from '../utils/sampling';
import { getGradeClass } from '../utils/gradeColor';

function getAltitude(
  sample: { altitude_raw_m: number | null; altitude_selected_m: number | null; altitude_corrected_m: number | null },
  mode: 'raw' | 'selected' | 'corrected' | 'all'
): number | null {
  switch (mode) {
    case 'raw': return sample.altitude_raw_m;
    case 'selected': return sample.altitude_selected_m;
    case 'corrected':
    case 'all':
    default: return sample.altitude_corrected_m;
  }
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function exportAsGPX(
  alignment: Alignment,
  profile: LinkedProfile,
  options: ExportOptions
): ExportResult {
  let samples = options.samplingMode === 'resample' && options.resampleInterval_m
    ? resampleProfile(profile.samples, options.resampleInterval_m, alignment.id, profile.id, profile.projectId)
    : samplesToExportSamples(profile.samples, alignment.id, profile.id, profile.projectId);

  const includeGrade = options.includeGradeColor === true;
  const now = new Date().toISOString();

  const lines: string[] = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push('<gpx version="1.1"');
  lines.push('  creator="MeasurePRO"');
  lines.push('  xmlns="http://www.topografix.com/GPX/1/1"');
  lines.push('  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"');
  lines.push('  xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">');

  lines.push('  <metadata>');
  lines.push(`    <name>${escapeXml(profile.name)}</name>`);
  lines.push(`    <desc>Road profile — alignment: ${escapeXml(alignment.name)}</desc>`);
  lines.push(`    <time>${now}</time>`);
  lines.push('  </metadata>');

  lines.push('  <trk>');
  lines.push(`    <name>${escapeXml(profile.name)}</name>`);
  lines.push(`    <desc>Exported from MeasurePRO — ${escapeXml(alignment.name)}</desc>`);
  lines.push('    <trkseg>');

  samples.forEach(s => {
    const alt = getAltitude(s, options.altitudeMode);
    const gradeClass = getGradeClass(s.grade_pct);

    lines.push(`      <trkpt lat="${s.lat_deg.toFixed(8)}" lon="${s.lon_deg.toFixed(8)}">`);

    if (alt !== null) {
      lines.push(`        <ele>${alt.toFixed(3)}</ele>`);
    }

    lines.push(`        <time>${s.timestamp_utc}</time>`);
    lines.push(`        <cmt>${s.station_km.toFixed(3)} km</cmt>`);

    if (includeGrade) {
      lines.push(`        <desc>${gradeClass} grade=${s.grade_pct !== null ? s.grade_pct.toFixed(2) : ''}%</desc>`);
      lines.push('        <extensions>');
      lines.push(`          <grade_class>${gradeClass}</grade_class>`);
      if (s.grade_pct !== null) {
        lines.push(`          <grade_pct>${s.grade_pct.toFixed(4)}</grade_pct>`);
      }
      lines.push('        </extensions>');
    }

    lines.push('      </trkpt>');
  });

  lines.push('    </trkseg>');
  lines.push('  </trk>');
  lines.push('</gpx>');

  const blob = new Blob([lines.join('\n')], { type: 'application/gpx+xml' });
  const filename = `${profile.name.replace(/[^a-zA-Z0-9]/g, '_')}_profile.gpx`;

  return {
    format: 'gpx',
    filename,
    blob,
    mimeType: 'application/gpx+xml',
  };
}
