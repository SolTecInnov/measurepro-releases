/**
 * ProfileExport — GPX/KML/KMZ/JSON export for road profiles
 */

import type { ProfilePoint } from '../../../../server/gnss/types';

export type ExportFormat = 'gpx' | 'kml' | 'kmz' | 'json';

function buildGPX(points: ProfilePoint[], includeGrade: boolean): string {
  const trkpts = points.map(p => `    <trkpt lat="${p.latitude}" lon="${p.longitude}">
      <ele>${p.altitude.toFixed(3)}</ele>
      <time>${p.timestamp}</time>
      ${includeGrade ? `<extensions><grade>${p.grade_pct.toFixed(3)}</grade></extensions>` : ''}
    </trkpt>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="MeasurePRO" xmlns="http://www.topografix.com/GPX/1/1">
  <trk><name>MeasurePRO Road Profile</name><trkseg>
${trkpts}
  </trkseg></trk>
</gpx>`;
}

function buildKML(points: ProfilePoint[], includeGrade: boolean): string {
  const coords = points.map(p => `${p.longitude},${p.latitude},${p.altitude.toFixed(3)}`).join(' ');
  const maxG = Math.max(...points.map(p => Math.abs(p.grade_pct)));
  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2"><Document>
  <name>MeasurePRO Road Profile</name>
  ${includeGrade ? `<description>Max grade: ${maxG.toFixed(1)}%</description>` : ''}
  <Style id="road"><LineStyle><color>ff2288ff</color><width>3</width></LineStyle></Style>
  <Placemark><styleUrl>#road</styleUrl>
    <LineString><altitudeMode>absolute</altitudeMode><coordinates>${coords}</coordinates></LineString>
  </Placemark>
</Document></kml>`;
}

function buildGeoJSON(points: ProfilePoint[], includeGrade: boolean): object {
  return {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: points.map(p => [p.longitude, p.latitude, p.altitude]) },
      properties: {
        name: 'MeasurePRO Road Profile',
        totalDistance_km: (points[points.length - 1]?.distance_m ?? 0) / 1000,
        ...(includeGrade ? {
          maxGrade: Math.max(...points.map(p => Math.abs(p.grade_pct))),
          points: points.map(p => ({ distanceFromStart: p.distance_m, elevation: p.altitude, grade: p.grade_pct, timestamp: p.timestamp })),
        } : {}),
      },
    }],
  };
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function exportProfile(
  points: ProfilePoint[], format: ExportFormat, includeGrade: boolean, label = 'road-profile'
) {
  if (points.length < 2) return;
  const slug = label.replace(/[^a-z0-9]/gi, '-').toLowerCase();
  const ts = new Date().toISOString().slice(0, 10);

  if (format === 'gpx') {
    download(new Blob([buildGPX(points, includeGrade)], { type: 'application/gpx+xml' }), `${slug}-${ts}.gpx`);
  } else if (format === 'kml') {
    download(new Blob([buildKML(points, includeGrade)], { type: 'application/vnd.google-earth.kml+xml' }), `${slug}-${ts}.kml`);
  } else if (format === 'kmz') {
    try {
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();
      zip.file('doc.kml', buildKML(points, includeGrade));
      const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
      download(blob, `${slug}-${ts}.kmz`);
    } catch {
      download(new Blob([buildKML(points, includeGrade)], { type: 'application/vnd.google-earth.kml+xml' }), `${slug}-${ts}.kml`);
    }
  } else if (format === 'json') {
    download(new Blob([JSON.stringify(buildGeoJSON(points, includeGrade), null, 2)], { type: 'application/geo+json' }), `${slug}-${ts}.geojson`);
  }
}
