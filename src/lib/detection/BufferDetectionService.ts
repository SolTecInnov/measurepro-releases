import { create } from 'zustand';
import type { POIType } from '../poi';
import { calculateDistance } from '../utils/geoUtils';
import { soundManager } from '../sounds';

export interface BufferedMeasurement {
  value: number;
  rawValue: string;
  timestamp: number;
  latitude: number;
  longitude: number;
  altitude?: number;
  groundReference: number;
}

export interface BufferSession {
  poiType: POIType;
  startTime: number;
  startPosition: { latitude: number; longitude: number };
  measurements: BufferedMeasurement[];
  minMeasurement: BufferedMeasurement | null;
  maxMeasurement: BufferedMeasurement | null;
  targetDistanceMeters: number;
  targetTimeSeconds: number | null;
  mode: 'distance' | 'time';
  groundReference: number;
}

export interface BufferConfig {
  enabled: boolean;
  distanceMeters: number;
  timeSeconds: number;
  mode: 'distance' | 'time';
}

export const DEFAULT_BUFFER_CONFIGS: Partial<Record<POIType, BufferConfig>> = {
  wire:              { enabled: true, distanceMeters: 100, timeSeconds: 15, mode: 'distance' },
  tree:              { enabled: true, distanceMeters:  50, timeSeconds: 10, mode: 'distance' },
  bridgeAndWires:    { enabled: true, distanceMeters: 100, timeSeconds: 15, mode: 'distance' },
  powerLine:         { enabled: true, distanceMeters: 100, timeSeconds: 15, mode: 'distance' },
  trafficLight:      { enabled: true, distanceMeters:  50, timeSeconds:  8, mode: 'distance' },
  overpass:          { enabled: true, distanceMeters: 100, timeSeconds: 15, mode: 'distance' },
  signalization:     { enabled: true, distanceMeters:  30, timeSeconds:  5, mode: 'distance' },
  opticalFiber:      { enabled: true, distanceMeters:  50, timeSeconds:  8, mode: 'distance' },
  overheadStructure: { enabled: true, distanceMeters:  50, timeSeconds: 10, mode: 'distance' },
};

export const BUFFER_ENABLED_POI_TYPES: POIType[] = [
  'wire',
  'tree',
  'bridgeAndWires',
  'powerLine',
  'trafficLight',
  'overpass',
  'signalization',
  'opticalFiber',
  'overheadStructure',
];

interface BufferConfigStore {
  configs: Record<POIType, BufferConfig>;
  getConfig: (poiType: POIType) => BufferConfig | null;
  setConfig: (poiType: POIType, config: BufferConfig) => void;
  isBufferEnabled: (poiType: POIType) => boolean;
  resetToDefaults: () => void;
}

const loadSavedConfigs = (): Record<POIType, BufferConfig> => {
  const defaults: Record<POIType, BufferConfig> = {} as Record<POIType, BufferConfig>;
  
  for (const poiType of BUFFER_ENABLED_POI_TYPES) {
    defaults[poiType] = DEFAULT_BUFFER_CONFIGS[poiType] || {
      enabled: false,
      distanceMeters: 100,
      timeSeconds: 10,
      mode: 'distance'
    };
  }
  
  try {
    const saved = localStorage.getItem('buffer_detection_configs');
    if (saved) {
      const parsed = JSON.parse(saved);
      return { ...defaults, ...parsed };
    }
  } catch (error) {
    console.error('Failed to load buffer detection configs:', error);
  }
  return defaults;
};

export const useBufferConfigStore = create<BufferConfigStore>((set, get) => ({
  configs: loadSavedConfigs(),
  
  getConfig: (poiType: POIType): BufferConfig | null => {
    const config = get().configs[poiType];
    if (!config) return null;
    return config;
  },
  
  setConfig: (poiType: POIType, config: BufferConfig) => {
    const newConfigs = { ...get().configs, [poiType]: config };
    set({ configs: newConfigs });
    localStorage.setItem('buffer_detection_configs', JSON.stringify(newConfigs));
  },
  
  isBufferEnabled: (poiType: POIType): boolean => {
    const config = get().configs[poiType];
    return config?.enabled ?? false;
  },
  
  resetToDefaults: () => {
    const defaults = loadSavedConfigs();
    set({ configs: defaults });
    localStorage.removeItem('buffer_detection_configs');
  }
}));

export type BufferState = 'idle' | 'buffering' | 'completed';

export interface BufferProgress {
  state: BufferState;
  poiType: POIType | null;
  startTime: number | null;
  elapsedTimeSeconds: number;
  traveledDistanceMeters: number;
  targetDistanceMeters: number;
  targetTimeSeconds: number | null;
  mode: 'distance' | 'time';
  measurementCount: number;
  currentMin: number | null;
  currentMax: number | null;
  progressPercent: number;
}

interface BufferDetectionStore {
  session: BufferSession | null;
  state: BufferState;
  progress: BufferProgress;
  start: (poiType: POIType, position: { latitude: number; longitude: number }, groundReference: number) => boolean;
  addMeasurement: (measurement: BufferedMeasurement) => void;
  updatePosition: (position: { latitude: number; longitude: number }) => BufferProgress;
  checkCompletion: () => boolean;
  finalize: () => BufferSession | null;
  abort: () => BufferSession | null;
  reset: () => void;
  getFormattedNotes: () => string;
}

const initialProgress: BufferProgress = {
  state: 'idle',
  poiType: null,
  startTime: null,
  elapsedTimeSeconds: 0,
  traveledDistanceMeters: 0,
  targetDistanceMeters: 0,
  targetTimeSeconds: null,
  mode: 'distance',
  measurementCount: 0,
  currentMin: null,
  currentMax: null,
  progressPercent: 0
};

export const useBufferDetectionStore = create<BufferDetectionStore>((set, get) => ({
  session: null,
  state: 'idle',
  progress: initialProgress,
  
  start: (poiType: POIType, position: { latitude: number; longitude: number }, groundReference: number): boolean => {
    const configStore = useBufferConfigStore.getState();
    const config = configStore.getConfig(poiType);
    
    if (!config || !config.enabled) {
      console.log(`[BufferDetection] Buffer not enabled for POI type: ${poiType}`);
      return false;
    }
    
    const currentSession = get().session;
    if (currentSession) {
      console.log(`[BufferDetection] Session already active for: ${currentSession.poiType}`);
      return false;
    }
    
    const session: BufferSession = {
      poiType,
      startTime: Date.now(),
      startPosition: position,
      measurements: [],
      minMeasurement: null,
      maxMeasurement: null,
      targetDistanceMeters: config.distanceMeters,
      targetTimeSeconds: config.mode === 'time' ? config.timeSeconds : null,
      mode: config.mode,
      groundReference
    };
    
    const progress: BufferProgress = {
      state: 'buffering',
      poiType,
      startTime: session.startTime,
      elapsedTimeSeconds: 0,
      traveledDistanceMeters: 0,
      targetDistanceMeters: config.distanceMeters,
      targetTimeSeconds: config.mode === 'time' ? config.timeSeconds : null,
      mode: config.mode,
      measurementCount: 0,
      currentMin: null,
      currentMax: null,
      progressPercent: 0
    };
    
    set({ session, state: 'buffering', progress });
    
    console.log(`[BufferDetection] Started buffer for ${poiType}: target=${config.mode === 'distance' ? config.distanceMeters + 'm' : config.timeSeconds + 's'}`);
    
    return true;
  },
  
  addMeasurement: (measurement: BufferedMeasurement) => {
    const currentSession = get().session;
    if (!currentSession || get().state !== 'buffering') {
      return;
    }
    
    const updatedMeasurements = [...currentSession.measurements, measurement];
    
    let minMeasurement = currentSession.minMeasurement;
    let maxMeasurement = currentSession.maxMeasurement;
    
    if (!minMeasurement || measurement.value < minMeasurement.value) {
      minMeasurement = measurement;
    }
    if (!maxMeasurement || measurement.value > maxMeasurement.value) {
      maxMeasurement = measurement;
    }
    
    const updatedSession: BufferSession = {
      ...currentSession,
      measurements: updatedMeasurements,
      minMeasurement,
      maxMeasurement
    };
    
    const progress = get().progress;
    const updatedProgress: BufferProgress = {
      ...progress,
      measurementCount: updatedMeasurements.length,
      currentMin: minMeasurement?.value ?? null,
      currentMax: maxMeasurement?.value ?? null
    };
    
    set({ session: updatedSession, progress: updatedProgress });
    
    console.log(`[BufferDetection] Added measurement: ${measurement.value.toFixed(2)}m (min=${minMeasurement?.value.toFixed(2) ?? 'N/A'}, count=${updatedMeasurements.length})`);
  },
  
  updatePosition: (position: { latitude: number; longitude: number }): BufferProgress => {
    const currentSession = get().session;
    if (!currentSession) {
      return get().progress;
    }
    
    const distanceKm = calculateDistance(
      currentSession.startPosition.latitude,
      currentSession.startPosition.longitude,
      position.latitude,
      position.longitude
    );
    const distanceMeters = distanceKm * 1000;
    
    const elapsedMs = Date.now() - currentSession.startTime;
    const elapsedSeconds = elapsedMs / 1000;
    
    let progressPercent = 0;
    if (currentSession.mode === 'distance') {
      progressPercent = Math.min(100, (distanceMeters / currentSession.targetDistanceMeters) * 100);
    } else if (currentSession.targetTimeSeconds) {
      progressPercent = Math.min(100, (elapsedSeconds / currentSession.targetTimeSeconds) * 100);
    }
    
    const updatedProgress: BufferProgress = {
      ...get().progress,
      traveledDistanceMeters: distanceMeters,
      elapsedTimeSeconds: elapsedSeconds,
      progressPercent
    };
    
    set({ progress: updatedProgress });
    
    return updatedProgress;
  },
  
  checkCompletion: (): boolean => {
    const currentSession = get().session;
    const progress = get().progress;
    
    if (!currentSession || get().state !== 'buffering') {
      return false;
    }
    
    let isComplete = false;
    
    if (currentSession.mode === 'distance') {
      isComplete = progress.traveledDistanceMeters >= currentSession.targetDistanceMeters;
      // Fallback: if GPS not moving (no fix), complete on time instead
      if (!isComplete && currentSession.targetTimeSeconds) {
        const hasGpsFix = !!(currentSession.startPosition.latitude || currentSession.startPosition.longitude);
        if (!hasGpsFix || progress.traveledDistanceMeters < 1) {
          // GPS at 0,0 or no movement detected — fall back to time completion
          isComplete = progress.elapsedTimeSeconds >= currentSession.targetTimeSeconds;
        }
      }
    } else if (currentSession.targetTimeSeconds) {
      isComplete = progress.elapsedTimeSeconds >= currentSession.targetTimeSeconds;
    }
    
    if (isComplete) {
      set({ state: 'completed', progress: { ...progress, state: 'completed', progressPercent: 100 } });
      console.log(`[BufferDetection] Buffer completed for ${currentSession.poiType}`);
    }
    
    return isComplete;
  },
  
  finalize: (): BufferSession | null => {
    const currentSession = get().session;
    if (!currentSession) {
      return null;
    }
    
    console.log(`[BufferDetection] Finalizing buffer for ${currentSession.poiType}: ${currentSession.measurements.length} measurements, min=${currentSession.minMeasurement?.value.toFixed(2) ?? 'N/A'}`);
    
    const sessionCopy = { ...currentSession };
    
    get().reset();
    
    return sessionCopy;
  },
  
  abort: (): BufferSession | null => {
    const currentSession = get().session;
    if (!currentSession) {
      return null;
    }
    
    console.log(`[BufferDetection] Aborting buffer for ${currentSession.poiType} (early termination)`);
    
    const sessionCopy = { ...currentSession };
    
    get().reset();
    
    return sessionCopy;
  },
  
  reset: () => {
    set({ session: null, state: 'idle', progress: initialProgress });
    console.log('[BufferDetection] Session reset');
  },
  
  getFormattedNotes: (): string => {
    const currentSession = get().session;
    if (!currentSession) return '';
    
    const lines: string[] = [];
    
    if (currentSession.minMeasurement) {
      lines.push(`Lowest: ${currentSession.minMeasurement.value.toFixed(2)}m`);
    }
    
    if (currentSession.groundReference > 0) {
      lines.push(`Ground ref: ${currentSession.groundReference.toFixed(2)}m`);
    }
    
    lines.push(`Measurements (${currentSession.measurements.length}):`);
    
    for (const m of currentSession.measurements) {
      const time = new Date(m.timestamp).toLocaleTimeString();
      lines.push(`  ${time}: ${m.value.toFixed(2)}m`);
    }
    
    return lines.join('\n');
  }
}));

export class BufferDetectionService {
  private static instance: BufferDetectionService | null = null;
  private positionUpdateInterval: number | null = null;
  private currentPosition: { latitude: number; longitude: number } | null = null;
  private onComplete: ((session: BufferSession) => void) | null = null;
  private onProgress: ((progress: BufferProgress) => void) | null = null;
  
  static getInstance(): BufferDetectionService {
    if (!BufferDetectionService.instance) {
      BufferDetectionService.instance = new BufferDetectionService();
    }
    return BufferDetectionService.instance;
  }
  
  setCallbacks(callbacks: {
    onComplete?: (session: BufferSession) => void;
    onProgress?: (progress: BufferProgress) => void;
  }) {
    this.onComplete = callbacks.onComplete ?? null;
    this.onProgress = callbacks.onProgress ?? null;
  }
  
  start(
    poiType: POIType,
    position: { latitude: number; longitude: number },
    groundReference: number
  ): boolean {
    const store = useBufferDetectionStore.getState();
    const started = store.start(poiType, position, groundReference);
    
    if (started) {
      this.currentPosition = position;
      this.startPositionTracking();
      
      soundManager.playBufferStart();
    }
    
    return started;
  }
  
  addMeasurement(
    value: number,
    rawValue: string,
    position: { latitude: number; longitude: number; altitude?: number },
    groundReference: number
  ) {
    const store = useBufferDetectionStore.getState();
    
    if (store.state !== 'buffering') {
      return;
    }
    
    const measurement: BufferedMeasurement = {
      value,
      rawValue,
      timestamp: Date.now(),
      latitude: position.latitude,
      longitude: position.longitude,
      altitude: position.altitude,
      groundReference
    };
    
    store.addMeasurement(measurement);
    
    this.currentPosition = { latitude: position.latitude, longitude: position.longitude };
    
    const progress = store.updatePosition(this.currentPosition);
    this.onProgress?.(progress);
    
    if (store.checkCompletion()) {
      this.handleCompletion();
    }
  }
  
  updatePosition(position: { latitude: number; longitude: number }) {
    const store = useBufferDetectionStore.getState();
    
    if (store.state !== 'buffering') {
      return;
    }
    
    this.currentPosition = position;
    const progress = store.updatePosition(position);
    this.onProgress?.(progress);
    
    if (store.checkCompletion()) {
      this.handleCompletion();
    }
  }
  
  private handleCompletion() {
    this.stopPositionTracking();
    
    soundManager.playBufferComplete();
    
    const store = useBufferDetectionStore.getState();
    const session = store.finalize();
    
    if (session) {
      this.onComplete?.(session);
    }
  }
  
  abort(): BufferSession | null {
    this.stopPositionTracking();
    
    const store = useBufferDetectionStore.getState();
    const session = store.abort();
    
    if (session && session.measurements.length > 0) {
      soundManager.playBufferComplete();
      this.onComplete?.(session);
    }
    
    return session;
  }
  
  getProgress(): BufferProgress {
    return useBufferDetectionStore.getState().progress;
  }
  
  isActive(): boolean {
    return useBufferDetectionStore.getState().state === 'buffering';
  }
  
  getActivePoiType(): POIType | null {
    return useBufferDetectionStore.getState().session?.poiType ?? null;
  }
  
  private startPositionTracking() {
    if (this.positionUpdateInterval) {
      return;
    }
    
    this.positionUpdateInterval = window.setInterval(() => {
      if (this.currentPosition) {
        const store = useBufferDetectionStore.getState();
        if (store.state === 'buffering') {
          const progress = store.updatePosition(this.currentPosition);
          this.onProgress?.(progress);
          
          if (store.checkCompletion()) {
            this.handleCompletion();
          }
        }
      }
    }, 500);
  }
  
  private stopPositionTracking() {
    if (this.positionUpdateInterval) {
      clearInterval(this.positionUpdateInterval);
      this.positionUpdateInterval = null;
    }
  }
  
  static formatSessionNotes(session: BufferSession): string {
    const lines: string[] = [];
    
    if (session.minMeasurement) {
      lines.push(`Lowest: ${session.minMeasurement.value.toFixed(2)}m`);
    }
    
    if (session.groundReference > 0) {
      lines.push(`Ground ref: ${session.groundReference.toFixed(2)}m`);
    }
    
    const duration = ((session.measurements[session.measurements.length - 1]?.timestamp ?? session.startTime) - session.startTime) / 1000;
    lines.push(`Duration: ${duration.toFixed(1)}s`);
    lines.push(`Readings: ${session.measurements.length}`);
    
    if (session.measurements.length > 0) {
      lines.push('');
      lines.push('All measurements:');
      for (const m of session.measurements) {
        const time = new Date(m.timestamp).toLocaleTimeString('en-US', { 
          hour12: false, 
          hour: '2-digit', 
          minute: '2-digit', 
          second: '2-digit' 
        });
        const isMin = m === session.minMeasurement;
        lines.push(`  ${time}: ${m.value.toFixed(2)}m${isMin ? ' ← LOWEST' : ''}`);
      }
    }
    
    return lines.join('\n');
  }
}

export const bufferDetectionService = BufferDetectionService.getInstance();
