/**
 * Alert to POI Integration
 * Automatically creates POIs and log entries when road profile alerts are triggered
 * 
 * Alert Types:
 * - GRADE_12_UP: Grade exceeds +12% threshold -> gradeUp POI
 * - GRADE_12_DOWN: Grade exceeds -12% threshold -> gradeDown POI
 * - K_OVER_10: K-factor < 10 (convex) or > -10 (concave) -> railroad POI (bump indicator)
 */

import type { POIType } from '../poi';
import type { RoadProfilePoint, AlertType, RoadProfileAlertSegment } from './types';

export interface ProfileAlertPOI {
  id: string;
  poiType: POIType;
  alertType: AlertType;
  lat: number;
  lon: number;
  chainage_m: number;
  grade_pct: number;
  k_factor: number;
  timestamp: string;
  note: string;
}

/**
 * Map alert type to POI type
 */
export function alertTypeToPOIType(alertType: AlertType): POIType {
  switch (alertType) {
    case 'GRADE_12_UP':
      return 'gradeUp';
    case 'GRADE_12_DOWN':
      return 'gradeDown';
    case 'K_OVER_10':
      return 'railroad'; // K-factor alerts indicate vertical curvature / bumps
    default:
      return 'information';
  }
}

/**
 * Generate note text for alert
 * @param segmentLength_m Optional segment length for completed segments
 */
function generateAlertNote(alertType: AlertType, grade: number, kFactor: number, chainage: number, segmentLength_m?: number): string {
  const lengthInfo = segmentLength_m ? ` for ${segmentLength_m.toFixed(0)}m` : '';
  switch (alertType) {
    case 'GRADE_12_UP':
      return `GRADE UP: +${grade.toFixed(1)}%${lengthInfo} at ${(chainage / 1000).toFixed(2)}km`;
    case 'GRADE_12_DOWN':
      return `GRADE DOWN: ${grade.toFixed(1)}%${lengthInfo} at ${(chainage / 1000).toFixed(2)}km`;
    case 'K_OVER_10':
      return `K-Factor Alert: K=${kFactor.toFixed(1)} at ${(chainage / 1000).toFixed(2)}km`;
    default:
      return `Profile Alert at ${(chainage / 1000).toFixed(2)}km`;
  }
}

/**
 * Check if a point triggers an alert and should create a POI
 */
export function checkPointForAlerts(point: RoadProfilePoint): ProfileAlertPOI | null {
  // Check grade alert
  if (point.grade_alert_type !== 'NONE') {
    const alertType: AlertType = point.grade_alert_type === 'GRADE_12_UP' ? 'GRADE_12_UP' : 'GRADE_12_DOWN';
    return {
      id: crypto.randomUUID(),
      poiType: alertTypeToPOIType(alertType),
      alertType,
      lat: point.lat,
      lon: point.lon,
      chainage_m: point.chainage_m,
      grade_pct: point.grade_pct,
      k_factor: point.k_factor,
      timestamp: point.timestamp_iso,
      note: generateAlertNote(alertType, point.grade_pct, point.k_factor, point.chainage_m)
    };
  }
  
  // Check K-factor alert
  if (point.k_alert !== 'NONE') {
    return {
      id: crypto.randomUUID(),
      poiType: alertTypeToPOIType('K_OVER_10'),
      alertType: 'K_OVER_10',
      lat: point.lat,
      lon: point.lon,
      chainage_m: point.chainage_m,
      grade_pct: point.grade_pct,
      k_factor: point.k_factor,
      timestamp: point.timestamp_iso,
      note: generateAlertNote('K_OVER_10', point.grade_pct, point.k_factor, point.chainage_m)
    };
  }
  
  return null;
}

/**
 * Convert alert segment to POI data for start of segment
 * Includes direction, max grade, and segment length
 */
export function alertSegmentToPOI(segment: RoadProfileAlertSegment): ProfileAlertPOI {
  const direction = segment.alert_type === 'GRADE_12_UP' ? 'UP' : 
                    segment.alert_type === 'GRADE_12_DOWN' ? 'DOWN' : 'K-FACTOR';
  const maxGrade = Math.max(Math.abs(segment.max_grade_pct), Math.abs(segment.min_grade_pct));
  const gradeSign = segment.alert_type === 'GRADE_12_UP' ? '+' : '';
  
  let note: string;
  if (segment.alert_type === 'K_OVER_10') {
    note = `K-Factor Alert: K=${segment.max_k_factor.toFixed(0)} for ${segment.length_m.toFixed(0)}m at ${(segment.from_chainage_m / 1000).toFixed(2)}km`;
  } else {
    note = `GRADE ${direction}: ${gradeSign}${maxGrade.toFixed(1)}% for ${segment.length_m.toFixed(0)}m at ${(segment.from_chainage_m / 1000).toFixed(2)}km`;
  }
  
  return {
    id: segment.alert_id,
    poiType: alertTypeToPOIType(segment.alert_type),
    alertType: segment.alert_type,
    lat: segment.lat,
    lon: segment.lon,
    chainage_m: segment.from_chainage_m,
    grade_pct: segment.max_grade_pct || segment.min_grade_pct,
    k_factor: segment.max_k_factor,
    timestamp: new Date().toISOString(),
    note
  };
}

/**
 * Debounce utility to prevent rapid-fire alert POIs
 * Only trigger new alert if different type or >50m from last alert
 */
export class AlertPOIDebouncer {
  private lastAlert: { type: AlertType; chainage: number; timestamp: number } | null = null;
  private readonly minDistanceM = 50;  // Minimum distance between same-type alerts
  private readonly minTimeMs = 5000;   // Minimum time between any alerts (5 seconds)

  shouldTrigger(alertType: AlertType, chainage_m: number): boolean {
    const now = Date.now();
    
    // Always allow if no previous alert
    if (!this.lastAlert) {
      this.lastAlert = { type: alertType, chainage: chainage_m, timestamp: now };
      return true;
    }
    
    // Rate limit all alerts
    if (now - this.lastAlert.timestamp < this.minTimeMs) {
      return false;
    }
    
    // Allow if different alert type
    if (alertType !== this.lastAlert.type) {
      this.lastAlert = { type: alertType, chainage: chainage_m, timestamp: now };
      return true;
    }
    
    // Same type - require minimum distance
    const distance = Math.abs(chainage_m - this.lastAlert.chainage);
    if (distance >= this.minDistanceM) {
      this.lastAlert = { type: alertType, chainage: chainage_m, timestamp: now };
      return true;
    }
    
    return false;
  }

  reset() {
    this.lastAlert = null;
  }
}

export default {
  alertTypeToPOIType,
  checkPointForAlerts,
  alertSegmentToPOI,
  AlertPOIDebouncer
};
