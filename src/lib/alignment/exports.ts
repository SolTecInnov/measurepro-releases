/**
 * Alignment + Profile Export Functions
 * Exports to GeoJSON, CSV, and ZIP formats
 */

import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import type { Alignment, LinkedProfile, AlignmentProfileLinkedSet, LinkedProfileSample } from './types';

export function alignmentToGeoJSON(alignment: Alignment): object {
  return {
    type: 'Feature',
    properties: {
      id: alignment.id,
      projectId: alignment.projectId,
      name: alignment.name,
      totalLength_m: alignment.cumDistM[alignment.cumDistM.length - 1] || 0,
      createdAt: alignment.createdAt,
      updatedAt: alignment.updatedAt,
      createdBy: alignment.createdBy,
    },
    geometry: {
      type: 'LineString',
      coordinates: alignment.polyline.map((p) => [p.lon, p.lat]),
    },
  };
}

export function profileToCSV(profile: LinkedProfile): string {
  const headers = [
    'station_m',
    'latitude',
    'longitude',
    'time',
    'altitude_raw_m',
    'altitude_selected_m',
    'altitude_corrected_m',
    'grade_pct',
    'k_factor',
    'curvature_type',
    'lateral_offset_m',
    'hdop',
    'num_sats',
    'speed_mps',
    'heading_deg',
  ];

  const rows = profile.samples.map((s: LinkedProfileSample) =>
    [
      s.s_m.toFixed(3),
      s.lat.toFixed(8),
      s.lon.toFixed(8),
      s.time,
      s.altitude_raw_m?.toFixed(3) ?? '',
      s.altitude_selected_m?.toFixed(3) ?? '',
      s.altitude_corrected_m?.toFixed(3) ?? '',
      s.grade_pct?.toFixed(2) ?? '',
      s.k_factor?.toFixed(1) ?? '',
      s.curvature_type ?? '',
      s.lateralOffset_m?.toFixed(2) ?? '',
      s.hdop?.toFixed(1) ?? '',
      s.num_sats ?? '',
      s.speed_mps?.toFixed(2) ?? '',
      s.heading_deg?.toFixed(1) ?? '',
    ].join(',')
  );

  return [headers.join(','), ...rows].join('\n');
}

export function createMetadataJSON(
  alignment: Alignment,
  profile: LinkedProfile
): object {
  return {
    exportedAt: new Date().toISOString(),
    alignment: {
      id: alignment.id,
      name: alignment.name,
      projectId: alignment.projectId,
      totalLength_m: alignment.cumDistM[alignment.cumDistM.length - 1] || 0,
      vertexCount: alignment.polyline.length,
      createdAt: alignment.createdAt,
      createdBy: alignment.createdBy,
    },
    profile: {
      id: profile.id,
      name: profile.name,
      alignmentId: profile.alignmentId,
      sampleCount: profile.samples.length,
      metadata: profile.metadata,
    },
    calibration: {
      altitudeStrategy: profile.metadata.altitudeStrategy,
      altitudeOffsetM: profile.metadata.altitudeOffsetM,
      axisMapping: profile.metadata.axisMapping,
    },
  };
}

export async function exportLinkedSetAsZip(
  set: AlignmentProfileLinkedSet,
  profileIndex: number = 0
): Promise<void> {
  const zip = new JSZip();
  const { alignment, profiles } = set;

  if (profiles.length === 0) {
    throw new Error('No profiles in linked set');
  }

  const profile = profiles[profileIndex];

  const geoJSON = alignmentToGeoJSON(alignment);
  zip.file('alignment.geojson', JSON.stringify(geoJSON, null, 2));

  const csv = profileToCSV(profile);
  zip.file('profile.csv', csv);

  const metadata = createMetadataJSON(alignment, profile);
  zip.file('metadata.json', JSON.stringify(metadata, null, 2));

  const blob = await zip.generateAsync({ type: 'blob' });
  const fileName = `${alignment.name.replace(/[^a-zA-Z0-9]/g, '_')}_linked_${Date.now()}.zip`;
  saveAs(blob, fileName);
}

export function exportAlignmentAsGeoJSON(alignment: Alignment): void {
  const geoJSON = alignmentToGeoJSON(alignment);
  const blob = new Blob([JSON.stringify(geoJSON, null, 2)], {
    type: 'application/geo+json',
  });
  const fileName = `${alignment.name.replace(/[^a-zA-Z0-9]/g, '_')}_alignment.geojson`;
  saveAs(blob, fileName);
}

export function exportProfileAsCSV(profile: LinkedProfile): void {
  const csv = profileToCSV(profile);
  const blob = new Blob([csv], { type: 'text/csv' });
  const fileName = `${profile.name.replace(/[^a-zA-Z0-9]/g, '_')}_profile.csv`;
  saveAs(blob, fileName);
}
