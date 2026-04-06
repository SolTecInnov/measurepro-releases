/**
 * Measurement Logger Client
 * Main thread interface to the measurement logger worker
 * Provides batched, non-blocking measurement logging
 * 
 * STORAGE HEALTH: Integrated with storageHealth.ts for ACK-based tracking
 * - Increments pending writes when measurement is queued
 * - Decrements on batch complete ACK
 * - Sets degraded mode on worker structural failure
 */

import { logger } from '../utils/logger';
import type { Measurement } from '../survey/types';
import { invalidateSnapshot } from '../survey/measurementSnapshot';
import { getStorageHealthTracker } from '../survey/storageHealth';
import { toast } from 'sonner';

// Worker must be in 'src/workers' directory (Vite config alias)
import MeasurementWorker from '../../workers/measurement-logger.worker?worker';

interface WorkerResponse {
  id: string;
  success: boolean;
  error?: string;
  data?: any;
}

interface BatchCompleteData {
  type: 'batchComplete';
  count: number;
  failed: number;
  totalLogged: number;
  totalFailed: number;
  totalSkipped: number;  // NEW: Number of duplicates skipped
  bufferSize: number;
  duration: number;  // Backwards compatibility
  batchDuration: number;  // FIX 4: Performance metric - batch processing time
  throughput: number;  // FIX 4: Performance metric - measurements/second
  surveyId?: string;  // ADDED: For snapshot invalidation
}

interface ErrorEventData {
  type: 'permanentFailure' | 'structuralFailure';
  measurement: Measurement;
  retries?: number;
  error: string;
}

interface DegradedModeData {
  type: 'degradedMode';
  reason: string;
}

interface LogStats {
  bufferSize: number;
  totalLogged: number;
  totalFailed: number;
  lastLogTime: number;
  batchSize: number;
  batchTimeout: number;
  degradedMode?: boolean;
  degradedModeReason?: string | null;
}

type BatchCompleteCallback = (data: BatchCompleteData) => void;
type ErrorEventCallback = (data: ErrorEventData) => void;
type DegradedModeCallback = (data: DegradedModeData) => void;

class MeasurementLoggerClient {
  private worker: Worker | null = null;
  private pendingRequests: Map<string, { resolve: (value: any) => void; reject: (reason: any) => void }> = new Map();
  private batchCompleteCallbacks: BatchCompleteCallback[] = [];
  private errorEventCallbacks: ErrorEventCallback[] = [];
  private degradedModeCallbacks: DegradedModeCallback[] = [];
  private initialized = false;
  private initPromise: Promise<void> | null = null;

  /**
   * Initialize the worker
   */
  async init(): Promise<void> {
    if (this.initialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      try {
        this.worker = new MeasurementWorker();
        
        this.worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
          const response = event.data;
          
          // Handle batch complete notifications (unsolicited messages)
          if (response.id === 'batch-complete' && response.data?.type === 'batchComplete') {
            this.notifyBatchComplete(response.data as BatchCompleteData);
            return;
          }
          
          // Handle error events (unsolicited messages from worker)
          if (response.id === 'error-event' && response.data?.type) {
            this.notifyErrorEvent(response.data as ErrorEventData);
            return;
          }
          
          // Handle degraded mode notifications (unsolicited messages)
          if (response.id === 'degraded-mode' && response.data?.type === 'degradedMode') {
            this.notifyDegradedMode(response.data as DegradedModeData);
            return;
          }

          // Handle CSV backup critical failure notifications
          if (response.id === 'csv-backup-status' && response.data?.type === 'csvBackupCritical') {
            this.handleCsvBackupCritical(response.data.surveyId as string);
            return;
          }
          
          // Handle regular request-response
          const pending = this.pendingRequests.get(response.id);
          if (pending) {
            this.pendingRequests.delete(response.id);
            
            if (response.success) {
              pending.resolve(response.data);
            } else {
              pending.reject(new Error(response.error || 'Unknown worker error'));
            }
          }
        };
        
        this.worker.onerror = (error) => {
          logger.error('❌ Measurement worker error:', error);
          // Reject all pending requests
          this.pendingRequests.forEach(({ reject }) => {
            reject(new Error('Worker error'));
          });
          this.pendingRequests.clear();
        };
        
        this.initialized = true;
        logger.log('✅ MeasurementLoggerClient initialized');
      } catch (error) {
        logger.error('❌ Failed to initialize measurement worker:', error);
        throw error;
      }
    })();

    return this.initPromise;
  }

  /**
   * Send a task to the worker and wait for response
   */
  private async sendTask<T = any>(task: any): Promise<T> {
    if (!this.initialized) {
      await this.init();
    }

    if (!this.worker) {
      throw new Error('Worker not initialized');
    }

    return new Promise((resolve, reject) => {
      const taskId = crypto.randomUUID();
      const taskWithId = { ...task, id: taskId };
      
      this.pendingRequests.set(taskId, { resolve, reject });
      
      // Set timeout for request
      setTimeout(() => {
        if (this.pendingRequests.has(taskId)) {
          this.pendingRequests.delete(taskId);
          reject(new Error('Worker request timeout'));
        }
      }, 10000); // 10 second timeout
      
      this.worker!.postMessage(taskWithId);
    });
  }

  /**
   * Log a measurement (non-blocking, batched)
   * Returns immediately with queue status
   * STORAGE HEALTH: Increments pending writes counter on queue
   */
  async logMeasurement(measurement: Measurement): Promise<{ queued: boolean; bufferSize: number; measurementId: string }> {
    try {
      // STORAGE HEALTH: Increment pending writes BEFORE sending to worker
      getStorageHealthTracker().incrementPending(1);
      
      const result = await this.sendTask({
        type: 'logMeasurement',
        measurement
      });
      
      return result;
    } catch (error) {
      logger.error('❌ Failed to queue measurement:', error);
      throw error;
    }
  }

  /**
   * Force immediate flush of buffered measurements
   */
  async flush(): Promise<{ processed: number; failed: number; errors: any[] }> {
    try {
      const result = await this.sendTask({
        type: 'flush'
      });
      
      return result;
    } catch (error) {
      logger.error('❌ Failed to flush measurements:', error);
      throw error;
    }
  }

  /**
   * Get current buffer and logging statistics
   */
  async getStats(): Promise<LogStats> {
    // No logger.error here — getStats is called frequently by polling;
    // timeouts when the worker is busy are expected and handled by callers.
    const result = await this.sendTask({
      type: 'getStats'
    });
    return result;
  }

  /**
   * Clear buffer without writing
   */
  async clearBuffer(): Promise<{ cleared: number }> {
    try {
      const result = await this.sendTask({
        type: 'clearBuffer'
      });
      
      return result;
    } catch (error) {
      logger.error('❌ Failed to clear buffer:', error);
      throw error;
    }
  }

  /**
   * Save timelapse frame to IndexedDB (off-main-thread)
   * PERFORMANCE: Eliminates 50-200ms main thread blocking
   */
  async saveTimelapseFrame(frame: {
    id: string;
    imageUrl: string;
    timestamp: string;
    frameNumber: number;
    metadata?: any;
    associatedPOIs?: any[];
    hasPOI: boolean;
  }): Promise<void> {
    try {
      await this.sendTask({
        type: 'SAVE_TIMELAPSE_FRAME',
        frame
      });
    } catch (error) {
      logger.error('❌ Failed to save timelapse frame via worker:', error);
      throw error;
    }
  }

  /**
   * Register callback for batch complete notifications
   */
  onBatchComplete(callback: BatchCompleteCallback): () => void {
    this.batchCompleteCallbacks.push(callback);
    
    // Return unsubscribe function
    return () => {
      const index = this.batchCompleteCallbacks.indexOf(callback);
      if (index > -1) {
        this.batchCompleteCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Register callback for error events (worker failures)
   */
  onError(callback: ErrorEventCallback): () => void {
    this.errorEventCallbacks.push(callback);
    
    // Return unsubscribe function
    return () => {
      const index = this.errorEventCallbacks.indexOf(callback);
      if (index > -1) {
        this.errorEventCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Register callback for degraded mode notifications
   */
  onDegradedMode(callback: DegradedModeCallback): () => void {
    this.degradedModeCallbacks.push(callback);
    
    // Return unsubscribe function
    return () => {
      const index = this.degradedModeCallbacks.indexOf(callback);
      if (index > -1) {
        this.degradedModeCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Notify all batch complete callbacks
   * ADDED: Invalidates snapshot when surveyId is present
   * STORAGE HEALTH: Applies ACK to decrement pending writes
   */
  private notifyBatchComplete(data: BatchCompleteData): void {
    logger.debug(`📦 Batch complete: ${data.count} measurements written in ${data.duration.toFixed(1)}ms`);
    
    // STORAGE HEALTH: Apply ACK to decrement pending writes
    // count = successful writes, totalSkipped = duplicates (also counted as processed)
    const totalProcessed = data.count + (data.totalSkipped || 0);
    if (totalProcessed > 0) {
      getStorageHealthTracker().applyAck(totalProcessed, Date.now());
    }
    
    // Invalidate snapshot after worker writes
    if (data.surveyId) {
      invalidateSnapshot(data.surveyId);
      logger.debug(`🔄 Invalidated snapshot for survey ${data.surveyId}`);
      
      // Dispatch event for RoadScope auto-sync trigger (handled at higher level with auth context)
      window.dispatchEvent(new CustomEvent('measurement-batch-complete', {
        detail: {
          surveyId: data.surveyId,
          totalLogged: data.totalLogged,
          count: data.count
        }
      }));

      // Sync denormalized poiCount on Survey record and Zustand store after batch write
      if (data.count > 0) {
        this.syncPoiCount(data.surveyId, data.count).catch(() => {
          // Non-critical — count will be corrected on next list open
        });
      }
    }
    
    this.batchCompleteCallbacks.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        logger.error('❌ Batch complete callback error:', error);
      }
    });
  }

  /**
   * Handle critical CSV backup failure from the worker.
   * Shows a persistent Sonner error toast with an "Export Now" action.
   * De-duplicated per survey using a toast ID so only one banner shows.
   */
  private handleCsvBackupCritical(surveyId: string): void {
    logger.error(`🚨 CSV backup critical failure for survey ${surveyId}`);
    toast.error('CSV backup failed — export recommended', {
      description: 'Device storage backup failed for the CSV data. Export your data now to avoid loss.',
      duration: Infinity,
      dismissible: true,
      id: `csv-double-fail-${surveyId}`,
      action: {
        label: 'Export Now',
        onClick: () => {
          window.dispatchEvent(new CustomEvent('trigger-csv-export', { detail: { surveyId } }));
        },
      },
    });
  }

  /**
   * Sync the denormalized poiCount from IndexedDB into the Zustand store after
   * each worker batch completes. The worker has already atomically updated the DB
   * record inside the measurement write transaction — this method just reads the
   * fresh value back and pushes it to the in-memory store so UI is accurate.
   */
  private async syncPoiCount(surveyId: string, _delta: number): Promise<void> {
    try {
      const { openSurveyDB } = await import('../survey/db');
      const db = await openSurveyDB();
      const survey = await db.get('surveys', surveyId);
      if (!survey) return;

      // Reflect the DB-authoritative value in the Zustand store
      const { useSurveyStore } = await import('../survey/store');
      const store = useSurveyStore.getState();
      if (store.activeSurvey?.id === surveyId) {
        store.setActiveSurvey(survey);
      }
      store.setSurveys(store.surveys.map(s => s.id === surveyId ? survey : s));
    } catch {
      // Non-critical
    }
  }

  /**
   * Notify all error event callbacks
   */
  private notifyErrorEvent(data: ErrorEventData): void {
    logger.error(`🚨 Worker error event: ${data.type} for measurement ${data.measurement.id}`);
    
    this.errorEventCallbacks.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        logger.error('❌ Error event callback error:', error);
      }
    });
  }

  /**
   * Notify all degraded mode callbacks
   * STORAGE HEALTH: Sets degraded mode on storage health tracker
   */
  private notifyDegradedMode(data: DegradedModeData): void {
    logger.error(`🚨 Worker entered degraded mode: ${data.reason}`);
    
    // STORAGE HEALTH: Set degraded mode
    getStorageHealthTracker().setDegradedMode(true, data.reason);
    
    this.degradedModeCallbacks.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        logger.error('❌ Degraded mode callback error:', error);
      }
    });
  }

  /**
   * Terminate the worker
   */
  terminate(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
      this.initialized = false;
      this.pendingRequests.clear();
      this.batchCompleteCallbacks = [];
      this.errorEventCallbacks = [];
      this.degradedModeCallbacks = [];
      logger.log('⏹️ MeasurementLoggerClient terminated');
    }
  }

  /**
   * MEMORY-FIRST: Setup auto-flush triggers
   * - Visibility change (app going to background)
   * - Memory pressure warnings
   */
  setupAutoFlushTriggers(): void {
    // Visibility change - flush when app goes to background
    document.addEventListener('visibilitychange', async () => {
      if (document.visibilityState === 'hidden') {
        logger.log('📱 App going to background - flushing measurements');
        try {
          const stats = await this.getStats();
          if (stats.bufferSize > 0) {
            await this.flush();
            logger.log(`✅ Background flush complete: ${stats.bufferSize} measurements saved`);
          }
        } catch (error) {
          logger.error('❌ Background flush failed:', error);
        }
      }
    });

    // Memory pressure - flush on low memory warning (if supported)
    if ('onmemorypressure' in performance) {
      (performance as any).onmemorypressure = async (event: any) => {
        logger.warn(`⚠️ Memory pressure detected (${event.level}) - emergency flush`);
        try {
          await this.flush();
          logger.log('✅ Memory pressure flush complete');
        } catch (error) {
          logger.error('❌ Memory pressure flush failed:', error);
        }
      };
    }

    // Alternative: Use performance observer for memory warnings
    if ('memory' in performance) {
      // Check memory usage periodically
      setInterval(async () => {
        const memory = (performance as any).memory;
        if (memory) {
          const usedHeapRatio = memory.usedJSHeapSize / memory.jsHeapSizeLimit;
          if (usedHeapRatio > 0.85) {
            logger.warn(`⚠️ High memory usage (${(usedHeapRatio * 100).toFixed(1)}%) - flushing buffer`);
            try {
              await this.flush();
            } catch (error) {
              logger.error('❌ Memory threshold flush failed:', error);
            }
          }
        }
      }, 30000); // Check every 30 seconds
    }

    logger.log('🔄 Auto-flush triggers initialized (visibility + memory pressure)');
  }
}

// Singleton instance
let instance: MeasurementLoggerClient | null = null;
let autoFlushInitialized = false;

/**
 * Get the singleton measurement logger client
 */
export function getMeasurementLogger(): MeasurementLoggerClient {
  if (!instance) {
    instance = new MeasurementLoggerClient();
  }
  return instance;
}

/**
 * Initialize auto-flush triggers (call once on app startup)
 */
export function initializeAutoFlush(): void {
  if (autoFlushInitialized) return;
  
  const client = getMeasurementLogger();
  client.setupAutoFlushTriggers();
  autoFlushInitialized = true;
}

export type { BatchCompleteData, ErrorEventData, DegradedModeData, LogStats };
