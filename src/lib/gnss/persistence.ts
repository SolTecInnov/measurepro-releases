/**
 * GNSS Persistence Module
 * Real-time IndexedDB streaming with crash protection for road profiling
 * 
 * Features:
 * - Auto-checkpoint every 50 GNSS samples
 * - Checkpoint on visibility change/app background
 * - Background Firestore sync
 * - Links samples to active survey via surveyId
 */

import { openSurveyDB } from '../survey/db';
import { toast } from 'sonner';
import { getCurrentUser } from '@/lib/firebase';
import { ingestGNSS } from '@/lib/gnssApi';
import type { GnssSample } from '../../../server/gnss/types';

const CHECKPOINT_INTERVAL = 50; // Save every 50 samples
const SYNC_BATCH_SIZE = 100; // Sync to Firestore in batches of 100

interface PersistenceState {
  isRecording: boolean;
  currentSessionId: string | null;
  currentSurveyId: string | null;
  currentProfileId: string | null;
  sampleBuffer: GnssSample[];
  totalSamples: number;
  lastCheckpoint: Date | null;
  lastSync: Date | null;
  recordingStartTime: Date | null;
}

class GnssPersistence {
  private state: PersistenceState = {
    isRecording: false,
    currentSessionId: null,
    currentSurveyId: null,
    currentProfileId: null,
    sampleBuffer: [],
    totalSamples: 0,
    lastCheckpoint: null,
    lastSync: null,
    recordingStartTime: null,
  };

  private visibilityHandler: (() => void) | null = null;
  private beforeUnloadHandler: ((e: BeforeUnloadEvent) => void) | null = null;
  private syncInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.setupCrashProtection();
  }

  /**
   * Setup crash protection handlers
   */
  private setupCrashProtection() {
    // Checkpoint on visibility change (app backgrounding)
    this.visibilityHandler = () => {
      if (document.hidden && this.state.isRecording) {
        this.checkpoint().catch(err => {
          console.error('Visibility checkpoint failed:', err);
        });
      }
    };
    document.addEventListener('visibilitychange', this.visibilityHandler);

    // Checkpoint before page unload
    this.beforeUnloadHandler = (e: BeforeUnloadEvent) => {
      if (this.state.isRecording && this.state.sampleBuffer.length > 0) {
        // Synchronous checkpoint
        this.checkpointSync();
        
        // Show warning if there's unsaved data
        e.preventDefault();
        e.returnValue = 'Road profile recording in progress. Are you sure you want to leave?';
        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', this.beforeUnloadHandler);
  }

  /**
   * Start recording GNSS samples
   */
  async startRecording(surveyId: string, sessionId?: string | null, profileId?: string | null): Promise<{ surveyId: string, sessionId: string, profileId: string }> {
    if (this.state.isRecording) {
      throw new Error('Already recording. Stop current session first.');
    }

    const finalSessionId = sessionId || crypto.randomUUID();
    const finalProfileId = profileId || crypto.randomUUID();

    // PERSIST surveyId in state
    this.state.currentSurveyId = surveyId;
    this.state.currentSessionId = finalSessionId;
    this.state.currentProfileId = finalProfileId;
    this.state.isRecording = true;
    this.state.sampleBuffer = [];
    this.state.totalSamples = 0;
    this.state.recordingStartTime = new Date();
    this.state.lastCheckpoint = new Date();
    this.state.lastSync = new Date();

    // Start background sync every 30 seconds
    this.syncInterval = setInterval(() => {
      this.syncToFirestore().catch(err => {
        console.error('Background sync failed:', err);
      });
    }, 30000);

    // STEP 5: Add debug logging
    console.log(`[GNSS Persistence] Started recording:`, {
      surveyId,
      sessionId: finalSessionId,
      profileId: finalProfileId,
      timestamp: new Date().toISOString()
    });

    return { surveyId, sessionId: finalSessionId, profileId: finalProfileId };
  }

  /**
   * Stop recording and finalize
   */
  async stopRecording(): Promise<{ profileId: string, sessionId: string, surveyId: string, totalSamples: number, duration_s: number }> {
    if (!this.state.isRecording) {
      throw new Error('Not currently recording');
    }

    // STEP 1: Snapshot identifiers BEFORE any checkpoint/reset
    const { currentProfileId, currentSessionId, currentSurveyId, totalSamples } = this.state;

    // STEP 2: Validate identifiers are present
    if (!currentProfileId || !currentSessionId || !currentSurveyId) {
      throw new Error('Cannot stop recording: missing profile/session/survey identifiers');
    }

    // STEP 3: Calculate duration
    const duration_s = this.state.recordingStartTime 
      ? Math.floor((Date.now() - this.state.recordingStartTime.getTime()) / 1000)
      : 0;

    // STEP 4: Build metadata with validated identifiers
    const metadata = {
      profileId: currentProfileId,
      sessionId: currentSessionId,
      surveyId: currentSurveyId,
      totalSamples,
      duration_s
    };

    // STEP 5: Perform final checkpoint
    await this.checkpoint();

    // STEP 6: Final sync to Firestore
    await this.syncToFirestore();

    // Clear sync interval
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }

    // STEP 7: Reset state AFTER metadata captured
    this.state = {
      isRecording: false,
      currentSessionId: null,
      currentSurveyId: null,
      currentProfileId: null,
      sampleBuffer: [],
      totalSamples: 0,
      lastCheckpoint: null,
      lastSync: null,
      recordingStartTime: null,
    };

    console.log(`[GNSS Persistence] Stopped recording: ${metadata.totalSamples} samples, ${metadata.duration_s}s`);

    // STEP 8: Return guaranteed non-null metadata
    return metadata;
  }

  /**
   * Add GNSS sample to buffer
   * Accepts samples without surveyId/sessionId and enriches them
   * STAGE 2: Enhanced validation with user feedback - THROWS on missing IDs
   */
  async addSample(sample: Omit<GnssSample, 'surveyId' | 'sessionId'> & { surveyId?: string; sessionId?: string }): Promise<void> {
    if (!this.state.isRecording) {
      return;
    }

    // STAGE 2: Validate sample has required IDs - THROW ERROR instead of silent skip
    if (!this.state.currentSurveyId || !this.state.currentSessionId || !this.state.currentProfileId) {
      const errorMsg = 'Cannot add GNSS sample without required identifiers (surveyId/sessionId/profileId)';
      console.error('[GnssPersistence]', errorMsg, {
        surveyId: this.state.currentSurveyId,
        sessionId: this.state.currentSessionId,
        profileId: this.state.currentProfileId,
        sample
      });
      toast.error('GNSS Data Error', {
        description: errorMsg
      });
      throw new Error(errorMsg);  // Throw to halt recording session loudly!
    }

    // Add survey/session IDs to sample to create fully-typed GnssSample
    const enrichedSample: GnssSample = {
      ...sample,
      surveyId: this.state.currentSurveyId,
      sessionId: this.state.currentSessionId,
    };

    this.state.sampleBuffer.push(enrichedSample);
    this.state.totalSamples++;

    // Auto-checkpoint every CHECKPOINT_INTERVAL samples
    if (this.state.sampleBuffer.length >= CHECKPOINT_INTERVAL) {
      await this.checkpoint();
    }
  }

  /**
   * Checkpoint buffer to IndexedDB
   * STAGE 2: Validates required IDs before persisting
   */
  private async checkpoint(): Promise<void> {
    if (this.state.sampleBuffer.length === 0) {
      return;
    }

    // STAGE 2: Validate required IDs before checkpoint - THROW ERROR instead of silent skip
    if (!this.state.currentSurveyId || !this.state.currentSessionId || !this.state.currentProfileId) {
      const errorMsg = 'Cannot save GNSS data without required identifiers (surveyId/sessionId/profileId)';
      console.error('[GnssPersistence]', errorMsg);
      toast.error('GNSS Data Error', {
        description: errorMsg
      });
      throw new Error(errorMsg);
    }

    // STEP 5: Add debug logging before save
    console.log(`[GNSS Persistence] Checkpoint starting: surveyId=${this.state.currentSurveyId}, profileId=${this.state.currentProfileId}, samples=${this.state.sampleBuffer.length}`);

    try {
      const db = await openSurveyDB();
      const samplesToSave = [...this.state.sampleBuffer];
      
      // Save each sample to IndexedDB
      for (const sample of samplesToSave) {
        const dbSample = {
          id: crypto.randomUUID(),
          profileId: this.state.currentProfileId!,
          surveyId: this.state.currentSurveyId!,
          sessionId: this.state.currentSessionId!,
          timestamp: sample.timestamp,
          lat: sample.latitude,
          lon: sample.longitude,
          alt_m: sample.altitude,
          speed_mps: sample.speed,
          heading_deg: sample.heading,
          quality: sample.quality,
          hdop: sample.hdop,
          num_sats: sample.num_sats,
          source: sample.source,
          cloudSynced: false,
          createdAt: new Date().toISOString(),
        };

        await db.add('roadProfileSamples', dbSample);
      }

      this.state.lastCheckpoint = new Date();
      this.state.sampleBuffer = [];

      console.log(`[GNSS Persistence] Checkpoint complete: saved ${samplesToSave.length} samples to IndexedDB for surveyId=${this.state.currentSurveyId}`);
    } catch (error) {
      console.error('[GNSS Persistence] Checkpoint failed:', error);
      toast.error('Failed to save GNSS samples', {
        description: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Synchronous checkpoint for beforeunload handler
   * NOTE: Removed localStorage emergency checkpoint to prevent quota exceeded errors
   * IndexedDB persistence (via regular checkpoint) is sufficient for crash protection
   */
  private checkpointSync(): void {
    if (this.state.sampleBuffer.length === 0) {
      return;
    }

    // Skip emergency checkpoint - relying on regular IndexedDB checkpoints
    // which happen every 50 samples and on visibility change
    console.warn(`[GNSS Persistence] Skipping emergency checkpoint - ${this.state.sampleBuffer.length} samples in buffer will be lost if page closes`);
  }

  /**
   * Sync unsynced samples to Firestore
   * STAGE 2: Filters samples BEFORE queueing and shows aggregate skip counts
   */
  private async syncToFirestore(): Promise<void> {
    if (!getCurrentUser()) {
      return; // Skip sync if not authenticated
    }

    // STAGE 2: Validate required IDs before syncing
    if (!this.state.currentSurveyId || !this.state.currentSessionId) {
      console.warn('[GnssPersistence] Skipping Firestore sync - missing required IDs');
      return;
    }

    try {
      const db = await openSurveyDB();
      
      // Get unsynced samples
      const allSamples = await db.getAll('roadProfileSamples');
      const unsyncedSamples = allSamples.filter((s: any) => 
        !s.cloudSynced && 
        s.sessionId === this.state.currentSessionId
      );

      if (unsyncedSamples.length === 0) {
        return;
      }

      // STAGE 2: Filter samples BEFORE queueing
      const strictSamples = unsyncedSamples.filter((s: any) => 
        s.profileId && s.surveyId && s.sessionId
      );
      
      const skipped = unsyncedSamples.length - strictSamples.length;
      if (skipped > 0) {
        console.warn(`[GnssPersistence] Filtered out ${skipped} legacy samples from sync`);
        toast.warning('Legacy Samples Skipped', {
          description: `${skipped} samples skipped during sync due to missing identifiers.`
        });
      }
      
      if (strictSamples.length === 0) {
        return;  // Nothing to sync
      }

      // STEP 5: Add debug logging for sync
      console.log(`[GNSS Persistence] Syncing ${strictSamples.length} samples to Firestore:`, {
        surveyId: this.state.currentSurveyId,
        sessionId: this.state.currentSessionId,
        profileId: this.state.currentProfileId
      });

      // Sync in batches (only strict samples)
      const batches = [];
      for (let i = 0; i < strictSamples.length; i += SYNC_BATCH_SIZE) {
        batches.push(strictSamples.slice(i, i + SYNC_BATCH_SIZE));
      }

      for (const batch of batches) {
        // STEP 2: Map samples with guaranteed surveyId
        // Map from IndexedDB schema (lat, lon, alt_m, speed_mps, heading_deg) 
        // to GnssSample interface (latitude, longitude, altitude, speed, heading)
        const gnssSamples: GnssSample[] = batch.map((s: any) => ({
          timestamp: s.timestamp,
          latitude: s.lat,
          longitude: s.lon,
          altitude: s.alt_m,
          speed: s.speed_mps,
          heading: s.heading_deg,
          quality: s.quality,
          hdop: s.hdop,
          num_sats: s.num_sats,
          source: s.source,
          surveyId: s.surveyId,  // STAGE 2: Already validated
          sessionId: s.sessionId,  // STAGE 2: Already validated
          profileId: s.profileId,  // STAGE 2: Already validated
        }));

        // Ingest to backend (which syncs to Firestore)
        await ingestGNSS({ samples: gnssSamples });

        // Mark samples as synced
        for (const sample of batch) {
          await db.put('roadProfileSamples', { ...sample, cloudSynced: true });
        }
      }

      this.state.lastSync = new Date();
      console.log(`[GNSS Persistence] Sync complete: ${strictSamples.length} samples synced to Firestore for surveyId=${this.state.currentSurveyId}`);
    } catch (error) {
      console.error('[GNSS Persistence] Firestore sync failed:', error);
      // Don't throw - sync will retry on next interval
    }
  }

  /**
   * Get current recording state
   */
  public getState(): Readonly<PersistenceState> {
    return { ...this.state };
  }

  /**
   * Clean up old emergency checkpoints from localStorage
   * Called on startup to free up quota
   */
  cleanupEmergencyCheckpoints(): number {
    let cleanedCount = 0;
    
    try {
      const emergencyKeys = Object.keys(localStorage).filter(k => k.startsWith('emergency_gnss_'));
      
      for (const key of emergencyKeys) {
        try {
          localStorage.removeItem(key);
          cleanedCount++;
        } catch (err) {
          console.error(`Failed to remove ${key}:`, err);
        }
      }
      
      if (cleanedCount > 0) {
        console.log(`[GNSS Persistence] Cleaned up ${cleanedCount} old emergency checkpoints from localStorage`);
      }
    } catch (error) {
      console.error('[GNSS Persistence] Emergency cleanup failed:', error);
    }
    
    return cleanedCount;
  }

  /**
   * Recover from emergency checkpoint
   * NOTE: Emergency checkpoints are no longer created (disabled to prevent quota errors)
   * This function remains for backward compatibility with existing emergency data
   */
  async recoverEmergencyData(): Promise<number> {
    let recoveredCount = 0;

    try {
      const db = await openSurveyDB();
      const emergencyKeys = Object.keys(localStorage).filter(k => k.startsWith('emergency_gnss_'));

      for (const key of emergencyKeys) {
        try {
          const data = JSON.parse(localStorage.getItem(key) || '{}');
          
          if (data.samples && Array.isArray(data.samples)) {
            // Save to IndexedDB - map from old to new field names
            for (const sample of data.samples) {
              const dbSample = {
                id: crypto.randomUUID(),
                profileId: data.profileId,
                surveyId: data.surveyId,
                sessionId: data.sessionId,
                timestamp: sample.timestamp,
                lat: sample.latitude || sample.lat,  // Handle both old and new field names
                lon: sample.longitude || sample.lon,
                alt_m: sample.altitude || sample.alt_m,
                speed_mps: sample.speed || sample.speed_mps,
                heading_deg: sample.heading || sample.heading_deg,
                quality: sample.quality,
                hdop: sample.hdop,
                num_sats: sample.num_sats,
                source: sample.source,
                cloudSynced: false,
                createdAt: new Date().toISOString(),
              };

              await db.add('roadProfileSamples', dbSample);
              recoveredCount++;
            }

            // Remove emergency data after successful recovery
            localStorage.removeItem(key);
          }
        } catch (err) {
          console.error(`Failed to recover emergency data from ${key}:`, err);
          // Clean up corrupted emergency data
          localStorage.removeItem(key);
        }
      }

      if (recoveredCount > 0) {
        console.log(`[GNSS Persistence] Recovered ${recoveredCount} samples from emergency storage`);
        toast.success(`Recovered ${recoveredCount} GNSS samples from previous session`);
      }
    } catch (error) {
      console.error('[GNSS Persistence] Emergency recovery failed:', error);
    }

    return recoveredCount;
  }

  /**
   * Cleanup - remove event listeners
   */
  cleanup(): void {
    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
    }
    if (this.beforeUnloadHandler) {
      window.removeEventListener('beforeunload', this.beforeUnloadHandler);
    }
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
  }
}

// Singleton instance
export const gnssPersistence = new GnssPersistence();

// Auto-cleanup and recover on module load
if (typeof window !== 'undefined') {
  // Immediate cleanup of emergency checkpoints to free localStorage quota
  gnssPersistence.cleanupEmergencyCheckpoints();
  
  // Then attempt recovery (for backward compatibility with any remaining data)
  setTimeout(() => {
    gnssPersistence.recoverEmergencyData().catch(err => {
      console.error('Auto-recovery failed:', err);
    });
  }, 2000); // Wait 2s after app load
}
