/**
 * Core Geometry Functions for Alignment + Profile Linked Viewer
 * Implements projection, stationing, and point interpolation along polylines
 */

import type { LatLon, ProjectedPoint, PointAtStation } from './types';

const EARTH_RADIUS_M = 6371000;

function toRadians(deg: number): number {
  return deg * (Math.PI / 180);
}

function toDegrees(rad: number): number {
  return rad * (180 / Math.PI);
}

export function haversineDistance(p1: LatLon, p2: LatLon): number {
  const lat1 = toRadians(p1.lat);
  const lat2 = toRadians(p2.lat);
  const dLat = toRadians(p2.lat - p1.lat);
  const dLon = toRadians(p2.lon - p1.lon);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_M * c;
}

export function bearing(p1: LatLon, p2: LatLon): number {
  const lat1 = toRadians(p1.lat);
  const lat2 = toRadians(p2.lat);
  const dLon = toRadians(p2.lon - p1.lon);

  const y = Math.sin(dLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);

  let brng = toDegrees(Math.atan2(y, x));
  return (brng + 360) % 360;
}

export function interpolatePoint(p1: LatLon, p2: LatLon, t: number): LatLon {
  if (t <= 0) return { ...p1 };
  if (t >= 1) return { ...p2 };

  const lat1 = toRadians(p1.lat);
  const lon1 = toRadians(p1.lon);
  const lat2 = toRadians(p2.lat);
  const lon2 = toRadians(p2.lon);

  const d = haversineDistance(p1, p2) / EARTH_RADIUS_M;
  if (d < 1e-10) return { ...p1 };

  const A = Math.sin((1 - t) * d) / Math.sin(d);
  const B = Math.sin(t * d) / Math.sin(d);

  const x = A * Math.cos(lat1) * Math.cos(lon1) + B * Math.cos(lat2) * Math.cos(lon2);
  const y = A * Math.cos(lat1) * Math.sin(lon1) + B * Math.cos(lat2) * Math.sin(lon2);
  const z = A * Math.sin(lat1) + B * Math.sin(lat2);

  const lat = Math.atan2(z, Math.sqrt(x * x + y * y));
  const lon = Math.atan2(y, x);

  return {
    lat: toDegrees(lat),
    lon: toDegrees(lon),
  };
}

export function computePolylineCumDist(polyline: LatLon[]): number[] {
  if (polyline.length === 0) return [];
  
  const cumDist: number[] = [0];
  for (let i = 1; i < polyline.length; i++) {
    const segDist = haversineDistance(polyline[i - 1], polyline[i]);
    cumDist.push(cumDist[i - 1] + segDist);
  }
  return cumDist;
}

function projectPointToSegment(
  point: LatLon,
  segStart: LatLon,
  segEnd: LatLon
): { t: number; closestPoint: LatLon; perpDist: number } {
  const segLen = haversineDistance(segStart, segEnd);
  if (segLen < 0.001) {
    return {
      t: 0,
      closestPoint: { ...segStart },
      perpDist: haversineDistance(point, segStart),
    };
  }

  const startBearing = bearing(segStart, segEnd);
  const pointBearing = bearing(segStart, point);
  const pointDist = haversineDistance(segStart, point);

  const angleDiff = toRadians(pointBearing - startBearing);
  const along = pointDist * Math.cos(angleDiff);

  let t = along / segLen;
  t = Math.max(0, Math.min(1, t));

  const closestPoint = interpolatePoint(segStart, segEnd, t);
  const perpDist = haversineDistance(point, closestPoint);

  return { t, closestPoint, perpDist };
}

export function projectPointToPolyline(
  pointLatLon: LatLon,
  polylineLatLon: LatLon[],
  cumDistM: number[]
): ProjectedPoint {
  if (polylineLatLon.length === 0) {
    throw new Error('Polyline must have at least one point');
  }
  
  if (polylineLatLon.length === 1) {
    return {
      s_m: 0,
      offset_m: haversineDistance(pointLatLon, polylineLatLon[0]),
      closestLatLon: { ...polylineLatLon[0] },
      segIndex: 0,
      t: 0,
    };
  }

  let bestSegIndex = 0;
  let bestT = 0;
  let bestClosest: LatLon = polylineLatLon[0];
  let bestPerpDist = Infinity;

  for (let i = 0; i < polylineLatLon.length - 1; i++) {
    const { t, closestPoint, perpDist } = projectPointToSegment(
      pointLatLon,
      polylineLatLon[i],
      polylineLatLon[i + 1]
    );

    if (perpDist < bestPerpDist) {
      bestPerpDist = perpDist;
      bestSegIndex = i;
      bestT = t;
      bestClosest = closestPoint;
    }
  }

  const segLen = haversineDistance(
    polylineLatLon[bestSegIndex],
    polylineLatLon[bestSegIndex + 1]
  );
  const s_m = cumDistM[bestSegIndex] + bestT * segLen;

  const segBearing = bearing(
    polylineLatLon[bestSegIndex],
    polylineLatLon[bestSegIndex + 1]
  );
  const pointBearing = bearing(bestClosest, pointLatLon);
  let angleDiff = pointBearing - segBearing;
  while (angleDiff > 180) angleDiff -= 360;
  while (angleDiff < -180) angleDiff += 360;

  const signedOffset = angleDiff > 0 ? bestPerpDist : -bestPerpDist;

  return {
    s_m,
    offset_m: signedOffset,
    closestLatLon: bestClosest,
    segIndex: bestSegIndex,
    t: bestT,
  };
}

export function pointAtStation(
  polylineLatLon: LatLon[],
  cumDistM: number[],
  s_m: number
): PointAtStation {
  if (polylineLatLon.length === 0) {
    throw new Error('Polyline must have at least one point');
  }

  if (polylineLatLon.length === 1 || s_m <= 0) {
    const bearingDeg =
      polylineLatLon.length > 1
        ? bearing(polylineLatLon[0], polylineLatLon[1])
        : 0;
    return {
      lat: polylineLatLon[0].lat,
      lon: polylineLatLon[0].lon,
      bearingDeg,
    };
  }

  const totalDist = cumDistM[cumDistM.length - 1];
  if (s_m >= totalDist) {
    const n = polylineLatLon.length;
    const bearingDeg = bearing(polylineLatLon[n - 2], polylineLatLon[n - 1]);
    return {
      lat: polylineLatLon[n - 1].lat,
      lon: polylineLatLon[n - 1].lon,
      bearingDeg,
    };
  }

  let segIndex = 0;
  for (let i = 1; i < cumDistM.length; i++) {
    if (cumDistM[i] > s_m) {
      segIndex = i - 1;
      break;
    }
  }

  const segStart = polylineLatLon[segIndex];
  const segEnd = polylineLatLon[segIndex + 1];
  const segLen = cumDistM[segIndex + 1] - cumDistM[segIndex];
  const t = segLen > 0 ? (s_m - cumDistM[segIndex]) / segLen : 0;

  const point = interpolatePoint(segStart, segEnd, t);
  const bearingDeg = bearing(segStart, segEnd);

  return {
    lat: point.lat,
    lon: point.lon,
    bearingDeg,
  };
}

export function simplifyPolyline(
  polyline: LatLon[],
  toleranceM: number = 2
): LatLon[] {
  if (polyline.length <= 2) return [...polyline];

  function perpendicularDistance(point: LatLon, lineStart: LatLon, lineEnd: LatLon): number {
    const { perpDist } = projectPointToSegment(point, lineStart, lineEnd);
    return perpDist;
  }

  function douglasPeucker(points: LatLon[], start: number, end: number): LatLon[] {
    if (end - start < 2) {
      return points.slice(start, end + 1);
    }

    let maxDist = 0;
    let maxIndex = start;

    for (let i = start + 1; i < end; i++) {
      const dist = perpendicularDistance(points[i], points[start], points[end]);
      if (dist > maxDist) {
        maxDist = dist;
        maxIndex = i;
      }
    }

    if (maxDist > toleranceM) {
      const left = douglasPeucker(points, start, maxIndex);
      const right = douglasPeucker(points, maxIndex, end);
      return [...left.slice(0, -1), ...right];
    } else {
      return [points[start], points[end]];
    }
  }

  return douglasPeucker(polyline, 0, polyline.length - 1);
}

/**
 * Detect loops and backtracking in a polyline
 * Uses grid-based spatial hash for O(n) average case loop detection
 * Returns info about any detected self-intersections or direction reversals
 */
export function detectLoopsAndBacktracking(
  polyline: LatLon[],
  cumDistM: number[]
): { hasLoop: boolean; hasBacktrack: boolean; loopIndices: number[]; warnings: string[] } {
  const warnings: string[] = [];
  const loopIndices: number[] = [];
  let hasLoop = false;
  let hasBacktrack = false;

  if (polyline.length < 3) {
    return { hasLoop: false, hasBacktrack: false, loopIndices: [], warnings: [] };
  }

  // Use grid-based spatial hash for O(n) loop detection
  const LOOP_PROXIMITY_M = 20;
  const CELL_SIZE_DEG = 0.0002; // ~20m at equator, good enough for proximity
  const MIN_INDEX_GAP = 3; // Only flag non-adjacent points
  
  const grid: Map<string, number[]> = new Map();
  
  // Build grid hash
  for (let i = 0; i < polyline.length; i++) {
    const cellX = Math.floor(polyline[i].lon / CELL_SIZE_DEG);
    const cellY = Math.floor(polyline[i].lat / CELL_SIZE_DEG);
    const key = `${cellX},${cellY}`;
    
    if (!grid.has(key)) grid.set(key, []);
    grid.get(key)!.push(i);
  }
  
  // Check each point against its cell and neighbors
  for (let i = 0; i < polyline.length; i++) {
    const cellX = Math.floor(polyline[i].lon / CELL_SIZE_DEG);
    const cellY = Math.floor(polyline[i].lat / CELL_SIZE_DEG);
    
    // Check 3x3 neighborhood
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const neighborKey = `${cellX + dx},${cellY + dy}`;
        const neighbors = grid.get(neighborKey);
        if (!neighbors) continue;
        
        for (const j of neighbors) {
          if (Math.abs(j - i) >= MIN_INDEX_GAP) {
            const dist = haversineDistance(polyline[i], polyline[j]);
            if (dist < LOOP_PROXIMITY_M) {
              hasLoop = true;
              if (!loopIndices.includes(i)) loopIndices.push(i);
              if (!loopIndices.includes(j)) loopIndices.push(j);
            }
          }
        }
      }
    }
  }

  // Check for backtracking (sharp direction reversals > 150 degrees) - O(n)
  let backtrackCount = 0;
  for (let i = 1; i < polyline.length - 1; i++) {
    const bearingIn = bearing(polyline[i - 1], polyline[i]);
    const bearingOut = bearing(polyline[i], polyline[i + 1]);
    let turnAngle = Math.abs(bearingOut - bearingIn);
    if (turnAngle > 180) turnAngle = 360 - turnAngle;
    
    if (turnAngle > 150) {
      hasBacktrack = true;
      backtrackCount++;
      // Limit warnings to first 3 reversals to avoid spam
      if (backtrackCount <= 3) {
        const station = cumDistM[i];
        warnings.push(`Sharp reversal (${turnAngle.toFixed(0)}°) at station ${station.toFixed(0)}m`);
      }
    }
  }
  
  if (backtrackCount > 3) {
    warnings.push(`...and ${backtrackCount - 3} more reversals`);
  }

  if (hasLoop) {
    const loopCount = Math.ceil(loopIndices.length / 2);
    warnings.unshift(`Detected ${loopCount} potential loop(s) - stationing may be unreliable`);
  }

  return { hasLoop, hasBacktrack, loopIndices, warnings };
}

export function createAlignmentFromPath(
  path: LatLon[],
  simplifyToleranceM: number = 2
): { polyline: LatLon[]; cumDistM: number[]; warnings: string[] } {
  const simplified = simplifyPolyline(path, simplifyToleranceM);
  const cumDistM = computePolylineCumDist(simplified);
  const { warnings } = detectLoopsAndBacktracking(simplified, cumDistM);
  return { polyline: simplified, cumDistM, warnings };
}
