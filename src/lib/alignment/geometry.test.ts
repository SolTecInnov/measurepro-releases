import { describe, it, expect } from 'vitest';
import {
  haversineDistance,
  bearing,
  interpolatePoint,
  computePolylineCumDist,
  projectPointToPolyline,
  pointAtStation,
  simplifyPolyline,
  detectLoopsAndBacktracking,
} from './geometry';
import type { LatLon } from './types';

describe('geometry', () => {
  describe('haversineDistance', () => {
    it('returns 0 for same point', () => {
      const p = { lat: 45.5, lon: -73.5 };
      expect(haversineDistance(p, p)).toBe(0);
    });

    it('calculates distance in meters between nearby points', () => {
      const p1 = { lat: 45.5, lon: -73.5 };
      const p2 = { lat: 45.501, lon: -73.5 };
      const dist = haversineDistance(p1, p2);
      // ~111m per 0.001 degree of latitude
      expect(dist).toBeGreaterThan(100);
      expect(dist).toBeLessThan(120);
    });

    it('calculates longer distances correctly', () => {
      const montreal = { lat: 45.5017, lon: -73.5673 };
      const quebec = { lat: 46.8139, lon: -71.2080 };
      const dist = haversineDistance(montreal, quebec);
      // ~233 km = ~233000m
      expect(dist).toBeGreaterThan(230000);
      expect(dist).toBeLessThan(240000);
    });
  });

  describe('bearing', () => {
    it('returns ~0 for due north', () => {
      const p1 = { lat: 45, lon: -73 };
      const p2 = { lat: 46, lon: -73 };
      expect(bearing(p1, p2)).toBeCloseTo(0, 0);
    });

    it('returns ~90 for due east', () => {
      const p1 = { lat: 0, lon: 0 };
      const p2 = { lat: 0, lon: 1 };
      expect(bearing(p1, p2)).toBeCloseTo(90, 0);
    });

    it('returns ~180 for due south', () => {
      const p1 = { lat: 46, lon: -73 };
      const p2 = { lat: 45, lon: -73 };
      expect(bearing(p1, p2)).toBeCloseTo(180, 0);
    });

    it('returns ~270 for due west', () => {
      const p1 = { lat: 0, lon: 1 };
      const p2 = { lat: 0, lon: 0 };
      expect(bearing(p1, p2)).toBeCloseTo(270, 0);
    });

    it('always returns value in [0, 360)', () => {
      const b = bearing({ lat: 45.5, lon: -73.5 }, { lat: 46.8, lon: -71.2 });
      expect(b).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThan(360);
    });
  });

  describe('interpolatePoint', () => {
    const p1: LatLon = { lat: 0, lon: 0 };
    const p2: LatLon = { lat: 1, lon: 0 };

    it('returns p1 at t=0', () => {
      const result = interpolatePoint(p1, p2, 0);
      expect(result.lat).toBe(p1.lat);
      expect(result.lon).toBe(p1.lon);
    });

    it('returns p2 at t=1', () => {
      const result = interpolatePoint(p1, p2, 1);
      expect(result.lat).toBe(p2.lat);
      expect(result.lon).toBe(p2.lon);
    });

    it('returns midpoint at t=0.5', () => {
      const result = interpolatePoint(p1, p2, 0.5);
      expect(result.lat).toBeCloseTo(0.5, 2);
      expect(result.lon).toBeCloseTo(0, 2);
    });

    it('clamps t < 0 to p1', () => {
      const result = interpolatePoint(p1, p2, -0.5);
      expect(result.lat).toBe(p1.lat);
    });

    it('clamps t > 1 to p2', () => {
      const result = interpolatePoint(p1, p2, 1.5);
      expect(result.lat).toBe(p2.lat);
    });
  });

  describe('computePolylineCumDist', () => {
    it('returns empty for empty polyline', () => {
      expect(computePolylineCumDist([])).toEqual([]);
    });

    it('returns [0] for single point', () => {
      expect(computePolylineCumDist([{ lat: 0, lon: 0 }])).toEqual([0]);
    });

    it('computes cumulative distances', () => {
      const polyline: LatLon[] = [
        { lat: 0, lon: 0 },
        { lat: 0.001, lon: 0 },
        { lat: 0.002, lon: 0 },
      ];
      const cumDist = computePolylineCumDist(polyline);
      expect(cumDist).toHaveLength(3);
      expect(cumDist[0]).toBe(0);
      expect(cumDist[1]).toBeGreaterThan(0);
      expect(cumDist[2]).toBeCloseTo(cumDist[1] * 2, 0);
    });
  });

  describe('projectPointToPolyline', () => {
    it('throws for empty polyline', () => {
      expect(() => projectPointToPolyline({ lat: 0, lon: 0 }, [], [])).toThrow();
    });

    it('projects onto single-point polyline', () => {
      const p = { lat: 0.001, lon: 0 };
      const result = projectPointToPolyline(p, [{ lat: 0, lon: 0 }], [0]);
      expect(result.s_m).toBe(0);
      expect(result.offset_m).toBeGreaterThan(0);
    });

    it('projects point onto nearest segment', () => {
      const polyline: LatLon[] = [
        { lat: 0, lon: 0 },
        { lat: 0, lon: 0.01 },
        { lat: 0, lon: 0.02 },
      ];
      const cumDist = computePolylineCumDist(polyline);
      const point = { lat: 0.0001, lon: 0.005 };
      const result = projectPointToPolyline(point, polyline, cumDist);
      expect(result.segIndex).toBe(0);
      expect(result.s_m).toBeGreaterThan(0);
    });
  });

  describe('pointAtStation', () => {
    const polyline: LatLon[] = [
      { lat: 0, lon: 0 },
      { lat: 0, lon: 0.01 },
    ];
    const cumDist = computePolylineCumDist(polyline);

    it('throws for empty polyline', () => {
      expect(() => pointAtStation([], [], 0)).toThrow();
    });

    it('returns first point at station 0', () => {
      const result = pointAtStation(polyline, cumDist, 0);
      expect(result.lat).toBeCloseTo(0, 5);
      expect(result.lon).toBeCloseTo(0, 5);
    });

    it('returns last point at station >= total distance', () => {
      const result = pointAtStation(polyline, cumDist, cumDist[1] + 1000);
      expect(result.lat).toBeCloseTo(0, 3);
      expect(result.lon).toBeCloseTo(0.01, 3);
    });

    it('returns intermediate point at mid-station', () => {
      const midStation = cumDist[1] / 2;
      const result = pointAtStation(polyline, cumDist, midStation);
      expect(result.lon).toBeCloseTo(0.005, 2);
    });
  });

  describe('simplifyPolyline', () => {
    it('returns same polyline if 2 or fewer points', () => {
      const p: LatLon[] = [{ lat: 0, lon: 0 }, { lat: 1, lon: 1 }];
      expect(simplifyPolyline(p)).toHaveLength(2);
    });

    it('simplifies collinear points', () => {
      const p: LatLon[] = [
        { lat: 0, lon: 0 },
        { lat: 0.001, lon: 0 },
        { lat: 0.002, lon: 0 },
        { lat: 0.003, lon: 0 },
      ];
      const simplified = simplifyPolyline(p, 50);
      expect(simplified.length).toBeLessThanOrEqual(p.length);
      expect(simplified.length).toBeGreaterThanOrEqual(2);
    });

    it('preserves corners', () => {
      const p: LatLon[] = [
        { lat: 0, lon: 0 },
        { lat: 0.01, lon: 0 },
        { lat: 0.01, lon: 0.01 },
        { lat: 0, lon: 0.01 },
      ];
      const simplified = simplifyPolyline(p, 2);
      // Should keep all corners since they deviate significantly
      expect(simplified.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('detectLoopsAndBacktracking', () => {
    it('returns no issues for short polyline', () => {
      const p: LatLon[] = [{ lat: 0, lon: 0 }, { lat: 0.001, lon: 0 }];
      const cumDist = computePolylineCumDist(p);
      const result = detectLoopsAndBacktracking(p, cumDist);
      expect(result.hasLoop).toBe(false);
      expect(result.hasBacktrack).toBe(false);
    });

    it('detects backtracking (180-degree reversal)', () => {
      const p: LatLon[] = [
        { lat: 0, lon: 0 },
        { lat: 0.01, lon: 0 },
        { lat: 0.001, lon: 0 }, // reversal
      ];
      const cumDist = computePolylineCumDist(p);
      const result = detectLoopsAndBacktracking(p, cumDist);
      expect(result.hasBacktrack).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('returns no backtracking for straight line', () => {
      const p: LatLon[] = [
        { lat: 0, lon: 0 },
        { lat: 0.01, lon: 0 },
        { lat: 0.02, lon: 0 },
      ];
      const cumDist = computePolylineCumDist(p);
      const result = detectLoopsAndBacktracking(p, cumDist);
      expect(result.hasBacktrack).toBe(false);
    });
  });
});
