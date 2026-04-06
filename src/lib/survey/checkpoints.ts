/**
 * Survey Checkpoint System
 * 
 * Creates lightweight JSON metadata checkpoints every 10 minutes for production resilience.
 * Checkpoints store:
 * - Survey ID
 * - Measurement count at checkpoint time
 * - Pending writes count
 * - Worker stats (totalLogged, totalFailed, bufferSize)
 * 
 * This allows recovery analysis if a survey ends unexpectedly.
 */

import { logger } from '../utils/logger';
import { openSharedSurveyDB } from './db.shared';
import { getStorageHealthTracker } from './storageHealth';
import { getMeasurementLogger } from '../workers/MeasurementLoggerClient';

const CHECKPOINT_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

export interface SurveyCheckpoint {
  id: string;
  surveyId: string;
  measurementCount: number;
  pendingWrites: number;
  createdAt: string;
  workerStats: {
    totalLogged: number;
    totalFailed: number;
    bufferSize: number;
  };
}

// Active checkpoint timer
let checkpointTimerId: number | null = null;
let currentSurveyId: string | null = null;

/**
 * Create a checkpoint for the current survey
 */
export async function createCheckpoint(surveyId: string): Promise<SurveyCheckpoint | null> {
  try {
    const db = await openSharedSurveyDB();
    const healthTracker = getStorageHealthTracker();
    const health = healthTracker.getHealth();
    
    // Get worker stats
    let workerStats = {
      totalLogged: 0,
      totalFailed: 0,
      bufferSize: 0
    };
    
    try {
      const logger = getMeasurementLogger();
      const stats = await logger.getStats();
      workerStats = {
        totalLogged: stats.totalLogged,
        totalFailed: stats.totalFailed,
        bufferSize: stats.bufferSize
      };
    } catch (statsError) {
      // Worker not available, use defaults
    }
    
    // Count measurements for this survey (using cursor for efficiency)
    const tx = db.transaction('measurements', 'readonly');
    const index = tx.objectStore('measurements').index('by-survey');
    let measurementCount = 0;
    
    let cursor = await index.openCursor(surveyId);
    while (cursor) {
      measurementCount++;
      cursor = await cursor.continue();
    }
    
    // Create checkpoint record
    const checkpoint: SurveyCheckpoint = {
      id: `${surveyId}_${Date.now()}`,
      surveyId,
      measurementCount,
      pendingWrites: health.pendingWrites,
      createdAt: new Date().toISOString(),
      workerStats
    };
    
    // Save to IndexedDB
    await db.put('surveyCheckpoints', checkpoint);
    
    // Update storage health tracker
    healthTracker.updateCheckpoint(Date.now(), measurementCount);
    
    logger.log(`📸 Checkpoint created: ${measurementCount} measurements, ${health.pendingWrites} pending writes`);
    
    // Clean up old checkpoints (keep last 6 = 1 hour of checkpoints)
    await cleanupOldCheckpoints(surveyId, 6);
    
    return checkpoint;
  } catch (error) {
    logger.error('Failed to create checkpoint:', error);
    return null;
  }
}

/**
 * Clean up old checkpoints for a survey, keeping only the most recent N
 */
async function cleanupOldCheckpoints(surveyId: string, keepCount: number): Promise<void> {
  try {
    const db = await openSharedSurveyDB();
    const tx = db.transaction('surveyCheckpoints', 'readwrite');
    const store = tx.objectStore('surveyCheckpoints');
    const index = store.index('by-survey');
    
    // Get all checkpoints for this survey
    const checkpoints: SurveyCheckpoint[] = await index.getAll(surveyId);
    
    if (checkpoints.length <= keepCount) {
      return;
    }
    
    // Sort by createdAt descending (newest first)
    checkpoints.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    
    // Delete all except the most recent N
    for (let i = keepCount; i < checkpoints.length; i++) {
      await store.delete(checkpoints[i].id);
    }
    
    logger.debug(`🧹 Cleaned up ${checkpoints.length - keepCount} old checkpoints`);
  } catch (error) {
    logger.error('Failed to cleanup old checkpoints:', error);
  }
}

/**
 * Get the most recent checkpoint for a survey
 */
export async function getLatestCheckpoint(surveyId: string): Promise<SurveyCheckpoint | null> {
  try {
    const db = await openSharedSurveyDB();
    const tx = db.transaction('surveyCheckpoints', 'readonly');
    const index = tx.objectStore('surveyCheckpoints').index('by-survey');
    
    const checkpoints: SurveyCheckpoint[] = await index.getAll(surveyId);
    
    if (checkpoints.length === 0) {
      return null;
    }
    
    // Sort by createdAt descending and return the newest
    checkpoints.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    
    return checkpoints[0];
  } catch (error) {
    logger.error('Failed to get latest checkpoint:', error);
    return null;
  }
}

/**
 * Get all checkpoints for a survey
 */
export async function getCheckpointsForSurvey(surveyId: string): Promise<SurveyCheckpoint[]> {
  try {
    const db = await openSharedSurveyDB();
    const tx = db.transaction('surveyCheckpoints', 'readonly');
    const index = tx.objectStore('surveyCheckpoints').index('by-survey');
    
    const checkpoints: SurveyCheckpoint[] = await index.getAll(surveyId);
    
    // Sort by createdAt ascending
    checkpoints.sort((a, b) => 
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    
    return checkpoints;
  } catch (error) {
    logger.error('Failed to get checkpoints for survey:', error);
    return [];
  }
}

/**
 * Start checkpoint timer for a survey
 * Creates a checkpoint every 10 minutes
 */
export function startCheckpointTimer(surveyId: string): void {
  // Stop any existing timer
  stopCheckpointTimer();
  
  currentSurveyId = surveyId;
  
  // Create initial checkpoint immediately
  createCheckpoint(surveyId);
  
  // Start interval timer
  checkpointTimerId = window.setInterval(() => {
    if (currentSurveyId) {
      createCheckpoint(currentSurveyId);
    }
  }, CHECKPOINT_INTERVAL_MS);
  
  logger.log(`⏱️ Checkpoint timer started for survey ${surveyId}`);
}

/**
 * Stop checkpoint timer
 */
export function stopCheckpointTimer(): void {
  if (checkpointTimerId !== null) {
    clearInterval(checkpointTimerId);
    checkpointTimerId = null;
    
    // Create final checkpoint before stopping
    if (currentSurveyId) {
      createCheckpoint(currentSurveyId);
      logger.log(`⏱️ Checkpoint timer stopped for survey ${currentSurveyId}`);
    }
    
    currentSurveyId = null;
  }
}

/**
 * Delete all checkpoints for a survey
 */
export async function deleteCheckpointsForSurvey(surveyId: string): Promise<void> {
  try {
    const db = await openSharedSurveyDB();
    const tx = db.transaction('surveyCheckpoints', 'readwrite');
    const store = tx.objectStore('surveyCheckpoints');
    const index = store.index('by-survey');
    
    const checkpoints: SurveyCheckpoint[] = await index.getAll(surveyId);
    
    for (const checkpoint of checkpoints) {
      await store.delete(checkpoint.id);
    }
    
    logger.log(`🗑️ Deleted ${checkpoints.length} checkpoints for survey ${surveyId}`);
  } catch (error) {
    logger.error('Failed to delete checkpoints:', error);
  }
}
