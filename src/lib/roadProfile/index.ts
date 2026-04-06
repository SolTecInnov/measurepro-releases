/**
 * Road Profile Module
 * Complete road profiling system with grade and K-factor analysis
 */

// Types
export * from './types';

// Constants
export * from './constants';

// Core processing
export { 
  haversineDistance,
  computeChainage,
  computeGrade,
  computeSmoothedGrade,
  computeKFactor,
  getGradeAlertType,
  getKAlertType,
  buildRoadProfileFromSamples,
  appendSampleToProfile,
  recomputeProfileMetrics
} from './processor';

// Alert segments
export {
  computeRoadProfileAlertSegments,
  computeRoadProfileSummarySegments,
  getAlertSegmentsInRange,
  getAlertSummary
} from './alertSegments';

// Exporters
export {
  generateProfileDetailCSV,
  generateProfileSummaryCSV,
  generateProfileAlertsCSV,
  generateProfileGeoJSON,
  generateAlertsGeoJSON,
  generateAllProfileExports
} from './exporters';

// Recording buffer (in-memory for fast UI)
export {
  getProfileRecordingBuffer,
  ProfileRecordingBufferService
} from './recordingBuffer';

// Export helpers (for ZIP integration)
export {
  addRoadProfileExportsToZip,
  getRoadProfileExportData
} from './exportHelper';

// Legacy adapter (for migrating old data)
export {
  normalizeLegacyPoint,
  normalizeLegacyProfile,
  convertLegacyProfileToCanonical,
  convertLegacySamplesToPoints
} from './legacyAdapter';

// Alert to POI integration
export {
  alertTypeToPOIType,
  checkPointForAlerts,
  alertSegmentToPOI,
  AlertPOIDebouncer,
  type ProfileAlertPOI
} from './alertPOIIntegration';

// Grade segment tracking (10%, 12%, 14% thresholds)
export {
  GradeSegmentTracker,
  getGradeCategory,
  getGradeDirection,
  gradeCategoryToPOIType,
  getCategoryColor,
  getCategoryLabel,
  formatGradeSegmentNote
} from './gradeSegmentTracker';

// Wind blade transport utilities
export {
  DEFAULT_WIND_BLADE_CONFIG,
  kFactorToRadius,
  radiusToKFactor,
  calculateConvexClearanceLoss,
  calculateConcaveClearanceLoss,
  getCurveType,
  assessGroundContactRisk,
  detectSustainedKFactorAlerts,
  loadWindBladeConfig,
  saveWindBladeConfig
} from './windBladeUtils';
