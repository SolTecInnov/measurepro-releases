/**
 * Road Profile Engine Unit Tests
 * Tests for Haversine, resampling, grade calculation, K-factor analysis, and event detection
 */

import { describe, it, expect } from 'vitest';
import {
  haversineDistance,
  resampleProfile,
  calculateGrade,
  calculateKFactor,
  calculateProfile,
  detectGradeEvents,
  detectKFactorEvents,
  detectRailCrossings,
  generateRoadProfile,
} from '../../server/gnss/roadProfile';
import { GnssSample, ProfilePoint } from '../../server/gnss/types';

/** Helper to create a GnssSample with required fields */
function makeSample(overrides: Partial<GnssSample> & Pick<GnssSample, 'timestamp' | 'latitude' | 'longitude' | 'altitude'>): GnssSample {
  return {
    speed: 10,
    heading: 0,
    quality: 'rtk_fixed',
    hdop: 1.0,
    num_sats: 12,
    source: 'duro',
    surveyId: 'test-survey',
    sessionId: 'test-session',
    ...overrides,
  } as GnssSample;
}

/** Helper to create a ProfilePoint with required fields */
function makeProfilePoint(overrides: Partial<ProfilePoint>): ProfilePoint {
  return {
    distance_m: 0,
    latitude: 45.0,
    longitude: -75.0,
    altitude: 100,
    timestamp: '2024-01-01T10:00:00Z',
    grade_pct: 0,
    k_factor: null,
    curvature_type: null,
    ...overrides,
  };
}

describe('Road Profile Engine', () => {
  describe('haversineDistance', () => {
    it('should calculate distance between two known points accurately', () => {
      const distance = haversineDistance(37.7749, -122.4194, 34.0522, -118.2437);
      expect(distance).toBeGreaterThan(550000);
      expect(distance).toBeLessThan(570000);
    });

    it('should return 0 for identical coordinates', () => {
      const distance = haversineDistance(45.0, -75.0, 45.0, -75.0);
      expect(distance).toBe(0);
    });

    it('should calculate short distances accurately', () => {
      const distance = haversineDistance(45.0, -75.0, 46.0, -75.0);
      expect(distance).toBeGreaterThan(110000);
      expect(distance).toBeLessThan(112000);
    });

    it('should handle antipodal points', () => {
      const distance = haversineDistance(0, 0, 0, 180);
      const halfCircumference = Math.PI * 6371000;
      expect(distance).toBeCloseTo(halfCircumference, -3);
    });
  });

  describe('calculateGrade', () => {
    it('should calculate positive grade for uphill', () => {
      const grade = calculateGrade(100, 112, 100);
      expect(grade).toBe(12);
    });

    it('should calculate negative grade for downhill', () => {
      const grade = calculateGrade(100, 88, 100);
      expect(grade).toBe(-12);
    });

    it('should return 0 for flat terrain', () => {
      const grade = calculateGrade(100, 100, 100);
      expect(grade).toBe(0);
    });

    it('should handle steep grades correctly', () => {
      const grade = calculateGrade(0, 45, 100);
      expect(grade).toBe(45);
    });

    it('should return 0 when distance is 0', () => {
      const grade = calculateGrade(100, 110, 0);
      expect(grade).toBe(0);
    });
  });

  describe('resampleProfile', () => {
    it('should handle empty input', () => {
      const result = resampleProfile([], 5);
      expect(result).toEqual([]);
    });

    it('should handle single sample', () => {
      const samples: GnssSample[] = [
        makeSample({
          timestamp: '2024-01-01T10:00:00Z',
          latitude: 45.0,
          longitude: -75.0,
          altitude: 100,
          speed: 0,
          heading: 0,
        }),
      ];

      const result = resampleProfile(samples, 5);
      expect(result).toHaveLength(1);
      expect(result[0].distance_m).toBe(0);
      expect(result[0].latitude).toBe(45.0);
      expect(result[0].longitude).toBe(-75.0);
      expect(result[0].altitude).toBe(100);
    });

    it('should resample at uniform intervals', () => {
      const samples: GnssSample[] = [
        makeSample({ timestamp: '2024-01-01T10:00:00Z', latitude: 45.0000, longitude: -75.0000, altitude: 100 }),
        makeSample({ timestamp: '2024-01-01T10:00:01Z', latitude: 45.0001, longitude: -75.0000, altitude: 100 }),
        makeSample({ timestamp: '2024-01-01T10:00:02Z', latitude: 45.0002, longitude: -75.0000, altitude: 100 }),
      ];

      const stepMeters = 5;
      const result = resampleProfile(samples, stepMeters);

      for (let i = 1; i < result.length - 1; i++) {
        const interval = result[i].distance_m - result[i - 1].distance_m;
        expect(interval).toBeCloseTo(stepMeters, 0);
      }
    });

    it('should interpolate lat/lon/alt correctly', () => {
      const samples: GnssSample[] = [
        makeSample({ timestamp: '2024-01-01T10:00:00Z', latitude: 45.0000, longitude: -75.0000, altitude: 100 }),
        makeSample({ timestamp: '2024-01-01T10:00:10Z', latitude: 45.0010, longitude: -75.0010, altitude: 110 }),
      ];

      const result = resampleProfile(samples, 5);

      for (const point of result) {
        expect(point.latitude).toBeGreaterThanOrEqual(45.0000);
        expect(point.latitude).toBeLessThanOrEqual(45.0010);
        expect(point.longitude).toBeGreaterThanOrEqual(-75.0010);
        expect(point.longitude).toBeLessThanOrEqual(-75.0000);
        expect(point.altitude).toBeGreaterThanOrEqual(100);
        expect(point.altitude).toBeLessThanOrEqual(110);
      }
    });
  });

  describe('calculateKFactor', () => {
    it('should detect convex curve (crest)', () => {
      const pointA = { distance_m: 0, altitude: 100 };
      const pointB = { distance_m: 50, altitude: 105 };
      const pointC = { distance_m: 100, altitude: 100 };

      const kFactor = calculateKFactor(pointA, pointB, pointC);
      expect(kFactor).toBeGreaterThan(0);
    });

    it('should detect concave curve (sag)', () => {
      const pointA = { distance_m: 0, altitude: 100 };
      const pointB = { distance_m: 50, altitude: 95 };
      const pointC = { distance_m: 100, altitude: 100 };

      const kFactor = calculateKFactor(pointA, pointB, pointC);
      expect(kFactor).toBeLessThan(0);
    });

    it('should return Infinity for perfectly straight line', () => {
      const pointA = { distance_m: 0, altitude: 100 };
      const pointB = { distance_m: 50, altitude: 100 };
      const pointC = { distance_m: 100, altitude: 100 };

      const kFactor = calculateKFactor(pointA, pointB, pointC);
      expect(kFactor).toBe(Infinity);
    });

    it('should calculate sharp crest (small K-factor)', () => {
      const pointA = { distance_m: 0, altitude: 100 };
      const pointB = { distance_m: 25, altitude: 110 };
      const pointC = { distance_m: 50, altitude: 100 };

      const kFactor = calculateKFactor(pointA, pointB, pointC);
      expect(kFactor).toBeLessThan(10000);
    });

    it('should calculate gentle curve (large K-factor)', () => {
      const pointA = { distance_m: 0, altitude: 100 };
      const pointB = { distance_m: 500, altitude: 100.5 };
      const pointC = { distance_m: 1000, altitude: 100 };

      const kFactor = calculateKFactor(pointA, pointB, pointC);
      expect(kFactor).toBeGreaterThan(50000);
    });
  });

  describe('calculateProfile', () => {
    it('should calculate grades for all points', () => {
      const samples: GnssSample[] = [
        makeSample({ timestamp: '2024-01-01T10:00:00Z', latitude: 45.0000, longitude: -75.0000, altitude: 100 }),
        makeSample({ timestamp: '2024-01-01T10:00:01Z', latitude: 45.0001, longitude: -75.0000, altitude: 110 }),
        makeSample({ timestamp: '2024-01-01T10:00:02Z', latitude: 45.0002, longitude: -75.0000, altitude: 115 }),
      ];

      const profile = calculateProfile(samples, 5);

      for (const point of profile) {
        expect(point.grade_pct).toBeDefined();
        expect(typeof point.grade_pct).toBe('number');
      }
    });

    it('should calculate K-factors for interior points', () => {
      const samples: GnssSample[] = [
        makeSample({ timestamp: '2024-01-01T10:00:00Z', latitude: 45.0000, longitude: -75.0000, altitude: 100 }),
        makeSample({ timestamp: '2024-01-01T10:00:01Z', latitude: 45.0001, longitude: -75.0000, altitude: 105 }),
        makeSample({ timestamp: '2024-01-01T10:00:02Z', latitude: 45.0002, longitude: -75.0000, altitude: 100 }),
      ];

      const profile = calculateProfile(samples, 5);

      const interiorPoints = profile.slice(1, -1);
      for (const point of interiorPoints) {
        expect(point.k_factor).toBeDefined();
        if (point.k_factor !== null) {
          expect(point.curvature_type).toBeDefined();
        }
      }
    });
  });

  describe('detectGradeEvents', () => {
    it('should detect steep uphill grade event', () => {
      const profilePoints: ProfilePoint[] = [
        makeProfilePoint({ distance_m: 0, latitude: 45.0, longitude: -75.0, altitude: 100, timestamp: '2024-01-01T10:00:00Z', grade_pct: 5 }),
        makeProfilePoint({ distance_m: 5, latitude: 45.0001, longitude: -75.0, altitude: 101, timestamp: '2024-01-01T10:00:01Z', grade_pct: 15 }),
        makeProfilePoint({ distance_m: 10, latitude: 45.0002, longitude: -75.0, altitude: 102, timestamp: '2024-01-01T10:00:02Z', grade_pct: 14 }),
        makeProfilePoint({ distance_m: 15, latitude: 45.0003, longitude: -75.0, altitude: 103, timestamp: '2024-01-01T10:00:03Z', grade_pct: 5 }),
      ];

      const events = detectGradeEvents(profilePoints, 12);

      expect(events).toHaveLength(1);
      expect(events[0].direction).toBe('up');
      expect(events[0].max_grade_pct).toBeGreaterThanOrEqual(15);
      expect(events[0].start_distance_m).toBe(5);
      expect(events[0].end_distance_m).toBe(10);
    });

    it('should detect steep downhill grade event', () => {
      const profilePoints: ProfilePoint[] = [
        makeProfilePoint({ distance_m: 0, latitude: 45.0, longitude: -75.0, altitude: 100, grade_pct: 0 }),
        makeProfilePoint({ distance_m: 5, latitude: 45.0001, longitude: -75.0, altitude: 95, timestamp: '2024-01-01T10:00:01Z', grade_pct: -15 }),
        makeProfilePoint({ distance_m: 10, latitude: 45.0002, longitude: -75.0, altitude: 96, timestamp: '2024-01-01T10:00:02Z', grade_pct: 0 }),
      ];

      const events = detectGradeEvents(profilePoints, 12);

      expect(events).toHaveLength(1);
      expect(events[0].direction).toBe('down');
      expect(events[0].max_grade_pct).toBeGreaterThanOrEqual(15);
    });

    it('should group consecutive steep segments', () => {
      const profilePoints: ProfilePoint[] = [
        makeProfilePoint({ distance_m: 0, latitude: 45.0, longitude: -75.0, altitude: 100, grade_pct: 5 }),
        makeProfilePoint({ distance_m: 5, latitude: 45.0001, longitude: -75.0, altitude: 101, grade_pct: 13 }),
        makeProfilePoint({ distance_m: 10, latitude: 45.0002, longitude: -75.0, altitude: 102, grade_pct: 14 }),
        makeProfilePoint({ distance_m: 15, latitude: 45.0003, longitude: -75.0, altitude: 103, grade_pct: 12.5 }),
        makeProfilePoint({ distance_m: 20, latitude: 45.0004, longitude: -75.0, altitude: 104, grade_pct: 5 }),
      ];

      const events = detectGradeEvents(profilePoints, 12);

      expect(events).toHaveLength(1);
      expect(events[0].length_m).toBe(10);
    });

    it('should not detect events below threshold', () => {
      const profilePoints: ProfilePoint[] = [
        makeProfilePoint({ distance_m: 0, latitude: 45.0, longitude: -75.0, altitude: 100, grade_pct: 5 }),
        makeProfilePoint({ distance_m: 5, latitude: 45.0001, longitude: -75.0, altitude: 101, grade_pct: 8 }),
        makeProfilePoint({ distance_m: 10, latitude: 45.0002, longitude: -75.0, altitude: 102, grade_pct: 6 }),
      ];

      const events = detectGradeEvents(profilePoints, 12);
      expect(events).toHaveLength(0);
    });
  });

  describe('detectKFactorEvents', () => {
    it('should detect sharp crest (convex) event', () => {
      const profilePoints: ProfilePoint[] = [
        makeProfilePoint({ distance_m: 0, latitude: 45.0, longitude: -75.0, altitude: 100, grade_pct: 5 }),
        makeProfilePoint({ distance_m: 5, latitude: 45.0001, longitude: -75.0, altitude: 105, grade_pct: 10, k_factor: 3000, curvature_type: 'convex' }),
        makeProfilePoint({ distance_m: 10, latitude: 45.0002, longitude: -75.0, altitude: 106, grade_pct: 5 }),
      ];

      const events = detectKFactorEvents(profilePoints, 10000, -8000);

      expect(events).toHaveLength(1);
      expect(events[0].curvature_type).toBe('convex');
      expect(events[0].k_factor).toBe(3000);
      expect(events[0].severity).toBe('critical');
    });

    it('should detect sharp sag (concave) event', () => {
      const profilePoints: ProfilePoint[] = [
        makeProfilePoint({ distance_m: 0, latitude: 45.0, longitude: -75.0, altitude: 100, grade_pct: -5 }),
        makeProfilePoint({ distance_m: 5, latitude: 45.0001, longitude: -75.0, altitude: 95, grade_pct: -10, k_factor: -3000, curvature_type: 'concave' }),
        makeProfilePoint({ distance_m: 10, latitude: 45.0002, longitude: -75.0, altitude: 94, grade_pct: -5 }),
      ];

      const events = detectKFactorEvents(profilePoints, 10000, -8000);

      expect(events).toHaveLength(1);
      expect(events[0].curvature_type).toBe('concave');
      expect(events[0].k_factor).toBe(-3000);
      expect(events[0].severity).toBe('critical');
    });

    it('should not detect gentle curves', () => {
      const profilePoints: ProfilePoint[] = [
        makeProfilePoint({ distance_m: 0, latitude: 45.0, longitude: -75.0, altitude: 100, grade_pct: 5 }),
        makeProfilePoint({ distance_m: 5, latitude: 45.0001, longitude: -75.0, altitude: 105, grade_pct: 10, k_factor: 50000, curvature_type: 'convex' }),
        makeProfilePoint({ distance_m: 10, latitude: 45.0002, longitude: -75.0, altitude: 106, grade_pct: 5 }),
      ];

      const events = detectKFactorEvents(profilePoints, 10000, -8000);
      expect(events).toHaveLength(0);
    });
  });

  describe('detectRailCrossings', () => {
    it('should detect elevation spike', () => {
      const profilePoints: ProfilePoint[] = [
        makeProfilePoint({ distance_m: 0, latitude: 45.0, longitude: -75.0, altitude: 100 }),
        makeProfilePoint({ distance_m: 5, latitude: 45.0001, longitude: -75.0, altitude: 100 }),
        makeProfilePoint({ distance_m: 10, latitude: 45.0002, longitude: -75.0, altitude: 100 }),
        makeProfilePoint({ distance_m: 15, latitude: 45.0003, longitude: -75.0, altitude: 100.2 }), // Spike
        makeProfilePoint({ distance_m: 20, latitude: 45.0004, longitude: -75.0, altitude: 100 }),
        makeProfilePoint({ distance_m: 25, latitude: 45.0005, longitude: -75.0, altitude: 100 }),
        makeProfilePoint({ distance_m: 30, latitude: 45.0006, longitude: -75.0, altitude: 100 }),
      ];

      const events = detectRailCrossings(profilePoints, 0.15, 5);

      expect(events).toHaveLength(1);
      expect(events[0].detection_method).toBe('auto');
      expect(events[0].distance_m).toBe(15);
      expect(events[0].elevation_change_m).toBeCloseTo(0.2, 1);
    });

    it('should not detect small variations', () => {
      const profilePoints: ProfilePoint[] = [
        makeProfilePoint({ distance_m: 0, latitude: 45.0, longitude: -75.0, altitude: 100 }),
        makeProfilePoint({ distance_m: 5, latitude: 45.0001, longitude: -75.0, altitude: 100.05 }),
        makeProfilePoint({ distance_m: 10, latitude: 45.0002, longitude: -75.0, altitude: 100.03 }),
        makeProfilePoint({ distance_m: 15, latitude: 45.0003, longitude: -75.0, altitude: 100.04 }),
        makeProfilePoint({ distance_m: 20, latitude: 45.0004, longitude: -75.0, altitude: 100.06 }),
      ];

      const events = detectRailCrossings(profilePoints, 0.15, 5);
      expect(events).toHaveLength(0);
    });
  });

  describe('generateRoadProfile', () => {
    it('should generate complete profile with all events', () => {
      const samples: GnssSample[] = [
        makeSample({ timestamp: '2024-01-01T10:00:00Z', latitude: 45.0000, longitude: -75.0000, altitude: 100 }),
        makeSample({ timestamp: '2024-01-01T10:00:01Z', latitude: 45.0001, longitude: -75.0000, altitude: 110 }),
        makeSample({ timestamp: '2024-01-01T10:00:02Z', latitude: 45.0002, longitude: -75.0000, altitude: 115 }),
        makeSample({ timestamp: '2024-01-01T10:00:03Z', latitude: 45.0003, longitude: -75.0000, altitude: 116 }),
      ];

      const result = generateRoadProfile(samples, {
        step_m: 5,
        grade_trigger_pct: 10,
        sessionId: 'test-session',
      });

      expect(result.points).toBeDefined();
      expect(result.points.length).toBeGreaterThan(0);
      expect(result.gradeEvents).toBeDefined();
      expect(result.kFactorEvents).toBeDefined();
      expect(result.railCrossings).toBeDefined();
      expect(result.summary).toBeDefined();

      // Check summary
      expect(result.summary.totalDistance_m).toBeGreaterThan(0);
      expect(result.summary.totalClimb_m).toBeGreaterThan(0);
      expect(result.summary.maxGradeUp_pct).toBeGreaterThan(0);
    });

    it('should handle edge case: no samples', () => {
      const result = generateRoadProfile([]);

      expect(result.points).toHaveLength(0);
      expect(result.gradeEvents).toHaveLength(0);
      expect(result.kFactorEvents).toHaveLength(0);
      expect(result.railCrossings).toHaveLength(0);
      expect(result.summary.totalDistance_m).toBe(0);
    });

    it('should handle edge case: flat terrain', () => {
      const samples: GnssSample[] = [
        makeSample({ timestamp: '2024-01-01T10:00:00Z', latitude: 45.0000, longitude: -75.0000, altitude: 100 }),
        makeSample({ timestamp: '2024-01-01T10:00:01Z', latitude: 45.0001, longitude: -75.0000, altitude: 100 }),
        makeSample({ timestamp: '2024-01-01T10:00:02Z', latitude: 45.0002, longitude: -75.0000, altitude: 100 }),
      ];

      const result = generateRoadProfile(samples);

      expect(result.summary.totalClimb_m).toBe(0);
      expect(result.summary.totalDescent_m).toBe(0);
      expect(result.summary.maxGradeUp_pct).toBe(0);
      expect(result.gradeEvents).toHaveLength(0);
    });
  });
});
