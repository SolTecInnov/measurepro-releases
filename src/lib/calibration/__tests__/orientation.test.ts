import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.stubGlobal('localStorage', {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
});

vi.stubGlobal('crypto', {
  randomUUID: vi.fn(() => 'test-uuid-orient'),
});

vi.mock('../storage', () => ({
  calibrationStorage: {
    loadOrientationCalibration: vi.fn().mockResolvedValue(null),
    saveOrientationCalibration: vi.fn().mockResolvedValue(undefined),
  },
}));

import { orientationCalibration } from '../orientation';
import type { AccelGyroSample, CalibrationWindow } from '../orientation';

function makeSample(accelX: number, accelY: number, accelZ: number, ts = 0): AccelGyroSample {
  return { timestamp: ts, accelX, accelY, accelZ };
}

function makeWindow(samples: AccelGyroSample[], type: CalibrationWindow['type'] = 'baseline'): CalibrationWindow {
  return {
    samples,
    startTime: samples[0]?.timestamp ?? 0,
    endTime: samples[samples.length - 1]?.timestamp ?? 0,
    type,
  };
}

describe('OrientationCalibrationService', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await orientationCalibration.load('device-orient-1');
  });

  describe('getDefaultMapping', () => {
    it('returns identity mapping', () => {
      const mapping = orientationCalibration.getDefaultMapping();
      expect(mapping.vehicleX).toEqual({ duroAxis: 'X', sign: 1 });
      expect(mapping.vehicleY).toEqual({ duroAxis: 'Y', sign: 1 });
      expect(mapping.vehicleZ).toEqual({ duroAxis: 'Z', sign: 1 });
    });
  });

  describe('load', () => {
    it('creates a default calibration', async () => {
      const cal = orientationCalibration.getCurrent();
      expect(cal).not.toBeNull();
      expect(cal!.deviceId).toBe('device-orient-1');
      expect(cal!.validationPassed).toBe(false);
      expect(cal!.confidence.overall).toBe(0);
    });
  });

  describe('capture workflow', () => {
    it('captures and returns a window', () => {
      orientationCalibration.startCapture('baseline');
      orientationCalibration.addSample(makeSample(0, 0, -9.81, 100));
      orientationCalibration.addSample(makeSample(0, 0, -9.81, 200));

      const window = orientationCalibration.stopCapture();
      expect(window).not.toBeNull();
      expect(window!.samples).toHaveLength(2);
      expect(window!.type).toBe('baseline');
      expect(window!.startTime).toBe(100);
      expect(window!.endTime).toBe(200);
    });

    it('returns null if not capturing', () => {
      const result = orientationCalibration.stopCapture();
      expect(result).toBeNull();
    });

    it('returns null if no samples captured', () => {
      orientationCalibration.startCapture('forward');
      const result = orientationCalibration.stopCapture();
      expect(result).toBeNull();
    });

    it('does not add samples when not capturing', () => {
      orientationCalibration.addSample(makeSample(1, 2, 3));
      orientationCalibration.startCapture('baseline');
      const window = orientationCalibration.stopCapture();
      expect(window).toBeNull();
    });
  });

  describe('analyzeForwardTest', () => {
    it('detects dominant forward axis', () => {
      const baseline = makeWindow([
        makeSample(0, 0, -9.81),
        makeSample(0, 0, -9.81),
      ], 'baseline');

      const forward = makeWindow([
        makeSample(2.0, 0.1, -9.8),
        makeSample(2.5, 0.05, -9.82),
      ], 'forward');

      const result = orientationCalibration.analyzeForwardTest(baseline, forward);
      expect(result.dominantAxis).toBe('X');
      expect(result.sign).toBe(1);
      expect(result.confidence).toBeGreaterThan(50);
    });

    it('detects negative direction', () => {
      const baseline = makeWindow([makeSample(0, 0, -9.81)], 'baseline');
      const forward = makeWindow([makeSample(-3.0, 0, -9.81)], 'forward');

      const result = orientationCalibration.analyzeForwardTest(baseline, forward);
      expect(result.dominantAxis).toBe('X');
      expect(result.sign).toBe(-1);
    });
  });

  describe('analyzeLateralTest', () => {
    it('detects dominant lateral axis', () => {
      const baseline = makeWindow([makeSample(0, 0, -9.81)], 'baseline');
      const lateral = makeWindow([makeSample(0.1, 3.0, -9.81)], 'lateral');

      const result = orientationCalibration.analyzeLateralTest(baseline, lateral);
      expect(result.dominantAxis).toBe('Y');
      expect(result.sign).toBe(1);
      expect(result.confidence).toBeGreaterThan(50);
    });
  });

  describe('analyzeVerticalTest', () => {
    it('detects gravity on Z axis (normal orientation)', () => {
      const baseline = makeWindow([
        makeSample(0, 0, -9.81),
        makeSample(0, 0, -9.81),
      ], 'baseline');

      const result = orientationCalibration.analyzeVerticalTest(baseline);
      expect(result.dominantAxis).toBe('Z');
      // Gravity is negative, so sign should be 1 (inversion)
      expect(result.sign).toBe(1);
      expect(result.confidence).toBeGreaterThan(90);
    });

    it('detects gravity on X axis when mounted sideways', () => {
      const baseline = makeWindow([makeSample(9.81, 0, 0)], 'baseline');

      const result = orientationCalibration.analyzeVerticalTest(baseline);
      expect(result.dominantAxis).toBe('X');
      expect(result.sign).toBe(-1);
    });
  });

  describe('buildMapping', () => {
    it('builds correct mapping from test results', () => {
      const forward = { dominantAxis: 'X' as const, sign: 1 as const, confidence: 90 };
      const lateral = { dominantAxis: 'Y' as const, sign: 1 as const, confidence: 85 };
      const vertical = { dominantAxis: 'Z' as const, sign: 1 as const, confidence: 95 };

      const result = orientationCalibration.buildMapping(forward, lateral, vertical);
      expect(result.mapping.vehicleX.duroAxis).toBe('X');
      expect(result.mapping.vehicleY.duroAxis).toBe('Y');
      expect(result.mapping.vehicleZ.duroAxis).toBe('Z');
      expect(result.confidence.overall).toBe(90);
      expect(result.suggestions).toHaveLength(0);
    });

    it('warns about duplicate axes', () => {
      const forward = { dominantAxis: 'X' as const, sign: 1 as const, confidence: 90 };
      const lateral = { dominantAxis: 'X' as const, sign: -1 as const, confidence: 85 };
      const vertical = { dominantAxis: 'Z' as const, sign: 1 as const, confidence: 95 };

      const result = orientationCalibration.buildMapping(forward, lateral, vertical);
      expect(result.suggestions.some(s => s.includes('Same Duro axis'))).toBe(true);
    });

    it('suggests improvements for low confidence', () => {
      const forward = { dominantAxis: 'X' as const, sign: 1 as const, confidence: 20 };
      const lateral = { dominantAxis: 'Y' as const, sign: 1 as const, confidence: 20 };
      const vertical = { dominantAxis: 'Z' as const, sign: 1 as const, confidence: 50 };

      const result = orientationCalibration.buildMapping(forward, lateral, vertical);
      expect(result.suggestions.some(s => s.includes('Low confidence'))).toBe(true);
      expect(result.suggestions.some(s => s.includes('Forward test inconclusive'))).toBe(true);
      expect(result.suggestions.some(s => s.includes('Lateral test inconclusive'))).toBe(true);
      expect(result.suggestions.some(s => s.includes('Vertical axis detection weak'))).toBe(true);
    });
  });

  describe('validateOrientation', () => {
    it('passes when roll and pitch within tolerance', () => {
      const result = orientationCalibration.validateOrientation(0.5, -1.0, 2);
      expect(result.passed).toBe(true);
      expect(result.suggestions).toHaveLength(0);
    });

    it('fails when roll exceeds tolerance', () => {
      const result = orientationCalibration.validateOrientation(5.0, 0, 2);
      expect(result.passed).toBe(false);
      expect(result.suggestions.some(s => s.includes('Roll'))).toBe(true);
    });

    it('fails when pitch exceeds tolerance', () => {
      const result = orientationCalibration.validateOrientation(0, -3.0, 2);
      expect(result.passed).toBe(false);
      expect(result.suggestions.some(s => s.includes('Pitch'))).toBe(true);
    });
  });

  describe('transformAccel', () => {
    it('transforms with default (identity) mapping', () => {
      const sample = makeSample(1, 2, 3);
      const result = orientationCalibration.transformAccel(sample);
      expect(result.x).toBe(1);
      expect(result.y).toBe(2);
      expect(result.z).toBe(3);
    });

    it('transforms with custom mapping', () => {
      orientationCalibration.applyMapping({
        vehicleX: { duroAxis: 'Y', sign: -1 },
        vehicleY: { duroAxis: 'X', sign: 1 },
        vehicleZ: { duroAxis: 'Z', sign: -1 },
      });

      const sample = makeSample(1, 2, 3);
      const result = orientationCalibration.transformAccel(sample);
      expect(result.x).toBe(-2); // Y * -1
      expect(result.y).toBe(1);  // X * 1
      expect(result.z).toBe(-3); // Z * -1
    });
  });

  describe('getExportMetadata', () => {
    it('returns metadata with calibration info', () => {
      const meta = orientationCalibration.getExportMetadata();
      expect(meta.orientationCalibration).not.toBeNull();
      expect((meta.orientationCalibration as any).mapping).toBeDefined();
      expect((meta.orientationCalibration as any).confidence).toBeDefined();
    });
  });
});
