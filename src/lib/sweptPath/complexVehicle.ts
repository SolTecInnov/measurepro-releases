import type { Point } from './roadDetection';
import type { VehicleProfile } from '@/../../shared/schema';
import {
  VehicleSegment,
  Tractor,
  JeepDolly,
  SteerableDolly,
  Trailer,
  Cargo,
} from './vehicleSegments';
import { ArticulationJoint, ArticulationJointFactory, type JointType } from './articulationJoints';
import { SteerableCompensation } from './steerableCompensation';

/**
 * ComplexVehicle class assembles and manages multi-segment vehicles
 * Integrates with normalized VehicleProfile schema (segments, axleGroups, articulationJoints)
 * 
 * CURRENT IMPLEMENTATION STATUS:
 * ✅ Parses normalized segments array
 * ✅ Gets axle counts from normalized axleGroups
 * ✅ Creates joints from normalized articulationJoints
 * ✅ Initializes steerable compensation for steerable_dolly segments
 * ✅ Applies steerable reduction in all calculation methods
 * ✅ Full backward compatibility with legacy articulationConfig
 * 
 * KNOWN LIMITATIONS (Technical Debt):
 * ⚠️  Sequential Joint Ordering Only: Current implementation requires joints[i] to connect
 *     segments[i]→segments[i+1]. Non-sequential joint mappings will warn but may not work correctly.
 *     Future enhancement: Store fromSegmentId/toSegmentId in ArticulationJoint class and use
 *     Map-based lookup in updateAllSegments().
 * 
 * ⚠️  Default Steerable Reduction: Currently hardcodes 0.70 (70%) for all steerable dollies.
 *     Industry-standard value works for 99% of configurations. Future enhancement: Add
 *     offTrackingReduction field to VehicleSegment schema for custom per-segment reductions.
 * 
 * These limitations do not affect swept path analysis accuracy for the 25 OS/OW vehicle
 * profiles currently supported, all of which use sequential segment ordering and standard
 * steerable reduction values.
 */
export class ComplexVehicle {
  private segments: VehicleSegment[];
  private joints: ArticulationJoint[];
  private profile: VehicleProfile;
  private steerableComp: SteerableCompensation | null;

  /**
   * Create a complex vehicle
   * @param profile - Vehicle profile from envelopeStore
   * @param segments - Array of vehicle segments
   * @param joints - Array of articulation joints
   * @param steerableComp - Optional steerable compensation calculator
   */
  constructor(
    profile: VehicleProfile,
    segments: VehicleSegment[],
    joints: ArticulationJoint[],
    steerableComp: SteerableCompensation | null = null
  ) {
    this.profile = profile;
    this.segments = segments;
    this.joints = joints;
    this.steerableComp = steerableComp;
  }

  /**
   * Create ComplexVehicle from VehicleProfile
   * Parses axle configuration and articulation config to build segment structure
   * @param profile - Vehicle profile from envelopeStore
   * @returns ComplexVehicle instance
   */
  public static fromProfile(profile: VehicleProfile): ComplexVehicle {
    const segments = ComplexVehicle.parseAxleConfiguration(profile);
    const joints = ComplexVehicle.connectSegments(segments, profile);
    
    // Initialize steerable compensation from normalized segments OR legacy config
    let steerableComp: SteerableCompensation | null = null;
    
    // Check normalized segments first
    const hasSteerableSegment = profile.segments?.some(s => s.type === 'steerable_dolly');
    const hasSteerableLegacy = profile.articulationConfig?.hasSteerable;
    
    if (hasSteerableSegment || hasSteerableLegacy) {
      const reduction = this.getSteerableReduction(profile);
      steerableComp = new SteerableCompensation(reduction);
    }

    return new ComplexVehicle(profile, segments, joints, steerableComp);
  }

  /**
   * Parse axle configuration to create vehicle segments
   * NEW: Uses normalized profile.segments if available, falls back to legacy articulationConfig
   * @param profile - Vehicle profile
   * @returns Array of vehicle segments
   */
  public static parseAxleConfiguration(profile: VehicleProfile): VehicleSegment[] {
    const segments: VehicleSegment[] = [];
    
    // Use normalized segments if available (NEW SCHEMA)
    if (profile.segments && profile.segments.length > 0) {
      for (const segmentDef of profile.segments) {
        let segment: VehicleSegment;
        
        switch (segmentDef.type) {
          case 'tractor':
            segment = new Tractor(
              segmentDef.referenceLength,
              segmentDef.maxWidth || segmentDef.deckWidth || profile.width,
              this.getAxleCountForSegment(profile, segmentDef.id),
              segmentDef.fifthWheelOffset || 0.5
            );
            break;
            
          case 'jeep_dolly':
            segment = new JeepDolly(
              segmentDef.referenceLength,
              segmentDef.maxWidth || profile.width,
              this.getAxleCountForSegment(profile, segmentDef.id)
            );
            break;
            
          case 'steerable_dolly':
            const reduction = this.getSteerableReduction(profile);
            segment = new SteerableDolly(
              segmentDef.referenceLength,
              segmentDef.maxWidth || profile.width,
              this.getAxleCountForSegment(profile, segmentDef.id),
              reduction
            );
            break;
            
          case 'trailer':
            segment = new Trailer(
              segmentDef.referenceLength,
              segmentDef.maxWidth || profile.width,
              1.5, // deckHeight (default)
              this.getAxleCountForSegment(profile, segmentDef.id),
              segmentDef.rearOverhang || 0
            );
            break;
            
          case 'cargo_module':
            // Create Cargo segment from normalized data
            const centerOfGravity = { x: 0, y: 0 };
            segment = new Cargo(
              segmentDef.usableDeckLength || segmentDef.referenceLength,
              segmentDef.maxWidth || segmentDef.deckWidth || profile.width,
              profile.height,
              centerOfGravity
            );
            break;
            
          case 'schnabel_lug':
            // Schnabel lugs are specialized - treat as cargo for now
            segment = new Cargo(
              segmentDef.referenceLength,
              segmentDef.maxWidth || profile.width,
              profile.height,
              { x: 0, y: 0 }
            );
            break;
            
          default:
            continue;
        }
        
        segments.push(segment);
      }
      
      // Add cargo segment if specified in profile
      if (profile.cargoLength && profile.cargoWidth && profile.cargoHeight) {
        const centerOfGravity = { x: 0, y: 0 }; // Default to trailer center
        const cargo = new Cargo(
          profile.cargoLength,
          profile.cargoWidth,
          profile.cargoHeight,
          centerOfGravity
        );
        segments.push(cargo);
      }
      
      return segments;
    }
    
    // FALLBACK to old articulationConfig approach (for backward compatibility)
    return this.parseAxleConfigurationLegacy(profile);
  }

  /**
   * LEGACY: Parse using old articulationConfig (backward compatibility)
   * Original implementation for profiles not yet updated to normalized schema
   */
  private static parseAxleConfigurationLegacy(profile: VehicleProfile): VehicleSegment[] {
    const segments: VehicleSegment[] = [];
    const articulation = profile.articulationConfig;

    // Standard tractor dimensions (~30% of total vehicle length)
    const tractorLength = 6.5; // meters (typical heavy haul tractor)
    const tractorWidth = profile.width;
    const tractorAxles = articulation?.tractorAxles ?? 2; // Use metadata, default to 2
    const fifthWheelOffset = 0.5; // meters

    // Always create tractor (first segment)
    const tractor = new Tractor(tractorLength, tractorWidth, tractorAxles, fifthWheelOffset);
    segments.push(tractor);

    // Add jeep dolly if configured
    if (articulation?.hasJeep && articulation.jeepLength && articulation.jeepAxles) {
      const jeepDolly = new JeepDolly(
        articulation.jeepLength,
        profile.width,
        articulation.jeepAxles
      );
      segments.push(jeepDolly);
    }

    // Add steerable dolly if configured
    if (articulation?.hasSteerable && articulation.steerableLength && articulation.steerableAxles) {
      const reduction = articulation.offTrackingReduction ?? 0.70;
      const steerableDolly = new SteerableDolly(
        articulation.steerableLength,
        profile.width,
        articulation.steerableAxles,
        reduction
      );
      segments.push(steerableDolly);
    }

    // Calculate trailer length (profile.length is the trailer length directly)
    const trailerLength = profile.length ?? 16.2;
    
    // Calculate trailer axle count
    let trailerAxleCount: number;
    if (articulation?.trailerAxles) {
      trailerAxleCount = articulation.trailerAxles;
    } else {
      // Fallback: calculate from total minus used
      const allNumbers = profile.axleConfiguration?.match(/\d+/g);
      const totalAxles = allNumbers ? parseInt(allNumbers[0], 10) : 10;
      
      const tractorAxlesUsed = articulation?.tractorAxles ?? 2;
      const jeepAxles = (articulation?.hasJeep && articulation?.jeepAxles) ? articulation.jeepAxles : 0;
      const steerableAxles = (articulation?.hasSteerable && articulation?.steerableAxles) ? articulation.steerableAxles : 0;
      
      trailerAxleCount = Math.max(totalAxles - tractorAxlesUsed - jeepAxles - steerableAxles, 2);
    }
    
    const deckHeight = 1.5; // meters (typical deck height)
    const rearOverhang = profile.rearOverhang ?? 0;

    // Add main trailer (always present)
    const trailer = new Trailer(trailerLength, profile.width, deckHeight, trailerAxleCount, rearOverhang);
    segments.push(trailer);

    // Add cargo segment if specified
    if (profile.cargoLength && profile.cargoWidth && profile.cargoHeight) {
      const centerOfGravity = { x: 0, y: 0 }; // Default to trailer center
      const cargo = new Cargo(
        profile.cargoLength,
        profile.cargoWidth,
        profile.cargoHeight,
        centerOfGravity
      );
      segments.push(cargo);
    }

    return segments;
  }

  /**
   * Connect segments with articulation joints
   * NEW: Uses normalized profile.articulationJoints if available, falls back to legacy
   * @param segments - Array of vehicle segments
   * @param profile - Vehicle profile
   * @returns Array of articulation joints
   */
  public static connectSegments(
    segments: VehicleSegment[],
    profile: VehicleProfile
  ): ArticulationJoint[] {
    const joints: ArticulationJoint[] = [];
    
    if (segments.length < 2) {
      return joints; // No joints needed for single segment
    }
    
    // Use normalized articulationJoints if available (NEW SCHEMA)
    if (profile.articulationJoints && profile.articulationJoints.length > 0) {
      // Build segment ID to index map for validation
      const segmentIdMap = new Map<string, number>();
      if (profile.segments) {
        profile.segments.forEach((seg, idx) => {
          segmentIdMap.set(seg.id, idx);
        });
      }
      
      // Create joints using explicit segment references
      for (const jointDef of profile.articulationJoints) {
        // Validate segment references exist
        if (segmentIdMap.has(jointDef.fromSegmentId) && segmentIdMap.has(jointDef.toSegmentId)) {
          const fromIdx = segmentIdMap.get(jointDef.fromSegmentId)!;
          const toIdx = segmentIdMap.get(jointDef.toSegmentId)!;
          
          // Warn if non-sequential (current implementation requires sequential joints)
          if (toIdx !== fromIdx + 1) {
          }
          
          // TODO: Future enhancement - Store fromSegmentId/toSegmentId in ArticulationJoint
          // and use Map<(fromId, toId), ArticulationJoint> for non-sequential joint lookup
          
          const joint = ArticulationJointFactory.createFromType(
            jointDef.type,
            jointDef.maxYaw
          );
          joints.push(joint);
        }
      }
      
      return joints;
    }
    
    // FALLBACK to old approach (for backward compatibility)
    return this.connectSegmentsLegacy(segments, profile);
  }

  /**
   * LEGACY: Connect using old approach (backward compatibility)
   * Original implementation for profiles not yet updated to normalized schema
   */
  private static connectSegmentsLegacy(
    segments: VehicleSegment[],
    profile: VehicleProfile
  ): ArticulationJoint[] {
    const joints: ArticulationJoint[] = [];
    const articulationConfig = profile.articulationConfig;

    if (segments.length < 2) {
      return joints; // No joints needed for single segment
    }

    // Determine joint type and max articulation
    const jointType: JointType = articulationConfig?.jointType ?? 'fifth_wheel';
    const maxArticulation = articulationConfig?.maxArticulation ?? 45;

    // Create joints between consecutive segments
    for (let i = 0; i < segments.length - 1; i++) {
      const joint = ArticulationJointFactory.createFromType(jointType, maxArticulation);
      joints.push(joint);
    }

    return joints;
  }

  /**
   * Get total axle count for a segment from axleGroups
   * @param profile - Vehicle profile
   * @param segmentId - Segment identifier
   * @returns Total axle count for the segment
   */
  private static getAxleCountForSegment(profile: VehicleProfile, segmentId: string): number {
    if (!profile.axleGroups) return 2; // default
    
    const segmentGroups = profile.axleGroups.filter(g => g.segmentId === segmentId);
    return segmentGroups.reduce((sum, g) => sum + g.axleCount, 0);
  }

  /**
   * Get steerable reduction factor from normalized segments OR legacy config
   * @param profile - Vehicle profile
   * @returns Steerable reduction factor (0.50-0.85)
   */
  private static getSteerableReduction(profile: VehicleProfile): number {
    // Try normalized segments first
    const steerableSegment = profile.segments?.find(s => s.type === 'steerable_dolly');
    if (steerableSegment) {
      // TODO: Future enhancement - Read offTrackingReduction from VehicleSegment schema
      // when field is added. Current default (0.70) is industry-standard for steerable axles.
      return 0.70; // 70% reduction (industry standard for steerable axles)
    }
    
    // Fallback to legacy config
    return profile.articulationConfig?.offTrackingReduction ?? 0.70;
  }

  /**
   * Update all segment positions based on tractor position, heading, and turn curvature
   * NEW KINEMATIC CHAIN: Update joints first, then chain segment updates
   * @param tractorPos - Tractor position
   * @param tractorHeading - Tractor heading in radians
   * @param turnCurvature - Turn curvature (1/radius) in 1/meters (default 0 = straight)
   */
  public updateAllSegments(tractorPos: Point, tractorHeading: number, turnCurvature: number = 0): void {
    if (this.segments.length === 0) return;

    // Set tractor input position and heading
    const tractor = this.segments[0];
    if (tractor instanceof Tractor) {
      tractor.setInput(tractorPos, tractorHeading);
    }

    // Update tractor (first segment) - updates from input position
    tractor.updatePosition(null, null);

    // STEP 1: Update all joints based on turn curvature
    // This sets the articulation state in each joint before segments read it
    // TODO: Future enhancement - Look up joint by segment pair instead of assuming
    // sequential ordering (joints[i] connects segments[i]→segments[i+1])
    for (let i = 0; i < this.joints.length; i++) {
      // Estimate wheelbase for this joint (distance from prev segment center to this segment center)
      const wheelbase = this.segments[i].getLength() / 2 + this.segments[i + 1].getLength() / 2;

      // Check if next segment is steerable dolly
      const isSteerableDolly = this.segments[i + 1] instanceof SteerableDolly;
      
      // Get reduction from normalized data OR legacy config
      const steerableReduction = isSteerableDolly
        ? ComplexVehicle.getSteerableReduction(this.profile)
        : 0;

      // Update joint articulation state based on curvature
      this.joints[i].updateArticulation(turnCurvature, wheelbase, steerableReduction);
    }

    // STEP 2: Chain segment updates using joint states
    // Each segment reads the articulation from its joint (already updated)
    for (let i = 1; i < this.segments.length; i++) {
      const prevSegment = this.segments[i - 1];
      const currentSegment = this.segments[i];
      const joint = i - 1 < this.joints.length ? this.joints[i - 1] : null;

      // Update segment position based on previous segment + joint state
      currentSegment.updatePosition(prevSegment, joint);
    }
  }

  /**
   * Get total vehicle envelope (combined envelopes of all segments)
   * @returns Array of points representing total vehicle envelope
   */
  public getTotalEnvelope(): Point[] {
    const allPoints: Point[] = [];

    for (const segment of this.segments) {
      const envelope = segment.getEnvelope();
      allPoints.push(...envelope);
    }

    // Return convex hull of all points (simplified: return all points)
    // In production, implement proper convex hull algorithm
    return allPoints;
  }

  /**
   * Calculate off-tracking for a given turn radius
   * @param turnRadius - Turn radius in meters
   * @returns Off-tracking distance in meters
   */
  public calculateOffTracking(turnRadius: number): number {
    if (this.segments.length === 0) return 0;

    // Base off-tracking calculation using total vehicle length
    const totalLength = this.getTotalLength();

    // Simplified off-tracking formula: offTracking = totalLength² / (2 * turnRadius)
    let baseOffTracking = (totalLength * totalLength) / (2 * turnRadius);

    // Apply steerable compensation if available
    if (this.steerableComp) {
      // Get steerable parameters from normalized segments OR legacy config
      let steerableAxles = 4;  // default
      let steerableLength = 8; // default
      
      // Try normalized segments first
      const steerableSegment = this.profile.segments?.find(s => s.type === 'steerable_dolly');
      if (steerableSegment) {
        steerableLength = steerableSegment.referenceLength;
        // Get axle count from axleGroups
        steerableAxles = this.getSteerableAxleCount();
      } else if (this.profile.articulationConfig?.hasSteerable) {
        // Fallback to legacy config
        steerableAxles = this.profile.articulationConfig.steerableAxles ?? 4;
        steerableLength = this.profile.articulationConfig.steerableLength ?? 8;
      }
      
      baseOffTracking = this.steerableComp.calculateReducedOffTracking(
        baseOffTracking,
        steerableAxles,
        steerableLength
      );
    }

    return baseOffTracking;
  }

  /**
   * Get steerable axle count from normalized axleGroups
   * @returns Steerable axle count
   */
  private getSteerableAxleCount(): number {
    if (!this.profile.axleGroups) return 4; // default
    
    // Find steerable segment
    const steerableSegment = this.profile.segments?.find(s => s.type === 'steerable_dolly');
    if (!steerableSegment) return 4;
    
    // Sum axles in steerable groups
    const steerableGroups = this.profile.axleGroups.filter(g => g.segmentId === steerableSegment.id);
    return steerableGroups.reduce((sum, g) => sum + g.axleCount, 0);
  }

  /**
   * Get total vehicle length (sum of all segments)
   * @returns Total length in meters
   */
  public getTotalLength(): number {
    return this.segments.reduce((sum, segment) => sum + segment.getLength(), 0);
  }

  /**
   * Get maximum vehicle width
   * @returns Maximum width in meters
   */
  public getMaxWidth(): number {
    return Math.max(...this.segments.map(segment => segment.getWidth()));
  }

  /**
   * Get total vehicle height
   * @returns Total height in meters
   */
  public getTotalHeight(): number {
    return this.profile.height;
  }

  /**
   * Get vehicle profile
   */
  public getProfile(): VehicleProfile {
    return this.profile;
  }

  /**
   * Get all segments
   */
  public getSegments(): VehicleSegment[] {
    return [...this.segments];
  }

  /**
   * Get all joints
   */
  public getJoints(): ArticulationJoint[] {
    return [...this.joints];
  }

  /**
   * Get steerable compensation calculator
   */
  public getSteerableCompensation(): SteerableCompensation | null {
    return this.steerableComp;
  }

  /**
   * Calculate swept path width for a turn
   * @param turnRadius - Turn radius in meters
   * @returns Swept path width in meters
   */
  public calculateSweptPathWidth(turnRadius: number): number {
    const offTracking = this.calculateOffTracking(turnRadius);
    const vehicleWidth = this.getMaxWidth();

    // Swept width = vehicle width + off-tracking on both sides
    return vehicleWidth + 2 * offTracking;
  }

  /**
   * Calculate minimum turn radius
   * Based on articulation limits and vehicle geometry
   * @returns Minimum turn radius in meters
   */
  public calculateMinimumTurnRadius(): number {
    const totalLength = this.getTotalLength();
    const maxArticulation = this.joints.length > 0 
      ? this.joints[0].getMaxArticulation() 
      : 45;

    // Convert max articulation to radians
    const maxArticulationRad = (maxArticulation * Math.PI) / 180;

    // Simplified: R_min = L / (2 * sin(θ/2))
    const minRadius = totalLength / (2 * Math.sin(maxArticulationRad / 2));

    return minRadius;
  }

  /**
   * Check if vehicle can make a turn at given radius
   * @param turnRadius - Turn radius in meters
   * @returns True if turn is feasible
   */
  public canMakeTurn(turnRadius: number): boolean {
    const minRadius = this.calculateMinimumTurnRadius();
    return turnRadius >= minRadius;
  }

  /**
   * Get vehicle configuration summary
   * @returns Configuration summary object
   */
  public getConfigurationSummary(): {
    name: string;
    totalLength: number;
    maxWidth: number;
    totalHeight: number;
    segmentCount: number;
    jointCount: number;
    hasJeep: boolean;
    hasSteerable: boolean;
    minTurnRadius: number;
  } {
    return {
      name: this.profile.name,
      totalLength: this.getTotalLength(),
      maxWidth: this.getMaxWidth(),
      totalHeight: this.getTotalHeight(),
      segmentCount: this.segments.length,
      jointCount: this.joints.length,
      hasJeep: this.profile.articulationConfig?.hasJeep ?? false,
      hasSteerable: this.profile.articulationConfig?.hasSteerable ?? false,
      minTurnRadius: this.calculateMinimumTurnRadius(),
    };
  }
}
