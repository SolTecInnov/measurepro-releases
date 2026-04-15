import { describe, it, expect } from 'vitest';

import { computeProfileFromSamples, computeTotalDistance } from '../profileComputation';

describe('profileComputation (stub)', () => {
  describe('computeProfileFromSamples', () => {
    it('returns null for empty samples', () => {
      expect(computeProfileFromSamples([])).toBeNull();
    });

    it('returns null for any samples (stub always returns null)', () => {
      const samples = [
        { latitude: 45.5, longitude: -73.5, altitude: 100, timestamp: 1000 },
        { latitude: 45.6, longitude: -73.4, altitude: 110, timestamp: 2000 },
      ];
      expect(computeProfileFromSamples(samples)).toBeNull();
    });
  });

  describe('computeTotalDistance', () => {
    it('returns 0 for empty samples', () => {
      expect(computeTotalDistance([])).toBe(0);
    });

    it('returns 0 for any samples (stub always returns 0)', () => {
      const samples = [
        { latitude: 45.5, longitude: -73.5 },
        { latitude: 45.6, longitude: -73.4 },
      ];
      expect(computeTotalDistance(samples)).toBe(0);
    });
  });
});
