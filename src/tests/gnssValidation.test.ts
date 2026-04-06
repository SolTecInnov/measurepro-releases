/**
 * GNSS Validation Tests
 * Unit tests for Stage 3 strict identifier validation
 */

import { describe, it, expect } from 'vitest';
import {
  StrictGnssSampleSchema,
  StrictGradeEventSchema,
  StrictKFactorEventSchema,
  StrictRailCrossingEventSchema,
  StrictRoadProfileSchema,
  validateAndFilterArray,
  hasRequiredIdentifiers,
} from '../../server/gnss/validation';

describe('GNSS API Validation - Samples', () => {
  it('should accept strict sample payload with all required fields', () => {
    const strictSample = {
      surveyId: 'survey-123',
      sessionId: 'session-456',
      timestamp: '2024-01-01T00:00:00.000Z',
      latitude: 45.5,
      longitude: -122.6,
      distance: 100,
      source: 'usb',
    };
    
    const result = StrictGnssSampleSchema.safeParse(strictSample);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.surveyId).toBe('survey-123');
      expect(result.data.sessionId).toBe('session-456');
    }
  });
  
  it('should reject legacy sample without surveyId', () => {
    const legacySample = {
      sessionId: 'session-456',
      timestamp: '2024-01-01T00:00:00.000Z',
      latitude: 45.5,
      longitude: -122.6,
      distance: 100,
      source: 'browser',
    };
    
    const result = StrictGnssSampleSchema.safeParse(legacySample);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some(i => i.path.includes('surveyId'))).toBe(true);
    }
  });
  
  it('should reject legacy sample without sessionId', () => {
    const legacySample = {
      surveyId: 'survey-123',
      timestamp: '2024-01-01T00:00:00.000Z',
      latitude: 45.5,
      longitude: -122.6,
      distance: 100,
      source: 'usb',
    };
    
    const result = StrictGnssSampleSchema.safeParse(legacySample);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some(i => i.path.includes('sessionId'))).toBe(true);
    }
  });
  
  it('should reject sample with empty surveyId', () => {
    const invalidSample = {
      surveyId: '',
      sessionId: 'session-456',
      timestamp: '2024-01-01T00:00:00.000Z',
      latitude: 45.5,
      longitude: -122.6,
      distance: 100,
      source: 'browser',
    };
    
    const result = StrictGnssSampleSchema.safeParse(invalidSample);
    expect(result.success).toBe(false);
  });
  
  it('should accept sample with optional fields', () => {
    const sampleWithOptional = {
      surveyId: 'survey-123',
      sessionId: 'session-456',
      timestamp: '2024-01-01T00:00:00.000Z',
      latitude: 45.5,
      longitude: -122.6,
      distance: 100,
      source: 'usb',
      altitude: 123.4,
      speed: 50,
      heading: 90,
      accuracy: 2.5,
    };
    
    const result = StrictGnssSampleSchema.safeParse(sampleWithOptional);
    expect(result.success).toBe(true);
  });
});

describe('GNSS API Validation - Grade Events', () => {
  it('should accept strict grade event payload', () => {
    const strictEvent = {
      surveyId: 'survey-123',
      sessionId: 'session-456',
      profileId: 'profile-789',
      start_distance_m: 100,
      end_distance_m: 200,
      max_grade_pct: 15.5,
      avg_grade_pct: 12.3,
      length_m: 100,
    };
    
    const result = StrictGradeEventSchema.safeParse(strictEvent);
    expect(result.success).toBe(true);
  });
  
  it('should reject grade event without profileId', () => {
    const invalidEvent = {
      surveyId: 'survey-123',
      sessionId: 'session-456',
      start_distance_m: 100,
      end_distance_m: 200,
      max_grade_pct: 15.5,
    };
    
    const result = StrictGradeEventSchema.safeParse(invalidEvent);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some(i => i.path.includes('profileId'))).toBe(true);
    }
  });
  
  it('should reject grade event without surveyId', () => {
    const invalidEvent = {
      sessionId: 'session-456',
      profileId: 'profile-789',
      start_distance_m: 100,
      end_distance_m: 200,
      max_grade_pct: 15.5,
    };
    
    const result = StrictGradeEventSchema.safeParse(invalidEvent);
    expect(result.success).toBe(false);
  });
});

describe('GNSS API Validation - K-Factor Events', () => {
  it('should accept strict K-factor event payload', () => {
    const strictEvent = {
      surveyId: 'survey-123',
      sessionId: 'session-456',
      profileId: 'profile-789',
      distance_m: 150,
      k_factor: 50,
      curvature_type: 'convex' as const,
    };
    
    const result = StrictKFactorEventSchema.safeParse(strictEvent);
    expect(result.success).toBe(true);
  });
  
  it('should reject K-factor event without sessionId', () => {
    const invalidEvent = {
      surveyId: 'survey-123',
      profileId: 'profile-789',
      distance_m: 150,
      k_factor: 50,
      curvature_type: 'concave',
    };
    
    const result = StrictKFactorEventSchema.safeParse(invalidEvent);
    expect(result.success).toBe(false);
  });
});

describe('GNSS API Validation - Rail Crossing Events', () => {
  it('should accept strict rail crossing event payload', () => {
    const strictEvent = {
      surveyId: 'survey-123',
      sessionId: 'session-456',
      profileId: 'profile-789',
      detection_method: 'auto' as const,
      latitude: 45.5,
      longitude: -122.6,
      distance_m: 250,
      timestamp: '2024-01-01T00:00:00.000Z',
    };
    
    const result = StrictRailCrossingEventSchema.safeParse(strictEvent);
    expect(result.success).toBe(true);
  });
  
  it('should accept manual rail crossing event with coordinates', () => {
    const manualEvent = {
      surveyId: 'survey-123',
      sessionId: 'session-456',
      profileId: 'profile-789',
      detection_method: 'manual' as const,
      latitude: 45.5,
      longitude: -122.6,
      distance_m: 250,
      timestamp: '2024-01-01T00:00:00.000Z',
      notes: 'User marked crossing',
    };
    
    const result = StrictRailCrossingEventSchema.safeParse(manualEvent);
    expect(result.success).toBe(true);
  });
  
  it('should accept manual rail crossing event without coordinates or timestamp', () => {
    // This matches the REAL payload from POST /api/road-profile/rail-crossing/manual
    const manualRailCrossing = {
      surveyId: 'survey-123',
      sessionId: 'session-456',
      profileId: 'profile-789',
      detection_method: 'manual' as const,
      distance_m: 5000,
      // NO timestamp, NO latitude, NO longitude - matches real manual endpoint!
      notes: 'Manually added rail crossing without GPS coordinates',
    };
    
    const result = StrictRailCrossingEventSchema.safeParse(manualRailCrossing);
    expect(result.success).toBe(true);
    if (!result.success) {
      console.error('Validation errors:', result.error.issues);
    }
  });
  
  it('should accept automatic rail crossing event with coordinates', () => {
    const autoRailCrossing = {
      surveyId: 'survey-123',
      sessionId: 'session-456',
      profileId: 'profile-789',
      detection_method: 'auto' as const,
      latitude: 45.5,
      longitude: -122.6,
      timestamp: '2024-01-01T00:00:00.000Z',
      distance_m: 5000,
    };
    
    const result = StrictRailCrossingEventSchema.safeParse(autoRailCrossing);
    expect(result.success).toBe(true);
  });
  
  it('should accept automatic rail crossing at 0° latitude/longitude', () => {
    // Regression test for truthiness bug fix
    // 0 values should be valid (equator/prime meridian)
    const eventAtZero = {
      surveyId: 'survey-123',
      sessionId: 'session-456',
      profileId: 'profile-789',
      detection_method: 'auto' as const,
      latitude: 0,  // Valid! (equator)
      longitude: 0,  // Valid! (prime meridian)
      timestamp: '2024-01-01T00:00:00.000Z',
      distance_m: 5000
    };
    
    const result = StrictRailCrossingEventSchema.safeParse(eventAtZero);
    expect(result.success).toBe(true);
    if (!result.success) {
      console.error('Validation errors:', result.error.issues);
    }
  });
  
  it('should reject rail crossing without profileId', () => {
    const invalidEvent = {
      surveyId: 'survey-123',
      sessionId: 'session-456',
      detection_method: 'auto',
      latitude: 45.5,
      longitude: -122.6,
      distance_m: 250,
      timestamp: '2024-01-01T00:00:00.000Z',
    };
    
    const result = StrictRailCrossingEventSchema.safeParse(invalidEvent);
    expect(result.success).toBe(false);
  });
  
  it('should reject automatic rail crossing without timestamp', () => {
    const autoWithoutTimestamp = {
      surveyId: 'survey-123',
      sessionId: 'session-456',
      profileId: 'profile-789',
      detection_method: 'auto' as const,
      latitude: 45.5,
      longitude: -122.6,
      distance_m: 250,
      // NO timestamp - should fail for auto events
    };
    
    const result = StrictRailCrossingEventSchema.safeParse(autoWithoutTimestamp);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some(i => i.message.includes('Automatic rail crossings require'))).toBe(true);
    }
  });
  
  it('should reject automatic rail crossing without coordinates', () => {
    const autoWithoutCoords = {
      surveyId: 'survey-123',
      sessionId: 'session-456',
      profileId: 'profile-789',
      detection_method: 'auto' as const,
      timestamp: '2024-01-01T00:00:00.000Z',
      distance_m: 250,
      // NO latitude/longitude - should fail for auto events
    };
    
    const result = StrictRailCrossingEventSchema.safeParse(autoWithoutCoords);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some(i => i.message.includes('Automatic rail crossings require'))).toBe(true);
    }
  });
});

describe('Manual Rail Crossing Integration', () => {
  it('should accept real manual endpoint payload structure', () => {
    // This matches what POST /api/road-profile/rail-crossing/manual actually sends
    const realManualPayload = {
      surveyId: 'survey-123',
      sessionId: 'session-456', 
      profileId: 'profile-789',
      detection_method: 'manual' as const,
      distance_m: 5000,
      // NO timestamp, NO coordinates - exactly as manual endpoint sends
    };
    
    const result = StrictRailCrossingEventSchema.safeParse(realManualPayload);
    expect(result.success).toBe(true);
    if (!result.success) {
      console.error('Validation errors:', result.error.issues);
    }
  });
  
  it('should accept manual endpoint payload with optional notes', () => {
    const manualWithNotes = {
      surveyId: 'survey-123',
      sessionId: 'session-456', 
      profileId: 'profile-789',
      detection_method: 'manual' as const,
      distance_m: 5000,
      notes: 'User reported rail crossing at this location',
      // NO timestamp, NO coordinates
    };
    
    const result = StrictRailCrossingEventSchema.safeParse(manualWithNotes);
    expect(result.success).toBe(true);
  });
  
  it('should accept manual endpoint payload with partial coordinates', () => {
    // User might have latitude but not longitude, or vice versa
    const manualPartialCoords = {
      surveyId: 'survey-123',
      sessionId: 'session-456', 
      profileId: 'profile-789',
      detection_method: 'manual' as const,
      distance_m: 5000,
      latitude: 45.5,
      // NO longitude, NO timestamp - still valid for manual
    };
    
    const result = StrictRailCrossingEventSchema.safeParse(manualPartialCoords);
    expect(result.success).toBe(true);
  });
});

describe('GNSS API Validation - Road Profiles', () => {
  it('should accept strict road profile payload', () => {
    const strictProfile = {
      surveyId: 'survey-123',
      sessionId: 'session-456',
      start: '2024-01-01T00:00:00.000Z',
      end: '2024-01-01T01:00:00.000Z',
      step_m: 5,
      grade_trigger_pct: 12,
      k_factor_convex_min: 100,
      k_factor_concave_min: 100,
      summary: {
        totalDistance_m: 1000,
        maxGrade_pct: 15,
        avgGrade_pct: 5,
        gradeEventCount: 3,
        kFactorEventCount: 2,
        railCrossingCount: 1,
      },
      points: [],
    };
    
    const result = StrictRoadProfileSchema.safeParse(strictProfile);
    expect(result.success).toBe(true);
  });
  
  it('should reject profile without surveyId', () => {
    const invalidProfile = {
      sessionId: 'session-456',
      start: '2024-01-01T00:00:00.000Z',
      end: '2024-01-01T01:00:00.000Z',
      step_m: 5,
      points: [],
    };
    
    const result = StrictRoadProfileSchema.safeParse(invalidProfile);
    expect(result.success).toBe(false);
  });
  
  it('should reject profile without sessionId', () => {
    const invalidProfile = {
      surveyId: 'survey-123',
      start: '2024-01-01T00:00:00.000Z',
      end: '2024-01-01T01:00:00.000Z',
      step_m: 5,
      points: [],
    };
    
    const result = StrictRoadProfileSchema.safeParse(invalidProfile);
    expect(result.success).toBe(false);
  });
});

describe('validateAndFilterArray helper', () => {
  it('should filter out invalid samples from batch', () => {
    const mixedBatch = [
      {
        surveyId: 'survey-123',
        sessionId: 'session-456',
        timestamp: '2024-01-01T00:00:00.000Z',
        latitude: 45.5,
        longitude: -122.6,
        distance: 100,
        source: 'usb',
      },
      {
        sessionId: 'session-456',
        timestamp: '2024-01-01T00:00:01.000Z',
        latitude: 45.6,
        longitude: -122.7,
        distance: 101,
        source: 'browser',
      },
      {
        surveyId: 'survey-123',
        sessionId: 'session-456',
        timestamp: '2024-01-01T00:00:02.000Z',
        latitude: 45.7,
        longitude: -122.8,
        distance: 102,
        source: 'usb',
      },
    ];
    
    const { valid, rejected } = validateAndFilterArray(mixedBatch, StrictGnssSampleSchema);
    
    expect(valid.length).toBe(2);
    expect(rejected).toBe(1);
  });
  
  it('should return all samples if all valid', () => {
    const validBatch = [
      {
        surveyId: 'survey-123',
        sessionId: 'session-456',
        timestamp: '2024-01-01T00:00:00.000Z',
        latitude: 45.5,
        longitude: -122.6,
        distance: 100,
        source: 'usb',
      },
      {
        surveyId: 'survey-123',
        sessionId: 'session-456',
        timestamp: '2024-01-01T00:00:01.000Z',
        latitude: 45.6,
        longitude: -122.7,
        distance: 101,
        source: 'browser',
      },
    ];
    
    const { valid, rejected } = validateAndFilterArray(validBatch, StrictGnssSampleSchema);
    
    expect(valid.length).toBe(2);
    expect(rejected).toBe(0);
  });
  
  it('should return empty array if all invalid', () => {
    const invalidBatch = [
      {
        sessionId: 'session-456',
        timestamp: '2024-01-01T00:00:00.000Z',
        latitude: 45.5,
        longitude: -122.6,
        distance: 100,
      },
      {
        surveyId: 'survey-123',
        timestamp: '2024-01-01T00:00:01.000Z',
        latitude: 45.6,
        longitude: -122.7,
        distance: 101,
      },
    ];
    
    const { valid, rejected } = validateAndFilterArray(invalidBatch, StrictGnssSampleSchema);
    
    expect(valid.length).toBe(0);
    expect(rejected).toBe(2);
  });
});

describe('hasRequiredIdentifiers helper', () => {
  it('should return true for sample with all required identifiers', () => {
    const sample = {
      surveyId: 'survey-123',
      sessionId: 'session-456',
      timestamp: '2024-01-01T00:00:00.000Z',
      latitude: 45.5,
      longitude: -122.6,
      distance: 100,
    };
    
    expect(hasRequiredIdentifiers(sample)).toBe(true);
  });
  
  it('should return false for sample without surveyId', () => {
    const sample = {
      sessionId: 'session-456',
      timestamp: '2024-01-01T00:00:00.000Z',
      latitude: 45.5,
      longitude: -122.6,
      distance: 100,
    };
    
    expect(hasRequiredIdentifiers(sample)).toBe(false);
  });
  
  it('should return false for sample without sessionId', () => {
    const sample = {
      surveyId: 'survey-123',
      timestamp: '2024-01-01T00:00:00.000Z',
      latitude: 45.5,
      longitude: -122.6,
      distance: 100,
    };
    
    expect(hasRequiredIdentifiers(sample)).toBe(false);
  });
  
  it('should return false for sample with empty surveyId', () => {
    const sample = {
      surveyId: '',
      sessionId: 'session-456',
      timestamp: '2024-01-01T00:00:00.000Z',
      latitude: 45.5,
      longitude: -122.6,
      distance: 100,
    };
    
    expect(hasRequiredIdentifiers(sample)).toBe(false);
  });
});
