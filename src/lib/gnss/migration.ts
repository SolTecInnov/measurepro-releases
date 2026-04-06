/**
 * GNSS Road Profile Migration Utility - Stage 1
 * Handles backward compatibility by migrating orphaned profiles (without surveyId/sessionId)
 * and associating them with surveys based on timestamp matching
 */

import { openSurveyDB } from '@/lib/survey/db';
import { createGnssBackup } from './backup';
import type { RoadProfile } from '../../../server/gnss/types';

const MIGRATION_FLAG_KEY = 'gnss_migration_completed';
const MIGRATION_VERSION = '1.0';
const STAGE1_FLAG_KEY = 'migration_stage1_v1';

// ==================== PART 1: Discovery - Scan Legacy Artifacts ====================

interface LegacyScanReport {
  profiles: { total: number; missingIds: number; items: RoadProfile[] };
  samples: { total: number; missingIds: number; items: any[] };
  events: { total: number; missingIds: number; items: any[] };
  timestamp: number;
}

async function scanLegacyArtifacts(): Promise<LegacyScanReport> {
  const db = await openSurveyDB();
  
  // Get all profiles, samples, events
  const profiles = await db.getAll('roadProfiles');
  const samples = await db.getAll('roadProfileSamples');
  const events = await db.getAll('roadProfileEvents');
  
  // Count missing IDs
  const profilesMissing = profiles.filter((p: any) => !p.surveyId || !p.sessionId);
  const samplesMissing = samples.filter((s: any) => !s.surveyId || !s.sessionId);
  const eventsMissing = events.filter((e: any) => !e.surveyId || !e.sessionId);
  
  return {
    profiles: { total: profiles.length, missingIds: profilesMissing.length, items: profilesMissing },
    samples: { total: samples.length, missingIds: samplesMissing.length, items: samplesMissing },
    events: { total: events.length, missingIds: eventsMissing.length, items: eventsMissing },
    timestamp: Date.now()
  };
}

// ==================== PART 2: Backfill Logic ====================

async function resolveSurveyForProfile(profile: RoadProfile, surveys: any[]): Promise<string | null> {
  // Try section lookup if sectionId exists
  if ((profile as any).sectionId) {
    // Logic to find survey via section - not implemented yet
    // This is a future enhancement
  }
  
  // Fallback: 1-hour timestamp window matching
  const startTime = new Date(profile.start).getTime();
  const oneHour = 60 * 60 * 1000;
  
  for (const survey of surveys) {
    const surveyStart = new Date(survey.createdAt || survey.startTime || 0).getTime();
    if (Math.abs(startTime - surveyStart) < oneHour) {
      return survey.id;
    }
    
    // Also check if profile overlaps with survey timeframe
    const surveyCompletedTime = survey.completedAt 
      ? new Date(survey.completedAt).getTime() 
      : Date.now();

    const profileEndTime = new Date(profile.end).getTime();
    const profileDuringSurvey = 
      startTime >= surveyStart && 
      profileEndTime <= surveyCompletedTime + oneHour;

    if (profileDuringSurvey) {
      return survey.id;
    }
  }
  
  return null;
}

async function rehydrateProfile(profile: RoadProfile, surveyId: string): Promise<void> {
  const db = await openSurveyDB();
  const updated = {
    ...profile,
    surveyId,
    sessionId: profile.sessionId || crypto.randomUUID()
  };
  await db.put('roadProfiles', updated);
}

async function rehydrateSamples(profileId: string, surveyId: string, sessionId: string): Promise<number> {
  const db = await openSurveyDB();
  const samples = await db.getAllFromIndex('roadProfileSamples', 'by-profile', profileId);
  
  let updated = 0;
  for (const sample of samples) {
    if (!sample.surveyId || !sample.sessionId) {
      await db.put('roadProfileSamples', {
        ...sample,
        surveyId,
        sessionId
      });
      updated++;
    }
  }
  return updated;
}

async function rehydrateEvents(profileId: string, surveyId: string, sessionId: string): Promise<number> {
  const db = await openSurveyDB();
  const events = await db.getAllFromIndex('roadProfileEvents', 'by-profile', profileId);
  
  let updated = 0;
  for (const event of events) {
    if (!event.surveyId || !event.sessionId) {
      await db.put('roadProfileEvents', {
        ...event,
        surveyId,
        sessionId
      });
      updated++;
    }
  }
  return updated;
}

async function quarantineRecord(recordType: 'profile' | 'sample' | 'event', reason: string, payload: any): Promise<void> {
  const db = await openSurveyDB();
  await db.add('roadProfileQuarantine', {
    recordType,
    reason,
    originalPayload: payload,
    timestamp: Date.now()
  });
}

/**
 * Quarantine a profile and ALL its dependent samples and events
 * Returns the total count of records quarantined
 */
async function quarantineProfileWithDependents(
  db: any,
  profile: RoadProfile,
  reason: string
): Promise<number> {
  let count = 0;
  
  // Quarantine profile
  await quarantineRecord('profile', reason, profile);
  count++;
  
  // Find and quarantine all samples
  const samples = await db.getAllFromIndex('roadProfileSamples', 'by-profile', profile.id);
  for (const sample of samples) {
    await quarantineRecord('sample', `Parent profile ${profile.id}: ${reason}`, sample);
    await db.delete('roadProfileSamples', sample.id);
    count++;
  }
  
  // Find and quarantine all events
  const events = await db.getAllFromIndex('roadProfileEvents', 'by-profile', profile.id);
  for (const event of events) {
    await quarantineRecord('event', `Parent profile ${profile.id}: ${reason}`, event);
    await db.delete('roadProfileEvents', event.id);
    count++;
  }
  
  // Delete profile from primary store
  await db.delete('roadProfiles', profile.id);
  
  return count;
}

// ==================== PART 5: Main Migration Orchestrator ====================

export async function runStage1Migration(
  onProgress?: (progress: { stage: string; percent: number; message: string }) => void
): Promise<{ success: boolean; quarantined: number; backfilled: number; errors: string[] }> {
  const errors: string[] = [];
  let quarantined = 0;
  let backfilled = 0;
  
  try {
    // Check if migration already completed
    const migrationComplete = localStorage.getItem(STAGE1_FLAG_KEY);
    if (migrationComplete === 'complete') {
      console.log('Stage 1 migration already completed, skipping...');
      return { success: true, quarantined: 0, backfilled: 0, errors: [] };
    }
    
    // 1. Create backup
    onProgress?.({ stage: 'backup', percent: 10, message: 'Creating backup...' });
    await createGnssBackup();
    
    // 2. Scan for legacy records
    onProgress?.({ stage: 'scan', percent: 20, message: 'Scanning for legacy records...' });
    const scan = await scanLegacyArtifacts();
    
    console.log('Legacy scan results:', {
      profiles: `${scan.profiles.missingIds} of ${scan.profiles.total}`,
      samples: `${scan.samples.missingIds} of ${scan.samples.total}`,
      events: `${scan.events.missingIds} of ${scan.events.total}`
    });
    
    // If nothing to migrate, mark as complete and exit
    if (scan.profiles.missingIds === 0 && scan.samples.missingIds === 0 && scan.events.missingIds === 0) {
      localStorage.setItem(STAGE1_FLAG_KEY, 'complete');
      onProgress?.({ stage: 'complete', percent: 100, message: 'No legacy records found - migration complete!' });
      return { success: true, quarantined: 0, backfilled: 0, errors: [] };
    }
    
    // 3. Get all surveys for matching
    const db = await openSurveyDB();
    const surveys = await db.getAll('surveys');
    
    // 4. Backfill profiles
    onProgress?.({ stage: 'profiles', percent: 40, message: `Backfilling ${scan.profiles.missingIds} profiles...` });
    for (const profile of scan.profiles.items) {
      try {
        const surveyId = await resolveSurveyForProfile(profile, surveys);
        if (surveyId) {
          await rehydrateProfile(profile, surveyId);
          backfilled++;
        } else {
          const count = await quarantineProfileWithDependents(db, profile, 'No matching survey found');
          quarantined += count;
        }
      } catch (error) {
        const errorMsg = `Failed to backfill profile ${profile.id}: ${error}`;
        errors.push(errorMsg);
        console.error(errorMsg);
      }
    }
    
    // 5. Backfill samples
    onProgress?.({ stage: 'samples', percent: 60, message: 'Backfilling samples...' });
    const profiles = await db.getAll('roadProfiles');
    for (const profile of profiles) {
      if (profile.surveyId && profile.sessionId) {
        try {
          const count = await rehydrateSamples(profile.id, profile.surveyId, profile.sessionId);
          backfilled += count;
        } catch (error) {
          const errorMsg = `Failed to backfill samples for profile ${profile.id}: ${error}`;
          errors.push(errorMsg);
          console.error(errorMsg);
        }
      }
    }
    
    // 6. Backfill events
    onProgress?.({ stage: 'events', percent: 80, message: 'Backfilling events...' });
    for (const profile of profiles) {
      if (profile.surveyId && profile.sessionId) {
        try {
          const count = await rehydrateEvents(profile.id, profile.surveyId, profile.sessionId);
          backfilled += count;
        } catch (error) {
          const errorMsg = `Failed to backfill events for profile ${profile.id}: ${error}`;
          errors.push(errorMsg);
          console.error(errorMsg);
        }
      }
    }
    
    // 7. Mark complete ONLY if no errors
    if (errors.length === 0) {
      localStorage.setItem(STAGE1_FLAG_KEY, 'complete');
      onProgress?.({ stage: 'complete', percent: 100, message: 'Migration complete!' });
    } else {
      onProgress?.({ stage: 'error', percent: 100, message: `Migration had ${errors.length} errors. Will retry on next launch.` });
    }
    
    console.log('Stage 1 migration completed:', { backfilled, quarantined, errors: errors.length });
    
    return { success: errors.length === 0, quarantined, backfilled, errors };
  } catch (error) {
    const errorMsg = `Migration failed: ${error instanceof Error ? error.message : String(error)}`;
    errors.push(errorMsg);
    console.error(errorMsg);
    return { success: false, quarantined, backfilled, errors };
  }
}

// ==================== Legacy Functions (kept for backward compatibility) ====================

interface MigrationResult {
  totalProfiles: number;
  orphanedProfiles: number;
  matchedProfiles: number;
  unmatchedProfiles: number;
  errors: string[];
}

/**
 * Check if migration has already been run (legacy)
 */
export function isMigrationCompleted(): boolean {
  try {
    const flag = localStorage.getItem(MIGRATION_FLAG_KEY);
    return flag === MIGRATION_VERSION;
  } catch (error) {
    console.error('Failed to check migration flag:', error);
    return false;
  }
}

/**
 * Mark migration as completed (legacy)
 */
function markMigrationCompleted(): void {
  try {
    localStorage.setItem(MIGRATION_FLAG_KEY, MIGRATION_VERSION);
  } catch (error) {
    console.error('Failed to set migration flag:', error);
  }
}

/**
 * Run migration to associate orphaned profiles with surveys (legacy)
 * Call this once on app initialization
 * @deprecated Use runStage1Migration instead
 */
export async function migrateOrphanedProfiles(): Promise<MigrationResult> {
  const result: MigrationResult = {
    totalProfiles: 0,
    orphanedProfiles: 0,
    matchedProfiles: 0,
    unmatchedProfiles: 0,
    errors: []
  };

  try {
    // Check if migration already completed
    if (isMigrationCompleted()) {
      console.log('GNSS migration already completed, skipping...');
      return result;
    }

    console.log('Starting GNSS road profile migration...');
    
    const db = await openSurveyDB();

    // Get all profiles from IndexedDB
    const allProfiles = await db.getAll('roadProfiles');
    result.totalProfiles = allProfiles.length;

    // Find orphaned profiles (no surveyId)
    const orphanedProfiles = allProfiles.filter((p: RoadProfile) => !p.surveyId);
    result.orphanedProfiles = orphanedProfiles.length;

    if (orphanedProfiles.length === 0) {
      console.log('No orphaned profiles found');
      markMigrationCompleted();
      return result;
    }

    console.log(`Found ${orphanedProfiles.length} orphaned profiles to migrate`);

    // Get all surveys
    const allSurveys = await db.getAll('surveys');
    
    // Sort surveys by creation date for efficient matching
    allSurveys.sort((a: any, b: any) => 
      new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()
    );

    // Match orphaned profiles to surveys
    for (const profile of orphanedProfiles) {
      try {
        const matchedSurvey = await resolveSurveyForProfile(profile, allSurveys);
        
        if (matchedSurvey) {
          // Update profile with surveyId
          const updatedProfile = {
            ...profile,
            surveyId: matchedSurvey
          };
          
          await db.put('roadProfiles', updatedProfile);
          result.matchedProfiles++;
          
          console.log(`Matched profile ${profile.id} to survey ${matchedSurvey}`);
        } else {
          result.unmatchedProfiles++;
          console.log(`Could not match profile ${profile.id} to any survey`);
        }
      } catch (error) {
        const errorMsg = `Failed to migrate profile ${profile.id}: ${error}`;
        result.errors.push(errorMsg);
        console.error(errorMsg);
      }
    }

    // Mark migration as completed
    markMigrationCompleted();

    console.log('GNSS migration completed:', result);
    return result;
  } catch (error) {
    const errorMsg = `Migration failed: ${error}`;
    result.errors.push(errorMsg);
    console.error(errorMsg);
    return result;
  }
}

/**
 * Force re-run migration (useful for testing or if issues occur)
 */
export async function forceRunMigration(): Promise<MigrationResult> {
  localStorage.removeItem(MIGRATION_FLAG_KEY);
  return migrateOrphanedProfiles();
}

/**
 * Get migration status
 */
export function getMigrationStatus(): {
  completed: boolean;
  version: string | null;
  stage1Complete: boolean;
} {
  return {
    completed: isMigrationCompleted(),
    version: localStorage.getItem(MIGRATION_FLAG_KEY),
    stage1Complete: localStorage.getItem(STAGE1_FLAG_KEY) === 'complete'
  };
}
