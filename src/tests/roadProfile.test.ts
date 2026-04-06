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

describe('Road Profile Engine', () => {
  describe('haversineDistance', () => {
    it('should calculate distance between two known points accurately', () => {
      // Distance from San Francisco to Los Angeles
      // SF: 37.7749° N, 122.4194° W
      // LA: 34.0522° N, 118.2437° W
      const distance = haversineDistance(37.7749, -122.4194, 34.0522, -118.2437);
      
      // Expected distance is approximately 559 km = 559000 m
      expect(distance).toBeGreaterThan(550000);
      expect(distance).toBeLessThan(570000);
    });

    it('should return 0 for identical coordinates', () => {
      const distance = haversineDistance(45.0, -75.0, 45.0, -75.0);
      expect(distance).toBe(0);
    });

    it('should calculate short distances accurately', () => {
      // 1 degree latitude ≈ 111 km
      const distance = haversineDistance(45.0, -75.0, 46.0, -75.0);
      expect(distance).toBeGreaterThan(110000);
      expect(distance).toBeLessThan(112000);
    });

    it('should handle antipodal points', () => {
      // Points on opposite sides of Earth
      const distance = haversineDistance(0, 0, 0, 180);
      // Should be approximately half Earth's circumference
      const halfCircumference = Math.PI * 6371000;
      expect(distance).toBeCloseTo(halfCircumference, -3); // within 1000m
    });
  });

  describe('calculateGrade', () => {
    it('should calculate positive grade for uphill', () => {
      const grade = calculateGrade(100, 112, 100);
      // 12m rise over 100m = 12% grade
      expect(grade).toBe(12);
    });

    it('should calculate negative grade for downhill', () => {
      const grade = calculateGrade(100, 88, 100);
      // 12m drop over 100m = -12% grade
      expect(grade).toBe(-12);
    });

    it('should return 0 for flat terrain', () => {
      const grade = calculateGrade(100, 100, 100);
      expect(grade).toBe(0);
    });

    it('should handle steep grades correctly', () => {
      const grade = calculateGrade(0, 45, 100);
      // 45° angle = 100% grade
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
        {
          timestamp: '2024-01-01T10:00:00Z',
          lat: 45.0,
          lon: -75.0,
          alt_m: 100,
          speed_mps: 0,
          heading_deg: 0,
          quality: 'rtk_fixed',
          hdop: 1.0,
          num_sats: 12,
          source: 'duro',
        },
      ];

      const result = resampleProfile(samples, 5);
      expect(result).toHaveLength(1);
      expect(result[0].distance_m).toBe(0);
      expect(result[0].lat).toBe(45.0);
      expect(result[0].lon).toBe(-75.0);
      expect(result[0].alt_m).toBe(100);
    });

    it('should resample at uniform intervals', () => {
      const samples: GnssSample[] = [
        {
          timestamp: '2024-01-01T10:00:00Z',
          lat: 45.0000,
          lon: -75.0000,
          alt_m: 100,
          speed_mps: 10,
          heading_deg: 0,
          quality: 'rtk_fixed',
          hdop: 1.0,
          num_sats: 12,
          source: 'duro',
        },
        {
          timestamp: '2024-01-01T10:00:01Z',
          lat: 45.0001,
          lon: -75.0000,
          alt_m: 100,
          speed_mps: 10,
          heading_deg: 0,
          quality: 'rtk_fixed',
          hdop: 1.0,
          num_sats: 12,
          source: 'duro',
        },
        {
          timestamp: '2024-01-01T10:00:02Z',
          lat: 45.0002,
          lon: -75.0000,
          alt_m: 100,
          speed_mps: 10,
          heading_deg: 0,
          quality: 'rtk_fixed',
          hdop: 1.0,
          num_sats: 12,
          source: 'duro',
        },
      ];

      const stepMeters = 5;
      const result = resampleProfile(samples, stepMeters);

      // Check that resampled points are at uniform intervals
      for (let i = 1; i < result.length - 1; i++) {
        const interval = result[i].distance_m - result[i - 1].distance_m;
        expect(interval).toBeCloseTo(stepMeters, 0);
      }
    });

    it('should interpolate lat/lon/alt correctly', () => {
      const samples: GnssSample[] = [
        {
          timestamp: '2024-01-01T10:00:00Z',
          lat: 45.0000,
          lon: -75.0000,
          alt_m: 100,
          speed_mps: 10,
          heading_deg: 0,
          quality: 'rtk_fixed',
          hdop: 1.0,
          num_sats: 12,
          source: 'duro',
        },
        {
          timestamp: '2024-01-01T10:00:10Z',
          lat: 45.0010,
          lon: -75.0010,
          alt_m: 110,
          speed_mps: 10,
          heading_deg: 0,
          quality: 'rtk_fixed',
          hdop: 1.0,
          num_sats: 12,
          source: 'duro',
        },
      ];

      const result = resampleProfile(samples, 5);

      // Check that interpolated values are between start and end
      for (const point of result) {
        expect(point.lat).toBeGreaterThanOrEqual(45.0000);
        expect(point.lat).toBeLessThanOrEqual(45.0010);
        expect(point.lon).toBeGreaterThanOrEqual(-75.0010);
        expect(point.lon).toBeLessThanOrEqual(-75.0000);
        expect(point.alt_m).toBeGreaterThanOrEqual(100);
        expect(point.alt_m).toBeLessThanOrEqual(110);
      }
    });
  });

  describe('calculateKFactor', () => {
    it('should detect convex curve (crest)', () => {
      // Create a crest: point B is higher than the line A-C
      const pointA = { distance_m: 0, alt_m: 100 };
      const pointB = { distance_m: 50, alt_m: 105 }; // Peak
      const pointC = { distance_m: 100, alt_m: 100 };

      const kFactor = calculateKFactor(pointA, pointB, pointC);

      // Should be positive for convex curve
      expect(kFactor).toBeGreaterThan(0);
    });

    it('should detect concave curve (sag)', () => {
      // Create a sag: point B is lower than the line A-C
      const pointA = { distance_m: 0, alt_m: 100 };
      const pointB = { distance_m: 50, alt_m: 95 }; // Valley
      const pointC = { distance_m: 100, alt_m: 100 };

      const kFactor = calculateKFactor(pointA, pointB, pointC);

      // Should be negative for concave curve
      expect(kFactor).toBeLessThan(0);
    });

    it('should return Infinity for perfectly straight line', () => {
      const pointA = { distance_m: 0, alt_m: 100 };
      const pointB = { distance_m: 50, alt_m: 100 };
      const pointC = { distance_m: 100, alt_m: 100 };

      const kFactor = calculateKFactor(pointA, pointB, pointC);

      expect(kFactor).toBe(Infinity);
    });

    it('should calculate sharp crest (small K-factor)', () => {
      // Sharp crest with significant vertical offset
      const pointA = { distance_m: 0, alt_m: 100 };
      const pointB = { distance_m: 25, alt_m: 110 }; // Very sharp peak
      const pointC = { distance_m: 50, alt_m: 100 };

      const kFactor = calculateKFactor(pointA, pointB, pointC);

      // Sharp curve should have small K-factor
      expect(kFactor).toBeLessThan(10000);
    });

    it('should calculate gentle curve (large K-factor)', () => {
      // Gentle crest with small vertical offset
      const pointA = { distance_m: 0, alt_m: 100 };
      const pointB = { distance_m: 500, alt_m: 100.5 }; // Very gentle peak
      const pointC = { distance_m: 1000, alt_m: 100 };

      const kFactor = calculateKFactor(pointA, pointB, pointC);

      // Gentle curve should have large K-factor
      expect(kFactor).toBeGreaterThan(50000);
    });
  });

  describe('calculateProfile', () => {
    it('should calculate grades for all points', () => {
      const samples: GnssSample[] = [
        {
          timestamp: '2024-01-01T10:00:00Z',
          lat: 45.0000,
          lon: -75.0000,
          alt_m: 100,
          speed_mps: 10,
          heading_deg: 0,
          quality: 'rtk_fixed',
          hdop: 1.0,
          num_sats: 12,
          source: 'duro',
        },
        {
          timestamp: '2024-01-01T10:00:01Z',
          lat: 45.0001,
          lon: -75.0000,
          alt_m: 110, // 10m rise
          speed_mps: 10,
          heading_deg: 0,
          quality: 'rtk_fixed',
          hdop: 1.0,
          num_sats: 12,
          source: 'duro',
        },
        {
          timestamp: '2024-01-01T10:00:02Z',
          lat: 45.0002,
          lon: -75.0000,
          alt_m: 115, // 5m rise
          speed_mps: 10,
          heading_deg: 0,
          quality: 'rtk_fixed',
          hdop: 1.0,
          num_sats: 12,
          source: 'duro',
        },
      ];

      const profile = calculateProfile(samples, 5);

      // All points should have grade_pct calculated
      for (const point of profile) {
        expect(point.grade_pct).toBeDefined();
        expect(typeof point.grade_pct).toBe('number');
      }
    });

    it('should calculate K-factors for interior points', () => {
      const samples: GnssSample[] = [
        {
          timestamp: '2024-01-01T10:00:00Z',
          lat: 45.0000,
          lon: -75.0000,
          alt_m: 100,
          speed_mps: 10,
          heading_deg: 0,
          quality: 'rtk_fixed',
          hdop: 1.0,
          num_sats: 12,
          source: 'duro',
        },
        {
          timestamp: '2024-01-01T10:00:01Z',
          lat: 45.0001,
          lon: -75.0000,
          alt_m: 105,
          speed_mps: 10,
          heading_deg: 0,
          quality: 'rtk_fixed',
          hdop: 1.0,
          num_sats: 12,
          source: 'duro',
        },
        {
          timestamp: '2024-01-01T10:00:02Z',
          lat: 45.0002,
          lon: -75.0000,
          alt_m: 100,
          speed_mps: 10,
          heading_deg: 0,
          quality: 'rtk_fixed',
          hdop: 1.0,
          num_sats: 12,
          source: 'duro',
        },
      ];

      const profile = calculateProfile(samples, 5);

      // Interior points should have K-factors
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
        {
          distance_m: 0,
          lat: 45.0,
          lon: -75.0,
          alt_m: 100,
          timestamp: '2024-01-01T10:00:00Z',
          grade_pct: 5,
          k_factor: null,
          curvature_type: null,
        },
        {
          distance_m: 5,
          lat: 45.0001,
          lon: -75.0,
          alt_m: 101,
          timestamp: '2024-01-01T10:00:01Z',
          grade_pct: 15, // Steep uphill
          k_factor: null,
          curvature_type: null,
        },
        {
          distance_m: 10,
          lat: 45.0002,
          lon: -75.0,
          alt_m: 102,
          timestamp: '2024-01-01T10:00:02Z',
          grade_pct: 14, // Still steep
          k_factor: null,
          curvature_type: null,
        },
        {
          distance_m: 15,
          lat: 45.0003,
          lon: -75.0,
          alt_m: 103,
          timestamp: '2024-01-01T10:00:03Z',
          grade_pct: 5, // Back to normal
          k_factor: null,
          curvature_type: null,
        },
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
        {
          distance_m: 0,
          lat: 45.0,
          lon: -75.0,
          alt_m: 100,
          timestamp: '2024-01-01T10:00:00Z',
          grade_pct: 0,
          k_factor: null,
          curvature_type: null,
        },
        {
          distance_m: 5,
          lat: 45.0001,
          lon: -75.0,
          alt_m: 95,
          timestamp: '2024-01-01T10:00:01Z',
          grade_pct: -15, // Steep downhill
          k_factor: null,
          curvature_type: null,
        },
        {
          distance_m: 10,
          lat: 45.0002,
          lon: -75.0,
          alt_m: 96,
          timestamp: '2024-01-01T10:00:02Z',
          grade_pct: 0,
          k_factor: null,
          curvature_type: null,
        },
      ];

      const events = detectGradeEvents(profilePoints, 12);

      expect(events).toHaveLength(1);
      expect(events[0].direction).toBe('down');
      expect(events[0].max_grade_pct).toBeGreaterThanOrEqual(15);
    });

    it('should group consecutive steep segments', () => {
      const profilePoints: ProfilePoint[] = [
        { distance_m: 0, lat: 45.0, lon: -75.0, alt_m: 100, timestamp: '2024-01-01T10:00:00Z', grade_pct: 5, k_factor: null, curvature_type: null },
        { distance_m: 5, lat: 45.0001, lon: -75.0, alt_m: 101, timestamp: '2024-01-01T10:00:01Z', grade_pct: 13, k_factor: null, curvature_type: null },
        { distance_m: 10, lat: 45.0002, lon: -75.0, alt_m: 102, timestamp: '2024-01-01T10:00:02Z', grade_pct: 14, k_factor: null, curvature_type: null },
        { distance_m: 15, lat: 45.0003, lon: -75.0, alt_m: 103, timestamp: '2024-01-01T10:00:03Z', grade_pct: 12.5, k_factor: null, curvature_type: null },
        { distance_m: 20, lat: 45.0004, lon: -75.0, alt_m: 104, timestamp: '2024-01-01T10:00:04Z', grade_pct: 5, k_factor: null, curvature_type: null },
      ];

      const events = detectGradeEvents(profilePoints, 12);

      expect(events).toHaveLength(1);
      expect(events[0].length_m).toBe(10); // 15 - 5 = 10m
    });

    it('should not detect events below threshold', () => {
      const profilePoints: ProfilePoint[] = [
        { distance_m: 0, lat: 45.0, lon: -75.0, alt_m: 100, timestamp: '2024-01-01T10:00:00Z', grade_pct: 5, k_factor: null, curvature_type: null },
        { distance_m: 5, lat: 45.0001, lon: -75.0, alt_m: 101, timestamp: '2024-01-01T10:00:01Z', grade_pct: 8, k_factor: null, curvature_type: null },
        { distance_m: 10, lat: 45.0002, lon: -75.0, alt_m: 102, timestamp: '2024-01-01T10:00:02Z', grade_pct: 6, k_factor: null, curvature_type: null },
      ];

      const events = detectGradeEvents(profilePoints, 12);

      expect(events).toHaveLength(0);
    });
  });

  describe('detectKFactorEvents', () => {
    it('should detect sharp crest (convex) event', () => {
      const profilePoints: ProfilePoint[] = [
        {
          distance_m: 0,
          lat: 45.0,
          lon: -75.0,
          alt_m: 100,
          timestamp: '2024-01-01T10:00:00Z',
          grade_pct: 5,
          k_factor: null,
          curvature_type: null,
        },
        {
          distance_m: 5,
          lat: 45.0001,
          lon: -75.0,
          alt_m: 105,
          timestamp: '2024-01-01T10:00:01Z',
          grade_pct: 10,
          k_factor: 3000, // Sharp crest (below 10,000 threshold)
          curvature_type: 'convex',
        },
        {
          distance_m: 10,
          lat: 45.0002,
          lon: -75.0,
          alt_m: 106,
          timestamp: '2024-01-01T10:00:02Z',
          grade_pct: 5,
          k_factor: null,
          curvature_type: null,
        },
      ];

      const events = detectKFactorEvents(profilePoints, 10000, -8000);

      expect(events).toHaveLength(1);
      expect(events[0].curvature_type).toBe('convex');
      expect(events[0].k_factor).toBe(3000);
      expect(events[0].severity).toBe('critical'); // < 5000 = critical
    });

    it('should detect sharp sag (concave) event', () => {
      const profilePoints: ProfilePoint[] = [
        {
          distance_m: 0,
          lat: 45.0,
          lon: -75.0,
          alt_m: 100,
          timestamp: '2024-01-01T10:00:00Z',
          grade_pct: -5,
          k_factor: null,
          curvature_type: null,
        },
        {
          distance_m: 5,
          lat: 45.0001,
          lon: -75.0,
          alt_m: 95,
          timestamp: '2024-01-01T10:00:01Z',
          grade_pct: -10,
          k_factor: -3000, // Sharp sag (above -8000 threshold)
          curvature_type: 'concave',
        },
        {
          distance_m: 10,
          lat: 45.0002,
          lon: -75.0,
          alt_m: 94,
          timestamp: '2024-01-01T10:00:02Z',
          grade_pct: -5,
          k_factor: null,
          curvature_type: null,
        },
      ];

      const events = detectKFactorEvents(profilePoints, 10000, -8000);

      expect(events).toHaveLength(1);
      expect(events[0].curvature_type).toBe('concave');
      expect(events[0].k_factor).toBe(-3000);
      expect(events[0].severity).toBe('critical'); // > -4000 = critical
    });

    it('should not detect gentle curves', () => {
      const profilePoints: ProfilePoint[] = [
        {
          distance_m: 0,
          lat: 45.0,
          lon: -75.0,
          alt_m: 100,
          timestamp: '2024-01-01T10:00:00Z',
          grade_pct: 5,
          k_factor: null,
          curvature_type: null,
        },
        {
          distance_m: 5,
          lat: 45.0001,
          lon: -75.0,
          alt_m: 105,
          timestamp: '2024-01-01T10:00:01Z',
          grade_pct: 10,
          k_factor: 50000, // Gentle crest (above threshold)
          curvature_type: 'convex',
        },
        {
          distance_m: 10,
          lat: 45.0002,
          lon: -75.0,
          alt_m: 106,
          timestamp: '2024-01-01T10:00:02Z',
          grade_pct: 5,
          k_factor: null,
          curvature_type: null,
        },
      ];

      const events = detectKFactorEvents(profilePoints, 10000, -8000);

      expect(events).toHaveLength(0);
    });
  });

  describe('detectRailCrossings', () => {
    it('should detect elevation spike', () => {
      const profilePoints: ProfilePoint[] = [
        { distance_m: 0, lat: 45.0, lon: -75.0, alt_m: 100, timestamp: '2024-01-01T10:00:00Z', grade_pct: 0, k_factor: null, curvature_type: null },
        { distance_m: 5, lat: 45.0001, lon: -75.0, alt_m: 100, timestamp: '2024-01-01T10:00:01Z', grade_pct: 0, k_factor: null, curvature_type: null },
        { distance_m: 10, lat: 45.0002, lon: -75.0, alt_m: 100, timestamp: '2024-01-01T10:00:02Z', grade_pct: 0, k_factor: null, curvature_type: null },
        { distance_m: 15, lat: 45.0003, lon: -75.0, alt_m: 100.2, timestamp: '2024-01-01T10:00:03Z', grade_pct: 0, k_factor: null, curvature_type: null }, // Spike
        { distance_m: 20, lat: 45.0004, lon: -75.0, alt_m: 100, timestamp: '2024-01-01T10:00:04Z', grade_pct: 0, k_factor: null, curvature_type: null },
        { distance_m: 25, lat: 45.0005, lon: -75.0, alt_m: 100, timestamp: '2024-01-01T10:00:05Z', grade_pct: 0, k_factor: null, curvature_type: null },
        { distance_m: 30, lat: 45.0006, lon: -75.0, alt_m: 100, timestamp: '2024-01-01T10:00:06Z', grade_pct: 0, k_factor: null, curvature_type: null },
      ];

      const events = detectRailCrossings(profilePoints, 0.15, 5);

      expect(events).toHaveLength(1);
      expect(events[0].detection_method).toBe('auto');
      expect(events[0].distance_m).toBe(15);
      expect(events[0].elevation_change_m).toBeCloseTo(0.2, 1);
    });

    it('should not detect small variations', () => {
      const profilePoints: ProfilePoint[] = [
        { distance_m: 0, lat: 45.0, lon: -75.0, alt_m: 100, timestamp: '2024-01-01T10:00:00Z', grade_pct: 0, k_factor: null, curvature_type: null },
        { distance_m: 5, lat: 45.0001, lon: -75.0, alt_m: 100.05, timestamp: '2024-01-01T10:00:01Z', grade_pct: 0, k_factor: null, curvature_type: null },
        { distance_m: 10, lat: 45.0002, lon: -75.0, alt_m: 100.03, timestamp: '2024-01-01T10:00:02Z', grade_pct: 0, k_factor: null, curvature_type: null },
        { distance_m: 15, lat: 45.0003, lon: -75.0, alt_m: 100.04, timestamp: '2024-01-01T10:00:03Z', grade_pct: 0, k_factor: null, curvature_type: null },
        { distance_m: 20, lat: 45.0004, lon: -75.0, alt_m: 100.06, timestamp: '2024-01-01T10:00:04Z', grade_pct: 0, k_factor: null, curvature_type: null },
      ];

      const events = detectRailCrossings(profilePoints, 0.15, 5);

      expect(events).toHaveLength(0);
    });
  });

  describe('generateRoadProfile', () => {
    it('should generate complete profile with all events', () => {
      const samples: GnssSample[] = [
        {
          timestamp: '2024-01-01T10:00:00Z',
          lat: 45.0000,
          lon: -75.0000,
          alt_m: 100,
          speed_mps: 10,
          heading_deg: 0,
          quality: 'rtk_fixed',
          hdop: 1.0,
          num_sats: 12,
          source: 'duro',
        },
        {
          timestamp: '2024-01-01T10:00:01Z',
          lat: 45.0001,
          lon: -75.0000,
          alt_m: 110, // Steep climb
          speed_mps: 10,
          heading_deg: 0,
          quality: 'rtk_fixed',
          hdop: 1.0,
          num_sats: 12,
          source: 'duro',
        },
        {
          timestamp: '2024-01-01T10:00:02Z',
          lat: 45.0002,
          lon: -75.0000,
          alt_m: 115, // Continue climb
          speed_mps: 10,
          heading_deg: 0,
          quality: 'rtk_fixed',
          hdop: 1.0,
          num_sats: 12,
          source: 'duro',
        },
        {
          timestamp: '2024-01-01T10:00:03Z',
          lat: 45.0003,
          lon: -75.0000,
          alt_m: 116,
          speed_mps: 10,
          heading_deg: 0,
          quality: 'rtk_fixed',
          hdop: 1.0,
          num_sats: 12,
          source: 'duro',
        },
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
        {
          timestamp: '2024-01-01T10:00:00Z',
          lat: 45.0000,
          lon: -75.0000,
          alt_m: 100,
          speed_mps: 10,
          heading_deg: 0,
          quality: 'rtk_fixed',
          hdop: 1.0,
          num_sats: 12,
          source: 'duro',
        },
        {
          timestamp: '2024-01-01T10:00:01Z',
          lat: 45.0001,
          lon: -75.0000,
          alt_m: 100,
          speed_mps: 10,
          heading_deg: 0,
          quality: 'rtk_fixed',
          hdop: 1.0,
          num_sats: 12,
          source: 'duro',
        },
        {
          timestamp: '2024-01-01T10:00:02Z',
          lat: 45.0002,
          lon: -75.0000,
          alt_m: 100,
          speed_mps: 10,
          heading_deg: 0,
          quality: 'rtk_fixed',
          hdop: 1.0,
          num_sats: 12,
          source: 'duro',
        },
      ];

      const result = generateRoadProfile(samples);

      expect(result.summary.totalClimb_m).toBe(0);
      expect(result.summary.totalDescent_m).toBe(0);
      expect(result.summary.maxGradeUp_pct).toBe(0);
      expect(result.gradeEvents).toHaveLength(0);
    });
  });
});
