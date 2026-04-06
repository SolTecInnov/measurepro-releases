/**
 * Grade Colour Utility
 * Shared grade classification and colour helpers — sourced from the UI colour scheme
 * in ProfileVisualization.tsx. Grade colour scheme: 6 tiers.
 *
 * Tier thresholds (absolute grade %)
 *   ≤  8 %  →  SAFE        #10b981  green-500
 *    8-10 %  →  CAUTION     #3b82f6  blue-500
 *   10-12 %  →  WARNING     #f59e0b  amber-500
 *   12-14 %  →  DANGER      #ef4444  red-500
 *   14-16 %  →  HIGH_RISK   #a855f7  purple-500
 *    > 16 %  →  CRITICAL    #111827  near-black
 */

export type GradeClass =
  | 'SAFE'
  | 'CAUTION'
  | 'WARNING'
  | 'DANGER'
  | 'HIGH_RISK'
  | 'CRITICAL';

export interface GradeTier {
  cls: GradeClass;
  hex: string;
  /** AutoCAD ACI colour index */
  aciColor: number;
  /** DXF layer name */
  layerName: string;
  /** KML colour string in AABBGGRR byte order */
  kmlColor: string;
}

export const GRADE_TIERS: GradeTier[] = [
  { cls: 'SAFE',      hex: '#10b981', aciColor: 3,   layerName: 'GRADE_SAFE',      kmlColor: 'ff81b910' },
  { cls: 'CAUTION',   hex: '#3b82f6', aciColor: 5,   layerName: 'GRADE_CAUTION',   kmlColor: 'fff6823b' },
  { cls: 'WARNING',   hex: '#f59e0b', aciColor: 2,   layerName: 'GRADE_WARNING',   kmlColor: 'ff0b9ef5' },
  { cls: 'DANGER',    hex: '#ef4444', aciColor: 1,   layerName: 'GRADE_DANGER',    kmlColor: 'ff4444ef' },
  { cls: 'HIGH_RISK', hex: '#a855f7', aciColor: 6,   layerName: 'GRADE_HIGH_RISK', kmlColor: 'fff755a8' },
  { cls: 'CRITICAL',  hex: '#111827', aciColor: 250, layerName: 'GRADE_CRITICAL',  kmlColor: 'ff271811' },
];

export function getGradeTier(gradePct: number | null): GradeTier {
  const abs = Math.abs(gradePct ?? 0);
  if (abs > 16) return GRADE_TIERS[5];
  if (abs > 14) return GRADE_TIERS[4];
  if (abs > 12) return GRADE_TIERS[3];
  if (abs > 10) return GRADE_TIERS[2];
  if (abs > 8)  return GRADE_TIERS[1];
  return GRADE_TIERS[0];
}

export function getGradeClass(gradePct: number | null): GradeClass {
  return getGradeTier(gradePct).cls;
}

export function getGradeColor(gradePct: number | null): string {
  return getGradeTier(gradePct).hex;
}
