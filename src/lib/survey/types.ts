import { DBSchema } from 'idb';

export interface Survey {
  id: string;
  surveyTitle: string;
  surveyorName: string;
  clientName: string;
  projectNumber: string;
  originAddress: string;
  destinationAddress: string;
  description: string;
  notes: string;
  ownerEmail: string;
  completionEmailList?: string[];
  enableVehicleTrace: boolean;
  enableAlertLog: boolean;
  active: boolean;
  createdAt: string;
  closedAt?: string;
  cloudUploadStatus: string | null;
  syncId: string | null;
  exportTarget: string | null;
  convoyId: string | null;
  fleetUnitRole: string | null;
  plannedRouteId: string | null;
  routeAnalysis: string | null;
  aiUserModelId: string | null;
  aiHistoryScore: number | null;
  interventionType: string | null;
  checklistCompleted: boolean;
  outputFiles?: string[];
  name?: string;
  customerName?: string;
  surveyor?: string;
  isActive?: boolean;
  
  // Survey Part Tracking (for multi-part surveys after crash/continuation)
  rootSurveyId?: string | null;     // ID of the original Part 1 survey (null for Part 1 itself)
  partOrdinal?: number;              // Part number: 1, 2, 3, etc. (default 1)
  partLabel?: string | null;         // Display label: "Part 1", "Part 2", etc.
  maxPoiPerPart?: number;            // Maximum POIs before auto-split (default 200)
  poiCount?: number;                 // Current POI count in this part
  closureReason?: 'completed' | 'continuation' | 'error' | 'end_of_day' | null;  // Why survey was closed
  pausedAt?: string | null;          // ISO timestamp when survey was paused via End Day
  
  // Import tracking (for surveys loaded from ZIP files)
  importedAt?: string;               // ISO timestamp when survey was imported
  importedFrom?: string;             // Filename the survey was imported from
  lastSyncedAt?: string;             // Last successful cloud sync timestamp
}

export interface Route {
  id: string;
  surveyId: string;
  name: string;
  routeNumber: number;
  createdAt: string;
}

export interface Alert {
  id: string;
  surveyId: string;
  type: 'WARNING' | 'DANGER';
  value: number;
  latitude: number;
  longitude: number;
  poiId: string | null;
  createdAt: string;
}

export interface VehicleTrace {
  id: string;
  surveyId: string;
  routeId: string;
  latitude: number;
  longitude: number;
  speed: number;
  heading: number;
  timestamp: string;
}

export interface Measurement {
  id: string;  // GLOBALLY UNIQUE POI ID - Use this for all file naming and cross-survey references
  rel: number | null;  // Height measurement in meters (x.xx format), null for measurement-free POIs
  altGPS: number | null;
  latitude: number;
  longitude: number;
  utcDate: string;
  utcTime: string;
  speed: number | null;
  heading: number | null;
  videoUrl?: string | null;
  videoBlobId?: string | null;
  videoTimestamp?: number | null;
  roadNumber: number | null;      // Legacy: sequential road number (display only)
  poiNumber: number | null;        // Legacy: sequential POI number within survey (display only)
  note: string | null;
  createdAt: string;
  user_id: string;  // Survey ID this POI belongs to
  source?: 'manual' | 'all' | 'detection' | 'slaveApp';
  widthMeasure?: number | null;
  lengthMeasure?: number | null;
  drawingUrl?: string | null;
  poi_type?: string;
  imageUrl?: string | null;
  images?: string[];
  timelapseFrameNumber?: number | null;
  measurementFree?: boolean;
  
  // New: Cross-survey linking (for multi-part surveys)
  globalPoiIndex?: number;        // Global sequential index across all parts of a route
  surveyPartOrdinal?: number;     // Which part this POI belongs to (1, 2, 3...)
  
  // Lateral/Rear overhang measurements (multi-laser system)
  lateralSubType?: 'leftLateral' | 'rightLateral' | 'totalWidth' | 'rearOverhang' | null;
  leftClearance?: number | null;      // Left lateral clearance in meters
  rightClearance?: number | null;     // Right lateral clearance in meters
  totalWidth?: number | null;         // Total road/clearance width in meters
  rearDistance?: number | null;       // Rear overhang distance in meters

  // GPS quality tagging
  noGpsFix?: boolean;                 // true when measurement was recorded without a valid GPS fix
  cloudUploadStatus?: string | null;  // cloud upload tracking
}

export interface SurveyDB extends DBSchema {
  surveys: {
    key: string;
    value: Survey;
    indexes: { 'by-date': string };
  };
  measurements: {
    key: string;
    value: Measurement;
    indexes: { 'by-date': string };
  };
}

export interface SurveyStore {
  activeSurvey: Survey | null;
  currentRoute: Route | null;
  surveys: Survey[];
  routes: Route[];
  alerts: Alert[];
  vehicleTraces: VehicleTrace[];
  setActiveSurvey: (survey: Survey | null) => void;
  setCurrentRoute: (route: Route | null) => void;
  setSurveys: (surveys: Survey[]) => void;
  setRoutes: (routes: Route[]) => void;
  setAlerts: (alerts: Alert[]) => void;
  setVehicleTraces: (traces: VehicleTrace[]) => void;
  createSurvey: (survey: Partial<Omit<Survey, 'id' | 'createdAt' | 'active'>>) => Promise<void>;
  createRoute: (name: string) => Promise<void>;
  loadPreviousSurvey: (surveyId: string) => Promise<void>;
  addAlert: (alert: Omit<Alert, 'id' | 'createdAt' | 'surveyId'>) => Promise<void>;
  addVehicleTrace: (trace: Omit<VehicleTrace, 'id' | 'surveyId' | 'routeId'>) => Promise<void>;
  closeSurvey: (reason?: 'completed' | 'continuation' | 'error') => Promise<void>;
  endDaySurvey: () => Promise<void>;
  clearSurvey: () => Promise<void>;
  loadSurveys: () => Promise<void>;
  loadRoutes: () => Promise<void>;
  loadAlerts: () => Promise<void>;
  loadVehicleTraces: () => Promise<void>;
  updateSurvey: (survey: any) => Promise<void>;
  exportSurvey: (format: 'csv' | 'json' | 'geojson') => Promise<void>;
  importSurveysFromFirebase?: () => Promise<void>;
}