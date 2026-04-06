import { create } from 'zustand';
import {
  BluetoothDeviceType,
  BluetoothConnectionStatus,
  BluetoothMeasurement,
  GPSPosition,
  AnyBluetoothDevice,
  isBluetoothSupported,
  checkBluetoothAvailability
} from './types';
import { BoschGLMDriver, createBoschGLMDriver } from './devices/boschGLM';
import { BluetoothGPSDriver, createBluetoothGPSDriver } from './devices/bluetoothGPS';
import { getCurrentUser } from '../firebase';
import { auditLog } from '../auditLog';
import { useGPSStore } from '../stores/gpsStore';

export type ConnectionMode = 'wired' | 'bluetooth';

export type BluetoothLaserType = 'bosch-glm165' | 'generic-ble';

interface BluetoothState {
  isBluetoothSupported: boolean;
  isBluetoothAvailable: boolean;
  bluetoothError: string | null;
  
  connectionMode: {
    laser: ConnectionMode;
    gps: ConnectionMode;
    camera: ConnectionMode;
  };
  
  laserDriver: BoschGLMDriver | null;
  gpsDriver: BluetoothGPSDriver | null;
  
  laserStatus: BluetoothConnectionStatus;
  gpsStatus: BluetoothConnectionStatus;
  cameraStatus: BluetoothConnectionStatus;
  
  connectedLaserDevice: AnyBluetoothDevice | null;
  connectedGPSDevice: AnyBluetoothDevice | null;
  connectedCameraDevice: AnyBluetoothDevice | null;
  
  lastBluetoothMeasurement: BluetoothMeasurement | null;
  lastBluetoothPosition: GPSPosition | null;
  
  bluetoothLaserType: BluetoothLaserType;
  autoSyncEnabled: boolean;
  
  checkBluetoothSupport: () => Promise<void>;
  setConnectionMode: (deviceType: BluetoothDeviceType, mode: ConnectionMode) => void;
  setBluetoothLaserType: (type: BluetoothLaserType) => void;
  
  connectBluetoothLaser: () => Promise<boolean>;
  disconnectBluetoothLaser: () => Promise<void>;
  requestBluetoothMeasurement: () => Promise<void>;
  toggleBluetoothAutoSync: () => Promise<void>;
  toggleBluetoothLaser: (on: boolean) => Promise<void>;
  
  connectBluetoothGPS: () => Promise<boolean>;
  disconnectBluetoothGPS: () => Promise<void>;
  
  registerMeasurementCallback: (callback: (measurement: BluetoothMeasurement) => void) => void;
  unregisterMeasurementCallback: (callback: (measurement: BluetoothMeasurement) => void) => void;
  registerPositionCallback: (callback: (position: GPSPosition) => void) => void;
  unregisterPositionCallback: (callback: (position: GPSPosition) => void) => void;
}

const measurementCallbacks: Set<(measurement: BluetoothMeasurement) => void> = new Set();
const positionCallbacks: Set<(position: GPSPosition) => void> = new Set();

export const useBluetoothStore = create<BluetoothState>((set, get) => ({
  isBluetoothSupported: isBluetoothSupported(),
  isBluetoothAvailable: false,
  bluetoothError: null,
  
  connectionMode: {
    laser: 'wired',
    gps: 'wired',
    camera: 'wired'
  },
  
  laserDriver: null,
  gpsDriver: null,
  
  laserStatus: 'disconnected',
  gpsStatus: 'disconnected',
  cameraStatus: 'disconnected',
  
  connectedLaserDevice: null,
  connectedGPSDevice: null,
  connectedCameraDevice: null,
  
  lastBluetoothMeasurement: null,
  lastBluetoothPosition: null,
  
  bluetoothLaserType: 'bosch-glm165',
  autoSyncEnabled: false,
  
  checkBluetoothSupport: async () => {
    const result = await checkBluetoothAvailability();
    set({
      isBluetoothSupported: result.supported,
      isBluetoothAvailable: result.available,
      bluetoothError: result.reason || null
    });
  },
  
  setConnectionMode: (deviceType, mode) => {
    set(state => ({
      connectionMode: {
        ...state.connectionMode,
        [deviceType]: mode
      }
    }));
    
    try {
      localStorage.setItem(`bluetooth_mode_${deviceType}`, mode);
    } catch (e) {}
  },
  
  setBluetoothLaserType: (type) => {
    set({ bluetoothLaserType: type });
    try {
      localStorage.setItem('bluetooth_laser_type', type);
    } catch (e) {}
  },
  
  connectBluetoothLaser: async () => {
    const state = get();
    
    if (!state.isBluetoothSupported) {
      set({ bluetoothError: 'Web Bluetooth is not supported in this browser' });
      return false;
    }
    
    set({ laserStatus: 'connecting' });
    
    try {
      const driver = createBoschGLMDriver();
      
      driver.onMeasurement((measurement) => {
        set({ lastBluetoothMeasurement: measurement });
        
        measurementCallbacks.forEach(cb => {
          try {
            cb(measurement);
          } catch (e) {}
        });
        
        window.dispatchEvent(new CustomEvent('bluetooth-measurement', {
          detail: measurement
        }));
        
        window.dispatchEvent(new CustomEvent('laser-measurement-update', {
          detail: { measurement: measurement.value.toFixed(3) }
        }));
      });
      
      driver.onError((error) => {
        console.error('Bluetooth laser error:', error);
        set({ bluetoothError: error.message });
      });
      
      driver.onDisconnect(() => {
        set({
          laserStatus: 'disconnected',
          connectedLaserDevice: null,
          laserDriver: null,
          autoSyncEnabled: false
        });
      });
      
      const success = await driver.connect();
      
      if (success) {
        const deviceInfo = driver.getDeviceInfo();
        set({
          laserDriver: driver,
          laserStatus: 'connected',
          connectedLaserDevice: deviceInfo,
          bluetoothError: null
        });
        try { const u = getCurrentUser(); if (u) auditLog.hardwareConnect(u.uid, u.email || '', 'laser', deviceInfo?.name || 'Bosch GLM', true, 'bluetooth'); } catch (_e) {}
        return true;
      } else {
        set({
          laserStatus: 'error',
          bluetoothError: 'Failed to connect to Bluetooth laser'
        });
        return false;
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      set({
        laserStatus: 'error',
        bluetoothError: err.message
      });
      return false;
    }
  },
  
  disconnectBluetoothLaser: async () => {
    const { laserDriver, connectedLaserDevice } = get();
    
    if (laserDriver) {
      await laserDriver.disconnect();
    }
    
    try { const u = getCurrentUser(); if (u) auditLog.hardwareConnect(u.uid, u.email || '', 'laser', connectedLaserDevice?.name || 'Bosch GLM', false, 'bluetooth'); } catch (_e) {}

    set({
      laserDriver: null,
      laserStatus: 'disconnected',
      connectedLaserDevice: null,
      autoSyncEnabled: false
    });
  },
  
  requestBluetoothMeasurement: async () => {
    const { laserDriver, laserStatus } = get();
    
    if (!laserDriver || laserStatus !== 'connected') {
      console.warn('Cannot request measurement: laser not connected');
      return;
    }
    
    try {
      await laserDriver.requestMeasurement();
    } catch (error) {
      console.error('Failed to request measurement:', error);
    }
  },
  
  toggleBluetoothAutoSync: async () => {
    const { laserDriver, laserStatus, autoSyncEnabled } = get();
    
    if (!laserDriver || laserStatus !== 'connected') {
      return;
    }
    
    try {
      if (autoSyncEnabled) {
        await laserDriver.disableAutoSync?.();
        set({ autoSyncEnabled: false });
      } else {
        await laserDriver.enableAutoSync?.();
        set({ autoSyncEnabled: true });
      }
    } catch (error) {
      console.error('Failed to toggle auto-sync:', error);
    }
  },
  
  toggleBluetoothLaser: async (on) => {
    const { laserDriver, laserStatus } = get();
    
    if (!laserDriver || laserStatus !== 'connected') {
      return;
    }
    
    try {
      if (on) {
        await laserDriver.turnLaserOn?.();
      } else {
        await laserDriver.turnLaserOff?.();
      }
    } catch (error) {
      console.error('Failed to toggle laser:', error);
    }
  },
  
  connectBluetoothGPS: async () => {
    const state = get();
    
    if (!state.isBluetoothSupported) {
      set({ bluetoothError: 'Web Bluetooth is not supported in this browser' });
      return false;
    }
    
    set({ gpsStatus: 'connecting' });
    
    try {
      const driver = createBluetoothGPSDriver();
      
      driver.onPositionUpdate((position) => {
        set({ lastBluetoothPosition: position });

        // Feed Bluetooth GPS into the central gpsStore priority chain
        const fixQuality: 'No Fix' | 'GPS Fix' | 'DGPS Fix' =
          position.fixType === 'dgps' ? 'DGPS Fix' :
          (position.fixType && position.fixType !== 'none') ? 'GPS Fix' :
          'No Fix';

        useGPSStore.getState().updateData({
          latitude: position.latitude,
          longitude: position.longitude,
          altitude: position.altitude ?? 0,
          speed: position.speed ?? 0,
          course: position.heading ?? 0,
          satellites: position.satellites ?? 0,
          hdop: position.hdop ?? 0,
          fixQuality,
          time: new Date(position.timestamp).toTimeString().split(' ')[0],
          source: 'bluetooth'
        });
        
        positionCallbacks.forEach(cb => {
          try {
            cb(position);
          } catch (e) {}
        });
        
        window.dispatchEvent(new CustomEvent('bluetooth-gps-position', {
          detail: position
        }));
      });
      
      driver.onError((error) => {
        console.error('Bluetooth GPS error:', error);
        set({ bluetoothError: error.message });
      });
      
      driver.onDisconnect(() => {
        set({
          gpsStatus: 'disconnected',
          connectedGPSDevice: null,
          gpsDriver: null
        });
      });
      
      const success = await driver.connect();
      
      if (success) {
        const deviceInfo = driver.getDeviceInfo();
        set({
          gpsDriver: driver,
          gpsStatus: 'connected',
          connectedGPSDevice: deviceInfo,
          bluetoothError: null
        });
        try { const u = getCurrentUser(); if (u) { auditLog.hardwareConnect(u.uid, u.email || '', 'gps', deviceInfo?.name || 'Bluetooth GPS', true, 'bluetooth'); auditLog.gpsSession(u.uid, u.email || '', 'bluetooth', true); } } catch (_e) {}
        return true;
      } else {
        set({
          gpsStatus: 'error',
          bluetoothError: 'Failed to connect to Bluetooth GPS'
        });
        return false;
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      set({
        gpsStatus: 'error',
        bluetoothError: err.message
      });
      return false;
    }
  },
  
  disconnectBluetoothGPS: async () => {
    const { gpsDriver, connectedGPSDevice } = get();
    
    if (gpsDriver) {
      await gpsDriver.disconnect();
    }

    try { const u = getCurrentUser(); if (u) { auditLog.hardwareConnect(u.uid, u.email || '', 'gps', connectedGPSDevice?.name || 'Bluetooth GPS', false, 'bluetooth'); auditLog.gpsSession(u.uid, u.email || '', 'bluetooth', false); } } catch (_e) {}
    
    set({
      gpsDriver: null,
      gpsStatus: 'disconnected',
      connectedGPSDevice: null
    });
  },
  
  registerMeasurementCallback: (callback) => {
    measurementCallbacks.add(callback);
  },
  
  unregisterMeasurementCallback: (callback) => {
    measurementCallbacks.delete(callback);
  },
  
  registerPositionCallback: (callback) => {
    positionCallbacks.add(callback);
  },
  
  unregisterPositionCallback: (callback) => {
    positionCallbacks.delete(callback);
  }
}));

const initializeBluetoothStore = () => {
  try {
    const laserMode = localStorage.getItem('bluetooth_mode_laser');
    const gpsMode = localStorage.getItem('bluetooth_mode_gps');
    const cameraMode = localStorage.getItem('bluetooth_mode_camera');
    const laserType = localStorage.getItem('bluetooth_laser_type');
    
    const state = useBluetoothStore.getState();
    
    if (laserMode === 'bluetooth' || laserMode === 'wired') {
      state.setConnectionMode('laser', laserMode);
    }
    if (gpsMode === 'bluetooth' || gpsMode === 'wired') {
      state.setConnectionMode('gps', gpsMode);
    }
    if (cameraMode === 'bluetooth' || cameraMode === 'wired') {
      state.setConnectionMode('camera', cameraMode);
    }
    if (laserType === 'bosch-glm165' || laserType === 'generic-ble') {
      state.setBluetoothLaserType(laserType);
    }
    
    state.checkBluetoothSupport();
  } catch (e) {
    console.error('Failed to initialize Bluetooth store:', e);
  }
};

if (typeof window !== 'undefined') {
  initializeBluetoothStore();
}
