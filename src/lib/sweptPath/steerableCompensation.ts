import type { Point } from './roadDetection';

/**
 * SteerableCompensation class manages off-tracking reduction
 * for vehicles with steerable rear axles
 * 
 * Steerable axles (also called "boogie" axles) actively steer into turns,
 * reducing the swept path width and improving maneuverability
 */
export class SteerableCompensation {
  private offTrackingReduction: number; // default 0.70 (70%)

  /**
   * Create a steerable compensation calculator
   * @param offTrackingReduction - Off-tracking reduction factor (0.0 to 1.0, default 0.70)
   *                               0.0 = no reduction, 1.0 = complete elimination
   */
  constructor(offTrackingReduction: number = 0.70) {
    // Validate reduction factor
    if (offTrackingReduction < 0 || offTrackingReduction > 1) {
      this.offTrackingReduction = Math.max(0, Math.min(1, offTrackingReduction));
    } else {
      this.offTrackingReduction = offTrackingReduction;
    }
  }

  /**
   * Get the off-tracking reduction factor
   */
  public getOffTrackingReduction(): number {
    return this.offTrackingReduction;
  }

  /**
   * Set the off-tracking reduction factor
   * @param reduction - New reduction factor (0.0 to 1.0)
   */
  public setOffTrackingReduction(reduction: number): void {
    if (reduction < 0 || reduction > 1) {
      this.offTrackingReduction = Math.max(0, Math.min(1, reduction));
    } else {
      this.offTrackingReduction = reduction;
    }
  }

  /**
   * Calculate reduced off-tracking distance
   * @param baseOffTracking - Base off-tracking without steerable axles (meters)
   * @param steerableAxles - Number of steerable axles
   * @param steerableLength - Length of steerable axle group (meters)
   * @returns Reduced off-tracking distance in meters
   */
  public calculateReducedOffTracking(
    baseOffTracking: number,
    steerableAxles: number,
    steerableLength: number
  ): number {
    // Base formula: effectiveOffTracking = baseOffTracking * (1 - offTrackingReduction)
    let effectiveReduction = this.offTrackingReduction;

    // Adjust reduction based on number of steerable axles
    // More axles = better tracking
    if (steerableAxles >= 6) {
      effectiveReduction *= 1.1; // 10% bonus for 6+ axles
    } else if (steerableAxles >= 4) {
      effectiveReduction *= 1.05; // 5% bonus for 4-5 axles
    }

    // Adjust based on steerable length
    // Longer steerable sections provide better control
    if (steerableLength >= 10) {
      effectiveReduction *= 1.08; // 8% bonus for long steerable sections
    } else if (steerableLength >= 8) {
      effectiveReduction *= 1.04; // 4% bonus for medium steerable sections
    }

    // Clamp effective reduction to max 0.85 (85%)
    effectiveReduction = Math.min(effectiveReduction, 0.85);

    const reducedOffTracking = baseOffTracking * (1 - effectiveReduction);

    return Math.max(reducedOffTracking, 0);
  }

  /**
   * Apply compensation to segment position
   * Moves the segment position closer to the path centerline
   * @param segmentPosition - Current segment position without compensation
   * @param targetPosition - Target position (path centerline)
   * @param hasSteerable - Whether the segment has steerable axles
   * @returns Compensated position
   */
  public applyCompensation(
    segmentPosition: Point,
    targetPosition: Point,
    hasSteerable: boolean
  ): Point {
    if (!hasSteerable) {
      return segmentPosition;
    }

    // Calculate offset vector from target to current position
    const dx = segmentPosition.x - targetPosition.x;
    const dy = segmentPosition.y - targetPosition.y;

    // Apply reduction factor to bring position closer to target
    const compensatedX = targetPosition.x + dx * (1 - this.offTrackingReduction);
    const compensatedY = targetPosition.y + dy * (1 - this.offTrackingReduction);

    return {
      x: compensatedX,
      y: compensatedY,
    };
  }

  /**
   * Calculate steerable axle steering angle
   * @param frontHeading - Heading of front vehicle segment (radians)
   * @param rearHeading - Heading of rear segment without steering (radians)
   * @param steerableAxles - Number of steerable axles
   * @returns Steering angle for steerable axles (radians)
   */
  public calculateSteeringAngle(
    frontHeading: number,
    rearHeading: number,
    steerableAxles: number
  ): number {
    // Calculate heading difference
    let headingDiff = frontHeading - rearHeading;

    // Normalize to -π to π
    while (headingDiff > Math.PI) {
      headingDiff -= 2 * Math.PI;
    }
    while (headingDiff < -Math.PI) {
      headingDiff += 2 * Math.PI;
    }

    // Steerable axles steer proportional to heading difference
    // More axles = more aggressive steering response
    const steerFactor = Math.min(steerableAxles / 6, 1.0); // Max at 6 axles
    const steerAngle = headingDiff * this.offTrackingReduction * steerFactor;

    return steerAngle;
  }

  /**
   * Calculate swept path width reduction
   * @param baseSweptWidth - Base swept path width without steerable (meters)
   * @param steerableAxles - Number of steerable axles
   * @param steerableLength - Length of steerable section (meters)
   * @returns Reduced swept path width in meters
   */
  public calculateSweptWidthReduction(
    baseSweptWidth: number,
    steerableAxles: number,
    steerableLength: number
  ): number {
    // Swept width reduction is similar to off-tracking reduction
    const reducedWidth = this.calculateReducedOffTracking(
      baseSweptWidth,
      steerableAxles,
      steerableLength
    );

    return reducedWidth;
  }

  /**
   * Get efficiency rating of steerable system
   * @param steerableAxles - Number of steerable axles
   * @param steerableLength - Length of steerable section (meters)
   * @returns Efficiency rating (0.0 to 1.0)
   */
  public getEfficiencyRating(steerableAxles: number, steerableLength: number): number {
    let rating = this.offTrackingReduction;

    // Bonus for more axles
    if (steerableAxles >= 6) {
      rating *= 1.1;
    } else if (steerableAxles >= 4) {
      rating *= 1.05;
    }

    // Bonus for length
    if (steerableLength >= 10) {
      rating *= 1.08;
    } else if (steerableLength >= 8) {
      rating *= 1.04;
    }

    return Math.min(rating, 1.0);
  }

  /**
   * Calculate recommended reduction factor based on vehicle configuration
   * @param steerableAxles - Number of steerable axles
   * @param steerableLength - Length of steerable section (meters)
   * @param steeringQuality - Quality of steering system (0.5 to 1.0, default 0.85)
   * @returns Recommended off-tracking reduction factor
   */
  public static calculateRecommendedReduction(
    steerableAxles: number,
    steerableLength: number,
    steeringQuality: number = 0.85
  ): number {
    // Base reduction from steering quality
    let reduction = steeringQuality * 0.7; // Start at 70% of quality

    // Adjust for number of axles
    if (steerableAxles >= 8) {
      reduction *= 1.15; // 15% bonus for 8+ axles
    } else if (steerableAxles >= 6) {
      reduction *= 1.1; // 10% bonus for 6-7 axles
    } else if (steerableAxles >= 4) {
      reduction *= 1.05; // 5% bonus for 4-5 axles
    }

    // Adjust for length
    if (steerableLength >= 12) {
      reduction *= 1.1; // 10% bonus for very long sections
    } else if (steerableLength >= 10) {
      reduction *= 1.08; // 8% bonus for long sections
    } else if (steerableLength >= 8) {
      reduction *= 1.04; // 4% bonus for medium sections
    }

    // Clamp to valid range (0.5 to 0.85)
    return Math.max(0.5, Math.min(0.85, reduction));
  }
}
