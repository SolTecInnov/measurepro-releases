/**
 * DXF Export Writer
 * CAD-compatible DXF with alignment and profile layers
 */

import { DxfWriter, point3d } from '@tarikjabiri/dxf';
import type { Alignment, LinkedProfile } from '@/lib/alignment/types';
import type { ExportOptions, ExportResult } from '../types';
import { transformCoordinates, isProjectedCRS } from '../utils/crs';
import { samplesToExportSamples, resampleProfile } from '../utils/sampling';
import { getGradeTier, GRADE_TIERS } from '../utils/gradeColor';

export function exportAsDXF(
  alignment: Alignment,
  profile: LinkedProfile,
  options: ExportOptions
): ExportResult {
  const writer = new DxfWriter();
  const doc = writer.document;
  const modelSpace = doc.modelSpace;

  doc.tables.addLayer('L_ALIGNMENT', 3, 'CONTINUOUS');
  doc.tables.addLayer('L_PROFILE', 5, 'CONTINUOUS');
  doc.tables.addLayer('L_PROFILE_RAW', 1, 'CONTINUOUS');
  doc.tables.addLayer('L_PROFILE_SELECTED', 4, 'CONTINUOUS');

  const includeGrade = options.includeGradeColor === true;

  if (includeGrade) {
    GRADE_TIERS.forEach(tier => {
      doc.tables.addLayer(tier.layerName, tier.aciColor, 'CONTINUOUS');
    });
  }

  let samples = options.samplingMode === 'resample' && options.resampleInterval_m
    ? resampleProfile(profile.samples, options.resampleInterval_m, alignment.id, profile.id, profile.projectId)
    : samplesToExportSamples(profile.samples, alignment.id, profile.id, profile.projectId);

  const coords = alignment.polyline.map(p => [p.lon, p.lat] as [number, number]);
  let transformedCoords: [number, number][];

  if (isProjectedCRS(options.crs)) {
    transformedCoords = transformCoordinates(coords, 'EPSG:4326', options.crs);
  } else {
    transformedCoords = coords;
  }

  const alignmentPoints = transformedCoords.map(([x, y]) => point3d(x, y, 0));

  for (let i = 0; i < alignmentPoints.length - 1; i++) {
    modelSpace.addLine(alignmentPoints[i], alignmentPoints[i + 1], { layerName: 'L_ALIGNMENT' });
  }

  if (samples.length > 1) {
    for (let i = 0; i < samples.length - 1; i++) {
      const s1 = samples[i];
      const s2 = samples[i + 1];

      if (s1.altitude_corrected_m !== null && s2.altitude_corrected_m !== null) {
        const layerName = includeGrade
          ? getGradeTier(s1.grade_pct).layerName
          : 'L_PROFILE';

        modelSpace.addLine(
          point3d(s1.station_m, s1.altitude_corrected_m, 0),
          point3d(s2.station_m, s2.altitude_corrected_m, 0),
          { layerName }
        );
      }

      if (!includeGrade) {
        if (s1.altitude_raw_m !== null && s2.altitude_raw_m !== null) {
          modelSpace.addLine(
            point3d(s1.station_m, s1.altitude_raw_m, 0),
            point3d(s2.station_m, s2.altitude_raw_m, 0),
            { layerName: 'L_PROFILE_RAW' }
          );
        }

        if (s1.altitude_selected_m !== null && s2.altitude_selected_m !== null) {
          modelSpace.addLine(
            point3d(s1.station_m, s1.altitude_selected_m, 0),
            point3d(s2.station_m, s2.altitude_selected_m, 0),
            { layerName: 'L_PROFILE_SELECTED' }
          );
        }
      }
    }
  }

  const dxfString = writer.stringify();
  const blob = new Blob([dxfString], { type: 'application/dxf' });
  const filename = `${alignment.name.replace(/[^a-zA-Z0-9]/g, '_')}_profile.dxf`;

  return {
    format: 'dxf',
    filename,
    blob,
    mimeType: 'application/dxf',
  };
}
