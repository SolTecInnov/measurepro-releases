/**
 * LandXML Export Writer
 * Civil 3D compatible LandXML with alignment and profile
 */

import { create } from 'xmlbuilder2';
import type { Alignment, LinkedProfile } from '@/lib/alignment/types';
import type { ExportOptions, ExportResult } from '../types';
import { transformCoordinates, isProjectedCRS, getCRSName } from '../utils/crs';
import { samplesToExportSamples, resampleProfile } from '../utils/sampling';
import { getGradeClass } from '../utils/gradeColor';

export function exportAsLandXML(
  alignment: Alignment,
  profile: LinkedProfile,
  options: ExportOptions
): ExportResult {
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

  const totalLength = alignment.cumDistM[alignment.cumDistM.length - 1] || 0;
  const includeGrade = options.includeGradeColor === true;

  const root = create({ version: '1.0', encoding: 'UTF-8' })
    .ele('LandXML', {
      xmlns: 'http://www.landxml.org/schema/LandXML-1.2',
      version: '1.2',
      date: new Date().toISOString().split('T')[0],
      time: new Date().toISOString().split('T')[1].split('.')[0],
      language: 'English',
    });

  root.ele('Units')
    .ele('Metric', {
      areaUnit: 'squareMeter',
      linearUnit: 'meter',
      volumeUnit: 'cubicMeter',
      temperatureUnit: 'celsius',
      pressureUnit: 'HPA',
      angularUnit: 'decimal degrees',
      directionUnit: 'decimal degrees',
    }).up()
    .up();

  const project = root.ele('Project', { name: profile.projectId });
  project.ele('Feature', { code: 'CRS' })
    .ele('Property', { label: 'EPSG', value: options.crs }).up()
    .ele('Property', { label: 'Name', value: getCRSName(options.crs) });

  const alignments = root.ele('Alignments', {
    name: 'Road Alignments',
  });

  const alignmentEl = alignments.ele('Alignment', {
    name: alignment.name,
    length: totalLength.toFixed(3),
    staStart: '0.000',
    desc: `Exported from MeasurePRO - ${alignment.id}`,
  });

  const coordGeom = alignmentEl.ele('CoordGeom');

  for (let i = 0; i < transformedCoords.length - 1; i++) {
    const [x1, y1] = transformedCoords[i];
    const [x2, y2] = transformedCoords[i + 1];

    const dx = x2 - x1;
    const dy = y2 - y1;
    const length = Math.sqrt(dx * dx + dy * dy);
    const dir = Math.atan2(dx, dy) * (180 / Math.PI);
    const normalizedDir = dir < 0 ? dir + 360 : dir;

    coordGeom.ele('Line', {
      dir: normalizedDir.toFixed(6),
      length: length.toFixed(6),
    })
      .ele('Start').txt(`${y1.toFixed(8)} ${x1.toFixed(8)}`).up()
      .ele('End').txt(`${y2.toFixed(8)} ${x2.toFixed(8)}`);
  }

  const profileEl = alignmentEl.ele('Profile', {
    name: profile.name,
    desc: `Ground Profile - ${profile.id}`,
  });

  const profAlign = profileEl.ele('ProfAlign', {
    name: `${profile.name}_EG`,
    desc: 'Existing Ground',
  });

  samples.forEach((sample) => {
    const alt = sample.altitude_corrected_m ?? sample.altitude_selected_m ?? sample.altitude_raw_m ?? 0;

    if (includeGrade) {
      // Build PVI with text content + child Feature element
      profAlign
        .ele('PVI', { station: sample.station_m.toFixed(3) })
        .txt(alt.toFixed(3))
        .ele('Feature', { code: 'grade_class' })
        .ele('Property', { label: 'grade_class', value: getGradeClass(sample.grade_pct) })
        .up() // back to Feature
        .up() // back to PVI
        .up(); // back to ProfAlign (ready for next PVI)
    } else {
      profAlign.ele('PVI', {
        station: sample.station_m.toFixed(3),
      }).txt(alt.toFixed(3));
    }
  });

  const xmlString = root.end({ prettyPrint: true });
  const blob = new Blob([xmlString], { type: 'application/xml' });
  const filename = `${alignment.name.replace(/[^a-zA-Z0-9]/g, '_')}.xml`;

  return {
    format: 'landxml',
    filename,
    blob,
    mimeType: 'application/xml',
  };
}
