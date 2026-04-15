import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the AmplitudeFilter class before importing the store
vi.mock('../../hardware/laser/amplitudeFilter', () => {
  const mockStats = {
    accepted: 0,
    rejected: 0,
    currentThreshold: 1.0,
    suggestedThreshold: null,
    averageAmplitude: null,
    lastAmplitude: null,
    filterState: 'accepting',
  };

  const mockSettings = {
    amplitudeThresholdDb: 1.0,
    hysteresisDb: 0.5,
    windowSize: 10,
    autoModeEnabled: false,
  };

  class MockAmplitudeFilter {
    private _settings = { ...mockSettings };
    private _stats = { ...mockStats };
    private listeners = new Set<Function>();

    updateSettings(newSettings: any) {
      this._settings = { ...this._settings, ...newSettings };
      this._stats.currentThreshold = this._settings.amplitudeThresholdDb;
    }

    getSettings() {
      return { ...this._settings };
    }

    getStats() {
      return { ...this._stats };
    }

    addStatsListener(fn: Function) {
      this.listeners.add(fn);
    }

    removeStatsListener(fn: Function) {
      this.listeners.delete(fn);
    }

    applySuggestedThreshold() {
      if (this._stats.suggestedThreshold !== null) {
        this._settings.amplitudeThresholdDb = this._stats.suggestedThreshold;
        this._stats.currentThreshold = this._stats.suggestedThreshold;
        return true;
      }
      return false;
    }

    reset() {
      this._stats = { ...mockStats };
    }
  }

  return {
    AmplitudeFilter: MockAmplitudeFilter,
    AmplitudeFilterSettings: {},
    AmplitudeFilterStats: {},
  };
});

// Need to reset the module-level filterInstance between tests
let storeModule: typeof import('../amplitudeFilterStore');

describe('useAmplitudeFilterStore', () => {
  beforeEach(async () => {
    // Reset modules to clear the filterInstance singleton
    vi.resetModules();
    storeModule = await import('../amplitudeFilterStore');

    storeModule.useAmplitudeFilterStore.setState({
      settings: {
        amplitudeThresholdDb: 1.0,
        hysteresisDb: 0.5,
        windowSize: 10,
        autoModeEnabled: false,
      },
      stats: {
        accepted: 0,
        rejected: 0,
        currentThreshold: 1.0,
        suggestedThreshold: null,
        averageAmplitude: null,
        lastAmplitude: null,
        filterState: 'accepting',
      },
      filterEnabled: true,
    });
  });

  it('has correct defaults', () => {
    const state = storeModule.useAmplitudeFilterStore.getState();
    expect(state.settings.amplitudeThresholdDb).toBe(1.0);
    expect(state.settings.hysteresisDb).toBe(0.5);
    expect(state.settings.windowSize).toBe(10);
    expect(state.settings.autoModeEnabled).toBe(false);
    expect(state.filterEnabled).toBe(true);
    expect(state.stats.accepted).toBe(0);
    expect(state.stats.rejected).toBe(0);
    expect(state.stats.filterState).toBe('accepting');
  });

  describe('setFilterEnabled', () => {
    it('enables filter', () => {
      storeModule.useAmplitudeFilterStore.getState().setFilterEnabled(true);
      expect(storeModule.useAmplitudeFilterStore.getState().filterEnabled).toBe(true);
    });

    it('disables filter', () => {
      storeModule.useAmplitudeFilterStore.getState().setFilterEnabled(false);
      expect(storeModule.useAmplitudeFilterStore.getState().filterEnabled).toBe(false);
    });
  });

  describe('updateSettings', () => {
    it('merges partial settings', () => {
      storeModule.useAmplitudeFilterStore.getState().updateSettings({ amplitudeThresholdDb: 2.0 });
      const settings = storeModule.useAmplitudeFilterStore.getState().settings;
      expect(settings.amplitudeThresholdDb).toBe(2.0);
      expect(settings.hysteresisDb).toBe(0.5); // unchanged
    });

    it('updates windowSize', () => {
      storeModule.useAmplitudeFilterStore.getState().updateSettings({ windowSize: 20 });
      expect(storeModule.useAmplitudeFilterStore.getState().settings.windowSize).toBe(20);
    });
  });

  describe('updateStats', () => {
    it('sets stats directly', () => {
      const newStats = {
        accepted: 50,
        rejected: 10,
        currentThreshold: 2.0,
        suggestedThreshold: 1.5,
        averageAmplitude: 3.0,
        lastAmplitude: 2.8,
        filterState: 'accepting' as const,
      };
      storeModule.useAmplitudeFilterStore.getState().updateStats(newStats);
      expect(storeModule.useAmplitudeFilterStore.getState().stats).toEqual(newStats);
    });
  });

  describe('getFilter', () => {
    it('returns an AmplitudeFilter instance', () => {
      const filter = storeModule.useAmplitudeFilterStore.getState().getFilter();
      expect(filter).toBeDefined();
      expect(typeof filter.getSettings).toBe('function');
      expect(typeof filter.getStats).toBe('function');
    });

    it('returns same instance on multiple calls', () => {
      const filter1 = storeModule.useAmplitudeFilterStore.getState().getFilter();
      const filter2 = storeModule.useAmplitudeFilterStore.getState().getFilter();
      expect(filter1).toBe(filter2);
    });
  });

  describe('reset', () => {
    it('resets stats via filter', () => {
      storeModule.useAmplitudeFilterStore.getState().updateStats({
        accepted: 100,
        rejected: 50,
        currentThreshold: 3.0,
        suggestedThreshold: 2.0,
        averageAmplitude: 4.0,
        lastAmplitude: 3.5,
        filterState: 'rejecting',
      });
      storeModule.useAmplitudeFilterStore.getState().reset();
      const stats = storeModule.useAmplitudeFilterStore.getState().stats;
      expect(stats.accepted).toBe(0);
      expect(stats.rejected).toBe(0);
    });
  });

  describe('getAmplitudeFilter helper', () => {
    it('returns filter instance', () => {
      const filter = storeModule.getAmplitudeFilter();
      expect(filter).toBeDefined();
    });
  });
});
