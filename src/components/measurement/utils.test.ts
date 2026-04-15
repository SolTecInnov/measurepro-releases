import { describe, it, expect } from 'vitest';
import { calculateOptimalColumns, isInvalidMeasurement } from './utils';

describe('measurement/utils', () => {
  describe('calculateOptimalColumns', () => {
    it('returns 1 for very narrow width', () => {
      expect(calculateOptimalColumns(50, 10)).toBe(1);
    });

    it('returns 1 for zero width', () => {
      expect(calculateOptimalColumns(0, 10)).toBe(1);
    });

    it('caps at 4 columns max', () => {
      expect(calculateOptimalColumns(1000, 100)).toBe(4);
    });

    it('does not exceed item count', () => {
      expect(calculateOptimalColumns(400, 2)).toBe(2);
    });

    it('calculates based on 80px minimum per item', () => {
      expect(calculateOptimalColumns(240, 10)).toBe(3);
    });

    it('returns 1 for 1 item regardless of width', () => {
      expect(calculateOptimalColumns(1000, 1)).toBe(1);
    });

    it('returns 1 for 0 items', () => {
      // Math.min(maxPossibleColumns, 0, 4) = 0, then Math.max(1, 0) = 1
      expect(calculateOptimalColumns(400, 0)).toBe(1);
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
      expect(isInvalidMeasurement('error DE02 occurred')).toBe(true);
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

    it('returns false for valid measurement string', () => {
      expect(isInvalidMeasurement('5.123')).toBe(false);
    });

    it('returns false for valid measurement with text', () => {
      expect(isInvalidMeasurement('5.123m')).toBe(false);
    });
  });
});
