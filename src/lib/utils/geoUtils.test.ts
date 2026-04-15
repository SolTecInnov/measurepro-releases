import { describe, it, expect } from 'vitest';
import { calculateDistance, decimalToDMS, formatCoordinate, calculateBearing } from './geoUtils';

describe('geoUtils', () => {
  describe('calculateDistance', () => {
    it('returns 0 for invalid inputs (NaN)', () => {
      expect(calculateDistance(NaN, 0, 0, 0)).toBe(0);
      expect(calculateDistance(0, NaN, 0, 0)).toBe(0);
      expect(calculateDistance(0, 0, NaN, 0)).toBe(0);
      expect(calculateDistance(0, 0, 0, NaN)).toBe(0);
    });

    it('returns 0 when any coordinate is 0 (falsy check)', () => {
      // The implementation treats 0 as falsy
      expect(calculateDistance(0, 1, 1, 1)).toBe(0);
    });

    it('returns 0 for same point', () => {
      expect(calculateDistance(45.5, -73.5, 45.5, -73.5)).toBe(0);
    });

    it('calculates distance between Montreal and Quebec City (~233 km)', () => {
      const dist = calculateDistance(45.5017, -73.5673, 46.8139, -71.2080);
      expect(dist).toBeGreaterThan(230);
      expect(dist).toBeLessThan(240);
    });

    it('calculates distance between nearby points', () => {
      // ~111 km per degree of latitude
      const dist = calculateDistance(1, 1, 2, 1);
      expect(dist).toBeCloseTo(111.195, 0);
    });

    it('calculates distance across hemispheres', () => {
      const dist = calculateDistance(-33.8688, 151.2093, 51.5074, -0.1278);
      expect(dist).toBeGreaterThan(16000);
      expect(dist).toBeLessThan(18000);
    });
  });

  describe('decimalToDMS', () => {
    it('converts 0 degrees', () => {
      const result = decimalToDMS(0);
      expect(result.degrees).toBe(0);
      expect(result.minutes).toBe(0);
      expect(result.seconds).toBe(0);
    });

    it('converts whole degrees', () => {
      const result = decimalToDMS(45);
      expect(result.degrees).toBe(45);
      expect(result.minutes).toBe(0);
      expect(result.seconds).toBe(0);
    });

    it('converts degrees with minutes', () => {
      const result = decimalToDMS(45.5);
      expect(result.degrees).toBe(45);
      expect(result.minutes).toBe(30);
      expect(result.seconds).toBeCloseTo(0, 1);
    });

    it('converts degrees with minutes and seconds', () => {
      const result = decimalToDMS(45.5017);
      expect(result.degrees).toBe(45);
      expect(result.minutes).toBe(30);
      expect(result.seconds).toBeCloseTo(6.12, 1);
    });

    it('handles negative values (uses absolute)', () => {
      const result = decimalToDMS(-73.5673);
      expect(result.degrees).toBe(73);
      expect(result.minutes).toBe(34);
      expect(result.seconds).toBeCloseTo(2.28, 0);
    });
  });

  describe('formatCoordinate', () => {
    it('returns --° for NaN', () => {
      expect(formatCoordinate(NaN, true)).toBe('--°');
    });

    it('formats positive latitude with N', () => {
      const result = formatCoordinate(45.5, true);
      expect(result).toContain('N');
      expect(result).toContain('45°');
    });

    it('formats negative latitude with S', () => {
      const result = formatCoordinate(-33.8, true);
      expect(result).toContain('S');
    });

    it('formats positive longitude with E', () => {
      const result = formatCoordinate(151.2, false);
      expect(result).toContain('E');
    });

    it('formats negative longitude with W', () => {
      const result = formatCoordinate(-73.5, false);
      expect(result).toContain('W');
    });
  });

  describe('calculateBearing', () => {
    it('returns 0 for due north', () => {
      const b = calculateBearing(45, -73, 46, -73);
      expect(b).toBeCloseTo(0, 0);
    });

    it('returns ~90 for due east', () => {
      const b = calculateBearing(0, 0, 0, 1);
      expect(b).toBeCloseTo(90, 0);
    });

    it('returns ~180 for due south', () => {
      const b = calculateBearing(46, -73, 45, -73);
      expect(b).toBeCloseTo(180, 0);
    });

    it('returns ~270 for due west', () => {
      const b = calculateBearing(0, 1, 0, 0);
      expect(b).toBeCloseTo(270, 0);
    });

    it('result is always between 0 and 360', () => {
      const b = calculateBearing(45.5, -73.5, 46.8, -71.2);
      expect(b).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThan(360);
    });
  });
});
