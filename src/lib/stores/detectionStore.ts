import { create } from 'zustand';
import type { Detection } from '../mockDetection';

export interface DetectionLogEntry {
  id: string;
  detection: Detection;
  status: 'pending' | 'accepted' | 'rejected' | 'corrected';
  correctedClass?: string;
  userNote?: string;
  gpsData?: {
    latitude: number;
    longitude: number;
    altitude: number;
  };
  measurement?: {
    distance: number;
    height: number;
  };
  timestamp: number;
  loggedToMeasurement: boolean;
}

interface DetectionStore {
  // Active detections being displayed
  activeDetections: Detection[];
  
  // Detection history/log
  detectionLog: DetectionLogEntry[];
  
  // Pending detection awaiting user action
  pendingDetection: Detection | null;
  pendingTimeout: number | null;
  
  // Timeout tracking for auto-expiration (id -> timeout handle)
  expirationTimeouts: Map<string, number>;
  
  // Actions
  addDetection: (detection: Detection) => void;
  removeDetection: (id: string) => void;
  clearActiveDetections: () => void;
  
  acceptDetection: (id: string) => void;
  rejectDetection: (id: string) => void;
  correctDetection: (id: string, correctedClass: string) => void;
  
  setPendingDetection: (detection: Detection | null) => void;
  clearPendingDetection: () => void;
  
  getDetectionById: (id: string) => DetectionLogEntry | undefined;
  getDetectionsByClass: (objectClass: string) => DetectionLogEntry[];
  getAcceptedDetections: () => DetectionLogEntry[];
  getCorrectedDetections: () => DetectionLogEntry[];
}

export const useDetectionStore = create<DetectionStore>((set, get) => ({
  activeDetections: [],
  detectionLog: [],
  pendingDetection: null,
  pendingTimeout: null,
  expirationTimeouts: new Map(),
  
  addDetection: (detection: Detection) => {
    set((state) => ({
      activeDetections: [...state.activeDetections, detection],
    }));
    
    // Add to detection log as pending
    const logEntry: DetectionLogEntry = {
      id: detection.id,
      detection,
      status: 'pending',
      timestamp: Date.now(),
      loggedToMeasurement: false,
    };
    
    set((state) => ({
      detectionLog: [...state.detectionLog, logEntry],
    }));
    
    // Auto-expire detection after 3 seconds to prevent screen clutter
    const timeoutId = window.setTimeout(() => {
      const state = get();
      
      // Only remove if still in active detections
      if (state.activeDetections.some(d => d.id === detection.id)) {
        get().removeDetection(detection.id);
      }
      
      // Clean up timeout reference
      const newTimeouts = new Map(state.expirationTimeouts);
      newTimeouts.delete(detection.id);
      set({ expirationTimeouts: newTimeouts });
    }, 3000); // 3 seconds
    
    // Store timeout ID for potential cleanup
    set((state) => {
      const newTimeouts = new Map(state.expirationTimeouts);
      newTimeouts.set(detection.id, timeoutId);
      return { expirationTimeouts: newTimeouts };
    });
  },
  
  removeDetection: (id: string) => {
    // Clear expiration timeout if it exists
    const state = get();
    const timeoutId = state.expirationTimeouts.get(id);
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
      const newTimeouts = new Map(state.expirationTimeouts);
      newTimeouts.delete(id);
      set({ expirationTimeouts: newTimeouts });
    }
    
    set((state) => ({
      activeDetections: state.activeDetections.filter((d) => d.id !== id),
    }));
  },
  
  clearActiveDetections: () => {
    // Clear all expiration timeouts
    const state = get();
    state.expirationTimeouts.forEach((timeoutId) => {
      clearTimeout(timeoutId);
    });
    
    set({ 
      activeDetections: [],
      expirationTimeouts: new Map()
    });
  },
  
  acceptDetection: (id: string) => {
    set((state) => ({
      detectionLog: state.detectionLog.map((entry) =>
        entry.id === id
          ? { ...entry, status: 'accepted' as const }
          : entry
      ),
    }));
    
    // Remove from active detections
    get().removeDetection(id);
  },
  
  rejectDetection: (id: string) => {
    set((state) => ({
      detectionLog: state.detectionLog.map((entry) =>
        entry.id === id
          ? { ...entry, status: 'rejected' as const }
          : entry
      ),
    }));
    
    // Remove from active detections
    get().removeDetection(id);
  },
  
  correctDetection: (id: string, correctedClass: string) => {
    set((state) => ({
      detectionLog: state.detectionLog.map((entry) =>
        entry.id === id
          ? {
              ...entry,
              status: 'corrected' as const,
              correctedClass,
            }
          : entry
      ),
    }));
    
    // Remove from active detections
    get().removeDetection(id);
  },
  
  setPendingDetection: (detection: Detection | null) => {
    set({ pendingDetection: detection });
  },
  
  clearPendingDetection: () => {
    set({ pendingDetection: null });
    
    // Clear timeout if exists
    const state = get();
    if (state.pendingTimeout !== null) {
      clearTimeout(state.pendingTimeout);
      set({ pendingTimeout: null });
    }
  },
  
  getDetectionById: (id: string) => {
    return get().detectionLog.find((entry) => entry.id === id);
  },
  
  getDetectionsByClass: (objectClass: string) => {
    return get().detectionLog.filter(
      (entry) => entry.detection.objectClass === objectClass
    );
  },
  
  getAcceptedDetections: () => {
    return get().detectionLog.filter((entry) => entry.status === 'accepted');
  },
  
  getCorrectedDetections: () => {
    return get().detectionLog.filter((entry) => entry.status === 'corrected');
  },
}));
