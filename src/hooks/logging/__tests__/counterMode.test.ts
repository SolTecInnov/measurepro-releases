/**
 * Counter Mode (Auto-Capture) — unit tests
 *
 * Tests the sky→object→sky detection logic and configuration.
 * The actual React hook (useCounterMode) uses refs + effects,
 * so we test the exported helpers and config separately.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock browser APIs before imports — must be before vi.mock calls
const mockLocalStorage = {
  getItem: vi.fn(() => null) as any,
  setItem: vi.fn() as any,
  removeItem: vi.fn() as any,
  clear: vi.fn() as any,
  length: 0,
  key: vi.fn() as any,
};
vi.stubGlobal('localStorage', mockLocalStorage);

// Mock transitive deps
vi.mock('@/lib/sounds', () => ({
  soundManager: { playPOITypeChange: vi.fn(), playLogEntry: vi.fn(), playInterface: vi.fn(), playModeChange: vi.fn() },
}));
vi.mock('@/lib/firebase', () => ({ getSafeAuth: () => null }));
vi.mock('@/lib/auth/masterAdmin', () => ({ isBetaUser: () => false }));
vi.mock('@/lib/settings', () => ({
  useSettingsStore: { getState: () => ({ alertSettings: { thresholds: {} } }) },
}));
vi.mock('@/lib/stores/measurementFilterStore', () => ({
  useMeasurementFilterStore: { getState: () => ({}) },
}));
vi.mock('@/lib/stores/gpsStore', () => ({
  useGPSStore: { getState: () => ({ data: { latitude: 0, longitude: 0, altitude: 0, speed: 0, course: 0, source: 'none', fixQuality: 'No Fix' } }) },
}));
vi.mock('@/lib/stores/serialStore', () => ({
  useSerialStore: { getState: () => ({ lastMeasurement: null, lastMeasurementPoiType: null }) },
}));
vi.mock('@/lib/laser', () => ({
  useLaserStore: { getState: () => ({ groundReferenceHeight: 0 }) },
}));
vi.mock('@/lib/survey', () => ({
  useSurveyStore: { getState: () => ({ activeSurvey: null }) },
}));
vi.mock('@/lib/poi', () => ({
  usePOIStore: { getState: () => ({ selectedType: 'wire' }) },
}));
vi.mock('@/lib/poiActions', () => ({
  usePOIActionsStore: { getState: () => ({ getActionForPOI: () => 'auto-capture-and-log' }) },
}));

import { getAutoCaptureConfig, saveAutoCaptureConfig } from '../useCounterMode';
import { isInvalidReading, parseMeters } from '../useLoggingCore';

describe('Counter Mode', () => {
  beforeEach(() => {
    mockLocalStorage.getItem.mockReturnValue(null);
  });

  describe('getAutoCaptureConfig', () => {
    it('should return defaults when no saved config', () => {
      const cfg = getAutoCaptureConfig();
      expect(cfg.skyTimeoutMs).toBe(500);
      expect(cfg.maxObjectMs).toBe(3000);
      expect(cfg.maxObjectDistM).toBe(50);
      expect(cfg.counterThreshold).toBe(7);
    });

    it('should merge saved config with defaults', () => {
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify({ skyTimeoutMs: 800 }));
      const cfg = getAutoCaptureConfig();
      expect(cfg.skyTimeoutMs).toBe(800);
      expect(cfg.maxObjectMs).toBe(3000); // default preserved
    });

    it('should handle corrupt saved config gracefully', () => {
      mockLocalStorage.getItem.mockReturnValue('not-json{{{');
      const cfg = getAutoCaptureConfig();
      expect(cfg.skyTimeoutMs).toBe(500); // falls back to defaults
    });
  });

  describe('saveAutoCaptureConfig', () => {
    it('should save config to localStorage', () => {
      saveAutoCaptureConfig({ skyTimeoutMs: 1000 });
      expect(localStorage.setItem).toHaveBeenCalledWith(
        'auto_capture_config',
        JSON.stringify({ skyTimeoutMs: 1000 })
      );
    });
  });

  describe('Sky detection (isInvalidReading)', () => {
    it('should detect sky readings (DE02, --, infinity)', () => {
      expect(isInvalidReading('DE02')).toBe(true);
      expect(isInvalidReading('de02')).toBe(true);
      expect(isInvalidReading('--')).toBe(true);
      expect(isInvalidReading('infinity')).toBe(true);
      expect(isInvalidReading('[ERR]')).toBe(true);
    });

    it('should detect ground reflections (≤ 0.1m)', () => {
      expect(isInvalidReading('0')).toBe(true);
      expect(isInvalidReading('0.05')).toBe(true);
      expect(isInvalidReading('0.1')).toBe(true);
    });

    it('should accept valid readings (> 0.1m)', () => {
      expect(isInvalidReading('0.2')).toBe(false);
      expect(isInvalidReading('4.5')).toBe(false);
      expect(isInvalidReading('25.0')).toBe(false);
    });
  });

  describe('Height range filter simulation', () => {
    const minH = 4;
    const maxH = 25;

    it('should filter readings below minimum height', () => {
      const reading = parseMeters('3.5', 0);
      expect(reading.isValid).toBe(true);
      expect(reading.meters < minH).toBe(true); // Would be filtered
    });

    it('should filter readings above maximum height', () => {
      const reading = parseMeters('26.0', 0);
      expect(reading.isValid).toBe(true);
      expect(reading.meters > maxH).toBe(true); // Would be filtered
    });

    it('should accept readings within range', () => {
      const reading = parseMeters('5.234', 0);
      expect(reading.isValid).toBe(true);
      expect(reading.meters >= minH && reading.meters <= maxH).toBe(true);
    });

    it('should apply ground reference to height check', () => {
      // Reading 3.0m + groundRef 2.0m = 5.0m → within range
      const reading = parseMeters('3.0', 2.0);
      expect(reading.meters).toBe(5.0);
      expect(reading.meters >= minH && reading.meters <= maxH).toBe(true);
    });
  });

  describe('Buffer MIN logic simulation', () => {
    it('should find minimum from buffer of readings', () => {
      const buffer = [5.2, 4.8, 6.1, 4.3, 5.5];
      const minReading = Math.min(...buffer);
      const avgReading = buffer.reduce((a, b) => a + b, 0) / buffer.length;

      expect(minReading).toBe(4.3);
      expect(avgReading).toBeCloseTo(5.18, 1);
    });

    it('should handle single reading buffer', () => {
      const buffer = [7.2];
      expect(Math.min(...buffer)).toBe(7.2);
    });
  });
});
