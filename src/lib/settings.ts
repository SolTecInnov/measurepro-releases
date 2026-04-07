// Disabled IndexedDB imports - using localStorage instead due to corruption
// import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { create } from 'zustand';
import type { SerialConfig } from './serial';
import type { TAppCfg } from './overhead/config.schema';
import { getCurrentUser } from './firebase';
import { auditLog } from './auditLog';

// interface SettingsDB extends DBSchema {
//   settings: {
//     key: string;
//     value: {
//       id: string;
//       category: string;
//       value: any;
//       updatedAt: string;
//     };
//     indexes: { 'by-category': string };
//   };
// }

// const DB_NAME = 'settings-db';
// const STORE_NAME = 'settings';

// Disabled: IndexedDB corrupted, using localStorage instead
// let db: Promise<IDBPDatabase<SettingsDB>>;

// const initDB = () => {
//   if (!db) {
//     db = openDB<SettingsDB>(DB_NAME, 1, {
//       upgrade(db) {
//         const store = db.createObjectStore(STORE_NAME, {
//           keyPath: 'id',
//         });
//         store.createIndex('by-category', 'category');
//       },
//     });
//   }
//   return db;
// };

// Database sync state
let currentUserId: string | null = null;
let isSyncingFromDb = false;
let pendingDbSync: ReturnType<typeof setTimeout> | null = null;
let hasPendingOfflineChanges = false;

// Retry sync on connectivity restore
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    if (hasPendingOfflineChanges && currentUserId) {
      console.log('[Settings] Connectivity restored — flushing pending settings sync');
      hasPendingOfflineChanges = false;
      saveSettingsToDatabase(currentUserId).catch((err) => {
        console.error('[Settings] Reconnect sync failed:', err);
        hasPendingOfflineChanges = true;
      });
    }
  });
}

// Fetch settings from database API
export const fetchSettingsFromDatabase = async (userId: string): Promise<any | null> => {
  try {
    const response = await fetch(`/api/user-settings/${userId}`, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      if (response.status === 404) {
        return null; // No settings found in DB
      }
      throw new Error(`Failed to fetch settings: ${response.statusText}`);
    }
    
    const data = await response.json();
    // API returns { success, settings } - extract the settings object
    return data.settings || null;
  } catch (error) {
    console.error('[Settings] Failed to fetch from database:', error);
    return null;
  }
};

// Build the full settings payload from current Zustand store state.
// Used by both saveSettingsToDatabase and the beforeunload keepalive flush.
const buildSettingsPayload = (userId: string) => {
  const state = useSettingsStore.getState();
  const bufferDetectionConfig = (() => {
    try {
      const v = localStorage.getItem('buffer_detection_configs');
      return v ? JSON.parse(v) : null;
    } catch { return null; }
  })();
  return {
    id: userId,
    displaySettings: state.displaySettings,
    laserSettings: state.laserSettings,
    gpsSettings: state.gpsSettings,
    cameraSettings: state.cameraSettings,
    mapSettings: state.mapSettings,
    loggingSettings: state.loggingSettings,
    alertSettings: state.alertSettings,
    aiSettings: state.aiSettings,
    convoySettings: state.convoySettings,
    developerSettings: state.developerSettings,
    profileSettings: state.profileSettings,
    liveSharingSettings: state.liveSharingSettings,
    aiAssistantSettings: state.aiAssistantSettings,
    lateralLaserSettings: state.lateralLaserSettings,
    rearOverhangSettings: state.rearOverhangSettings,
    overheadDetectionConfig: state.overheadDetectionConfig,
    bufferDetectionConfig,
    layoutConfig: state.layoutConfig,
    uiSettings: state.uiSettings,
  };
};

// Save all settings to database API (debounced)
export const saveSettingsToDatabase = async (userId: string): Promise<boolean> => {
  try {
    const settingsPayload = buildSettingsPayload(userId);
    
    const response = await fetch(`/api/user-settings/${userId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(settingsPayload),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to save settings: ${response.statusText}`);
    }
    
    hasPendingOfflineChanges = false;
    console.log('[Settings] Saved to database successfully');
    return true;
  } catch (error) {
    console.error('[Settings] Failed to save to database:', error);
    // Mark dirty so the online listener will retry when connectivity returns
    hasPendingOfflineChanges = true;
    return false;
  }
};

// Debounced database sync (waits 2 seconds after last change)
export const scheduleDatabaseSync = () => {
  if (!currentUserId || isSyncingFromDb) return;

  // Track that there are unsaved changes even before the debounce fires
  hasPendingOfflineChanges = true;
  
  if (pendingDbSync) {
    clearTimeout(pendingDbSync);
  }
  
  pendingDbSync = setTimeout(() => {
    if (currentUserId) {
      saveSettingsToDatabase(currentUserId);
    }
    pendingDbSync = null;
  }, 2000);
};

// Initialize settings from database on login
export const initializeSettingsFromDatabase = async (userId: string): Promise<void> => {
  currentUserId = userId;
  isSyncingFromDb = true;
  
  try {
    const dbSettings = await fetchSettingsFromDatabase(userId);
    
    if (dbSettings && typeof dbSettings === 'object') {
      // Apply database settings to store using direct setState to avoid triggering saves
      // Only apply non-null/undefined values to preserve defaults
      const updates: Partial<Record<string, any>> = {};
      
      if (dbSettings.displaySettings && typeof dbSettings.displaySettings === 'object') {
        updates.displaySettings = dbSettings.displaySettings;
      }
      if (dbSettings.laserSettings && typeof dbSettings.laserSettings === 'object') {
        updates.laserSettings = dbSettings.laserSettings;
      }
      if (dbSettings.gpsSettings && typeof dbSettings.gpsSettings === 'object') {
        updates.gpsSettings = dbSettings.gpsSettings;
      }
      if (dbSettings.cameraSettings && typeof dbSettings.cameraSettings === 'object') {
        updates.cameraSettings = dbSettings.cameraSettings;
      }
      if (dbSettings.mapSettings && typeof dbSettings.mapSettings === 'object') {
        updates.mapSettings = dbSettings.mapSettings;
      }
      if (dbSettings.loggingSettings && typeof dbSettings.loggingSettings === 'object') {
        updates.loggingSettings = dbSettings.loggingSettings;
      }
      if (dbSettings.alertSettings && typeof dbSettings.alertSettings === 'object') {
        updates.alertSettings = dbSettings.alertSettings;
      }
      if (dbSettings.aiSettings && typeof dbSettings.aiSettings === 'object') {
        updates.aiSettings = dbSettings.aiSettings;
      }
      if (dbSettings.convoySettings && typeof dbSettings.convoySettings === 'object') {
        updates.convoySettings = dbSettings.convoySettings;
      }
      if (dbSettings.developerSettings && typeof dbSettings.developerSettings === 'object') {
        updates.developerSettings = dbSettings.developerSettings;
      }
      if (dbSettings.profileSettings && typeof dbSettings.profileSettings === 'object') {
        updates.profileSettings = dbSettings.profileSettings;
      }
      if (dbSettings.liveSharingSettings && typeof dbSettings.liveSharingSettings === 'object') {
        updates.liveSharingSettings = dbSettings.liveSharingSettings;
      }
      if (dbSettings.aiAssistantSettings && typeof dbSettings.aiAssistantSettings === 'object') {
        updates.aiAssistantSettings = dbSettings.aiAssistantSettings;
      }
      if (dbSettings.lateralLaserSettings && typeof dbSettings.lateralLaserSettings === 'object') {
        updates.lateralLaserSettings = dbSettings.lateralLaserSettings;
      }
      if (dbSettings.rearOverhangSettings && typeof dbSettings.rearOverhangSettings === 'object') {
        updates.rearOverhangSettings = dbSettings.rearOverhangSettings;
      }
      if (dbSettings.overheadDetectionConfig && typeof dbSettings.overheadDetectionConfig === 'object') {
        updates.overheadDetectionConfig = dbSettings.overheadDetectionConfig as TAppCfg;
        localStorage.setItem('overhead_detection_config', JSON.stringify(dbSettings.overheadDetectionConfig));
        window.dispatchEvent(new CustomEvent('overhead-config-updated'));
      }
      if (dbSettings.bufferDetectionConfig && typeof dbSettings.bufferDetectionConfig === 'object') {
        // Restore buffer detection configs to localStorage (useBufferConfigStore reads from there)
        localStorage.setItem('buffer_detection_configs', JSON.stringify(dbSettings.bufferDetectionConfig));
      }
      
      // Apply layout config to Zustand store and localStorage
      if (dbSettings.layoutConfig && Array.isArray(dbSettings.layoutConfig)) {
        updates.layoutConfig = dbSettings.layoutConfig;
        localStorage.setItem('layout_config', JSON.stringify(dbSettings.layoutConfig));
        // Dispatch event to notify layout components
        window.dispatchEvent(new CustomEvent('layout-config-changed', { 
          detail: { cards: dbSettings.layoutConfig }
        }));
        console.log('[Settings] Loaded layout config from database');
      }
      
      // Restore orphaned settings via typed Zustand store (store mirrors to localStorage as cache)
      if (dbSettings.uiSettings && typeof dbSettings.uiSettings === 'object') {
        const ui = dbSettings.uiSettings as Partial<UISettingsState>;
        const restoredUI: Partial<UISettingsState> = {};
        if (ui.appZoomLevel != null) { restoredUI.appZoomLevel = ui.appZoomLevel; document.body.style.zoom = `${ui.appZoomLevel}%`; }
        if (ui.lidarHudEnabled != null) restoredUI.lidarHudEnabled = ui.lidarHudEnabled;
        if (ui.lidarServicePort != null) restoredUI.lidarServicePort = ui.lidarServicePort;
        if (ui.lidarMockMode != null) restoredUI.lidarMockMode = ui.lidarMockMode;
        if (ui.measurementFilterSensitivity != null) restoredUI.measurementFilterSensitivity = ui.measurementFilterSensitivity;
        if (ui.appLogoUrl != null) { restoredUI.appLogoUrl = ui.appLogoUrl; window.dispatchEvent(new Event('logo-updated')); }
        if (ui.onboardingCompleted != null) restoredUI.onboardingCompleted = ui.onboardingCompleted;
        if (ui.onboardingCompletedDate != null) restoredUI.onboardingCompletedDate = ui.onboardingCompletedDate;
        if (ui.emailConfig != null && typeof ui.emailConfig === 'object') restoredUI.emailConfig = ui.emailConfig;
        if (ui.leftColumnWidth != null) restoredUI.leftColumnWidth = ui.leftColumnWidth;
        if (Object.keys(restoredUI).length > 0) {
          // setUISettings mirrors to localStorage — but skip during init to avoid triggering a save
          const current = useSettingsStore.getState().uiSettings;
          useSettingsStore.setState({ uiSettings: { ...current, ...restoredUI } });
          // Still need to write to localStorage for non-React consumers
          if (restoredUI.appZoomLevel != null) localStorage.setItem('app_zoom_level', String(restoredUI.appZoomLevel));
          if (restoredUI.lidarHudEnabled != null) localStorage.setItem('lidar_hud_enabled', String(restoredUI.lidarHudEnabled));
          if (restoredUI.lidarServicePort != null) localStorage.setItem('lidar_service_port', restoredUI.lidarServicePort);
          if (restoredUI.lidarMockMode != null) localStorage.setItem('lidar_mock_mode', String(restoredUI.lidarMockMode));
          if (restoredUI.measurementFilterSensitivity != null) {
            localStorage.setItem('measurementFilterSensitivity', restoredUI.measurementFilterSensitivity);
            // Notify useMeasurementFilterStore to rehydrate its active filter (avoids circular import)
            window.dispatchEvent(new CustomEvent('settings:filter-sensitivity-restored', {
              detail: { sensitivity: restoredUI.measurementFilterSensitivity }
            }));
          }
          if (restoredUI.appLogoUrl != null) localStorage.setItem('app_logo_url', restoredUI.appLogoUrl);
          if (restoredUI.onboardingCompleted != null) localStorage.setItem('onboarding_completed', String(restoredUI.onboardingCompleted));
          if (restoredUI.onboardingCompletedDate != null) localStorage.setItem('onboarding_completed_date', restoredUI.onboardingCompletedDate);
          if (restoredUI.emailConfig != null) localStorage.setItem('emailConfig', JSON.stringify(restoredUI.emailConfig));
          if (restoredUI.leftColumnWidth != null) localStorage.setItem('left_column_width', String(restoredUI.leftColumnWidth));
        }
        console.log('[Settings] Restored uiSettings from database into store');
      }
      
      // Apply all valid settings at once using setState (bypasses save triggers)
      if (Object.keys(updates).length > 0) {
        useSettingsStore.setState(updates);
        console.log('[Settings] Loaded from database successfully:', Object.keys(updates).length, 'settings categories');
      }
    } else {
      // No settings in DB - migrate localStorage settings to database
      console.log('[Settings] No database settings found, migrating from localStorage...');
      await saveSettingsToDatabase(userId);
    }
  } catch (error) {
    console.error('[Settings] Failed to initialize from database:', error);
  } finally {
    isSyncingFromDb = false;
  }
};

// Immediately flush all settings to Postgres — use after critical saves
// where waiting 2 seconds for the debounce is not acceptable.
export const forceSyncNow = async (): Promise<boolean> => {
  if (!currentUserId) return false;
  // Cancel any pending debounced sync so we don't double-write
  if (pendingDbSync) {
    clearTimeout(pendingDbSync);
    pendingDbSync = null;
  }
  return saveSettingsToDatabase(currentUserId);
};

// Clear user context on logout
export const clearSettingsUserContext = () => {
  currentUserId = null;
  if (pendingDbSync) {
    clearTimeout(pendingDbSync);
    pendingDbSync = null;
  }
};

// Register beforeunload handler to force-flush any pending debounced save
// Uses fetch with keepalive:true so the request survives tab close/navigation
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    if (!currentUserId || (!pendingDbSync && !hasPendingOfflineChanges)) return;
    if (pendingDbSync) {
      clearTimeout(pendingDbSync);
      pendingDbSync = null;
    }
    // Reuse shared payload builder so this path never diverges from the normal save
    const payload = JSON.stringify(buildSettingsPayload(currentUserId));
    // keepalive:true allows the fetch to complete even after the page unloads
    fetch(`/api/user-settings/${currentUserId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true,
    }).catch(() => {});
  });
}

// Typed state for all orphaned localStorage settings
export interface UISettingsState {
  appZoomLevel: number;
  lidarHudEnabled: boolean;
  lidarServicePort: string;
  lidarMockMode: boolean;
  measurementFilterSensitivity: string;
  appLogoUrl: string | null;
  onboardingCompleted: boolean;
  onboardingCompletedDate: string | null;
  emailConfig: Record<string, unknown> | null;
  leftColumnWidth: number;
}

const DEFAULT_UI_SETTINGS: UISettingsState = {
  appZoomLevel: (() => { const v = localStorage.getItem('app_zoom_level'); return v ? parseInt(v) : 120; })(),
  lidarHudEnabled: localStorage.getItem('lidar_hud_enabled') === 'true',
  lidarServicePort: localStorage.getItem('lidar_service_port') || '17777',
  lidarMockMode: localStorage.getItem('lidar_mock_mode') === 'true',
  measurementFilterSensitivity: localStorage.getItem('measurementFilterSensitivity') || 'medium',
  appLogoUrl: localStorage.getItem('app_logo_url') || null,
  onboardingCompleted: localStorage.getItem('onboarding_completed') === 'true',
  onboardingCompletedDate: localStorage.getItem('onboarding_completed_date') || null,
  emailConfig: (() => { try { const v = localStorage.getItem('emailConfig'); return v ? JSON.parse(v) : null; } catch { return null; } })(),
  leftColumnWidth: (() => { const v = localStorage.getItem('left_column_width'); return v ? parseFloat(v) : 50; })(),
};

export const saveSetting = async (category: string, id: string, value: any) => {
  const setting = {
    id,
    category,
    value,
    updatedAt: new Date().toISOString(),
  };
  
  // Save directly to localStorage (IndexedDB is corrupted)
  try {
    const backupKey = `setting_${category}_${id}`;
    localStorage.setItem(backupKey, JSON.stringify(setting));
  } catch (error) {
    throw error;
  }

  // Audit: log significant setting changes (skip ephemeral or high-frequency writes)
  const skipAuditCategories = new Set(['session', 'cache', 'map', 'debug']);
  if (!skipAuditCategories.has(category)) {
    try {
      const user = getCurrentUser();
      if (user) auditLog.settingsChange(user.uid, user.email || '', `${category}.${id}`, undefined, value);
    } catch (_e) {}
  }
  
  // Also sync to database if user is logged in (debounced)
  if (!isSyncingFromDb) {
    scheduleDatabaseSync();
  }
};

export const getSetting = async (category: string, id: string) => {
  try {
    // Use localStorage directly since IndexedDB is corrupted
    // Match the save pattern: setting_${category}_${id}
    const backupKey = `setting_${category}_${id}`;
    const backupData = localStorage.getItem(backupKey);
    if (backupData) {
      const parsed = JSON.parse(backupData);
      return parsed.value;
    }
    return null;
  } catch (error) {
    return null;
  }
};

export const getSettingsByCategory = async (category: string) => {
  // Use localStorage directly since IndexedDB is corrupted
  const result = {} as Record<string, any>;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(`setting_${category}_`)) {
        const data = localStorage.getItem(key);
        if (data) {
          const parsed = JSON.parse(data);
          result[parsed.id] = parsed.value;
        }
      }
    }
  } catch (error) {
  }
  return result;
};

export const useSettingsStore = create<{
  displaySettings: {
    units: 'metric' | 'imperial';
  };
  laserSettings: {
    type: string;
    config: SerialConfig;
    mode: string;
    bufferSamplingTime: number;
    measurementSettings: {
      command: string;
      updateInterval: number;
    };
    weatherFilter?: {
      enabled: boolean;
      minIntensityGood: number;
      minIntensityAcceptable: number;
    };
  };
  gpsSettings: {
    config: SerialConfig;
  };
  cameraSettings: {
    selectedDevice: string;
    imageSize: { width: number; height: number };
    imageFormat: string;
    captureType: string;
    overlayOptions: {
      showPOI: boolean;
      showGPS: boolean;
      showHeight: boolean;
      showDateTime: boolean;
      showHeading: boolean;
      showLogo: boolean;
      showText: boolean;
    };
    stabilization: boolean;
    videoMode: boolean;
    intervalCapture: number;
  };
  mapSettings: {
    center: [number, number];
    zoom: number;
    provider: 'google' | 'osm' | 'mapbox' | 'igo2';
    style: 'default' | 'satellite' | 'terrain' | 'dark';
    visible: boolean;
  };
  loggingSettings: {
    mode: string;
    autoExport: boolean;
    exportFormat: string;
    captureDelay: number;
    emailNotifications?: boolean;
    timelapseEnabledPOITypes?: string[];
    preferences: {
      gpsInfo: boolean;
      laserMeasure: boolean;
      signalStrength: boolean;
      poiType: boolean;
      capturedImage: boolean;
      video: boolean;
      vehicleTrace: boolean;
      alerts: boolean;
      mileMarkers: boolean;
    };
  };
  alertSettings: {
    soundConfig: {
      logEntry: string;
      warning: string;
      warningLoop: boolean;
      critical: string;
      criticalLoop: boolean;
      volume: number;
      poiTypeChange: string;
      poiTypeChangeEnabled: boolean;
      imageCaptured: string;
      imageCapturedEnabled: boolean;
      measureDetected: string;
      measureDetectedEnabled: boolean;
      alertSoundsEnabled: boolean;
    };
    thresholds: {
      minHeight: number;
      maxHeight: number;
      warningThreshold: number;
      criticalThreshold: number;
    };
  };
  aiSettings: {
    enabled: boolean;
    trainingMode: boolean;
    mockDetectionMode: boolean;
    detectionConfidence: number;
    enabledClasses: string[];
    detectionOverlay: boolean;
    autoLogging: boolean;
    clearanceAlerts: boolean;
    trainingFrameRate: number;
    classes: Array<{
      id: number;
      name: string;
      category: string;
      color: string;
      enabled: boolean;
      priority: number;
    }>;
    detectionZone: {
      enabled: boolean;
      x: number;
      y: number;
      width: number;
      height: number;
      showOverlay: boolean;
      overlayColor: string;
    };
    classFilters: {
      enabledCategories: string[];
      ignoreClasses: string[];
      minConfidenceByClass: Record<string, number>;
    };
  };
  convoySettings: {
    enabled: boolean;
    maxConcurrentConvoys: number;
    defaultWarningThreshold: number;
    defaultCriticalThreshold: number;
    leaderTimeout: number;
    videoQuality: '720p' | '1080p';
    videoLoopDuration: number;
    autoUploadVideos: boolean;
  };
  developerSettings: {
    showPerformanceMonitor: boolean;
  };
  profileSettings: {
    gpsSource: 'duro' | 'serial' | 'bluetooth' | 'browser' | 'auto';
    autoRecordWithSurvey: boolean;
    gradeUpAlertThreshold: number;
    gradeDownAlertThreshold: number;
    kFactorAlertThreshold: number;
    sampleIntervalM: number;
    // Cross-slope/Banking settings
    crossSlopeMode: 'raw' | 'filtered' | 'stopped';
    bankingThresholds: {
      normalMax: number;      // 0-3° default
      cautionMax: number;     // 3-5° default
      warningMax: number;     // 5-7° default
      criticalMax: number;    // 7-10° default
    };
    // Curve radius settings
    minimumCurveRadius_m: number;  // Global minimum safe curve radius
    curveDetectionThreshold_m: number; // Radius below which is considered a "curve"
  };
  liveSharingSettings: {
    enabled: boolean;
    autoStartWithSurvey: boolean;
    syncIntervalSeconds: number;
  };
  aiAssistantSettings: {
    openaiApiKey: string;
    enabled: boolean;
    zendeskSubdomain: string;
    zendeskEmail: string;
    zendeskApiToken: string;
  };
  lateralLaserSettings: {
    mode: 'off' | 'single' | 'dual';
    singleLaserSide: 'left' | 'right';
    leftOffsetMeters: number;
    rightOffsetMeters: number;
    alertThresholdLeft: number;
    alertThresholdRight: number;
    alertThresholdTotal: number;
    alertEnabled: boolean;
    soundWarning: string;
    soundCritical: string;
  };
  rearOverhangSettings: {
    enabled: boolean;
    heightFromGroundMeters: number;
    clearanceThresholdMeters: number;
    alertEnabled: boolean;
    soundWarning: string;
    soundCritical: string;
    useRearCamera: boolean;
    rearCameraDeviceId: string;
  };
  overheadDetectionConfig: TAppCfg | null;
  setOverheadDetectionConfig: (config: TAppCfg | null) => void;
  uiSettings: UISettingsState;
  setUISettings: (settings: Partial<UISettingsState>) => void;
  setDisplaySettings: (settings: any) => Promise<void>;
  setLaserSettings: (settings: any) => Promise<void>;
  setGPSSettings: (settings: any) => Promise<void>;
  setCameraSettings: (settings: any) => Promise<void>;
  setMapSettings: (settings: any) => Promise<void>;
  setLoggingSettings: (settings: any) => Promise<void>;
  setAlertSettings: (settings: any) => Promise<void>;
  setAISettings: (settings: any) => Promise<void>;
  setConvoySettings: (settings: any) => Promise<void>;
  setDeveloperSettings: (settings: any) => Promise<void>;
  setProfileSettings: (settings: any) => Promise<void>;
  setLiveSharingSettings: (settings: any) => Promise<void>;
  setAIAssistantSettings: (settings: any) => Promise<void>;
  layoutConfig: any[] | null;
  setLayoutConfig: (config: any[] | null) => void;
  setLateralLaserSettings: (settings: any) => Promise<void>;
  setRearOverhangSettings: (settings: any) => Promise<void>;
}>((set) => ({
  displaySettings: {
    units: 'metric' as 'metric' | 'imperial'
  },
  laserSettings: {
    type: 'soltec-standard',
    config: {
      baudRate: 115200,
      dataBits: 8,
      stopBits: 1,
      parity: 'none',
      flowControl: 'none'
    },
    mode: 'normal',
    bufferSamplingTime: 0,
    measurementSettings: {
      command: 's0g',
      updateInterval: 1000
    },
    weatherFilter: {
      enabled: false,
      minIntensityGood: 100,
      minIntensityAcceptable: 40
    }
  },
  gpsSettings: {
    config: {
      baudRate: 4800,
      dataBits: 8,
      stopBits: 1,
      parity: 'none',
      flowControl: 'none'
    }
  },
  cameraSettings: {
    selectedDevice: '',
    imageSize: { width: 1280, height: 720 },
    imageFormat: 'image/jpeg',
    captureType: 'manual',
    overlayOptions: {
      showPOI: true,
      showGPS: true,
      showHeight: true,
      showDateTime: true,
      showHeading: true,
      showLogo: false,
      showText: false,
    },
    stabilization: false,
    videoMode: false,
    intervalCapture: 0,
  },
  mapSettings: {
    center: [45.5017, -73.5673], // Montreal coordinates
    zoom: 13,
    provider: 'google' as 'google' | 'osm' | 'mapbox' | 'igo2',
    style: 'default',
    visible: true
  },
  loggingSettings: {
    mode: 'Manual',
    autoExport: true,
    exportFormat: 'csv',
    captureDelay: 1.8,
    emailNotifications: false, // Email notifications disabled by default (opt-in), loaded from storage if previously enabled
    timelapseEnabledPOITypes: [], // Empty array = all types enabled (backward compatible)
    preferences: {
      gpsInfo: true,
      laserMeasure: true,
      signalStrength: true,
      poiType: true,
      capturedImage: true,
      video: true,
      vehicleTrace: true,
      alerts: true,
      mileMarkers: true
    }
  },
  alertSettings: {
    soundConfig: {
      logEntry: '/sounds/interface.wav',
      warning: '/sounds/alert-alarm-1005.wav',
      warningLoop: false,
      critical: '/sounds/facility-alarm-sound-999.wav',
      criticalLoop: true,
      volume: 1.0,
      poiTypeChange: '/sounds/long-pop-2358.wav',
      poiTypeChangeEnabled: true,
      imageCaptured: '/sounds/elevator-tone-2863.wav',
      imageCapturedEnabled: true,
      measureDetected: '/sounds/message-pop-alert-2354.mp3',
      measureDetectedEnabled: true,
      alertSoundsEnabled: true
    },
    thresholds: {
      minHeight: 4,
      maxHeight: 25,
      warningThreshold: 0,
      criticalThreshold: 0
    }
  },
  aiSettings: {
    enabled: false, // AI Detection disabled by default (paid add-on)
    trainingMode: false,
    mockDetectionMode: false,
    detectionConfidence: 0.5,
    enabledClasses: ['bridge', 'overpass', 'walkway_overhead', 'tree_branch', 'tree_full', 'power_line_high_voltage', 'power_line_medium_voltage', 'power_line_low_voltage', 'electrical_wire', 'utility_pole', 'transformer'],
    detectionOverlay: true,
    autoLogging: true,
    clearanceAlerts: true,
    trainingFrameRate: 2,
    classes: [
      // Priority 1: Infrastructure - Overhead
      { id: 0, name: 'bridge', category: 'overhead', color: '#FF0000', enabled: true, priority: 1 },
      { id: 1, name: 'overpass', category: 'overhead', color: '#FF3333', enabled: true, priority: 1 },
      { id: 2, name: 'walkway_overhead', category: 'overhead', color: '#FF6666', enabled: true, priority: 1 },
      
      // Priority 1: Vegetation
      { id: 3, name: 'tree_branch', category: 'vegetation', color: '#00FF00', enabled: true, priority: 1 },
      { id: 4, name: 'tree_full', category: 'vegetation', color: '#33FF33', enabled: true, priority: 1 },
      { id: 5, name: 'vegetation_low', category: 'vegetation', color: '#66FF66', enabled: false, priority: 1 },
      
      // Priority 1: Electrical Infrastructure
      { id: 6, name: 'power_line_high_voltage', category: 'electrical', color: '#FFFF00', enabled: true, priority: 1 },
      { id: 7, name: 'power_line_medium_voltage', category: 'electrical', color: '#FFFF33', enabled: true, priority: 1 },
      { id: 8, name: 'power_line_low_voltage', category: 'electrical', color: '#FFFF66', enabled: true, priority: 1 },
      { id: 9, name: 'electrical_wire', category: 'electrical', color: '#FFD700', enabled: true, priority: 1 },
      { id: 10, name: 'utility_pole', category: 'electrical', color: '#FFA500', enabled: true, priority: 1 },
      { id: 11, name: 'transformer', category: 'electrical', color: '#FF8C00', enabled: true, priority: 1 },
      
      // Priority 2: Traffic Infrastructure
      { id: 12, name: 'traffic_light', category: 'traffic', color: '#FF00FF', enabled: false, priority: 2 },
      { id: 13, name: 'traffic_sign', category: 'traffic', color: '#FF33FF', enabled: false, priority: 2 },
      { id: 14, name: 'street_sign', category: 'traffic', color: '#FF66FF', enabled: false, priority: 2 },
      { id: 15, name: 'speed_limit_sign', category: 'traffic', color: '#CC00FF', enabled: false, priority: 2 },
      
      // Priority 2: Railroad
      { id: 16, name: 'railroad_crossing', category: 'railroad', color: '#0000FF', enabled: false, priority: 2 },
      { id: 17, name: 'railroad_signal', category: 'railroad', color: '#3333FF', enabled: false, priority: 2 },
      { id: 18, name: 'railroad_overhead', category: 'railroad', color: '#6666FF', enabled: false, priority: 2 },
      
      // Priority 3: Additional Infrastructure
      { id: 19, name: 'tunnel_entrance', category: 'infrastructure', color: '#00FFFF', enabled: false, priority: 3 },
      { id: 20, name: 'gantry', category: 'infrastructure', color: '#33FFFF', enabled: false, priority: 3 },
      { id: 21, name: 'building_overhang', category: 'infrastructure', color: '#66FFFF', enabled: false, priority: 3 },
      { id: 22, name: 'awning', category: 'infrastructure', color: '#99FFFF', enabled: false, priority: 3 },
      
      // Priority 3: Communication Infrastructure
      { id: 23, name: 'telecom_cable', category: 'communication', color: '#FFC0CB', enabled: false, priority: 3 },
      { id: 24, name: 'antenna', category: 'communication', color: '#FFB6C1', enabled: false, priority: 3 },
      { id: 25, name: 'street_light', category: 'infrastructure', color: '#DDA0DD', enabled: false, priority: 3 }
    ],
    detectionZone: {
      enabled: true,
      x: 0.1,
      y: 0.0,
      width: 0.8,
      height: 0.6,
      showOverlay: true,
      overlayColor: '#00FF00'
    },
    classFilters: {
      enabledCategories: ['overhead', 'electrical', 'vegetation'],
      ignoreClasses: ['pedestrian', 'vehicle', 'animal', 'infrastructure'],
      minConfidenceByClass: {
        'bridge': 0.4,
        'tree_branch': 0.5,
        'power_line_high_voltage': 0.6
      }
    }
  },
  setDisplaySettings: async (settings) => {
    await saveSetting('display', 'displaySettings', settings);
    set({ displaySettings: settings });
  },
  setLaserSettings: async (settings) => {
    await saveSetting('laser', 'laserSettings', settings);
    set({ laserSettings: settings });
  },
  setGPSSettings: async (settings) => {
    await saveSetting('gps', 'gpsSettings', settings);
    set({ gpsSettings: settings });
  },
  setCameraSettings: async (settings) => {
    await saveSetting('camera', 'cameraSettings', settings);
    set({ cameraSettings: settings });
  },
  setMapSettings: async (settings) => {
    await saveSetting('map', 'mapSettings', settings);
    set({ mapSettings: settings });
  },
  setLoggingSettings: async (settings) => {
    const currentState = useSettingsStore.getState();
    const mergedSettings = {
      ...currentState.loggingSettings,
      ...settings,
      // Deep merge nested preferences object
      preferences: {
        ...(currentState.loggingSettings?.preferences || {}),
        ...(settings.preferences || {})
      }
    };
    await saveSetting('logging', 'loggingSettings', mergedSettings);
    set({ loggingSettings: mergedSettings });
  },
  setAlertSettings: async (settings) => {
    await saveSetting('alerts', 'alertSettings', settings);
    set({ alertSettings: settings });
  },
  setAISettings: async (settings) => {
    await saveSetting('ai', 'aiSettings', settings);
    set({ aiSettings: settings });
  },
  convoySettings: {
    enabled: false,
    maxConcurrentConvoys: 3,
    defaultWarningThreshold: 4.5,
    defaultCriticalThreshold: 4.2,
    leaderTimeout: 300000, // 5 minutes in ms
    videoQuality: '720p' as '720p' | '1080p',
    videoLoopDuration: 60, // seconds
    autoUploadVideos: false,
  },
  developerSettings: {
    showPerformanceMonitor: false, // Performance monitor disabled by default
  },
  profileSettings: {
    gpsSource: 'auto' as 'duro' | 'serial' | 'bluetooth' | 'browser' | 'auto', // Auto-select best available source
    autoRecordWithSurvey: true, // Automatically record profile when survey starts
    gradeUpAlertThreshold: 12, // Alert at 12% uphill grade
    gradeDownAlertThreshold: -12, // Alert at -12% downhill grade
    kFactorAlertThreshold: 10, // Alert when K-factor > 10
    sampleIntervalM: 5, // Minimum 5m between samples
    // Cross-slope/Banking settings - defaults based on heavy haul standards
    crossSlopeMode: 'raw' as 'raw' | 'filtered' | 'stopped', // Default to raw IMU roll
    bankingThresholds: {
      normalMax: 3,      // 0-3° = Normal
      cautionMax: 5,     // 3-5° = Caution
      warningMax: 7,     // 5-7° = Warning (yellow zone)
      criticalMax: 10,   // 7-10° = Critical (red zone), >10° = Unacceptable
    },
    // Curve radius settings
    minimumCurveRadius_m: 15, // Default 15m minimum safe curve radius
    curveDetectionThreshold_m: 500, // Radius below 500m is considered a "curve"
  },
  setConvoySettings: async (settings) => {
    await saveSetting('convoy', 'convoySettings', settings);
    set({ convoySettings: settings });
  },
  setDeveloperSettings: async (settings) => {
    await saveSetting('developer', 'developerSettings', settings);
    set({ developerSettings: settings });
  },
  setProfileSettings: async (settings) => {
    await saveSetting('profile', 'profileSettings', settings);
    set({ profileSettings: settings });
  },
  liveSharingSettings: {
    enabled: false,
    autoStartWithSurvey: false,
    syncIntervalSeconds: 30,
  },
  setLiveSharingSettings: async (settings) => {
    await saveSetting('liveSharing', 'liveSharingSettings', settings);
    set({ liveSharingSettings: settings });
  },
  aiAssistantSettings: {
    openaiApiKey: '',
    enabled: false,
    zendeskSubdomain: '',
    zendeskEmail: '',
    zendeskApiToken: '',
  },
  setAIAssistantSettings: async (settings) => {
    await saveSetting('aiAssistant', 'aiAssistantSettings', settings);
    set({ aiAssistantSettings: settings });
  },
  lateralLaserSettings: {
    mode: 'off' as 'off' | 'single' | 'dual',
    singleLaserSide: 'right' as 'left' | 'right',
    leftOffsetMeters: 0,
    rightOffsetMeters: 0,
    alertThresholdLeft: 0.5,
    alertThresholdRight: 0.5,
    alertThresholdTotal: 5.0,
    alertEnabled: true,
    soundWarning: 'warning-beep',
    soundCritical: 'critical-alarm',
  },
  layoutConfig: (() => {
    try {
      const saved = localStorage.getItem('layout_config');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  })(),
  setLayoutConfig: (config) => {
    set({ layoutConfig: config });
    if (config !== null) {
      localStorage.setItem('layout_config', JSON.stringify(config));
    }
    if (!isSyncingFromDb) {
      scheduleDatabaseSync();
    }
  },
  setLateralLaserSettings: async (settings) => {
    await saveSetting('lateralLaser', 'lateralLaserSettings', settings);
    set({ lateralLaserSettings: settings });
  },
  rearOverhangSettings: {
    enabled: false,
    heightFromGroundMeters: 1.5,
    clearanceThresholdMeters: 40,
    alertEnabled: true,
    soundWarning: 'warning-beep',
    soundCritical: 'critical-alarm',
    useRearCamera: false,
    rearCameraDeviceId: '',
  },
  setRearOverhangSettings: async (settings) => {
    await saveSetting('rearOverhang', 'rearOverhangSettings', settings);
    set({ rearOverhangSettings: settings });
  },
  uiSettings: DEFAULT_UI_SETTINGS,
  setUISettings: (partial) => {
    set((state) => {
      const updated = { ...state.uiSettings, ...partial };
      // Mirror every changed key to localStorage (as cache); clear on null/empty
      if (partial.appZoomLevel !== undefined) localStorage.setItem('app_zoom_level', String(partial.appZoomLevel));
      if (partial.lidarHudEnabled !== undefined) localStorage.setItem('lidar_hud_enabled', String(partial.lidarHudEnabled));
      if (partial.lidarServicePort !== undefined) localStorage.setItem('lidar_service_port', partial.lidarServicePort);
      if (partial.lidarMockMode !== undefined) localStorage.setItem('lidar_mock_mode', String(partial.lidarMockMode));
      if (partial.measurementFilterSensitivity !== undefined) localStorage.setItem('measurementFilterSensitivity', partial.measurementFilterSensitivity);
      if (partial.appLogoUrl !== undefined) {
        if (partial.appLogoUrl) localStorage.setItem('app_logo_url', partial.appLogoUrl);
        else localStorage.removeItem('app_logo_url');
      }
      if (partial.onboardingCompleted !== undefined) localStorage.setItem('onboarding_completed', String(partial.onboardingCompleted));
      if (partial.onboardingCompletedDate !== undefined) {
        if (partial.onboardingCompletedDate) localStorage.setItem('onboarding_completed_date', partial.onboardingCompletedDate);
        else localStorage.removeItem('onboarding_completed_date');
      }
      if (partial.emailConfig !== undefined) {
        if (partial.emailConfig) localStorage.setItem('emailConfig', JSON.stringify(partial.emailConfig));
        else localStorage.removeItem('emailConfig');
      }
      if (partial.leftColumnWidth !== undefined) localStorage.setItem('left_column_width', String(partial.leftColumnWidth));
      return { uiSettings: updated };
    });
    if (!isSyncingFromDb) scheduleDatabaseSync();
  },
  overheadDetectionConfig: (() => { try { const v = localStorage.getItem('overhead_detection_config'); if (!v) return null; const parsed = JSON.parse(v); return (parsed && typeof parsed === 'object') ? parsed as TAppCfg : null; } catch { return null; } })(),
  setOverheadDetectionConfig: (config) => {
    if (config) {
      localStorage.setItem('overhead_detection_config', JSON.stringify(config));
    } else {
      localStorage.removeItem('overhead_detection_config');
    }
    set({ overheadDetectionConfig: config });
    window.dispatchEvent(new CustomEvent('overhead-config-updated'));
    if (!isSyncingFromDb) scheduleDatabaseSync();
  },
}));