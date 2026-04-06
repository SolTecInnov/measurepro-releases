import type { Point } from './roadDetection';
import type { ArticulationJoint } from './articulationJoints';

/**
 * Base abstract class for vehicle segments
 * Represents a physical component of a multi-unit vehicle (tractor, trailer, dolly, cargo)
 */
export abstract class VehicleSegment {
  protected position: Point;
  protected heading: number; // radians
  protected length: number;
  protected width: number;
  protected axleCount: number;

  /**
   * Create a new vehicle segment
   * @param length - Segment length in meters
   * @param width - Segment width in meters
   * @param axleCount - Number of axles on this segment
   */
  constructor(length: number, width: number, axleCount: number) {
    this.position = { x: 0, y: 0 };
    this.heading = 0;
    this.length = length;
    this.width = width;
    this.axleCount = axleCount;
  }

  /**
   * Get the current position of this segment (center point)
   */
  public getPosition(): Point {
    return { ...this.position };
  }

  /**
   * Get the current heading of this segment in radians
   */
  public getHeading(): number {
    return this.heading;
  }

  /**
   * Get segment length in meters
   */
  public getLength(): number {
    return this.length;
  }

  /**
   * Get segment width in meters
   */
  public getWidth(): number {
    return this.width;
  }

  /**
   * Get number of axles
   */
  public getAxleCount(): number {
    return this.axleCount;
  }

  /**
   * Get the rear position of this segment (connection point for following segment)
   */
  abstract getRearPosition(): Point;

  /**
   * Get the front position of this segment
   */
  abstract getFrontPosition(): Point;

  /**
   * Calculate the envelope (bounding box corners) of this segment
   * Returns 4 points representing corners in clockwise order: front-left, front-right, rear-right, rear-left
   */
  abstract getEnvelope(): Point[];

  /**
   * Update this segment's position based on previous segment and joint
   * @param prevSegment - Previous vehicle segment (null for tractor)
   * @param joint - Articulation joint connecting to previous segment (null for tractor)
   */
  abstract updatePosition(
    prevSegment: VehicleSegment | null,
    joint: ArticulationJoint | null
  ): void;
}

/**
 * Tractor segment - front pulling unit with power axles
 */
export class Tractor extends VehicleSegment {
  private powerAxles: number;
  private fifthWheelOffset: number; // Distance from rear of tractor to fifth wheel (meters)
  private inputPosition: Point | null = null;
  private inputHeading: number = 0;

  /**
   * Create a tractor segment
   * @param length - Tractor length in meters
   * @param width - Tractor width in meters
   * @param powerAxles - Number of power axles (typically 1-3)
   * @param fifthWheelOffset - Distance from rear to fifth wheel in meters (typically 0.3-1.0m)
   */
  constructor(
    length: number,
    width: number,
    powerAxles: number = 2,
    fifthWheelOffset: number = 0.5
  ) {
    super(length, width, powerAxles);
    this.powerAxles = powerAxles;
    this.fifthWheelOffset = fifthWheelOffset;
  }

  /**
   * Set tractor input from vehicle movement (for tractor as first segment)
   */
  public setInput(position: Point, heading: number): void {
    this.inputPosition = position;
    this.inputHeading = heading;
  }

  /**
   * Get number of power axles
   */
  public getPowerAxles(): number {
    return this.powerAxles;
  }

  /**
   * Get fifth wheel position (connection point for trailer)
   */
  public getFifthWheelPosition(): Point {
    const rearDist = this.length / 2 - this.fifthWheelOffset;
    return {
      x: this.position.x - Math.cos(this.heading) * rearDist,
      y: this.position.y - Math.sin(this.heading) * rearDist,
    };
  }

  public getRearPosition(): Point {
    return this.getFifthWheelPosition();
  }

  public getFrontPosition(): Point {
    const halfLength = this.length / 2;
    return {
      x: this.position.x + Math.cos(this.heading) * halfLength,
      y: this.position.y + Math.sin(this.heading) * halfLength,
    };
  }

  public getEnvelope(): Point[] {
    const halfLength = this.length / 2;
    const halfWidth = this.width / 2;

    const cos = Math.cos(this.heading);
    const sin = Math.sin(this.heading);

    return [
      // Front-left
      {
        x: this.position.x + cos * halfLength - sin * halfWidth,
        y: this.position.y + sin * halfLength + cos * halfWidth,
      },
      // Front-right
      {
        x: this.position.x + cos * halfLength + sin * halfWidth,
        y: this.position.y + sin * halfLength - cos * halfWidth,
      },
      // Rear-right
      {
        x: this.position.x - cos * halfLength + sin * halfWidth,
        y: this.position.y - sin * halfLength - cos * halfWidth,
      },
      // Rear-left
      {
        x: this.position.x - cos * halfLength - sin * halfWidth,
        y: this.position.y - sin * halfLength + cos * halfWidth,
      },
    ];
  }

  public updatePosition(
    _prevSegment: VehicleSegment | null,
    _joint: ArticulationJoint | null
  ): void {
    // Tractor is the first segment - no previous segment
    // Position and heading are set directly by the simulator via setInput()
    // This method updates from the stored input position
    if (this.inputPosition !== null) {
      this.position = this.inputPosition;
      this.heading = this.inputHeading;
    }
  }
}

/**
 * JeepDolly segment - front steerable dolly for long loads
 * Converts semi-trailer into full trailer configuration
 */
export class JeepDolly extends VehicleSegment {
  private jeepAxles: number;
  private jeepLength: number;

  /**
   * Create a jeep dolly segment
   * @param jeepLength - Dolly length in meters (typically 3-6m)
   * @param width - Dolly width in meters
   * @param jeepAxles - Number of axles (typically 2 or 4)
   */
  constructor(jeepLength: number, width: number, jeepAxles: number) {
    super(jeepLength, width, jeepAxles);
    this.jeepAxles = jeepAxles;
    this.jeepLength = jeepLength;
  }

  /**
   * Get number of jeep axles
   */
  public getJeepAxles(): number {
    return this.jeepAxles;
  }

  public getRearPosition(): Point {
    const halfLength = this.jeepLength / 2;
    return {
      x: this.position.x - Math.cos(this.heading) * halfLength,
      y: this.position.y - Math.sin(this.heading) * halfLength,
    };
  }

  public getFrontPosition(): Point {
    const halfLength = this.jeepLength / 2;
    return {
      x: this.position.x + Math.cos(this.heading) * halfLength,
      y: this.position.y + Math.sin(this.heading) * halfLength,
    };
  }

  public getEnvelope(): Point[] {
    const halfLength = this.jeepLength / 2;
    const halfWidth = this.width / 2;

    const cos = Math.cos(this.heading);
    const sin = Math.sin(this.heading);

    return [
      {
        x: this.position.x + cos * halfLength - sin * halfWidth,
        y: this.position.y + sin * halfLength + cos * halfWidth,
      },
      {
        x: this.position.x + cos * halfLength + sin * halfWidth,
        y: this.position.y + sin * halfLength - cos * halfWidth,
      },
      {
        x: this.position.x - cos * halfLength + sin * halfWidth,
        y: this.position.y - sin * halfLength - cos * halfWidth,
      },
      {
        x: this.position.x - cos * halfLength - sin * halfWidth,
        y: this.position.y - sin * halfLength + cos * halfWidth,
      },
    ];
  }

  public updatePosition(
    prevSegment: VehicleSegment | null,
    joint: ArticulationJoint | null
  ): void {
    if (!prevSegment || !joint) {
      return;
    }

    // Get articulation angle from joint (already updated by simulator)
    const articulationRad = joint.getArticulationRadians();

    // Update heading based on previous segment + articulation
    // For trailers: heading decreases as articulation increases (turn opposite direction)
    this.heading = prevSegment.getHeading() - articulationRad;

    // TODO: Future enhancement - Calculate steering angle for jeep dolly (steers to reduce articulation)
    // const steerAngle = articulationRad * 0.5; // 50% of articulation angle

    // Anchor segment FRONT at previous segment's REAR (rigid joint constraint)
    const prevRear = prevSegment.getRearPosition();

    // Calculate segment CENTER position: front + (length/2) along heading
    const halfLength = this.jeepLength / 2;
    this.position = {
      x: prevRear.x + Math.cos(this.heading) * halfLength,
      y: prevRear.y + Math.sin(this.heading) * halfLength,
    };
  }
}

/**
 * SteerableDolly segment - rear multi-axle steerable dolly
 * Reduces off-tracking by steering rear axles into the turn
 */
export class SteerableDolly extends VehicleSegment {
  private steerableAxles: number;
  private steerableLength: number;
  private offTrackingReduction: number;

  /**
   * Create a steerable dolly segment
   * @param steerableLength - Dolly length in meters
   * @param width - Dolly width in meters
   * @param steerableAxles - Number of steerable axles (typically 4-8)
   * @param offTrackingReduction - Off-tracking reduction factor (default 0.70 = 70%)
   */
  constructor(
    steerableLength: number,
    width: number,
    steerableAxles: number,
    offTrackingReduction: number = 0.70
  ) {
    super(steerableLength, width, steerableAxles);
    this.steerableAxles = steerableAxles;
    this.steerableLength = steerableLength;
    this.offTrackingReduction = offTrackingReduction;
  }

  /**
   * Get number of steerable axles
   */
  public getSteerableAxles(): number {
    return this.steerableAxles;
  }

  /**
   * Get off-tracking reduction factor
   */
  public getOffTrackingReduction(): number {
    return this.offTrackingReduction;
  }

  public getRearPosition(): Point {
    const halfLength = this.steerableLength / 2;
    return {
      x: this.position.x - Math.cos(this.heading) * halfLength,
      y: this.position.y - Math.sin(this.heading) * halfLength,
    };
  }

  public getFrontPosition(): Point {
    const halfLength = this.steerableLength / 2;
    return {
      x: this.position.x + Math.cos(this.heading) * halfLength,
      y: this.position.y + Math.sin(this.heading) * halfLength,
    };
  }

  public getEnvelope(): Point[] {
    const halfLength = this.steerableLength / 2;
    const halfWidth = this.width / 2;

    const cos = Math.cos(this.heading);
    const sin = Math.sin(this.heading);

    return [
      {
        x: this.position.x + cos * halfLength - sin * halfWidth,
        y: this.position.y + sin * halfLength + cos * halfWidth,
      },
      {
        x: this.position.x + cos * halfLength + sin * halfWidth,
        y: this.position.y + sin * halfLength - cos * halfWidth,
      },
      {
        x: this.position.x - cos * halfLength + sin * halfWidth,
        y: this.position.y - sin * halfLength - cos * halfWidth,
      },
      {
        x: this.position.x - cos * halfLength - sin * halfWidth,
        y: this.position.y - sin * halfLength + cos * halfWidth,
      },
    ];
  }

  public updatePosition(
    prevSegment: VehicleSegment | null,
    joint: ArticulationJoint | null
  ): void {
    if (!prevSegment || !joint) {
      return;
    }

    // Get articulation angle from joint (already updated by simulator with reduction applied)
    const articulationRad = joint.getArticulationRadians();

    // Update heading based on previous segment + articulation
    // For trailers: heading decreases as articulation increases (turn opposite direction)
    this.heading = prevSegment.getHeading() - articulationRad;

    // Anchor segment FRONT at previous segment's REAR (rigid joint constraint)
    const prevRear = prevSegment.getRearPosition();

    // Calculate segment CENTER position: front + (length/2) along heading
    const halfLength = this.steerableLength / 2;
    this.position = {
      x: prevRear.x + Math.cos(this.heading) * halfLength,
      y: prevRear.y + Math.sin(this.heading) * halfLength,
    };
  }
}

/**
 * Trailer segment - main cargo trailer
 */
export class Trailer extends VehicleSegment {
  private deckLength: number;
  private deckHeight: number;
  private rearOverhang: number;

  /**
   * Create a trailer segment
   * @param deckLength - Deck length in meters
   * @param width - Deck width in meters
   * @param deckHeight - Deck height from ground in meters
   * @param axleCount - Number of axles (typically 2-4)
   * @param rearOverhang - Rear overhang in meters (default 0)
   */
  constructor(
    deckLength: number,
    width: number,
    deckHeight: number,
    axleCount: number,
    rearOverhang: number = 0
  ) {
    super(deckLength, width, axleCount);
    this.deckLength = deckLength;
    this.deckHeight = deckHeight;
    this.rearOverhang = rearOverhang;
  }

  /**
   * Get deck height in meters
   */
  public getDeckHeight(): number {
    return this.deckHeight;
  }

  /**
   * Get rear overhang in meters
   */
  public getRearOverhang(): number {
    return this.rearOverhang;
  }

  public getRearPosition(): Point {
    const halfLength = this.deckLength / 2;
    const rearOffset = halfLength + this.rearOverhang;
    return {
      x: this.position.x - Math.cos(this.heading) * rearOffset,
      y: this.position.y - Math.sin(this.heading) * rearOffset,
    };
  }

  public getFrontPosition(): Point {
    const halfLength = this.deckLength / 2;
    return {
      x: this.position.x + Math.cos(this.heading) * halfLength,
      y: this.position.y + Math.sin(this.heading) * halfLength,
    };
  }

  public getEnvelope(): Point[] {
    const halfLength = this.deckLength / 2 + this.rearOverhang;
    const halfWidth = this.width / 2;

    const cos = Math.cos(this.heading);
    const sin = Math.sin(this.heading);

    return [
      {
        x: this.position.x + cos * halfLength - sin * halfWidth,
        y: this.position.y + sin * halfLength + cos * halfWidth,
      },
      {
        x: this.position.x + cos * halfLength + sin * halfWidth,
        y: this.position.y + sin * halfLength - cos * halfWidth,
      },
      {
        x: this.position.x - cos * halfLength + sin * halfWidth,
        y: this.position.y - sin * halfLength - cos * halfWidth,
      },
      {
        x: this.position.x - cos * halfLength - sin * halfWidth,
        y: this.position.y - sin * halfLength + cos * halfWidth,
      },
    ];
  }

  public updatePosition(
    prevSegment: VehicleSegment | null,
    joint: ArticulationJoint | null
  ): void {
    if (!prevSegment || !joint) {
      return;
    }

    // Get articulation angle from joint (already updated by simulator)
    const articulationRad = joint.getArticulationRadians();

    // Update heading based on previous segment + articulation
    // For trailers: heading decreases as articulation increases (turn opposite direction)
    this.heading = prevSegment.getHeading() - articulationRad;

    // Anchor segment FRONT at previous segment's REAR (rigid joint constraint)
    const prevRear = prevSegment.getRearPosition();

    // Calculate segment CENTER position: front + (length/2) along heading
    const halfLength = this.deckLength / 2;
    this.position = {
      x: prevRear.x + Math.cos(this.heading) * halfLength,
      y: prevRear.y + Math.sin(this.heading) * halfLength,
    };
  }
}

/**
 * Cargo segment - payload envelope on trailer
 */
export class Cargo extends VehicleSegment {
  private cargoLength: number;
  private cargoWidth: number;
  private cargoHeight: number;
  private centerOfGravity: Point;

  /**
   * Create a cargo segment
   * @param cargoLength - Cargo length in meters
   * @param cargoWidth - Cargo width in meters
   * @param cargoHeight - Cargo height in meters
   * @param centerOfGravity - Center of gravity offset from trailer center
   */
  constructor(
    cargoLength: number,
    cargoWidth: number,
    cargoHeight: number,
    centerOfGravity: Point = { x: 0, y: 0 }
  ) {
    super(cargoLength, cargoWidth, 0); // Cargo has no axles
    this.cargoLength = cargoLength;
    this.cargoWidth = cargoWidth;
    this.cargoHeight = cargoHeight;
    this.centerOfGravity = centerOfGravity;
  }

  /**
   * Get cargo height in meters
   */
  public getCargoHeight(): number {
    return this.cargoHeight;
  }

  /**
   * Get center of gravity
   */
  public getCenterOfGravity(): Point {
    return { ...this.centerOfGravity };
  }

  public getRearPosition(): Point {
    const halfLength = this.cargoLength / 2;
    return {
      x: this.position.x - Math.cos(this.heading) * halfLength,
      y: this.position.y - Math.sin(this.heading) * halfLength,
    };
  }

  public getFrontPosition(): Point {
    const halfLength = this.cargoLength / 2;
    return {
      x: this.position.x + Math.cos(this.heading) * halfLength,
      y: this.position.y + Math.sin(this.heading) * halfLength,
    };
  }

  public getEnvelope(): Point[] {
    const halfLength = this.cargoLength / 2;
    const halfWidth = this.cargoWidth / 2;

    const cos = Math.cos(this.heading);
    const sin = Math.sin(this.heading);

    // Apply center of gravity offset
    const centerX = this.position.x + this.centerOfGravity.x;
    const centerY = this.position.y + this.centerOfGravity.y;

    return [
      {
        x: centerX + cos * halfLength - sin * halfWidth,
        y: centerY + sin * halfLength + cos * halfWidth,
      },
      {
        x: centerX + cos * halfLength + sin * halfWidth,
        y: centerY + sin * halfLength - cos * halfWidth,
      },
      {
        x: centerX - cos * halfLength + sin * halfWidth,
        y: centerY - sin * halfLength - cos * halfWidth,
      },
      {
        x: centerX - cos * halfLength - sin * halfWidth,
        y: centerY - sin * halfLength + cos * halfWidth,
      },
    ];
  }

  public updatePosition(
    prevSegment: VehicleSegment | null,
    _joint: ArticulationJoint | null
  ): void {
    if (!prevSegment) {
      return;
    }

    // Cargo follows trailer (previous segment) position and heading exactly
    // No joint, no articulation - cargo is rigidly attached to trailer
    this.position = prevSegment.getPosition();
    this.heading = prevSegment.getHeading();
  }
}
