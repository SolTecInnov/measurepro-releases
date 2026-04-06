import { create } from 'zustand';
import type { POIType } from './poi';
import { HEIGHT_CLEARANCE_POI_TYPES } from './poi';
import { isBetaUser } from './auth/masterAdmin';
import { getAuth } from 'firebase/auth';

// Fast lookup set for height clearance types
const HEIGHT_CLEARANCE_POI_TYPES_SET = new Set<POIType>(HEIGHT_CLEARANCE_POI_TYPES);

// Available actions that can be assigned to POI types
export type POIAction = 
  | 'auto-capture-and-log'        // Auto-capture image and log entry with measurement
  | 'auto-capture-no-measurement' // Auto-capture image and log entry WITHOUT measurement
  | 'open-manual-modal'           // Open manual log entry modal
  | 'voice-note'                  // Open voice note recording
  | 'select-only';                // Just select the POI type, no auto-action

export interface POIActionConfig {
  action: POIAction;
  label: string;
  description: string;
}

export const POI_ACTIONS: POIActionConfig[] = [
  {
    action: 'auto-capture-and-log',
    label: 'Auto-Capture & Log',
    description: 'Automatically captures image and logs entry when measurement is taken'
  },
  {
    action: 'auto-capture-no-measurement',
    label: 'Auto-Capture (No Measurement)',
    description: 'Automatically captures image and logs entry without requiring measurement'
  },
  {
    action: 'open-manual-modal',
    label: 'Open Manual Entry Modal',
    description: 'Opens manual log entry dialog for detailed information'
  },
  {
    action: 'voice-note',
    label: 'Voice Note',
    description: 'Opens voice note recording modal'
  },
  {
    action: 'select-only',
    label: 'Select Only',
    description: 'Just selects the POI type without any automatic action'
  }
];

// Default action assignments for each POI type
// Rule: no POI type should have 'select-only' as a system default.
// Users can override to 'select-only' via their own settings (saved in localStorage).
const DEFAULT_POI_ACTIONS: Record<POIType, POIAction> = {
  // ── Auto-capture-and-log (overhead / laser height required) ──────────────
  wire: 'auto-capture-and-log',
  powerLine: 'auto-capture-and-log',
  powerNoSlack: 'auto-capture-and-log',
  powerSlack: 'auto-capture-and-log',
  highVoltage: 'auto-capture-and-log',
  trafficLight: 'auto-capture-and-log',
  trafficWire: 'auto-capture-and-log',
  trafficMast: 'auto-capture-and-log',
  trafficSignalizationTruss: 'auto-capture-and-log',
  overpass: 'auto-capture-and-log',
  pedestrianBridge: 'auto-capture-and-log',
  motorcycleBridge: 'auto-capture-and-log',
  flyover: 'auto-capture-and-log',
  tunnel: 'auto-capture-and-log',
  signalization: 'auto-capture-and-log',
  signMast: 'auto-capture-and-log',
  signTruss: 'auto-capture-and-log',
  vmsTruss: 'auto-capture-and-log',
  vmsMast: 'auto-capture-and-log',
  opticalFiber: 'auto-capture-and-log',
  communicationCable: 'auto-capture-and-log',
  communicationCluster: 'auto-capture-and-log',
  overheadStructure: 'auto-capture-and-log',
  bridgeAndWires: 'auto-capture-and-log',
  tollTruss: 'auto-capture-and-log',
  railroadMast: 'auto-capture-and-log',
  railroadTruss: 'auto-capture-and-log',
  lightPole: 'auto-capture-and-log',
  pipeRack: 'auto-capture-and-log',
  tree: 'auto-capture-and-log',
  railroad: 'auto-capture-and-log',

  // ── Auto-capture-no-measurement (drive-over / route points) ─────────────
  bridge: 'auto-capture-no-measurement',
  road: 'auto-capture-no-measurement',
  intersection: 'auto-capture-no-measurement',
  roundabout: 'auto-capture-no-measurement',
  culvert: 'auto-capture-no-measurement',
  railroadCrossing: 'auto-capture-no-measurement',
  gravelRoad: 'auto-capture-no-measurement',
  unpavedRoad: 'auto-capture-no-measurement',
  gradeUp: 'auto-capture-no-measurement',
  gradeDown: 'auto-capture-no-measurement',
  grade10to12Up: 'auto-capture-no-measurement',
  grade10to12Down: 'auto-capture-no-measurement',
  grade12to14Up: 'auto-capture-no-measurement',
  grade12to14Down: 'auto-capture-no-measurement',
  grade14PlusUp: 'auto-capture-no-measurement',
  grade14PlusDown: 'auto-capture-no-measurement',
  passingLane: 'auto-capture-no-measurement',
  parking: 'auto-capture-no-measurement',
  emergencyParking: 'auto-capture-no-measurement',
  deadEnd: 'auto-capture-no-measurement',
  tollPlaza: 'auto-capture-no-measurement',
  leftTurn: 'auto-capture-no-measurement',
  rightTurn: 'auto-capture-no-measurement',
  uTurn: 'auto-capture-no-measurement',
  highwayEntrance: 'auto-capture-no-measurement',
  highwayExit: 'auto-capture-no-measurement',
  autoturnRequired: 'auto-capture-no-measurement',

  // ── Open-manual-modal (requires user input) ──────────────────────────────
  danger: 'open-manual-modal',
  information: 'open-manual-modal',
  importantNote: 'open-manual-modal',
  workRequired: 'open-manual-modal',
  restricted: 'open-manual-modal',
  lateralObstruction: 'open-manual-modal',
  construction: 'open-manual-modal',
  gate: 'open-manual-modal',
  pitch: 'open-manual-modal',
  roll: 'open-manual-modal',
  clearNote: 'open-manual-modal',
  logNote: 'open-manual-modal',

  // ── Voice note ───────────────────────────────────────────────────────────
  voiceNote: 'voice-note',
};

// Beta-specific defaults (no laser) — overhead types use auto-capture-no-measurement instead
const BETA_POI_ACTIONS: Record<POIType, POIAction> = {
  // ── Auto-capture-no-measurement (everything that isn't modal/voice) ──────
  wire: 'auto-capture-no-measurement',
  powerLine: 'auto-capture-no-measurement',
  powerNoSlack: 'auto-capture-no-measurement',
  powerSlack: 'auto-capture-no-measurement',
  highVoltage: 'auto-capture-no-measurement',
  trafficLight: 'auto-capture-no-measurement',
  trafficWire: 'auto-capture-no-measurement',
  trafficMast: 'auto-capture-no-measurement',
  trafficSignalizationTruss: 'auto-capture-no-measurement',
  overpass: 'auto-capture-no-measurement',
  pedestrianBridge: 'auto-capture-no-measurement',
  motorcycleBridge: 'auto-capture-no-measurement',
  flyover: 'auto-capture-no-measurement',
  tunnel: 'auto-capture-no-measurement',
  signalization: 'auto-capture-no-measurement',
  signMast: 'auto-capture-no-measurement',
  signTruss: 'auto-capture-no-measurement',
  vmsTruss: 'auto-capture-no-measurement',
  vmsMast: 'auto-capture-no-measurement',
  opticalFiber: 'auto-capture-no-measurement',
  communicationCable: 'auto-capture-no-measurement',
  communicationCluster: 'auto-capture-no-measurement',
  overheadStructure: 'auto-capture-no-measurement',
  bridgeAndWires: 'auto-capture-no-measurement',
  tollTruss: 'auto-capture-no-measurement',
  railroadMast: 'auto-capture-no-measurement',
  railroadTruss: 'auto-capture-no-measurement',
  lightPole: 'auto-capture-no-measurement',
  pipeRack: 'auto-capture-no-measurement',
  tree: 'auto-capture-no-measurement',
  railroad: 'auto-capture-no-measurement',
  bridge: 'auto-capture-no-measurement',
  road: 'auto-capture-no-measurement',
  intersection: 'auto-capture-no-measurement',
  roundabout: 'auto-capture-no-measurement',
  culvert: 'auto-capture-no-measurement',
  railroadCrossing: 'auto-capture-no-measurement',
  gravelRoad: 'auto-capture-no-measurement',
  unpavedRoad: 'auto-capture-no-measurement',
  gradeUp: 'auto-capture-no-measurement',
  gradeDown: 'auto-capture-no-measurement',
  grade10to12Up: 'auto-capture-no-measurement',
  grade10to12Down: 'auto-capture-no-measurement',
  grade12to14Up: 'auto-capture-no-measurement',
  grade12to14Down: 'auto-capture-no-measurement',
  grade14PlusUp: 'auto-capture-no-measurement',
  grade14PlusDown: 'auto-capture-no-measurement',
  passingLane: 'auto-capture-no-measurement',
  parking: 'auto-capture-no-measurement',
  emergencyParking: 'auto-capture-no-measurement',
  deadEnd: 'auto-capture-no-measurement',
  tollPlaza: 'auto-capture-no-measurement',
  leftTurn: 'auto-capture-no-measurement',
  rightTurn: 'auto-capture-no-measurement',
  uTurn: 'auto-capture-no-measurement',
  highwayEntrance: 'auto-capture-no-measurement',
  highwayExit: 'auto-capture-no-measurement',
  autoturnRequired: 'auto-capture-no-measurement',

  // ── Open-manual-modal (identical to default) ─────────────────────────────
  danger: 'open-manual-modal',
  information: 'open-manual-modal',
  importantNote: 'open-manual-modal',
  workRequired: 'open-manual-modal',
  restricted: 'open-manual-modal',
  lateralObstruction: 'open-manual-modal',
  construction: 'open-manual-modal',
  gate: 'open-manual-modal',
  pitch: 'open-manual-modal',
  roll: 'open-manual-modal',
  clearNote: 'open-manual-modal',
  logNote: 'open-manual-modal',

  // ── Voice note ───────────────────────────────────────────────────────────
  voiceNote: 'voice-note',
};

// Extend defaults to include the "None" / empty POI type so users can configure
// what happens when no specific POI type is selected.
(DEFAULT_POI_ACTIONS as Record<string, POIAction>)[''] = 'select-only';

interface POIActionsStore {
  poiActions: Record<string, POIAction>;
  getActionForPOI: (poiType: POIType | string) => POIAction;
  setActionForPOI: (poiType: POIType | string, action: POIAction) => void;
  resetToDefaults: () => void;
  resetPOIToDefault: (poiType: POIType | string) => void;
}

export const usePOIActionsStore = create<POIActionsStore>((set, get) => {
  // Config version — bump this when defaults change to force a reset of stale localStorage
  const CONFIG_VERSION = '15.4.1';
  const CONFIG_VERSION_KEY = 'poi_action_config_version';

  // Load from localStorage or use defaults
  const loadSavedActions = (): Record<string, POIAction> => {
    const auth = getAuth();
    const isBeta = isBetaUser(auth.currentUser);
    const baseDefaults = isBeta ? BETA_POI_ACTIONS : DEFAULT_POI_ACTIONS;

    try {
      // Check if saved config matches current version
      // If not, wipe stale config and use fresh defaults
      const savedVersion = localStorage.getItem(CONFIG_VERSION_KEY);
      if (savedVersion !== CONFIG_VERSION) {
        console.log('[POIActions] Config version mismatch — resetting to defaults', savedVersion, '→', CONFIG_VERSION);
        localStorage.removeItem('poi_action_config');
        localStorage.setItem(CONFIG_VERSION_KEY, CONFIG_VERSION);
        return baseDefaults;
      }

      const saved = localStorage.getItem('poi_action_config');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Merge with defaults to ensure all POI types are present
        // Defaults WIN for any HEIGHT_CLEARANCE types to prevent broken logging
        const merged = { ...parsed, ...baseDefaults }; // defaults override stale saved values
        // But allow user customizations for non-height-clearance types
        Object.keys(parsed).forEach(key => {
          if (!HEIGHT_CLEARANCE_POI_TYPES_SET.has(key as POIType)) {
            merged[key] = parsed[key];
          }
        });
        return merged;
      }
    } catch (error) {
      console.error('Failed to load POI action config:', error);
    }
    return baseDefaults;
  };

  return {
    poiActions: loadSavedActions(),
    
    getActionForPOI: (poiType: POIType) => {
      // Check store first, then official defaults, then safe fallback
      const stored = get().poiActions[poiType];
      if (stored) return stored;
      // Fall back to official defaults (not 'auto-capture-no-measurement' which silently blocks logging)
      const auth = getAuth();
      const isBeta = isBetaUser(auth.currentUser);
      const baseDefaults = isBeta ? BETA_POI_ACTIONS : DEFAULT_POI_ACTIONS;
      return baseDefaults[poiType as POIType] || 'auto-capture-and-log'; // HEIGHT_CLEARANCE types default to auto-capture-and-log
    },
    
    setActionForPOI: (poiType: POIType, action: POIAction) => {
      const newActions = { ...get().poiActions, [poiType]: action };
      set({ poiActions: newActions });
      localStorage.setItem('poi_action_config', JSON.stringify(newActions));
      localStorage.setItem('poi_action_config_version', '15.4.1');
    },
    
    resetToDefaults: () => {
      const auth = getAuth();
      const isBeta = isBetaUser(auth.currentUser);
      const baseDefaults = isBeta ? BETA_POI_ACTIONS : DEFAULT_POI_ACTIONS;
      // Remove localStorage override so fresh defaults take effect immediately
      localStorage.removeItem('poi_action_config');
      set({ poiActions: baseDefaults });
    },
    
    resetPOIToDefault: (poiType: POIType) => {
      const auth = getAuth();
      const isBeta = isBetaUser(auth.currentUser);
      const baseDefaults = isBeta ? BETA_POI_ACTIONS : DEFAULT_POI_ACTIONS;
      const defaultAction = baseDefaults[poiType];
      get().setActionForPOI(poiType, defaultAction);
    }
  };
});
