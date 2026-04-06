/**
 * KML / KMZ Export Writer
 * Google Earth / GIS-compatible KML with grade colour support
 *
 * KML colour format: AABBGGRR (alpha, blue, green, red — reversed from web hex)
 *
 * Grade colour ON:  one <Placemark> per segment (i → i+1) with <LineStyle> colour
 * Grade colour OFF: one <Placemark> per profile point (Point geometry)
 */

import JSZip from 'jszip';
import type { Alignment, LinkedProfile } from '@/lib/alignment/types';
import type { ExportOptions, ExportResult } from '../types';
import { samplesToExportSamples, resampleProfile } from '../utils/sampling';
import { getGradeTier, GRADE_TIERS } from '../utils/gradeColor';

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

function buildKMLContent(
  alignment: Alignment,
  profile: LinkedProfile,
  options: ExportOptions
): string {
  let samples = options.samplingMode === 'resample' && options.resampleInterval_m
    ? resampleProfile(profile.samples, options.resampleInterval_m, alignment.id, profile.id, profile.projectId)
    : samplesToExportSamples(profile.samples, alignment.id, profile.id, profile.projectId);

  const includeGrade = options.includeGradeColor === true;
  const lines: string[] = [];

  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push('<kml xmlns="http://www.opengis.net/kml/2.2">');
  lines.push('  <Document>');
  lines.push(`    <name>${escapeXml(alignment.name)}</name>`);
  lines.push(`    <description>Road profile exported from MeasurePRO — ${escapeXml(profile.name)}</description>`);

  // Define one Style per grade class
  GRADE_TIERS.forEach(tier => {
    lines.push(`    <Style id="style_${tier.cls}">`);
    lines.push('      <LineStyle>');
    lines.push(`        <color>${tier.kmlColor}</color>`);
    lines.push('        <width>3</width>');
    lines.push('      </LineStyle>');
    lines.push('    </Style>');
  });

  // Default point style for colour-off mode
  lines.push('    <Style id="style_point">');
  lines.push('      <IconStyle>');
  lines.push('        <scale>0.5</scale>');
  lines.push('      </IconStyle>');
  lines.push('    </Style>');

  if (includeGrade && samples.length > 1) {
    // One <Placemark> per segment (i → i+1), each with its own grade-coloured <LineStyle>
    for (let i = 0; i < samples.length - 1; i++) {
      const s1 = samples[i];
      const s2 = samples[i + 1];
      const tier = getGradeTier(s1.grade_pct);
      const alt1 = getAltitude(s1, options.altitudeMode);
      const alt2 = getAltitude(s2, options.altitudeMode);
      const coord1 = `${s1.lon_deg.toFixed(8)},${s1.lat_deg.toFixed(8)},${(alt1 ?? 0).toFixed(3)}`;
      const coord2 = `${s2.lon_deg.toFixed(8)},${s2.lat_deg.toFixed(8)},${(alt2 ?? 0).toFixed(3)}`;

      lines.push('    <Placemark>');
      lines.push(`      <name>${tier.cls} ${s1.station_km.toFixed(3)} km</name>`);
      lines.push(`      <description>Grade class: ${tier.cls} | ${s1.station_km.toFixed(3)} – ${s2.station_km.toFixed(3)} km</description>`);
      lines.push(`      <styleUrl>#style_${tier.cls}</styleUrl>`);
      lines.push('      <LineString>');
      lines.push('        <tessellate>1</tessellate>');
      lines.push('        <altitudeMode>absolute</altitudeMode>');
      lines.push(`        <coordinates>${coord1} ${coord2}</coordinates>`);
      lines.push('      </LineString>');
      lines.push('    </Placemark>');
    }
  } else {
    // Grade colour OFF: one <Placemark> per profile point (Point geometry)
    for (let i = 0; i < samples.length; i++) {
      const s = samples[i];
      const alt = getAltitude(s, options.altitudeMode);
      const coord = `${s.lon_deg.toFixed(8)},${s.lat_deg.toFixed(8)},${(alt ?? 0).toFixed(3)}`;

      lines.push('    <Placemark>');
      lines.push(`      <name>${s.station_km.toFixed(3)} km</name>`);
      lines.push(`      <description>Station: ${s.station_km.toFixed(3)} km | Grade: ${s.grade_pct !== null ? s.grade_pct.toFixed(2) : 'n/a'}%</description>`);
      lines.push('      <styleUrl>#style_point</styleUrl>');
      lines.push('      <Point>');
      lines.push('        <altitudeMode>absolute</altitudeMode>');
      lines.push(`        <coordinates>${coord}</coordinates>`);
      lines.push('      </Point>');
      lines.push('    </Placemark>');
    }
  }

  lines.push('  </Document>');
  lines.push('</kml>');

  return lines.join('\n');
}

export function exportAsKML(
  alignment: Alignment,
  profile: LinkedProfile,
  options: ExportOptions
): ExportResult {
  const kmlContent = buildKMLContent(alignment, profile, options);
  const blob = new Blob([kmlContent], { type: 'application/vnd.google-earth.kml+xml' });
  const filename = `${alignment.name.replace(/[^a-zA-Z0-9]/g, '_')}_profile.kml`;

  return {
    format: 'kml',
    filename,
    blob,
    mimeType: 'application/vnd.google-earth.kml+xml',
  };
}

export async function exportAsKMZ(
  alignment: Alignment,
  profile: LinkedProfile,
  options: ExportOptions
): Promise<ExportResult> {
  const kmlContent = buildKMLContent(alignment, profile, options);

  const zip = new JSZip();
  zip.file('doc.kml', kmlContent);

  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  const filename = `${alignment.name.replace(/[^a-zA-Z0-9]/g, '_')}_profile.kmz`;

  return {
    format: 'kmz',
    filename,
    blob,
    mimeType: 'application/vnd.google-earth.kmz',
  };
}
