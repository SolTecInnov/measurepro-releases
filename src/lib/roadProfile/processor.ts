/**
 * Road Profile Processor
 * Core algorithms for chainage, grade, and K-factor computation
 */

import type { 
  ProfileGpsSample, 
  RoadProfilePoint, 
  ProfileThresholds 
} from './types';
import {
  GRADE_UP_ALERT_THRESHOLD,
  GRADE_DOWN_ALERT_THRESHOLD,
  K_FACTOR_ALERT_THRESHOLD,
  MIN_SAMPLES_FOR_PROFILE,
  MIN_SAMPLES_FOR_ALERTS,
  MIN_CHAINAGE_FOR_ALERTS,
  GRADE_SMOOTHING_WINDOW
} from './constants';

/**
 * Haversine distance calculation between two GPS coordinates
 * Returns distance in meters
 */
export function haversineDistance(
  lat1: number, 
  lon1: number, 
  lat2: number, 
  lon2: number
): number {
  const R = 6371000; // Earth radius in meters
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * Math.PI / 180;
}

/**
 * Compute cumulative chainage (distance from start) for each sample
 */
export function computeChainage(samples: ProfileGpsSample[]): number[] {
  if (samples.length === 0) return [];
  
  const chainages: number[] = [0];
  
  for (let i = 1; i < samples.length; i++) {
    const prev = samples[i - 1];
    const curr = samples[i];
    const dist = haversineDistance(
      prev.latitude, prev.longitude,
      curr.latitude, curr.longitude
    );
    chainages.push(chainages[i - 1] + dist);
  }
  
  return chainages;
}

/**
 * Compute grade percentage between two points
 * grade_pct = (elevation_change / horizontal_distance) * 100
 * Positive = uphill, Negative = downhill
 */
export function computeGrade(
  elev1: number | null, 
  elev2: number | null, 
  horizontalDist: number
): number {
  if (elev1 === null || elev2 === null || horizontalDist < 0.1) {
    return 0;
  }
  const elevChange = elev2 - elev1;
  return (elevChange / horizontalDist) * 100;
}

/**
 * Compute smoothed grade using a sliding window
 * Reduces noise from GPS elevation inaccuracy
 */
export function computeSmoothedGrade(
  samples: ProfileGpsSample[],
  chainages: number[],
  index: number,
  windowSize: number = GRADE_SMOOTHING_WINDOW
): number {
  if (samples.length < 2) return 0;
  
  const halfWindow = Math.floor(windowSize / 2);
  const startIdx = Math.max(0, index - halfWindow);
  const endIdx = Math.min(samples.length - 1, index + halfWindow);
  
  if (startIdx === endIdx) return 0;
  
  const startElev = samples[startIdx].altitude;
  const endElev = samples[endIdx].altitude;
  const horizDist = chainages[endIdx] - chainages[startIdx];
  
  return computeGrade(startElev, endElev, horizDist);
}

/**
 * Compute K-factor (rate of grade change)
 * Simple implementation: |grade(i+1) - grade(i-1)| / distance
 * Can be refined later for strict highway engineering K
 */
export function computeKFactor(
  prevGrade: number,
  nextGrade: number,
  distance: number = 1
): number {
  if (distance < 0.1) return 0;
  return Math.abs(nextGrade - prevGrade);
}

/**
 * Determine grade alert type based on thresholds
 */
export function getGradeAlertType(
  grade_pct: number,
  upThreshold: number = GRADE_UP_ALERT_THRESHOLD,
  downThreshold: number = GRADE_DOWN_ALERT_THRESHOLD
): 'NONE' | 'GRADE_12_UP' | 'GRADE_12_DOWN' {
  if (grade_pct >= upThreshold) return 'GRADE_12_UP';
  if (grade_pct <= downThreshold) return 'GRADE_12_DOWN';
  return 'NONE';
}

/**
 * Determine K-factor alert type based on threshold
 */
export function getKAlertType(
  k_factor: number,
  threshold: number = K_FACTOR_ALERT_THRESHOLD
): 'NONE' | 'K_OVER_10' {
  return k_factor > threshold ? 'K_OVER_10' : 'NONE';
}

/**
 * Build complete road profile from GPS samples
 * Main entry point for profile computation
 */
export function buildRoadProfileFromSamples(params: {
  profileId: string;
  samples: ProfileGpsSample[];
  thresholds?: ProfileThresholds;
}): RoadProfilePoint[] {
  const { profileId, samples, thresholds } = params;
  
  if (samples.length < MIN_SAMPLES_FOR_PROFILE) {
    return [];
  }

  // Sort by timestamp
  const sortedSamples = [...samples].sort((a, b) => 
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  // Compute chainages
  const chainages = computeChainage(sortedSamples);

  // Build profile points
  const points: RoadProfilePoint[] = [];
  
  for (let i = 0; i < sortedSamples.length; i++) {
    const sample = sortedSamples[i];
    const chainage = chainages[i];
    
    // Compute smoothed grade
    const grade_pct = computeSmoothedGrade(sortedSamples, chainages, i);
    
    // Compute K-factor (using adjacent grades)
    let k_factor = 0;
    if (i > 0 && i < sortedSamples.length - 1) {
      const prevGrade = computeSmoothedGrade(sortedSamples, chainages, i - 1);
      const nextGrade = computeSmoothedGrade(sortedSamples, chainages, i + 1);
      const dist = chainages[i + 1] - chainages[i - 1];
      k_factor = computeKFactor(prevGrade, nextGrade, dist);
    }

    // Determine alerts — suppress for the first MIN_SAMPLES_FOR_ALERTS points and before
    // MIN_CHAINAGE_FOR_ALERTS to avoid false alerts from GPS noise at recording start
    const upThreshold = thresholds?.grade_up_alert_pct ?? GRADE_UP_ALERT_THRESHOLD;
    const downThreshold = thresholds?.grade_down_alert_pct ?? GRADE_DOWN_ALERT_THRESHOLD;
    const kThreshold = thresholds?.k_factor_alert ?? K_FACTOR_ALERT_THRESHOLD;
    
    const alertsEnabled = i >= MIN_SAMPLES_FOR_ALERTS && chainage >= MIN_CHAINAGE_FOR_ALERTS;
    const grade_alert_type = alertsEnabled
      ? getGradeAlertType(grade_pct, upThreshold, downThreshold)
      : 'NONE';
    const k_alert = alertsEnabled
      ? getKAlertType(k_factor, kThreshold)
      : 'NONE';

    // Build point
    const point: RoadProfilePoint = {
      profileId,
      chainage_m: chainage,
      lat: sample.latitude,
      lon: sample.longitude,
      elev_m: sample.altitude ?? 0,
      altitudeAvailable: sample.altitude !== null && sample.altitude !== undefined,
      grade_pct,
      k_factor,
      speed_kmh: sample.speed !== null ? sample.speed * 3.6 : undefined,
      timestamp_iso: sample.timestamp,
      quality: sample.quality ?? (sample.source === 'browser' ? 'browser' : 'unknown'),
      grade_alert_type,
      k_alert
    };

    points.push(point);
  }

  return points;
}

/**
 * Incrementally update profile with a new sample
 * Used during real-time recording for fast UI updates
 */
export function appendSampleToProfile(params: {
  profileId: string;
  existingPoints: RoadProfilePoint[];
  newSample: ProfileGpsSample;
  lastChainage: number;
  thresholds?: ProfileThresholds;
}): { point: RoadProfilePoint; chainage: number } {
  const { profileId, existingPoints, newSample, lastChainage, thresholds } = params;

  // Compute distance from last point
  let chainage = lastChainage;
  let prevGrade = 0;
  
  if (existingPoints.length > 0) {
    const lastPoint = existingPoints[existingPoints.length - 1];
    const dist = haversineDistance(
      lastPoint.lat, lastPoint.lon,
      newSample.latitude, newSample.longitude
    );
    chainage = lastChainage + dist;
    prevGrade = lastPoint.grade_pct;
  }

  // Compute grade from last point
  let grade_pct = 0;
  if (existingPoints.length > 0) {
    const lastPoint = existingPoints[existingPoints.length - 1];
    const horizDist = chainage - lastPoint.chainage_m;
    grade_pct = computeGrade(lastPoint.elev_m, newSample.altitude, horizDist);
  }

  // Compute K-factor (simple: change from previous grade)
  const k_factor = computeKFactor(prevGrade, grade_pct);

  // Determine alerts — suppress until minimum sample count and minimum chainage are satisfied
  // to avoid false alerts from GPS noise while stationary or slow-moving
  const upThreshold = thresholds?.grade_up_alert_pct ?? GRADE_UP_ALERT_THRESHOLD;
  const downThreshold = thresholds?.grade_down_alert_pct ?? GRADE_DOWN_ALERT_THRESHOLD;
  const kThreshold = thresholds?.k_factor_alert ?? K_FACTOR_ALERT_THRESHOLD;
  
  const enoughSamples = existingPoints.length >= MIN_SAMPLES_FOR_ALERTS;
  const enoughDistance = chainage >= MIN_CHAINAGE_FOR_ALERTS;
  const alertsEnabled = enoughSamples && enoughDistance;

  const grade_alert_type = alertsEnabled
    ? getGradeAlertType(grade_pct, upThreshold, downThreshold)
    : 'NONE';
  const k_alert = alertsEnabled
    ? getKAlertType(k_factor, kThreshold)
    : 'NONE';

  const point: RoadProfilePoint = {
    profileId,
    chainage_m: chainage,
    lat: newSample.latitude,
    lon: newSample.longitude,
    elev_m: newSample.altitude ?? 0,
    altitudeAvailable: newSample.altitude !== null && newSample.altitude !== undefined,
    grade_pct,
    k_factor,
    speed_kmh: newSample.speed !== null ? newSample.speed * 3.6 : undefined,
    timestamp_iso: newSample.timestamp,
    quality: newSample.quality ?? (newSample.source === 'browser' ? 'browser' : 'unknown'),
    grade_alert_type,
    k_alert
  };

  return { point, chainage };
}

/**
 * Re-compute grades and K-factors for a batch of points
 * Used after recording is complete for smoothed calculations
 */
export function recomputeProfileMetrics(
  points: RoadProfilePoint[],
  thresholds?: ProfileThresholds
): RoadProfilePoint[] {
  if (points.length < MIN_SAMPLES_FOR_PROFILE) {
    return points;
  }

  // Convert back to samples for reprocessing
  const samples: ProfileGpsSample[] = points.map(p => ({
    timestamp: p.timestamp_iso,
    latitude: p.lat,
    longitude: p.lon,
    altitude: p.elev_m,
    speed: p.speed_kmh !== undefined ? p.speed_kmh / 3.6 : null,
    heading: null,
    source: 'browser' as const,
    quality: p.quality as any
  }));

  return buildRoadProfileFromSamples({
    profileId: points[0].profileId,
    samples,
    thresholds
  });
}
