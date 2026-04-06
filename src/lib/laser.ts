import { create } from 'zustand';
import { LaserType, MeasuringMode, type SerialConfig } from './serial';
import { saveSetting } from './settings';

interface LaserStore {
  connected: boolean;
  selectedType: LaserType;
  config: SerialConfig;
  mode: MeasuringMode;
  isTracking: boolean;
  isBufferTracking: boolean;
  alertStatus: 'OK' | 'WARNING' | 'DANGER';
  isLoggingPaused: boolean;
  groundReferenceHeight: number;
  bufferSamplingTime: number;
  currentMeasure: string;
  lastMeasure: string;
  lastUpdateTime: number;
  setConnected: (connected: boolean) => void;
  setSelectedType: (type: LaserType) => void;
  setConfig: (config: SerialConfig) => void;
  setConfigAndConnect: (config: SerialConfig) => Promise<boolean>;
  setMode: (mode: MeasuringMode) => void;
  setTracking: (isTracking: boolean) => void;
  setBufferTracking: (isBufferTracking: boolean) => void;
  setBufferSamplingTime: (time: number) => void;
  setLoggingPaused: (paused: boolean) => void;
  setAlertStatus: (status: 'OK' | 'WARNING' | 'DANGER') => void;
  setMeasures: (current: string, last: string) => void;
  setGroundReferenceHeight: (height: number) => void;
}

export const useLaserStore = create<LaserStore>((set) => ({
  connected: false,
  selectedType: 'soltec-standard',
  config: {
    baudRate: 19200,
    dataBits: 7,
    stopBits: 1,
    parity: 'even',
    flowControl: 'none'
  },
  mode: 'normal',
  isTracking: false,
  isBufferTracking: false,
  isLoggingPaused: false,
  alertStatus: 'OK',
  groundReferenceHeight: 0.0,
  bufferSamplingTime: 0,
  currentMeasure: '--',
  lastMeasure: '--',
  lastUpdateTime: 0,
  setConnected: (connected) => set({ connected }),
  setSelectedType: (selectedType) => set({ selectedType }),
  setConfig: (config) => {
    set({ config });
    // Store in localStorage for persistence
    try {
      localStorage.setItem('laser-config', JSON.stringify(config));
    } catch (error) {
    }
  },
  setConfigAndConnect: async (config) => {
    set({ config });
    return false;
  },
  setMode: (mode) => set({ mode }),
  setTracking: (isTracking) => set({ isTracking }),
  setBufferTracking: (isBufferTracking) => set({ isBufferTracking }),
  setBufferSamplingTime: (bufferSamplingTime) => set({ bufferSamplingTime }),
  setLoggingPaused: (isLoggingPaused) => set({ isLoggingPaused }),
  setAlertStatus: (alertStatus) => set({ alertStatus }),
  setMeasures: (current: string, last: string) => {
    set({
      currentMeasure: current,
      lastMeasure: last,
      lastUpdateTime: Date.now()
    });
  },
  setGroundReferenceHeight: (height: number) => {
    // Ensure we have a valid number
    const validHeight = isNaN(height) ? 0.0 : height;
    set({ groundReferenceHeight: validHeight });
    // Store in localStorage for persistence
    try {
      saveSetting('laser', 'groundReferenceHeight', validHeight);
      localStorage.setItem('groundReferenceHeight', validHeight.toString());
      // Also save with a timestamped backup
      localStorage.setItem(`groundReferenceHeight_backup_${Date.now()}`, validHeight.toString());
    } catch (error) {
    }
  }
}));

// Load ground reference height on store creation
const loadInitialGroundReference = () => {
  try {
    // Use localStorage directly to avoid IndexedDB issues
    const localValue = localStorage.getItem('groundReferenceHeight');
    if (localValue) {
      const value = parseFloat(localValue);
      if (!isNaN(value)) {
        useLaserStore.getState().setGroundReferenceHeight(value);
        return;
      }
    }
    
    // Set default if nothing found
    useLaserStore.getState().setGroundReferenceHeight(0.0);
  } catch (error) {
    useLaserStore.getState().setGroundReferenceHeight(0.0);
  }
};

// Load initial value
loadInitialGroundReference();