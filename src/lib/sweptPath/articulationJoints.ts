import type { Point } from './roadDetection';
import type { VehicleSegment } from './vehicleSegments';

/**
 * Joint type for vehicle articulation
 */
export type JointType = 'fifth_wheel' | 'king_pin' | 'pivot' | 'turntable';

/**
 * ArticulationJoint class manages the connection between vehicle segments
 * Handles articulation angle calculation and constraints
 */
export class ArticulationJoint {
  private jointType: JointType;
  private maxArticulation: number; // degrees
  private currentAngle: number; // degrees (DEPRECATED - use currentArticulationRad)
  private currentArticulationRad: number = 0; // NEW: Current articulation state in radians
  private position: Point;

  /**
   * Create an articulation joint
   * @param type - Joint type (fifth_wheel, king_pin, or pivot)
   * @param maxArticulation - Maximum articulation angle in degrees
   */
  constructor(type: JointType, maxArticulation: number) {
    this.jointType = type;
    this.maxArticulation = maxArticulation;
    this.currentAngle = 0;
    this.currentArticulationRad = 0;
    this.position = { x: 0, y: 0 };
  }

  /**
   * Get the joint type
   */
  public getJointType(): JointType {
    return this.jointType;
  }

  /**
   * Get the maximum articulation angle in degrees
   */
  public getMaxArticulation(): number {
    return this.maxArticulation;
  }

  /**
   * Get the current articulation angle in degrees
   */
  public getCurrentAngle(): number {
    return this.currentAngle;
  }

  /**
   * Get the current joint position
   */
  public getPosition(): Point {
    return { ...this.position };
  }

  /**
   * NEW METHOD: Update articulation from simulator inputs
   * This is the primary method for updating joint state
   * @param turnCurvature - Turn curvature (1/radius) in 1/meters
   * @param wheelbase - Effective wheelbase for this joint in meters
   * @param steerableReduction - Reduction factor for steerable dollies (0-1)
   */
  public updateArticulation(
    turnCurvature: number,
    wheelbase: number,
    steerableReduction: number = 0
  ): void {
    // Calculate desired articulation from curvature
    // Formula: articulation = atan(wheelbase / turnRadius)
    // where turnRadius = 1 / curvature
    
    if (turnCurvature === 0) {
      this.currentArticulationRad = 0;
      this.currentAngle = 0;
      return;
    }
    
    const turnRadius = 1 / turnCurvature;
    let desiredArticulation = Math.atan(wheelbase / turnRadius);
    
    // Apply steerable reduction if applicable
    if (steerableReduction > 0) {
      desiredArticulation *= (1 - steerableReduction);
    }
    
    // Constrain to joint limits
    const maxRad = (this.maxArticulation * Math.PI) / 180;
    this.currentArticulationRad = Math.max(-maxRad, Math.min(maxRad, desiredArticulation));
    
    // Update legacy currentAngle for backward compatibility
    this.currentAngle = (this.currentArticulationRad * 180) / Math.PI;
  }

  /**
   * NEW METHOD: Get current articulation in radians
   * @returns Current articulation angle in radians
   */
  public getArticulationRadians(): number {
    return this.currentArticulationRad;
  }

  /**
   * Calculate articulation angle between front and rear segments
   * DEPRECATED: Use updateArticulation() and getArticulationRadians() instead
   * @param frontSegment - Front vehicle segment
   * @param rearSegment - Rear vehicle segment
   * @returns Articulation angle in degrees
   */
  public calculateArticulationAngle(
    frontSegment: VehicleSegment,
    rearSegment: VehicleSegment
  ): number {
    const frontHeading = frontSegment.getHeading();
    const rearHeading = rearSegment.getHeading();

    // Calculate relative angle difference
    let angleDiff = frontHeading - rearHeading;

    // Normalize to -180 to 180 degrees
    angleDiff = this.normalizeAngle(angleDiff);

    // Convert to degrees
    const angleDegrees = (angleDiff * 180) / Math.PI;

    // Constrain to joint limits
    this.currentAngle = this.constrainAngle(angleDegrees);

    return this.currentAngle;
  }

  /**
   * Constrain angle to joint articulation limits
   * @param angle - Input angle in degrees
   * @returns Constrained angle in degrees
   */
  public constrainAngle(angle: number): number {
    if (angle > this.maxArticulation) {
      return this.maxArticulation;
    }
    if (angle < -this.maxArticulation) {
      return -this.maxArticulation;
    }
    return angle;
  }

  /**
   * Get joint position based on front segment
   * @param frontSegment - Front vehicle segment
   * @returns Joint position point
   */
  public getJointPosition(frontSegment: VehicleSegment): Point {
    const frontPos = frontSegment.getPosition();
    const frontHeading = frontSegment.getHeading();
    const frontLength = frontSegment.getLength();

    // Joint is at the rear of the front segment
    const offset = frontLength / 2;

    this.position = {
      x: frontPos.x - Math.cos(frontHeading) * offset,
      y: frontPos.y - Math.sin(frontHeading) * offset,
    };

    return this.position;
  }

  /**
   * Calculate articulation moment (torque) at joint
   * Used for physics simulation and stability analysis
   * @param frontSegment - Front vehicle segment
   * @param rearSegment - Rear vehicle segment
   * @param turnRadius - Turn radius in meters
   * @returns Articulation moment in N⋅m (simplified)
   */
  public calculateArticulationMoment(
    frontSegment: VehicleSegment,
    rearSegment: VehicleSegment,
    turnRadius: number
  ): number {
    const angle = this.calculateArticulationAngle(frontSegment, rearSegment);
    const angleRad = (angle * Math.PI) / 180;

    // Simplified moment calculation based on segment lengths and turn radius
    const frontLength = frontSegment.getLength();
    const rearLength = rearSegment.getLength();
    const leverArm = (frontLength + rearLength) / 2;

    // Moment proportional to angle and lever arm, inversely proportional to turn radius
    const moment = (Math.abs(angleRad) * leverArm * 1000) / Math.max(turnRadius, 1);

    return moment;
  }

  /**
   * Check if articulation angle is within safe limits
   * @returns True if angle is within limits
   */
  public isWithinLimits(): boolean {
    return Math.abs(this.currentAngle) <= this.maxArticulation;
  }

  /**
   * Normalize angle to -π to π range
   * @param angle - Input angle in radians
   * @returns Normalized angle in radians
   */
  private normalizeAngle(angle: number): number {
    while (angle > Math.PI) {
      angle -= 2 * Math.PI;
    }
    while (angle < -Math.PI) {
      angle += 2 * Math.PI;
    }
    return angle;
  }

  /**
   * Get joint characteristics based on type
   * @returns Object with joint characteristics
   */
  public getCharacteristics(): {
    type: JointType;
    maxArticulation: number;
    description: string;
  } {
    const characteristics = {
      fifth_wheel: {
        type: 'fifth_wheel' as JointType,
        maxArticulation: 45,
        description: 'Standard tractor-trailer fifth wheel connection',
      },
      king_pin: {
        type: 'king_pin' as JointType,
        maxArticulation: 60,
        description: 'Heavy-duty king pin for increased articulation',
      },
      pivot: {
        type: 'pivot' as JointType,
        maxArticulation: 60,
        description: 'Full pivot joint for articulated combinations',
      },
      turntable: {
        type: 'turntable' as JointType,
        maxArticulation: 90,
        description: 'Turntable joint for heavy modular trailers and schnabel beams',
      },
    };

    return characteristics[this.jointType];
  }

  /**
   * Calculate optimal articulation angle for a given turn
   * @param turnRadius - Turn radius in meters
   * @param segmentLength - Combined length of segments at joint
   * @returns Optimal articulation angle in degrees
   */
  public calculateOptimalAngle(turnRadius: number, segmentLength: number): number {
    // Simplified calculation using arc geometry
    // tan(angle/2) ≈ segmentLength / (2 * turnRadius)
    const halfAngleRad = Math.atan(segmentLength / (2 * turnRadius));
    const optimalAngleDeg = (2 * halfAngleRad * 180) / Math.PI;

    return this.constrainAngle(optimalAngleDeg);
  }
}

/**
 * Factory function to create joints with preset configurations
 */
export class ArticulationJointFactory {
  /**
   * Create a standard fifth wheel joint (45° max)
   */
  static createFifthWheel(): ArticulationJoint {
    return new ArticulationJoint('fifth_wheel', 45);
  }

  /**
   * Create a king pin joint (60° max)
   */
  static createKingPin(): ArticulationJoint {
    return new ArticulationJoint('king_pin', 60);
  }

  /**
   * Create a pivot joint (60° max)
   */
  static createPivot(): ArticulationJoint {
    return new ArticulationJoint('pivot', 60);
  }

  /**
   * Create a turntable joint (90° max)
   */
  static createTurntable(): ArticulationJoint {
    return new ArticulationJoint('turntable', 90);
  }

  /**
   * Create a joint from string type
   * @param type - Joint type string
   * @param maxArticulation - Optional custom max articulation
   */
  static createFromType(type: JointType, maxArticulation?: number): ArticulationJoint {
    const defaultMax = {
      fifth_wheel: 45,
      king_pin: 60,
      pivot: 60,
      turntable: 90,
    };

    return new ArticulationJoint(type, maxArticulation ?? defaultMax[type]);
  }
}
