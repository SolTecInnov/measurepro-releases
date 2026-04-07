import { create } from 'zustand';
import { toast } from 'sonner';
import { LaserType, MeasuringMode, SerialConfig, SerialConnection, migrateLaserType } from '../serial';
import { useSettingsStore } from '../settings';
import { saveSetting } from '../settings';
import { GPS_CONFIG, LASER_CONFIGS, GPS_BAUD_RATES } from '../config/serialConfig';
import { useGPSStore } from './gpsStore';
import { LaserReader } from '../readers/serialLaserReader';
import { GPSReader } from '../readers/serialGPSReader';
import { getCurrentUser } from '../firebase';
import { auditLog } from '../auditLog';
import { appendToLaserOutput, clearLaserOutput } from '../laserLog';

// Re-export for consumers who import from this module
export { appendToLaserOutput, clearLaserOutput, getLaserLog, subscribeLaserLog } from '../laserLog';

export enum SerialResetStatus {
  IDLE = 'idle',
  RESETTING = 'resetting',
  SUCCESS = 'success',
  ERROR = 'error'
}

// Get initial config based on laser type
const getInitialLaserConfig = (type: LaserType = 'soltec-standard') => LASER_CONFIGS[type];

// Override the default GPS config with known working settings

// Constants for buffer management
const MAX_BUFFER_SIZE = 8192; // 8KB maximum buffer size
const CHUNK_SIZE = 256;      // Reduced chunk size
const PROCESS_DELAY = 100;   // Processing delay in ms

interface SerialState {
  availablePorts: SerialPort[];
  laserPort: SerialPort | null;
  gpsPort: SerialPort | null;
  serialReader: ReadableStreamDefaultReader<Uint8Array> | null;
  laserReader: LaserReader | null;
  gpsReader: GPSReader | null;
  laserConfig: SerialConfig;
  gpsConfig: SerialConfig;
  laserType: LaserType;
  amplitudeFilterEnabled: boolean;
  measuringMode: MeasuringMode;
  bufferSamplingTime: number;
  isBufferTracking: boolean;
  bufferMeasurements: string[];
  lastMeasurement: string;
  currentMeasurement: string;
  measurementSampleId: number;
  resetStatus: SerialResetStatus;
  _laserOnDataAttached?: boolean;

  // Actions
  requestPort: () => Promise<void>;
  connectToLaser: (port: SerialPort) => Promise<void>;
  connectToGPS: (port: SerialPort) => Promise<void>;
  disconnectLaser: () => Promise<void>;
  disconnectGPS: () => Promise<void>;
  setLaserConfig: (config: Partial<SerialConfig>) => void;
  setGPSConfig: (config: Partial<SerialConfig>) => void;
  setLaserType: (type: LaserType) => void;
  setAmplitudeFilterEnabled: (enabled: boolean) => void;
  setMeasuringMode: (mode: MeasuringMode) => void;
  startTracking: () => Promise<void>;
  stopTracking: () => Promise<void>;
  startBufferTracking: () => Promise<void>;
  stopBufferTracking: () => Promise<void>;
  setBufferSamplingTime: (time: number) => void;
  clearBuffer: () => void;
  sendLaserCommand: (command: string) => Promise<void>;
  sendGPSCommand: (command: string) => Promise<void>;
  toggleRedDot: (on: boolean) => Promise<void>;
  getTemperature: () => Promise<void>;
  singleMeasure: () => Promise<void>;
  stopLaser: () => Promise<void>;
  setLastLaserData: (data: string) => void;
  resetSerialConnection: () => Promise<void>;
  resetMinDistance: () => void;
}

let activeLaserStreamReader: ReadableStreamDefaultReader<Uint8Array> | null = null;
let laserReadLoopRunning = false;

// Initialize separate callback stores for laser and GPS
const laserDataCallbacks: ((data: string) => void)[] = [];
const gpsDataCallbacks: ((data: string) => void)[] = [];

// Add functions to manage laser data callbacks
export const addLaserDataCallback = (callback: (data: string) => void) => {
  laserDataCallbacks.push(callback);
};

export const removeLaserDataCallback = (callback: (data: string) => void) => {
  const index = laserDataCallbacks.indexOf(callback);
  if (index > -1) {
    laserDataCallbacks.splice(index, 1);
  }
};

export const clearLaserDataCallbacks = () => {
  laserDataCallbacks.length = 0;
};

// Fix 4: Module-level dispatch throttle
let lastDispatchTime = 0;
const DISPATCH_THROTTLE_MS = 66;

// Throttle Zustand set() for lastMeasurement to avoid 16 re-renders per laser reading
// Laser fires at ~10Hz, UI only needs ~5Hz (200ms) for smooth display
let lastStoreUpdateTime = 0;
const STORE_UPDATE_THROTTLE_MS = 100; // 10fps max re-renders
let pendingMeasurement: string | null = null;
let storeUpdateTimer: ReturnType<typeof setTimeout> | null = null;

// Migrate stored laser type on init
const storedLaserType = (() => {
  try {
    const stored = localStorage.getItem('laserType');
    return stored ? migrateLaserType(stored) : 'soltec-standard';
  } catch {
    return 'soltec-standard' as LaserType;
  }
})();

const storedAmplitudeFilter = (() => {
  try {
    const stored = localStorage.getItem('amplitudeFilterEnabled');
    return stored !== null ? stored === 'true' : true;
  } catch {
    return true;
  }
})();

export const useSerialStore = create<SerialState>((set, get) => ({
  availablePorts: [],
  laserPort: null,
  gpsPort: null,
  serialReader: null,
  laserReader: null,
  gpsReader: null,
  laserConfig: getInitialLaserConfig(storedLaserType),
  gpsConfig: {
    baudRate: 4800,
    dataBits: 8,
    stopBits: 1,
    parity: 'none',
    flowControl: 'none'
  },
  laserType: storedLaserType,
  amplitudeFilterEnabled: storedAmplitudeFilter,
  measuringMode: 'normal' as MeasuringMode,
  bufferSamplingTime: 0,
  isBufferTracking: false,
  bufferMeasurements: [],
  lastMeasurement: '--',
  currentMeasurement: '--',
  measurementSampleId: 0,
  resetStatus: SerialResetStatus.IDLE,

  requestPort: async () => {
    try {
      const port = await navigator.serial.requestPort();
      
      if (port) {
        const info = port.getInfo();
        set((state) => ({
          availablePorts: [...state.availablePorts.filter(p => p !== port), port]
        }));
      } else {
      }
    } catch (error) {
      // Handle specific error cases with user-friendly messages
      if (error.name === 'NotFoundError') {
        // Don't show an error for user cancellation - this is expected behavior
        return;
      } else if (error.name === 'SecurityError' || error.name === 'NotAllowedError') {
        alert('Permission to access serial ports was denied. Please ensure:\n\n1. You are using Chrome or Edge browser\n2. The site is running via HTTPS or localhost\n3. Try clicking the port selection again\n4. Check for any permission dialogs that might be hidden');
      } else if (error.name === 'NotSupportedError') {
        alert('Web Serial API is not supported in this browser. Please use Chrome or Edge browser.');
      } else {
        alert(`Unexpected error: ${error.message || 'Unknown error occurred'}\n\nPlease try again or refresh the page.`);
      }
    }
  },

  connectToLaser: async (port) => {
    try {
      const { laserType, laserPort, laserReader: existingReader } = get();
      
      if (!laserType) {
        return;
      }

      if (laserPort || existingReader || activeLaserStreamReader) {
        console.log('[Laser] Disconnecting previous laser before reconnect...');
        await get().disconnectLaser();
        await new Promise(r => setTimeout(r, 150));
      }
      
      // Get correct config based on laser type
      let laserConfig;
      if (laserType === 'soltec-standard') {
        laserConfig = {
          baudRate: 115200,
          dataBits: 8,
          stopBits: 1,
          parity: 'none',
          flowControl: 'none'
        };
        console.log('[Laser] Connecting soltec-standard at 115200 baud');
      } else {
        // soltec-legacy: 19200 baud, 7E1
        laserConfig = {
          baudRate: 19200,
          dataBits: 7,
          stopBits: 1,
          parity: 'even',
          flowControl: 'none'
        };
        console.log('[Laser] Connecting soltec-legacy at 19200 baud');
      }
      
      // Create a new laser reader for this connection
      const laserReader = new LaserReader();
      laserReader.setLaserType(laserType);
      // Fix 2: Sync amplitudeFilterEnabled from store to driver immediately after creation
      const { amplitudeFilterEnabled } = get();
      laserReader.setAmplitudeFilterEnabled(amplitudeFilterEnabled);
      // Fix 1: Do NOT register a callback that calls appendToLaserOutput("Received: ...")
      // The log is already written by processLdm71Data / processAsciiData in the driver.
      // Registering it here would cause every measurement to appear twice in the log.
      
      // Set the port in state immediately
      set({ laserPort: port, laserReader, laserConfig });

      // Audit: hardware connected
      try {
        const user = getCurrentUser();
        if (user) auditLog.hardwareConnect(user.uid, user.email || '', 'laser', laserType || 'laser', true, 'serial');
      } catch (_e) {}

      // All lasers use ASCII output — 4096 bytes is sufficient for all types
      const bufferSize = 4096;
      const openOptions = {
        baudRate: laserConfig.baudRate,
        dataBits: laserConfig.dataBits,
        stopBits: laserConfig.stopBits,
        parity: laserConfig.parity,
        flowControl: laserConfig.flowControl,
        bufferSize: bufferSize
      };
      console.log(`[Laser] Opening port:`, JSON.stringify(openOptions));
      
      // Check if port is already open
      if (port.readable) {
        console.log('[Laser] Port already open, using existing connection');
      } else {
        await port.open(openOptions);
        console.log('[Laser] Port opened successfully');
      }
      
      console.log('[Laser] Port state - readable:', !!port.readable, 'writable:', !!port.writable);

      // Start reading data with auto-restart on errors
      laserReadLoopRunning = true;
      let consecutiveErrors = 0;
      const MAX_CONSECUTIVE_ERRORS = 5;
      
      const readData = async () => {
        console.log('[Laser] Starting read loop, port.readable:', !!port.readable);
        while (laserReadLoopRunning && port.readable) {
          try {
            if (port.readable.locked) {
              console.warn('[Laser] Stream still locked, waiting...');
              await new Promise(r => setTimeout(r, 200));
              if (port.readable.locked) {
                console.error('[Laser] Stream still locked after wait, aborting');
                break;
              }
            }
            console.log('[Laser] Acquiring reader...');
            activeLaserStreamReader = port.readable.getReader();
            console.log('[Laser] Reader acquired, entering read loop');
            consecutiveErrors = 0;
            
            let readCount = 0;
            while (port.readable && laserReadLoopRunning && activeLaserStreamReader) {
              const { value, done } = await activeLaserStreamReader.read();
              if (done) {
                console.log('[Laser] Read loop: stream done signal received');
                break;
              }
              
              readCount++;
              if (value && value.length > 0) {
                if (readCount <= 5) {
                  console.log(`[Laser] Read #${readCount}: ${value.length} bytes`);
                }
                laserReader.processData(value);
              }
            }
            
            if (activeLaserStreamReader) {
              activeLaserStreamReader.releaseLock();
              activeLaserStreamReader = null;
            }
            
          } catch (error) {
            consecutiveErrors++;
            const errorMsg = error instanceof Error ? error.message : String(error);
            console.warn(`[Laser] Read error (${consecutiveErrors}/${MAX_CONSECUTIVE_ERRORS}):`, errorMsg);
            appendToLaserOutput(`[ERROR] Read error: ${errorMsg}`);
            
            if (activeLaserStreamReader) {
              try {
                activeLaserStreamReader.releaseLock();
              } catch (_e) {}
              activeLaserStreamReader = null;
            }
            
            if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
              console.error('[Laser] Too many consecutive read errors, stopping read loop');
              appendToLaserOutput('[ERROR] Read loop stopped - too many errors. Try reconnecting.');
              laserReadLoopRunning = false;
              break;
            }
            
            // Brief delay before retry to prevent tight error loops
            await new Promise(resolve => setTimeout(resolve, 100));
            console.log('[Laser] Restarting read loop after error...');
          }
        }
        console.log('[Laser] Read loop exited');
      };
      
      // Start the read loop
      readData();
    } catch (error) {
      set({ laserPort: null, laserReader: null });
      throw new Error(`Failed to connect to laser: ${error.message}`);
    }
  },

  connectToGPS: async (port) => {
    try {
      const { laserType } = get();
      
      const gpsConfig = {
        baudRate: 4800,
        dataBits: 8,
        stopBits: 1,
        parity: 'none',
        flowControl: 'none'
      };
      
      console.log(`[GPS] Using ${gpsConfig.baudRate} baud`);
      
      // Create a new GPS reader for this connection
      const gpsReader = new GPSReader();
      
      // Set up GPS data callback
      gpsReader.registerCallback((data: string) => {
        // Process NMEA sentence directly
        useGPSStore.getState().parseNMEA(data);
      });
      
      // Open the port FIRST before setting state (so button stays clickable if it fails)
      if (!port.readable) {
        console.log('[GPS] Opening port with config:', JSON.stringify(gpsConfig));
        try {
          await port.open(gpsConfig);
          console.log('[GPS] Port opened successfully');
        } catch (openErr: unknown) {
          const errName = openErr instanceof DOMException ? openErr.name : '';
          const errMsg = openErr instanceof Error ? openErr.message : String(openErr);
          if (errName === 'InvalidStateError' || errName === 'NetworkError' || errMsg.toLowerCase().includes('already open') || errMsg.toLowerCase().includes('in use')) {
            toast.error('COM port is in use by another application. Close it and retry.');
          } else {
            toast.error(`Failed to open GPS port: ${errMsg}`);
          }
          throw openErr;
        }
      } else {
        console.log('[GPS] Port already open');
      }
      
      console.log('[GPS] Port state - readable:', !!port.readable, 'writable:', !!port.writable);
      
      // Set the port in state ONLY after port.open() succeeds
      set({ gpsPort: port, gpsReader, gpsConfig });

      // Audit: GPS hardware connected
      try {
        const user = getCurrentUser();
        if (user) {
          auditLog.hardwareConnect(user.uid, user.email || '', 'gps', 'Serial GPS', true, 'serial');
          auditLog.gpsSession(user.uid, user.email || '', 'serial', true);
        }
      } catch (_e) {}

      // Start reading data
      const readData = async () => {
        console.log('[GPS] Starting read loop');
        try {
          const reader = port.readable!.getReader();
          console.log('[GPS] Reader acquired');
          let readCount = 0;
          while (port.readable) {
            const { value, done } = await reader.read();
            if (done) {
              console.log('[GPS] Read loop: stream done');
              break;
            }
            
            readCount++;
            if (value && value.length > 0) {
              if (readCount <= 5) {
                console.log(`[GPS] Read #${readCount}: ${value.length} bytes`);
              }
              // Process data through GPS reader
              gpsReader.processData(value);
            }
          }
          reader.releaseLock();
        } catch (error) {
          console.error('[GPS] Read error:', error);
        }
      };
      
      // Start the read loop
      readData();
      
      // Update GPS store
      useGPSStore.getState().setConnected(true);
      // DON'T stop browser GPS here - let it keep running until serial GPS has a valid fix
      // The GPS store will automatically switch sources when serial GPS gets coordinates
    } catch (error) {
      set({ gpsPort: null, gpsReader: null });
      useGPSStore.getState().setConnected(false);
      
      // If failsafe is enabled, try to start browser GPS
      const gpsStore = useGPSStore.getState();
      if (gpsStore.failsafeEnabled) {
        gpsStore.initBrowserGPS();
      }
      throw new Error(`Failed to connect to GPS: ${error.message}`);
    }
  },

  resetSerialConnection: async () => {
    set({ resetStatus: SerialResetStatus.RESETTING });
    
    try {
      // Disconnect both devices
      const { disconnectLaser, disconnectGPS, laserPort, gpsPort } = get();
      
      if (laserPort) {
        await disconnectLaser();
      }
      
      if (gpsPort) {
        await disconnectGPS();
      }
      
      // Force browser to forget all ports
      const ports = await navigator.serial.getPorts();
      for (const port of ports) {
        try {
          if (port.readable || port.writable) {
            await port.close();
          }
          
          // Some browsers support the forget method
          if ('forget' in port) {
            await (port as any).forget();
          }
        } catch (error) {
        }
      }
      
      // Clear internal state
      set({ 
        availablePorts: [],
        laserPort: null,
        gpsPort: null,
        serialReader: null,
        resetStatus: SerialResetStatus.SUCCESS
      });
      
      // Auto-clear success message after 5 seconds
      setTimeout(() => {
        set({ resetStatus: SerialResetStatus.IDLE });
      }, 5000);
      
    } catch (error) {
      set({ resetStatus: SerialResetStatus.ERROR });
      
      // Auto-clear error message after 5 seconds
      setTimeout(() => {
        set({ resetStatus: SerialResetStatus.IDLE });
      }, 5000);
    }
  },

  disconnectLaser: async () => {
    try {
      const { laserPort, laserReader, laserType } = get();
      
      laserReadLoopRunning = false;
      
      if (laserReader) {
        laserReader.clearCallbacks();
      }
      
      if (activeLaserStreamReader) {
        try {
          await activeLaserStreamReader.cancel();
          activeLaserStreamReader.releaseLock();
        } catch (_e) {}
        activeLaserStreamReader = null;
      }
      
      if (laserPort) {
        try {
          if (laserType === 'soltec-standard' && laserPort.writable) {
            try {
              const writer = laserPort.writable.getWriter();
              const stopCmd = new Uint8Array([0x1B]);
              await writer.write(stopCmd);
              console.log('[Laser] Stop command (ESC) sent');
              writer.releaseLock();
            } catch (e) {
              console.warn('[Laser] Failed to send stop command:', e);
            }
          }
          
          await laserPort.close();
        } catch (_error) {
        }
      }
    } catch (_error) {
    }

    // Audit: hardware disconnected
    try {
      const user = getCurrentUser();
      const { laserType } = get();
      if (user) auditLog.hardwareConnect(user.uid, user.email || '', 'laser', laserType || 'laser', false, 'serial');
    } catch (_e) {}

    // Fix 3: Reset dispatch throttle so immediate post-reconnect events are sent
    lastDispatchTime = 0;
    set({ laserPort: null, laserReader: null });
  },

  disconnectGPS: async () => {
    try {
      const { gpsPort, gpsReader } = get();
      
      if (gpsReader) {
        gpsReader.clearCallbacks();
      }
      
      if (gpsPort) {
        try {
          if (gpsPort.readable) {
            const reader = gpsPort.readable.getReader();
            await reader.cancel();
            reader.releaseLock();
          }
          if (gpsPort.writable) {
            const writer = gpsPort.writable.getWriter();
            await writer.close();
            writer.releaseLock();
          }
          await gpsPort.close();
        } catch (error) {
        }
      }
    } catch (error) {
    }

    // Audit: GPS hardware disconnected
    try {
      const user = getCurrentUser();
      if (user) {
        auditLog.hardwareConnect(user.uid, user.email || '', 'gps', 'Serial GPS', false, 'serial');
        auditLog.gpsSession(user.uid, user.email || '', 'serial', false);
      }
    } catch (_e) {}

    set({ gpsPort: null, gpsReader: null });
    useGPSStore.getState().setConnected(false);
  },

  setLaserConfig: (config) => {
    set((state) => ({
      laserConfig: { ...state.laserConfig, ...config }
    }));
  },

  setGPSConfig: (config) => {
    const newConfig = {
      baudRate: 4800,
      dataBits: 8,
      stopBits: 1,
      parity: 'none',
      flowControl: 'none',
      ...config
    };
    
    set((state) => ({
      gpsConfig: newConfig
    }));
    
    // Save GPS config to localStorage for persistence
    try {
      localStorage.setItem('gps-config', JSON.stringify(newConfig));
    } catch (error) {
    }
  },

  setLaserType: (type) => {
    const migratedType = migrateLaserType(type);
    let config;
    if (migratedType === 'soltec-standard') {
      config = {
        baudRate: 115200,
        dataBits: 8,
        stopBits: 1,
        parity: 'none',
        flowControl: 'none'
      };
    } else {
      config = {
        baudRate: 19200,
        dataBits: 7,
        stopBits: 1,
        parity: 'even',
        flowControl: 'none'
      };
    }
    
    const { laserReader } = get();
    if (laserReader) {
      laserReader.setLaserType(migratedType);
    }
    
    saveSetting('laser', 'laserType', migratedType);
    localStorage.setItem('laserType', migratedType);
    localStorage.setItem('laserConfig', JSON.stringify(config));
    
    set({ 
      laserType: migratedType,
      laserConfig: config
    });
  },

  setAmplitudeFilterEnabled: (enabled) => {
    localStorage.setItem('amplitudeFilterEnabled', String(enabled));
    set({ amplitudeFilterEnabled: enabled });
    const { laserReader } = get();
    if (laserReader) {
      laserReader.setAmplitudeFilterEnabled(enabled);
    }
  },

  setMeasuringMode: (mode) => {
    set({ measuringMode: mode });
  },

  startTracking: async () => {
    const { laserType } = get();
    const config = LASER_CONFIGS[laserType];
    if (!config) {
      console.warn('[Laser] No config found for laser type:', laserType);
      return;
    }
    const command = config.commands.continuousMeasure;
    console.log('[Laser] Starting continuous mode with command:', JSON.stringify(command));
    await get().sendLaserCommand(command);
  },

  stopTracking: async () => {
    const { laserType } = get();
    const config = LASER_CONFIGS[laserType];
    if (!config) {
      return;
    }
    const command = config.commands.stop;
    console.log('[Laser] Stopping with command:', JSON.stringify(command));
    await get().sendLaserCommand(command);
  },

  startBufferTracking: async () => {
    const { bufferSamplingTime } = get();
    set({ isBufferTracking: true, bufferMeasurements: [] });

    const trackBuffer = async () => {
      if (!get().isBufferTracking) return;

      await get().singleMeasure();

      setTimeout(() => {
        if (get().isBufferTracking) {
          trackBuffer();
        }
      }, bufferSamplingTime);
    };

    trackBuffer();
  },

  stopBufferTracking: async () => {
    set({ isBufferTracking: false });
  },

  setBufferSamplingTime: (time) => {
    set({ bufferSamplingTime: time });
  },

  clearBuffer: () => {
    set({ bufferMeasurements: [] });
  },

  sendLaserCommand: async (command) => {
    const { laserPort } = get();
    if (!laserPort) return;
    const { laserType } = get();

    appendToLaserOutput(`Sent: ${command}`);

    try {
      const writer = laserPort.writable.getWriter();
      const encoder = new TextEncoder();
      
      let commandWithTerminator = command;
      if (laserType === 'soltec-standard') {
        // Standard commands already include \r
        commandWithTerminator = command;
      } else {
        // Legacy SolTec needs \r\n
        if (!command.endsWith('\r\n') && !command.endsWith('\r')) {
          commandWithTerminator = command + '\r\n';
        }
      }
      
      console.log('[Laser] Sending command:', JSON.stringify(commandWithTerminator), 'bytes:', encoder.encode(commandWithTerminator).length);
      const data = encoder.encode(commandWithTerminator);
      await writer.write(data);
      writer.releaseLock();
    } catch (error) {
      appendToLaserOutput(`Error: Failed to send command "${command}" - ${error.message}`);
    }
  },

  sendGPSCommand: async (command) => {
    const { gpsPort } = get();
    if (!gpsPort) return;

    try {
      const writer = gpsPort.writable.getWriter();
      const encoder = new TextEncoder();
      const data = encoder.encode(command + '\r\n');
      await writer.write(data);
      writer.releaseLock();
    } catch (error) {
    }
  },

  toggleRedDot: async (on) => {
    const { laserType } = get();
    const config = LASER_CONFIGS[laserType];
    if (!config) {
      return;
    }
    const commands = config.commands;
    await get().sendLaserCommand(on ? commands.laserOn : commands.laserOff);
  },

  getTemperature: async () => {
    const { laserType } = get();
    const config = LASER_CONFIGS[laserType];
    if (!config) {
      return;
    }
    const commands = config.commands;
    await get().sendLaserCommand(commands.temperature);
  },

  singleMeasure: async () => {
    const { laserType } = get();
    const config = LASER_CONFIGS[laserType];
    if (!config) {
      return;
    }
    const commands = config.commands;
    const command = commands.singleMeasure;
    await get().sendLaserCommand(command);
  },

  stopLaser: async () => {
    const { laserType } = get();
    const config = LASER_CONFIGS[laserType];
    if (!config) {
      return;
    }
    const commands = config.commands;
    await get().sendLaserCommand(commands.stop);
  },

  resetMinDistance: () => {
    // This function is called from the UI but the actual reset logic
    // is handled in the MeasurementCards component
  },

  setLastLaserData: (data) => {
    // PERF FIX: Throttle store updates to 10fps max
    // Laser fires at ~10-20Hz — updating 16 React subscribers at full rate causes lag
    // Counter detection still processes every reading via getLaserLog() (not store)
    const now = Date.now();
    const shouldUpdate = now - lastStoreUpdateTime >= STORE_UPDATE_THROTTLE_MS;

    if (!shouldUpdate) {
      // Laser log is already populated by serialLaserReader.ts directly
      // No need to append here — just skip the Zustand set() to avoid re-renders
      return;
    }
    lastStoreUpdateTime = now;

    // Filter out GPS NMEA data that might be mixed in
    if (typeof data === 'string' && (
        data.startsWith('$GP') || data.startsWith('$GN') || data.startsWith('$GL') ||
        data.includes('GPGGA') || data.includes('GPRMC') || data.includes('GPGSV') ||
        /,\d+\.\d+,[NS],\d+\.\d+,[EW],/.test(data)
    )) {
      return;
    }

    const dispatchUpdate = (measurement: string) => {
      // Fix 4: Throttle dispatchEvent only — setLastLaserData always runs immediately
      const now = Date.now();
      if (now - lastDispatchTime >= DISPATCH_THROTTLE_MS) {
        lastDispatchTime = now;
        window.dispatchEvent(new CustomEvent('laser-measurement-update', {
          detail: { measurement }
        }));
      }
    };

    // Fix 2: Single atomic set() per code path
    if (data === 'DE02' || data === 'De02' || data === '--' || 
        (typeof data === 'string' && (data.includes('DE02') || data.includes('De02')))) {
      set((state) => ({
        lastMeasurement: '--',
        currentMeasurement: '--',
        measurementSampleId: state.measurementSampleId + 1
      }));
      dispatchUpdate('--');
      return;
    }
    
    if (data === undefined || data === null) {
      set((state) => ({
        lastMeasurement: '--',
        currentMeasurement: '--',
        measurementSampleId: state.measurementSampleId + 1
      }));
      dispatchUpdate('--');
      return;
    }

    if (!isNaN(parseFloat(data))) {
      try {
        const measurementString = parseFloat(data).toString();
        set((state) => ({
          lastMeasurement: measurementString,
          currentMeasurement: measurementString,
          measurementSampleId: state.measurementSampleId + 1
        }));
        dispatchUpdate(measurementString);
      } catch (_error) {
        set((state) => ({
          lastMeasurement: '--',
          currentMeasurement: '--',
          measurementSampleId: state.measurementSampleId + 1
        }));
        dispatchUpdate('--');
      }
    } else {
      set((state) => ({
        lastMeasurement: '--',
        currentMeasurement: '--',
        measurementSampleId: state.measurementSampleId + 1
      }));
      dispatchUpdate('--');
    }
  }
}));