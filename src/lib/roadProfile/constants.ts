/**
 * Road Profile Constants
 * Configurable thresholds for grade and K-factor alerts
 */

// Grade alert thresholds (percentage)
export const GRADE_UP_ALERT_THRESHOLD = 10;
export const GRADE_DOWN_ALERT_THRESHOLD = -10;

// K-factor alert threshold
export const K_FACTOR_ALERT_THRESHOLD = 10;

// Summary segmentation
export const SUMMARY_SEGMENT_LENGTH_M = 50;

// Minimum samples required for profile computation
export const MIN_SAMPLES_FOR_PROFILE = 3;

// Minimum samples before alerts are allowed to fire (guards against GPS noise at start)
export const MIN_SAMPLES_FOR_ALERTS = 5;

// Minimum chainage (metres) before alerts are allowed to fire
export const MIN_CHAINAGE_FOR_ALERTS = 5;

// Smoothing window for grade calculation (number of samples)
export const GRADE_SMOOTHING_WINDOW = 3;

// GPS source types
export type GpsSourceType = 'duro' | 'browser' | 'auto';

// Default GPS source preference (user can override in settings)
export const DEFAULT_GPS_SOURCE: GpsSourceType = 'auto';
