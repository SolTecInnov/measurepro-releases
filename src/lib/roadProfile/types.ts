/**
 * Road Profile Types
 * Canonical data model for road profiling with grade and K-factor analysis
 */

import type { GnssSource, FixQuality } from '../../../server/gnss/types';

// Alert types
export type GradeAlertType = 'NONE' | 'GRADE_12_UP' | 'GRADE_12_DOWN';
export type KAlertType = 'NONE' | 'K_OVER_10';
export type AlertType = 'GRADE_12_UP' | 'GRADE_12_DOWN' | 'K_OVER_10';

// Banking/Cross-slope alert classifications for heavy haul safety
export type BankingAlertLevel = 'NORMAL' | 'CAUTION' | 'WARNING' | 'CRITICAL' | 'UNACCEPTABLE';

// Cross-slope detection mode
export type CrossSlopeMode = 'raw' | 'filtered' | 'stopped';

// Curve radius alert
export type RadiusAlertType = 'NONE' | 'BELOW_MINIMUM';

/**
 * Banking/Cross-slope thresholds (in degrees)
 * Default values based on heavy haul industry standards
 */
export interface BankingThresholds {
  normalMax: number;      // 0-3° default
  cautionMax: number;     // 3-5° default
  warningMax: number;     // 5-7° default
  criticalMax: number;    // 7-10° default
  // >criticalMax = UNACCEPTABLE (>10° default)
}

/**
 * Cross-slope/Banking sample data
 */
export interface CrossSlopeData {
  crossSlope_deg: number;         // Cross-slope in degrees (from IMU roll)
  bankingAlert: BankingAlertLevel; // Alert classification
  isFiltered: boolean;            // True if value was filtered (vs raw)
  vehicleSpeed_mps?: number;      // Speed when measured (for filtering context)
}

/**
 * Curve radius data
 */
export interface CurveRadiusData {
  curveRadius_m: number | null;   // Calculated curve radius in meters (null if straight)
  radiusAlert: RadiusAlertType;   // Alert if below minimum
  isCurve: boolean;               // True if vehicle is on a curve (radius < threshold)
}

// Grade segment categories (for threshold-based POI logging)
export type GradeCategory = 'normal' | 'grade10to12' | 'grade12to14' | 'grade14plus' | 'kFactor';
export type GradeDirection = 'up' | 'down';

export interface GradeSegmentEvent {
  id: string;
  category: GradeCategory;
  direction: GradeDirection;
  startLat: number;
  startLon: number;
  endLat: number;
  endLon: number;
  startChainage_m: number;
  endChainage_m: number;
  length_m: number;
  maxGrade_pct: number;
  avgGrade_pct: number;
  startTimestamp: string;
  endTimestamp: string;
}

// Profile recording state
export type ProfileRecordingState = 'idle' | 'recording' | 'paused';

// GPS source for profile recording
export type ProfileGpsSource = 'duro' | 'serial' | 'bluetooth' | 'browser' | 'auto';

/**
 * Raw GPS sample used for profile building
 * Can come from Duro hardware or browser GPS
 */
export interface ProfileGpsSample {
  timestamp: string;      // ISO 8601
  latitude: number;
  longitude: number;
  altitude: number | null;
  speed: number | null;   // m/s
  heading: number | null; // degrees 0-360
  accuracy?: number;      // meters
  source: GnssSource | 'browser';
  quality?: FixQuality | 'browser';
  hdop?: number | null;
  numSats?: number | null;
  
  // IMU attitude data (from Duro)
  roll_deg?: number | null;   // Vehicle roll in degrees
  pitch_deg?: number | null;  // Vehicle pitch in degrees
  
  // Banking/Cross-slope data (calculated from IMU)
  crossSlope_deg?: number | null;     // Cross-slope in degrees
  bankingAlert?: BankingAlertLevel;   // Alert level for cross-slope
  
  // Curve radius data (calculated from trajectory)
  curveRadius_m?: number | null;      // Curve radius in meters
  radiusAlert?: RadiusAlertType;      // Alert if below minimum
}

/**
 * Road Profile Point
 * Individual point on the road profile with computed metrics
 */
export interface RoadProfilePoint {
  profileId: string;            // Link to survey/profile session
  chainage_m: number;           // Distance from profile start (0 at start)
  lat: number;                  // WGS84
  lon: number;                  // WGS84
  elev_m: number;               // Elevation in meters (0 when GPS lacks altitude)
  altitudeAvailable: boolean;   // True when source GPS provided a non-null altitude
  grade_pct: number;            // Signed grade percentage (positive = uphill)
  k_factor: number;             // Vertical curvature metric
  speed_kmh?: number;           // Speed in km/h (if available)
  timestamp_iso: string;        // ISO 8601 timestamp
  quality: string;              // GPS fix quality indicator
  grade_alert_type: GradeAlertType;
  k_alert: KAlertType;
}

/**
 * Road Profile Alert Segment
 * Contiguous section of road with grade or K-factor alerts
 */
export interface RoadProfileAlertSegment {
  alert_id: string;
  alert_type: AlertType;
  from_chainage_m: number;
  to_chainage_m: number;
  length_m: number;
  max_grade_pct: number;
  min_grade_pct: number;
  max_k_factor: number;
  lat: number;                  // Representative location (midpoint or max grade point)
  lon: number;
  notes?: string;
}

/**
 * Road Profile Summary Segment
 * Fixed-length segment for summary export (e.g., every 50m)
 */
export interface RoadProfileSummarySegment {
  segment_id: string;
  from_chainage_m: number;
  to_chainage_m: number;
  length_m: number;
  avg_grade_pct: number;
  max_up_grade_pct: number;
  max_down_grade_pct: number;
  has_alert_over_12pct: boolean;
  notes?: string;
}

/**
 * Road Profile Section
 * User-marked section within a profile (for partial recording)
 */
export interface RoadProfileSection {
  id: string;
  profileId: string;
  surveyId: string;
  label: string;
  from_chainage_m: number;
  to_chainage_m: number;
  start_timestamp: string;
  end_timestamp: string;
  start_lat: number;
  start_lon: number;
  end_lat: number;
  end_lon: number;
  notes?: string;
}

/**
 * Road Profile Session
 * Complete profile recording session linked to a survey
 */
export interface RoadProfileSession {
  id: string;
  surveyId: string;
  name?: string;
  gpsSource: ProfileGpsSource;
  state: ProfileRecordingState;
  created_at: string;
  updated_at: string;
  start_timestamp?: string;
  end_timestamp?: string;
  total_distance_m: number;
  total_samples: number;
  sections: RoadProfileSection[];
  thresholds: ProfileThresholds;
}

/**
 * Profile thresholds configuration
 */
export interface ProfileThresholds {
  grade_up_alert_pct: number;       // Default: 12
  grade_down_alert_pct: number;     // Default: -12
  k_factor_alert: number;           // Default: 10
  sample_interval_m?: number;       // Optional: minimum distance between samples
}

/**
 * In-memory buffer for real-time profile recording
 * Used for fast UI updates before persisting to IndexedDB
 */
export interface ProfileRecordingBuffer {
  sessionId: string;
  surveyId: string;
  samples: ProfileGpsSample[];
  computedPoints: RoadProfilePoint[];
  lastChainage: number;
  lastUpdateTime: number;
  sectionMarkers: SectionMarker[];
}

/**
 * Section marker for marking start/end of sections
 */
export interface SectionMarker {
  type: 'start' | 'end';
  timestamp: string;
  chainage_m: number;
  lat: number;
  lon: number;
  label?: string;
}

/**
 * Complete profile data for export
 */
export interface RoadProfileExportData {
  session: RoadProfileSession;
  points: RoadProfilePoint[];
  alertSegments: RoadProfileAlertSegment[];
  summarySegments: RoadProfileSummarySegment[];
  sections: RoadProfileSection[];
}

/**
 * Profile recording statistics (for UI display)
 */
export interface ProfileRecordingStats {
  duration_s: number;
  distance_m: number;
  samples: number;
  currentGrade_pct: number;
  currentKFactor: number;
  alertCount: number;
  currentElevation_m: number;
  gpsSource: ProfileGpsSource;
  gpsQuality: string;
}

/**
 * Wind Blade Transport Configuration
 * For detecting ground contact risk on vertical curves
 */
export interface WindBladeConfig {
  totalLength_m: number;          // Total transport length (truck + trailer + load)
  rearOverhang_m: number;         // Rear overhang beyond last axle
  groundClearance_m: number;      // Minimum ground clearance at rest
  minDetectionDistance_m: number; // Minimum distance to sustain alert (e.g., 200m)
  convexThreshold: number;        // Threshold K-factor or radius for convex (crest) curves
  concaveThreshold: number;       // Threshold K-factor or radius for concave (sag) curves
  useRadius: boolean;             // true = use radius (m), false = use K-factor
}

/**
 * Wind Blade Alert Type
 * Indicates which part of the transport is at risk
 */
export type WindBladeAlertType = 'NONE' | 'REAR_TIP_CONVEX' | 'MIDDLE_SECTION_CONCAVE';

/**
 * Wind Blade Ground Contact Risk Assessment
 */
export interface WindBladeRiskAssessment {
  alertType: WindBladeAlertType;
  riskLevel: 'NONE' | 'WARNING' | 'CRITICAL';
  clearanceDeficit_m: number;     // How much below minimum clearance (0 if safe)
  effectiveKFactor: number;       // K-factor over the detection window
  effectiveRadius_m: number;      // Equivalent radius
  detectionWindow_m: number;      // Distance over which this was detected
  startChainage_m: number;
  endChainage_m: number;
  description: string;
}

/**
 * Wind Blade Alert Segment
 * Sustained ground contact risk over a meaningful distance
 */
export interface WindBladeAlertSegment {
  id: string;
  alertType: WindBladeAlertType;
  riskLevel: 'WARNING' | 'CRITICAL';
  startChainage_m: number;
  endChainage_m: number;
  length_m: number;
  maxKFactor: number;
  minRadius_m: number;
  clearanceDeficit_m: number;
  lat: number;
  lon: number;
  description: string;
}
