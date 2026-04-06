/**
 * Legacy Adapter for Road Profile Data
 * Maps legacy IndexedDB records to canonical types
 * 
 * Handles field name normalization:
 * - alt_m → elev_m
 * - distance_m → chainage_m
 * - Legacy event formats → standardized types
 */

import type {
  RoadProfilePoint,
  RoadProfileSession,
  ProfileThresholds,
  ProfileGpsSource
} from './types';

/**
 * Legacy profile point format (from IndexedDB roadProfiles.points)
 */
interface LegacyProfilePoint {
  lat?: number;
  latitude?: number;
  lon?: number;
  longitude?: number;
  alt_m?: number;
  altitude?: number;
  distance_m?: number;
  chainage_m?: number;
  grade_pct?: number;
  k_factor?: number;
  curvature_type?: string;
  timestamp?: string;
  quality?: string;
}

/**
 * Legacy profile sample format (from IndexedDB roadProfileSamples)
 */
interface LegacyProfileSample {
  id?: string;
  profileId: string;
  surveyId: string;
  timestamp: string;
  latitude: number;
  longitude: number;
  altitude?: number | null;
  speed?: number | null;
  heading?: number | null;
  accuracy?: number;
  source?: string;
  quality?: string;
  hdop?: number | null;
  numSats?: number | null;
}

/**
 * Legacy profile record format (from IndexedDB roadProfiles)
 */
interface LegacyProfileRecord {
  id: string;
  surveyId: string;
  name?: string;
  label?: string;
  gpsSource?: string;
  startTime?: string;
  endTime?: string;
  created_at?: string;
  updated_at?: string;
  grade_trigger_pct?: number;
  points?: LegacyProfilePoint[];
  summary?: {
    totalDistance_m?: number;
    totalClimb_m?: number;
    totalDescent_m?: number;
    maxGradeUp_pct?: number;
    maxGradeDown_pct?: number;
  };
}

/**
 * Normalize a legacy GPS source string to canonical type
 */
function normalizeGpsSource(source?: string): ProfileGpsSource {
  if (!source) return 'auto';
  const lower = source.toLowerCase();
  if (lower === 'duro' || lower === 'gnss') return 'duro';
  if (lower === 'serial' || lower === 'usb') return 'serial';
  if (lower === 'bluetooth' || lower === 'bt') return 'bluetooth';
  if (lower === 'browser' || lower === 'geolocation') return 'browser';
  return 'auto';
}

/**
 * Convert legacy profile point to canonical format
 */
export function normalizeLegacyPoint(
  point: LegacyProfilePoint,
  profileId: string,
  _index: number
): RoadProfilePoint {
  const lat = point.lat ?? point.latitude ?? 0;
  const lon = point.lon ?? point.longitude ?? 0;
  const elev_m = point.alt_m ?? point.altitude ?? 0;
  const chainage_m = point.chainage_m ?? point.distance_m ?? 0;
  const grade_pct = point.grade_pct ?? 0;
  const k_factor = point.k_factor ?? 0;
  const quality = point.quality ?? 'unknown';
  const timestamp = point.timestamp ?? new Date().toISOString();

  const rawAlt = point.alt_m ?? point.altitude;
  return {
    profileId,
    chainage_m,
    lat,
    lon,
    elev_m,
    altitudeAvailable: rawAlt !== null && rawAlt !== undefined,
    grade_pct,
    k_factor,
    timestamp_iso: timestamp,
    quality,
    grade_alert_type: grade_pct >= 10 ? 'GRADE_12_UP' : grade_pct <= -10 ? 'GRADE_12_DOWN' : 'NONE',
    k_alert: k_factor > 10 ? 'K_OVER_10' : 'NONE'
  };
}

/**
 * Convert legacy profile record to canonical session
 */
export function normalizeLegacyProfile(profile: LegacyProfileRecord): RoadProfileSession {
  const thresholds: ProfileThresholds = {
    grade_up_alert_pct: profile.grade_trigger_pct ?? 10,
    grade_down_alert_pct: -(profile.grade_trigger_pct ?? 10),
    k_factor_alert: 10
  };

  return {
    id: profile.id,
    surveyId: profile.surveyId,
    name: profile.name ?? profile.label,
    gpsSource: normalizeGpsSource(profile.gpsSource),
    state: 'idle',
    created_at: profile.created_at ?? profile.startTime ?? new Date().toISOString(),
    updated_at: profile.updated_at ?? profile.endTime ?? new Date().toISOString(),
    start_timestamp: profile.startTime,
    end_timestamp: profile.endTime,
    total_distance_m: profile.summary?.totalDistance_m ?? 0,
    total_samples: profile.points?.length ?? 0,
    sections: [],
    thresholds
  };
}

/**
 * Convert legacy profile with points to canonical format
 */
export function convertLegacyProfileToCanonical(
  profile: LegacyProfileRecord
): { session: RoadProfileSession; points: RoadProfilePoint[] } {
  const session = normalizeLegacyProfile(profile);
  
  const points: RoadProfilePoint[] = (profile.points ?? []).map((p, i) => 
    normalizeLegacyPoint(p, profile.id, i)
  );

  return { session, points };
}

/**
 * Convert legacy samples to canonical profile points
 * Re-computes chainage/grade/k-factor from raw samples
 */
export function convertLegacySamplesToPoints(
  profileId: string,
  samples: LegacyProfileSample[],
  thresholds?: ProfileThresholds
): RoadProfilePoint[] {
  if (samples.length === 0) return [];

  // Sort by timestamp
  const sorted = [...samples].sort((a, b) => 
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  const points: RoadProfilePoint[] = [];
  let chainage = 0;
  let prevLat: number | null = null;
  let prevLon: number | null = null;
  let prevElev: number | null = null;
  let prevGrade = 0;

  for (let i = 0; i < sorted.length; i++) {
    const sample = sorted[i];
    const lat = sample.latitude;
    const lon = sample.longitude;
    const elev = sample.altitude ?? 0;

    // Compute distance from previous point
    if (prevLat !== null && prevLon !== null) {
      const R = 6371000;
      const dLat = (lat - prevLat) * Math.PI / 180;
      const dLon = (lon - prevLon) * Math.PI / 180;
      const a = 
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(prevLat * Math.PI / 180) * Math.cos(lat * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      chainage += R * c;
    }

    // Compute grade
    let grade_pct = 0;
    if (prevElev !== null && prevLat !== null && prevLon !== null) {
      const horizDist = chainage - (points.length > 0 ? points[points.length - 1].chainage_m : 0);
      if (horizDist > 0.1) {
        grade_pct = ((elev - prevElev) / horizDist) * 100;
      }
    }

    // Compute K-factor
    const k_factor = Math.abs(grade_pct - prevGrade);

    // Determine alerts
    const upThreshold = thresholds?.grade_up_alert_pct ?? 10;
    const downThreshold = thresholds?.grade_down_alert_pct ?? -10;
    const kThreshold = thresholds?.k_factor_alert ?? 10;

    const grade_alert_type = grade_pct >= upThreshold ? 'GRADE_12_UP' : 
                             grade_pct <= downThreshold ? 'GRADE_12_DOWN' : 'NONE';
    const k_alert = k_factor > kThreshold ? 'K_OVER_10' : 'NONE';

    points.push({
      profileId,
      chainage_m: chainage,
      lat,
      lon,
      elev_m: elev,
      altitudeAvailable: sample.altitude !== null && sample.altitude !== undefined,
      grade_pct,
      k_factor,
      speed_kmh: sample.speed ? sample.speed * 3.6 : undefined,
      timestamp_iso: sample.timestamp,
      quality: sample.quality ?? 'unknown',
      grade_alert_type,
      k_alert
    });

    prevLat = lat;
    prevLon = lon;
    prevElev = elev;
    prevGrade = grade_pct;
  }

  return points;
}
