import type { Point } from './roadDetection';
import { ComplexVehicle } from './complexVehicle';
import { Tractor, SteerableDolly } from './vehicleSegments';

/**
 * Clearance level classification for safety margins
 */
export enum ClearanceLevel {
  SAFE = 'safe',       // > 2.0m margin
  CAUTION = 'caution', // 1.0-2.0m margin
  WARNING = 'warning', // 0.5-1.0m margin
  CRITICAL = 'critical', // 0-0.5m margin
  COLLISION = 'collision' // < 0m (intrusion)
}

/**
 * Clearance status with margins and classification
 */
export interface ClearanceStatus {
  level: ClearanceLevel;
  leftMargin: number; // meters
  rightMargin: number; // meters
  minimumMargin: number; // meters
  worstSide: 'left' | 'right';
}

/**
 * Collision detection result with intrusion details
 */
export interface CollisionResult {
  hasCollision: boolean;
  side: 'left' | 'right' | null;
  intrusionDistance: number; // meters into road boundary
  firstCollisionPoint: Point | null;
  worstCollisionPoint: Point | null;
  worstIntrusion: number; // meters
}

/**
 * Segment-specific off-tracking contribution
 */
export interface SegmentContribution {
  segmentType: string;
  offTracking: number; // meters
  percentage: number; // 0-1 of total
}

/**
 * Complete off-tracking analysis result
 */
export interface OffTrackingResult {
  total: number; // meters
  withoutSteerable: number; // meters (baseline)
  steerableReduction: number; // meters saved
  reductionPercentage: number; // 0-1
  segmentContributions: SegmentContribution[];
}

/**
 * Snapshot of vehicle state at a simulation step
 */
export interface TurnSnapshot {
  step: number;
  tractorPos: Point;
  tractorHeading: number;
  vehicleEnvelope: Point[];
  offTracking: number;
  collision: CollisionResult | null;
  clearance: ClearanceStatus;
}

/**
 * ClearanceCalculator - Calculates safety margins between vehicle and road boundaries
 */
export class ClearanceCalculator {
  /**
   * Calculate clearance margins and status
   * @param envelope - Vehicle envelope points
   * @param roadBoundaries - Road boundaries (left and right)
   * @returns Clearance status with margins and classification
   */
  public static calculateClearance(
    envelope: Point[],
    roadBoundaries: { left: Point[], right: Point[] }
  ): ClearanceStatus {
    if (envelope.length === 0) {
      return {
        level: ClearanceLevel.SAFE,
        leftMargin: Infinity,
        rightMargin: Infinity,
        minimumMargin: Infinity,
        worstSide: 'left'
      };
    }

    // Calculate minimum distance to left boundary using signed distance
    let leftMargin = Infinity;
    for (const point of envelope) {
      const distance = this.signedDistanceToPolyline(point, roadBoundaries.left, true);
      // Only count positive distances (safe side)
      if (distance > 0 && distance < leftMargin) {
        leftMargin = distance;
      }
    }

    // Calculate minimum distance to right boundary using signed distance
    let rightMargin = Infinity;
    for (const point of envelope) {
      const distance = this.signedDistanceToPolyline(point, roadBoundaries.right, false);
      // Only count positive distances (safe side)
      if (distance > 0 && distance < rightMargin) {
        rightMargin = distance;
      }
    }

    // Determine worst side and minimum margin
    const minimumMargin = Math.min(leftMargin, rightMargin);
    const worstSide: 'left' | 'right' = leftMargin < rightMargin ? 'left' : 'right';

    // Classify clearance level
    const level = this.classifyMargin(minimumMargin);

    return {
      level,
      leftMargin,
      rightMargin,
      minimumMargin,
      worstSide
    };
  }

  /**
   * Classify clearance level based on margin distance
   * @param margin - Clearance margin in meters
   * @returns Clearance level classification
   */
  private static classifyMargin(margin: number): ClearanceLevel {
    if (margin < 0) {
      return ClearanceLevel.COLLISION;
    } else if (margin < 0.5) {
      return ClearanceLevel.CRITICAL;
    } else if (margin < 1.0) {
      return ClearanceLevel.WARNING;
    } else if (margin < 2.0) {
      return ClearanceLevel.CAUTION;
    } else {
      return ClearanceLevel.SAFE;
    }
  }

  /**
   * Calculate signed distance from point to polyline using cross-product
   * POSITIVE = point is to the RIGHT of polyline (safe for left boundary)
   * NEGATIVE = point is to the LEFT of polyline (collision for left boundary)
   * 
   * @param point - Point to measure from
   * @param polyline - Boundary polyline
   * @param isLeftBoundary - True if this is the left boundary, false for right
   * @returns Signed distance (negative = intrusion, positive = safe)
   */
  private static signedDistanceToPolyline(
    point: Point,
    polyline: Point[],
    isLeftBoundary: boolean
  ): number {
    if (polyline.length === 0) {
      return Infinity;
    }

    let minDistance = Infinity;
    let crossProduct = 0;
    
    // Find closest segment and calculate cross-product
    for (let i = 0; i < polyline.length - 1; i++) {
      const segStart = polyline[i];
      const segEnd = polyline[i + 1];
      
      const dist = this.pointToLineDistance(point, segStart, segEnd);
      
      if (dist < minDistance) {
        minDistance = dist;
        
        // Calculate cross-product to determine which side
        // Vector from segStart to segEnd
        const dx = segEnd.x - segStart.x;
        const dy = segEnd.y - segStart.y;
        
        // Vector from segStart to point
        const px = point.x - segStart.x;
        const py = point.y - segStart.y;
        
        // Cross product: positive = point is to the right, negative = left
        crossProduct = dx * py - dy * px;
      }
    }
    
    // For left boundary: negative cross-product = intrusion (point is left of boundary)
    // For right boundary: positive cross-product = intrusion (point is right of boundary)
    const intrusion = isLeftBoundary ? (crossProduct < 0) : (crossProduct > 0);
    
    return intrusion ? -minDistance : minDistance;
  }

  /**
   * Calculate minimum distance from point to line segment
   * @param point - Point to measure from
   * @param lineStart - Start of line segment
   * @param lineEnd - End of line segment
   * @returns Minimum distance in meters
   */
  private static pointToLineDistance(
    point: Point,
    lineStart: Point,
    lineEnd: Point
  ): number {
    const dx = lineEnd.x - lineStart.x;
    const dy = lineEnd.y - lineStart.y;
    const lengthSquared = dx * dx + dy * dy;

    if (lengthSquared === 0) {
      const distX = point.x - lineStart.x;
      const distY = point.y - lineStart.y;
      return Math.sqrt(distX * distX + distY * distY);
    }

    // Calculate projection parameter t
    const t = Math.max(0, Math.min(1, (
      (point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy
    ) / lengthSquared));

    // Calculate closest point on line segment
    const closestX = lineStart.x + t * dx;
    const closestY = lineStart.y + t * dy;

    // Return distance to closest point
    const distX = point.x - closestX;
    const distY = point.y - closestY;
    return Math.sqrt(distX * distX + distY * distY);
  }
}

/**
 * CollisionDetector - Detects collisions between vehicle envelope and road boundaries
 * FIXED: Now uses simplified signed distance calculation instead of unreliable ray-casting
 */
export class CollisionDetector {
  /**
   * Check collision between vehicle envelope and road boundaries
   * Uses signed distance: positive = outside (safe), negative = intrusion (collision)
   * @param envelope - Vehicle envelope points
   * @param roadBoundaries - Left and right road boundaries
   * @returns Collision result with intrusion details
   */
  public static detectCollision(
    envelope: Point[],
    roadBoundaries: { left: Point[], right: Point[] }
  ): CollisionResult {
    if (envelope.length === 0) {
      return {
        hasCollision: false,
        side: null,
        intrusionDistance: 0,
        firstCollisionPoint: null,
        worstCollisionPoint: null,
        worstIntrusion: 0
      };
    }

    let hasCollision = false;
    let worstIntrusion = 0;
    let worstCollisionPoint: Point | null = null;
    let firstCollisionPoint: Point | null = null;
    let collisionSide: 'left' | 'right' | null = null;

    // Check each envelope point for collisions
    for (const point of envelope) {
      // Calculate signed distance to left boundary (negative = intrusion)
      const leftDist = this.signedDistanceToPolyline(point, roadBoundaries.left, true);
      
      // Calculate signed distance to right boundary (negative = intrusion)
      const rightDist = this.signedDistanceToPolyline(point, roadBoundaries.right, false);
      
      // Check left boundary intrusion
      if (leftDist < 0 && Math.abs(leftDist) > worstIntrusion) {
        hasCollision = true;
        collisionSide = 'left';
        worstIntrusion = Math.abs(leftDist);
        worstCollisionPoint = point;
        if (!firstCollisionPoint) {
          firstCollisionPoint = point;
        }
      }
      
      // Check right boundary intrusion
      if (rightDist < 0 && Math.abs(rightDist) > worstIntrusion) {
        hasCollision = true;
        collisionSide = 'right';
        worstIntrusion = Math.abs(rightDist);
        worstCollisionPoint = point;
        if (!firstCollisionPoint) {
          firstCollisionPoint = point;
        }
      }
    }

    return {
      hasCollision,
      side: collisionSide,
      intrusionDistance: worstIntrusion,
      firstCollisionPoint,
      worstCollisionPoint,
      worstIntrusion
    };
  }

  /**
   * Calculate signed distance from point to polyline using cross-product
   * POSITIVE = point is to the RIGHT of polyline (safe for left boundary)
   * NEGATIVE = point is to the LEFT of polyline (collision for left boundary)
   * 
   * @param point - Point to measure from
   * @param polyline - Boundary polyline
   * @param isLeftBoundary - True if this is the left boundary, false for right
   * @returns Signed distance (negative = intrusion, positive = safe)
   */
  private static signedDistanceToPolyline(
    point: Point,
    polyline: Point[],
    isLeftBoundary: boolean
  ): number {
    if (polyline.length === 0) {
      return Infinity;
    }

    let minDistance = Infinity;
    let crossProduct = 0;
    
    // Find closest segment and calculate cross-product
    for (let i = 0; i < polyline.length - 1; i++) {
      const segStart = polyline[i];
      const segEnd = polyline[i + 1];
      
      const dist = this.pointToLineDistance(point, segStart, segEnd);
      
      if (dist < minDistance) {
        minDistance = dist;
        
        // Calculate cross-product to determine which side
        // Vector from segStart to segEnd
        const dx = segEnd.x - segStart.x;
        const dy = segEnd.y - segStart.y;
        
        // Vector from segStart to point
        const px = point.x - segStart.x;
        const py = point.y - segStart.y;
        
        // Cross product: positive = point is to the right, negative = left
        crossProduct = dx * py - dy * px;
      }
    }
    
    // For left boundary: negative cross-product = intrusion (point is left of boundary)
    // For right boundary: positive cross-product = intrusion (point is right of boundary)
    const intrusion = isLeftBoundary ? (crossProduct < 0) : (crossProduct > 0);
    
    return intrusion ? -minDistance : minDistance;
  }

  /**
   * Calculate minimum distance from point to line segment
   * @param point - Point to measure from
   * @param lineStart - Start of line segment
   * @param lineEnd - End of line segment
   * @returns Minimum distance in meters
   */
  private static pointToLineDistance(
    point: Point,
    lineStart: Point,
    lineEnd: Point
  ): number {
    const dx = lineEnd.x - lineStart.x;
    const dy = lineEnd.y - lineStart.y;
    const lengthSquared = dx * dx + dy * dy;

    if (lengthSquared === 0) {
      const distX = point.x - lineStart.x;
      const distY = point.y - lineStart.y;
      return Math.sqrt(distX * distX + distY * distY);
    }

    // Calculate projection parameter t
    const t = Math.max(0, Math.min(1, (
      (point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy
    ) / lengthSquared));

    // Calculate closest point on line segment
    const closestX = lineStart.x + t * dx;
    const closestY = lineStart.y + t * dy;

    // Return distance to closest point
    const distX = point.x - closestX;
    const distY = point.y - closestY;
    return Math.sqrt(distX * distX + distY * distY);
  }
}

/**
 * OffTrackingCalculator - Calculates off-tracking with segment contributions
 */
export class OffTrackingCalculator {
  /**
   * Calculate total off-tracking for a turn
   * FIXED: Now uses ComplexVehicle.calculateOffTracking() which properly handles
   * multi-segment articulation. Baseline is reverse-calculated from actual result.
   * @param vehicle - Complex vehicle
   * @param turnRadius - Turn radius in meters
   * @returns Off-tracking breakdown with segment contributions
   */
  public static calculateOffTracking(
    vehicle: ComplexVehicle,
    turnRadius: number
  ): OffTrackingResult {
    // Use ComplexVehicle's accurate multi-segment off-tracking (already implements steerable reduction)
    const actualOffTracking = vehicle.calculateOffTracking(turnRadius);
    
    // For baseline (without steerable), reverse the steerable compensation
    // If vehicle has steerable compensation, divide by the reduction factor to get baseline
    const steerableComp = vehicle.getSteerableCompensation();
    const baselineOffTracking = steerableComp 
      ? actualOffTracking / 0.70  // Reverse the 70% reduction (0.70 = industry standard)
      : actualOffTracking;
    
    // Calculate steerable reduction
    const steerableReduction = baselineOffTracking - actualOffTracking;
    const reductionPercentage = baselineOffTracking > 0 
      ? steerableReduction / baselineOffTracking 
      : 0;
    
    // Calculate segment-by-segment contributions
    const segmentContributions = this.calculateSegmentContributions(vehicle, turnRadius);

    return {
      total: actualOffTracking,
      withoutSteerable: baselineOffTracking,
      steerableReduction,
      reductionPercentage,
      segmentContributions
    };
  }

  /**
   * Calculate segment-by-segment off-tracking contributions
   * 
   * MVP IMPLEMENTATION: Uses simple proportional distribution by segment length.
   * This provides a reasonable approximation for UI visualization without
   * complex articulated apex path calculations.
   * 
   * TODO (Option A): Use articulated apex path kinematics for accurate
   * per-segment contributions that account for articulation angles, hinge
   * positions, and true instantaneous center of rotation at each joint.
   * 
   * @param vehicle - Complex vehicle
   * @param turnRadius - Turn radius in meters
   * @returns Array of segment contributions
   */
  private static calculateSegmentContributions(
    vehicle: ComplexVehicle,
    turnRadius: number
  ): SegmentContribution[] {
    const segments = vehicle.getSegments();
    const contributions: SegmentContribution[] = [];
    
    if (segments.length === 0) {
      return contributions;
    }

    // Get total off-tracking for the vehicle
    const totalOffTracking = vehicle.calculateOffTracking(turnRadius);
    
    // MVP: Distribute off-tracking proportionally by segment length
    const totalLength = segments.reduce((sum, seg) => sum + seg.getLength(), 0);
    
    if (totalLength === 0) {
      return contributions;
    }
    
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      const segmentLength = segment.getLength();
      const proportion = segmentLength / totalLength;
      
      // Determine segment type name
      let segmentType = 'Unknown';
      if (segment instanceof Tractor) {
        segmentType = 'Tractor';
      } else if (segment instanceof SteerableDolly) {
        segmentType = 'Steerable Dolly';
      } else {
        segmentType = segment.constructor.name;
      }
      
      contributions.push({
        segmentType,
        offTracking: proportion * totalOffTracking,
        percentage: proportion
      });
    }

    return contributions;
  }
}

/**
 * Swept Path Simulator - MVP Implementation
 * 
 * CURRENT LIMITATIONS (MVP - Option B):
 * - Hardcoded 90° circular arc at origin
 * - Does not integrate with RoadDetection geometry
 * - Simplified collision detection (distance-based heuristic)
 * - Proportional off-tracking distribution by segment length
 * 
 * FUTURE ENHANCEMENTS (Option A - Perfect Physics):
 * 1. Integrate with RoadDetection for realistic turn paths
 *    - Use detected road centerline as turn trajectory
 *    - Start simulation at actual vehicle entry position
 *    - Follow road curvature changes throughout turn
 * 
 * 2. Support variable-radius turns and transition curves
 *    - Handle clothoid/spiral transitions
 *    - Support compound curves with multiple radii
 *    - Adapt to real-world road geometry
 * 
 * 3. Implement signed-distance collision detection with normal vectors
 *    - Calculate true geometric inside/outside determination
 *    - Use boundary normal vectors for accurate intrusion detection
 *    - Replace distance-based heuristic with proper signed distance
 * 
 * 4. Use articulated apex path kinematics for accurate off-tracking
 *    - Calculate instantaneous center of rotation at each joint
 *    - Account for articulation angles and hinge positions
 *    - Compute true apex path for each trailer segment
 * 
 * 5. Add support for arbitrary entry positions and headings
 *    - Allow simulation start from any position/heading
 *    - Support reverse maneuvers and complex paths
 *    - Enable multi-point turn simulation
 * 
 * @see docs/swept-path-physics-options.md for detailed comparison
 */
export class SweptPathSimulator {
  private vehicle: ComplexVehicle;
  private roadBoundaries: { left: Point[], right: Point[] };
  private turnRadius: number;
  private stepSize: number;
  
  // Current simulation state
  private currentStep: number = 0;
  private currentTractorPos: Point;
  private currentTractorHeading: number;

  /**
   * Create a swept path simulator
   * @param vehicle - Complex vehicle to simulate
   * @param roadBoundaries - Road boundaries (left and right)
   * @param turnRadius - Turn radius in meters
   * @param stepSize - Distance to advance per step in meters (default 0.5m)
   */
  constructor(
    vehicle: ComplexVehicle,
    roadBoundaries: { left: Point[], right: Point[] },
    turnRadius: number,
    stepSize: number = 0.5
  ) {
    this.vehicle = vehicle;
    this.roadBoundaries = roadBoundaries;
    this.turnRadius = turnRadius;
    this.stepSize = stepSize;
    
    // Initialize starting position and heading
    this.currentTractorPos = { x: 0, y: 0 };
    this.currentTractorHeading = 0; // radians
  }

  /**
   * Simulate turn trajectory
   * 
   * MVP LIMITATION: Currently simulates a hardcoded 90° circular arc at the origin.
   * This is a simplified approach that does NOT use detected road geometry from
   * RoadDetection. The arc starts at (0,0) with heading 0 and follows a circular
   * path with the specified turn radius.
   * 
   * TODO: Future enhancement - Integrate with RoadDetection to:
   * 1. Use actual detected road centerline path instead of hardcoded arc
   * 2. Start simulation at realistic entry position from road detection
   * 3. Follow road curvature changes throughout the turn
   * 4. Handle variable-radius turns and transition curves
   * 
   * @returns Array of vehicle envelope snapshots at each step
   */
  public simulateTurn(): TurnSnapshot[] {
    const snapshots: TurnSnapshot[] = [];
    
    // Reset simulation state
    this.currentStep = 0;
    this.currentTractorPos = { x: 0, y: 0 };
    this.currentTractorHeading = 0;
    
    // Calculate total arc length to simulate (90-degree turn)
    const turnAngle = Math.PI / 2; // 90 degrees in radians
    const arcLength = this.turnRadius * turnAngle;
    const totalSteps = Math.ceil(arcLength / this.stepSize);
    
    // Simulate each step along hardcoded circular arc
    // TODO: Replace with actual road centerline path from RoadDetection
    for (let step = 0; step <= totalSteps; step++) {
      this.currentStep = step;
      
      // Update vehicle position for this step
      const turnCurvature = 1 / this.turnRadius;
      this.vehicle.updateAllSegments(
        this.currentTractorPos,
        this.currentTractorHeading,
        turnCurvature
      );
      
      // Capture current state
      const snapshot = this.captureSnapshot();
      snapshots.push(snapshot);
      
      // Advance to next step
      if (step < totalSteps) {
        this.advanceStep();
      }
    }
    
    return snapshots;
  }

  /**
   * Capture current vehicle state as a snapshot
   * @returns Turn snapshot
   */
  private captureSnapshot(): TurnSnapshot {
    // Get current vehicle envelope
    const vehicleEnvelope = this.getCurrentEnvelope();
    
    // Calculate off-tracking
    const offTrackingResult = OffTrackingCalculator.calculateOffTracking(
      this.vehicle,
      this.turnRadius
    );
    
    // Detect collisions
    const collision = CollisionDetector.detectCollision(
      vehicleEnvelope,
      this.roadBoundaries
    );
    
    // Calculate clearance
    const clearance = ClearanceCalculator.calculateClearance(
      vehicleEnvelope,
      this.roadBoundaries
    );
    
    return {
      step: this.currentStep,
      tractorPos: { ...this.currentTractorPos },
      tractorHeading: this.currentTractorHeading,
      vehicleEnvelope,
      offTracking: offTrackingResult.total,
      collision: collision.hasCollision ? collision : null,
      clearance
    };
  }

  /**
   * Get current vehicle envelope (all segment envelopes combined)
   * @returns Array of envelope points
   */
  private getCurrentEnvelope(): Point[] {
    return this.vehicle.getTotalEnvelope();
  }

  /**
   * Advance simulation to next step
   * Updates tractor position and heading based on turn radius
   */
  private advanceStep(): void {
    // Calculate angular velocity (radians per meter)
    const angularVelocity = 1 / this.turnRadius;
    
    // Calculate heading change for this step
    const deltaHeading = angularVelocity * this.stepSize;
    
    // Update heading
    this.currentTractorHeading += deltaHeading;
    
    // Calculate new position along circular arc
    // Using parametric circle equations:
    // x(t) = R * sin(θ)
    // y(t) = R * (1 - cos(θ))
    this.currentTractorPos = {
      x: this.turnRadius * Math.sin(this.currentTractorHeading),
      y: this.turnRadius * (1 - Math.cos(this.currentTractorHeading))
    };
  }

  /**
   * Set custom starting position and heading
   * @param position - Starting position
   * @param heading - Starting heading in radians
   */
  public setStartingState(position: Point, heading: number): void {
    this.currentTractorPos = { ...position };
    this.currentTractorHeading = heading;
    this.currentStep = 0;
  }

  /**
   * Get current simulation state
   */
  public getCurrentState(): { step: number; position: Point; heading: number } {
    return {
      step: this.currentStep,
      position: { ...this.currentTractorPos },
      heading: this.currentTractorHeading
    };
  }
}
