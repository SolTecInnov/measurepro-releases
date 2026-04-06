import { z } from 'zod';

// Contact Form Email Schema
export const contactFormEmailSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  subject: z.string().min(5, 'Subject must be at least 5 characters'),
  message: z.string().min(10, 'Message must be at least 10 characters'),
});

export type ContactFormEmail = z.infer<typeof contactFormEmailSchema>;

// Survey Completion Email Schema
// NOTE: Large packages (100MB-500MB) use downloadUrl instead of attachments
export const surveyCompletionEmailSchema = z.object({
  to: z.array(z.string().email()),
  bcc: z.array(z.string().email()),
  surveyTitle: z.string(),
  surveyorName: z.string(),
  clientName: z.string(),
  projectNumber: z.string().optional(),
  completionDate: z.string(),
  measurementCount: z.number(),
  notes: z.string().optional(),
  downloadUrl: z.string().optional(),  // Firebase Storage download link
  packageSize: z.string().optional(),  // Human-readable size (e.g., "45.2 MB")
  hasDownloadLink: z.boolean().optional(),  // Flag to indicate download link is available
});

export type SurveyCompletionEmail = z.infer<typeof surveyCompletionEmailSchema>;

// Alert Threshold Email Schema
export const alertThresholdEmailSchema = z.object({
  to: z.array(z.string().email()),
  bcc: z.array(z.string().email()),
  alertType: z.enum(['WARNING', 'CRITICAL']),
  measurementValue: z.number(),
  thresholdValue: z.number(),
  latitude: z.number(),
  longitude: z.number(),
  altitude: z.number().optional(),
  heading: z.number().optional(),
  speed: z.number().optional(),
  timestamp: z.string(),
  surveyTitle: z.string().optional(),
  surveyorName: z.string().optional(),
  clientName: z.string().optional(),
  projectNumber: z.string().optional(),
  poiNumber: z.number().optional(),
  roadNumber: z.number().optional(),
  notes: z.string().optional(),
  attachments: z.array(z.object({
    filename: z.string(),
    content: z.string(), // Base64 encoded
    contentType: z.string(),
  })).optional(),
});

export type AlertThresholdEmail = z.infer<typeof alertThresholdEmailSchema>;

// Data Export Email Schema
export const dataExportEmailSchema = z.object({
  recipientEmail: z.string().email('Invalid recipient email'),
  exportType: z.enum(['csv', 'json', 'geojson', 'media']),
  measurementCount: z.number(),
  dateRange: z.object({
    from: z.string(),
    to: z.string(),
  }),
  filters: z.object({
    surveyId: z.string().optional(),
    userId: z.string().optional(),
    poiType: z.string().optional(),
  }).optional(),
  attachment: z.object({
    filename: z.string(),
    content: z.string(), // Base64 encoded
    contentType: z.string(),
  }),
  additionalNotes: z.string().optional(),
});

export type DataExportEmail = z.infer<typeof dataExportEmailSchema>;

// Live Monitor QR Code Email Schema
export const liveMonitorQREmailSchema = z.object({
  recipientEmail: z.string().email('Invalid recipient email'),
  monitorUrl: z.string().url('Invalid monitor URL'),
  qrCodeBase64: z.string(),
  senderName: z.string(),
  expiryDate: z.string().optional(),
  accessInstructions: z.string().optional(),
});

export type LiveMonitorQREmail = z.infer<typeof liveMonitorQREmailSchema>;

// Test Email Schema
export const testEmailSchema = z.object({
  recipientEmail: z.string().email('Invalid recipient email'),
});

export type TestEmail = z.infer<typeof testEmailSchema>;

// Sync Completion Email Schema
export const syncCompletionEmailSchema = z.object({
  recipientEmail: z.string().email('Invalid recipient email'),
  syncStatus: z.enum(['success', 'partial', 'failed']),
  totalItems: z.number(),
  syncedItems: z.number(),
  failedItems: z.number(),
  syncDuration: z.string(),
  timestamp: z.string(),
  errors: z.array(z.object({
    item: z.string(),
    error: z.string(),
  })).optional(),
  summary: z.string(),
});

export type SyncCompletionEmail = z.infer<typeof syncCompletionEmailSchema>;

// Measurement Log Email Schema
export const measurementLogEmailSchema = z.object({
  to: z.array(z.string().email()),
  bcc: z.array(z.string().email()),
  surveyTitle: z.string(),
  surveyorName: z.string(),
  clientName: z.string(),
  projectNumber: z.string().optional(),
  measurementCount: z.number(),
  exportFormats: z.array(z.enum(['csv', 'json', 'geojson'])),
  attachments: z.array(z.object({
    filename: z.string(),
    content: z.string(), // Base64 encoded
    contentType: z.string(),
  })),
  imageAttachments: z.array(z.object({
    filename: z.string(),
    content: z.string(), // Base64 encoded
    contentType: z.string(),
  })).optional(),
  notes: z.string().optional(),
});

export type MeasurementLogEmail = z.infer<typeof measurementLogEmailSchema>;

// Generic Email Response Schema
export const emailResponseSchema = z.object({
  success: z.boolean(),
  messageId: z.string().optional(),
  error: z.string().optional(),
});

export type EmailResponse = z.infer<typeof emailResponseSchema>;

// ==================== ENVELOPE CLEARANCE SYSTEM ====================

// Clearance Status Type
export type ClearanceStatus = 'safe' | 'warning' | 'critical';

// Articulation Configuration Schema (for Swept Path Analysis premium add-on)
// Used to model complex multi-unit vehicles with dollies and steerable axles
// Integrates with existing 25 vehicle profiles (flatbeds, lowboys, RGNs, perimeter frames, etc.)
export const articulationConfigSchema = z.object({
  // Jeep Dolly Configuration
  // A jeep dolly is a short auxiliary frame with 2-4 axles used to support the front
  // of long loads, converting a semi-trailer into a full trailer configuration
  hasJeep: z.boolean().default(false),
  jeepAxles: z.number().int().min(2).max(4).optional(), // Typically 2 or 4 axles
  jeepLength: z.number().positive().optional(), // Length in meters (typically 3-6m)
  
  // Steerable Dolly Configuration
  // A steerable dolly (boogie) has steerable rear axles that reduce off-tracking
  // Common on heavy haul configurations with 4-8 axles
  hasSteerable: z.boolean().default(false),
  steerableAxles: z.number().int().min(4).max(8).optional(), // Typically 4, 6, or 8 axles
  steerableLength: z.number().positive().optional(), // Length in meters
  
  // Articulation Joint Type
  // Defines how trailer units connect and pivot
  jointType: z.enum(['fifth_wheel', 'king_pin', 'pivot']).optional(),
  
  // Maximum Articulation Angle
  // Maximum angle the trailer can pivot at the joint (degrees)
  // Standard is 45°, but can be limited by physical constraints
  maxArticulation: z.number().min(0).max(90).default(45),
  
  // Off-Tracking Reduction Factor
  // Steerable axles reduce off-tracking (swept path width) by steering into the turn
  // Default: 0.70 means 70% reduction in off-tracking compared to fixed axles
  // Range: 0.50 (50% reduction) to 0.85 (85% reduction) based on steering system quality
  offTrackingReduction: z.number().min(0.5).max(0.85).optional(),
  
  // Explicit Axle Counts (Definitive Fix - eliminates regex parsing)
  // These fields provide deterministic axle allocation for swept path analysis
  tractorAxles: z.number().int().min(2).max(3).optional(), // Tractor: 2-3 axles typical
  trailerAxles: z.number().int().min(2).max(15).optional(), // Trailer: 2-15 axles
}).optional();

export type ArticulationConfig = z.infer<typeof articulationConfigSchema>;

// ==================== NORMALIZED VEHICLE GEOMETRY (PRODUCTION SWEPT PATH) ====================

/**
 * Overall Dimensions Schema
 * 
 * Defines the complete external envelope of the vehicle combination.
 * These dimensions represent the absolute maximum extents for clearance checking.
 * 
 * @property overallLength - Total bumper-to-tail length in meters
 * @property overallHeight - Maximum height from ground in meters
 * @property transportWidth - Maximum width including mirrors/protrusions in meters
 * @property curbWeight - Unladen weight in kilograms (optional)
 */
export const overallDimensionsSchema = z.object({
  overallLength: z.number().positive('Overall length must be positive'),
  overallHeight: z.number().positive('Overall height must be positive'),
  transportWidth: z.number().positive('Transport width must be positive'),
  curbWeight: z.number().positive().optional(),
}).optional();

export type OverallDimensions = z.infer<typeof overallDimensionsSchema>;

/**
 * Vehicle Segment Schema
 * 
 * Represents a physical segment of a multi-unit vehicle (tractor, trailer, dolly, etc.).
 * Each segment has its own geometry, attachments, and configuration.
 * Segments are connected via articulation joints to form the complete vehicle.
 * 
 * Segment Types:
 * - tractor: Power unit with cab and drive axles
 * - jeep_dolly: Short auxiliary frame for front support (2-4 axles)
 * - steerable_dolly: Dolly with steerable axles to reduce off-tracking
 * - trailer: Main cargo-carrying unit
 * - cargo_module: Removable cargo container (schnabel, modular platforms)
 * - schnabel_lug: Schnabel beam section for heavy/oversized loads
 * 
 * @property id - Unique identifier for this segment (e.g., 'tractor', 'trailer_1')
 * @property type - Segment classification
 * @property referenceLength - Physical length of the segment frame (meters)
 * @property usableDeckLength - Available deck/well length for cargo placement (meters)
 * @property frontOverhang - Distance from front axle to front bumper (meters)
 * @property rearOverhang - Distance from rear axle to rear bumper (meters)
 * @property hitchHeight - Kingpin or hitch height from ground (meters)
 * 
 * Lateral geometry for accurate envelope calculations:
 * @property deckWidth - Usable deck width (meters)
 * @property maxWidth - Maximum width including any protrusions (meters)
 * @property trackWidth - Distance between wheel centerlines for track calculations (meters)
 * 
 * Coupling reference points for joint positioning:
 * @property couplerOffsetFront - Distance from segment front to front coupler (meters)
 * @property couplerOffsetRear - Distance from segment front to rear coupler (meters)
 * These ensure joints land within usable segment geometry
 * 
 * Tractor-specific properties:
 * @property wheelbase - Distance between steering axle and drive axle group (meters)
 * @property fifthWheelOffset - Distance from rear axle to fifth wheel (meters)
 * @property driveGroupSpread - Spread between first and last drive axle (meters)
 * 
 * Trailer-specific properties:
 * @property kingpinSetback - Distance from front of trailer to kingpin (meters)
 * @property bogieSlideRange - Sliding bogie adjustment range (meters)
 * 
 * Jeep/Steerable-specific properties:
 * @property drawbarLength - Length of drawbar/tongue (meters)
 * @property intermediateCouplerOffset - Offset to intermediate coupling point (meters)
 * 
 * Schnabel-specific properties:
 * @property towerSpacing - Distance between hydraulic towers (meters)
 * @property slingLength - Sling/suspension length for load (meters)
 */
export const vehicleSegmentSchema = z.object({
  id: z.string().min(1, 'Segment ID is required'),
  type: z.enum(['tractor', 'jeep_dolly', 'steerable_dolly', 'trailer', 'cargo_module', 'schnabel_lug']),
  referenceLength: z.number().positive('Reference length must be positive'),
  usableDeckLength: z.number().positive().optional(),
  frontOverhang: z.number().nonnegative().optional(),
  rearOverhang: z.number().nonnegative().optional(),
  hitchHeight: z.number().positive().optional(),
  
  // Lateral geometry (NEW)
  deckWidth: z.number().positive().optional(),
  maxWidth: z.number().positive().optional(),
  trackWidth: z.number().positive().optional(),
  
  // Coupling reference points (NEW)
  couplerOffsetFront: z.number().nonnegative().optional(),
  couplerOffsetRear: z.number().nonnegative().optional(),
  
  wheelbase: z.number().positive().optional(),
  fifthWheelOffset: z.number().nonnegative().optional(),
  driveGroupSpread: z.number().positive().optional(),
  
  kingpinSetback: z.number().nonnegative().optional(),
  bogieSlideRange: z.number().nonnegative().optional(),
  
  drawbarLength: z.number().positive().optional(),
  intermediateCouplerOffset: z.number().nonnegative().optional(),
  
  towerSpacing: z.number().positive().optional(),
  slingLength: z.number().positive().optional(),
});

export type VehicleSegment = z.infer<typeof vehicleSegmentSchema>;

/**
 * Axle Group Schema
 * 
 * Defines a group of axles within a vehicle segment.
 * Multiple axle groups can exist on a single segment (e.g., steering axle + drive group on tractor).
 * 
 * @property segmentId - References the parent segment.id
 * @property groupId - Unique identifier for this axle group (e.g., 'tractor_steer', 'trailer_bogie_1')
 * @property positionFromSegmentFront - Distance from segment front to axle group centerline (meters)
 * @property axleCount - Number of axles in this group (1-4 typical)
 * @property spread - Distance between first and last axle in group (meters, 0 for single axle)
 * @property steerable - Whether axles can steer (reduces off-tracking)
 * @property loadShare - Percentage of total vehicle load carried by this group (0-1, optional)
 * 
 * Examples:
 * - Single steering axle: axleCount=1, spread=0, steerable=true
 * - Tandem drive group: axleCount=2, spread=1.3, steerable=false
 * - Tri-axle bogie: axleCount=3, spread=2.6, steerable=false
 */
export const axleGroupSchema = z.object({
  segmentId: z.string().min(1, 'Segment ID reference is required'),
  groupId: z.string().min(1, 'Group ID is required'),
  positionFromSegmentFront: z.number().nonnegative('Position must be non-negative'),
  axleCount: z.number().int().positive('Axle count must be positive'),
  spread: z.number().nonnegative('Spread must be non-negative'),
  steerable: z.boolean(),
  loadShare: z.number().min(0).max(1).optional(),
});

export type AxleGroup = z.infer<typeof axleGroupSchema>;

/**
 * Articulation Joint Schema
 * 
 * Defines connection points between vehicle segments where rotation/articulation occurs.
 * Joints allow segments to pivot relative to each other during turning maneuvers.
 * 
 * Joint Types:
 * - fifth_wheel: Standard tractor-trailer connection (45° max yaw typical)
 * - king_pin: Trailer kingpin connection (60° max yaw)
 * - pivot: Simple pivot joint for dollies (60° max yaw)
 * - turntable: Full rotation joint for specialized equipment (360° possible)
 * 
 * @property id - Unique identifier for this joint (e.g., 'tractor_to_trailer')
 * @property type - Joint mechanism type
 * @property fromSegmentId - Front segment ID (power side)
 * @property toSegmentId - Rear segment ID (towed side)
 * @property positionOnFrom - Distance from front segment's front to joint (meters)
 * @property positionOnTo - Distance from rear segment's front to joint (meters)
 * @property maxPitch - Maximum vertical articulation angle (degrees, optional)
 * @property maxYaw - Maximum horizontal articulation angle (degrees)
 * @property lateralOffset - Lateral offset from segment centerline (meters, positive = right)
 * 
 * Validation:
 * - maxYaw should be 45° for fifth_wheel, 60° for king_pin/pivot
 * - fromSegmentId and toSegmentId must reference existing segments
 * - Positions must be within segment length bounds
 */
export const articulationJointSchema = z.object({
  id: z.string().min(1, 'Joint ID is required'),
  type: z.enum(['fifth_wheel', 'king_pin', 'pivot', 'turntable']),
  fromSegmentId: z.string().min(1, 'From segment ID is required'),
  toSegmentId: z.string().min(1, 'To segment ID is required'),
  positionOnFrom: z.number().nonnegative('Position on from-segment must be non-negative'),
  positionOnTo: z.number().nonnegative('Position on to-segment must be non-negative'),
  maxPitch: z.number().min(0).max(45).optional(),
  maxYaw: z.number().min(0).max(360),
  lateralOffset: z.number().optional(),
});

export type ArticulationJoint = z.infer<typeof articulationJointSchema>;

// Vehicle Profile Schema
// Base schema represents standard vehicle configurations (tractors, trailers, specialized haulers)
// Extended with optional articulationConfig for swept path analysis of multi-unit vehicles
//
// Integration with 25 Default Profiles:
// - Standard profiles (flatbeds, step decks): No articulation config needed
// - RGNs and lowboys: Can add articulation for jeep/dolly configurations
// - Perimeter frames: Often use steerable dollies for wide loads (set hasSteerable: true)
// - Beam trailers: May use jeep dollies for long girders (set hasJeep: true)
// - Dual lane configs: Heavy configurations may use steerable axles
// - Schnabel trailers: Complex articulation with multiple pivot points
//
// Example Use Cases:
// 1. Standard 5-axle flatbed → No articulation config
// 2. RGN with jeep dolly → hasJeep: true, jeepAxles: 2, jeepLength: 4.5
// 3. Perimeter with steerable → hasSteerable: true, steerableAxles: 6, offTrackingReduction: 0.75
// 4. Multi-unit heavy haul → Both jeep and steerable dollies configured
export const vehicleProfileSchema = z.object({
  id: z.string(),
  name: z.string().min(1, 'Profile name required'),
  
  // Dimensions
  width: z.number().positive('Width must be positive'),
  height: z.number().positive('Height must be positive'),
  length: z.number().positive('Length must be positive').optional(),
  widthUnit: z.enum(['meters', 'feet']).default('meters'),
  heightUnit: z.enum(['meters', 'feet']).default('meters'),
  lengthUnit: z.enum(['meters', 'feet']).optional(),
  
  // Overhangs
  frontOverhang: z.number().optional(),
  frontOverhangUnit: z.enum(['meters', 'feet']).optional(),
  rearOverhang: z.number().optional(),
  rearOverhangUnit: z.enum(['meters', 'feet']).optional(),
  
  // Cargo Dimensions (optional - for loaded measurements)
  cargoLength: z.number().optional(),
  cargoWidth: z.number().optional(),
  cargoHeight: z.number().optional(),
  cargoLengthUnit: z.enum(['meters', 'feet']).optional(),
  cargoWidthUnit: z.enum(['meters', 'feet']).optional(),
  cargoHeightUnit: z.enum(['meters', 'feet']).optional(),
  
  // Weight Capacity
  weightCapacity: z.number().optional(),
  weightUnit: z.enum(['kg', 'lbs']).default('kg'),
  
  // Configuration
  axleConfiguration: z.string().optional(),
  description: z.string().optional(),
  
  // ==================== DEPRECATED: Legacy Articulation Config ====================
  // DEPRECATED: Use segments, axleGroups, and articulationJoints instead
  // Kept for backward compatibility with existing vehicle profiles
  // This field will be removed in a future version
  // Migration: Convert to normalized structures using segments/axleGroups/articulationJoints
  articulationConfig: articulationConfigSchema,
  
  // ==================== NEW: Production Swept Path Geometry ====================
  
  /**
   * Overall Dimensions
   * Complete external envelope for clearance verification
   */
  overallDimensions: overallDimensionsSchema,
  
  /**
   * Vehicle Segments
   * Normalized array of physical segments (tractor, trailers, dollies, etc.)
   * Each segment has its own geometry and configuration
   */
  segments: z.array(vehicleSegmentSchema).optional(),
  
  /**
   * Axle Groups
   * Detailed axle configuration for accurate load distribution and swept path calculation
   * Each group references a parent segment via segmentId
   */
  axleGroups: z.array(axleGroupSchema).optional(),
  
  /**
   * Articulation Joints
   * Connection points between segments where rotation occurs
   * Defines pivot points for multi-unit vehicle turning simulation
   */
  articulationJoints: z.array(articulationJointSchema).optional(),
  
  // Metadata
  isDefault: z.boolean().default(false),
  createdAt: z.string(),
});

export type VehicleProfile = z.infer<typeof vehicleProfileSchema>;

// Envelope Settings Schema
export const envelopeSettingsSchema = z.object({
  enabled: z.boolean().default(false),
  activeProfileId: z.string().nullable(),
  warningThreshold: z.number().min(0).default(0.5), // meters
  criticalThreshold: z.number().min(0).default(0.2), // meters
  audioEnabled: z.boolean().default(true),
  visualEnabled: z.boolean().default(true),
  lateralLasersEnabled: z.boolean().default(false), // For future left/right lasers
});

export type EnvelopeSettings = z.infer<typeof envelopeSettingsSchema>;

// Clearance Violation Schema
export const clearanceViolationSchema = z.object({
  id: z.string(),
  timestamp: z.string(),
  profileId: z.string(),
  profileName: z.string(),
  severity: z.enum(['warning', 'critical']),
  measurement: z.number(), // Actual measurement in meters
  envelope: z.number(), // Required clearance in meters
  deficit: z.number(), // How much under (negative value)
  latitude: z.number(),
  longitude: z.number(),
  altitude: z.number().optional(),
  speed: z.number().optional(),
  heading: z.number().optional(),
  objectType: z.string().optional(), // From AI detection
  confidence: z.number().optional(), // AI confidence score
  photoUrl: z.string().optional(),
  videoUrl: z.string().optional(),
  notes: z.string().optional(),
  laser: z.enum(['main', 'left', 'right']).default('main'), // Which laser detected it
});

export type ClearanceViolation = z.infer<typeof clearanceViolationSchema>;

// ==================== SWEPT PATH ANALYSIS (PREMIUM ADD-ON) ====================

// Turn Data Schema
// Defines the turn parameters for swept path simulation
export const turnDataSchema = z.object({
  radius: z.number().positive(), // Turn radius in meters
  angle: z.number().min(-180).max(180), // Turn angle in degrees (-180 to 180, negative = left turn)
  turnType: z.enum(['left', 'right', 'u_turn']), // Type of turn maneuver
});

export type TurnData = z.infer<typeof turnDataSchema>;

// Simulation Result Schema
// Contains the calculated swept path envelope and dimensions
export const simulationResultSchema = z.object({
  envelopePositions: z.array(z.tuple([z.number(), z.number()])), // Array of [x, y] coordinates defining the swept path boundary
  maxWidth: z.number().positive(), // Maximum width of swept path in meters
  frontOverswing: z.number().optional(), // Front overhang swing in meters
  rearOverswing: z.number().optional(), // Rear overhang swing in meters (off-tracking)
  innerRadius: z.number().positive().optional(), // Inner turn radius in meters
  outerRadius: z.number().positive().optional(), // Outer turn radius in meters
});

export type SimulationResult = z.infer<typeof simulationResultSchema>;

// Collision Report Schema
// Documents any detected collisions or conflicts in the swept path
export const collisionReportSchema = z.object({
  hasCollision: z.boolean(),
  details: z.array(z.object({
    obstacleType: z.string(), // e.g., 'curb', 'pole', 'building', 'barrier'
    location: z.tuple([z.number(), z.number()]), // [x, y] position of collision point
    clearanceDeficit: z.number(), // How much clearance is missing in meters (negative value)
    severity: z.enum(['minor', 'moderate', 'severe']),
  })).optional(),
});

export type CollisionReport = z.infer<typeof collisionReportSchema>;

// Clearance Report Schema
// Documents minimum clearances throughout the turn maneuver
export const clearanceReportSchema = z.object({
  minimumClearance: z.number(), // Minimum clearance in meters (positive = safe, negative = collision)
  status: z.enum(['safe', 'tight', 'critical']), // Overall clearance status
  leftClearance: z.number().optional(), // Minimum left clearance in meters
  rightClearance: z.number().optional(), // Minimum right clearance in meters
  frontClearance: z.number().optional(), // Minimum front clearance in meters
  rearClearance: z.number().optional(), // Minimum rear clearance in meters
});

export type ClearanceReport = z.infer<typeof clearanceReportSchema>;

// Swept Path Analysis Schema
// Main table storing complete swept path analysis results for turn maneuvers
// Used for route planning, permit applications, and turn feasibility assessment
export const sweptPathAnalysisSchema = z.object({
  id: z.string(),
  timestamp: z.string(), // ISO 8601 timestamp of when analysis was performed
  
  // Location where turn analysis was performed
  location: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    address: z.string().optional(), // Human-readable address
    intersection: z.string().optional(), // Intersection name if applicable
  }),
  
  // Turn configuration and parameters
  turnData: turnDataSchema,
  
  // Vehicle profile used for simulation
  vehicleProfileId: z.string(), // FK reference to VehicleProfile
  vehicleProfileName: z.string().optional(), // Cached for display
  
  // Simulation results and swept path envelope
  simulationResult: simulationResultSchema,
  
  // Collision and clearance analysis
  collisionReport: collisionReportSchema,
  clearanceReport: clearanceReportSchema,
  
  // Overall verdict on turn feasibility
  verdict: z.enum(['FEASIBLE', 'TIGHT', 'IMPOSSIBLE']),
  
  // Visual documentation
  annotatedImage: z.string().optional(), // Base64 encoded image with swept path overlay
  
  // User notes and observations
  notes: z.string().optional(),
  
  // Metadata
  createdBy: z.string().optional(), // User/customer ID who performed analysis
  projectId: z.string().optional(), // Optional link to project/permit
});

export type SweptPathAnalysis = z.infer<typeof sweptPathAnalysisSchema>;

// Insert schema for SweptPathAnalysis (omits auto-generated fields)
export const insertSweptPathAnalysisSchema = sweptPathAnalysisSchema.omit({
  id: true,
});

export type InsertSweptPathAnalysis = z.infer<typeof insertSweptPathAnalysisSchema>;

// Turn Simulation History Schema
// Stores historical turn simulation attempts and iterations
// Useful for tracking multiple simulation runs for the same turn or comparing scenarios
export const turnSimulationSchema = z.object({
  id: z.string(),
  analysisId: z.string(), // FK reference to SweptPathAnalysis
  createdAt: z.string(), // ISO 8601 timestamp
  
  // Simulation metadata and parameters used in this run
  metadata: z.object({
    simulationVersion: z.string().optional(), // Version of simulation engine used
    vehicleProfileSnapshot: z.any().optional(), // Snapshot of vehicle config at time of simulation
    environmentalFactors: z.object({
      roadCondition: z.enum(['dry', 'wet', 'icy']).optional(),
      gradient: z.number().optional(), // Road gradient in degrees
      camber: z.number().optional(), // Road camber/slope in degrees
    }).optional(),
    computationTime: z.number().optional(), // Time taken to compute in milliseconds
    iterationCount: z.number().int().optional(), // Number of simulation iterations
    convergence: z.boolean().optional(), // Whether simulation converged to stable solution
    accuracy: z.enum(['low', 'medium', 'high']).optional(), // Simulation accuracy level
  }),
});

export type TurnSimulation = z.infer<typeof turnSimulationSchema>;

// Insert schema for TurnSimulation (omits auto-generated fields)
export const insertTurnSimulationSchema = turnSimulationSchema.omit({
  id: true,
  createdAt: true,
});

export type InsertTurnSimulation = z.infer<typeof insertTurnSimulationSchema>;

// ==================== CONVOY GUARDIAN SYSTEM ====================

// Convoy Session Schema
export const convoySessionSchema = z.object({
  id: z.string(),
  leaderId: z.string(), // device/user ID of leader
  sessionName: z.string().min(1, 'Session name required'),
  status: z.enum(['active', 'paused', 'ended']).default('active'),
  maxMembers: z.number().int().positive().default(10),
  warningThreshold: z.number().min(0), // in meters
  criticalThreshold: z.number().min(0), // in meters
  groundReference: z.number(), // ground reference height
  createdAt: z.string(),
  expiresAt: z.string().nullable(),
  qrToken: z.string(), // unique session token for QR code
  
  // Road profiling integration
  profileSummary: z.object({
    profileId: z.string().optional(), // Linked road profile ID
    totalDistance_m: z.number().optional(),
    totalClimb_m: z.number().optional(),
    totalDescent_m: z.number().optional(),
    numGradeEvents: z.number().int().optional(),
    numKFactorEvents: z.number().int().optional(),
    numRailCrossings: z.number().int().optional(),
  }).optional(),
});

export type ConvoySession = z.infer<typeof convoySessionSchema>;

// Convoy Member Schema
export const convoyMemberSchema = z.object({
  id: z.string(),
  sessionId: z.string(), // FK to convoy session
  name: z.string().min(1, 'Name required'),
  role: z.enum([
    'lead',
    'pilot_car',
    'police_escort',
    'bucket_truck',
    'chase',
    'support',
    'oversized_load',
  ]),
  vehicleId: z.string().min(1, 'Vehicle ID/plate required'), // license plate or fleet number
  company: z.string().optional(),
  phoneNumber: z.string().min(1, 'Phone number required'),
  radioChannel: z.string().optional(),
  joinedAt: z.string(),
  lastSeen: z.string(),
  isConnected: z.boolean().default(true),
});

export type ConvoyMember = z.infer<typeof convoyMemberSchema>;

// Convoy Event Schema (Black Box Logging)
export const convoyEventSchema = z.object({
  id: z.string(),
  sessionId: z.string(), // FK to convoy session
  eventType: z.enum([
    'alert',
    'member_join',
    'member_disconnect',
    'leader_lost',
    'config_change',
    'session_start',
    'session_end',
    'measurement_update',
  ]),
  memberId: z.string().optional(), // who triggered the event
  severity: z.enum(['info', 'warning', 'critical']),
  measurement: z.number().optional(), // measurement value if applicable
  latitude: z.number(),
  longitude: z.number(),
  altitude: z.number(),
  speed: z.number(),
  timestamp: z.string(),
  videoUrl: z.string().optional(),
  imageUrl: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional(), // additional JSON data
});

export type ConvoyEvent = z.infer<typeof convoyEventSchema>;

// Convoy Message Types (WebSocket communication)
export const convoyMessageSchema = z.object({
  type: z.enum([
    'measurement',
    'alert',
    'gps',
    'member_status',
    'leader_status',
    'config_change',
    'join_request',
    'join_approved',
    'join_denied',
    'session_ended',
    'emergency',
    'emergency_acknowledged',
    'log_sync_batch',
    'sync_acknowledgment',
  ]),
  sessionId: z.string(),
  data: z.any(),
  timestamp: z.number(),
  senderId: z.string().optional(),
});

export type ConvoyMessage = z.infer<typeof convoyMessageSchema>;

// Convoy Join Request Schema
export const convoyJoinRequestSchema = z.object({
  sessionToken: z.string().min(1, 'Session token required'),
  name: z.string().min(1, 'Name is required'),
  role: z.enum([
    'pilot_car',
    'police_escort',
    'bucket_truck',
    'chase',
    'support',
    'oversized_load',
  ]),
  vehicleId: z.string().min(1, 'Vehicle ID/plate is required'),
  company: z.string().optional(),
  phoneNumber: z.string().min(1, 'Phone number is required'),
  radioChannel: z.string().optional(),
  notes: z.string().optional(),
});

export type ConvoyJoinRequest = z.infer<typeof convoyJoinRequestSchema>;

// Convoy Settings Schema
export const convoySettingsSchema = z.object({
  enabled: z.boolean().default(false),
  maxConcurrentConvoys: z.number().int().positive().default(3),
  defaultWarningThreshold: z.number().min(0).default(4.5), // meters
  defaultCriticalThreshold: z.number().min(0).default(4.2), // meters
  leaderTimeout: z.number().int().positive().default(300000), // 5 minutes in ms
  videoQuality: z.enum(['720p', '1080p']).default('720p'),
  videoLoopDuration: z.number().int().positive().default(60), // seconds
  autoUploadVideos: z.boolean().default(false),
});

export type ConvoySettings = z.infer<typeof convoySettingsSchema>;

// ==================== BLACK BOX EVENT LOGGING ====================

// GPS Snapshot Schema (for black box logging)
export const gpsSnapshotSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  altitude: z.number(),
  speed: z.number(),
  course: z.number(),
  fixQuality: z.enum(['No Fix', 'GPS Fix', 'DGPS Fix']),
  satellites: z.number(),
  hdop: z.number(),
  source: z.enum(['serial', 'browser', 'none']),
  timestamp: z.number(),
});

export type GPSSnapshot = z.infer<typeof gpsSnapshotSchema>;

// Convoy State Snapshot Schema
export const convoyStateSnapshotSchema = z.object({
  totalMembers: z.number(),
  connectedMembers: z.number(),
  warningThreshold: z.number(),
  criticalThreshold: z.number(),
  groundReference: z.number(),
  sessionStatus: z.enum(['active', 'paused', 'ended']).optional(),
});

export type ConvoyStateSnapshot = z.infer<typeof convoyStateSnapshotSchema>;

// Actor Schema (person who triggered the event)
export const actorSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  company: z.string().optional(),
  role: z.string(),
  phoneNumber: z.string().optional(),
});

export type Actor = z.infer<typeof actorSchema>;

// Device Metadata Schema
export const deviceMetadataSchema = z.object({
  userAgent: z.string(),
  platform: z.string(),
  screenWidth: z.number(),
  screenHeight: z.number(),
  networkType: z.string().optional(),
  online: z.boolean(),
});

export type DeviceMetadata = z.infer<typeof deviceMetadataSchema>;

// Trigger Context Schema
export const triggerContextSchema = z.object({
  sourceModule: z.string(), // e.g., 'ConvoyLeader', 'ConvoyFollower', 'convoyStore'
  uiElement: z.string().optional(), // e.g., 'emergency-stop-button', 'warning-button'
  triggeredBy: z.enum(['user', 'system', 'automatic']),
});

export type TriggerContext = z.infer<typeof triggerContextSchema>;

// Comprehensive Black Box Event Schema
export const convoyBlackBoxEventSchema = z.object({
  // Core identification
  id: z.string(),
  timestamp: z.number(), // milliseconds since epoch
  timestampISO: z.string(), // ISO 8601 format
  
  // Event classification
  eventCategory: z.enum([
    'session_lifecycle',
    'member_activity', 
    'measurement',
    'alert',
    'emergency',
    'configuration',
    'communication',
  ]),
  eventType: z.string(), // e.g., 'session_started', 'member_joined', 'laser_alert'
  
  // Session context
  sessionId: z.string(),
  convoyRole: z.enum(['leader', 'follower']),
  
  // Actor (who triggered this event)
  actor: actorSchema,
  
  // State snapshots
  convoyState: convoyStateSnapshotSchema.optional(),
  gpsSnapshot: gpsSnapshotSchema.optional(),
  
  // Vehicle information
  vehicleId: z.string().optional(),
  vin: z.string().optional(),
  licensePlate: z.string().optional(),
  
  // Trigger context
  triggerContext: triggerContextSchema,
  
  // Event-specific payload
  payload: z.record(z.string(), z.any()),
  
  // Device metadata
  deviceMetadata: deviceMetadataSchema,
  
  // Media references
  videoReference: z.string().optional(),
  imageReference: z.string().optional(),
  
  // Sync metadata (for distributed logging)
  sequenceNumber: z.number().optional(), // Auto-incrementing per device
  memberId: z.string().optional(), // Source device/member ID
  syncStatus: z.enum(['local', 'synced', 'failed']).default('local'),
  lastSyncAttempt: z.number().optional(), // Timestamp of last sync attempt
  syncRetries: z.number().default(0), // Number of sync retry attempts
});

export type ConvoyBlackBoxEvent = z.infer<typeof convoyBlackBoxEventSchema>;

// ==================== PERMITTED ROUTE ENFORCEMENT ====================

// Route Enforcement Convoy Schema
export const routeEnforcementConvoySchema = z.object({
  id: z.string(),
  dispatcherId: z.string(), // Who created this convoy
  convoyName: z.string().min(1, 'Convoy name required'),
  status: z.enum(['active', 'paused', 'ended']).default('active'),
  
  // Route data (resampled GPX coordinates)
  routeGeometry: z.array(z.tuple([z.number(), z.number()])), // [[lat, lon], ...]
  routeName: z.string().optional(),
  routeDescription: z.string().optional(),
  totalRouteDistance: z.number().optional(), // in meters
  
  // Detection thresholds
  allowedDeviationMeters: z.number().min(5).max(100).default(30), // 30m rural, 15m urban
  persistenceSeconds: z.number().min(1).max(60).default(7), // Must be off-route for 7 seconds
  
  // GPS filtering
  maxAccuracyMeters: z.number().default(15), // Reject fixes with worse accuracy
  
  // Environment type for threshold adjustment
  environmentType: z.enum(['rural', 'urban']).default('rural'),
  
  // Time window
  windowStart: z.string(), // ISO timestamp
  windowEnd: z.string(), // ISO timestamp
  
  // Contact info
  dispatchPhone: z.string().optional(),
  dispatchEmail: z.string().optional(),
  
  // QR code for joining
  qrToken: z.string(), // Unique short code for QR
  
  createdAt: z.string(),
  expiresAt: z.string().nullable(),
});

export type RouteEnforcementConvoy = z.infer<typeof routeEnforcementConvoySchema>;

// Route Enforcement Member Schema
export const routeEnforcementMemberSchema = z.object({
  id: z.string(),
  convoyId: z.string(), // FK to route enforcement convoy
  name: z.string().min(1, 'Name required'),
  role: z.enum([
    'driver',
    'pilot_car',
    'police_escort',
    'support',
    'oversized_load',
  ]),
  vehicleId: z.string().min(1, 'Vehicle ID/plate required'),
  company: z.string().optional(),
  phoneNumber: z.string().min(1, 'Phone number required'),
  joinedAt: z.string(),
  lastSeen: z.string(),
  isConnected: z.boolean().default(true),
  
  // Current status
  currentStatus: z.enum(['on_route', 'warning', 'off_route_alert']).default('on_route'),
  distanceFromRoute: z.number().optional(), // Current distance in meters
  lastGPS: z.object({
    latitude: z.number(),
    longitude: z.number(),
    accuracy: z.number(),
    timestamp: z.number(),
  }).optional(),
});

export type RouteEnforcementMember = z.infer<typeof routeEnforcementMemberSchema>;

// Route Incident Schema (off-route violations)
export const routeIncidentSchema = z.object({
  id: z.string(),
  convoyId: z.string(), // FK to route enforcement convoy
  memberId: z.string(), // FK to member
  
  // Violation details
  incidentType: z.enum(['off_route_warning', 'off_route_critical']),
  distanceFromRoute: z.number(), // in meters
  persistenceDuration: z.number(), // how long they were off route (seconds)
  
  // GPS data at violation
  latitude: z.number(),
  longitude: z.number(),
  altitude: z.number().optional(),
  accuracy: z.number(),
  speed: z.number().optional(),
  
  // Timing
  detectedAt: z.string(), // ISO timestamp
  acknowledgedAt: z.string().optional(), // When dispatch acknowledged
  clearedAt: z.string().optional(), // When dispatch cleared the incident
  
  // Status
  status: z.enum(['pending', 'acknowledged', 'cleared']).default('pending'),
  
  // Dispatch actions
  dispatchNotes: z.string().optional(),
  dispatcherId: z.string().optional(), // Who acknowledged/cleared
  
  // Media
  videoUrl: z.string().optional(),
  imageUrl: z.string().optional(),
  
  // Metadata
  metadata: z.record(z.string(), z.any()).optional(),
  
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type RouteIncident = z.infer<typeof routeIncidentSchema>;

// Route Enforcement Settings Schema
export const routeEnforcementSettingsSchema = z.object({
  enabled: z.boolean().default(false),
  maxActiveConvoys: z.number().int().positive().default(3), // Base plan includes 3
  additionalConvoySlots: z.number().int().default(0), // Purchased additional slots
  
  // Default thresholds
  defaultRuralDeviation: z.number().default(30), // meters
  defaultUrbanDeviation: z.number().default(15), // meters
  defaultPersistence: z.number().default(7), // seconds
  defaultMaxAccuracy: z.number().default(15), // meters
  
  // Alert settings
  enableStopModal: z.boolean().default(true), // Show full-screen STOP
  enableAudioAlerts: z.boolean().default(true),
  autoVideoOnIncident: z.boolean().default(true),
  
  // Offline behavior
  offlineDetectionEnabled: z.boolean().default(true),
  queueIncidentsOffline: z.boolean().default(true),
});

export type RouteEnforcementSettings = z.infer<typeof routeEnforcementSettingsSchema>;

// Route Enforcement Message (WebSocket communication)
export const routeEnforcementMessageSchema = z.object({
  type: z.enum([
    'route_join_request',
    'route_join_approved',
    'route_join_denied',
    'route_update', // Dispatch pushes updated route
    'position_update', // Member sends GPS position
    'off_route_alert', // System detects off-route
    'incident_acknowledged', // Dispatch acknowledges incident
    'incident_cleared', // Dispatch clears incident
    'stop_command', // Server sends STOP modal command
    'resume_command', // Server sends resume command
    'member_status',
    'convoy_status',
  ]),
  convoyId: z.string(),
  data: z.any(),
  timestamp: z.number(),
  senderId: z.string().optional(),
});

export type RouteEnforcementMessage = z.infer<typeof routeEnforcementMessageSchema>;

// Route Join Request Schema
export const routeJoinRequestSchema = z.object({
  qrToken: z.string().min(1, 'QR token required'),
  name: z.string().min(1, 'Name is required'),
  role: z.enum([
    'driver',
    'pilot_car',
    'police_escort',
    'support',
    'oversized_load',
  ]),
  vehicleId: z.string().min(1, 'Vehicle ID/plate is required'),
  company: z.string().optional(),
  phoneNumber: z.string().min(1, 'Phone number is required'),
  notes: z.string().optional(),
});

export type RouteJoinRequest = z.infer<typeof routeJoinRequestSchema>;

// ====================================
// ADMIN & SUBSCRIPTION MANAGEMENT
// ====================================

// Customer Schema
export const customerSchema = z.object({
  id: z.string(),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  company: z.string().optional(),
  phone: z.string().optional(),
  notes: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Customer = z.infer<typeof customerSchema>;

export const insertCustomerSchema = customerSchema.omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});

export type InsertCustomer = z.infer<typeof insertCustomerSchema>;

// Subscription Feature Types
export type SubscriptionFeature = 'convoy_guardian' | 'ai_detection' | 'envelope_clearance' | 'permitted_route_enforcement' | 'swept_path_analysis';

// Subscription Schema
export const subscriptionSchema = z.object({
  id: z.string(),
  customerId: z.string(),
  feature: z.enum(['convoy_guardian', 'ai_detection', 'envelope_clearance', 'permitted_route_enforcement', 'swept_path_analysis']),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  validFrom: z.string(), // ISO date
  validUntil: z.string(), // ISO date
  isActive: z.boolean().default(true),
  notes: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Subscription = z.infer<typeof subscriptionSchema>;

export const insertSubscriptionSchema = subscriptionSchema.omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});

export type InsertSubscription = z.infer<typeof insertSubscriptionSchema>;

// Subscription with Customer Info (for display)
export const subscriptionWithCustomerSchema = subscriptionSchema.extend({
  customerName: z.string(),
  customerEmail: z.string().email(),
});

export type SubscriptionWithCustomer = z.infer<typeof subscriptionWithCustomerSchema>;

// Subscription Email Schema (for sending credentials)
export const subscriptionEmailSchema = z.object({
  customerEmail: z.string().email(),
  customerName: z.string(),
  feature: z.enum(['convoy_guardian', 'ai_detection', 'envelope_clearance', 'permitted_route_enforcement', 'swept_path_analysis']),
  password: z.string(),
  validFrom: z.string(),
  validUntil: z.string(),
});

export type SubscriptionEmail = z.infer<typeof subscriptionEmailSchema>;

// ====================================
// MARKETING COLLABORATION SYSTEM
// ====================================

// Marketing Section Schemas
export const insertMarketingSectionSchema = z.object({
  documentId: z.string(),
  sectionId: z.string(),
  title: z.string(),
  content: z.string(),
  sortOrder: z.number().int(),
});

export const selectMarketingSectionSchema = insertMarketingSectionSchema.extend({
  id: z.number().int(),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
});

export type InsertMarketingSection = z.infer<typeof insertMarketingSectionSchema>;
export type MarketingSection = z.infer<typeof selectMarketingSectionSchema>;

// Marketing Comment Schemas
export const insertMarketingCommentSchema = z.object({
  documentId: z.string(),
  authorName: z.string().min(1, 'Author name is required'),
  commentText: z.string().min(1, 'Comment text is required'),
});

export const selectMarketingCommentSchema = insertMarketingCommentSchema.extend({
  id: z.number().int(),
  createdAt: z.string().or(z.date()),
});

export type InsertMarketingComment = z.infer<typeof insertMarketingCommentSchema>;
export type MarketingComment = z.infer<typeof selectMarketingCommentSchema>;

// Marketing Edit Schemas
export const insertMarketingEditSchema = z.object({
  documentId: z.string(),
  editorName: z.string().min(1, 'Editor name is required'),
  originalContent: z.string().min(1, 'Original content is required'),
  editedContent: z.string().min(1, 'Edited content is required'),
  editNote: z.string().optional(),
});

export const selectMarketingEditSchema = insertMarketingEditSchema.extend({
  id: z.number().int(),
  createdAt: z.string().or(z.date()),
});

export type InsertMarketingEdit = z.infer<typeof insertMarketingEditSchema>;
export type MarketingEdit = z.infer<typeof selectMarketingEditSchema>;

// ==================== USER REGISTRATION SYSTEM ====================

// Account Status Enum
export const accountStatusEnum = z.enum(['email_pending', 'pending', 'approved', 'rejected']);
export type AccountStatus = z.infer<typeof accountStatusEnum>;

// Subscription Status Enum
export const subscriptionStatusEnum = z.enum(['active', 'paused', 'cancelled', 'pending_cancellation']);
export type SubscriptionStatus = z.infer<typeof subscriptionStatusEnum>;

// Account Schema
export const accountSchema = z.object({
  id: z.string(),
  fullName: z.string().min(2, 'Full name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  company: z.string().optional(),
  title: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  referredBy: z.string().optional(),
  status: accountStatusEnum,
  emailVerified: z.boolean().default(false),
  verification: z.object({
    codeHash: z.string(),
    expiresAt: z.string(),
  }).optional(),
  authUid: z.string().optional(),
  
  // Subscription fields
  subscriptionTierId: z.string().optional(), // FK to subscription tier
  subscriptionStatus: subscriptionStatusEnum.optional(),
  subscriptionStartDate: z.string().optional(),
  subscriptionEndDate: z.string().optional(),
  lastOnlineAt: z.string().optional(),
  autoRenew: z.boolean().default(true),
  cancellationScheduledFor: z.string().optional(),
  dataRetentionUntil: z.string().optional(), // 30 days after cancel
  
  createdAt: z.string(),
});

// Insert Account Schema (for creating new accounts)
export const insertAccountSchema = accountSchema.omit({ 
  id: true, 
  createdAt: true,
  emailVerified: true,
  status: true,
}).extend({
  status: accountStatusEnum.default('email_pending'),
  emailVerified: z.boolean().default(false),
});

export type Account = z.infer<typeof accountSchema>;
export type InsertAccount = z.infer<typeof insertAccountSchema>;

// Registration Start Request Schema
export const registrationStartSchema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  company: z.string().optional(),
  title: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  referredBy: z.string().optional(),
});

export type RegistrationStart = z.infer<typeof registrationStartSchema>;

// Registration Verify Request Schema
export const registrationVerifySchema = z.object({
  email: z.string().email('Invalid email address'),
  code: z.string().length(6, 'Verification code must be 6 digits'),
});

export type RegistrationVerify = z.infer<typeof registrationVerifySchema>;

// Registration Finalize Request Schema
export const registrationFinalizeSchema = z.object({
  accountId: z.string(),
  authUid: z.string(),
});

export type RegistrationFinalize = z.infer<typeof registrationFinalizeSchema>;

// Registration Resend Code Request Schema
export const registrationResendSchema = z.object({
  email: z.string().email('Invalid email address'),
});

export type RegistrationResend = z.infer<typeof registrationResendSchema>;

// Email Schemas for Registration

// Verification Code Email Schema
export const verificationCodeEmailSchema = z.object({
  recipientEmail: z.string().email('Invalid recipient email'),
  recipientName: z.string(),
  verificationCode: z.string().length(6),
  expiryMinutes: z.number().default(15),
});

export type VerificationCodeEmail = z.infer<typeof verificationCodeEmailSchema>;

// Account Approval Email Schema
export const accountApprovalEmailSchema = z.object({
  recipientEmail: z.string().email('Invalid recipient email'),
  recipientName: z.string(),
  approved: z.boolean(),
  reason: z.string().optional(),
});

export type AccountApprovalEmail = z.infer<typeof accountApprovalEmailSchema>;

// Welcome Email Schema (sent on signup completion)
export const welcomeEmailSchema = z.object({
  recipientEmail: z.string().email('Invalid recipient email'),
  recipientName: z.string(),
  activationCode: z.string(),
  temporaryPassword: z.string().optional(),
  isTemporaryPassword: z.boolean().optional(),
});

export type WelcomeEmail = z.infer<typeof welcomeEmailSchema>;

// 7-Day Offline Warning Email Schema
export const offlineWarningEmailSchema = z.object({
  recipientEmail: z.string().email('Invalid recipient email'),
  recipientName: z.string(),
  daysOffline: z.number().default(7),
  gracePeriodDays: z.number().default(3),
});

export type OfflineWarningEmail = z.infer<typeof offlineWarningEmailSchema>;

// Cancellation Confirmation Email Schema
export const cancellationEmailSchema = z.object({
  recipientEmail: z.string().email('Invalid recipient email'),
  recipientName: z.string(),
  deletionDate: z.string(),
  daysUntilDeletion: z.number().default(30),
});

export type CancellationEmail = z.infer<typeof cancellationEmailSchema>;

// 30-Day Deletion Warning Email Schema
export const deletionWarningEmailSchema = z.object({
  recipientEmail: z.string().email('Invalid recipient email'),
  recipientName: z.string(),
  daysRemaining: z.number(),
  deletionDate: z.string(),
  subscriptionType: z.enum(['cancelled', 'paused']).default('cancelled'),
});

export type DeletionWarningEmail = z.infer<typeof deletionWarningEmailSchema>;

// Terms Change Notification Email Schema
export const termsChangeNotificationSchema = z.object({
  recipientEmail: z.string().email('Invalid recipient email'),
  recipientName: z.string(),
  version: z.string(),
  effectiveDate: z.string(),
  title: z.string(),
});

export type TermsChangeNotification = z.infer<typeof termsChangeNotificationSchema>;

// ====================================
// FLEXIBLE LICENSING SYSTEM
// ====================================

// License Feature Schema
// Admin-defined features that can be enabled/disabled for users
export const licenseFeatureSchema = z.object({
  id: z.string(),
  featureKey: z.string().min(1, 'Feature key is required'), // e.g., 'ai_detection', 'zed2i_support'
  displayName: z.string().min(1, 'Display name is required'),
  description: z.string().optional(),
  category: z.enum(['core', 'premium', 'professional', 'enterprise']).default('premium'),
  isActive: z.boolean().default(true), // Admin can disable features
  metadata: z.record(z.string(), z.any()).optional(), // Custom properties
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type LicenseFeature = z.infer<typeof licenseFeatureSchema>;

export const insertLicenseFeatureSchema = licenseFeatureSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertLicenseFeature = z.infer<typeof insertLicenseFeatureSchema>;

// License Package Schema
// Bundles of features that can be sold together
export const licensePackageSchema = z.object({
  id: z.string(),
  packageName: z.string().min(1, 'Package name is required'),
  description: z.string().optional(),
  featureKeys: z.array(z.string()), // Array of feature keys included
  tier: z.enum(['basic', 'standard', 'premium', 'professional', 'enterprise']).default('standard'),
  isActive: z.boolean().default(true),
  metadata: z.record(z.string(), z.any()).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type LicensePackage = z.infer<typeof licensePackageSchema>;

export const insertLicensePackageSchema = licensePackageSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertLicensePackage = z.infer<typeof insertLicensePackageSchema>;

// Activation Code Schema
// Generated codes that users can redeem
export const activationCodeSchema = z.object({
  id: z.string(),
  code: z.string().min(6, 'Code must be at least 6 characters'), // e.g., MPRO-PREM-A3F9-K2L8
  type: z.enum(['feature', 'package']), // Single feature or package bundle
  featureKey: z.string().optional(), // If type=feature
  packageId: z.string().optional(), // If type=package
  duration: z.enum(['1month', '3months', '6months', '12months', 'lifetime']),
  durationDays: z.number().int().positive(), // Computed: 30, 90, 180, 365, or 36500 for lifetime
  maxDevices: z.number().int().positive().default(3), // Device limit
  maxActivations: z.number().int().positive().default(1), // How many users can use this code
  timesActivated: z.number().int().default(0),
  isActive: z.boolean().default(true), // Admin can deactivate codes
  generatedBy: z.string(), // Admin user email who created it
  notes: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
  createdAt: z.string(),
  expiresAt: z.string().optional(), // Code expiry (not license expiry)
  
  // Email locking - locks code to first email that redeems it
  redeemedByEmail: z.string().email().optional().nullable(), // Locked to this email after first redemption
  redeemedAt: z.string().optional().nullable(), // Timestamp of first redemption
});

export type ActivationCode = z.infer<typeof activationCodeSchema>;

export const insertActivationCodeSchema = activationCodeSchema.omit({
  id: true,
  timesActivated: true,
  createdAt: true,
});

export type InsertActivationCode = z.infer<typeof insertActivationCodeSchema>;

// User License Schema
// Active licenses for a specific user
export const userLicenseSchema = z.object({
  id: z.string(),
  userId: z.string(), // Firebase Auth UID
  userEmail: z.string().email(),
  licenseType: z.enum(['feature', 'package']),
  featureKey: z.string().optional(), // If licenseType=feature
  packageId: z.string().optional(), // If licenseType=package
  activationCode: z.string(), // Code used to activate
  activatedAt: z.string(),
  expiresAt: z.string().optional(), // null for lifetime licenses
  isActive: z.boolean().default(true),
  maxDevices: z.number().int().positive().default(3),
  metadata: z.record(z.string(), z.any()).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type UserLicense = z.infer<typeof userLicenseSchema>;

export const insertUserLicenseSchema = userLicenseSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertUserLicense = z.infer<typeof insertUserLicenseSchema>;

// Grace Status Enum
export const graceStatusEnum = z.enum(['active', 'grace_period', 'warning', 'locked']);
export type GraceStatus = z.infer<typeof graceStatusEnum>;

// User Device Schema
// Track devices per user for license enforcement
export const userDeviceSchema = z.object({
  id: z.string(),
  userId: z.string(), // Firebase Auth UID
  userEmail: z.string().email(),
  deviceFingerprint: z.string(), // Browser fingerprint hash
  deviceName: z.string().optional(), // e.g., "Chrome on Windows (Field Laptop)"
  deviceInfo: z.object({
    userAgent: z.string(),
    platform: z.string().optional(),
    screenResolution: z.string().optional(),
    timezone: z.string().optional(),
    language: z.string().optional(),
    hardwareConcurrency: z.number().optional(),
    deviceMemory: z.number().optional(),
  }).optional(),
  lastActiveAt: z.string(),
  firstSeenAt: z.string(),
  isActive: z.boolean().default(true), // User can deactivate
  deactivatedAt: z.string().optional(),
  
  // Link device to activation code for per-code device tracking
  activationCodeId: z.string().optional(), // Which activation code this device used
  
  // Offline auth tracking
  lastOnlineAt: z.string().optional(),
  lastSyncAt: z.string().optional(),
  offlineDaysSinceSync: z.number().optional(), // Computed field
  graceStatus: graceStatusEnum.default('active'),
  
  metadata: z.record(z.string(), z.any()).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type UserDevice = z.infer<typeof userDeviceSchema>;

export const insertUserDeviceSchema = userDeviceSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertUserDevice = z.infer<typeof insertUserDeviceSchema>;

// License Validation Result
export const licenseValidationResultSchema = z.object({
  isValid: z.boolean(),
  hasFeature: z.boolean().optional(),
  reason: z.string().optional(),
  expiresAt: z.string().optional(),
  daysRemaining: z.number().optional(),
  deviceLimit: z.number().optional(),
  currentDevices: z.number().optional(),
});

export type LicenseValidationResult = z.infer<typeof licenseValidationResultSchema>;

// Activation Request Schema (user activates a code)
export const activationRequestSchema = z.object({
  code: z.string().min(6, 'Activation code is required'),
  deviceInfo: z.object({
    userAgent: z.string(),
    platform: z.string().optional(),
    screenResolution: z.string().optional(),
    timezone: z.string().optional(),
    language: z.string().optional(),
  }).optional(),
});

export type ActivationRequest = z.infer<typeof activationRequestSchema>;

// ==================== SUBSCRIPTION & SIGNUP SYSTEM ====================

// Billing Period Enum
export const billingPeriodEnum = z.enum(['monthly', 'yearly']);
export type BillingPeriod = z.infer<typeof billingPeriodEnum>;

// Item Type Enum
export const itemTypeEnum = z.enum(['subscription_tier', 'addon']);
export type ItemType = z.infer<typeof itemTypeEnum>;

// Signup Status Enum
export const signupStatusEnum = z.enum(['in_progress', 'completed', 'abandoned']);
export type SignupStatus = z.infer<typeof signupStatusEnum>;

// Pricing Schema
// Dynamic pricing table for subscription tiers and add-ons
export const pricingSchema = z.object({
  id: z.string(),
  itemType: itemTypeEnum,
  itemKey: z.string().min(1, 'Item key is required'), // e.g., 'basic_monthly', 'ai_detection'
  displayName: z.string().min(1, 'Display name is required'),
  description: z.string().optional(),
  price: z.number().int().nonnegative(), // USD cents
  currency: z.string().default('USD'),
  billingPeriod: billingPeriodEnum.optional(),
  isActive: z.boolean().default(true),
  metadata: z.record(z.string(), z.any()).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Pricing = z.infer<typeof pricingSchema>;

export const insertPricingSchema = pricingSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertPricing = z.infer<typeof insertPricingSchema>;

// Signup Progress Schema
// Track multi-step signup flow progress
export const signupProgressSchema = z.object({
  id: z.string(),
  email: z.string().email('Invalid email address'),
  currentStep: z.number().int().min(1).max(6),
  
  // Step 1: Basic info
  step1Data: z.object({
    name: z.string().optional(),
    email: z.string().optional(),
    phone: z.string().optional(),
    passwordHash: z.string().optional(),
    emailVerified: z.boolean().optional(),
    phoneVerified: z.boolean().optional(),
  }).optional(),
  
  // Step 2: Company info
  step2Data: z.object({
    company: z.string().optional(),
    title: z.string().optional(),
    address: z.string().optional(),
    phone: z.string().optional(),
  }).optional(),
  
  // Step 3: Subscription selection
  step3Data: z.object({
    selectedTier: z.string().optional(),
    selectedAddons: z.array(z.string()).optional(),
  }).optional(),
  
  // Step 4: Terms acceptance
  step4Data: z.object({
    termsAccepted: z.boolean().optional(),
    termsVersion: z.string().optional(),
    timestamp: z.string().optional(),
  }).optional(),
  
  // Step 5: Hardware checklist
  step5Data: z.record(z.string(), z.any()).optional(),
  
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
  startedAt: z.string(),
  lastUpdatedAt: z.string(),
  completedAt: z.string().optional(),
  status: signupStatusEnum.default('in_progress'),
  pausedAt: z.string().optional(),
  cancelledAt: z.string().optional(),
});

export type SignupProgress = z.infer<typeof signupProgressSchema>;

export const insertSignupProgressSchema = signupProgressSchema.omit({
  id: true,
  startedAt: true,
  lastUpdatedAt: true,
});

export type InsertSignupProgress = z.infer<typeof insertSignupProgressSchema>;

// Terms Version Schema
// Version control for terms & conditions
export const termsVersionSchema = z.object({
  id: z.string(),
  version: z.string().min(1, 'Version is required'), // Semver string
  title: z.string().min(1, 'Title is required'),
  content: z.string().min(1, 'Content is required'), // Full HTML/markdown
  effectiveDate: z.string(),
  isActive: z.boolean().default(true),
  requiresReacceptance: z.boolean().default(false),
  metadata: z.record(z.string(), z.any()).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type TermsVersion = z.infer<typeof termsVersionSchema>;

export const insertTermsVersionSchema = termsVersionSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertTermsVersion = z.infer<typeof insertTermsVersionSchema>;

// Terms Acceptance Schema
// Track user acceptance of terms
export const termsAcceptanceSchema = z.object({
  id: z.string(),
  userId: z.string(), // Firebase Auth UID
  userEmail: z.string().email('Invalid email address'),
  termsVersionId: z.string(), // FK to terms version
  termsVersion: z.string(), // Cached version string
  acceptedAt: z.string(),
  ipAddress: z.string(), // Required for legal compliance - stores user's IP at time of acceptance
  geoLocation: z.object({
    country: z.string().optional(),
    region: z.string().optional(),
    city: z.string().optional(),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
  }).optional(), // Optional geo metadata for compliance tracking
  userAgent: z.string().optional(),
  deviceFingerprint: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export type TermsAcceptance = z.infer<typeof termsAcceptanceSchema>;

export const insertTermsAcceptanceSchema = termsAcceptanceSchema.omit({
  id: true,
  acceptedAt: true,
});

export type InsertTermsAcceptance = z.infer<typeof insertTermsAcceptanceSchema>;

// Subscription Tiers Schema
// Separate from features for tier-based pricing
export const subscriptionTiersSchema = z.object({
  id: z.string(),
  tierKey: z.string().min(1, 'Tier key is required'), // e.g., 'basic', 'professional', 'enterprise'
  displayName: z.string().min(1, 'Display name is required'),
  description: z.string().optional(),
  monthlyPrice: z.number().int().nonnegative(), // USD cents
  yearlyPrice: z.number().int().nonnegative(), // USD cents (14 months for price of 12)
  includedFeatures: z.array(z.string()).default([]), // Array of feature keys
  isActive: z.boolean().default(true),
  metadata: z.record(z.string(), z.any()).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type SubscriptionTiers = z.infer<typeof subscriptionTiersSchema>;

export const insertSubscriptionTiersSchema = subscriptionTiersSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertSubscriptionTiers = z.infer<typeof insertSubscriptionTiersSchema>;

// ==================== SIGNUP FLOW VALIDATION ====================

// Step 1: Account Information
export const signupStep1Schema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export type SignupStep1 = z.infer<typeof signupStep1Schema>;

// Step 2: Company Details
export const signupStep2Schema = z.object({
  company: z.string().optional(),
  title: z.string().optional(),
  phone: z.string().regex(/^[\d\s\-\+\(\)]*$/, 'Invalid phone number format').optional().or(z.literal('')),
  address: z.string().optional(),
});

export type SignupStep2 = z.infer<typeof signupStep2Schema>;

// Signup Start Request (Step 1)
export const signupStartSchema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  phone: z.string().min(7, 'Phone number is required for SMS verification'),
});

export type SignupStart = z.infer<typeof signupStartSchema>;

// Signup Step 2 Update Request
export const signupStep2UpdateSchema = z.object({
  company: z.string().optional(),
  title: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
});

export type SignupStep2Update = z.infer<typeof signupStep2UpdateSchema>;

// Step 3: Subscription Selection
export const signupStep3Schema = z.object({
  subscriptionTier: z.string().min(1, 'Subscription tier is required'),
  selectedAddons: z.array(z.string()).default([]),
  totalPrice: z.number().nonnegative('Total price must be non-negative'),
});

export type SignupStep3 = z.infer<typeof signupStep3Schema>;

// Step 4: Terms & Conditions
export const signupStep4Schema = z.object({
  termsVersionId: z.string().min(1, 'Terms version ID is required'),
  acceptedTerms: z.object({
    mainTerms: z.boolean(),
    privacyPolicy: z.boolean(),
    dataUsage: z.boolean(),
    paymentTerms: z.boolean(),
  }),
  acceptedAll: z.boolean(),
}).refine((data) => data.acceptedAll && data.acceptedTerms.mainTerms && data.acceptedTerms.privacyPolicy && data.acceptedTerms.dataUsage && data.acceptedTerms.paymentTerms, {
  message: "All terms must be accepted",
  path: ["acceptedAll"],
});

export type SignupStep4 = z.infer<typeof signupStep4Schema>;

// Step 5: Hardware Compatibility Checklist
export const signupStep5Schema = z.object({
  hardwareAcknowledged: z.boolean(),
  acknowledgedItems: z.array(z.string()),
});

export type SignupStep5 = z.infer<typeof signupStep5Schema>;

// Signup Completion Request (Step 6)
// User re-enters password for security validation and Firebase account creation
export const signupCompleteSchema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export type SignupComplete = z.infer<typeof signupCompleteSchema>;

// ==================== TESTING PORTAL SCHEMAS ====================

// Manual Types (avoid importing Drizzle tables in frontend)
export type Tester = {
  id: number;
  name: string;
  email: string;
  installationDescription: string | null;
  photoUrl: string | null;
  groundReference: number;
  weatherConditions: string | null;
  temperature: number | null;
  location: string | null;
  createdAt: Date;
};

export type TestSession = {
  id: number;
  testerId: number;
  sessionName: string;
  groundReference: number;
  weather: string;
  temperature: number;
  location: string | null;
  startedAt: Date;
  completedAt: Date | null;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  blockedTests: number;
  completionPercentage: number;
  notes: string | null;
};

export type TestResult = {
  id: number;
  sessionId: number;
  category: string;
  testId: string;
  testName: string;
  status: string;
  notes: string | null;
  testedAt: Date | null;
};

// Insert Schemas (Zod validation for server)
export const insertTesterSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  installationDescription: z.string().nullable().optional(),
  photoUrl: z.string().nullable().optional(),
  groundReference: z.number().int('Ground reference must be an integer'),
  weatherConditions: z.string().nullable().optional(),
  temperature: z.number().int().nullable().optional(),
  location: z.string().nullable().optional(),
});

export const insertTestSessionSchema = z.object({
  testerId: z.number().int(),
  sessionName: z.string().min(3, 'Session name must be at least 3 characters'),
  groundReference: z.number().int('Ground reference must be an integer'),
  weather: z.string().min(1, 'Weather is required'),
  temperature: z.number().int('Temperature must be an integer'),
  location: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export const insertTestResultSchema = z.object({
  sessionId: z.number().int(),
  category: z.string().min(1, 'Category is required'),
  testId: z.string().min(1, 'Test ID is required'),
  testName: z.string().min(1, 'Test name is required'),
  status: z.enum(['pass', 'fail', 'blocked', 'pending']),
  notes: z.string().nullable().optional(),
  testedAt: z.coerce.date().nullable().optional(),
});

export type InsertTester = z.infer<typeof insertTesterSchema>;
export type InsertTestSession = z.infer<typeof insertTestSessionSchema>;
export type InsertTestResult = z.infer<typeof insertTestResultSchema>;

// ==================== GNSS ROAD PROFILING INTEGRATION ====================

// Profile Point Schema (matches backend ProfilePoint interface exactly)
// Used in RoadProfile.points array - no id/profileId as those are not in backend
export const profilePointSchema = z.object({
  distance_m: z.number(), // Cumulative distance from start
  lat: z.number(),
  lon: z.number(),
  alt_m: z.number(),
  timestamp: z.string(), // ISO timestamp
  grade_pct: z.number(), // Percent grade (+ uphill, - downhill)
  k_factor: z.number().nullable(), // Vertical curvature radius (m)
  curvature_type: z.enum(['convex', 'concave', 'linear']).nullable(),
});

export type ProfilePoint = z.infer<typeof profilePointSchema>;

// Road Profile Point Schema (extends ProfilePoint with DB fields)
// Individual resampled points along the road profile
// Used for IndexedDB storage - includes id and profileId for relational integrity
export const roadProfilePointSchema = profilePointSchema.extend({
  id: z.string(),
  profileId: z.string(), // FK to road profile
});

export type RoadProfilePoint = z.infer<typeof roadProfilePointSchema>;

// Road Profile Schema
// Links road profiling data to survey sessions for comprehensive route analysis
export const roadProfileSchema = z.object({
  id: z.string(),
  surveyId: z.string().optional(), // FK to survey (optional for backward compatibility)
  sessionId: z.string().optional(), // FK to convoy session (optional)
  
  // Time range
  start: z.string(), // ISO timestamp
  end: z.string(), // ISO timestamp
  
  // Configuration
  step_m: z.number().positive().default(5), // Resampling interval in meters
  grade_trigger_pct: z.number().positive().default(12), // Grade alert threshold
  k_factor_convex_min: z.number().positive().default(200), // Convex K-factor threshold
  k_factor_concave_min: z.number().positive().default(300), // Concave K-factor threshold
  
  // Summary statistics
  summary: z.object({
    totalDistance_m: z.number(),
    totalClimb_m: z.number(),
    totalDescent_m: z.number(),
    maxGradeUp_pct: z.number(),
    maxGradeDown_pct: z.number(),
    minKFactorConvex: z.number().nullable(),
    minKFactorConcave: z.number().nullable(),
    numGradeEvents: z.number().int(),
    numKFactorEvents: z.number().int(),
    numRailCrossings: z.number().int(),
  }),
  
  // Profile points array (matches backend RoadProfile.points)
  points: z.array(profilePointSchema),
  
  // Metadata
  label: z.string().optional(), // User-defined label
  created_at: z.string(),
});

export type RoadProfile = z.infer<typeof roadProfileSchema>;

// Grade Event Schema (steep uphill or downhill segment)
// Matches server/gnss/types.ts GradeEvent interface
export const gradeEventSchema = z.object({
  id: z.string(),
  surveyId: z.string().optional(),
  sessionId: z.string().optional(),
  profileId: z.string().optional(),
  direction: z.enum(['up', 'down']),
  trigger_pct: z.number(),
  max_grade_pct: z.number(),
  start_distance_m: z.number(),
  end_distance_m: z.number(),
  length_m: z.number(),
  start_lat: z.number(),
  start_lon: z.number(),
  end_lat: z.number(),
  end_lon: z.number(),
  start_timestamp: z.string(),
  end_timestamp: z.string(),
  created_at: z.string(),
});

export type GradeEvent = z.infer<typeof gradeEventSchema>;

// K-Factor Event Schema (sharp vertical curve - crest or sag)
// Matches server/gnss/types.ts KFactorEvent interface
export const kFactorEventSchema = z.object({
  id: z.string(),
  surveyId: z.string().optional(),
  sessionId: z.string().optional(),
  profileId: z.string().optional(),
  curvature_type: z.enum(['convex', 'concave']),
  k_factor: z.number(),
  trigger_threshold: z.number(),
  distance_m: z.number(),
  lat: z.number(),
  lon: z.number(),
  timestamp: z.string(),
  created_at: z.string(),
  severity: z.enum(['warning', 'critical']),
});

export type KFactorEvent = z.infer<typeof kFactorEventSchema>;

// Rail Crossing Event Schema (elevation bump detection or manual trigger)
// Matches server/gnss/types.ts RailCrossingEvent interface
export const railCrossingEventSchema = z.object({
  id: z.string(),
  surveyId: z.string().optional(),
  sessionId: z.string().optional(),
  profileId: z.string().optional(),
  detection_method: z.enum(['auto', 'manual']),
  distance_m: z.number(),
  lat: z.number(),
  lon: z.number(),
  timestamp: z.string(),
  elevation_change_m: z.number().optional(),
  notes: z.string().optional(),
  created_at: z.string(),
});

export type RailCrossingEvent = z.infer<typeof railCrossingEventSchema>;

// ==================== AUDIT LOGGING ====================

// Login Log Schema
export const loginLogSchema = z.object({
  id: z.number().optional(),
  userId: z.string(),
  userEmail: z.string().email(),
  loginAt: z.string().optional(),
  logoutAt: z.string().nullable().optional(),
  ipAddress: z.string().nullable().optional(),
  userAgent: z.string().nullable().optional(),
  deviceType: z.string().nullable().optional(),
  browser: z.string().nullable().optional(),
  browserVersion: z.string().nullable().optional(),
  operatingSystem: z.string().nullable().optional(),
  osVersion: z.string().nullable().optional(),
  screenResolution: z.string().nullable().optional(),
  language: z.string().nullable().optional(),
  timezone: z.string().nullable().optional(),
  country: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  region: z.string().nullable().optional(),
  latitude: z.string().nullable().optional(),
  longitude: z.string().nullable().optional(),
  isp: z.string().nullable().optional(),
  loginMethod: z.string().nullable().optional(),
  referrerUrl: z.string().nullable().optional(),
  success: z.boolean().default(true),
  failureReason: z.string().nullable().optional(),
  sessionId: z.string().nullable().optional(),
  sessionDurationSeconds: z.number().nullable().optional(),
  metadata: z.any().nullable().optional(),
});

export type LoginLog = z.infer<typeof loginLogSchema>;
export type InsertLoginLog = Omit<LoginLog, 'id' | 'loginAt'>;

// Activity Log Schema
export const activityLogSchema = z.object({
  id: z.number().optional(),
  userId: z.string(),
  userEmail: z.string().email(),
  actionType: z.enum([
    'survey_create',
    'survey_close',
    'survey_export',
    'survey_import',
    'survey_email',
    'email_sent',
    'settings_change',
    'feature_access',
    'login',
    'logout',
    'poi_create',
    'poi_delete',
    'media_capture',
    'profile_recording_start',
    'profile_recording_stop',
  ]),
  actionDetails: z.string().nullable().optional(),
  resourceType: z.string().nullable().optional(),
  resourceId: z.string().nullable().optional(),
  resourceName: z.string().nullable().optional(),
  ipAddress: z.string().nullable().optional(),
  deviceType: z.string().nullable().optional(),
  timestamp: z.string().optional(),
  metadata: z.any().nullable().optional(),
});

export type ActivityLog = z.infer<typeof activityLogSchema>;
export type InsertActivityLog = Omit<ActivityLog, 'id' | 'timestamp'>;

// ==================== USER SETTINGS PERSISTENCE ====================

// User Settings Schema - stores all user preferences in PostgreSQL
// Keyed by Firebase UID for persistence across browser cache clears
export const userSettingsSchema = z.object({
  id: z.string(), // Firebase UID
  displaySettings: z.any().nullable().optional(),
  laserSettings: z.any().nullable().optional(),
  gpsSettings: z.any().nullable().optional(),
  cameraSettings: z.any().nullable().optional(),
  mapSettings: z.any().nullable().optional(),
  loggingSettings: z.any().nullable().optional(),
  alertSettings: z.any().nullable().optional(),
  aiSettings: z.any().nullable().optional(),
  convoySettings: z.any().nullable().optional(),
  developerSettings: z.any().nullable().optional(),
  profileSettings: z.any().nullable().optional(),
  liveSharingSettings: z.any().nullable().optional(),
  aiAssistantSettings: z.any().nullable().optional(),
  lateralLaserSettings: z.any().nullable().optional(),
  rearOverhangSettings: z.any().nullable().optional(),
  overheadDetectionConfig: z.any().nullable().optional(),
  bufferDetectionConfig: z.any().nullable().optional(),
  layoutConfig: z.any().nullable().optional(),
  uiSettings: z.any().nullable().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export type UserSettings = z.infer<typeof userSettingsSchema>;
export type InsertUserSettings = Omit<UserSettings, 'createdAt' | 'updatedAt'>;

// ==================== COMPANY MANAGEMENT ====================

export const companyRoleEnum = z.enum(['company_admin', 'member']);
export type CompanyRole = z.infer<typeof companyRoleEnum>;

export const companySchema = z.object({
  id: z.string(),
  name: z.string().min(2, 'Company name must be at least 2 characters'),
  address: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  province: z.string().nullable().optional(),
  country: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  email: z.string().email().nullable().optional().or(z.literal('')),
  website: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  enabledAddons: z.array(z.string()).nullable().optional(),
  pendingSync: z.boolean().optional().default(false),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const insertCompanySchema = companySchema.omit({ id: true, createdAt: true, updatedAt: true });

export type Company = z.infer<typeof companySchema>;
export type InsertCompany = z.infer<typeof insertCompanySchema>;

export const companyMemberSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  firebaseUid: z.string(),
  email: z.string().email(),
  fullName: z.string().min(1, 'Full name is required'),
  role: companyRoleEnum,
  allowedAddons: z.array(z.string()).nullable().optional(),
  betaAccess: z.boolean().nullable().optional(),
  pendingSync: z.boolean().optional().default(false),
  createdAt: z.string(),
});

export const insertCompanyMemberSchema = companyMemberSchema.omit({ id: true, createdAt: true });

export type CompanyMember = z.infer<typeof companyMemberSchema>;
export type InsertCompanyMember = z.infer<typeof insertCompanyMemberSchema>;

export const updateMemberAccessSchema = z.object({
  allowedAddons: z.array(z.string()).nullable().optional(),
  betaAccess: z.boolean().nullable().optional(),
});

// ==================== MEMBER ADD-ON OVERRIDES ====================

export const ADDON_DISPLAY_NAMES: Record<string, string> = {
  ai_plus: 'AI+',
  envelope: 'Envelope Analysis',
  convoy: 'Convoy Mode',
  route_analysis: 'Route Analysis',
  swept_path: 'Swept Path',
  calibration: 'Calibration',
  '3d_view': '3D View',
  gnss: 'GNSS',
};

/**
 * Maps add-on IDs (as stored in Company.enabledAddons / MemberAddonOverride.addonKey)
 * to the feature keys used in license enforcement (useLicenseEnforcement, getBetaRestrictedFeatures).
 * Used both client-side and server-side to produce effective permission sets.
 */
export const ADDON_KEY_TO_FEATURE_KEY: Record<string, string> = {
  ai_plus: 'ai_detection',
  envelope: 'envelope_clearance',
  convoy: 'convoy_guardian',
  route_analysis: 'route_enforcement',
  swept_path: 'swept_path_analysis',
  calibration: 'calibration',
  '3d_view': 'point_cloud_scanning',
  gnss: 'gnss_profiling',
};

/** Reverse mapping: feature key → add-on ID */
export const FEATURE_KEY_TO_ADDON_KEY: Record<string, string> = Object.fromEntries(
  Object.entries(ADDON_KEY_TO_FEATURE_KEY).map(([k, v]) => [v, k])
);

export const memberAddonOverrideSchema = z.object({
  id: z.string(),
  userId: z.string(),
  userEmail: z.string().email(),
  userName: z.string().nullable().optional(),
  addonKey: z.string(),
  grantedByUid: z.string(),
  grantedByName: z.string().nullable().optional(),
  reason: z.string().min(1, 'Reason is required'),
  expiresAt: z.string(),
  grantedAt: z.string(),
  revokedAt: z.string().nullable().optional(),
  revokedByUid: z.string().nullable().optional(),
  revokedReason: z.string().nullable().optional(),
  isActive: z.boolean(),
});

export const insertMemberAddonOverrideSchema = memberAddonOverrideSchema.omit({
  id: true,
  grantedAt: true,
  revokedAt: true,
  revokedByUid: true,
  revokedReason: true,
  isActive: true,
});

export type MemberAddonOverride = z.infer<typeof memberAddonOverrideSchema>;
export type InsertMemberAddonOverride = z.infer<typeof insertMemberAddonOverrideSchema>;
