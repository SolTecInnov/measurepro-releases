/**
 * Grade Segment Tracker
 * Tracks grade threshold crossings and creates POIs when entering/exiting grade zones
 * 
 * Thresholds:
 * - Normal: < 10% (green) - no POI
 * - 10-12%: Blue zone - creates POI on entry
 * - 12-14%: Amber zone - creates POI on entry
 * - 14%+: Red zone - creates POI on entry
 */

import type { POIType } from '../poi';
import type { RoadProfilePoint, GradeCategory, GradeDirection, GradeSegmentEvent } from './types';

interface ActiveSegment {
  category: GradeCategory;
  direction: GradeDirection;
  startLat: number;
  startLon: number;
  startChainage_m: number;
  startTimestamp: string;
  grades: number[];
}

export function getGradeCategory(absGrade: number): GradeCategory {
  if (absGrade >= 14) return 'grade14plus';
  if (absGrade >= 12) return 'grade12to14';
  if (absGrade > 10) return 'grade10to12';
  return 'normal';
}

export function getGradeDirection(grade: number): GradeDirection {
  return grade >= 0 ? 'up' : 'down';
}

export function gradeCategoryToPOIType(category: GradeCategory, direction: GradeDirection): POIType | null {
  if (category === 'normal' || category === 'kFactor') return null;
  
  const mapping: Record<Exclude<GradeCategory, 'normal' | 'kFactor'>, Record<GradeDirection, POIType>> = {
    'grade10to12': { up: 'grade10to12Up', down: 'grade10to12Down' },
    'grade12to14': { up: 'grade12to14Up', down: 'grade12to14Down' },
    'grade14plus': { up: 'grade14PlusUp', down: 'grade14PlusDown' }
  };
  
  return mapping[category][direction];
}

export function getCategoryColor(category: GradeCategory): string {
  switch (category) {
    case 'grade10to12': return 'text-blue-400';
    case 'grade12to14': return 'text-amber-400';
    case 'grade14plus': return 'text-red-400';
    case 'kFactor': return 'text-orange-400';
    default: return 'text-green-400';
  }
}

export function getCategoryLabel(category: GradeCategory): string {
  switch (category) {
    case 'grade10to12': return '10-12%';
    case 'grade12to14': return '12-14%';
    case 'grade14plus': return '14%+';
    case 'kFactor': return 'K-Factor Alert';
    default: return '<10%';
  }
}

export class GradeSegmentTracker {
  private activeSegment: ActiveSegment | null = null;
  private completedSegments: GradeSegmentEvent[] = [];
  private minSegmentLength_m = 50;

  reset() {
    this.activeSegment = null;
    this.completedSegments = [];
  }

  getCompletedSegments(): GradeSegmentEvent[] {
    return [...this.completedSegments];
  }

  processPoint(point: RoadProfilePoint): GradeSegmentEvent | null {
    const absGrade = Math.abs(point.grade_pct);
    const newCategory = getGradeCategory(absGrade);
    const newDirection = getGradeDirection(point.grade_pct);

    if (!this.activeSegment) {
      if (newCategory !== 'normal') {
        this.activeSegment = {
          category: newCategory,
          direction: newDirection,
          startLat: point.lat,
          startLon: point.lon,
          startChainage_m: point.chainage_m,
          startTimestamp: point.timestamp_iso,
          grades: [point.grade_pct]
        };
      }
      return null;
    }

    const categoryChanged = newCategory !== this.activeSegment.category;
    const directionChanged = newDirection !== this.activeSegment.direction && 
                            newCategory !== 'normal' && 
                            this.activeSegment.category !== 'normal';

    if (categoryChanged || directionChanged) {
      const completed = this.closeActiveSegment(point);
      
      if (newCategory !== 'normal') {
        this.activeSegment = {
          category: newCategory,
          direction: newDirection,
          startLat: point.lat,
          startLon: point.lon,
          startChainage_m: point.chainage_m,
          startTimestamp: point.timestamp_iso,
          grades: [point.grade_pct]
        };
      }
      
      return completed;
    }

    if (this.activeSegment) {
      this.activeSegment.grades.push(point.grade_pct);
    }

    return null;
  }

  private closeActiveSegment(endPoint: RoadProfilePoint): GradeSegmentEvent | null {
    if (!this.activeSegment) return null;

    const length_m = endPoint.chainage_m - this.activeSegment.startChainage_m;
    
    if (length_m < this.minSegmentLength_m) {
      this.activeSegment = null;
      return null;
    }

    const grades = this.activeSegment.grades;
    const maxGrade = this.activeSegment.direction === 'up'
      ? Math.max(...grades)
      : Math.min(...grades);
    const avgGrade = grades.reduce((a, b) => a + b, 0) / grades.length;

    const segment: GradeSegmentEvent = {
      id: crypto.randomUUID(),
      category: this.activeSegment.category,
      direction: this.activeSegment.direction,
      startLat: this.activeSegment.startLat,
      startLon: this.activeSegment.startLon,
      endLat: endPoint.lat,
      endLon: endPoint.lon,
      startChainage_m: this.activeSegment.startChainage_m,
      endChainage_m: endPoint.chainage_m,
      length_m,
      maxGrade_pct: maxGrade,
      avgGrade_pct: avgGrade,
      startTimestamp: this.activeSegment.startTimestamp,
      endTimestamp: endPoint.timestamp_iso
    };

    this.completedSegments.push(segment);
    this.activeSegment = null;

    return segment;
  }

  flush(lastPoint?: RoadProfilePoint): GradeSegmentEvent | null {
    if (!this.activeSegment || !lastPoint) return null;
    return this.closeActiveSegment(lastPoint);
  }
}

export function formatGradeSegmentNote(segment: GradeSegmentEvent): string {
  const dirLabel = segment.direction === 'up' ? 'UPHILL' : 'DOWNHILL';
  const catLabel = getCategoryLabel(segment.category);
  const maxGradeStr = segment.maxGrade_pct >= 0 
    ? `+${segment.maxGrade_pct.toFixed(1)}%` 
    : `${segment.maxGrade_pct.toFixed(1)}%`;
  
  return `GRADE ${dirLabel} ${catLabel}: Max ${maxGradeStr} for ${segment.length_m.toFixed(0)}m at ${(segment.startChainage_m / 1000).toFixed(2)}km`;
}

export default {
  GradeSegmentTracker,
  getGradeCategory,
  getGradeDirection,
  gradeCategoryToPOIType,
  getCategoryColor,
  getCategoryLabel,
  formatGradeSegmentNote
};
