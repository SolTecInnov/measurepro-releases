import { describe, it, expect, beforeEach, vi } from 'vitest';

// Stub localStorage
vi.stubGlobal('localStorage', {
  getItem: vi.fn(() => null),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(),
});

// Mock settings store
vi.mock('../../settings', () => ({
  useSettingsStore: {
    getState: vi.fn(() => ({
      uiSettings: { measurementFilterSensitivity: 'medium' },
      setUISettings: vi.fn(),
    })),
  },
}));

import { useMeasurementFilterStore } from '../measurementFilterStore';

describe('useMeasurementFilterStore', () => {
  beforeEach(() => {
    // Reset to known state
    const store = useMeasurementFilterStore.getState();
    store.reset();
    useMeasurementFilterStore.setState({
      sensitivity: 'medium',
      enabled: true,
      filteredCount: 0,
      acceptedCount: 0,
      lastResult: null,
    });
    // Reset the filter sensitivity too
    store.filter.setSensitivity('medium');
  });

  it('has correct defaults', () => {
    const state = useMeasurementFilterStore.getState();
    expect(state.sensitivity).toBe('medium');
    expect(state.enabled).toBe(true);
    expect(state.lastResult).toBeNull();
    expect(state.filteredCount).toBe(0);
    expect(state.acceptedCount).toBe(0);
  });

  describe('setSensitivity', () => {
    it('updates sensitivity', () => {
      useMeasurementFilterStore.getState().setSensitivity('high');
      const state = useMeasurementFilterStore.getState();
      expect(state.sensitivity).toBe('high');
      expect(state.enabled).toBe(true);
    });

    it('sets enabled=false when sensitivity is off', () => {
      useMeasurementFilterStore.getState().setSensitivity('off');
      const state = useMeasurementFilterStore.getState();
      expect(state.sensitivity).toBe('off');
      expect(state.enabled).toBe(false);
    });
  });

  describe('setEnabled', () => {
    it('disabling sets sensitivity to off', () => {
      useMeasurementFilterStore.getState().setEnabled(false);
      const state = useMeasurementFilterStore.getState();
      expect(state.enabled).toBe(false);
      expect(state.sensitivity).toBe('off');
    });

    it('enabling restores saved sensitivity', () => {
      useMeasurementFilterStore.getState().setEnabled(false);
      useMeasurementFilterStore.getState().setEnabled(true);
      const state = useMeasurementFilterStore.getState();
      expect(state.enabled).toBe(true);
      expect(state.sensitivity).not.toBe('off');
    });
  });

  describe('filterMeasurement', () => {
    it('accepts first valid measurement', () => {
      const result = useMeasurementFilterStore.getState().filterMeasurement('5.000');
      expect(result.accepted).toBe(true);
      expect(result.value).toBe(5.0);
      expect(useMeasurementFilterStore.getState().acceptedCount).toBe(1);
    });

    it('accepts consistent measurements', () => {
      const store = useMeasurementFilterStore.getState();
      store.filterMeasurement('5.000');
      const result = store.filterMeasurement('5.001');
      expect(result.accepted).toBe(true);
      expect(useMeasurementFilterStore.getState().acceptedCount).toBe(2);
    });

    it('rejects error values', () => {
      const result = useMeasurementFilterStore.getState().filterMeasurement('--');
      expect(result.accepted).toBe(false);
      expect(result.reason).toBe('error');
      expect(useMeasurementFilterStore.getState().filteredCount).toBe(1);
    });

    it('updates lastResult', () => {
      useMeasurementFilterStore.getState().filterMeasurement('3.500');
      const lastResult = useMeasurementFilterStore.getState().lastResult;
      expect(lastResult).not.toBeNull();
      expect(lastResult!.rawValue).toBe('3.500');
    });
  });

  describe('reset', () => {
    it('clears counts and lastResult', () => {
      const store = useMeasurementFilterStore.getState();
      store.filterMeasurement('5.000');
      store.filterMeasurement('5.001');
      store.reset();
      const state = useMeasurementFilterStore.getState();
      expect(state.filteredCount).toBe(0);
      expect(state.acceptedCount).toBe(0);
      expect(state.lastResult).toBeNull();
    });
  });

  describe('getStats', () => {
    it('returns correct stats with no measurements', () => {
      const stats = useMeasurementFilterStore.getState().getStats();
      expect(stats.filtered).toBe(0);
      expect(stats.accepted).toBe(0);
      expect(stats.ratio).toBe(0);
    });

    it('returns correct ratio', () => {
      const store = useMeasurementFilterStore.getState();
      store.filterMeasurement('5.000'); // accepted
      store.filterMeasurement('5.001'); // accepted
      store.filterMeasurement('--');    // rejected
      const stats = useMeasurementFilterStore.getState().getStats();
      expect(stats.accepted).toBe(2);
      expect(stats.filtered).toBe(1);
      expect(stats.ratio).toBeCloseTo(2 / 3);
    });
  });
});
