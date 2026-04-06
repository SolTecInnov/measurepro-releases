/**
 * GNSS Frontend Type Guards
 * Stage 2: Type System Hardening
 * 
 * Discriminator functions to distinguish strict vs legacy GNSS records
 * Union types for read operations that may return either strict or legacy data
 */

import type { 
  RoadProfileStrict, 
  LegacyRoadProfile,
  RoadProfileSampleStrict,
  LegacyRoadProfileSample,
  RoadProfileEventStrict,
  LegacyRoadProfileEvent
} from '../../../server/gnss/types';

/**
 * Type guard to check if a road profile is strict (has required IDs)
 * @param profile - Profile to check
 * @returns True if profile has non-null surveyId and sessionId
 */
export function isStrictRoadProfile(profile: RoadProfileStrict | LegacyRoadProfile): profile is RoadProfileStrict {
  return profile.surveyId != null && profile.sessionId != null;
}

/**
 * Type guard to check if a road profile sample is strict (has required IDs)
 * @param sample - Sample to check
 * @returns True if sample has non-null profileId, surveyId, and sessionId
 */
export function isStrictRoadProfileSample(sample: RoadProfileSampleStrict | LegacyRoadProfileSample): sample is RoadProfileSampleStrict {
  return sample.profileId != null && sample.surveyId != null && sample.sessionId != null;
}

/**
 * Type guard to check if a road profile event is strict (has required IDs)
 * @param event - Event to check
 * @returns True if event has non-null profileId, surveyId, and sessionId
 */
export function isStrictRoadProfileEvent(event: RoadProfileEventStrict | LegacyRoadProfileEvent): event is RoadProfileEventStrict {
  return event.profileId != null && event.surveyId != null && event.sessionId != null;
}

/**
 * Union type for road profiles that may be read from storage
 * Includes both strict (new) and legacy (quarantined/pre-migration) profiles
 */
export type RoadProfileRead = RoadProfileStrict | LegacyRoadProfile;

/**
 * Union type for road profile samples that may be read from storage
 * Includes both strict (new) and legacy (quarantined/pre-migration) samples
 */
export type RoadProfileSampleRead = RoadProfileSampleStrict | LegacyRoadProfileSample;

/**
 * Union type for road profile events that may be read from storage
 * Includes both strict (new) and legacy (quarantined/pre-migration) events
 */
export type RoadProfileEventRead = RoadProfileEventStrict | LegacyRoadProfileEvent;

/**
 * Re-export strict types for convenience
 */
export type { RoadProfileStrict, RoadProfileSampleStrict, RoadProfileEventStrict };

/**
 * Re-export legacy types for convenience
 */
export type { LegacyRoadProfile, LegacyRoadProfileSample, LegacyRoadProfileEvent };
