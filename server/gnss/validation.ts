/**
 * GNSS Data Validation Schemas
 * Stage 3: End-to-End API Validation
 * 
 * Zod schemas for strict validation of GNSS samples, events, and profiles.
 * All schemas enforce required surveyId, sessionId, and profileId (where applicable).
 */

import { z } from 'zod';

/**
 * Strict GNSS Sample Schema
 * Enforces required identifiers for all GNSS samples
 * REFACTORED: Uses clean field names matching updated GnssSample interface
 * NOTE: quality, hdop, num_sats made optional for API flexibility
 */
export const StrictGnssSampleSchema = z.object({
  surveyId: z.string().min(1, 'surveyId is required'),
  sessionId: z.string().min(1, 'sessionId is required'),
  timestamp: z.string().datetime('timestamp must be valid ISO 8601'),
  latitude: z.number().min(-90).max(90, 'latitude must be between -90 and 90'),
  longitude: z.number().min(-180).max(180, 'longitude must be between -180 and 180'),
  altitude: z.number().nullable().optional().transform(val => val === undefined ? null : val),
  speed: z.number().nonnegative().nullable().optional().transform(val => val === undefined ? null : val),
  heading: z.number().min(0).max(360).nullable().optional().transform(val => val === undefined ? null : val),
  quality: z.enum(['none', 'gps', 'dgps', 'pps', 'rtk_fixed', 'rtk_float', 'estimated', 'manual']).optional(),
  hdop: z.number().nonnegative().nullable().optional().transform(val => val === undefined ? null : val),
  num_sats: z.number().int().nonnegative().nullable().optional().transform(val => val === undefined ? null : val),
  source: z.enum(['duro', 'usb', 'browser']),
  profileId: z.string().optional(),
  distance: z.number().nonnegative().optional(),
  grade: z.number().optional(),
  accuracy: z.number().nonnegative().optional(),
  correctionType: z.enum(['none', 'rtk', 'ppp', 'ppk', 'sbas']).optional(),
  correctionAge_s: z.number().nonnegative().nullable().optional().transform(val => val === undefined ? null : val),
  geoidHeight_m: z.number().nullable().optional().transform(val => val === undefined ? null : val),
  stdDev_m: z.number().nonnegative().nullable().optional().transform(val => val === undefined ? null : val),
});

/**
 * Strict Grade Event Schema
 * Enforces required identifiers for grade events
 * REFACTORED: Uses clean field names matching GradeEvent interface
 * NOTE: Many fields made optional for API flexibility
 */
export const StrictGradeEventSchema = z.object({
  surveyId: z.string().min(1, 'surveyId is required'),
  sessionId: z.string().min(1, 'sessionId is required'),
  profileId: z.string().min(1, 'profileId is required'),
  direction: z.enum(['up', 'down']).optional(),
  trigger_pct: z.number().optional(),
  max_grade_pct: z.number(),
  start_distance_m: z.number().nonnegative(),
  end_distance_m: z.number().nonnegative(),
  length_m: z.number().nonnegative(),
  start_latitude: z.number().min(-90).max(90).optional(),
  start_longitude: z.number().min(-180).max(180).optional(),
  end_latitude: z.number().min(-90).max(90).optional(),
  end_longitude: z.number().min(-180).max(180).optional(),
  start_timestamp: z.string().datetime().optional(),
  end_timestamp: z.string().datetime().optional(),
});

/**
 * Strict K-Factor Event Schema
 * Enforces required identifiers for K-factor events
 * REFACTORED: Uses clean field names matching KFactorEvent interface
 * NOTE: Many fields made optional for API flexibility
 */
export const StrictKFactorEventSchema = z.object({
  surveyId: z.string().min(1, 'surveyId is required'),
  sessionId: z.string().min(1, 'sessionId is required'),
  profileId: z.string().min(1, 'profileId is required'),
  curvature_type: z.enum(['convex', 'concave']),
  k_factor: z.number(),
  trigger_threshold: z.number().optional(),
  distance_m: z.number().nonnegative(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  timestamp: z.string().datetime().optional(),
  severity: z.enum(['warning', 'critical']).optional(),
});

/**
 * Strict Rail Crossing Event Schema
 * Enforces required identifiers for rail crossing events
 * REFACTORED: Uses clean field names matching RailCrossingEvent interface
 * NOTE: Coordinates and timestamp made optional for manual rail crossing events
 * - Manual events may not have coordinates at creation time
 * - Automatic events typically include coordinates from detection
 * 
 * VALIDATION LOGIC:
 * - Manual events: Allow without timestamp/coordinates (user may not have GPS)
 * - Auto events: Require timestamp, latitude, longitude (detected from GPS data)
 */
export const StrictRailCrossingEventSchema = z.object({
  surveyId: z.string().min(1, 'surveyId is required'),
  sessionId: z.string().min(1, 'sessionId is required'),
  profileId: z.string().min(1, 'profileId is required'),
  detection_method: z.enum(['auto', 'manual']),
  distance_m: z.number().nonnegative(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  timestamp: z.string().datetime().optional(),
  elevation_change_m: z.number().optional(),
  notes: z.string().optional(),
}).refine(
  (data) => {
    // For manual events, coordinates and timestamp are optional
    if (data.detection_method === 'manual') {
      return true; // Allow manual events without timestamp/coordinates
    }
    
    // For automatic events, require coordinates and timestamp
    // Explicitly check for undefined/null, allow 0 values (e.g., 0° latitude at equator)
    if (data.detection_method === 'auto') {
      return data.latitude !== undefined && 
             data.longitude !== undefined && 
             data.timestamp !== undefined;
    }
    
    // Fallback: be lenient if detection_method is somehow undefined
    return true;
  },
  {
    message: 'Automatic rail crossings require latitude, longitude, and timestamp'
  }
);

/**
 * Strict Road Profile Schema
 * Enforces required identifiers for road profiles
 */
export const StrictRoadProfileSchema = z.object({
  surveyId: z.string().min(1, 'surveyId is required'),
  sessionId: z.string().min(1, 'sessionId is required'),
  start: z.string().datetime('start must be valid ISO 8601'),
  end: z.string().datetime('end must be valid ISO 8601'),
  step_m: z.number().positive(),
  grade_trigger_pct: z.number(),
  k_factor_convex_min: z.number(),
  k_factor_concave_min: z.number(),
  label: z.string().optional(),
  // summary and points are complex objects that will be validated separately
});

/**
 * Batch Sync Schema
 * For batch operations with samples, events, and profiles
 */
export const StrictSyncBatchSchema = z.object({
  samples: z.array(StrictGnssSampleSchema),
  events: z.array(
    z.union([
      StrictGradeEventSchema,
      StrictKFactorEventSchema,
      StrictRailCrossingEventSchema,
    ])
  ).optional(),
  profile: StrictRoadProfileSchema.optional(),
});

/**
 * Helper: Create standardized validation error response
 * 
 * Extracts missing fields and creates structured error response
 * with HTTP 422 status code and MISSING_IDENTIFIERS error code.
 */
export function createValidationErrorResponse(error: z.ZodError) {
  const missing: Record<string, boolean> = {};
  const fieldErrors: Record<string, string> = {};
  
  error.issues.forEach(issue => {
    const field = issue.path.join('.');
    const fieldName = issue.path[issue.path.length - 1]?.toString() || 'unknown';
    
    if (issue.code === 'invalid_type' && (issue as any).received === 'undefined') {
      missing[fieldName] = true;
    }
    
    fieldErrors[field] = issue.message;
  });
  
  return {
    error: 'Invalid GNSS data',
    message: 'Missing or invalid required identifiers',
    missing,
    code: 'MISSING_IDENTIFIERS',
    details: error.issues.map(i => ({
      path: i.path.join('.'),
      message: i.message,
      code: i.code,
    })),
    fieldErrors,
  };
}

/**
 * Helper: Validate array and filter out invalid items
 * 
 * Returns valid items and count of rejected items.
 * Useful for batch operations where we want to process valid data
 * and report rejected items.
 */
export function validateAndFilterArray<T>(
  items: unknown[],
  schema: z.ZodSchema<T>
): { valid: T[]; rejected: number; errors: z.ZodError[] } {
  const valid: T[] = [];
  const errors: z.ZodError[] = [];
  
  items.forEach(item => {
    const result = schema.safeParse(item);
    if (result.success) {
      valid.push(result.data);
    } else {
      errors.push(result.error);
    }
  });
  
  return {
    valid,
    rejected: items.length - valid.length,
    errors,
  };
}

/**
 * Helper: Check if sample has required identifiers
 * 
 * Quick check for surveyId and sessionId presence.
 * Used for fast filtering before full validation.
 */
export function hasRequiredIdentifiers(sample: any): boolean {
  return !!(
    sample &&
    typeof sample.surveyId === 'string' &&
    sample.surveyId.length > 0 &&
    typeof sample.sessionId === 'string' &&
    sample.sessionId.length > 0
  );
}

/**
 * Helper: Check if event has required identifiers
 * 
 * Quick check for surveyId, sessionId, and profileId presence.
 * Used for fast filtering before full validation.
 */
export function eventHasRequiredIdentifiers(event: any): boolean {
  return !!(
    event &&
    typeof event.surveyId === 'string' &&
    event.surveyId.length > 0 &&
    typeof event.sessionId === 'string' &&
    event.sessionId.length > 0 &&
    typeof event.profileId === 'string' &&
    event.profileId.length > 0
  );
}

/**
 * Helper: Check if profile has required identifiers
 * 
 * Quick check for surveyId and sessionId presence.
 * Used for fast filtering before full validation.
 */
export function profileHasRequiredIdentifiers(profile: any): boolean {
  return !!(
    profile &&
    typeof profile.surveyId === 'string' &&
    profile.surveyId.length > 0 &&
    typeof profile.sessionId === 'string' &&
    profile.sessionId.length > 0
  );
}
