import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock serial dependencies
vi.mock('../../serial', () => ({
  LaserType: {},
  LASER_PRESETS: {
    'soltec-standard': { config: { baudRate: 9600, dataBits: 8, stopBits: 1, parity: 'none', flowControl: 'none' } },
    'soltec-legacy': { config: { baudRate: 9600, dataBits: 8, stopBits: 1, parity: 'none', flowControl: 'none' } },
  },
}));

vi.mock('../../readers/serialLaserReader', () => ({
  LaserReader: vi.fn().mockImplementation(() => ({
    setLaserType: vi.fn(),
    registerCallback: vi.fn(),
    processData: vi.fn(),
  })),
}));

// Stub navigator.serial
vi.stubGlobal('navigator', {
  ...globalThis.navigator,
  serial: {
    requestPort: vi.fn().mockResolvedValue({ readable: null }),
  },
});

import {
  useMultiLaserStore,
  multiLaserDataCallbacks,
  addLateralCallback,
  removeLateralCallback,
  addRearCallback,
  removeRearCallback,
} from '../multiLaserStore';

const emptyPortState = () => ({
  port: null,
  reader: null,
  connected: false,
  lastMeasurement: '--',
  lastDistanceMeters: null,
  lastTimestamp: 0,
});

describe('useMultiLaserStore', () => {
  beforeEach(() => {
    useMultiLaserStore.setState({
      leftLateral: emptyPortState(),
      rightLateral: emptyPortState(),
      rear: emptyPortState(),
      deviceTypes: {
        leftLateral: 'soltec-standard',
        rightLateral: 'soltec-standard',
        rear: 'soltec-standard',
      },
      lateralConfig: {
        mode: 'single',
        singleLaserSide: 'right',
        leftOffsetMeters: 0,
        rightOffsetMeters: 0,
        alertThresholdLeft: 0.5,
        alertThresholdRight: 0.5,
        alertThresholdTotal: 5.0,
        alertEnabled: true,
      },
      rearConfig: {
        enabled: false,
        heightFromGroundMeters: 1.5,
        clearanceThresholdMeters: 40,
        alertEnabled: true,
      },
      availablePorts: [],
    });
    // Reset callbacks
    multiLaserDataCallbacks.left.length = 0;
    multiLaserDataCallbacks.right.length = 0;
    multiLaserDataCallbacks.rear.length = 0;
  });

  it('has correct defaults', () => {
    const state = useMultiLaserStore.getState();
    expect(state.leftLateral.connected).toBe(false);
    expect(state.rightLateral.connected).toBe(false);
    expect(state.rear.connected).toBe(false);
    expect(state.lateralConfig.mode).toBe('single');
    expect(state.rearConfig.enabled).toBe(false);
  });

  describe('setDeviceType', () => {
    it('sets device type for a position', () => {
      useMultiLaserStore.getState().setDeviceType('leftLateral', 'soltec-legacy');
      expect(useMultiLaserStore.getState().deviceTypes.leftLateral).toBe('soltec-legacy');
      expect(useMultiLaserStore.getState().deviceTypes.rightLateral).toBe('soltec-standard');
    });
  });

  describe('setLateralConfig', () => {
    it('merges partial config', () => {
      useMultiLaserStore.getState().setLateralConfig({ mode: 'dual', leftOffsetMeters: 1.5 });
      const config = useMultiLaserStore.getState().lateralConfig;
      expect(config.mode).toBe('dual');
      expect(config.leftOffsetMeters).toBe(1.5);
      expect(config.alertEnabled).toBe(true); // unchanged
    });
  });

  describe('setRearConfig', () => {
    it('merges partial config', () => {
      useMultiLaserStore.getState().setRearConfig({ enabled: true });
      const config = useMultiLaserStore.getState().rearConfig;
      expect(config.enabled).toBe(true);
      expect(config.heightFromGroundMeters).toBe(1.5); // unchanged
    });
  });

  describe('_updateMeasurement', () => {
    it('updates measurement for a position', () => {
      useMultiLaserStore.getState()._updateMeasurement('leftLateral', '3.456m', 3.456);
      const left = useMultiLaserStore.getState().leftLateral;
      expect(left.lastMeasurement).toBe('3.456m');
      expect(left.lastDistanceMeters).toBe(3.456);
      expect(left.lastTimestamp).toBeGreaterThan(0);
    });
  });

  describe('getLeftClearance', () => {
    it('returns null in single mode when side is right', () => {
      useMultiLaserStore.getState().setLateralConfig({ mode: 'single', singleLaserSide: 'right' });
      expect(useMultiLaserStore.getState().getLeftClearance()).toBeNull();
    });

    it('returns measurement in single mode when side is left', () => {
      useMultiLaserStore.getState().setLateralConfig({ mode: 'single', singleLaserSide: 'left' });
      useMultiLaserStore.getState()._updateMeasurement('leftLateral', '2.0', 2.0);
      const result = useMultiLaserStore.getState().getLeftClearance();
      expect(result).not.toBeNull();
      expect(result!.distanceMeters).toBe(2.0);
    });

    it('returns null in single mode when side is left but no measurement', () => {
      useMultiLaserStore.getState().setLateralConfig({ mode: 'single', singleLaserSide: 'left' });
      expect(useMultiLaserStore.getState().getLeftClearance()).toBeNull();
    });

    it('returns measurement with offset in dual mode', () => {
      useMultiLaserStore.getState().setLateralConfig({ mode: 'dual', leftOffsetMeters: 0.5 });
      useMultiLaserStore.getState()._updateMeasurement('leftLateral', '2.0', 2.0);
      const result = useMultiLaserStore.getState().getLeftClearance();
      expect(result).not.toBeNull();
      expect(result!.clearanceWithVehicle).toBe(2.5);
      expect(result!.clearanceWithoutVehicle).toBe(2.0);
    });

    it('returns null in dual mode with no measurement', () => {
      useMultiLaserStore.getState().setLateralConfig({ mode: 'dual' });
      expect(useMultiLaserStore.getState().getLeftClearance()).toBeNull();
    });
  });

  describe('getRightClearance', () => {
    it('returns null in single mode when side is left', () => {
      useMultiLaserStore.getState().setLateralConfig({ mode: 'single', singleLaserSide: 'left' });
      expect(useMultiLaserStore.getState().getRightClearance()).toBeNull();
    });

    it('returns measurement in single mode when side is right', () => {
      useMultiLaserStore.getState().setLateralConfig({ mode: 'single', singleLaserSide: 'right', rightOffsetMeters: 0.3 });
      useMultiLaserStore.getState()._updateMeasurement('rightLateral', '1.5', 1.5);
      const result = useMultiLaserStore.getState().getRightClearance();
      expect(result).not.toBeNull();
      expect(result!.clearanceWithVehicle).toBe(1.8);
    });

    it('returns measurement with offset in dual mode', () => {
      useMultiLaserStore.getState().setLateralConfig({ mode: 'dual', rightOffsetMeters: 1.0 });
      useMultiLaserStore.getState()._updateMeasurement('rightLateral', '3.0', 3.0);
      const result = useMultiLaserStore.getState().getRightClearance();
      expect(result).not.toBeNull();
      expect(result!.clearanceWithVehicle).toBe(4.0);
    });
  });

  describe('getTotalWidth', () => {
    it('returns null when no measurements in single mode', () => {
      expect(useMultiLaserStore.getState().getTotalWidth()).toBeNull();
    });

    it('returns distance + offset in single mode', () => {
      useMultiLaserStore.getState().setLateralConfig({ mode: 'single', singleLaserSide: 'right', rightOffsetMeters: 1.0 });
      useMultiLaserStore.getState()._updateMeasurement('rightLateral', '3.0', 3.0);
      expect(useMultiLaserStore.getState().getTotalWidth()).toBe(4.0);
    });

    it('returns sum of both distances + offsets in dual mode', () => {
      useMultiLaserStore.getState().setLateralConfig({
        mode: 'dual',
        leftOffsetMeters: 0.5,
        rightOffsetMeters: 0.5,
      });
      useMultiLaserStore.getState()._updateMeasurement('leftLateral', '2.0', 2.0);
      useMultiLaserStore.getState()._updateMeasurement('rightLateral', '3.0', 3.0);
      expect(useMultiLaserStore.getState().getTotalWidth()).toBe(6.0);
    });

    it('returns null in dual mode with only one measurement', () => {
      useMultiLaserStore.getState().setLateralConfig({ mode: 'dual' });
      useMultiLaserStore.getState()._updateMeasurement('leftLateral', '2.0', 2.0);
      expect(useMultiLaserStore.getState().getTotalWidth()).toBeNull();
    });
  });

  describe('getRearOverhang', () => {
    it('returns null when rear is not enabled', () => {
      expect(useMultiLaserStore.getState().getRearOverhang()).toBeNull();
    });

    it('returns null when enabled but no measurement', () => {
      useMultiLaserStore.getState().setRearConfig({ enabled: true });
      expect(useMultiLaserStore.getState().getRearOverhang()).toBeNull();
    });

    it('returns measurement with belowThreshold=true when below threshold', () => {
      useMultiLaserStore.getState().setRearConfig({ enabled: true, clearanceThresholdMeters: 10 });
      useMultiLaserStore.getState()._updateMeasurement('rear', '5.0', 5.0);
      const result = useMultiLaserStore.getState().getRearOverhang();
      expect(result).not.toBeNull();
      expect(result!.distanceMeters).toBe(5.0);
      expect(result!.belowThreshold).toBe(true);
    });

    it('returns belowThreshold=false when above threshold', () => {
      useMultiLaserStore.getState().setRearConfig({ enabled: true, clearanceThresholdMeters: 3 });
      useMultiLaserStore.getState()._updateMeasurement('rear', '5.0', 5.0);
      const result = useMultiLaserStore.getState().getRearOverhang();
      expect(result!.belowThreshold).toBe(false);
    });
  });

  describe('callback helpers', () => {
    it('addLateralCallback and removeLateralCallback', () => {
      const cb = vi.fn();
      addLateralCallback('left', cb);
      expect(multiLaserDataCallbacks.left).toContain(cb);
      removeLateralCallback('left', cb);
      expect(multiLaserDataCallbacks.left).not.toContain(cb);
    });

    it('addRearCallback and removeRearCallback', () => {
      const cb = vi.fn();
      addRearCallback(cb);
      expect(multiLaserDataCallbacks.rear).toContain(cb);
      removeRearCallback(cb);
      expect(multiLaserDataCallbacks.rear).not.toContain(cb);
    });

    it('removeLateralCallback does nothing for unknown callback', () => {
      const cb1 = vi.fn();
      const cb2 = vi.fn();
      addLateralCallback('right', cb1);
      removeLateralCallback('right', cb2);
      expect(multiLaserDataCallbacks.right).toHaveLength(1);
    });
  });
});
