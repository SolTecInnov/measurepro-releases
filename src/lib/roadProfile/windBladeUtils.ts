/**
 * Wind Blade Transport Utilities
 * K-factor and radius conversion, ground contact risk detection
 * for oversized load transport (wind blades, long beams, etc.)
 */

import type {
  WindBladeConfig,
  WindBladeAlertType,
  WindBladeRiskAssessment,
  WindBladeAlertSegment,
  RoadProfilePoint
} from './types';

export const DEFAULT_WIND_BLADE_CONFIG: WindBladeConfig = {
  totalLength_m: 75,              // Typical wind blade transport ~75m
  rearOverhang_m: 30,             // Rear overhang beyond last axle
  groundClearance_m: 0.3,         // 30cm minimum ground clearance
  minDetectionDistance_m: 200,    // Must sustain over 200m to be flagged
  convexThreshold: 2500,          // K-factor threshold for convex (crest) curves
  concaveThreshold: 2500,         // K-factor threshold for concave (sag) curves
  useRadius: false                // Use K-factor by default
};

/**
 * Convert K-factor to vertical curve radius
 * K = L / A where L is curve length, A is grade difference
 * For a circular vertical curve: R ≈ K * 100 (when grades are in %)
 * 
 * K-factor: distance (m) needed for 1% grade change
 * Radius: actual curve radius in meters
 */
export function kFactorToRadius(kFactor: number): number {
  if (kFactor === 0) return Infinity;
  return Math.abs(kFactor) * 100;
}

/**
 * Convert vertical curve radius to K-factor
 */
export function radiusToKFactor(radius_m: number): number {
  if (radius_m === 0 || !isFinite(radius_m)) return 0;
  return radius_m / 100;
}

/**
 * Calculate ground clearance loss on a convex (crest) curve
 * When vehicle crests a hill, rear overhang can touch ground
 * 
 * For a vehicle of length L with rear overhang O on a curve of radius R:
 * Clearance loss ≈ O² / (2 * R)  (simplified formula)
 * 
 * More accurate: The load sags below the curve tangent line
 */
export function calculateConvexClearanceLoss(
  rearOverhang_m: number,
  radius_m: number
): number {
  if (radius_m <= 0 || !isFinite(radius_m)) return 0;
  return (rearOverhang_m * rearOverhang_m) / (2 * radius_m);
}

/**
 * Calculate ground clearance loss on a concave (sag) curve
 * When vehicle goes through a sag, the middle section can touch ground
 * 
 * For a vehicle of total length L on a curve of radius R:
 * Clearance loss ≈ L² / (8 * R) at the midpoint
 */
export function calculateConcaveClearanceLoss(
  totalLength_m: number,
  radius_m: number
): number {
  if (radius_m <= 0 || !isFinite(radius_m)) return 0;
  return (totalLength_m * totalLength_m) / (8 * radius_m);
}

/**
 * Determine curve type from grade change
 * Convex (crest): grade decreases (uphill to downhill or less uphill)
 * Concave (sag): grade increases (downhill to uphill or less downhill)
 */
export function getCurveType(gradeChange: number): 'convex' | 'concave' | 'flat' {
  if (gradeChange < -0.5) return 'convex';  // Grade decreasing = crest
  if (gradeChange > 0.5) return 'concave';  // Grade increasing = sag
  return 'flat';
}

/**
 * Assess ground contact risk for a given curve
 */
export function assessGroundContactRisk(
  config: WindBladeConfig,
  effectiveKFactor: number,
  curveType: 'convex' | 'concave' | 'flat',
  detectionWindow_m: number,
  startChainage_m: number,
  endChainage_m: number
): WindBladeRiskAssessment {
  const effectiveRadius = kFactorToRadius(effectiveKFactor);
  
  let alertType: WindBladeAlertType = 'NONE';
  let clearanceLoss = 0;
  let description = '';
  
  if (curveType === 'convex') {
    clearanceLoss = calculateConvexClearanceLoss(config.rearOverhang_m, effectiveRadius);
    if (clearanceLoss > 0) {
      alertType = 'REAR_TIP_CONVEX';
      description = `Crest curve: rear tip clearance loss ${(clearanceLoss * 100).toFixed(1)}cm`;
    }
  } else if (curveType === 'concave') {
    clearanceLoss = calculateConcaveClearanceLoss(config.totalLength_m, effectiveRadius);
    if (clearanceLoss > 0) {
      alertType = 'MIDDLE_SECTION_CONCAVE';
      description = `Sag curve: middle section clearance loss ${(clearanceLoss * 100).toFixed(1)}cm`;
    }
  }
  
  const clearanceDeficit = Math.max(0, clearanceLoss - config.groundClearance_m);
  
  let riskLevel: 'NONE' | 'WARNING' | 'CRITICAL' = 'NONE';
  if (clearanceDeficit > 0) {
    riskLevel = 'CRITICAL';
    description += ` - GROUND CONTACT LIKELY (${(clearanceDeficit * 100).toFixed(1)}cm deficit)`;
  } else if (clearanceLoss > config.groundClearance_m * 0.5) {
    riskLevel = 'WARNING';
    description += ` - CAUTION (${((config.groundClearance_m - clearanceLoss) * 100).toFixed(1)}cm remaining)`;
  }
  
  // Also check against threshold
  const threshold = config.useRadius 
    ? (curveType === 'convex' ? config.convexThreshold : config.concaveThreshold)
    : (curveType === 'convex' ? config.convexThreshold : config.concaveThreshold);
  
  if (config.useRadius) {
    if (effectiveRadius < threshold && riskLevel === 'NONE') {
      riskLevel = 'WARNING';
      description = `${curveType === 'convex' ? 'Crest' : 'Sag'} curve radius ${effectiveRadius.toFixed(0)}m below threshold ${threshold}m`;
    }
  } else {
    if (effectiveKFactor < threshold && riskLevel === 'NONE') {
      riskLevel = 'WARNING';
      description = `${curveType === 'convex' ? 'Crest' : 'Sag'} K-factor ${effectiveKFactor.toFixed(0)} below threshold ${threshold}`;
    }
  }
  
  return {
    alertType: riskLevel === 'NONE' ? 'NONE' : alertType,
    riskLevel,
    clearanceDeficit_m: clearanceDeficit,
    effectiveKFactor,
    effectiveRadius_m: effectiveRadius,
    detectionWindow_m,
    startChainage_m,
    endChainage_m,
    description
  };
}

/**
 * Detect sustained K-factor events over a rolling window
 * Uses a sliding window approach to smooth out GPS noise and find sustained curves
 * Only flags alerts that persist over the minimum detection distance
 */
export function detectSustainedKFactorAlerts(
  points: RoadProfilePoint[],
  config: WindBladeConfig
): WindBladeAlertSegment[] {
  if (points.length < 10) return [];
  
  const alerts: WindBladeAlertSegment[] = [];
  const minDistance = config.minDetectionDistance_m;
  const windowSize = Math.max(10, Math.floor(minDistance / 10)); // ~10m per point assumption
  
  // Pass 1: Compute rolling window curve characteristics
  interface WindowStats {
    startIdx: number;
    endIdx: number;
    startChainage: number;
    endChainage: number;
    avgKFactor: number;
    totalGradeChange: number;
    curveType: 'convex' | 'concave' | 'flat';
    effectiveRadius: number;
  }
  
  const windowStats: WindowStats[] = [];
  
  for (let i = 0; i <= points.length - windowSize; i++) {
    const windowPoints = points.slice(i, i + windowSize);
    const startChainage = windowPoints[0].chainage_m;
    const endChainage = windowPoints[windowPoints.length - 1].chainage_m;
    const windowLength = endChainage - startChainage;
    
    if (windowLength < 10) continue; // Skip tiny windows
    
    // Compute total grade change over window (smoothed curve detection)
    const startGrade = windowPoints[0].grade_pct;
    const endGrade = windowPoints[windowPoints.length - 1].grade_pct;
    const totalGradeChange = endGrade - startGrade;
    
    // Compute average K-factor over window
    const avgKFactor = windowPoints.reduce((sum, p) => sum + p.k_factor, 0) / windowPoints.length;
    
    // Determine curve type from total grade change (smoothed)
    let curveType: 'convex' | 'concave' | 'flat' = 'flat';
    if (totalGradeChange < -1.0) curveType = 'convex';  // Grade decreasing = crest
    else if (totalGradeChange > 1.0) curveType = 'concave'; // Grade increasing = sag
    
    const effectiveRadius = kFactorToRadius(avgKFactor);
    
    windowStats.push({
      startIdx: i,
      endIdx: i + windowSize - 1,
      startChainage,
      endChainage,
      avgKFactor,
      totalGradeChange,
      curveType,
      effectiveRadius
    });
  }
  
  // Pass 2: Find sustained segments where curve type persists
  let segmentStart: WindowStats | null = null;
  let segmentType: 'convex' | 'concave' | null = null;
  let segmentWindows: WindowStats[] = [];
  
  for (const stats of windowStats) {
    // Check if this window exceeds threshold
    const threshold = config.useRadius
      ? (stats.curveType === 'convex' ? config.convexThreshold : config.concaveThreshold)
      : (stats.curveType === 'convex' ? config.convexThreshold : config.concaveThreshold);
    
    const effectiveValue = config.useRadius ? stats.effectiveRadius : stats.avgKFactor;
    const exceedsThreshold = config.useRadius
      ? effectiveValue < threshold && effectiveValue > 0
      : stats.avgKFactor < threshold && stats.avgKFactor > 0;
    
    if (stats.curveType !== 'flat' && exceedsThreshold) {
      if (segmentType === stats.curveType) {
        segmentWindows.push(stats);
      } else {
        // Process previous segment
        if (segmentStart && segmentWindows.length > 0) {
          const lastWindow = segmentWindows[segmentWindows.length - 1];
          const segmentLength = lastWindow.endChainage - segmentStart.startChainage;
          
          if (segmentLength >= minDistance) {
            const alert = createAlertFromWindows(segmentWindows, segmentType!, config, points);
            if (alert) alerts.push(alert);
          }
        }
        
        // Start new segment
        segmentStart = stats;
        segmentType = stats.curveType;
        segmentWindows = [stats];
      }
    } else {
      // End current segment
      if (segmentStart && segmentWindows.length > 0) {
        const lastWindow = segmentWindows[segmentWindows.length - 1];
        const segmentLength = lastWindow.endChainage - segmentStart.startChainage;
        
        if (segmentLength >= minDistance) {
          const alert = createAlertFromWindows(segmentWindows, segmentType!, config, points);
          if (alert) alerts.push(alert);
        }
      }
      
      segmentStart = null;
      segmentType = null;
      segmentWindows = [];
    }
  }
  
  // Process final segment
  if (segmentStart && segmentWindows.length > 0) {
    const lastWindow = segmentWindows[segmentWindows.length - 1];
    const segmentLength = lastWindow.endChainage - segmentStart.startChainage;
    
    if (segmentLength >= minDistance) {
      const alert = createAlertFromWindows(segmentWindows, segmentType!, config, points);
      if (alert) alerts.push(alert);
    }
  }
  
  return alerts;
}

function createAlertFromWindows(
  windows: Array<{ startIdx: number; endIdx: number; startChainage: number; endChainage: number; avgKFactor: number; effectiveRadius: number }>,
  curveType: 'convex' | 'concave',
  config: WindBladeConfig,
  points: RoadProfilePoint[]
): WindBladeAlertSegment | null {
  if (windows.length === 0) return null;
  
  const startChainage = windows[0].startChainage;
  const endChainage = windows[windows.length - 1].endChainage;
  const avgKFactor = windows.reduce((sum, w) => sum + w.avgKFactor, 0) / windows.length;
  const minRadius = Math.min(...windows.map(w => w.effectiveRadius));
  
  // Find midpoint for location
  const midIdx = Math.floor((windows[0].startIdx + windows[windows.length - 1].endIdx) / 2);
  const midPoint = points[Math.min(midIdx, points.length - 1)];
  
  const assessment = assessGroundContactRisk(
    config,
    avgKFactor,
    curveType,
    endChainage - startChainage,
    startChainage,
    endChainage
  );
  
  // Only create alert if there's actual risk (clearance-based or threshold-based)
  if (assessment.riskLevel === 'NONE') return null;
  
  return {
    id: `wb-${Date.now()}-${startChainage.toFixed(0)}`,
    alertType: curveType === 'convex' ? 'REAR_TIP_CONVEX' : 'MIDDLE_SECTION_CONCAVE',
    riskLevel: assessment.riskLevel as 'WARNING' | 'CRITICAL',
    startChainage_m: startChainage,
    endChainage_m: endChainage,
    length_m: endChainage - startChainage,
    maxKFactor: avgKFactor,
    minRadius_m: minRadius,
    clearanceDeficit_m: assessment.clearanceDeficit_m,
    lat: midPoint.lat,
    lon: midPoint.lon,
    description: assessment.description
  };
}

/**
 * Load wind blade config from localStorage
 */
export function loadWindBladeConfig(): WindBladeConfig {
  try {
    const saved = localStorage.getItem('wind_blade_config');
    if (saved) {
      return { ...DEFAULT_WIND_BLADE_CONFIG, ...JSON.parse(saved) };
    }
  } catch (e) {
    // Ignore
  }
  return DEFAULT_WIND_BLADE_CONFIG;
}

/**
 * Save wind blade config to localStorage
 */
export function saveWindBladeConfig(config: WindBladeConfig): void {
  try {
    localStorage.setItem('wind_blade_config', JSON.stringify(config));
  } catch (e) {
    // Ignore
  }
}
