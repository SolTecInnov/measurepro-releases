/**
 * Banking/Cross-slope and Curve Radius Utilities
 * Heavy haul safety calculations for trailer tip-over prevention
 */

import type { 
  BankingAlertLevel, 
  BankingThresholds, 
  RadiusAlertType,
  CrossSlopeMode 
} from './types';

/**
 * Default banking thresholds based on heavy haul industry standards
 */
export const DEFAULT_BANKING_THRESHOLDS: BankingThresholds = {
  normalMax: 3,      // 0-3° = Normal
  cautionMax: 5,     // 3-5° = Caution
  warningMax: 7,     // 5-7° = Warning (yellow zone)
  criticalMax: 10,   // 7-10° = Critical (red zone)
};

/**
 * Classify banking/cross-slope angle into alert level
 * Uses absolute value of cross-slope (both directions are dangerous)
 */
export function classifyBankingAlert(
  crossSlope_deg: number,
  thresholds: BankingThresholds = DEFAULT_BANKING_THRESHOLDS
): BankingAlertLevel {
  const absSlope = Math.abs(crossSlope_deg);
  
  if (absSlope <= thresholds.normalMax) {
    return 'NORMAL';
  } else if (absSlope <= thresholds.cautionMax) {
    return 'CAUTION';
  } else if (absSlope <= thresholds.warningMax) {
    return 'WARNING';
  } else if (absSlope <= thresholds.criticalMax) {
    return 'CRITICAL';
  } else {
    return 'UNACCEPTABLE';
  }
}

/**
 * Get human-readable description for banking alert level
 */
export function getBankingAlertDescription(level: BankingAlertLevel): string {
  switch (level) {
    case 'NORMAL':
      return 'Normal banking - safe for heavy haul';
    case 'CAUTION':
      return 'Caution - monitor suspension and curve forces';
    case 'WARNING':
      return 'Yellow zone - operational risk with compounding factors';
    case 'CRITICAL':
      return 'Red zone - requires speed control, hydraulic strategy, escorts';
    case 'UNACCEPTABLE':
      return 'Unacceptable - controlled environment only with full validation';
  }
}

/**
 * Get color for banking alert level (for UI display)
 */
export function getBankingAlertColor(level: BankingAlertLevel): string {
  switch (level) {
    case 'NORMAL':
      return '#22c55e'; // Green
    case 'CAUTION':
      return '#3b82f6'; // Blue
    case 'WARNING':
      return '#eab308'; // Yellow
    case 'CRITICAL':
      return '#f97316'; // Orange
    case 'UNACCEPTABLE':
      return '#ef4444'; // Red
  }
}

/**
 * Low-pass filter for smoothing IMU roll data
 * Uses exponential moving average to separate road banking from vehicle body roll
 */
export class RollFilter {
  private filteredValue: number = 0;
  private alpha: number;
  private initialized: boolean = false;
  
  constructor(smoothingFactor: number = 0.1) {
    this.alpha = Math.max(0.01, Math.min(1, smoothingFactor));
  }
  
  filter(rawRoll_deg: number): number {
    if (!this.initialized) {
      this.filteredValue = rawRoll_deg;
      this.initialized = true;
      return rawRoll_deg;
    }
    
    this.filteredValue = this.alpha * rawRoll_deg + (1 - this.alpha) * this.filteredValue;
    return this.filteredValue;
  }
  
  reset(): void {
    this.initialized = false;
    this.filteredValue = 0;
  }
}

/**
 * Determine cross-slope value based on selected mode
 * @param rawRoll_deg - Raw IMU roll in degrees
 * @param speed_mps - Vehicle speed in m/s
 * @param mode - Cross-slope detection mode
 * @param filter - Optional roll filter for 'filtered' mode
 * @param stoppedSpeedThreshold_mps - Speed below which vehicle is "stopped"
 */
export function getCrossSlopeForMode(
  rawRoll_deg: number | null,
  speed_mps: number | null,
  mode: CrossSlopeMode,
  filter?: RollFilter,
  stoppedSpeedThreshold_mps: number = 0.5
): { value: number | null; isFiltered: boolean } {
  if (rawRoll_deg === null) {
    return { value: null, isFiltered: false };
  }
  
  switch (mode) {
    case 'raw':
      return { value: rawRoll_deg, isFiltered: false };
      
    case 'filtered':
      if (filter) {
        return { value: filter.filter(rawRoll_deg), isFiltered: true };
      }
      return { value: rawRoll_deg, isFiltered: false };
      
    case 'stopped':
      if (speed_mps !== null && speed_mps < stoppedSpeedThreshold_mps) {
        return { value: rawRoll_deg, isFiltered: false };
      }
      return { value: null, isFiltered: false };
      
    default:
      return { value: rawRoll_deg, isFiltered: false };
  }
}

/**
 * Calculate curve radius from 3 consecutive GPS points using circumradius formula
 * Returns null for straight sections or insufficient data
 */
export function calculateCurveRadius(
  p1: { latitude: number; longitude: number } | null,
  p2: { latitude: number; longitude: number } | null,
  p3: { latitude: number; longitude: number } | null
): number | null {
  if (!p1 || !p2 || !p3) {
    return null;
  }
  
  const x1 = p1.longitude;
  const y1 = p1.latitude;
  const x2 = p2.longitude;
  const y2 = p2.latitude;
  const x3 = p3.longitude;
  const y3 = p3.latitude;
  
  const a = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
  const b = Math.sqrt((x3 - x2) ** 2 + (y3 - y2) ** 2);
  const c = Math.sqrt((x3 - x1) ** 2 + (y3 - y1) ** 2);
  
  if (a === 0 || b === 0 || c === 0) {
    return null;
  }
  
  const s = (a + b + c) / 2;
  const areaSquared = s * (s - a) * (s - b) * (s - c);
  
  if (areaSquared <= 0) {
    return null;
  }
  
  const area = Math.sqrt(areaSquared);
  
  if (area < 1e-10) {
    return null;
  }
  
  const radiusDeg = (a * b * c) / (4 * area);
  const radiusM = radiusDeg * 111000;
  
  if (radiusM > 10000) {
    return null;
  }
  
  return radiusM;
}

/**
 * Classify curve radius alert
 */
export function classifyRadiusAlert(
  curveRadius_m: number | null,
  minimumRadius_m: number
): RadiusAlertType {
  if (curveRadius_m === null) {
    return 'NONE';
  }
  
  if (curveRadius_m < minimumRadius_m) {
    return 'BELOW_MINIMUM';
  }
  
  return 'NONE';
}

/**
 * Check if the vehicle is on a curve (radius below detection threshold)
 */
export function isOnCurve(
  curveRadius_m: number | null,
  curveDetectionThreshold_m: number = 500
): boolean {
  if (curveRadius_m === null) {
    return false;
  }
  
  return curveRadius_m < curveDetectionThreshold_m;
}

/**
 * Rolling buffer for curve radius calculation
 * Maintains last N GPS samples for trajectory analysis
 */
export class CurveRadiusCalculator {
  private samples: { latitude: number; longitude: number; timestamp: string }[] = [];
  private maxSamples: number;
  private minimumRadius_m: number;
  private curveDetectionThreshold_m: number;
  
  constructor(
    maxSamples: number = 5,
    minimumRadius_m: number = 15,
    curveDetectionThreshold_m: number = 500
  ) {
    this.maxSamples = maxSamples;
    this.minimumRadius_m = minimumRadius_m;
    this.curveDetectionThreshold_m = curveDetectionThreshold_m;
  }
  
  addSample(lat: number, lon: number, timestamp: string): void {
    this.samples.push({ latitude: lat, longitude: lon, timestamp });
    
    if (this.samples.length > this.maxSamples) {
      this.samples.shift();
    }
  }
  
  getCurrentRadius(): number | null {
    if (this.samples.length < 3) {
      return null;
    }
    
    const len = this.samples.length;
    return calculateCurveRadius(
      this.samples[len - 3],
      this.samples[len - 2],
      this.samples[len - 1]
    );
  }
  
  getRadiusAlert(): RadiusAlertType {
    return classifyRadiusAlert(this.getCurrentRadius(), this.minimumRadius_m);
  }
  
  isOnCurve(): boolean {
    return isOnCurve(this.getCurrentRadius(), this.curveDetectionThreshold_m);
  }
  
  reset(): void {
    this.samples = [];
  }
  
  setMinimumRadius(radius_m: number): void {
    this.minimumRadius_m = radius_m;
  }
  
  setCurveDetectionThreshold(threshold_m: number): void {
    this.curveDetectionThreshold_m = threshold_m;
  }
}
