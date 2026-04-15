import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.stubGlobal('localStorage', {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
});

// Mock crypto.randomUUID
vi.stubGlobal('crypto', {
  randomUUID: vi.fn(() => 'test-uuid-1234'),
});

// Mock calibration storage
vi.mock('../storage', () => ({
  calibrationStorage: {
    loadAltitudeCalibration: vi.fn().mockResolvedValue(null),
    saveAltitudeCalibration: vi.fn().mockResolvedValue(undefined),
  },
}));

import { altitudeCalibration } from '../altitude';
import type { AltitudeCalibration, AltitudeData } from '../altitude';

describe('AltitudeCalibrationService', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // Load a default calibration for tests
    await altitudeCalibration.load('device-1');
  });

  describe('load', () => {
    it('creates a default calibration when none exists', async () => {
      const cal = altitudeCalibration.getCurrent();
      expect(cal).not.toBeNull();
      expect(cal!.deviceId).toBe('device-1');
      expect(cal!.sourceStrategy).toBe('prefer_msl');
      expect(cal!.offsetM).toBe(0);
      expect(cal!.calibrationMethod).toBe('none');
    });

    it('loads existing calibration from storage', async () => {
      const { calibrationStorage } = await import('../storage');
      const existing: AltitudeCalibration = {
        id: 'existing-1',
        deviceId: 'device-2',
        sourceStrategy: 'derive_msl',
        offsetM: 5.0,
        calibratedAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        calibrationMethod: 'benchmark',
      };
      vi.mocked(calibrationStorage.loadAltitudeCalibration).mockResolvedValueOnce(existing);

      const result = await altitudeCalibration.load('device-2');
      expect(result).toEqual(existing);
    });
  });

  describe('subscribe', () => {
    it('calls subscriber immediately with current value', () => {
      const callback = vi.fn();
      altitudeCalibration.subscribe(callback);
      expect(callback).toHaveBeenCalledWith(altitudeCalibration.getCurrent());
    });

    it('returns unsubscribe function', () => {
      const callback = vi.fn();
      const unsub = altitudeCalibration.subscribe(callback);
      expect(typeof unsub).toBe('function');
    });
  });

  describe('calibrateWithReference', () => {
    it('calculates correct offset', () => {
      const offset = altitudeCalibration.calibrateWithReference(100, 95, 'benchmark');
      expect(offset).toBe(5);
    });

    it('sets calibration method and reference values', () => {
      altitudeCalibration.calibrateWithReference(200, 195.5, 'manual');
      const cal = altitudeCalibration.getCurrent();
      expect(cal!.offsetM).toBeCloseTo(4.5);
      expect(cal!.calibrationMethod).toBe('manual');
      expect(cal!.referenceAltitude).toBe(200);
      expect(cal!.rawAltitudeAtCalibration).toBe(195.5);
    });
  });

  describe('resetOffset', () => {
    it('resets offset to 0 and method to none', () => {
      altitudeCalibration.calibrateWithReference(100, 90, 'benchmark');
      altitudeCalibration.resetOffset();

      const cal = altitudeCalibration.getCurrent();
      expect(cal!.offsetM).toBe(0);
      expect(cal!.calibrationMethod).toBe('none');
      expect(cal!.referenceAltitude).toBeUndefined();
      expect(cal!.rawAltitudeAtCalibration).toBeUndefined();
    });
  });

  describe('applyCalibration', () => {
    it('applies offset to raw altitude', () => {
      altitudeCalibration.calibrateWithReference(100, 95, 'benchmark');
      const data = altitudeCalibration.applyCalibration(95);

      expect(data.raw).toBe(95);
      expect(data.selected).toBe(95);
      expect(data.corrected).toBe(100);
      expect(data.offset).toBe(5);
    });

    it('handles null altitude', () => {
      const data = altitudeCalibration.applyCalibration(null);
      expect(data.raw).toBeNull();
      expect(data.selected).toBeNull();
      expect(data.corrected).toBeNull();
    });
  });

  describe('applyCalibrationFull', () => {
    it('prefers MSL explicit with prefer_msl strategy', async () => {
      await altitudeCalibration.load('device-1');
      altitudeCalibration.setStrategy('prefer_msl');

      const data = altitudeCalibration.applyCalibrationFull(100, 150, 200, 50);
      expect(data.selected).toBe(150); // MSL explicit preferred
    });

    it('derives MSL from ellipsoid when MSL is null (prefer_msl)', async () => {
      await altitudeCalibration.load('device-1');
      altitudeCalibration.setStrategy('prefer_msl');

      const data = altitudeCalibration.applyCalibrationFull(100, null, 200, 50);
      expect(data.selected).toBe(150); // 200 - 50
    });

    it('falls back to raw when nothing else available (prefer_msl)', async () => {
      await altitudeCalibration.load('device-1');
      altitudeCalibration.setStrategy('prefer_msl');

      const data = altitudeCalibration.applyCalibrationFull(100, null, null, null);
      expect(data.selected).toBe(100);
    });

    it('prefers derived MSL with derive_msl strategy', async () => {
      await altitudeCalibration.load('device-1');
      altitudeCalibration.setStrategy('derive_msl');

      const data = altitudeCalibration.applyCalibrationFull(100, 150, 200, 50);
      expect(data.selected).toBe(150); // 200 - 50
    });

    it('uses raw with raw_ambiguous strategy', async () => {
      await altitudeCalibration.load('device-1');
      altitudeCalibration.setStrategy('raw_ambiguous');

      const data = altitudeCalibration.applyCalibrationFull(100, 150, 200, 50);
      expect(data.selected).toBe(100);
    });

    it('applies offset to selected value', async () => {
      await altitudeCalibration.load('device-1');
      altitudeCalibration.calibrateWithReference(160, 150, 'benchmark');

      const data = altitudeCalibration.applyCalibrationFull(100, 150, null, null);
      expect(data.corrected).toBe(160); // 150 + 10
    });
  });

  describe('getExportMetadata', () => {
    it('returns metadata with calibration info', () => {
      const meta = altitudeCalibration.getExportMetadata();
      expect(meta.altitudeCalibration).not.toBeNull();
      expect((meta.altitudeCalibration as any).strategy).toBeDefined();
      expect((meta.altitudeCalibration as any).offset).toBeDefined();
    });
  });
});
