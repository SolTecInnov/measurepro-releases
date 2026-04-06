import { create } from 'zustand';
import type { SweptPathAnalysis } from '@shared/schema';
import type { TurnSnapshot } from '../lib/sweptPath/simulator';
import type { Point } from '../lib/sweptPath/roadDetection';
import { openDB, IDBPDatabase } from 'idb';

interface SweptPathSettings {
  enabled: boolean; // Feature activation status
  autoDetect: boolean; // Auto-detect turns
  animationSpeed: number; // 0.5x - 2.0x
  showRoadBoundaries: boolean;
  showVehicleEnvelope: boolean;
  showCollisionMarkers: boolean;
  showClearanceZones: boolean;
}

interface CurrentAnalysisState {
  id: string;
  vehicleProfileId: string;
  roadBoundaries: {left: Point[], right: Point[]};
  turnRadius: number;
  snapshots: TurnSnapshot[]; // From simulator
  verdict: 'feasible' | 'tight' | 'impossible';
  maxOffTracking: number;
  worstClearance: number;
  timestamp: string;
  captureImageUrl?: string; // Thumbnail
}

interface PlaybackState {
  isPlaying: boolean;
  currentFrame: number;
  totalFrames: number;
  speed: number; // 0.5x - 2.0x
}

interface DebugState {
  isAnalyzing: boolean;
  roadBoundaries: {left: Point[], right: Point[]} | null;
  confidence: number;
}

interface SweptPathStore {
  // Settings
  settings: SweptPathSettings;
  setSettings: (settings: Partial<SweptPathSettings>) => void;
  
  // Current analysis
  currentAnalysis: CurrentAnalysisState | null;
  setCurrentAnalysis: (analysis: CurrentAnalysisState | null) => void;
  
  // Animation playback
  playback: PlaybackState;
  setPlaybackState: (state: Partial<PlaybackState>) => void;
  
  // Debug state (for road detection visualization)
  debugState: DebugState;
  setDebugState: (state: Partial<DebugState>) => void;
  
  // Analysis history
  analysisHistory: SweptPathAnalysis[];
  addToHistory: (analysis: SweptPathAnalysis) => void;
  removeFromHistory: (id: string) => void;
  clearHistory: () => void;
  
  // IndexedDB persistence
  loadFromIndexedDB: () => Promise<void>;
  saveToIndexedDB: () => Promise<void>;
}

// IndexedDB setup
const DB_NAME = 'MeasurePRO';
const DB_VERSION = 1;
const STORE_NAME = 'sweptPathAnalyses';
const SETTINGS_STORE_NAME = 'sweptPathSettings';

async function initDB(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(SETTINGS_STORE_NAME)) {
        db.createObjectStore(SETTINGS_STORE_NAME);
      }
    },
  });
}

export const useSweptPathStore = create<SweptPathStore>((set, get) => ({
  // Default settings
  settings: {
    enabled: false,
    autoDetect: true,
    animationSpeed: 1.0,
    showRoadBoundaries: true,
    showVehicleEnvelope: true,
    showCollisionMarkers: true,
    showClearanceZones: true,
  },

  setSettings: (newSettings) => {
    set((state) => ({
      settings: { ...state.settings, ...newSettings },
    }));
    get().saveToIndexedDB();
  },

  // Current analysis
  currentAnalysis: null,
  setCurrentAnalysis: (analysis) => {
    set({ currentAnalysis: analysis });
  },

  // Animation playback
  playback: {
    isPlaying: false,
    currentFrame: 0,
    totalFrames: 0,
    speed: 1.0,
  },

  setPlaybackState: (newState) => {
    set((state) => ({
      playback: { ...state.playback, ...newState },
    }));
  },

  // Debug state
  debugState: {
    isAnalyzing: false,
    roadBoundaries: null,
    confidence: 0,
  },

  setDebugState: (newState) => {
    set((state) => ({
      debugState: { ...state.debugState, ...newState },
    }));
  },

  // Analysis history
  analysisHistory: [],

  addToHistory: (analysis) => {
    set((state) => ({
      analysisHistory: [...state.analysisHistory, analysis],
    }));
    get().saveToIndexedDB();
  },

  removeFromHistory: (id) => {
    set((state) => ({
      analysisHistory: state.analysisHistory.filter((a) => a.id !== id),
    }));
    get().saveToIndexedDB();
  },

  clearHistory: () => {
    set({ analysisHistory: [] });
    get().saveToIndexedDB();
  },

  // IndexedDB persistence
  loadFromIndexedDB: async () => {
    try {
      const db = await initDB();

      // Load settings
      const savedSettings = await db.get(SETTINGS_STORE_NAME, 'settings');
      if (savedSettings) {
        set({ settings: savedSettings });
      }

      // Load analysis history
      const analyses = await db.getAll(STORE_NAME);
      if (analyses && analyses.length > 0) {
        set({ analysisHistory: analyses });
      }
    } catch (error) {
      // Silent fail
    }
  },

  saveToIndexedDB: async () => {
    try {
      const db = await initDB();
      const { settings, analysisHistory } = get();

      // Save settings
      await db.put(SETTINGS_STORE_NAME, settings, 'settings');

      // Save all analyses
      const tx = db.transaction(STORE_NAME, 'readwrite');
      await tx.store.clear();
      for (const analysis of analysisHistory) {
        await tx.store.put(analysis);
      }
      await tx.done;
    } catch (error) {
      // Silent fail
    }
  },
}));
