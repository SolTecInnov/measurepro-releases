import { describe, it, expect } from 'vitest';
import {
  metersToFeetInches,
  feetInchesToMeters,
  formatMeasurement,
  formatMeasurementDual,
  parseInputToMeters,
} from './unitConversion';

describe('unitConversion', () => {
  describe('metersToFeetInches', () => {
    it('converts 0 meters', () => {
      const result = metersToFeetInches(0);
      expect(result.feet).toBe(0);
      expect(result.inches).toBe(0);
      expect(result.totalInches).toBe(0);
    });

    it('converts 1 meter to ~3ft 3.37in', () => {
      const result = metersToFeetInches(1);
      expect(result.feet).toBe(3);
      expect(result.inches).toBeCloseTo(3.3701, 2);
      expect(result.totalInches).toBeCloseTo(39.3701, 2);
    });

    it('converts 0.3048 meters to ~1 foot', () => {
      const result = metersToFeetInches(0.3048);
      expect(result.feet).toBe(1);
      expect(result.inches).toBeCloseTo(0, 1);
    });

    it('converts 10 meters', () => {
      const result = metersToFeetInches(10);
      expect(result.feet).toBe(32);
      expect(result.totalInches).toBeCloseTo(393.701, 1);
    });
  });

  describe('feetInchesToMeters', () => {
    it('converts 0 feet 0 inches to 0', () => {
      expect(feetInchesToMeters(0, 0)).toBe(0);
    });

    it('converts 1 foot to ~0.3048m', () => {
      expect(feetInchesToMeters(1, 0)).toBeCloseTo(0.3048, 3);
    });

    it('converts 12 inches (1 foot)', () => {
      expect(feetInchesToMeters(0, 12)).toBeCloseTo(0.3048, 3);
    });

    it('round-trips with metersToFeetInches', () => {
      const meters = 5.5;
      const { feet, inches } = metersToFeetInches(meters);
      const result = feetInchesToMeters(feet, inches);
      expect(result).toBeCloseTo(meters, 3);
    });
  });

  describe('formatMeasurement', () => {
    it('formats metric with unit', () => {
      expect(formatMeasurement(5.5, 'metric')).toBe('5.50m');
    });

    it('formats metric without unit', () => {
      expect(formatMeasurement(5.5, 'metric', { showUnit: false })).toBe('5.50');
    });

    it('formats metric with custom decimals', () => {
      expect(formatMeasurement(5.123, 'metric', { decimals: 1 })).toBe('5.1m');
    });

    it('formats imperial full format', () => {
      const result = formatMeasurement(1, 'imperial');
      expect(result).toContain('ft');
      expect(result).toContain('in');
    });

    it('formats imperial short format', () => {
      const result = formatMeasurement(1, 'imperial', { shortFormat: true });
      expect(result).toContain("'");
      expect(result).toContain('"');
    });

    it('handles NaN input', () => {
      expect(formatMeasurement(NaN, 'metric')).toBe('--m');
      expect(formatMeasurement(NaN, 'imperial')).toBe('--ft');
    });

    it('handles string inputs', () => {
      expect(formatMeasurement('--', 'metric')).toBe('--m');
      expect(formatMeasurement('infinity', 'imperial')).toBe('--ft');
      expect(formatMeasurement('NaN', 'metric')).toBe('--m');
      expect(formatMeasurement('', 'metric')).toBe('--m');
    });

    it('handles string NaN without unit', () => {
      expect(formatMeasurement('--', 'metric', { showUnit: false })).toBe('--');
    });

    it('parses valid string numbers', () => {
      expect(formatMeasurement('5.5', 'metric')).toBe('5.50m');
    });
  });

  describe('formatMeasurementDual', () => {
    it('returns metric primary and imperial secondary', () => {
      const result = formatMeasurementDual(1, 'metric');
      expect(result.primary).toBe('1.00m');
      expect(result.secondary).toContain('ft');
    });

    it('returns imperial primary and metric secondary', () => {
      const result = formatMeasurementDual(1, 'imperial');
      expect(result.primary).toContain('ft');
      expect(result.secondary).toBe('1.00m');
    });

    it('handles NaN', () => {
      const result = formatMeasurementDual(NaN, 'metric');
      expect(result.primary).toBe('--m');
      expect(result.secondary).toBe('--ft');
    });

    it('handles string NaN', () => {
      const result = formatMeasurementDual('--', 'imperial');
      expect(result.primary).toBe('--ft');
      expect(result.secondary).toBe('--m');
    });
  });

  describe('parseInputToMeters', () => {
    it('parses metric value', () => {
      expect(parseInputToMeters('5.5')).toBe(5.5);
    });

    it('parses metric value with m suffix', () => {
      expect(parseInputToMeters('5.5m')).toBe(5.5);
    });

    it('parses imperial feet-inches with quotes', () => {
      const result = parseInputToMeters("12'6\"");
      expect(result).toBeCloseTo(feetInchesToMeters(12, 6), 3);
    });

    it('parses imperial ft/in format', () => {
      const result = parseInputToMeters('12ft 6in');
      expect(result).toBeCloseTo(feetInchesToMeters(12, 6), 3);
    });

    it('parses space-separated imperial', () => {
      const result = parseInputToMeters('12 6');
      expect(result).toBeCloseTo(feetInchesToMeters(12, 6), 3);
    });

    it('parses feet-only with ft suffix', () => {
      const result = parseInputToMeters('12ft');
      expect(result).toBeCloseTo(feetInchesToMeters(12, 0), 3);
    });

    it('parses feet-only with single-quote', () => {
      const result = parseInputToMeters("12'");
      expect(result).toBeCloseTo(feetInchesToMeters(12, 0), 3);
    });

    it('assumes imperial when specified', () => {
      const result = parseInputToMeters('12', 'imperial');
      expect(result).toBeCloseTo(feetInchesToMeters(12, 0), 3);
    });

    it('returns 0 for unparseable input', () => {
      expect(parseInputToMeters('abc')).toBe(0);
    });
  });
});
