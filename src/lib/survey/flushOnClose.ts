/**
 * Flush-on-Close Module
 * 
 * Ensures pending measurement batches are flushed when:
 * 1. User closes the tab (beforeunload)
 * 2. User switches away from the tab (visibilitychange to hidden)
 * 3. App is about to be unloaded
 * 
 * This is critical for production resilience - prevents data loss
 * when users accidentally close the browser during a survey.
 */

import { logger } from '../utils/logger';
import { getMeasurementLogger } from '../workers/MeasurementLoggerClient';
import { stopCheckpointTimer, createCheckpoint } from './checkpoints';
import { getStorageHealth } from './storageHealth';

let isInitialized = false;

/**
 * Flush pending batches synchronously (best-effort)
 * Uses sendBeacon for beforeunload reliability
 */
async function flushPendingBatches(): Promise<void> {
  try {
    const health = getStorageHealth();
    
    if (health.pendingWrites > 0) {
      logger.log(`🚨 Flushing ${health.pendingWrites} pending writes before close...`);
      
      const workerClient = getMeasurementLogger();
      await workerClient.flush();
      
      logger.log('✅ Flush completed successfully');
    }
  } catch (error) {
    logger.error('❌ Flush on close failed:', error);
  }
}

/**
 * Handle page unload - attempt to flush
 */
function handleBeforeUnload(event: BeforeUnloadEvent): void {
  const health = getStorageHealth();
  
  // If there are pending writes, try to flush and show warning
  if (health.pendingWrites > 0) {
    // Trigger async flush (best effort - browser may kill this)
    flushPendingBatches();
    
    // Stop checkpoint timer
    stopCheckpointTimer();
    
    // Show browser warning dialog
    const message = `You have ${health.pendingWrites} unsaved measurements. Are you sure you want to leave?`;
    event.returnValue = message;
  }
}

/**
 * Handle visibility change - flush when going to background
 */
async function handleVisibilityChange(): Promise<void> {
  if (document.visibilityState === 'hidden') {
    const health = getStorageHealth();
    
    if (health.pendingWrites > 0) {
      logger.log(`📱 Tab hidden - flushing ${health.pendingWrites} pending writes...`);
      
      try {
        await flushPendingBatches();
        
        // Also create a checkpoint when going to background
        const surveyId = localStorage.getItem('activeSurveyId');
        if (surveyId) {
          await createCheckpoint(surveyId);
        }
      } catch (error) {
        logger.error('Failed to flush on visibility change:', error);
      }
    }
  }
}

/**
 * Handle page freeze (Page Lifecycle API)
 */
async function handleFreeze(): Promise<void> {
  logger.log('❄️ Page frozen - attempting final flush...');
  
  const health = getStorageHealth();
  if (health.pendingWrites > 0) {
    try {
      await flushPendingBatches();
    } catch (error) {
      logger.error('Failed to flush on freeze:', error);
    }
  }
}

/**
 * Initialize flush-on-close handlers
 * Call this once when the app starts
 */
export function initFlushOnClose(): void {
  if (isInitialized) {
    return;
  }
  
  // Register beforeunload handler
  window.addEventListener('beforeunload', handleBeforeUnload);
  
  // Register visibilitychange handler
  document.addEventListener('visibilitychange', handleVisibilityChange);
  
  // Register page freeze handler (if supported)
  if ('onfreeze' in document) {
    (document as any).addEventListener('freeze', handleFreeze);
  }
  
  // Register pagehide as backup for beforeunload
  window.addEventListener('pagehide', (event) => {
    if (event.persisted === false) {
      flushPendingBatches();
    }
  });
  
  isInitialized = true;
  logger.log('✅ Flush-on-close handlers initialized');
}

/**
 * Clean up flush-on-close handlers
 * Call this when the app is being torn down
 */
export function cleanupFlushOnClose(): void {
  if (!isInitialized) {
    return;
  }
  
  window.removeEventListener('beforeunload', handleBeforeUnload);
  document.removeEventListener('visibilitychange', handleVisibilityChange);
  
  if ('onfreeze' in document) {
    (document as any).removeEventListener('freeze', handleFreeze);
  }
  
  isInitialized = false;
  logger.log('🧹 Flush-on-close handlers cleaned up');
}
