import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock all external store/module dependencies BEFORE importing the module under test
const mockSetLastLaserData = vi.fn();
vi.mock('@/lib/stores/serialStore', () => ({
  useSerialStore: {
    getState: vi.fn(() => ({
      setLastLaserData: mockSetLastLaserData,
    })),
  },
}));

vi.mock('@/lib/laserLog', () => ({
  appendToLaserOutput: vi.fn(),
}));

vi.mock('@/lib/stores/measurementFilterStore', () => ({
  useMeasurementFilterStore: {
    getState: () => ({
      enabled: false,
      filterMeasurement: vi.fn(() => ({ accepted: true, value: null })),
    }),
  },
}));

vi.mock('@/lib/stores/amplitudeFilterStore', () => ({
  useAmplitudeFilterStore: {
    getState: () => ({
      settings: {
        amplitudeThresholdDb: 1.0,
        hysteresisDb: 0.5,
        windowSize: 10,
        autoModeEnabled: false,
      },
      updateStats: vi.fn(),
    }),
  },
}));

// Stub window.dispatchEvent to avoid errors in test environment
vi.stubGlobal('dispatchEvent', vi.fn());

import { LaserReader } from '../serialLaserReader';

function encode(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

describe('LaserReader', () => {
  let reader: LaserReader;

  beforeEach(() => {
    vi.clearAllMocks();
    reader = new LaserReader();
  });

  describe('processData', () => {
    it('processes valid laser frame and emits measurement', () => {
      reader.processData(encode('D 0005.123 010.0\r\n'));

      expect(mockSetLastLaserData).toHaveBeenCalledWith('5.120');
    });

    it('emits "--" for error codes', () => {
      reader.processData(encode('DE02\r\n'));

      expect(mockSetLastLaserData).toHaveBeenCalledWith('--');
    });

    it('handles multiple frames in one chunk', () => {
      reader.processData(encode('D 0001.000 010.0\r\nD 0002.000 015.0\r\n'));

      expect(mockSetLastLaserData).toHaveBeenCalledTimes(2);
      expect(mockSetLastLaserData).toHaveBeenNthCalledWith(1, '1.000');
      expect(mockSetLastLaserData).toHaveBeenNthCalledWith(2, '2.000');
    });
  });

  describe('callbacks', () => {
    it('registerCallback receives emitted measurements', () => {
      const cb = vi.fn();
      reader.registerCallback(cb);
      reader.processData(encode('D 0003.500\r\n'));

      expect(cb).toHaveBeenCalledWith('3.500');
    });

    it('unregisterCallback stops notifications', () => {
      const cb = vi.fn();
      reader.registerCallback(cb);
      reader.unregisterCallback(cb);
      reader.processData(encode('D 0003.500\r\n'));

      expect(cb).not.toHaveBeenCalled();
    });

    it('clearCallbacks removes all listeners', () => {
      const cb1 = vi.fn();
      const cb2 = vi.fn();
      reader.registerCallback(cb1);
      reader.registerCallback(cb2);
      reader.clearCallbacks();
      reader.processData(encode('D 0003.500\r\n'));

      expect(cb1).not.toHaveBeenCalled();
      expect(cb2).not.toHaveBeenCalled();
    });
  });

  describe('reset', () => {
    it('resets lastValidMeasurement to "--"', () => {
      reader.processData(encode('D 0010.000\r\n'));
      expect(reader.getLastValidMeasurement()).toBe('10.000');

      reader.reset();
      expect(reader.getLastValidMeasurement()).toBe('--');
    });
  });

  describe('getStats', () => {
    it('returns driver stats', () => {
      reader.processData(encode('D 0001.000\r\nGARBAGE\r\n'));
      const stats = reader.getStats();
      expect(stats).not.toBeNull();
      expect(stats!.framesValid).toBe(1);
      expect(stats!.framesInvalid).toBe(1);
    });
  });

  describe('setAmplitudeFilterEnabled', () => {
    it('toggles filter on the underlying driver', () => {
      reader.setAmplitudeFilterEnabled(true);
      // No throw — just verifying the method exists and works
      reader.setAmplitudeFilterEnabled(false);
    });
  });
});
