/**
 * Road Profile Alert Segments
 * Computes contiguous alert segments and summary segments
 */

import type { 
  RoadProfilePoint, 
  RoadProfileAlertSegment, 
  RoadProfileSummarySegment,
  AlertType 
} from './types';
import { SUMMARY_SEGMENT_LENGTH_M } from './constants';

/**
 * Generate unique alert ID
 */
function generateAlertId(type: AlertType, index: number): string {
  return `alert-${type.toLowerCase()}-${index}`;
}

/**
 * Generate description note for alert segment
 */
function generateAlertNote(segment: Omit<RoadProfileAlertSegment, 'notes'>): string {
  switch (segment.alert_type) {
    case 'GRADE_12_UP':
      return `Steep climb (${Math.abs(segment.max_grade_pct).toFixed(1)}% up)`;
    case 'GRADE_12_DOWN':
      return `Steep descent (${Math.abs(segment.min_grade_pct).toFixed(1)}% down)`;
    case 'K_OVER_10':
      return `Sharp vertical transition (K=${segment.max_k_factor.toFixed(1)})`;
  }
}

/**
 * Compute contiguous alert segments from profile points
 * Groups adjacent points with the same alert type into segments
 */
export function computeRoadProfileAlertSegments(
  points: RoadProfilePoint[]
): RoadProfileAlertSegment[] {
  if (points.length === 0) return [];

  const segments: RoadProfileAlertSegment[] = [];
  let currentSegment: {
    type: AlertType;
    points: RoadProfilePoint[];
  } | null = null;
  
  let gradeUpCount = 0;
  let gradeDownCount = 0;
  let kFactorCount = 0;

  for (const point of points) {
    // Determine which alerts are active at this point
    const gradeAlert = point.grade_alert_type !== 'NONE' ? point.grade_alert_type : null;
    const kAlert = point.k_alert !== 'NONE' ? 'K_OVER_10' : null;
    
    // Process grade alerts first (higher priority)
    const activeAlert: AlertType | null = gradeAlert || kAlert;
    
    if (activeAlert) {
      if (currentSegment && currentSegment.type === activeAlert) {
        // Continue current segment
        currentSegment.points.push(point);
      } else {
        // Close previous segment if exists
        if (currentSegment) {
          segments.push(buildSegmentFromPoints(
            currentSegment.type,
            currentSegment.points,
            currentSegment.type === 'GRADE_12_UP' ? gradeUpCount++ :
            currentSegment.type === 'GRADE_12_DOWN' ? gradeDownCount++ : kFactorCount++
          ));
        }
        // Start new segment
        currentSegment = { type: activeAlert, points: [point] };
      }
    } else {
      // No alert - close current segment if exists
      if (currentSegment) {
        segments.push(buildSegmentFromPoints(
          currentSegment.type,
          currentSegment.points,
          currentSegment.type === 'GRADE_12_UP' ? gradeUpCount++ :
          currentSegment.type === 'GRADE_12_DOWN' ? gradeDownCount++ : kFactorCount++
        ));
        currentSegment = null;
      }
    }
  }

  // Close final segment
  if (currentSegment) {
    segments.push(buildSegmentFromPoints(
      currentSegment.type,
      currentSegment.points,
      currentSegment.type === 'GRADE_12_UP' ? gradeUpCount++ :
      currentSegment.type === 'GRADE_12_DOWN' ? gradeDownCount++ : kFactorCount++
    ));
  }

  return segments;
}

/**
 * Build a segment from a collection of points
 */
function buildSegmentFromPoints(
  type: AlertType,
  points: RoadProfilePoint[],
  index: number
): RoadProfileAlertSegment {
  const from_chainage_m = points[0].chainage_m;
  const to_chainage_m = points[points.length - 1].chainage_m;
  const length_m = to_chainage_m - from_chainage_m;
  
  // Compute min/max values
  const grades = points.map(p => p.grade_pct);
  const kFactors = points.map(p => p.k_factor);
  
  const max_grade_pct = Math.max(...grades);
  const min_grade_pct = Math.min(...grades);
  const max_k_factor = Math.max(...kFactors);
  
  // Find representative location (point with max absolute grade or midpoint)
  let representativePoint: RoadProfilePoint;
  if (type === 'K_OVER_10') {
    // For K alerts, use point with max K-factor
    representativePoint = points.reduce((max, p) => 
      p.k_factor > max.k_factor ? p : max
    );
  } else {
    // For grade alerts, use point with max absolute grade
    representativePoint = points.reduce((max, p) => 
      Math.abs(p.grade_pct) > Math.abs(max.grade_pct) ? p : max
    );
  }

  const segment: Omit<RoadProfileAlertSegment, 'notes'> = {
    alert_id: generateAlertId(type, index),
    alert_type: type,
    from_chainage_m,
    to_chainage_m,
    length_m,
    max_grade_pct,
    min_grade_pct,
    max_k_factor,
    lat: representativePoint.lat,
    lon: representativePoint.lon
  };

  return {
    ...segment,
    notes: generateAlertNote(segment)
  };
}

/**
 * Compute summary segments (fixed-length segments for overview)
 */
export function computeRoadProfileSummarySegments(
  points: RoadProfilePoint[],
  segmentLength: number = SUMMARY_SEGMENT_LENGTH_M
): RoadProfileSummarySegment[] {
  if (points.length === 0) return [];

  const segments: RoadProfileSummarySegment[] = [];
  const maxChainage = points[points.length - 1].chainage_m;
  
  let segmentIndex = 0;
  let currentFrom = 0;

  while (currentFrom < maxChainage) {
    const currentTo = Math.min(currentFrom + segmentLength, maxChainage);
    
    // Get points in this segment
    const segmentPoints = points.filter(p => 
      p.chainage_m >= currentFrom && p.chainage_m < currentTo
    );

    if (segmentPoints.length > 0) {
      const grades = segmentPoints.map(p => p.grade_pct);
      const avg_grade_pct = grades.reduce((a, b) => a + b, 0) / grades.length;
      const max_up_grade_pct = Math.max(...grades);
      const max_down_grade_pct = Math.min(...grades);
      const has_alert_over_12pct = segmentPoints.some(p => p.grade_alert_type !== 'NONE');

      let notes: string | undefined;
      if (has_alert_over_12pct) {
        if (max_up_grade_pct >= 12) {
          notes = `Contains steep climb (${max_up_grade_pct.toFixed(1)}%)`;
        } else if (max_down_grade_pct <= -12) {
          notes = `Contains steep descent (${Math.abs(max_down_grade_pct).toFixed(1)}%)`;
        }
      }

      segments.push({
        segment_id: `seg-${segmentIndex}`,
        from_chainage_m: currentFrom,
        to_chainage_m: currentTo,
        length_m: currentTo - currentFrom,
        avg_grade_pct,
        max_up_grade_pct,
        max_down_grade_pct,
        has_alert_over_12pct,
        notes
      });

      segmentIndex++;
    }

    currentFrom = currentTo;
  }

  return segments;
}

/**
 * Get alert segments filtered by chainage range (for section export)
 */
export function getAlertSegmentsInRange(
  segments: RoadProfileAlertSegment[],
  fromChainage: number,
  toChainage: number
): RoadProfileAlertSegment[] {
  return segments.filter(s => 
    s.from_chainage_m < toChainage && s.to_chainage_m > fromChainage
  );
}

/**
 * Get summary of alerts for quick display
 */
export function getAlertSummary(segments: RoadProfileAlertSegment[]): {
  gradeUpCount: number;
  gradeDownCount: number;
  kFactorCount: number;
  totalLength_m: number;
} {
  return {
    gradeUpCount: segments.filter(s => s.alert_type === 'GRADE_12_UP').length,
    gradeDownCount: segments.filter(s => s.alert_type === 'GRADE_12_DOWN').length,
    kFactorCount: segments.filter(s => s.alert_type === 'K_OVER_10').length,
    totalLength_m: segments.reduce((sum, s) => sum + s.length_m, 0)
  };
}
