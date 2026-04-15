import { describe, it, expect, vi } from 'vitest';

// Stub browser globals before any imports
vi.stubGlobal('localStorage', {
  getItem: vi.fn(() => null),
  setItem: vi.fn(),
  removeItem: vi.fn(),
});

vi.stubGlobal('window', {
  ...globalThis,
  localStorage: {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
  dispatchEvent: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
});

// Mock transitive imports that access browser APIs
vi.mock('@/lib/settings', () => ({
  default: {},
  getSettings: vi.fn(() => ({})),
}));

vi.mock('@/lib/stores/serialStore', () => ({
  useSerialStore: {
    getState: () => ({
      setLastLaserData: vi.fn(),
    }),
    subscribe: vi.fn(),
  },
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

vi.mock('@/lib/firebase', () => ({
  default: null,
}));

vi.mock('@/lib/stores/gpsStore', () => ({
  useGPSStore: {
    getState: () => ({
      setFailsafeEnabled: vi.fn(),
    }),
    subscribe: vi.fn(),
  },
}));

import {
  GPS_CONFIG,
  GPS_BAUD_RATES,
  GPS_DATA_BITS,
  GPS_STOP_BITS,
  GPS_PARITY,
  GPS_FLOW_CONTROL,
  LASER_CONFIGS,
} from '../serialConfig';

describe('serialConfig', () => {
  describe('GPS_CONFIG', () => {
    it('has correct default values', () => {
      expect(GPS_CONFIG.baudRate).toBe(4800);
      expect(GPS_CONFIG.dataBits).toBe(8);
      expect(GPS_CONFIG.stopBits).toBe(1);
      expect(GPS_CONFIG.parity).toBe('none');
      expect(GPS_CONFIG.flowControl).toBe('none');
    });
  });

  describe('GPS_BAUD_RATES', () => {
    it('includes standard baud rates', () => {
      const values = GPS_BAUD_RATES.map((r) => r.value);
      expect(values).toContain(4800);
      expect(values).toContain(9600);
      expect(values).toContain(19200);
      expect(values).toContain(38400);
      expect(values).toContain(57600);
      expect(values).toContain(115200);
    });

    it('has 6 entries', () => {
      expect(GPS_BAUD_RATES).toHaveLength(6);
    });

    it('each entry has value and label', () => {
      GPS_BAUD_RATES.forEach((rate) => {
        expect(typeof rate.value).toBe('number');
        expect(typeof rate.label).toBe('string');
        expect(rate.label.length).toBeGreaterThan(0);
      });
    });
  });

  describe('GPS_DATA_BITS', () => {
    it('includes 7 and 8 bit options', () => {
      const values = GPS_DATA_BITS.map((d) => d.value);
      expect(values).toContain(7);
      expect(values).toContain(8);
    });
  });

  describe('GPS_STOP_BITS', () => {
    it('includes 1 and 2 stop bits', () => {
      const values = GPS_STOP_BITS.map((s) => s.value);
      expect(values).toContain(1);
      expect(values).toContain(2);
    });
  });

  describe('GPS_PARITY', () => {
    it('includes none, even, odd', () => {
      const values = GPS_PARITY.map((p) => p.value);
      expect(values).toContain('none');
      expect(values).toContain('even');
      expect(values).toContain('odd');
    });
  });

  describe('GPS_FLOW_CONTROL', () => {
    it('includes none and hardware', () => {
      const values = GPS_FLOW_CONTROL.map((f) => f.value);
      expect(values).toContain('none');
      expect(values).toContain('hardware');
    });
  });

  describe('LASER_CONFIGS', () => {
    it('has entry for soltec-standard', () => {
      expect(LASER_CONFIGS['soltec-standard']).toBeDefined();
    });

    it('has entry for soltec-legacy', () => {
      expect(LASER_CONFIGS['soltec-legacy']).toBeDefined();
    });

    it('soltec-standard config has correct baud rate', () => {
      expect(LASER_CONFIGS['soltec-standard'].baudRate).toBe(115200);
    });

    it('each config has required serial parameters', () => {
      Object.entries(LASER_CONFIGS).forEach(([_key, config]) => {
        expect(typeof config.baudRate).toBe('number');
        expect([7, 8]).toContain(config.dataBits);
        expect([1, 2]).toContain(config.stopBits);
        expect(['none', 'even', 'odd']).toContain(config.parity);
        expect(['none', 'hardware']).toContain(config.flowControl);
        expect(config.commands).toBeDefined();
      });
    });

    it('each config has commands object', () => {
      Object.values(LASER_CONFIGS).forEach((config) => {
        expect(typeof config.commands).toBe('object');
      });
    });
  });
});
