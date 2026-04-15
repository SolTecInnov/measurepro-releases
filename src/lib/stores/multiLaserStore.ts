import { create } from 'zustand';
import { LaserType, LASER_PRESETS } from '../serial';
import { LaserReader } from '../readers/serialLaserReader';

type SerialPort = any;

export type LaserPosition = 'leftLateral' | 'rightLateral' | 'rear';

export interface LateralLaserConfig {
  enabled: boolean;
  position: 'left' | 'right';
  vehicleOffsetMeters: number;
}

export interface RearOverhangConfig {
  enabled: boolean;
  heightFromGroundMeters: number;
  clearanceThresholdMeters: number;
}

export interface LateralMeasurement {
  distanceMeters: number;
  clearanceWithVehicle: number;
  clearanceWithoutVehicle: number;
  timestamp: number;
  quality: 'good' | 'acceptable' | 'poor';
}

export interface RearMeasurement {
  distanceMeters: number;
  belowThreshold: boolean;
  timestamp: number;
  quality: 'good' | 'acceptable' | 'poor';
}

interface LaserPortState {
  port: SerialPort | null;
  reader: LaserReader | null;
  connected: boolean;
  lastMeasurement: string;
  lastDistanceMeters: number | null;
  lastTimestamp: number;
}

interface MultiLaserState {
  leftLateral: LaserPortState;
  rightLateral: LaserPortState;
  rear: LaserPortState;
  
  deviceTypes: Record<LaserPosition, LaserType>;
  setDeviceType: (position: LaserPosition, deviceType: LaserType) => void;
  
  lateralConfig: {
    mode: 'single' | 'dual';
    singleLaserSide: 'left' | 'right';
    leftOffsetMeters: number;
    rightOffsetMeters: number;
    alertThresholdLeft: number;
    alertThresholdRight: number;
    alertThresholdTotal: number;
    alertEnabled: boolean;
  };
  
  rearConfig: {
    enabled: boolean;
    heightFromGroundMeters: number;
    clearanceThresholdMeters: number;
    alertEnabled: boolean;
  };
  
  availablePorts: SerialPort[];
  
  requestPort: () => Promise<SerialPort | null>;
  connectLaser: (position: LaserPosition, port: SerialPort) => Promise<void>;
  disconnectLaser: (position: LaserPosition) => Promise<void>;
  
  setLateralConfig: (config: Partial<MultiLaserState['lateralConfig']>) => void;
  setRearConfig: (config: Partial<MultiLaserState['rearConfig']>) => void;
  
  getLeftClearance: () => LateralMeasurement | null;
  getRightClearance: () => LateralMeasurement | null;
  getTotalWidth: () => number | null;
  getRearOverhang: () => RearMeasurement | null;
  
  _updateMeasurement: (position: LaserPosition, data: string, distanceMeters: number) => void;
}

const createEmptyPortState = (): LaserPortState => ({
  port: null,
  reader: null,
  connected: false,
  lastMeasurement: '--',
  lastDistanceMeters: null,
  lastTimestamp: 0
});

export const useMultiLaserStore = create<MultiLaserState>((set, get) => ({
  leftLateral: createEmptyPortState(),
  rightLateral: createEmptyPortState(),
  rear: createEmptyPortState(),
  
  deviceTypes: {
    leftLateral: 'soltec-standard',
    rightLateral: 'soltec-standard',
    rear: 'soltec-standard'
  },
  
  setDeviceType: (position: LaserPosition, deviceType: LaserType) => {
    set((state) => ({
      deviceTypes: { ...state.deviceTypes, [position]: deviceType }
    }));
  },
  
  lateralConfig: {
    mode: 'single',
    singleLaserSide: 'right',
    leftOffsetMeters: 0,
    rightOffsetMeters: 0,
    alertThresholdLeft: 0.5,
    alertThresholdRight: 0.5,
    alertThresholdTotal: 5.0,
    alertEnabled: true
  },
  
  rearConfig: {
    enabled: false,
    heightFromGroundMeters: 1.5,
    clearanceThresholdMeters: 40,
    alertEnabled: true
  },
  
  availablePorts: [],
  
  requestPort: async () => {
    try {
      const serial = (navigator as any).serial;
      if (!serial) {
        console.error('[MultiLaser] Web Serial API not available');
        return null;
      }
      const port = await serial.requestPort();
      if (port) {
        set((state) => ({
          availablePorts: [...state.availablePorts.filter(p => p !== port), port]
        }));
        return port;
      }
      return null;
    } catch (error) {
      if ((error as Error).name === 'NotFoundError') {
        return null;
      }
      console.error('[MultiLaser] Port request error:', error);
      return null;
    }
  },
  
  // @ts-ignore - navigator.serial exists in Chrome
  _getNavigatorSerial: () => (navigator as any).serial,
  
  connectLaser: async (position: LaserPosition, port: SerialPort) => {
    try {
      console.log(`[MultiLaser] Connecting ${position} laser...`);
      
      const deviceType = get().deviceTypes[position];
      const portConfig = LASER_PRESETS[deviceType].config;
      
      const reader = new LaserReader();
      reader.setLaserType(deviceType);
      
      reader.registerCallback((data: string) => {
        const distanceMatch = data.match(/([+-]?\d+\.?\d*)/);
        const distanceMeters = distanceMatch ? parseFloat(distanceMatch[1]) : null;
        if (distanceMeters !== null) {
          get()._updateMeasurement(position, data, distanceMeters);
        }
      });
      
      if (!port.readable) {
        await port.open({
          baudRate: portConfig.baudRate,
          dataBits: portConfig.dataBits,
          stopBits: portConfig.stopBits,
          parity: portConfig.parity,
          flowControl: portConfig.flowControl,
          bufferSize: 4096
        });
      }
      
      set((state) => ({
        [position]: {
          ...state[position],
          port,
          reader,
          connected: true
        }
      }));
      
      const readData = async () => {
        try {
          const portReader = port.readable!.getReader();
          while (port.readable) {
            const { value, done } = await portReader.read();
            if (done) break;
            if (value && value.length > 0) {
              reader.processData(value);
            }
          }
          portReader.releaseLock();
        } catch (error) {
          console.error(`[MultiLaser] ${position} read error:`, error);
          set((state) => ({
            [position]: { ...state[position], connected: false }
          }));
        }
      };
      
      readData();
      console.log(`[MultiLaser] ${position} laser connected successfully`);
      
    } catch (error) {
      console.error(`[MultiLaser] Failed to connect ${position}:`, error);
      set(() => ({
        [position]: createEmptyPortState()
      } as Partial<MultiLaserState>));
      throw error;
    }
  },
  
  disconnectLaser: async (position: LaserPosition) => {
    const state = get();
    const laserState = state[position];
    
    if (laserState.port) {
      try {
        if (laserState.port.readable) {
          await laserState.port.close();
        }
      } catch (error) {
        console.warn(`[MultiLaser] Error closing ${position} port:`, error);
      }
    }
    
    set({ [position]: createEmptyPortState() });
    console.log(`[MultiLaser] ${position} laser disconnected`);
  },
  
  setLateralConfig: (config) => {
    set((state) => ({
      lateralConfig: { ...state.lateralConfig, ...config }
    }));
  },
  
  setRearConfig: (config) => {
    const newConfig = { ...get().rearConfig, ...config };
    
    if (newConfig.clearanceThresholdMeters > 40) {
      console.warn('[MultiLaser] Rear clearance threshold > 40m requires laser reconfiguration');
    }
    
    set({ rearConfig: newConfig });
  },
  
  getLeftClearance: () => {
    const state = get();
    const { lateralConfig, leftLateral } = state;
    
    if (lateralConfig.mode === 'single') {
      if (lateralConfig.singleLaserSide === 'left') {
        if (leftLateral.lastDistanceMeters === null) return null;
        return {
          distanceMeters: leftLateral.lastDistanceMeters,
          clearanceWithoutVehicle: leftLateral.lastDistanceMeters,
          clearanceWithVehicle: leftLateral.lastDistanceMeters,
          timestamp: leftLateral.lastTimestamp,
          quality: 'good' as const
        };
      } else {
        return null;
      }
    } else {
      if (leftLateral.lastDistanceMeters === null) return null;
      const clearanceWithVehicle = leftLateral.lastDistanceMeters + lateralConfig.leftOffsetMeters;
      return {
        distanceMeters: leftLateral.lastDistanceMeters,
        clearanceWithoutVehicle: leftLateral.lastDistanceMeters,
        clearanceWithVehicle,
        timestamp: leftLateral.lastTimestamp,
        quality: 'good' as const
      };
    }
  },
  
  getRightClearance: () => {
    const state = get();
    const { lateralConfig, rightLateral } = state;
    
    if (lateralConfig.mode === 'single') {
      if (lateralConfig.singleLaserSide === 'right') {
        const laserState = state.rightLateral.lastDistanceMeters !== null ? state.rightLateral : state.leftLateral;
        if (laserState.lastDistanceMeters === null) return null;
        
        const clearanceWithVehicle = laserState.lastDistanceMeters + lateralConfig.rightOffsetMeters;
        return {
          distanceMeters: laserState.lastDistanceMeters,
          clearanceWithoutVehicle: laserState.lastDistanceMeters,
          clearanceWithVehicle,
          timestamp: laserState.lastTimestamp,
          quality: 'good' as const
        };
      } else {
        return null;
      }
    } else {
      if (rightLateral.lastDistanceMeters === null) return null;
      const clearanceWithVehicle = rightLateral.lastDistanceMeters + lateralConfig.rightOffsetMeters;
      return {
        distanceMeters: rightLateral.lastDistanceMeters,
        clearanceWithoutVehicle: rightLateral.lastDistanceMeters,
        clearanceWithVehicle,
        timestamp: rightLateral.lastTimestamp,
        quality: 'good' as const
      };
    }
  },
  
  getTotalWidth: () => {
    const state = get();
    const { lateralConfig, leftLateral, rightLateral } = state;
    
    if (lateralConfig.mode === 'single') {
      const activeSide = lateralConfig.singleLaserSide;
      const laserState = activeSide === 'left' ? leftLateral : rightLateral;
      if (laserState.lastDistanceMeters === null) return null;
      
      const offset = activeSide === 'left' ? lateralConfig.leftOffsetMeters : lateralConfig.rightOffsetMeters;
      return laserState.lastDistanceMeters + offset;
    } else {
      if (leftLateral.lastDistanceMeters === null || rightLateral.lastDistanceMeters === null) {
        return null;
      }
      return leftLateral.lastDistanceMeters + rightLateral.lastDistanceMeters + 
             lateralConfig.leftOffsetMeters + lateralConfig.rightOffsetMeters;
    }
  },
  
  getRearOverhang: () => {
    const state = get();
    const { rearConfig, rear } = state;
    
    if (!rearConfig.enabled || rear.lastDistanceMeters === null) {
      return null;
    }
    
    return {
      distanceMeters: rear.lastDistanceMeters,
      belowThreshold: rear.lastDistanceMeters < rearConfig.clearanceThresholdMeters,
      timestamp: rear.lastTimestamp,
      quality: 'good' as const
    };
  },
  
  _updateMeasurement: (position: LaserPosition, data: string, distanceMeters: number) => {
    set((state) => ({
      [position]: {
        ...state[position],
        lastMeasurement: data,
        lastDistanceMeters: distanceMeters,
        lastTimestamp: Date.now()
      }
    }));
  }
}));

export const multiLaserDataCallbacks: {
  left: ((measurement: LateralMeasurement) => void)[];
  right: ((measurement: LateralMeasurement) => void)[];
  rear: ((measurement: RearMeasurement) => void)[];
} = {
  left: [],
  right: [],
  rear: []
};

export const addLateralCallback = (side: 'left' | 'right', callback: (m: LateralMeasurement) => void) => {
  multiLaserDataCallbacks[side].push(callback);
};

export const addRearCallback = (callback: (m: RearMeasurement) => void) => {
  multiLaserDataCallbacks.rear.push(callback);
};

export const removeLateralCallback = (side: 'left' | 'right', callback: (m: LateralMeasurement) => void) => {
  const index = multiLaserDataCallbacks[side].indexOf(callback);
  if (index > -1) multiLaserDataCallbacks[side].splice(index, 1);
};

export const removeRearCallback = (callback: (m: RearMeasurement) => void) => {
  const index = multiLaserDataCallbacks.rear.indexOf(callback);
  if (index > -1) multiLaserDataCallbacks.rear.splice(index, 1);
};
