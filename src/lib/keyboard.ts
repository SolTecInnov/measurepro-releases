import { create } from 'zustand';

export type POIType = 'bridge' | 'tree' | 'wire' | 'powerLine' | 'trafficLight' | 'overpass' |
  'lateralObstruction' | 'road' | 'intersection' | 'signalization' | 'railroad' | 'information' |
  'danger' | 'importantNote' | 'workRequired' | 'restricted' | 'bridgeAndWires' |
  'gradeUp' | 'gradeDown' | 'autoturnRequired' | 'voiceNote' | 'opticalFiber' | 'passingLane' |
  'parking' | 'overheadStructure' | 'gravelRoad' | 'deadEnd' | 'culvert' | 'emergencyParking' | 'roundabout' |
  'powerNoSlack' | 'powerSlack' | 'highVoltage' |
  'communicationCable' | 'communicationCluster' |
  'pedestrianBridge' | 'motorcycleBridge' | 'tunnel' | 'flyover' |
  'trafficWire' | 'trafficMast' | 'trafficSignalizationTruss' |
  'tollTruss' | 'tollPlaza' | 'pipeRack' | 'lightPole' |
  'railroadMast' | 'railroadTruss' | 'railroadCrossing' |
  'signMast' | 'signTruss' | 'vmsTruss' | 'vmsMast' |
  'leftTurn' | 'rightTurn' | 'uTurn' | 'highwayEntrance' | 'highwayExit' |
  'clearNote' | 'logNote' | 'construction' | 'gate' |
  'pitch' | 'roll' | 'unpavedRoad';

// List of reserved system shortcuts that cannot be used
export const RESERVED_SHORTCUTS = [
  { keys: ['Control', 'Alt', 'Delete'], description: 'System: Task Manager' },
  { keys: ['Alt', 'F4'], description: 'System: Close Window' },
  { keys: ['Alt', 'Tab'], description: 'System: Switch Application' },
  { keys: ['Windows'], description: 'System: Start Menu' },
  { keys: ['Control', 'W'], description: 'Browser: Close Tab' },
  { keys: ['Control', 'Q'], description: 'Browser: Quit' },
  { keys: ['Control', 'T'], description: 'Browser: New Tab' },
  { keys: ['Control', 'N'], description: 'Browser: New Window' },
  { keys: ['F1'], description: 'System: Help' }
];

export interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  description: string;
  isValid?: boolean;
  invalidReason?: string;
}

export interface KeyboardMapping {
 
  capture: KeyboardShortcut;

  clearAlert: KeyboardShortcut;

  clearImages: KeyboardShortcut;

  logMeasurement: KeyboardShortcut;

  deleteLastEntry: KeyboardShortcut;

  nonePoiType: KeyboardShortcut;

  manualLogEntry: KeyboardShortcut;

  envelopeMonitoring: {
    toggleEnvelope: KeyboardShortcut;
    cycleProfile: KeyboardShortcut;
  };
 
  detectionControls: {
    toggleCityMode: KeyboardShortcut;
  };

  loggingControls: {
    startLog: KeyboardShortcut;
    stopLog: KeyboardShortcut;
    pauseLog: KeyboardShortcut;
    resumeLog: KeyboardShortcut;
    modeManual: KeyboardShortcut;
    modeAllData: KeyboardShortcut;
    modeDetection: KeyboardShortcut;
    modeManualDetection: KeyboardShortcut;
    modeCounterDetection: KeyboardShortcut;
    clearAlerts: KeyboardShortcut;
    startGPSTrace: KeyboardShortcut;
  };
  aiDetection: {
    acceptDetection: KeyboardShortcut;
    rejectDetection: KeyboardShortcut;
    correctDetection: KeyboardShortcut;
    testDetection: KeyboardShortcut;
  };
  videoRecording: {
    toggleRecording: KeyboardShortcut;
  };
  lateralRearCapture: {
    captureLeft: KeyboardShortcut;
    captureRight: KeyboardShortcut;
    captureTotal: KeyboardShortcut;
    captureRear: KeyboardShortcut;
  };
  poiTypes: Record<POIType, KeyboardShortcut>;
}

const defaultMapping: KeyboardMapping = {
  capture: { key: '1', alt: true, description: 'Capture Image' },
  clearAlert: { key: '2', alt: true, description: 'Clear Alert' },
  clearImages: { key: 'C', alt: true, description: 'Clear All Captured Images' },
  logMeasurement: { key: 'G', alt: true, description: 'Log Measurement' },
  deleteLastEntry: { key: 'Backspace', ctrl: true, description: 'Delete Last Entry' },
  nonePoiType: { key: 'N', alt: true, shift: true, description: 'Deselect POI Type (None)' },
  manualLogEntry: { key: 'M', alt: true, shift: true, description: 'Open Manual Log Entry Modal' },
  envelopeMonitoring: {
    toggleEnvelope: { key: 'E', alt: true, shift: true, description: 'Toggle Envelope Monitoring' },
    cycleProfile: { key: 'P', alt: true, shift: true, description: 'Cycle Vehicle Profiles' }
  },
  detectionControls: {
    toggleCityMode: { key: 'Y', alt: true, shift: true, description: 'Toggle City Mode' }
  },
  loggingControls: {
    startLog: { key: '3', alt: true, description: 'Start Logging' },
    stopLog: { key: '4', alt: true, description: 'Stop Logging' },
    pauseLog: { key: '5', alt: true, description: 'Pause Logging' },
    resumeLog: { key: '6', alt: true, description: 'Resume Logging' },
    modeManual: { key: 'm', alt: true, description: 'Switch to Manual Mode' },
    modeAllData: { key: 'a', alt: true, description: 'Switch to All Data Mode' },
    modeDetection: { key: 'd', alt: true, description: 'Switch to Detection Mode (AI)' },
    modeManualDetection: { key: 's', alt: true, shift: true, description: 'Switch to Manual Detection Mode' },
    modeCounterDetection: { key: 'c', alt: true, shift: true, description: 'Switch to Counter Detection Mode' },
    clearAlerts: { key: 'z', alt: true, description: 'Clear All Alerts' },
    startGPSTrace: { key: '7', alt: true, description: 'Start GPS Trace' }
  },
  aiDetection: {
    acceptDetection: { key: '7', alt: true, description: 'Accept Detection' },
    rejectDetection: { key: '8', alt: true, description: 'Reject Detection' },
    correctDetection: { key: '9', alt: true, description: 'Correct Detection' },
    testDetection: { key: '0', alt: true, description: 'Test Detection' }
  },
  videoRecording: {
    toggleRecording: { key: 'V', alt: true, description: 'Start/Stop Video Recording' }
  },
  lateralRearCapture: {
    captureLeft: { key: '[', alt: true, description: 'Capture Left Lateral Clearance POI' },
    captureRight: { key: ']', alt: true, description: 'Capture Right Lateral Clearance POI' },
    captureTotal: { key: '\\', alt: true, description: 'Capture Total Width POI' },
    captureRear: { key: '\'', alt: true, description: 'Capture Rear Overhang POI' }
  },
  poiTypes: {
    bridge: { key: 'b', alt: true, description: 'Bridge' },
    tree: { key: 't', alt: true, description: 'Trees' },
    wire: { key: 'w', alt: true, description: 'Wire' },
    powerLine: { key: 'p', alt: true, description: 'Power Line' },
    trafficLight: { key: 'l', alt: true, description: 'Traffic Light' },
    overpass: { key: 'k', alt: true, description: 'Overpass' },
    lateralObstruction: { key: 'o', alt: true, description: 'Lateral Obstruction' },
    road: { key: 'r', alt: true, description: 'Road' },
    intersection: { key: 'i', alt: true, description: 'Intersection' },
    signalization: { key: 'u', alt: true, description: 'Signalization' },
    railroad: { key: 'q', alt: true, description: 'Railroad' },
    information: { key: 'n', alt: true, description: 'Information' },
    danger: { key: 'h', alt: true, description: 'Danger' },
    importantNote: { key: 'j', alt: true, description: 'Important Note' },
    workRequired: { key: 'f', alt: true, description: 'Work Required' },
    restricted: { key: 'x', alt: true, description: 'Restricted' },
    bridgeAndWires: { key: 'B', alt: true, shift: true, description: 'Bridge & Wires' },
    gradeUp: { key: 'U', alt: true, shift: true, description: 'Grade UP (12%+)' },
    gradeDown: { key: 'D', alt: true, shift: true, description: 'Grade Down (12%+)' },
    autoturnRequired: { key: 'A', alt: true, shift: true, description: 'Autoturn Required' },
    voiceNote: { key: 'N', alt: true, shift: true, description: 'Voice Note' },
    opticalFiber: { key: 'F', alt: true, shift: true, description: 'Optical Fiber' },
    passingLane: { key: 'L', alt: true, shift: true, description: 'Passing Lane' },
    parking: { key: 'K', alt: true, shift: true, description: 'Parking' },
    overheadStructure: { key: 'O', alt: true, shift: true, description: 'Overhead Structure' },
    gravelRoad: { key: 'G', alt: true, shift: true, description: 'Gravel Road' },
    deadEnd: { key: 'e', alt: true, description: 'Dead End' },
    culvert: { key: 'c', alt: true, description: 'Culvert' },
    emergencyParking: { key: 'R', alt: true, shift: true, description: 'Emergency Parking' },
    roundabout: { key: 'y', alt: true, description: 'Roundabout' },
    // Power group
    powerNoSlack: { key: 'H', alt: true, shift: true, description: 'Power No Slack' },
    powerSlack: { key: 'V', alt: true, shift: true, description: 'Power Slack' },
    highVoltage: { key: 'Q', alt: true, shift: true, description: 'High Voltage' },
    // Communication group
    communicationCable: { key: 'C', ctrl: true, alt: true, description: 'Communication Cable' },
    communicationCluster: { key: 'D', ctrl: true, alt: true, description: 'Communication Cluster' },
    // Bridge/overpass group
    pedestrianBridge: { key: 'P', ctrl: true, alt: true, description: 'Pedestrian Bridge' },
    motorcycleBridge: { key: 'M', ctrl: true, alt: true, description: 'Motorcycle Bridge' },
    tunnel: { key: 'T', ctrl: true, alt: true, description: 'Tunnel' },
    flyover: { key: 'F', ctrl: true, alt: true, description: 'Flyover' },
    // Traffic group
    trafficWire: { key: 'W', ctrl: true, alt: true, description: 'Traffic Wire' },
    trafficMast: { key: 'X', ctrl: true, alt: true, description: 'Traffic Mast' },
    trafficSignalizationTruss: { key: 'S', ctrl: true, alt: true, description: 'Traffic Signalization Truss' },
    // Infrastructure group
    tollTruss: { key: 'L', ctrl: true, alt: true, description: 'Toll Truss' },
    tollPlaza: { key: 'O', ctrl: true, alt: true, description: 'Toll Plaza' },
    pipeRack: { key: 'R', ctrl: true, alt: true, description: 'Pipe Rack' },
    lightPole: { key: 'I', ctrl: true, alt: true, description: 'Light Pole' },
    // Railroad group
    railroadMast: { key: 'J', ctrl: true, alt: true, description: 'Railroad Mast' },
    railroadTruss: { key: 'K', ctrl: true, alt: true, description: 'Railroad Truss' },
    railroadCrossing: { key: 'Q', ctrl: true, alt: true, description: 'Railroad Crossing' },
    // Signage/VMS group
    signMast: { key: 'G', ctrl: true, alt: true, description: 'Sign Mast' },
    signTruss: { key: 'H', ctrl: true, alt: true, description: 'Sign Truss' },
    vmsTruss: { key: 'V', ctrl: true, alt: true, description: 'VMS Truss' },
    vmsMast: { key: 'B', ctrl: true, alt: true, description: 'VMS Mast' },
    // Road/turn group
    leftTurn: { key: 'I', alt: true, shift: true, description: 'Left Turn' },
    rightTurn: { key: 'J', alt: true, shift: true, description: 'Right Turn' },
    uTurn: { key: 'T', alt: true, shift: true, description: 'U-Turn' },
    highwayEntrance: { key: 'W', alt: true, shift: true, description: 'Highway Entrance' },
    highwayExit: { key: 'X', alt: true, shift: true, description: 'Highway Exit' },
    // Notes/log group
    clearNote: { key: 'Z', alt: true, shift: true, description: 'Clear Note' },
    logNote: { key: 'N', ctrl: true, alt: true, description: 'Log Note' },
    construction: { key: 'E', ctrl: true, alt: true, description: 'Construction' },
    gate: { key: 'U', ctrl: true, alt: true, description: 'Gate' },
    // Measurement group
    pitch: { key: 'Y', ctrl: true, alt: true, description: 'Pitch' },
    roll: { key: 'Z', ctrl: true, alt: true, description: 'Roll' },
    // Unpaved road
    unpavedRoad: { key: '2', ctrl: true, alt: true, description: 'Unpaved Road' }
  }
};

interface KeyboardStore {
  mapping: KeyboardMapping;
  validateShortcut: (shortcut: KeyboardShortcut) => { isValid: boolean; reason?: string };
  setMapping: (mapping: KeyboardMapping) => void;
  updateShortcut: (
    action: keyof Omit<KeyboardMapping, 'poiTypes'> | { type: 'poiType'; poiType: POIType },
    shortcut: KeyboardShortcut
  ) => void;
  isShortcutReserved: (shortcut: KeyboardShortcut) => boolean;
  getConflictingShortcut: (shortcut: KeyboardShortcut, excludeAction?: string) => string | null;
}

const isShortcutEqual = (a: KeyboardShortcut, b: KeyboardShortcut): boolean => {
  return a.key === b.key && 
         !!a.ctrl === !!b.ctrl && 
         !!a.alt === !!b.alt && 
         !!a.shift === !!b.shift;
};

export const useKeyboardStore = create<KeyboardStore>((set) => ({
  mapping: defaultMapping,
  validateShortcut: (shortcut: KeyboardShortcut): { isValid: boolean; reason?: string } => {
    // Check if shortcut is reserved
    if (useKeyboardStore.getState().isShortcutReserved(shortcut)) {
      return { 
        isValid: false, 
        reason: 'This shortcut is reserved by the system' 
      };
    }

    // Check for conflicts with existing shortcuts
    const conflict: string | null = useKeyboardStore.getState().getConflictingShortcut(shortcut);
    if (conflict) {
      return { 
        isValid: false, 
        reason: `Conflicts with existing shortcut for: ${conflict}` 
      };
    }

    return { isValid: true };
  },
  isShortcutReserved: (shortcut) => {
    return RESERVED_SHORTCUTS.some(reserved => {
      const reservedShortcut = {
        key: reserved.keys[reserved.keys.length - 1],
        ctrl: reserved.keys.includes('Control'),
        alt: reserved.keys.includes('Alt'),
        shift: reserved.keys.includes('Shift'),
        description: reserved.description
      };
      return isShortcutEqual(shortcut, reservedShortcut);
    });
  },
  getConflictingShortcut: (shortcut: KeyboardShortcut, excludeAction?: string): string | null => {
    const { mapping } = useKeyboardStore.getState();
    
    // Check main actions
    for (const [action, existing] of Object.entries(mapping)) {
      if (action === 'poiTypes' || action === 'loggingControls' || action === 'aiDetection' || action === 'videoRecording' || action === 'envelopeMonitoring' || action === 'detectionControls' || action === 'nonePoiType' || action === 'manualLogEntry' || action === excludeAction) continue;
      if (isShortcutEqual(shortcut, existing as KeyboardShortcut)) {
        return (existing as KeyboardShortcut).description;
      }
    }
    
    // Check envelope monitoring controls
    for (const [action, existing] of Object.entries(mapping.envelopeMonitoring)) {
      if (action === excludeAction) continue;
      if (isShortcutEqual(shortcut, existing as KeyboardShortcut)) {
        return (existing as KeyboardShortcut).description;
      }
    }
    
    // Check detection controls
    for (const [action, existing] of Object.entries(mapping.detectionControls)) {
      if (action === excludeAction) continue;
      if (isShortcutEqual(shortcut, existing as KeyboardShortcut)) {
        return (existing as KeyboardShortcut).description;
      }
    }
    
    // Check logging controls
    for (const [action, existing] of Object.entries(mapping.loggingControls)) {
      if (action === excludeAction) continue;
      if (isShortcutEqual(shortcut, existing as KeyboardShortcut)) {
        return (existing as KeyboardShortcut).description;
      }
    }
    
    // Check AI detection controls
    for (const [action, existing] of Object.entries(mapping.aiDetection)) {
      if (action === excludeAction) continue;
      if (isShortcutEqual(shortcut, existing as KeyboardShortcut)) {
        return (existing as KeyboardShortcut).description;
      }
    }
    
    // Check video recording controls
    for (const [action, existing] of Object.entries(mapping.videoRecording)) {
      if (action === excludeAction) continue;
      if (isShortcutEqual(shortcut, existing as KeyboardShortcut)) {
        return (existing as KeyboardShortcut).description;
      }
    }
    
    // Check POI types
    for (const [type, existing] of Object.entries(mapping.poiTypes)) {
      if (type === excludeAction) continue;
      if (isShortcutEqual(shortcut, existing as KeyboardShortcut)) {
        return (existing as KeyboardShortcut).description;
      }
    }
    
    return null;
  },
  setMapping: (mapping) => set({ mapping }),
  // Remove ability to update shortcuts
  updateShortcut: () => {},
}));