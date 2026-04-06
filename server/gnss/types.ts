/**
 * GNSS Types for MeasurePRO RoadScope
 * Professional GPS/GNSS integration for road profiling and heavy transport route analysis
 */

export type GnssSource = 'duro' | 'usb' | 'browser';
export type CorrectionType = 'none' | 'rtk' | 'ppp' | 'ppk' | 'sbas';
export type FixQuality = 'none' | 'gps' | 'dgps' | 'pps' | 'rtk_fixed' | 'rtk_float' | 'estimated' | 'manual';
export type InsMode = 'inactive' | 'aligning' | 'degraded' | 'ready' | 'rtk_aided' | 'standalone';

/**
 * Attitude data from INS/IMU (roll, pitch, yaw)
 * All angles in degrees
 */
export interface AttitudeData {
  roll: number;    // Roll angle in degrees (-180 to 180, positive = right wing down)
  pitch: number;   // Pitch angle in degrees (-90 to 90, positive = nose up)
  yaw: number;     // Yaw/heading in degrees (0-360, true north)
}

/**
 * Angular rate data from IMU (rotation rates)
 * All rates in degrees per second
 */
export interface AngularRateData {
  roll: number;    // Roll rate in deg/s (positive = rolling right)
  pitch: number;   // Pitch rate in deg/s (positive = pitching up)
  yaw: number;     // Yaw rate in deg/s (positive = turning right)
}

/**
 * Linear acceleration data from IMU
 * All accelerations in m/s² (includes gravity)
 */
export interface AccelerationData {
  x: number;       // Forward acceleration in m/s² (positive = forward)
  y: number;       // Lateral acceleration in m/s² (positive = right)
  z: number;       // Vertical acceleration in m/s² (positive = down, ~9.8 when stationary)
}

/**
 * INS/IMU status information
 */
export interface InsStatus {
  mode: InsMode;
  flags: string[];           // Status flags from device
  alignmentComplete: boolean;
  imuTemp_c?: number;        // IMU temperature in Celsius
}

/**
 * Raw GNSS Sample (before persistence)
 * Emitted by hardware clients (duroClient, usbClient) before IDs are assigned
 * 
 * REFACTORED: Uses clean, standard field names (latitude, longitude, altitude, speed, heading)
 * to match API conventions and improve clarity
 * 
 * IMU/INS EXTENSION: Optional attitude, angular rate, and acceleration data
 * from inertial sensors (Swift Duro with INS, etc.)
 */
export interface RawGnssSample {
  timestamp: string; // ISO 8601
  latitude: number; // decimal degrees
  longitude: number; // decimal degrees
  altitude: number | null; // altitude in meters
  speed: number | null; // speed in m/s
  heading: number | null; // heading 0-360°
  quality?: FixQuality; // Made optional for API flexibility
  hdop: number | null; // horizontal dilution of precision
  num_sats: number | null;
  source: GnssSource;
  profileId?: string; // OPTIONAL: FK to road profile (for profiling mode)
  distance?: number; // OPTIONAL: cumulative distance from start (for profiling)
  grade?: number; // OPTIONAL: percent grade at this point (for profiling)
  accuracy?: number; // OPTIONAL: position accuracy in meters
  correctionType?: CorrectionType;
  correctionAge_s?: number | null; // age of differential correction
  geoidHeight_m?: number | null; // geoid separation
  stdDev_m?: number | null; // position standard deviation (from GST)
  
  // GSA-sourced DOP (optional - only when GSA sentences are available)
  pdop?: number | null;   // Position DOP
  vdop?: number | null;   // Vertical DOP
  gsaMode?: number | null; // GSA mode2: 2=2D fix, 3=3D fix

  // IMU/INS data (optional - only available from devices with inertial sensors)
  attitude?: AttitudeData;        // Roll, pitch, yaw angles
  angularRate?: AngularRateData;  // Rotation rates
  acceleration?: AccelerationData; // Linear accelerations
  insStatus?: InsStatus;          // INS mode and alignment status
}

/**
 * Core GNSS Sample (with required IDs for storage)
 * Unified structure for all GPS sources (Duro TCP, USB, Browser)
 * 
 * IMPORTANT: surveyId and sessionId are REQUIRED for all stored samples
 * to ensure proper data organization and querying
 * 
 * REFACTORED: Uses clean, standard field names (latitude, longitude, altitude, speed, heading)
 * to match API conventions and improve clarity
 */
export interface GnssSample extends RawGnssSample {
  surveyId: string; // REQUIRED: FK to survey (for survey integration)
  sessionId: string; // REQUIRED: FK to convoy session
}

/**
 * High-rate IMU Sample (stored separately from GNSS for volume management)
 * IMU can output at 50-200Hz vs GNSS at 1-10Hz
 * Linked to GNSS samples via surveyId/sessionId/profileId
 */
export interface ImuSample {
  id?: number;            // Auto-increment in IndexedDB
  surveyId: string;
  sessionId: string;
  profileId: string;
  timestamp: string;      // ISO 8601 (high precision)
  attitude: AttitudeData;
  angularRate: AngularRateData;
  acceleration: AccelerationData;
  insStatus?: InsStatus;
  source: GnssSource;
  cloudSynced?: boolean;
}

/**
 * Raw GNSS Observation (for PPK post-processing)
 */
export interface RawObservation {
  sessionId: string;
  timestamp: string;
  rawData: string; // Raw NMEA sentences or binary format
  format: 'nmea' | 'rtcm' | 'ubx' | 'sbp'; // Swift Binary Protocol for Duro
  source: GnssSource;
}

/**
 * NMEA Sentence Parse Result
 */
export interface NmeaParseResult {
  type: 'GGA' | 'RMC' | 'GST' | 'GSA' | 'GSV' | 'VTG' | 'ATT' | 'PASHR' | 'unknown';
  raw: string;
  data: {
    timestamp?: Date;
    latitude?: number;
    longitude?: number;
    altitude?: number;
    quality?: FixQuality;
    numSats?: number;
    hdop?: number;
    vdop?: number;
    pdop?: number;
    speed?: number; // m/s
    heading?: number; // degrees
    geoidHeight?: number;
    correctionAge?: number;
    stdDevLat?: number; // GST - standard deviation
    stdDevLon?: number;
    stdDevAlt?: number;
    // GSA fields
    activeSatellitePrns?: number[];
    gsaMode?: number; // mode2: 1=no fix, 2=2D, 3=3D
    gsaMode1?: string; // mode1: 'A'=automatic, 'M'=manual
    gsaTalkerId?: string; // talker ID: GP=GPS, GL=GLONASS, GA=Galileo, GB/BD=BeiDou, GN=multi
    // GSV fields
    satellitesInView?: number;
    satellites?: Array<{
      prn: number;
      elevation: number | undefined;
      azimuth: number | undefined;
      snr: number | undefined;
    }>;
    // Attitude/IMU data (from PASHR, ATT, or proprietary sentences)
    roll?: number;        // degrees
    pitch?: number;       // degrees
    yaw?: number;         // degrees (true heading from INS)
    rollRate?: number;    // deg/s
    pitchRate?: number;   // deg/s
    yawRate?: number;     // deg/s
    heaveRate?: number;   // m/s (vertical velocity from INS)
    rollAccuracy?: number;  // degrees (1-sigma)
    pitchAccuracy?: number; // degrees (1-sigma)
    headingAccuracy?: number; // degrees (1-sigma)
    insMode?: InsMode;
  };
  valid: boolean;
  error?: string;
}

/**
 * Road Profile Point (resampled)
 * REFACTORED: Uses clean field names matching GnssSample
 */
export interface ProfilePoint {
  distance_m: number; // cumulative distance from start
  latitude: number;  // was: lat
  longitude: number; // was: lon
  altitude: number;  // was: alt_m
  timestamp: string;
  grade_pct: number; // percent grade (+ = uphill, - = downhill)
  k_factor: number | null; // vertical curvature (m) - null if cannot compute
  curvature_type: 'convex' | 'concave' | 'linear' | null;
}

/**
 * Road Profile Summary
 */
export interface ProfileSummary {
  totalDistance_m: number;
  totalClimb_m: number;
  totalDescent_m: number;
  maxGradeUp_pct: number;
  maxGradeDown_pct: number;
  minKFactorConvex: number | null; // sharpest crest (smallest K)
  minKFactorConcave: number | null; // sharpest sag (most negative K)
  numGradeEvents: number;
  numKFactorEvents: number;
  numRailCrossings: number;
}

/**
 * Complete Road Profile
 */
export interface RoadProfile {
  id: string;
  surveyId: string; // REQUIRED: FK to survey (for survey integration)
  sessionId: string; // REQUIRED: FK to convoy session
  start: string; // ISO timestamp
  end: string; // ISO timestamp
  step_m: number; // resampling interval
  grade_trigger_pct: number; // alert threshold for steep grades
  k_factor_convex_min: number; // alert threshold for sharp crests (m)
  k_factor_concave_min: number; // alert threshold for sharp sags (m)
  summary: ProfileSummary;
  points: ProfilePoint[];
  label?: string; // User-defined label
  created_at: string;
}

/**
 * Grade Event (steep uphill or downhill segment)
 * REFACTORED: Uses clean field names
 */
export interface GradeEvent {
  id: string;
  surveyId: string; // REQUIRED: FK to survey (for survey integration)
  sessionId: string; // REQUIRED: FK to convoy session
  profileId: string; // REQUIRED: FK to road profile
  sectionId?: string; // OPTIONAL: FK to profile section (if event is part of a saved section)
  direction: 'up' | 'down';
  trigger_pct: number; // threshold that triggered this
  max_grade_pct: number; // steepest grade in this event
  start_distance_m: number;
  end_distance_m: number;
  length_m: number;
  start_latitude: number;  // was: start_lat
  start_longitude: number; // was: start_lon
  end_latitude: number;    // was: end_lat
  end_longitude: number;   // was: end_lon
  start_timestamp: string;
  end_timestamp: string;
  created_at: string;
}

/**
 * K-Factor Event (sharp vertical curve - crest or sag)
 * REFACTORED: Uses clean field names
 */
export interface KFactorEvent {
  id: string;
  surveyId: string; // REQUIRED: FK to survey (for survey integration)
  sessionId: string; // REQUIRED: FK to convoy session
  profileId: string; // REQUIRED: FK to road profile
  sectionId?: string; // OPTIONAL: FK to profile section (if event is part of a saved section)
  curvature_type: 'convex' | 'concave';
  k_factor: number; // radius of vertical curve (m)
  trigger_threshold: number; // K-value that triggered alert
  distance_m: number;
  latitude: number;  // was: lat
  longitude: number; // was: lon
  timestamp: string;
  created_at: string;
  severity: 'warning' | 'critical'; // based on how far below threshold
}

/**
 * Rail Crossing Event (elevation bump detection or manual trigger)
 * REFACTORED: Uses clean field names
 * NOTE: latitude, longitude, timestamp are optional for manual events
 */
export interface RailCrossingEvent {
  id: string;
  surveyId: string; // REQUIRED: FK to survey (for survey integration)
  sessionId: string; // REQUIRED: FK to convoy session
  profileId: string; // REQUIRED: FK to road profile
  sectionId?: string; // OPTIONAL: FK to profile section (if event is part of a saved section)
  detection_method: 'auto' | 'manual';
  distance_m: number;
  latitude?: number;  // was: lat, optional for manual events
  longitude?: number; // was: lon, optional for manual events
  timestamp?: string; // optional for manual events
  elevation_change_m?: number; // if auto-detected
  notes?: string; // if manually triggered
  created_at: string;
}

/**
 * Profile Section (saved portion of a profile)
 */
export interface ProfileSection {
  id: string;
  profileId: string;
  fromDistance_m: number;
  toDistance_m: number;
  label?: string;
  summary: ProfileSummary;
  points: ProfilePoint[];
  created_at: string;
}

/**
 * Correction Service Status
 */
export interface CorrectionStatus {
  type: CorrectionType;
  active: boolean;
  converged?: boolean; // for PPP
  convergence_time_s?: number;
  base_station?: string; // for RTK
  ntrip_mountpoint?: string; // for PPP/RTK via NTRIP
  error?: string;
  last_update: string;
}

/**
 * Duro Connection Status
 */
export interface DuroStatus {
  connected: boolean;
  tcp_host?: string;
  tcp_port?: number;
  uptime_s?: number;
  samples_received?: number;
  last_sample?: string; // timestamp
  reconnect_attempts?: number;
  error?: string;
}

/**
 * STRICT/LEGACY TYPE SYSTEM
 * Stage 2: Type System Hardening
 * 
 * Strict types enforce non-null surveyId/sessionId for all new writes
 * Legacy types allow nullable surveyId/sessionId for backward compatibility with quarantined data
 */

// ===== STRICT TYPES (required IDs) =====

/**
 * RoadProfileStrict - Strict type with required IDs
 * All new road profiles MUST have surveyId and sessionId
 */
export interface RoadProfileStrict {
  id: string;
  surveyId: string;  // REQUIRED
  sessionId: string;  // REQUIRED
  start: string;
  end: string;
  step_m: number;
  grade_trigger_pct: number;
  k_factor_convex_min: number;
  k_factor_concave_min: number;
  summary: ProfileSummary;
  points: ProfilePoint[];
  label?: string;
  created_at: string;
}

/**
 * RoadProfileSampleStrict - Strict GNSS sample with required IDs
 */
export interface RoadProfileSampleStrict extends GnssSample {
  id?: number;  // Auto-increment in IndexedDB
  profileId: string;  // REQUIRED
  surveyId: string;  // REQUIRED (inherited from GnssSample)
  sessionId: string;  // REQUIRED (inherited from GnssSample)
}

/**
 * RoadProfileEventStrict - Strict event with required IDs
 * Covers GradeEvent, KFactorEvent, and RailCrossingEvent
 */
export interface RoadProfileEventStrict {
  id: number;
  profileId: string;  // REQUIRED
  surveyId: string;  // REQUIRED
  sessionId: string;  // REQUIRED
  eventType: 'grade' | 'k_factor' | 'rail_crossing';
  timestamp: string;
  created_at: string;
  // Event-specific fields (union of all event types)
  direction?: 'up' | 'down';
  trigger_pct?: number;
  max_grade_pct?: number;
  start_distance_m?: number;
  end_distance_m?: number;
  length_m?: number;
  start_lat?: number;
  start_lon?: number;
  end_lat?: number;
  end_lon?: number;
  start_timestamp?: string;
  end_timestamp?: string;
  curvature_type?: 'convex' | 'concave';
  k_factor?: number;
  trigger_threshold?: number;
  distance_m?: number;
  lat?: number;
  lon?: number;
  severity?: 'warning' | 'critical';
  detection_method?: 'auto' | 'manual';
  elevation_change_m?: number;
  notes?: string;
}

/**
 * GnssSampleStrict - Alias for GnssSample (already strict)
 */
export type GnssSampleStrict = GnssSample;

// ===== LEGACY TYPES (nullable IDs) =====

/**
 * LegacyRoadProfile - Legacy type with nullable IDs
 * For backward compatibility with quarantined or pre-migration data
 */
export interface LegacyRoadProfile {
  id: string;
  surveyId: string | null;  // NULLABLE
  sessionId: string | null;  // NULLABLE
  start: string;
  end: string;
  step_m: number;
  grade_trigger_pct: number;
  k_factor_convex_min: number;
  k_factor_concave_min: number;
  summary: ProfileSummary;
  points: ProfilePoint[];
  label?: string;
  created_at: string;
}

/**
 * LegacyRoadProfileSample - Legacy GNSS sample with nullable IDs
 * REFACTORED: Uses clean field names matching GnssSample
 */
export interface LegacyRoadProfileSample {
  id?: number;
  profileId: string;
  surveyId: string | null;  // NULLABLE
  sessionId: string | null;  // NULLABLE
  timestamp: string;
  latitude: number;  // was: lat
  longitude: number; // was: lon
  altitude: number | null;  // was: alt_m
  speed: number | null;      // was: speed_mps
  heading: number | null;    // was: heading_deg
  quality: FixQuality;
  hdop: number | null;
  num_sats: number | null;
  source: GnssSource;
  correctionType?: CorrectionType;
  correctionAge_s?: number | null;
  geoidHeight_m?: number | null;
  stdDev_m?: number | null;
}

/**
 * LegacyRoadProfileEvent - Legacy event with nullable IDs
 */
export interface LegacyRoadProfileEvent {
  id: number;
  profileId: string;
  surveyId: string | null;  // NULLABLE
  sessionId: string | null;  // NULLABLE
  eventType: 'grade' | 'k_factor' | 'rail_crossing';
  timestamp: string;
  created_at: string;
  direction?: 'up' | 'down';
  trigger_pct?: number;
  max_grade_pct?: number;
  start_distance_m?: number;
  end_distance_m?: number;
  length_m?: number;
  start_lat?: number;
  start_lon?: number;
  end_lat?: number;
  end_lon?: number;
  start_timestamp?: string;
  end_timestamp?: string;
  curvature_type?: 'convex' | 'concave';
  k_factor?: number;
  trigger_threshold?: number;
  distance_m?: number;
  lat?: number;
  lon?: number;
  severity?: 'warning' | 'critical';
  detection_method?: 'auto' | 'manual';
  elevation_change_m?: number;
  notes?: string;
}
