import { describe, it, expect } from 'vitest';
import {
  convertToMeters,
  formatMeasurement,
  isValidMeasurement,
  isInvalidMeasurement,
  SKY_READING_THRESHOLD_M,
  createObjectDetectionLog,
} from './laserUtils';

describe('laserUtils', () => {
  describe('convertToMeters', () => {
    it('converts numeric value directly', () => {
      expect(convertToMeters(5.5, 'disto')).toBe(5.5);
    });

    it('converts string value to number', () => {
      expect(convertToMeters('5.5', 'disto')).toBe(5.5);
    });

    it('returns 0 for NaN', () => {
      expect(convertToMeters(NaN, 'disto')).toBe(0);
    });

    it('returns 0 for "--"', () => {
      expect(convertToMeters('--', 'disto')).toBe(0);
    });

    it('returns 0 for "infinity"', () => {
      expect(convertToMeters('infinity', 'disto')).toBe(0);
    });

    it('returns 0 for DE02 error code', () => {
      expect(convertToMeters('DE02', 'disto')).toBe(0);
    });

    it('returns 0 for strings containing DE02', () => {
      expect(convertToMeters('error DE02', 'disto')).toBe(0);
    });

    it('returns 0 for out-of-range values (> 180)', () => {
      expect(convertToMeters('200', 'disto')).toBe(0);
    });

    it('returns 0 for out-of-range values (< -180)', () => {
      expect(convertToMeters('-200', 'disto')).toBe(0);
    });

    it('handles zero value', () => {
      expect(convertToMeters(0, 'disto')).toBe(0);
    });
  });

  describe('formatMeasurement', () => {
    it('formats meters value', () => {
      expect(formatMeasurement(5.123, 'm')).toBe('5.123m');
    });

    it('formats feet value', () => {
      expect(formatMeasurement(1, 'ft')).toBe('3.281ft');
    });

    it('formats with custom decimal places', () => {
      expect(formatMeasurement(5.123, 'm', 1)).toBe('5.1m');
    });

    it('returns --m for zero value', () => {
      expect(formatMeasurement(0, 'm')).toBe('--m');
    });

    it('returns --ft for NaN', () => {
      expect(formatMeasurement(NaN, 'ft')).toBe('--ft');
    });
  });

  describe('isValidMeasurement', () => {
    it('returns true for value within default range', () => {
      expect(isValidMeasurement(5)).toBe(true);
    });

    it('returns true for value at min boundary', () => {
      expect(isValidMeasurement(0)).toBe(true);
    });

    it('returns true for value at max boundary', () => {
      expect(isValidMeasurement(30)).toBe(true);
    });

    it('returns false for value above max', () => {
      expect(isValidMeasurement(31)).toBe(false);
    });

    it('returns false for negative value', () => {
      expect(isValidMeasurement(-1)).toBe(false);
    });

    it('returns false for NaN', () => {
      expect(isValidMeasurement(NaN)).toBe(false);
    });

    it('respects custom range', () => {
      expect(isValidMeasurement(5, 2, 10)).toBe(true);
      expect(isValidMeasurement(1, 2, 10)).toBe(false);
    });
  });

  describe('isInvalidMeasurement', () => {
    it('returns true for null', () => {
      expect(isInvalidMeasurement(null)).toBe(true);
    });

    it('returns true for empty string', () => {
      expect(isInvalidMeasurement('')).toBe(true);
    });

    it('returns true for "infinity"', () => {
      expect(isInvalidMeasurement('infinity')).toBe(true);
    });

    it('returns true for "DE02"', () => {
      expect(isInvalidMeasurement('DE02')).toBe(true);
    });

    it('returns true for strings containing DE02', () => {
      expect(isInvalidMeasurement('error DE02')).toBe(true);
    });

    it('returns true for "--"', () => {
      expect(isInvalidMeasurement('--')).toBe(true);
    });

    it('returns true for "NaN"', () => {
      expect(isInvalidMeasurement('NaN')).toBe(true);
    });

    it('returns true for "undefined"', () => {
      expect(isInvalidMeasurement('undefined')).toBe(true);
    });

    it('returns true for "null"', () => {
      expect(isInvalidMeasurement('null')).toBe(true);
    });

    it('returns true for values at or below sky threshold', () => {
      expect(isInvalidMeasurement('0.05')).toBe(true);
      expect(isInvalidMeasurement('0.1')).toBe(true);
    });

    it('returns false for valid measurement above threshold', () => {
      expect(isInvalidMeasurement('5.0')).toBe(false);
    });

    it('SKY_READING_THRESHOLD_M is 0.1', () => {
      expect(SKY_READING_THRESHOLD_M).toBe(0.1);
    });

    it('respects custom sky threshold', () => {
      expect(isInvalidMeasurement('0.3', 0.5)).toBe(true);
      expect(isInvalidMeasurement('0.6', 0.5)).toBe(false);
    });
  });

  describe('createObjectDetectionLog', () => {
    it('creates a detection log with statistics', () => {
      const start = new Date('2025-01-01T00:00:00Z');
      const end = new Date('2025-01-01T00:00:05Z');
      const gps = { latitude: 45.5, longitude: -73.5, altitude: 100, speed: 10, course: 90 };

      const log = createObjectDetectionLog(3.0, ['3.0', '3.5', '4.0', '--', 'DE02'], start, end, gps);

      expect(log.minHeight).toBe(3.0);
      expect(log.measurementCount).toBe(3);
      expect(log.totalSamples).toBe(5);
      expect(log.avgHeight).toBeCloseTo(3.5, 1);
      expect(log.maxHeight).toBe(4.0);
      expect(log.duration).toBe(5);
      expect(log.location.latitude).toBe(45.5);
      expect(log.location.longitude).toBe(-73.5);
    });

    it('handles all invalid measurements', () => {
      const start = new Date('2025-01-01T00:00:00Z');
      const end = new Date('2025-01-01T00:00:01Z');
      const gps = { latitude: 0, longitude: 0, altitude: 0, speed: 0, course: 0 };

      const log = createObjectDetectionLog(0, ['--', 'DE02'], start, end, gps);
      expect(log.avgHeight).toBe(0);
      expect(log.maxHeight).toBe(0);
      expect(log.measurementCount).toBe(0);
    });
  });
});
