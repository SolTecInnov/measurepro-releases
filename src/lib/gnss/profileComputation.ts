/**
 * Client-side Road Profile Computation
 * Computes road profiles from GNSS samples locally without requiring server
 */

import type { GnssSample, RoadProfile, ProfilePoint, ProfileSummary } from '../../../server/gnss/types';

interface ComputeProfileOptions {
  stepM?: number;
  gradeTriggerPct?: number;
  kFactorConvexMin?: number;
  kFactorConcaveMin?: number;
}

const DEFAULT_OPTIONS: Required<ComputeProfileOptions> = {
  stepM: 5,
  gradeTriggerPct: 10,
  kFactorConvexMin: 5000,
  kFactorConcaveMin: -4000,
};

function haversineDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function computeProfileFromSamples(
  samples: GnssSample[],
  sessionId: string,
  options: ComputeProfileOptions = {}
): RoadProfile | null {
  if (samples.length < 2) {
    return null;
  }

  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  const validSamples = samples.filter(s => 
    s.latitude !== 0 && s.longitude !== 0 && s.altitude !== null && s.altitude !== undefined
  );
  
  if (validSamples.length < 2) {
    return null;
  }

  const sortedSamples = [...validSamples].sort((a, b) => 
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  let cumulativeDistance = 0;
  const rawPoints: ProfilePoint[] = [];

  for (let i = 0; i < sortedSamples.length; i++) {
    const sample = sortedSamples[i];
    
    if (i > 0) {
      const prev = sortedSamples[i - 1];
      const dist = haversineDistance(
        prev.latitude, prev.longitude,
        sample.latitude, sample.longitude
      );
      cumulativeDistance += dist;
    }

    const altitude = sample.altitude ?? 0;
    
    let grade = 0;
    if (i > 0) {
      const prev = sortedSamples[i - 1];
      const prevAlt = prev.altitude ?? 0;
      const segmentDist = haversineDistance(
        prev.latitude, prev.longitude,
        sample.latitude, sample.longitude
      );
      if (segmentDist > 0) {
        grade = ((altitude - prevAlt) / segmentDist) * 100;
      }
    }

    rawPoints.push({
      distance_m: cumulativeDistance,
      altitude,
      latitude: sample.latitude,
      longitude: sample.longitude,
      grade_pct: grade,
      timestamp: sample.timestamp,
      k_factor: null,
      curvature_type: null,
    });
  }

  const resampledPoints: ProfilePoint[] = [];
  let currentDistance = 0;
  
  while (currentDistance <= cumulativeDistance) {
    const before = rawPoints.filter(p => p.distance_m <= currentDistance).pop();
    const after = rawPoints.find(p => p.distance_m >= currentDistance);
    
    if (before && after && before !== after) {
      const t = (currentDistance - before.distance_m) / (after.distance_m - before.distance_m);
      resampledPoints.push({
        distance_m: currentDistance,
        altitude: before.altitude + t * (after.altitude - before.altitude),
        latitude: before.latitude + t * (after.latitude - before.latitude),
        longitude: before.longitude + t * (after.longitude - before.longitude),
        grade_pct: before.grade_pct + t * (after.grade_pct - before.grade_pct),
        timestamp: before.timestamp,
        k_factor: null,
        curvature_type: null,
      });
    } else if (before) {
      resampledPoints.push({ 
        ...before, 
        distance_m: currentDistance,
      });
    }
    
    currentDistance += opts.stepM;
  }

  let numGradeEvents = 0;
  let numKFactorEvents = 0;
  let maxGradeUp = 0;
  let maxGradeDown = 0;
  let minKFactorConvex: number | null = null;
  let minKFactorConcave: number | null = null;
  
  let inGradeEvent = false;

  for (let i = 1; i < resampledPoints.length; i++) {
    const point = resampledPoints[i];
    const absGrade = Math.abs(point.grade_pct);
    
    if (point.grade_pct > maxGradeUp) maxGradeUp = point.grade_pct;
    if (point.grade_pct < maxGradeDown) maxGradeDown = point.grade_pct;
    
    if (absGrade >= opts.gradeTriggerPct) {
      if (!inGradeEvent) {
        inGradeEvent = true;
        numGradeEvents++;
      }
    } else {
      inGradeEvent = false;
    }

    if (i >= 2) {
      const prev1 = resampledPoints[i - 1];
      const curr = resampledPoints[i];
      
      const grade1 = prev1.grade_pct;
      const grade2 = curr.grade_pct;
      const gradeDiff = grade2 - grade1;
      const distDiff = curr.distance_m - prev1.distance_m;
      
      if (distDiff > 0 && Math.abs(gradeDiff) > 0.1) {
        const kFactor = distDiff / (Math.abs(gradeDiff) / 100);
        const curvatureType: 'convex' | 'concave' = gradeDiff > 0 ? 'concave' : 'convex';
        
        if ((curvatureType === 'convex' && kFactor <= opts.kFactorConvexMin) ||
            (curvatureType === 'concave' && kFactor <= Math.abs(opts.kFactorConcaveMin))) {
          
          numKFactorEvents++;
          resampledPoints[i].k_factor = kFactor;
          resampledPoints[i].curvature_type = curvatureType;
          
          if (curvatureType === 'convex') {
            if (minKFactorConvex === null || kFactor < minKFactorConvex) {
              minKFactorConvex = kFactor;
            }
          } else {
            if (minKFactorConcave === null || kFactor < minKFactorConcave) {
              minKFactorConcave = kFactor;
            }
          }
        }
      }
    }
  }

  const firstSample = sortedSamples[0];
  const lastSample = sortedSamples[sortedSamples.length - 1];
  const totalClimb = resampledPoints.reduce((acc, p, i) => {
    if (i === 0) return 0;
    const diff = p.altitude - resampledPoints[i - 1].altitude;
    return acc + (diff > 0 ? diff : 0);
  }, 0);
  const totalDescent = resampledPoints.reduce((acc, p, i) => {
    if (i === 0) return 0;
    const diff = p.altitude - resampledPoints[i - 1].altitude;
    return acc + (diff < 0 ? Math.abs(diff) : 0);
  }, 0);
  
  const summary: ProfileSummary = {
    totalDistance_m: cumulativeDistance,
    totalClimb_m: totalClimb,
    totalDescent_m: totalDescent,
    maxGradeUp_pct: maxGradeUp,
    maxGradeDown_pct: maxGradeDown,
    minKFactorConvex,
    minKFactorConcave,
    numGradeEvents,
    numKFactorEvents,
    numRailCrossings: 0,
  };
  
  const profile: RoadProfile = {
    id: `profile-${Date.now()}`,
    sessionId,
    surveyId: sessionId,
    start: firstSample.timestamp,
    end: lastSample.timestamp,
    step_m: opts.stepM,
    grade_trigger_pct: opts.gradeTriggerPct,
    k_factor_convex_min: opts.kFactorConvexMin,
    k_factor_concave_min: opts.kFactorConcaveMin,
    created_at: new Date().toISOString(),
    points: resampledPoints,
    summary,
  };

  return profile;
}

export function computeTotalDistance(samples: GnssSample[]): number {
  if (samples.length < 2) return 0;
  
  let total = 0;
  for (let i = 1; i < samples.length; i++) {
    const prev = samples[i - 1];
    const curr = samples[i];
    if (prev.latitude !== 0 && prev.longitude !== 0 && curr.latitude !== 0 && curr.longitude !== 0) {
      total += haversineDistance(prev.latitude, prev.longitude, curr.latitude, curr.longitude);
    }
  }
  return total;
}
