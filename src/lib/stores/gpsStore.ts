import { create } from 'zustand';
import { logger } from '@/lib/utils/logger';
import { getCurrentUser } from '@/lib/firebase';
import { auditLog } from '@/lib/auditLog';

export interface GsvSatelliteInfo {
  prn: number;
  elevation: number | undefined;
  azimuth: number | undefined;
  snr: number | undefined;
}

export interface GPSData {
  time: string;
  latitude: number;
  longitude: number;
  altitude: number;
  speed: number;
  course: number;
  satellites: number;
  fixQuality: 'No Fix' | 'GPS Fix' | 'GPS Fix (2D)' | 'DGPS Fix' | 'RTK Float' | 'RTK Fixed';
  hdop: number;
  lastUpdate: number;
  rawNMEA: string[];
  source: 'serial' | 'browser' | 'duro' | 'bluetooth' | 'none';
  // Extended Duro IMU data
  imu?: {
    heading: number | null;
    roll: number | null;
    pitch: number | null;
    heaveRate: number | null;
    rollAccuracy?: number | null;
    pitchAccuracy?: number | null;
    headingAccuracy?: number | null;
  };
  // Extended velocity data (from RMC)
  speedKph?: number;
  heading?: number;
  // DOP values from GSA
  pdop?: number | null;
  vdop?: number | null;
  activeSatellitePrns?: number[];
  gsaMode?: number | null;
  // Per-constellation active satellite counts from GSA
  constellations?: Record<string, { name: string; activePrns: number[] }>;
  // Satellites in view from GSV
  satellitesInView?: number;
  satelliteList?: GsvSatelliteInfo[];
}

interface GPSStore {
  connected: boolean;
  data: GPSData;
  failsafeEnabled: boolean;
  serialDataTimeout: number;
  lastSerialDataTime: number;
  hasGPSPermission: boolean;
  setConnected: (connected: boolean) => void;
  updateData: (data: Partial<GPSData>) => void;
  addNMEASentence: (sentence: string) => void;
  initBrowserGPS: () => Promise<void>;
  stopBrowserGPS: () => void;
  parseNMEA: (data: string) => void;
  setFailsafeEnabled: (enabled: boolean) => void;
  checkSerialTimeout: () => void;
  setHasGPSPermission: (hasPermission: boolean) => void;
}

const DEFAULT_GPS_DATA: GPSData = {
  time: '--:--:--',
  latitude: 0,
  longitude: 0,
  altitude: 0,
  speed: 0,
  course: 0,
  satellites: 0,
  fixQuality: 'No Fix',
  hdop: 0,
  lastUpdate: 0,
  rawNMEA: [],
  source: 'none'
};

let watchId: number | null = null;
// Maximum number of retry attempts for browser GPS
const MAX_GPS_RETRY_ATTEMPTS = 3;
let retryAttempts = 0;
// Flag to prevent multiple simultaneous browser GPS initialization attempts
let browserGPSInitializing = false;

export const useGPSStore = create<GPSStore>((set, get) => ({
  connected: false,
  data: DEFAULT_GPS_DATA,
  failsafeEnabled: false, // Disable failsafe by default - user must explicitly enable
  serialDataTimeout: 10000, // 10 seconds timeout
  lastSerialDataTime: 0,
  hasGPSPermission: false, // Don't assume GPS permission

  setConnected: (connected) => {
    set({ connected });
    if (!connected) {
      set({ data: { ...DEFAULT_GPS_DATA, source: 'none' } });
    }
  },

  updateData: (newData) => {
    set((state) => {
      // Update last serial data time when we receive serial GPS data
      if (newData.source === 'serial') {
        state.lastSerialDataTime = Date.now();
      }
      
      // PRIORITY: Duro > Serial > Bluetooth > Browser
      // Higher-priority sources block lower-priority ones when actively streaming (< 5s).
      //
      // Timeout fallback (unit-level logic):
      //   - isDuroActive = true ONLY when duro lastUpdate is < 5 s old.
      //   - If Duro data goes stale (> 5 s), isDuroActive becomes false and serial GPS
      //     updates are no longer blocked — serial can take over automatically.
      //   - This prevents a locked Duro source from silently starving serial GPS updates.
      const currentSource = state.data.source;
      const newSource = newData.source;
      const TIMEOUT_MS = 5000; // 5 seconds timeout for data freshness
      const dataAge = Date.now() - state.data.lastUpdate;
      const isDuroActive = currentSource === 'duro' && dataAge < TIMEOUT_MS;
      const isSerialActive = currentSource === 'serial' && dataAge < TIMEOUT_MS;
      
      if (isDuroActive && (newSource === 'serial' || newSource === 'bluetooth')) {
        // Duro is actively receiving data - ignore lower-priority sources but track serial time
        return {
          ...state,
          lastSerialDataTime: newSource === 'serial' ? Date.now() : state.lastSerialDataTime
        };
      }

      if (isSerialActive && newSource === 'bluetooth') {
        // Serial is actively receiving data - ignore Bluetooth GPS
        return { ...state };
      }
      
      const updated = {
        ...state.data,
        ...newData,
        lastUpdate: Date.now(),
      };

      // Reduced logging spam
      // console.log('🛰️ GPS Store Updated:', updated);

      return {
        data: updated,
        connected: true, // Update connected state when we receive data
        lastSerialDataTime: newData.source === 'serial' ? Date.now() : state.lastSerialDataTime
      };
    });
  },

  addNMEASentence: (sentence) => {
    if (!sentence || !sentence.startsWith('$')) {
      return;
    }

    set((state) => ({
      data: {
        ...state.data,
        rawNMEA: [...state.data.rawNMEA.slice(-19), sentence]
      },
      lastSerialDataTime: Date.now()
    }));

    // Process the sentence (only called from USB serial path)
    get().parseNMEA(sentence);
  },

  setHasGPSPermission: (hasPermission) => {
    set({ hasGPSPermission: hasPermission });
    localStorage.setItem('gps_permission_granted', hasPermission.toString());
    logger.log('🛰️ GPS permission status updated and saved:', hasPermission);
    
    // Only try to start browser GPS if permission was just granted AND we're not already using browser GPS
    // (avoid recursion when called from initBrowserGPS)
    if (hasPermission && get().failsafeEnabled && get().data.source !== 'browser') {
      logger.log('🛰️ GPS permission granted - starting browser GPS immediately');
      setTimeout(() => {
        get().initBrowserGPS().catch(err => {
          // Silent fail
        });
      }, 500); // Small delay to ensure state is updated
    }
  },

  setFailsafeEnabled: (enabled) => {
    set({ failsafeEnabled: enabled });
    localStorage.setItem('gps_failsafe_enabled', enabled.toString());
    
    if (enabled) {
      logger.log('🛰️ GPS failsafe enabled - will use browser GPS when serial GPS is unavailable');
      
      // Immediately start browser GPS if no serial GPS data is available
      const state = get();
      const now = Date.now();
      const timeSinceLastSerial = now - state.lastSerialDataTime;
      
      // If we have no serial GPS data or it's been too long since last update, start browser GPS immediately
      // Browser will prompt for permission if needed
      if (state.lastSerialDataTime === 0 || 
          timeSinceLastSerial > state.serialDataTimeout ||
          state.data.source === 'none' ||
          !state.connected) {
        logger.log('🛰️ No recent serial GPS data, starting browser GPS failsafe immediately');
        try {
          state.initBrowserGPS();
        } catch (error) {
          // Silent fail
        }
      }
    } else {
      logger.log('🛰️ GPS failsafe disabled - will only use serial GPS');
      // Stop browser GPS if it's running
      get().stopBrowserGPS();
    }
  },

  checkSerialTimeout: () => {
    const state = get();
    const now = Date.now();
    const timeSinceLastSerial = now - state.lastSerialDataTime;

    const HARDWARE_TIMEOUT_MS = state.serialDataTimeout;
    const dataAge = now - state.data.lastUpdate;

    // Check if any hardware GPS source (Duro, Serial, Bluetooth) is actively providing data
    const isDuroActive =
      state.data.source === 'duro' &&
      state.data.lastUpdate > 0 &&
      dataAge < HARDWARE_TIMEOUT_MS;

    const isSerialActive =
      state.lastSerialDataTime > 0 &&
      timeSinceLastSerial < HARDWARE_TIMEOUT_MS;

    const isBluetoothActive =
      state.data.source === 'bluetooth' &&
      state.data.lastUpdate > 0 &&
      dataAge < HARDWARE_TIMEOUT_MS;

    const isAnyHardwareActive = isDuroActive || isSerialActive || isBluetoothActive;
    
    // If failsafe is enabled and we need to switch to browser GPS
    if (state.failsafeEnabled) {
      // Switch to browser GPS ONLY when Duro, Serial, AND Bluetooth are all absent/timed-out
      const shouldUseBrowserGPS = (
        !isAnyHardwareActive && (
          state.lastSerialDataTime === 0 || 
          (state.lastSerialDataTime > 0 && timeSinceLastSerial > state.serialDataTimeout) ||
          state.data.source === 'none'
        )
      );
      
      if (shouldUseBrowserGPS && state.data.source !== 'browser') {
        logger.debug('🛰️ Switching to browser GPS failsafe:', {
          reason: state.lastSerialDataTime === 0 ? 'No serial data' : 
                  timeSinceLastSerial > state.serialDataTimeout ? 'Serial timeout' : 
                  'No GPS source'
        });
        
        // Switch to browser GPS as failsafe
        try {
          state.initBrowserGPS();
        } catch (error) {
          // Silent fail
        }
      }
      
      // Only switch back to serial GPS if it has a VALID fix (not just streaming data)
      // Keep using browser GPS while serial GPS is waiting for satellites
      if (state.data.source === 'browser' && 
          state.lastSerialDataTime > 0 && 
          timeSinceLastSerial < state.serialDataTimeout &&
          state.data.fixQuality !== 'No Fix' &&
          state.data.latitude !== 0 &&
          state.data.longitude !== 0) {
        logger.log('🛰️ Serial GPS fix acquired, switching back from browser GPS');
        state.stopBrowserGPS();
      }
    }
  },
  parseNMEA: (data) => {
    try {
      // Priority guard: if Duro is the active source and its data is fresh (< 5 s),
      // do not allow USB serial NMEA to overwrite any GPS fields.
      const TIMEOUT_MS = 5000;
      const currentState = get();
      const dataAge = Date.now() - currentState.data.lastUpdate;
      if (currentState.data.source === 'duro' && dataAge < TIMEOUT_MS) {
        return;
      }

      const lines = data.split('\n');
      
      for (const line of lines) {
        const trimmedLine = line.trim();
        
        if (!trimmedLine.startsWith('$')) continue;
        
        if (trimmedLine.startsWith('$GPGGA') || trimmedLine.startsWith('$GNGGA')) {
          const parts = trimmedLine.split(',');
          if (parts.length >= 10) {
            const time = parts[1] || '';
            const lat = parts[2] || '';
            const latDir = parts[3] || '';
            const lon = parts[4] || '';
            const lonDir = parts[5] || '';
            const alt = parts[9] || '';
            
            // Extract GPS status data even if no coordinates yet
            const fixQuality = parts[6] === '0' ? 'No Fix' : 
                              parts[6] === '1' ? 'GPS Fix' : 'DGPS Fix';
            const satellites = parseInt(parts[7], 10) || 0;
            const hdop = parseFloat(parts[8]) || 0;
            
            // Format time if available
            const formattedTime = time ? `${time.slice(0,2)}:${time.slice(2,4)}:${time.slice(4,6)}` : '--:--:--';
            
            // Convert coordinates only if present
            let latitude = 0;
            let longitude = 0;
            let altitude = 0;
            
            if (lat && latDir) {
              const latDeg = parseFloat(lat.substring(0, 2));
              const latMin = parseFloat(lat.substring(2));
              latitude = latDeg + (latMin / 60);
              if (latDir === 'S') latitude = -latitude;
            }
            
            if (lon && lonDir) {
              const lngDeg = parseFloat(lon.substring(0, 3));
              const lngMin = parseFloat(lon.substring(3));
              longitude = lngDeg + (lngMin / 60);
              if (lonDir === 'W') longitude = -longitude;
            }
            
            if (alt) {
              altitude = parseFloat(alt) || 0;
            }
            
            // Route through updateData so priority logic blocks this write if Duro is active.
            // IMPORTANT: Always include source:'serial' so the priority guard can properly
            // block this update when Duro is active (only updating lastSerialDataTime,
            // never refreshing Duro's lastUpdate via a source-less merge).
            const hasValidCoords = latitude !== 0 && longitude !== 0;
            const statusUpdate: Partial<GPSData> = {
              time: formattedTime,
              satellites,
              fixQuality,
              hdop,
              source: 'serial', // always tag as serial so priority guard works correctly
            };
            if (hasValidCoords) {
              statusUpdate.latitude = latitude;
              statusUpdate.longitude = longitude;
              if (altitude !== 0) statusUpdate.altitude = altitude;
            }
            get().updateData(statusUpdate);
          }
        } else if (trimmedLine.startsWith('$GPRMC') || trimmedLine.startsWith('$GNRMC')) {
          const parts = trimmedLine.split(',');
          if (parts.length >= 9) {
            const speed = parts[7] ? parseFloat(parts[7]) * 1.852 : 0; // Convert knots to km/h
            const course = parseFloat(parts[8]) || 0;
            
            // Route through updateData so priority logic blocks this write if Duro is active
            get().updateData({
              speed,
              course,
              source: 'serial'
            });
          }
        }
      }
    } catch (error) {
    }
  },

  initBrowserGPS: async () => {
    if (!navigator.geolocation) {
      return;
    }

    // Prevent multiple simultaneous initialization attempts
    if (browserGPSInitializing) {
      logger.debug('🛰️ Browser GPS initialization already in progress, skipping...');
      return;
    }

    browserGPSInitializing = true;

    // Reset retry counter when we're explicitly initializing browser GPS
    retryAttempts = 0;

    try {
      // Check for permissions first
      try {
        const permissionStatus = await navigator.permissions.query({ name: 'geolocation' });
        
        if (permissionStatus.state === 'denied') {
          browserGPSInitializing = false;
          throw new Error('Geolocation permission denied');
        }
      } catch (permError) {
        // Continue anyway, the permission request will happen when we call getCurrentPosition
      }

      logger.debug('🌍 Attempting to get browser GPS position...');
      
      // First try to get a single position with a reasonable timeout
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error('GPS timeout - position unavailable'));
        }, 60000); // 60 seconds timeout

        navigator.geolocation.getCurrentPosition(
          (position) => {
            clearTimeout(timeoutId);
            resolve(position);
          },
          (error) => {
            clearTimeout(timeoutId);
            reject(error);
          },
          {
            enableHighAccuracy: true,
            timeout: 60000, // 60 seconds timeout
            maximumAge: 0
          }
        );
      });

      // Successfully got position - update permission state
      logger.log('✅ Browser GPS position obtained successfully:', {
        lat: pos.coords.latitude,
        lon: pos.coords.longitude,
        accuracy: pos.coords.accuracy
      });
      browserGPSInitializing = false;
      get().setHasGPSPermission(true);

      // Audit: browser GPS session started
      try { const u = getCurrentUser(); if (u) auditLog.gpsSession(u.uid, u.email || '', 'browser', true); } catch (_e) {}
      
      // Helper: returns true if a hardware source (Duro/Serial/Bluetooth) is currently active
      const isHardwareGpsActive = (): boolean => {
        const s = get();
        const now = Date.now();
        const age = now - s.data.lastUpdate;
        const TIMEOUT = s.serialDataTimeout;
        if (s.data.source === 'duro' && s.data.lastUpdate > 0 && age < TIMEOUT) return true;
        if (s.data.source === 'bluetooth' && s.data.lastUpdate > 0 && age < TIMEOUT) return true;
        if (s.lastSerialDataTime > 0 && (now - s.lastSerialDataTime) < TIMEOUT) return true;
        return false;
      };

      // Update with initial position (only if no hardware source is active)
      if (!isHardwareGpsActive()) {
        set((state) => ({
          connected: true,
          data: {
            ...state.data,
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            altitude: pos.coords.altitude || 0,
            speed: pos.coords.speed || 0,
            course: pos.coords.heading || 0,
            hdop: pos.coords.accuracy / 5, // Rough conversion from accuracy to HDOP
            fixQuality: 'GPS Fix',
            source: 'browser',
            lastUpdate: Date.now(),
            time: new Date().toTimeString().split(' ')[0]
          }
        }));
      }

      // Stop any existing watch
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }

      // Then start watching position
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          // Reset retry counter on successful position
          retryAttempts = 0;

          // Don't overwrite hardware GPS sources with browser fallback
          if (isHardwareGpsActive()) return;
          
          set((state) => ({
            connected: true,
            data: {
              ...state.data,
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              altitude: pos.coords.altitude || 0,
              speed: pos.coords.speed || 0,
              course: pos.coords.heading || 0,
              hdop: pos.coords.accuracy / 5,
              lastUpdate: Date.now(),
              time: new Date().toTimeString().split(' ')[0],
              source: 'browser'
            }
          }));
        },
        (error) => {
          // Check if we've reached the maximum retry attempts
          if (++retryAttempts >= MAX_GPS_RETRY_ATTEMPTS) {
            set({
              connected: false,
              data: { ...DEFAULT_GPS_DATA, source: 'none' }
            });
            
            if (watchId !== null) {
              navigator.geolocation.clearWatch(watchId);
              watchId = null;
            }
            return;
          }
          
          if (error.code === 1) { // PERMISSION_DENIED
            set({ connected: false });
            // Stop trying if permission denied
            if (watchId !== null) {
              navigator.geolocation.clearWatch(watchId);
              watchId = null;
            }
          } else if (error.code === 2) { // POSITION_UNAVAILABLE
            // Keep trying but update the UI to show degraded service
            set((state) => ({
              data: { 
                ...state.data,
                fixQuality: 'No Fix',
                lastUpdate: Date.now()
              }
            }));
          }
        },
        {
          enableHighAccuracy: true,
          timeout: 120000, // 120 seconds
          maximumAge: 5000  // Accept positions up to 5 seconds old
        }
      );
    } catch (error) {
      browserGPSInitializing = false;
      
      // Set disconnected state immediately on initialization failure
      set({
        connected: false,
        data: { ...DEFAULT_GPS_DATA, source: 'none' }
      });
    }
  },

  stopBrowserGPS: () => {
    if (watchId !== null) {
      logger.log('Stopping browser GPS tracking');
      navigator.geolocation.clearWatch(watchId);
      watchId = null;
      // Audit: browser GPS session stopped
      try { const u = getCurrentUser(); if (u) auditLog.gpsSession(u.uid, u.email || '', 'browser', false); } catch (_e) {}
    }
    
    // Reset initialization flag
    browserGPSInitializing = false;
    
    // Only reset source if it's currently browser
    set((state) => {
      if (state.data.source === 'browser') {
        return {
          connected: false,
          data: { ...DEFAULT_GPS_DATA, source: 'none' }
        };
      }
      return state;
    });
  }
}));

// Load failsafe setting from localStorage
const savedFailsafe = localStorage.getItem('gps_failsafe_enabled');
if (savedFailsafe !== null) {
  useGPSStore.getState().setFailsafeEnabled(savedFailsafe === 'true');
}

// Load GPS permission setting from localStorage
const savedPermission = localStorage.getItem('gps_permission_granted');
if (savedPermission === 'true') {
  logger.log('🛰️ Loading saved GPS permission - permission was previously granted');
  useGPSStore.setState({ hasGPSPermission: true });
  // Don't call setHasGPSPermission here as it would trigger immediate GPS start
  // Let checkSerialTimeout handle it
}

// Set up periodic check for serial GPS timeout
setInterval(() => {
  useGPSStore.getState().checkSerialTimeout();
}, 5000); // Check every 5 seconds