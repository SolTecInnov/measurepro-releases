/**
 * Road Profile Exporters
 * CSV and GeoJSON serialization for road profile data
 */

import type { 
  RoadProfilePoint, 
  RoadProfileAlertSegment, 
  RoadProfileSummarySegment,
  RoadProfileExportData 
} from './types';

/**
 * Generate road_profile_detail.csv content
 */
export function generateProfileDetailCSV(points: RoadProfilePoint[]): string {
  const header = [
    'chainage_m',
    'lat',
    'lon',
    'elev_m',
    'grade_pct',
    'k_factor',
    'timestamp_iso',
    'quality',
    'grade_alert_type',
    'k_alert'
  ].join(',');

  const rows = points.map(p => [
    p.chainage_m.toFixed(1),
    p.lat.toFixed(6),
    p.lon.toFixed(6),
    p.elev_m.toFixed(1),
    p.grade_pct.toFixed(2),
    p.k_factor.toFixed(2),
    p.timestamp_iso,
    p.quality,
    p.grade_alert_type,
    p.k_alert
  ].join(','));

  return [header, ...rows].join('\n');
}

/**
 * Generate road_profile_summary.csv content
 */
export function generateProfileSummaryCSV(segments: RoadProfileSummarySegment[]): string {
  const header = [
    'segment_id',
    'from_chainage_m',
    'to_chainage_m',
    'length_m',
    'avg_grade_pct',
    'max_up_grade_pct',
    'max_down_grade_pct',
    'has_alert_over_12pct',
    'notes'
  ].join(',');

  const rows = segments.map(s => [
    s.segment_id,
    s.from_chainage_m.toFixed(1),
    s.to_chainage_m.toFixed(1),
    s.length_m.toFixed(1),
    s.avg_grade_pct.toFixed(2),
    s.max_up_grade_pct.toFixed(2),
    s.max_down_grade_pct.toFixed(2),
    s.has_alert_over_12pct ? 'true' : 'false',
    escapeCSV(s.notes || '')
  ].join(','));

  return [header, ...rows].join('\n');
}

/**
 * Generate road_profile_alerts.csv content
 */
export function generateProfileAlertsCSV(segments: RoadProfileAlertSegment[]): string {
  const header = [
    'alert_id',
    'alert_type',
    'from_chainage_m',
    'to_chainage_m',
    'length_m',
    'max_grade_pct',
    'min_grade_pct',
    'max_k_factor',
    'lat',
    'lon',
    'notes'
  ].join(',');

  const rows = segments.map(s => [
    s.alert_id,
    s.alert_type,
    s.from_chainage_m.toFixed(1),
    s.to_chainage_m.toFixed(1),
    s.length_m.toFixed(1),
    s.max_grade_pct.toFixed(2),
    s.min_grade_pct.toFixed(2),
    s.max_k_factor.toFixed(2),
    s.lat.toFixed(6),
    s.lon.toFixed(6),
    escapeCSV(s.notes || '')
  ].join(','));

  return [header, ...rows].join('\n');
}

/**
 * Generate road_profile.geojson content
 * Creates a LineString with per-vertex properties
 */
export function generateProfileGeoJSON(
  profileId: string, 
  points: RoadProfilePoint[]
): string {
  if (points.length === 0) {
    return JSON.stringify({
      type: 'FeatureCollection',
      features: []
    }, null, 2);
  }

  // Build coordinates array
  const coordinates = points.map(p => [p.lon, p.lat]);

  // Build per-vertex property arrays
  const feature = {
    type: 'Feature',
    properties: {
      profileId,
      point_count: points.length,
      total_distance_m: points[points.length - 1].chainage_m,
      chainage_m: points.map(p => p.chainage_m),
      elev_m: points.map(p => p.elev_m),
      grade_pct: points.map(p => p.grade_pct),
      k_factor: points.map(p => p.k_factor),
      quality: points.map(p => p.quality),
      grade_alert_type: points.map(p => p.grade_alert_type),
      k_alert: points.map(p => p.k_alert),
      timestamp_iso: points.map(p => p.timestamp_iso)
    },
    geometry: {
      type: 'LineString',
      coordinates
    }
  };

  return JSON.stringify({
    type: 'FeatureCollection',
    features: [feature]
  }, null, 2);
}

/**
 * Generate road_profile_alerts.geojson content
 * Creates a FeatureCollection of alert segments
 */
export function generateAlertsGeoJSON(
  segments: RoadProfileAlertSegment[],
  points: RoadProfilePoint[]
): string {
  if (segments.length === 0) {
    return JSON.stringify({
      type: 'FeatureCollection',
      features: []
    }, null, 2);
  }

  const features = segments.map(segment => {
    // Get coordinates for this segment from the profile points
    const segmentPoints = points.filter(p => 
      p.chainage_m >= segment.from_chainage_m && p.chainage_m <= segment.to_chainage_m
    );

    // Determine geometry type
    let geometry;
    if (segmentPoints.length >= 2) {
      // LineString for multi-point segments
      geometry = {
        type: 'LineString',
        coordinates: segmentPoints.map(p => [p.lon, p.lat])
      };
    } else {
      // Point for single-point segments
      geometry = {
        type: 'Point',
        coordinates: [segment.lon, segment.lat]
      };
    }

    return {
      type: 'Feature',
      properties: {
        alert_id: segment.alert_id,
        alert_type: segment.alert_type,
        from_chainage_m: segment.from_chainage_m,
        to_chainage_m: segment.to_chainage_m,
        length_m: segment.length_m,
        max_grade_pct: segment.max_grade_pct,
        min_grade_pct: segment.min_grade_pct,
        max_k_factor: segment.max_k_factor,
        notes: segment.notes
      },
      geometry
    };
  });

  return JSON.stringify({
    type: 'FeatureCollection',
    features
  }, null, 2);
}

/**
 * Generate all export files for a road profile
 * Returns object with file names as keys and content as values
 */
export function generateAllProfileExports(data: RoadProfileExportData): Record<string, string> {
  const { session, points, alertSegments, summarySegments } = data;

  return {
    'road_profile_detail.csv': generateProfileDetailCSV(points),
    'road_profile_summary.csv': generateProfileSummaryCSV(summarySegments),
    'road_profile_alerts.csv': generateProfileAlertsCSV(alertSegments),
    'road_profile.geojson': generateProfileGeoJSON(session.id, points),
    'road_profile_alerts.geojson': generateAlertsGeoJSON(alertSegments, points)
  };
}

/**
 * Escape CSV field (handle commas, quotes, newlines)
 */
function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
