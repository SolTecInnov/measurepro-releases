import { describe, it, expect, beforeEach } from 'vitest';
import { AmplitudeFilter } from '../amplitudeFilter';

describe('AmplitudeFilter', () => {
  let filter: AmplitudeFilter;

  beforeEach(() => {
    filter = new AmplitudeFilter({
      amplitudeThresholdDb: 10,
      hysteresisDb: 2,
      windowSize: 5,
      autoModeEnabled: false,
    });
  });

  describe('filter() — basic accept/reject', () => {
    it('accepts measurements above threshold', () => {
      const result = filter.filter(5.0, 15.0);
      expect(result.accepted).toBe(true);
      expect(result.distanceM).toBe(5.0);
      expect(result.amplitudeDb).toBe(15.0);
    });

    it('accepts measurements at threshold exactly (within hysteresis)', () => {
      // threshold=10, hysteresis=2, rejection triggers below 10-2=8
      const result = filter.filter(5.0, 9.0);
      expect(result.accepted).toBe(true);
    });

    it('rejects measurements below threshold minus hysteresis', () => {
      const result = filter.filter(5.0, 7.0); // below 10-2=8
      expect(result.accepted).toBe(false);
      expect(result.reason).toBeDefined();
    });
  });

  describe('filter() — hysteresis state machine', () => {
    it('transitions from accepting to rejecting when amplitude drops', () => {
      filter.filter(5.0, 15.0); // accepted
      const r2 = filter.filter(5.0, 7.0); // below threshold - hysteresis = 8
      expect(r2.accepted).toBe(false);
    });

    it('stays rejecting until amplitude recovers above threshold + hysteresis', () => {
      filter.filter(5.0, 7.0); // drops below → rejecting
      const r2 = filter.filter(5.0, 10.0); // still below threshold + hysteresis = 12
      expect(r2.accepted).toBe(false);

      const r3 = filter.filter(5.0, 12.0); // at threshold + hysteresis = 12, should recover
      expect(r3.accepted).toBe(true);
    });

    it('stays accepting when amplitude is between threshold-hysteresis and threshold+hysteresis', () => {
      filter.filter(5.0, 15.0); // accepting
      const r2 = filter.filter(5.0, 9.0); // between 8 and 12 → stays accepting
      expect(r2.accepted).toBe(true);
    });
  });

  describe('stats tracking', () => {
    it('counts accepted and rejected', () => {
      filter.filter(1.0, 20.0);
      filter.filter(2.0, 20.0);
      filter.filter(3.0, 5.0); // rejected (below 8)

      const stats = filter.getStats();
      expect(stats.accepted).toBe(2);
      expect(stats.rejected).toBe(1);
      expect(stats.lastAmplitude).toBe(5.0);
    });

    it('tracks average amplitude', () => {
      filter.filter(1.0, 10.0);
      filter.filter(1.0, 20.0);
      const stats = filter.getStats();
      expect(stats.averageAmplitude).toBe(15.0);
    });

    it('limits amplitude history to windowSize', () => {
      for (let i = 0; i < 10; i++) {
        filter.filter(1.0, 20.0);
      }
      // Window size is 5, so only last 5 values retained
      const stats = filter.getStats();
      expect(stats.averageAmplitude).toBe(20.0);
    });
  });

  describe('getAcceptanceRate()', () => {
    it('returns 1 when no measurements', () => {
      expect(filter.getAcceptanceRate()).toBe(1);
    });

    it('calculates correct rate', () => {
      filter.filter(1.0, 20.0); // accepted
      filter.filter(1.0, 5.0);  // rejected (below 8)
      expect(filter.getAcceptanceRate()).toBe(0.5);
    });
  });

  describe('reset()', () => {
    it('clears all stats and history', () => {
      filter.filter(1.0, 20.0);
      filter.filter(1.0, 5.0);
      filter.reset();

      const stats = filter.getStats();
      expect(stats.accepted).toBe(0);
      expect(stats.rejected).toBe(0);
      expect(stats.averageAmplitude).toBeNull();
      expect(stats.lastAmplitude).toBeNull();
      expect(stats.filterState).toBe('accepting');
    });
  });

  describe('updateSettings()', () => {
    it('updates threshold', () => {
      filter.updateSettings({ amplitudeThresholdDb: 20 });
      const settings = filter.getSettings();
      expect(settings.amplitudeThresholdDb).toBe(20);
      expect(filter.getStats().currentThreshold).toBe(20);
    });
  });

  describe('auto mode suggestion', () => {
    it('suggests threshold when autoModeEnabled and window is full', () => {
      const autoFilter = new AmplitudeFilter({
        amplitudeThresholdDb: 10,
        hysteresisDb: 2,
        windowSize: 5,
        autoModeEnabled: true,
      });
      // Fill window with similar values (range < 5)
      for (let i = 0; i < 5; i++) {
        autoFilter.filter(1.0, 20 + i * 0.5);
      }
      const stats = autoFilter.getStats();
      expect(stats.suggestedThreshold).not.toBeNull();
    });

    it('returns null suggestion when range is large', () => {
      const autoFilter = new AmplitudeFilter({
        amplitudeThresholdDb: 10,
        hysteresisDb: 2,
        windowSize: 5,
        autoModeEnabled: true,
      });
      // Fill window with widely varying values (range >= 5)
      autoFilter.filter(1.0, 5);
      autoFilter.filter(1.0, 10);
      autoFilter.filter(1.0, 15);
      autoFilter.filter(1.0, 20);
      autoFilter.filter(1.0, 25);
      const stats = autoFilter.getStats();
      expect(stats.suggestedThreshold).toBeNull();
    });
  });

  describe('applySuggestedThreshold()', () => {
    it('returns false when no suggestion', () => {
      expect(filter.applySuggestedThreshold()).toBe(false);
    });
  });

  describe('listeners', () => {
    it('addStatsListener/removeStatsListener', () => {
      let callCount = 0;
      const listener = () => { callCount++; };
      filter.addStatsListener(listener);
      filter.updateSettings({ amplitudeThresholdDb: 5 }); // triggers notify
      expect(callCount).toBe(1);
      filter.removeStatsListener(listener);
      filter.updateSettings({ amplitudeThresholdDb: 6 });
      expect(callCount).toBe(1); // not called again
    });
  });

  describe('default settings', () => {
    it('uses sensible defaults when no settings provided', () => {
      const defaultFilter = new AmplitudeFilter();
      const settings = defaultFilter.getSettings();
      expect(settings.amplitudeThresholdDb).toBe(1.0);
      expect(settings.hysteresisDb).toBe(0.5);
      expect(settings.windowSize).toBe(10);
      expect(settings.autoModeEnabled).toBe(false);
    });
  });
});
