/**
 * Firebase Sync Service
 * 
 * Processes the sync queue and uploads surveys to Firebase.
 * Handles retries, deduplication, and error recovery.
 */

import { toast } from 'sonner';
import { logger } from '../utils/logger';
import { 
  getPendingItems, 
  markItemInflight, 
  markItemCompleted, 
  markItemFailed,
  removeCompletedItems,
  getQueueStats,
  getLastSyncForSurvey,
  SyncQueueItem
} from './syncQueue';
import { connectivityMonitor, isReadyForFirebaseSync } from './connectivityMonitor';
import { syncSurveyToFirebase, syncMeasurementsToFirebase, isOnline } from '../firebase';
import { openSurveyDB } from '../survey/db';
import { Survey, Measurement } from '../survey/types';

class FirebaseSyncService {
  private isProcessing = false;
  private processingLock: Set<string> = new Set();
  private initialized = false;
  private cleanupInterval: number | null = null;
  private circuitBreakerOpen = false;
  private circuitBreakerCooldown = 30000; // 30 second cooldown after resource-exhausted
  private lastResourceExhaustedTime = 0;

  initialize(): void {
    if (this.initialized) return;
    this.initialized = true;

    // Auto-trigger event listeners are intentionally NOT registered here.
    // The sync service is available for manual invocation only — no automatic
    // queue processing happens in response to connectivity events or queue updates.

    this.cleanupInterval = window.setInterval(() => {
      removeCompletedItems(24 * 60 * 60 * 1000).then(count => {
        if (count > 0) {
          logger.debug(`[SyncService] Cleaned up ${count} old completed items`);
        }
      });
    }, 60 * 60 * 1000);

    logger.debug('[SyncService] Initialized (manual-sync-only mode)');
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private isResourceExhaustedError(error: unknown): boolean {
    if (error instanceof Error) {
      return error.message.includes('resource-exhausted') || 
             error.message.includes('Write stream exhausted');
    }
    return String(error).includes('resource-exhausted');
  }

  private isPayloadSizeError(error: unknown): boolean {
    const errorStr = error instanceof Error ? error.message : String(error);
    return errorStr.includes('payload size exceeds') || 
           errorStr.includes('Request payload size');
  }

  async processQueue(): Promise<void> {
    if (this.isProcessing) {
      logger.debug('[SyncService] Already processing queue, skipping...');
      return;
    }

    // Check circuit breaker
    if (this.circuitBreakerOpen) {
      const timeSinceExhausted = Date.now() - this.lastResourceExhaustedTime;
      if (timeSinceExhausted < this.circuitBreakerCooldown) {
        logger.debug(`[SyncService] Circuit breaker open, waiting ${Math.ceil((this.circuitBreakerCooldown - timeSinceExhausted) / 1000)}s before retry`);
        return;
      }
      logger.debug('[SyncService] Circuit breaker cooldown complete, resuming sync');
      this.circuitBreakerOpen = false;
    }

    if (!isReadyForFirebaseSync()) {
      logger.debug('[SyncService] Not ready for sync (offline or not authenticated)');
      return;
    }

    this.isProcessing = true;
    logger.debug('[SyncService] Starting queue processing...');

    try {
      const items = await getPendingItems();
      
      if (items.length === 0) {
        logger.debug('[SyncService] Queue empty, nothing to process');
        return;
      }

      logger.debug(`[SyncService] Processing ${items.length} pending items (throttled)`);

      let processedCount = 0;
      for (const item of items) {
        // Check circuit breaker between items
        if (this.circuitBreakerOpen) {
          logger.debug('[SyncService] Circuit breaker triggered, stopping queue');
          break;
        }

        if (!isReadyForFirebaseSync()) {
          logger.debug('[SyncService] Lost connectivity, stopping queue processing');
          break;
        }

        if (this.processingLock.has(item.surveyId)) {
          logger.debug(`[SyncService] Survey ${item.surveyId} already being processed, skipping`);
          continue;
        }

        await this.processItem(item);
        processedCount++;
        
        // Throttle: wait 500ms between surveys to prevent overwhelming Firebase
        if (processedCount < items.length) {
          await this.delay(500);
        }
      }
    } catch (error) {
      console.error('[SyncService] Queue processing error:', error);
      
      // Trigger circuit breaker on resource exhausted
      if (this.isResourceExhaustedError(error)) {
        this.triggerCircuitBreaker();
      }
    } finally {
      this.isProcessing = false;
    }
  }

  private triggerCircuitBreaker(): void {
    console.warn('[SyncService] Circuit breaker triggered - Firebase rate limited. Will reset on next user-initiated sync.');
    this.circuitBreakerOpen = true;
    this.lastResourceExhaustedTime = Date.now();
    // No auto-retry: the circuit breaker resets when the user explicitly triggers
    // a manual sync again (syncNow), keeping all uploads strictly user-initiated.
  }

  private async processItem(item: SyncQueueItem): Promise<void> {
    const { id, surveyId, type } = item;
    
    logger.debug(`[SyncService] Processing ${type} for survey ${surveyId}`);
    this.processingLock.add(surveyId);

    try {
      const lastSync = await getLastSyncForSurvey(surveyId);
      if (lastSync && lastSync > item.createdAt) {
        logger.debug(`[SyncService] Survey ${surveyId} already synced at ${new Date(lastSync).toISOString()}, skipping duplicate`);
        await markItemCompleted(id);
        return;
      }

      await markItemInflight(id);

      const db = await openSurveyDB();
      const survey = await db.get('surveys', surveyId) as Survey | undefined;
      
      if (!survey) {
        throw new Error(`Survey ${surveyId} not found in local database`);
      }

      const surveySuccess = await syncSurveyToFirebase(survey);
      if (!surveySuccess) {
        throw new Error('Failed to sync survey metadata to Firebase');
      }

      // MEMORY FIX: Use by-survey index to only load this survey's measurements, not ALL measurements
      const surveyMeasurements = await db.getAllFromIndex('measurements', 'by-survey', surveyId) as Measurement[];
      
      if (surveyMeasurements.length > 0) {
        logger.debug(`[SyncService] Syncing ${surveyMeasurements.length} measurements for survey ${surveyId}`);
        
        // Firebase has ~10MB payload limit per request
        // With measurements averaging ~50KB each (due to embedded images/data), use 50 per batch (~2.5MB)
        const BATCH_SIZE = 50; // Reduced to prevent payload size limit errors
        const BATCH_DELAY_MS = 150; // Wait between batches
        const totalBatches = Math.ceil(surveyMeasurements.length / BATCH_SIZE);
        let syncedMeasurements = 0;
        
        for (let i = 0; i < surveyMeasurements.length; i += BATCH_SIZE) {
          const batchNum = Math.floor(i / BATCH_SIZE) + 1;
          const batch = surveyMeasurements.slice(i, i + BATCH_SIZE);
          
          logger.debug(`[SyncService] Syncing batch ${batchNum}/${totalBatches} (${batch.length} measurements)`);
          
          try {
            const measurementsSuccess = await syncMeasurementsToFirebase(batch, surveyId);
            
            if (!measurementsSuccess) {
              throw new Error(`Failed to sync measurement batch ${batchNum}`);
            }
            
            // Track progress and emit event
            syncedMeasurements += batch.length;
            window.dispatchEvent(new CustomEvent('sync-progress', {
              detail: {
                surveyId,
                surveyTitle: survey.surveyTitle || survey.name,
                syncedItems: syncedMeasurements + 1, // +1 for the survey itself
                totalItems: surveyMeasurements.length + 1,
                batchNum,
                totalBatches
              }
            }));
            
          } catch (batchError) {
            // Check for resource-exhausted and trigger circuit breaker
            if (this.isResourceExhaustedError(batchError)) {
              this.triggerCircuitBreaker();
              throw new Error(`Firebase rate limited on batch ${batchNum}, will retry after cooldown`);
            }
            // Payload size errors shouldn't happen with 50-item batches, but log for debugging
            if (this.isPayloadSizeError(batchError)) {
              console.error(`[SyncService] Payload size error on batch ${batchNum} with ${batch.length} items - measurements may contain large embedded data`);
            }
            throw batchError;
          }
          
          // Throttle between batches (skip delay after last batch)
          if (i + BATCH_SIZE < surveyMeasurements.length) {
            await this.delay(BATCH_DELAY_MS);
          }
        }
      }

      await markItemCompleted(id);
      
      logger.debug(`[SyncService] Successfully synced survey ${surveyId} to Firebase`);
      
      /* toast removed */

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[SyncService] Failed to sync survey ${surveyId}:`, errorMessage);
      
      await markItemFailed(id, errorMessage);
      
      if (item.attempts >= item.maxAttempts - 1) {
        toast.error('Survey sync failed', {
          description: `Could not sync "${item.payloadMeta.surveyTitle}" after ${item.maxAttempts} attempts`
        });
      }
    } finally {
      this.processingLock.delete(surveyId);
    }
  }

  async syncNow(surveyId?: string): Promise<boolean> {
    if (!isOnline()) {
      toast.error('Cannot sync while offline');
      return false;
    }

    const state = await connectivityMonitor.forceCheck();
    
    if (!state.isFirebaseConnected) {
      toast.error('Cannot connect to Firebase');
      return false;
    }

    if (!state.isAuthenticated) {
      toast.error('Please sign in to sync surveys');
      return false;
    }

    toast.loading('Syncing to Firebase...', { id: 'manual-sync' });

    try {
      if (surveyId) {
        const db = await openSurveyDB();
        const survey = await db.get('surveys', surveyId) as Survey | undefined;
        
        if (!survey) {
          throw new Error('Survey not found');
        }

        const success = await syncSurveyToFirebase(survey);
        if (!success) {
          throw new Error('Failed to sync survey');
        }

        // MEMORY FIX: Use by-survey index to only load this survey's measurements, not ALL measurements
        const surveyMeasurements = await db.getAllFromIndex('measurements', 'by-survey', surveyId) as Measurement[];
        
        if (surveyMeasurements.length > 0) {
          const measurementsSuccess = await syncMeasurementsToFirebase(surveyMeasurements, surveyId);
          if (!measurementsSuccess) {
            throw new Error('Failed to sync measurements');
          }
        }

        // Update cloudUploadStatus in IndexedDB so the UI reflects the new state
        try {
          const updatedSurvey = await db.get('surveys', surveyId);
          if (updatedSurvey) {
            updatedSurvey.cloudUploadStatus = 'synced';
            updatedSurvey.lastSyncedAt = new Date().toISOString();
            await db.put('surveys', updatedSurvey);
          }
        } catch (statusErr) {
          logger.debug('[SyncService] Could not update cloudUploadStatus after manual sync:', statusErr);
        }

        /* toast removed */
        return true;
      } else {
        await this.processQueue();
        
        const stats = await getQueueStats();
        if (stats.pending === 0 && stats.failed === 0) {
          /* toast removed */
          return true;
        } else {
          /* toast removed */
          return false;
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error('Sync failed', { 
        id: 'manual-sync',
        description: errorMessage 
      });
      return false;
    }
  }

  async getStatus(): Promise<{
    isProcessing: boolean;
    queueStats: Awaited<ReturnType<typeof getQueueStats>>;
    connectivity: ReturnType<typeof connectivityMonitor.getState>;
  }> {
    return {
      isProcessing: this.isProcessing,
      queueStats: await getQueueStats(),
      connectivity: connectivityMonitor.getState()
    };
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    this.processingLock.clear();
    this.initialized = false;
  }
}

export const firebaseSyncService = new FirebaseSyncService();

export function initFirebaseSyncService(): void {
  firebaseSyncService.initialize();
}

export async function manualSyncNow(surveyId?: string): Promise<boolean> {
  return firebaseSyncService.syncNow(surveyId);
}

export async function getSyncStatus() {
  return firebaseSyncService.getStatus();
}
