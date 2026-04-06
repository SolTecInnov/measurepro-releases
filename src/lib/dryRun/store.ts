/**
 * Dry Run Detection Store
 * Zustand store for managing detection zones and state
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { 
  DryRunConfig, 
  DetectionZone, 
  SimpleThreshold, 
  ZoneDetectionState,
  DetectionEvent 
} from './types';
import { DEFAULT_DRY_RUN_CONFIG } from './types';

interface DryRunStore {
  config: DryRunConfig;
  detectionStates: Map<string, ZoneDetectionState>;
  recentEvents: DetectionEvent[];
  
  setEnabled: (enabled: boolean) => void;
  addZone: (zone: DetectionZone) => void;
  updateZone: (zoneId: string, updates: Partial<DetectionZone>) => void;
  removeZone: (zoneId: string) => void;
  toggleZone: (zoneId: string, enabled: boolean) => void;
  
  addSimpleThreshold: (threshold: SimpleThreshold) => void;
  removeSimpleThreshold: (side: string) => void;
  
  updateDetectionState: (state: ZoneDetectionState) => void;
  addDetectionEvent: (event: DetectionEvent) => void;
  updateDetectionEvent: (eventId: string, updates: Partial<DetectionEvent>) => void;
  clearRecentEvents: () => void;
  
  setAutoCreatePOI: (value: boolean) => void;
  setCaptureSnapshot: (value: boolean) => void;
  
  resetToDefaults: () => void;
}

export const useDryRunStore = create<DryRunStore>()(
  persist(
    (set) => ({
      config: DEFAULT_DRY_RUN_CONFIG,
      detectionStates: new Map(),
      recentEvents: [],
      
      setEnabled: (enabled) => set((state) => ({
        config: { ...state.config, enabled }
      })),
      
      addZone: (zone) => set((state) => ({
        config: { 
          ...state.config, 
          zones: [...state.config.zones, zone] 
        }
      })),
      
      updateZone: (zoneId, updates) => set((state) => ({
        config: {
          ...state.config,
          zones: state.config.zones.map(z => 
            z.id === zoneId ? { ...z, ...updates } : z
          )
        }
      })),
      
      removeZone: (zoneId) => set((state) => ({
        config: {
          ...state.config,
          zones: state.config.zones.filter(z => z.id !== zoneId)
        }
      })),
      
      toggleZone: (zoneId, enabled) => set((state) => ({
        config: {
          ...state.config,
          zones: state.config.zones.map(z =>
            z.id === zoneId ? { ...z, enabled } : z
          )
        }
      })),
      
      addSimpleThreshold: (threshold) => set((state) => ({
        config: {
          ...state.config,
          simpleThresholds: [
            ...state.config.simpleThresholds.filter(t => t.side !== threshold.side),
            threshold
          ]
        }
      })),
      
      removeSimpleThreshold: (side) => set((state) => ({
        config: {
          ...state.config,
          simpleThresholds: state.config.simpleThresholds.filter(t => t.side !== side)
        }
      })),
      
      updateDetectionState: (newState) => set((state) => {
        const newMap = new Map(state.detectionStates);
        newMap.set(newState.zoneId, newState);
        return { detectionStates: newMap };
      }),
      
      addDetectionEvent: (event) => set((state) => ({
        recentEvents: [event, ...state.recentEvents].slice(0, 50)
      })),
      
      updateDetectionEvent: (eventId: string, updates: Partial<DetectionEvent>) => set((state) => ({
        recentEvents: state.recentEvents.map(e => 
          e.id === eventId ? { ...e, ...updates } : e
        )
      })),
      
      clearRecentEvents: () => set({ recentEvents: [] }),
      
      setAutoCreatePOI: (value) => set((state) => ({
        config: { ...state.config, autoCreatePOI: value }
      })),
      
      setCaptureSnapshot: (value) => set((state) => ({
        config: { ...state.config, captureSnapshot: value }
      })),
      
      resetToDefaults: () => set({
        config: DEFAULT_DRY_RUN_CONFIG,
        detectionStates: new Map(),
        recentEvents: []
      }),
    }),
    {
      name: 'dry-run-detection-storage',
      partialize: (state) => ({
        config: state.config,
        recentEvents: state.recentEvents,
      }),
    }
  )
);

export const getDryRunStore = () => useDryRunStore.getState();
