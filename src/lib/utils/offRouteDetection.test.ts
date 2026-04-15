import { describe, it, expect } from 'vitest';
import {
  distanceToPolyline,
  isGPSAccurate,
  detectOffRoute,
  getViolationSeverity,
  formatDistance,
  calculateRouteProgress,
  type DetectionConfig,
  type GPSPosition,
} from './offRouteDetection';

describe('offRouteDetection', () => {
  describe('distanceToPolyline', () => {
    it('returns Infinity for empty polyline', () => {
      const result = distanceToPolyline([45, -73], []);
      expect(result.distance).toBe(Infinity);
    });

    it('returns distance to single-point polyline', () => {
      const result = distanceToPolyline([45.001, -73], [[45, -73]]);
      expect(result.distance).toBeGreaterThan(100); // ~111m
      expect(result.distance).toBeLessThan(120);
      expect(result.nearestPoint).toEqual([45, -73]);
    });

    it('finds nearest point on a segment', () => {
      const polyline: [number, number][] = [
        [45, -73],
        [45, -72],
      ];
      const point: [number, number] = [45.001, -72.5];
      const result = distanceToPolyline(point, polyline);
      expect(result.distance).toBeLessThan(200); // should be close to the route
      expect(result.nearestPoint[1]).toBeCloseTo(-72.5, 1); // nearest is around lon -72.5
    });

    it('returns 0 distance for point on the polyline', () => {
      const polyline: [number, number][] = [
        [45, -73],
        [45, -72],
      ];
      const result = distanceToPolyline([45, -72.5], polyline);
      expect(result.distance).toBeLessThan(1); // essentially on the line
    });
  });

  describe('isGPSAccurate', () => {
    it('returns true when accuracy is within threshold', () => {
      expect(isGPSAccurate({ latitude: 0, longitude: 0, accuracy: 5, timestamp: 0 }, 10)).toBe(true);
    });

    it('returns true when accuracy equals threshold', () => {
      expect(isGPSAccurate({ latitude: 0, longitude: 0, accuracy: 10, timestamp: 0 }, 10)).toBe(true);
    });

    it('returns false when accuracy exceeds threshold', () => {
      expect(isGPSAccurate({ latitude: 0, longitude: 0, accuracy: 15, timestamp: 0 }, 10)).toBe(false);
    });
  });

  describe('detectOffRoute', () => {
    const config: DetectionConfig = {
      allowedDeviationMeters: 30,
      persistenceSeconds: 5,
      maxAccuracyMeters: 10,
    };

    const route: [number, number][] = [
      [45, -73],
      [45, -72],
    ];

    it('returns on-route when GPS is inaccurate', () => {
      const gps: GPSPosition = { latitude: 45, longitude: -72.5, accuracy: 20, timestamp: Date.now() };
      const result = detectOffRoute(gps, route, config, null);
      expect(result.isOffRoute).toBe(false);
      expect(result.withinAcceptableRange).toBe(true);
    });

    it('returns on-route when within deviation', () => {
      const gps: GPSPosition = { latitude: 45.0001, longitude: -72.5, accuracy: 5, timestamp: Date.now() };
      const result = detectOffRoute(gps, route, config, null);
      expect(result.isOffRoute).toBe(false);
      expect(result.violationStartTime).toBeNull();
    });

    it('returns off-route when beyond deviation', () => {
      const gps: GPSPosition = { latitude: 45.01, longitude: -72.5, accuracy: 5, timestamp: Date.now() };
      const result = detectOffRoute(gps, route, config, null);
      expect(result.isOffRoute).toBe(true);
      expect(result.distanceFromRoute).toBeGreaterThan(30);
    });

    it('tracks violation start time', () => {
      const gps: GPSPosition = { latitude: 45.01, longitude: -72.5, accuracy: 5, timestamp: Date.now() };
      const result = detectOffRoute(gps, route, config, null);
      expect(result.violationStartTime).not.toBeNull();
    });

    it('detects persistent violation', () => {
      const now = Date.now();
      const startTime = now - 10000; // 10 seconds ago
      const gps: GPSPosition = { latitude: 45.01, longitude: -72.5, accuracy: 5, timestamp: now };
      const result = detectOffRoute(gps, route, config, startTime);
      expect(result.persistent).toBe(true);
    });

    it('non-persistent when violation just started', () => {
      const now = Date.now();
      const startTime = now - 1000; // 1 second ago
      const gps: GPSPosition = { latitude: 45.01, longitude: -72.5, accuracy: 5, timestamp: now };
      const result = detectOffRoute(gps, route, config, startTime);
      expect(result.persistent).toBe(false);
    });
  });

  describe('getViolationSeverity', () => {
    it('returns warning for rural at 31m (just over 30m threshold)', () => {
      expect(getViolationSeverity(31, 'rural')).toBe('warning');
    });

    it('returns critical for rural at 46m (over 45m = 30*1.5)', () => {
      expect(getViolationSeverity(46, 'rural')).toBe('critical');
    });

    it('returns warning for urban at 16m (just over 15m threshold)', () => {
      expect(getViolationSeverity(16, 'urban')).toBe('warning');
    });

    it('returns critical for urban at 23m (over 22.5m = 15*1.5)', () => {
      expect(getViolationSeverity(23, 'urban')).toBe('critical');
    });
  });

  describe('formatDistance', () => {
    it('formats meters under 1000', () => {
      expect(formatDistance(500)).toBe('500.0m');
    });

    it('formats kilometers at 1000+', () => {
      expect(formatDistance(1500)).toBe('1.50km');
    });

    it('formats small values', () => {
      expect(formatDistance(0.5)).toBe('0.5m');
    });
  });

  describe('calculateRouteProgress', () => {
    it('returns 0 for route with fewer than 2 points', () => {
      expect(calculateRouteProgress([45, -73], [[45, -73]])).toBe(0);
    });

    it('returns 0 at start of route', () => {
      const route: [number, number][] = [[45, -73], [45, -72]];
      const progress = calculateRouteProgress([45, -73], route);
      expect(progress).toBeCloseTo(0, 1);
    });

    it('returns value between 0 and 1 for midpoint', () => {
      const route: [number, number][] = [[45, -73], [45, -72]];
      const progress = calculateRouteProgress([45, -72.5], route);
      expect(progress).toBeGreaterThan(0);
      expect(progress).toBeLessThanOrEqual(1);
    });
  });
});
