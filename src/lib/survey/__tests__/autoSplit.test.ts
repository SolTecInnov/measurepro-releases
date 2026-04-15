import { describe, it, expect, vi } from 'vitest';

// Mock modules that touch browser APIs / IndexedDB
vi.mock('@/lib/survey/db', () => ({
  openSurveyDB: vi.fn(),
  countMeasurementsForSurvey: vi.fn(),
}));

import { getBaseTitle, getDisplayTitle } from '../autoSplit';

describe('autoSplit', () => {
  describe('getBaseTitle', () => {
    it('returns title unchanged when no part suffix', () => {
      expect(getBaseTitle('Highway 101')).toBe('Highway 101');
    });

    it('strips " - Part N" suffix', () => {
      expect(getBaseTitle('Highway 101 - Part 3')).toBe('Highway 101');
    });

    it('strips " - Part 1" suffix', () => {
      expect(getBaseTitle('Highway 101 - Part 1')).toBe('Highway 101');
    });

    it('is case-insensitive for "Part"', () => {
      expect(getBaseTitle('Highway 101 - part 5')).toBe('Highway 101');
    });

    it('handles large part numbers', () => {
      expect(getBaseTitle('Survey - Part 100')).toBe('Survey');
    });

    it('trims whitespace', () => {
      expect(getBaseTitle('  Highway 101  ')).toBe('Highway 101');
    });

    it('does not strip non-matching suffixes', () => {
      expect(getBaseTitle('Highway 101 - Section 3')).toBe('Highway 101 - Section 3');
    });

    it('handles title with dashes in the name', () => {
      expect(getBaseTitle('Route A-1 North - Part 2')).toBe('Route A-1 North');
    });
  });

  describe('getDisplayTitle', () => {
    it('returns base title for part 1 (no suffix)', () => {
      expect(getDisplayTitle('Highway 101', 1)).toBe('Highway 101');
    });

    it('returns base title for part 0 or negative (treated as <= 1)', () => {
      expect(getDisplayTitle('Highway 101', 0)).toBe('Highway 101');
      expect(getDisplayTitle('Highway 101', -1)).toBe('Highway 101');
    });

    it('adds " - Part N" for part 2+', () => {
      expect(getDisplayTitle('Highway 101', 2)).toBe('Highway 101 - Part 2');
    });

    it('adds " - Part N" for large part numbers', () => {
      expect(getDisplayTitle('Survey', 42)).toBe('Survey - Part 42');
    });

    it('round-trips with getBaseTitle', () => {
      const base = 'Highway 101';
      for (let i = 2; i <= 5; i++) {
        const display = getDisplayTitle(base, i);
        expect(getBaseTitle(display)).toBe(base);
      }
    });
  });
});
