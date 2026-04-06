/**
 * Road Profile Engine for MeasurePRO RoadScope
 * Core algorithms for road profiling, grade calculation, K-factor analysis, and event detection
 * Professional heavy transport route analysis (wind turbine convoys, oversized loads)
 */

import {
  GnssSample,
  ProfilePoint,
  ProfileSummary,
  GradeEvent,
  KFactorEvent,
  RailCrossingEvent,
} from './types.js';
import { gnssConfig } from './config.js';

const EARTH_RADIUS_M = 6371000; // Earth radius in meters

/**
 * Calculate Haversine distance between two GPS coordinates
 * Accounts for Earth's curvature - accurate for distances up to ~1000km
 * 
 * @param lat1 Latitude of point 1 (decimal degrees)
 * @param lon1 Longitude of point 1 (decimal degrees)
 * @param lat2 Latitude of point 2 (decimal degrees)
 * @param lon2 Longitude of point 2 (decimal degrees)
 * @returns Distance in meters
 */
export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  // Convert to radians
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  // Haversine formula
  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_M * c;
}

/**
 * Linear interpolation helper
 */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Interpolate between two GNSS samples
 */
function interpolateSample(
  sample1: GnssSample,
  sample2: GnssSample,
  targetDistance: number,
  distance1: number,
  distance2: number
): { latitude: number; longitude: number; altitude: number; timestamp: string } {
  const t = (targetDistance - distance1) / (distance2 - distance1);

  const latitude = lerp(sample1.latitude, sample2.latitude, t);
  const longitude = lerp(sample1.longitude, sample2.longitude, t);
  const altitude = lerp(sample1.altitude ?? 0, sample2.altitude ?? 0, t);

  // Interpolate timestamp (convert to Unix ms, interpolate, convert back)
  const ts1 = new Date(sample1.timestamp).getTime();
  const ts2 = new Date(sample2.timestamp).getTime();
  const timestamp = new Date(lerp(ts1, ts2, t)).toISOString();

  return { latitude, longitude, altitude, timestamp };
}

/**
 * Resample GNSS samples to uniform distance intervals
 * 
 * @param samples Array of GNSS samples (irregular spacing)
 * @param stepMeters Distance interval for resampling (default 5m)
 * @returns Array of resampled points at uniform intervals
 */
export function resampleProfile(
  samples: GnssSample[],
  stepMeters = 5
): Array<{ distance_m: number; latitude: number; longitude: number; altitude: number; timestamp: string }> {
  if (samples.length === 0) return [];
  if (samples.length === 1) {
    return [{
      distance_m: 0,
      latitude: samples[0].latitude,
      longitude: samples[0].longitude,
      altitude: samples[0].altitude ?? 0,
      timestamp: samples[0].timestamp,
    }];
  }

  // Calculate cumulative distances for each sample
  const distances: number[] = [0];
  for (let i = 1; i < samples.length; i++) {
    const dist = haversineDistance(
      samples[i - 1].latitude,
      samples[i - 1].longitude,
      samples[i].latitude,
      samples[i].longitude
    );
    distances.push(distances[i - 1] + dist);
  }

  const totalDistance = distances[distances.length - 1];
  const resampled: Array<{ distance_m: number; latitude: number; longitude: number; altitude: number; timestamp: string }> = [];

  // First point
  resampled.push({
    distance_m: 0,
    latitude: samples[0].latitude,
    longitude: samples[0].longitude,
    altitude: samples[0].altitude ?? 0,
    timestamp: samples[0].timestamp,
  });

  // Resample at uniform intervals
  let currentDistance = stepMeters;
  let sampleIndex = 0;

  while (currentDistance < totalDistance) {
    // Find the two samples that bracket currentDistance
    while (sampleIndex < distances.length - 1 && distances[sampleIndex + 1] < currentDistance) {
      sampleIndex++;
    }

    if (sampleIndex >= distances.length - 1) break;

    // Interpolate between samples[sampleIndex] and samples[sampleIndex + 1]
    const interpolated = interpolateSample(
      samples[sampleIndex],
      samples[sampleIndex + 1],
      currentDistance,
      distances[sampleIndex],
      distances[sampleIndex + 1]
    );

    resampled.push({
      distance_m: currentDistance,
      ...interpolated,
    });

    currentDistance += stepMeters;
  }

  // Last point (if not already added)
  const lastSample = samples[samples.length - 1];
  if (resampled[resampled.length - 1].distance_m < totalDistance - stepMeters / 2) {
    resampled.push({
      distance_m: totalDistance,
      latitude: lastSample.latitude,
      longitude: lastSample.longitude,
      altitude: lastSample.altitude ?? 0,
      timestamp: lastSample.timestamp,
    });
  }

  return resampled;
}

/**
 * Calculate grade percentage between two points
 * 
 * @param alt1 Altitude of point 1 (meters)
 * @param alt2 Altitude of point 2 (meters)
 * @param horizontalDistance Horizontal distance between points (meters)
 * @returns Grade percentage (positive = uphill, negative = downhill)
 */
export function calculateGrade(
  alt1: number,
  alt2: number,
  horizontalDistance: number
): number {
  if (horizontalDistance === 0) return 0;
  return ((alt2 - alt1) / horizontalDistance) * 100;
}

/**
 * Apply moving average smoothing to an array of values
 * 
 * @param values Array of values to smooth
 * @param windowSize Window size for moving average (default 3)
 * @returns Smoothed array
 */
function movingAverage(values: number[], windowSize = 3): number[] {
  if (values.length === 0) return [];
  if (windowSize <= 1) return [...values];

  const smoothed: number[] = [];
  const halfWindow = Math.floor(windowSize / 2);

  for (let i = 0; i < values.length; i++) {
    const start = Math.max(0, i - halfWindow);
    const end = Math.min(values.length, i + halfWindow + 1);
    const window = values.slice(start, end);
    const avg = window.reduce((sum, val) => sum + val, 0) / window.length;
    smoothed.push(avg);
  }

  return smoothed;
}

/**
 * Calculate K-factor (vertical curvature) for three consecutive points
 * K-factor represents the radius of the vertical curve
 * 
 * Formula: K = L² / (8 * M)
 * where:
 *   L = horizontal length of curve (distance from A to C)
 *   M = middle ordinate (vertical offset of B from line A-C)
 * 
 * @param pointA First point
 * @param pointB Middle point
 * @param pointC Last point
 * @returns K-factor in meters (positive = convex/crest, negative = concave/sag)
 */
export function calculateKFactor(
  pointA: { distance_m: number; altitude: number },
  pointB: { distance_m: number; altitude: number },
  pointC: { distance_m: number; altitude: number }
): number {
  const L = pointC.distance_m - pointA.distance_m; // horizontal length

  if (L === 0) return 0;

  // Calculate expected altitude of B if it were on a straight line from A to C
  const t = (pointB.distance_m - pointA.distance_m) / L;
  const expectedAlt = lerp(pointA.altitude, pointC.altitude, t);

  // M = vertical offset of B from the chord A-C
  const M = pointB.altitude - expectedAlt;

  if (M === 0) return Infinity; // Perfectly straight (no curvature)

  // K = L² / (8 * M)
  const K = (L * L) / (8 * M);

  return K;
}

/**
 * Calculate complete road profile with grade and K-factor analysis
 * 
 * @param samples GNSS samples
 * @param stepMeters Resampling interval (default 5m)
 * @param gradeWindowSize Moving average window for grade smoothing (default 3)
 * @returns Array of ProfilePoints with grade and K-factor
 */
export function calculateProfile(
  samples: GnssSample[],
  stepMeters = 5,
  gradeWindowSize = 3
): ProfilePoint[] {
  // Resample to uniform intervals
  const resampled = resampleProfile(samples, stepMeters);

  if (resampled.length < 2) {
    return resampled.map(point => ({
      ...point,
      grade_pct: 0,
      k_factor: null,
      curvature_type: null,
    }));
  }

  // Calculate raw grades
  const rawGrades: number[] = [];
  for (let i = 0; i < resampled.length - 1; i++) {
    const grade = calculateGrade(
      resampled[i].altitude,
      resampled[i + 1].altitude,
      stepMeters
    );
    rawGrades.push(grade);
  }
  rawGrades.push(rawGrades[rawGrades.length - 1]); // Extend last grade

  // Smooth grades
  const smoothedGrades = movingAverage(rawGrades, gradeWindowSize);

  // Build profile points with grades
  const profilePoints: ProfilePoint[] = resampled.map((point, i) => ({
    ...point,
    grade_pct: smoothedGrades[i],
    k_factor: null,
    curvature_type: null,
  }));

  // Calculate K-factors (requires 3 consecutive points)
  if (profilePoints.length >= 3) {
    for (let i = 1; i < profilePoints.length - 1; i++) {
      const kFactor = calculateKFactor(
        profilePoints[i - 1],
        profilePoints[i],
        profilePoints[i + 1]
      );

      profilePoints[i].k_factor = isFinite(kFactor) ? kFactor : null;

      // Determine curvature type
      if (profilePoints[i].k_factor !== null) {
        if (Math.abs(profilePoints[i].k_factor!) < 0.01) {
          profilePoints[i].curvature_type = 'linear';
        } else if (profilePoints[i].k_factor! > 0) {
          profilePoints[i].curvature_type = 'convex'; // Crest
        } else {
          profilePoints[i].curvature_type = 'concave'; // Sag
        }
      }
    }
  }

  return profilePoints;
}

/**
 * Detect grade events (steep uphill or downhill segments)
 * 
 * @param profilePoints Profile points with grade data
 * @param triggerPct Grade threshold percentage (default 12%)
 * @returns Array of grade events (without surveyId, sessionId, profileId which are added by caller)
 */
export function detectGradeEvents(
  profilePoints: ProfilePoint[],
  triggerPct: number
): Omit<GradeEvent, 'id' | 'created_at' | 'surveyId' | 'sessionId' | 'profileId'>[] {
  const events: Omit<GradeEvent, 'id' | 'created_at' | 'surveyId' | 'sessionId' | 'profileId'>[] = [];
  let currentEvent: Omit<GradeEvent, 'id' | 'created_at' | 'surveyId' | 'sessionId' | 'profileId'> | null = null;

  for (let i = 0; i < profilePoints.length; i++) {
    const point = profilePoints[i];
    const absGrade = Math.abs(point.grade_pct);

    if (absGrade >= triggerPct) {
      const direction = point.grade_pct > 0 ? 'up' : 'down';

      if (!currentEvent) {
        // Start new event (surveyId, sessionId, profileId will be added by caller)
        currentEvent = {
          direction,
          trigger_pct: triggerPct,
          max_grade_pct: absGrade,
          start_distance_m: point.distance_m,
          end_distance_m: point.distance_m,
          length_m: 0,
          start_latitude: point.latitude,
          start_longitude: point.longitude,
          end_latitude: point.latitude,
          end_longitude: point.longitude,
          start_timestamp: point.timestamp,
          end_timestamp: point.timestamp,
        } as Omit<GradeEvent, 'id' | 'created_at' | 'surveyId' | 'sessionId' | 'profileId'>;
      } else if (currentEvent.direction === direction) {
        // Continue existing event
        currentEvent.end_distance_m = point.distance_m;
        currentEvent.end_latitude = point.latitude;
        currentEvent.end_longitude = point.longitude;
        currentEvent.end_timestamp = point.timestamp;
        currentEvent.max_grade_pct = Math.max(currentEvent.max_grade_pct, absGrade);
      } else {
        // Direction changed - save current event and start new one
        currentEvent.length_m = currentEvent.end_distance_m - currentEvent.start_distance_m;
        events.push(currentEvent);

        currentEvent = {
          direction,
          trigger_pct: triggerPct,
          max_grade_pct: absGrade,
          start_distance_m: point.distance_m,
          end_distance_m: point.distance_m,
          length_m: 0,
          start_latitude: point.latitude,
          start_longitude: point.longitude,
          end_latitude: point.latitude,
          end_longitude: point.longitude,
          start_timestamp: point.timestamp,
          end_timestamp: point.timestamp,
        } as Omit<GradeEvent, 'id' | 'created_at' | 'surveyId' | 'sessionId' | 'profileId'>;
      }
    } else {
      // Below threshold - save current event if exists
      if (currentEvent) {
        currentEvent.length_m = currentEvent.end_distance_m - currentEvent.start_distance_m;
        events.push(currentEvent);
        currentEvent = null;
      }
    }
  }

  // Save final event if exists
  if (currentEvent) {
    currentEvent.length_m = currentEvent.end_distance_m - currentEvent.start_distance_m;
    events.push(currentEvent);
  }

  return events;
}

/**
 * Detect K-factor events (sharp vertical curves)
 * 
 * @param profilePoints Profile points with K-factor data
 * @param convexMin Minimum K-factor for convex curves (crest warning threshold)
 * @param concaveMin Minimum K-factor for concave curves (sag warning threshold, negative)
 * @returns Array of K-factor events (without surveyId, sessionId, profileId which are added by caller)
 */
export function detectKFactorEvents(
  profilePoints: ProfilePoint[],
  convexMin: number,
  concaveMin: number
): Omit<KFactorEvent, 'id' | 'created_at' | 'surveyId' | 'sessionId' | 'profileId'>[] {
  const events: Omit<KFactorEvent, 'id' | 'created_at' | 'surveyId' | 'sessionId' | 'profileId'>[] = [];

  const convexCritical = gnssConfig.kFactorConvexCritical_m;
  const concaveCritical = gnssConfig.kFactorConcaveCritical_m;

  for (const point of profilePoints) {
    if (point.k_factor === null) continue;

    let triggered = false;
    let severity: 'warning' | 'critical' = 'warning';

    if (point.curvature_type === 'convex' && point.k_factor < convexMin) {
      // Sharp crest
      triggered = true;
      severity = point.k_factor < convexCritical ? 'critical' : 'warning';
    } else if (point.curvature_type === 'concave' && point.k_factor > concaveMin) {
      // Sharp sag
      triggered = true;
      severity = point.k_factor > concaveCritical ? 'critical' : 'warning';
    }

    if (triggered && (point.curvature_type === 'convex' || point.curvature_type === 'concave')) {
      events.push({
        curvature_type: point.curvature_type,
        k_factor: point.k_factor,
        trigger_threshold: point.curvature_type === 'convex' ? convexMin : concaveMin,
        distance_m: point.distance_m,
        latitude: point.latitude,
        longitude: point.longitude,
        timestamp: point.timestamp,
        severity,
      });
    }
  }

  return events;
}

/**
 * Detect rail crossings (elevation spikes)
 * 
 * @param profilePoints Profile points with elevation data
 * @param threshold Elevation spike threshold (meters, default 0.15m)
 * @param windowSize Number of points to analyze (default 5)
 * @returns Array of rail crossing events (without surveyId, sessionId, profileId which are added by caller)
 */
export function detectRailCrossings(
  profilePoints: ProfilePoint[],
  threshold: number,
  windowSize: number
): Omit<RailCrossingEvent, 'id' | 'created_at' | 'surveyId' | 'sessionId' | 'profileId'>[] {
  const events: Omit<RailCrossingEvent, 'id' | 'created_at' | 'surveyId' | 'sessionId' | 'profileId'>[] = [];

  if (profilePoints.length < windowSize) return events;

  const halfWindow = Math.floor(windowSize / 2);

  for (let i = halfWindow; i < profilePoints.length - halfWindow; i++) {
    const point = profilePoints[i];

    // Calculate moving average of surrounding points (excluding center)
    const windowPoints = [
      ...profilePoints.slice(i - halfWindow, i),
      ...profilePoints.slice(i + 1, i + halfWindow + 1),
    ];

    const avgAlt = windowPoints.reduce((sum, p) => sum + p.altitude, 0) / windowPoints.length;
    const elevationChange = point.altitude - avgAlt;

    // Detect spike (positive or negative)
    if (Math.abs(elevationChange) >= threshold) {
      events.push({
        detection_method: 'auto',
        distance_m: point.distance_m,
        latitude: point.latitude,
        longitude: point.longitude,
        timestamp: point.timestamp,
        elevation_change_m: elevationChange,
      });
    }
  }

  return events;
}

/**
 * Calculate profile summary statistics
 * 
 * @param profilePoints Profile points
 * @param gradeEvents Grade events
 * @param kFactorEvents K-factor events
 * @param railCrossings Rail crossing events
 * @returns Profile summary
 */
export function calculateProfileSummary(
  profilePoints: ProfilePoint[],
  gradeEvents: Omit<GradeEvent, 'id' | 'created_at' | 'surveyId' | 'sessionId' | 'profileId'>[],
  kFactorEvents: Omit<KFactorEvent, 'id' | 'created_at' | 'surveyId' | 'sessionId' | 'profileId'>[],
  railCrossings: Omit<RailCrossingEvent, 'id' | 'created_at' | 'surveyId' | 'sessionId' | 'profileId'>[]
): ProfileSummary {
  if (profilePoints.length === 0) {
    return {
      totalDistance_m: 0,
      totalClimb_m: 0,
      totalDescent_m: 0,
      maxGradeUp_pct: 0,
      maxGradeDown_pct: 0,
      minKFactorConvex: null,
      minKFactorConcave: null,
      numGradeEvents: 0,
      numKFactorEvents: 0,
      numRailCrossings: 0,
    };
  }

  const totalDistance_m = profilePoints[profilePoints.length - 1].distance_m;

  let totalClimb_m = 0;
  let totalDescent_m = 0;
  let maxGradeUp_pct = 0;
  let maxGradeDown_pct = 0;

  for (let i = 1; i < profilePoints.length; i++) {
    const elevChange = profilePoints[i].altitude - profilePoints[i - 1].altitude;
    if (isNaN(elevChange)) continue; // Skip if elevation data is invalid
    
    if (elevChange > 0.001) { // Use small threshold to avoid floating point errors
      totalClimb_m += elevChange;
    } else if (elevChange < -0.001) {
      totalDescent_m += Math.abs(elevChange);
    }

    const grade = profilePoints[i].grade_pct;
    if (isNaN(grade)) continue; // Skip if grade is invalid
    
    if (grade > maxGradeUp_pct) maxGradeUp_pct = grade;
    if (grade < 0 && Math.abs(grade) > maxGradeDown_pct) maxGradeDown_pct = Math.abs(grade);
  }

  // Find sharpest curvatures
  const convexKFactors = profilePoints
    .filter(p => p.curvature_type === 'convex' && p.k_factor !== null)
    .map(p => p.k_factor!);

  const concaveKFactors = profilePoints
    .filter(p => p.curvature_type === 'concave' && p.k_factor !== null)
    .map(p => p.k_factor!);

  const minKFactorConvex = convexKFactors.length > 0 ? Math.min(...convexKFactors) : null;
  const minKFactorConcave = concaveKFactors.length > 0 ? Math.max(...concaveKFactors) : null;

  return {
    totalDistance_m,
    totalClimb_m,
    totalDescent_m,
    maxGradeUp_pct,
    maxGradeDown_pct,
    minKFactorConvex,
    minKFactorConcave,
    numGradeEvents: gradeEvents.length,
    numKFactorEvents: kFactorEvents.length,
    numRailCrossings: railCrossings.length,
  };
}

/**
 * Generate complete road profile from GNSS samples
 * 
 * @param samples GNSS samples
 * @param options Profile generation options
 * @returns Complete profile with events
 */
export function generateRoadProfile(
  samples: GnssSample[],
  options: {
    step_m?: number;
    grade_trigger_pct?: number;
    k_factor_convex_min?: number;
    k_factor_concave_min?: number;
    sessionId?: string;
  } = {}
): {
  points: ProfilePoint[];
  gradeEvents: Omit<GradeEvent, 'id' | 'created_at' | 'surveyId' | 'sessionId' | 'profileId'>[];
  kFactorEvents: Omit<KFactorEvent, 'id' | 'created_at' | 'surveyId' | 'sessionId' | 'profileId'>[];
  railCrossings: Omit<RailCrossingEvent, 'id' | 'created_at' | 'surveyId' | 'sessionId' | 'profileId'>[];
  summary: ProfileSummary;
} {
  const step_m = options.step_m ?? gnssConfig.profileDefaultStep_m;
  const grade_trigger_pct = options.grade_trigger_pct ?? gnssConfig.profileDefaultGradeTrigger_pct;
  const k_factor_convex_min = options.k_factor_convex_min ?? gnssConfig.kFactorConvexWarning_m;
  const k_factor_concave_min = options.k_factor_concave_min ?? gnssConfig.kFactorConcaveWarning_m;

  // Calculate profile
  const points = calculateProfile(samples, step_m);

  // Detect events
  const gradeEvents = detectGradeEvents(points, grade_trigger_pct).map(event => ({
    ...event,
    sessionId: options.sessionId,
  }));

  const kFactorEvents = detectKFactorEvents(
    points,
    k_factor_convex_min,
    k_factor_concave_min
  ).map(event => ({
    ...event,
    sessionId: options.sessionId,
  }));

  const railCrossings = detectRailCrossings(
    points,
    gnssConfig.railCrossingElevationThreshold_m,
    gnssConfig.railCrossingWindowSize
  ).map(event => ({
    ...event,
    sessionId: options.sessionId,
  }));

  // Calculate summary
  const summary = calculateProfileSummary(points, gradeEvents, kFactorEvents, railCrossings);

  return {
    points,
    gradeEvents,
    kFactorEvents,
    railCrossings,
    summary,
  };
}
