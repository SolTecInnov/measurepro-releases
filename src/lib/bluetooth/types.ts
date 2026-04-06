export type BluetoothDeviceType = 'laser' | 'gps' | 'camera';
export type BluetoothConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface BluetoothDeviceInfo {
  id: string;
  name: string;
  type: BluetoothDeviceType;
  manufacturer?: string;
  model?: string;
  status: BluetoothConnectionStatus;
  rssi?: number;
  batteryLevel?: number;
  lastSeen?: number;
}

export interface BluetoothLaserDevice extends BluetoothDeviceInfo {
  type: 'laser';
  supportedFeatures: {
    singleMeasure: boolean;
    continuousMeasure: boolean;
    remoteTrigger: boolean;
    inclinometer: boolean;
    autoSync: boolean;
  };
}

export interface BluetoothGPSDevice extends BluetoothDeviceInfo {
  type: 'gps';
  supportedFeatures: {
    nmea: boolean;
    rtcm: boolean;
    multiConstellation: boolean;
  };
}

export interface BluetoothCameraDevice extends BluetoothDeviceInfo {
  type: 'camera';
  supportedFeatures: {
    livePreview: boolean;
    remoteCapture: boolean;
  };
}

export type AnyBluetoothDevice = BluetoothLaserDevice | BluetoothGPSDevice | BluetoothCameraDevice;

export interface BluetoothMeasurement {
  value: number;
  unit: 'meters' | 'feet' | 'inches';
  timestamp: number;
  deviceId: string;
  mode?: string;
  inclinometerAngle?: number;
}

export interface BluetoothDeviceDriver {
  connect(): Promise<boolean>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  getDeviceInfo(): BluetoothDeviceInfo;
  onMeasurement?(callback: (measurement: BluetoothMeasurement) => void): void;
  onData?(callback: (data: any) => void): void;
  onError?(callback: (error: Error) => void): void;
  onDisconnect?(callback: () => void): void;
}

export interface BluetoothLaserDriver extends BluetoothDeviceDriver {
  requestMeasurement(): Promise<void>;
  startContinuousMeasure?(): Promise<void>;
  stopContinuousMeasure?(): Promise<void>;
  enableAutoSync?(): Promise<void>;
  disableAutoSync?(): Promise<void>;
  turnLaserOn?(): Promise<void>;
  turnLaserOff?(): Promise<void>;
}

export interface BluetoothGPSDriver extends BluetoothDeviceDriver {
  onPositionUpdate(callback: (position: GPSPosition) => void): void;
}

export interface GPSPosition {
  latitude: number;
  longitude: number;
  altitude?: number;
  accuracy?: number;
  speed?: number;
  heading?: number;
  timestamp: number;
  satellites?: number;
  hdop?: number;
  fixType?: 'none' | 'gps' | 'dgps' | 'rtk-float' | 'rtk-fixed';
}

export const BOSCH_GLM_SERVICE_UUID = '02a6c0d0-0451-4000-b000-fb3210111989';
export const BOSCH_GLM_CHARACTERISTIC_UUID = '02a6c0d1-0451-4000-b000-fb3210111989';
export const BOSCH_GLM_NOTIFY_UUID = '02a6c0d2-0451-4000-b000-fb3210111989';

export const BLUETOOTH_SERIAL_UUID = '00001101-0000-1000-8000-00805f9b34fb';
export const GENERIC_ACCESS_UUID = '00001800-0000-1000-8000-00805f9b34fb';
export const DEVICE_INFORMATION_UUID = '0000180a-0000-1000-8000-00805f9b34fb';

export const GPS_SERVICE_UUID = '00001819-0000-1000-8000-00805f9b34fb';
export const GPS_LOCATION_UUID = '00002a67-0000-1000-8000-00805f9b34fb';

export function isBluetoothSupported(): boolean {
  return typeof navigator !== 'undefined' && 
         'bluetooth' in navigator && 
         typeof navigator.bluetooth?.requestDevice === 'function';
}

export async function checkBluetoothAvailability(): Promise<{
  supported: boolean;
  available: boolean;
  reason?: string;
}> {
  if (!isBluetoothSupported()) {
    return {
      supported: false,
      available: false,
      reason: 'Web Bluetooth API is not supported in this browser. Use Chrome, Edge, Brave, or Opera on desktop/Android.'
    };
  }

  try {
    const isAvailable = await navigator.bluetooth.getAvailability();
    if (!isAvailable) {
      return {
        supported: true,
        available: false,
        reason: 'Bluetooth is turned off or not available on this device.'
      };
    }
    return { supported: true, available: true };
  } catch (error) {
    return {
      supported: true,
      available: false,
      reason: `Cannot check Bluetooth availability: ${(error as Error).message}`
    };
  }
}
