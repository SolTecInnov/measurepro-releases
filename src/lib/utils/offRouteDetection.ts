/**
 * Off-Route Detection Utility
 * 
 * Implements perpendicular distance calculation from a point to a polyline,
 * GPS filtering, threshold checking, and persistence logic.
 */

import { calculateDistance } from './geoUtils';

export interface DetectionConfig {
  allowedDeviationMeters: number; // 30m for rural, 15m for urban
  persistenceSeconds: number; // Must be off-route for this duration
  maxAccuracyMeters: number; // Reject GPS fixes with worse accuracy
}

export interface GPSPosition {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
}

export interface DetectionResult {
  isOffRoute: boolean;
  distanceFromRoute: number;
  nearestPoint: [number, number];
  withinAcceptableRange: boolean;
  persistent: boolean; // Has been off-route for persistence duration
  violationStartTime: number | null;
}

/**
 * Calculate the perpendicular distance from a point to a line segment
 * Returns distance in meters
 */
function perpendicularDistanceToSegment(
  point: [number, number],
  lineStart: [number, number],
  lineEnd: [number, number]
): { distance: number; nearestPoint: [number, number] } {
  const [px, py] = point; // Point coordinates (lat, lon)
  const [x1, y1] = lineStart;
  const [x2, y2] = lineEnd;

  // Calculate the line segment length squared
  const lineLengthSquared = Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2);

  // If the line segment is actually a point
  if (lineLengthSquared === 0) {
    const distance = calculateDistance(px, py, x1, y1) * 1000; // km to m
    return { distance, nearestPoint: [x1, y1] };
  }

  // Calculate the parameter t that defines the projection of point onto the line
  // t = [(P-A)·(B-A)] / |B-A|²
  let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / lineLengthSquared;

  // Clamp t to [0,1] to stay within the segment
  t = Math.max(0, Math.min(1, t));

  // Calculate the nearest point on the segment
  const nearestPoint: [number, number] = [
    x1 + t * (x2 - x1),
    y1 + t * (y2 - y1),
  ];

  // Calculate distance from point to nearest point
  const distance = calculateDistance(px, py, nearestPoint[0], nearestPoint[1]) * 1000; // km to m

  return { distance, nearestPoint };
}

/**
 * Calculate minimum distance from a point to a polyline
 * Returns the minimum distance and the nearest point on the route
 */
export function distanceToPolyline(
  point: [number, number],
  polyline: [number, number][]
): { distance: number; nearestPoint: [number, number] } {
  if (polyline.length === 0) {
    return { distance: Infinity, nearestPoint: [0, 0] };
  }

  if (polyline.length === 1) {
    const distance = calculateDistance(point[0], point[1], polyline[0][0], polyline[0][1]) * 1000;
    return { distance, nearestPoint: polyline[0] };
  }

  let minDistance = Infinity;
  let closestPoint: [number, number] = polyline[0];

  // Check distance to each segment
  for (let i = 0; i < polyline.length - 1; i++) {
    const { distance, nearestPoint } = perpendicularDistanceToSegment(
      point,
      polyline[i],
      polyline[i + 1]
    );

    if (distance < minDistance) {
      minDistance = distance;
      closestPoint = nearestPoint;
    }
  }

  return { distance: minDistance, nearestPoint: closestPoint };
}

/**
 * Check if GPS position is accurate enough
 */
export function isGPSAccurate(gps: GPSPosition, maxAccuracyMeters: number): boolean {
  return gps.accuracy <= maxAccuracyMeters;
}

/**
 * Detect if a GPS position is off the permitted route
 * 
 * @param gps Current GPS position
 * @param route Route polyline as array of [lat, lon] coordinates
 * @param config Detection configuration
 * @param violationStartTime When the current off-route violation started (null if on route)
 * @returns Detection result with distance, persistence info, etc.
 */
export function detectOffRoute(
  gps: GPSPosition,
  route: [number, number][],
  config: DetectionConfig,
  violationStartTime: number | null
): DetectionResult {
  // Reject inaccurate GPS fixes
  if (!isGPSAccurate(gps, config.maxAccuracyMeters)) {
    return {
      isOffRoute: false,
      distanceFromRoute: 0,
      nearestPoint: [0, 0],
      withinAcceptableRange: true,
      persistent: false,
      violationStartTime: null,
    };
  }

  // Calculate distance from route
  const { distance, nearestPoint } = distanceToPolyline([gps.latitude, gps.longitude], route);

  // Check if within allowed deviation
  const withinRange = distance <= config.allowedDeviationMeters;

  // If within range, reset violation timer
  if (withinRange) {
    return {
      isOffRoute: false,
      distanceFromRoute: distance,
      nearestPoint,
      withinAcceptableRange: true,
      persistent: false,
      violationStartTime: null,
    };
  }

  // Off-route detected
  const now = Date.now();
  const newViolationStart = violationStartTime || now;
  const violationDuration = (now - newViolationStart) / 1000; // seconds

  // Check if violation has persisted long enough
  const isPersistent = violationDuration >= config.persistenceSeconds;

  return {
    isOffRoute: true,
    distanceFromRoute: distance,
    nearestPoint,
    withinAcceptableRange: false,
    persistent: isPersistent,
    violationStartTime: newViolationStart,
  };
}

/**
 * Determine violation severity based on distance and environment
 */
export function getViolationSeverity(
  distance: number,
  environmentType: 'rural' | 'urban'
): 'warning' | 'critical' {
  const threshold = environmentType === 'rural' ? 30 : 15;
  const criticalThreshold = threshold * 1.5; // 50% over allowed

  if (distance >= criticalThreshold) {
    return 'critical';
  }
  return 'warning';
}

/**
 * Format distance for display
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${meters.toFixed(1)}m`;
  }
  return `${(meters / 1000).toFixed(2)}km`;
}

/**
 * Calculate route progress (0-1) based on nearest point
 */
export function calculateRouteProgress(
  nearestPoint: [number, number],
  route: [number, number][]
): number {
  if (route.length < 2) return 0;

  // Find which segment the nearest point is on
  let totalDistance = 0;
  let distanceToNearest = 0;

  for (let i = 0; i < route.length - 1; i++) {
    const segmentDist = calculateDistance(
      route[i][0],
      route[i][1],
      route[i + 1][0],
      route[i + 1][1]
    ) * 1000;

    const distToStart = calculateDistance(
      nearestPoint[0],
      nearestPoint[1],
      route[i][0],
      route[i][1]
    ) * 1000;

    if (distToStart < segmentDist * 1.1) {
      // This is likely the segment
      distanceToNearest = totalDistance + distToStart;
      break;
    }

    totalDistance += segmentDist;
  }

  // Calculate total route distance
  let routeTotalDistance = 0;
  for (let i = 0; i < route.length - 1; i++) {
    routeTotalDistance += calculateDistance(
      route[i][0],
      route[i][1],
      route[i + 1][0],
      route[i + 1][1]
    ) * 1000;
  }

  return routeTotalDistance > 0 ? distanceToNearest / routeTotalDistance : 0;
}
