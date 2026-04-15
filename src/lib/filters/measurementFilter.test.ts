import { describe, it, expect, beforeEach } from 'vitest';
import { MeasurementFilter } from './measurementFilter';
import type { FilterSensitivity } from './measurementFilter';

describe('MeasurementFilter', () => {
  let filter: MeasurementFilter;

  beforeEach(() => {
    filter = new MeasurementFilter('medium');
  });

  describe('constructor and sensitivity', () => {
    it('defaults to medium sensitivity', () => {
      expect(filter.getSensitivity()).toBe('medium');
    });

    it('accepts custom sensitivity', () => {
      const f = new MeasurementFilter('high');
      expect(f.getSensitivity()).toBe('high');
    });
  });

  describe('setSensitivity', () => {
    it('changes sensitivity and resets state', () => {
      filter.filter('5.0');
      filter.setSensitivity('low');
      expect(filter.getSensitivity()).toBe('low');
      expect(filter.getLastAcceptedValue()).toBeNull();
      expect(filter.getRecentMeasurements()).toEqual([]);
    });
  });

  describe('reset', () => {
    it('clears all internal state', () => {
      filter.filter('5.0');
      filter.filter('5.1');
      filter.reset();
      expect(filter.getLastAcceptedValue()).toBeNull();
      expect(filter.getPendingCluster()).toEqual([]);
      expect(filter.getRecentMeasurements()).toEqual([]);
    });
  });

  describe('filter with sensitivity=off', () => {
    beforeEach(() => {
      filter = new MeasurementFilter('off');
    });

    it('accepts any valid numeric value', () => {
      const result = filter.filter('5.0');
      expect(result.accepted).toBe(true);
      expect(result.value).toBe(5.0);
      expect(result.reason).toBe('disabled');
    });

    it('rejects non-numeric value', () => {
      const result = filter.filter('abc');
      expect(result.accepted).toBe(false);
      expect(result.value).toBeNull();
      expect(result.reason).toBe('disabled');
    });
  });

  describe('filter with error values', () => {
    it('rejects "--"', () => {
      const result = filter.filter('--');
      expect(result.accepted).toBe(false);
      expect(result.reason).toBe('error');
    });

    it('rejects "Sky"', () => {
      const result = filter.filter('Sky');
      expect(result.accepted).toBe(false);
      expect(result.reason).toBe('error');
    });

    it('rejects strings with "error"', () => {
      const result = filter.filter('laser error');
      expect(result.accepted).toBe(false);
      expect(result.reason).toBe('error');
    });

    it('rejects negative values', () => {
      const result = filter.filter('-1');
      expect(result.accepted).toBe(false);
      expect(result.reason).toBe('error');
    });

    it('rejects values over 500', () => {
      const result = filter.filter('501');
      expect(result.accepted).toBe(false);
      expect(result.reason).toBe('error');
    });
  });

  describe('filter consistency logic', () => {
    it('accepts first valid reading', () => {
      const result = filter.filter('5.0');
      expect(result.accepted).toBe(true);
      expect(result.value).toBe(5.0);
      expect(result.confidence).toBe(50);
    });

    it('accepts consistent readings within threshold', () => {
      filter.filter('5.0');
      const result = filter.filter('5.1');
      expect(result.accepted).toBe(true);
      expect(result.reason).toBe('valid');
    });

    it('rejects sudden large jump as pending', () => {
      filter.filter('5.0');
      const result = filter.filter('15.0');
      expect(result.accepted).toBe(false);
      expect(result.reason).toBe('pending');
    });

    it('accepts new value after enough consistent readings in cluster', () => {
      filter.filter('5.0'); // accepted (first)
      filter.filter('15.0'); // pending (big jump)
      filter.filter('15.1'); // pending (building cluster)
      const result = filter.filter('15.2'); // should be accepted after 3 consistent readings
      expect(result.accepted).toBe(true);
      expect(result.reason).toBe('valid');
    });

    it('returns minimum of cluster as accepted value', () => {
      filter.filter('5.0'); // accepted
      filter.filter('15.0'); // pending cluster start
      filter.filter('15.1'); // cluster grows
      const result = filter.filter('15.2'); // cluster accepted
      expect(result.value).toBe(15.0); // min of [15.0, 15.1, 15.2]
    });
  });

  describe('getStats', () => {
    it('returns stats with initial state', () => {
      const stats = filter.getStats();
      expect(stats.windowSize).toBe(5); // medium
      expect(stats.filled).toBe(0);
      expect(stats.lastAccepted).toBeNull();
      expect(stats.pendingCount).toBe(0);
    });

    it('updates stats after filtering', () => {
      filter.filter('5.0');
      filter.filter('5.1');
      const stats = filter.getStats();
      expect(stats.filled).toBe(2);
      expect(stats.lastAccepted).toBe(5.1);
      expect(stats.pendingCount).toBe(0);
    });
  });

  describe('sensitivity configurations', () => {
    it('low sensitivity has window size 3', () => {
      const f = new MeasurementFilter('low');
      expect(f.getStats().windowSize).toBe(3);
    });

    it('medium sensitivity has window size 5', () => {
      const f = new MeasurementFilter('medium');
      expect(f.getStats().windowSize).toBe(5);
    });

    it('high sensitivity has window size 7', () => {
      const f = new MeasurementFilter('high');
      expect(f.getStats().windowSize).toBe(7);
    });

    it('off sensitivity has window size 1', () => {
      const f = new MeasurementFilter('off');
      expect(f.getStats().windowSize).toBe(1);
    });
  });

  describe('window management', () => {
    it('maintains window size limit', () => {
      filter = new MeasurementFilter('low'); // windowSize = 3
      filter.filter('5.0');
      filter.filter('5.1');
      filter.filter('5.2');
      filter.filter('5.3');
      expect(filter.getRecentMeasurements()).toHaveLength(3);
    });
  });
});
