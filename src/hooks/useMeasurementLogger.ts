/**
 * useMeasurementLogger Hook
 * Provides worker-based, non-blocking measurement logging with throttled UI updates
 * 
 * PERFORMANCE CRITICAL: Eliminates main thread blocking during high-speed logging
 * CIRCUIT BREAKER: Detects sustained fallback mode and throttles main thread writes
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { getMeasurementLogger, type BatchCompleteData, type ErrorEventData, type LogStats } from '../lib/workers/MeasurementLoggerClient';
import type { Measurement } from '../lib/survey/types';
import { logger } from '../lib/utils/logger';
import { addMeasurement as fallbackAddMeasurement } from '../lib/survey';
import { toast } from 'sonner';
import { getMeasurementFeed } from '../lib/survey/MeasurementFeed';
import { useSurveyStore } from '../lib/survey';
import { auditLog, logActivity } from '../lib/auditLog';
import { getCurrentUser } from '../lib/firebase';

interface MeasurementLoggerHook {
  // Log a measurement (non-blocking, queued to worker)
  logMeasurement: (measurement: Measurement) => Promise<void>;
  
  // Force flush buffered measurements
  flush: () => Promise<void>;
  
  // Stats (throttled updates every 500ms)
  stats: {
    bufferSize: number;
    totalLogged: number;
    totalFailed: number;
    loggingRate: number; // measurements/second
    fallbackMode: boolean; // Circuit breaker: true when in sustained fallback
    consecutiveFallbacks: number; // Number of consecutive fallback writes
  };
  
  // Worker status
  isWorkerReady: boolean;
}

// Throttle stat updates to 500ms (reduce re-renders)
const STATS_UPDATE_INTERVAL = 500;
const LOGGING_RATE_WINDOW = 5000; // 5 second window for rate calculation

// Circuit breaker thresholds
const FALLBACK_MODE_THRESHOLD = 10; // Enter fallback mode after 10 consecutive fallbacks
const FALLBACK_MODE_RESET_THRESHOLD = 5; // Exit fallback mode after 5 consecutive successes
const FALLBACK_THROTTLE_MS = 200; // Throttle main thread writes to 200ms during fallback

export function useMeasurementLogger(): MeasurementLoggerHook {
  const [stats, setStats] = useState({
    bufferSize: 0,
    totalLogged: 0,
    totalFailed: 0,
    loggingRate: 0,
    fallbackMode: false,
    consecutiveFallbacks: 0
  });
  const [isWorkerReady, setIsWorkerReady] = useState(false);
  
  const { activeSurvey } = useSurveyStore();
  const measurementLogger = useRef(getMeasurementLogger());
  const measurementFeed = useRef(getMeasurementFeed());
  const statsUpdateTimer = useRef<number | null>(null);
  const rafHandle = useRef<number | null>(null);
  const logTimestamps = useRef<number[]>([]);
  
  // Circuit breaker state
  const consecutiveFallbacks = useRef(0);
  const consecutiveSuccesses = useRef(0);
  const inFallbackMode = useRef(false);
  const lastFallbackWrite = useRef<number>(0);
  const fallbackModeNotificationShown = useRef(false);

  // Initialize MeasurementFeed when survey changes
  useEffect(() => {
    if (activeSurvey?.id) {
      measurementFeed.current.init(activeSurvey.id).catch(error => {
        logger.error('Failed to initialize measurement feed:', error);
      });
    }
  }, [activeSurvey?.id]);

  // Initialize worker on mount
  useEffect(() => {
    const initWorker = async () => {
      try {
        await measurementLogger.current.init();
        setIsWorkerReady(true);
        logger.log('✅ Measurement logger worker ready');
      } catch (error) {
        logger.error('❌ Failed to initialize measurement logger:', error);
        setIsWorkerReady(false);
      }
    };

    initWorker();

    // Subscribe to batch complete notifications for UI updates
    const unsubscribeBatch = measurementLogger.current.onBatchComplete((data: BatchCompleteData) => {
      // Worker batch succeeded - reset fallback counter
      consecutiveFallbacks.current = 0;
      consecutiveSuccesses.current++;
      
      // Exit fallback mode if we've had enough consecutive successes
      if (inFallbackMode.current && consecutiveSuccesses.current >= FALLBACK_MODE_RESET_THRESHOLD) {
        inFallbackMode.current = false;
        fallbackModeNotificationShown.current = false;
        logger.log('✅ Exited fallback mode - worker recovered');
        
        // toast suppressed
      }
      
      // Schedule UI update using requestAnimationFrame (smooth 60fps)
      if (rafHandle.current) {
        cancelAnimationFrame(rafHandle.current);
      }
      
      rafHandle.current = requestAnimationFrame(() => {
        setStats(prev => ({
          bufferSize: data.bufferSize,
          totalLogged: data.totalLogged,
          totalFailed: data.totalFailed,
          loggingRate: prev.loggingRate, // Keep current rate, will be updated by timer
          fallbackMode: inFallbackMode.current,
          consecutiveFallbacks: consecutiveFallbacks.current
        }));
        
        // Dispatch event for MeasurementLog component to refresh
        window.dispatchEvent(new Event('dbchange'));
      });
    });

    // Subscribe to error events for worker failures with main thread fallback
    const unsubscribeError = measurementLogger.current.onError(async (data: ErrorEventData) => {
      logger.error(`🚨 Worker error event received: ${data.type}`);
      
      // Increment fallback counter
      consecutiveFallbacks.current++;
      consecutiveSuccesses.current = 0;
      
      // Check if we've entered sustained fallback mode
      if (!inFallbackMode.current && consecutiveFallbacks.current >= FALLBACK_MODE_THRESHOLD) {
        inFallbackMode.current = true;
        logger.warn(`⚠️ CIRCUIT BREAKER: Entered fallback mode after ${consecutiveFallbacks.current} consecutive fallbacks`);
        
        // Show notification once when entering fallback mode
        if (!fallbackModeNotificationShown.current) {
          fallbackModeNotificationShown.current = true;
          toast.error('Performance degraded - fallback mode active', {
            description: 'Worker is failing. Measurements saved via main thread with throttling to prevent UI jank.',
            duration: 10000,
            id: 'sustained-fallback-mode'
          });
        }
      }
      
      // Attempt to save failed measurement to main thread with throttling
      try {
        // CRITICAL: Throttle main thread writes during sustained fallback mode
        if (inFallbackMode.current) {
          const timeSinceLastWrite = Date.now() - lastFallbackWrite.current;
          if (timeSinceLastWrite < FALLBACK_THROTTLE_MS) {
            const delay = FALLBACK_THROTTLE_MS - timeSinceLastWrite;
            logger.debug(`⏱️ Throttling fallback write by ${delay}ms to prevent main thread jank`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
        
        await fallbackAddMeasurement(data.measurement);
        lastFallbackWrite.current = Date.now();
        logger.log(`✅ Recovered measurement ${data.measurement.id} via main thread fallback`);
        
        // Notify user about fallback (throttled to avoid spam)
        if (data.type === 'structuralFailure') {
          toast.error('Worker database failure - using fallback mode', {
            description: 'Measurements are being saved via main thread. Performance may be reduced.',
            duration: 5000,
            id: 'worker-structural-failure' // Prevent duplicate toasts
          });
        } else if (data.type === 'permanentFailure') {
          // Only show individual failure toasts if not in sustained fallback mode
          if (!inFallbackMode.current) {
            // toast suppressed
          }
        }
        
        // Update stats
        if (rafHandle.current) {
          cancelAnimationFrame(rafHandle.current);
        }
        rafHandle.current = requestAnimationFrame(() => {
          setStats(prev => ({
            ...prev,
            fallbackMode: inFallbackMode.current,
            consecutiveFallbacks: consecutiveFallbacks.current
          }));
        });
        
        // Dispatch event to refresh UI
        window.dispatchEvent(new Event('dbchange'));
      } catch (error) {
        logger.error(`❌ CRITICAL: Main thread fallback also failed for measurement ${data.measurement.id}:`, error);
        
        // Critical error - both worker and main thread failed
        toast.error('Critical: Measurement lost', {
          description: `Failed to save measurement after all retries. Error: ${error instanceof Error ? error.message : String(error)}`,
          duration: 10000,
          id: `critical-failure-${data.measurement.id}`
        });
      }
    });

    // Start periodic stats polling (throttled to 500ms)
    const pollStats = async () => {
      try {
        const latestStats = await measurementLogger.current.getStats();
        
        // Calculate logging rate from recent timestamps
        const now = Date.now();
        const recentLogs = logTimestamps.current.filter(t => now - t < LOGGING_RATE_WINDOW);
        const loggingRate = recentLogs.length / (LOGGING_RATE_WINDOW / 1000);
        
        // Update stats using RAF for smooth updates
        if (rafHandle.current) {
          cancelAnimationFrame(rafHandle.current);
        }
        
        rafHandle.current = requestAnimationFrame(() => {
          setStats({
            bufferSize: latestStats.bufferSize,
            totalLogged: latestStats.totalLogged,
            totalFailed: latestStats.totalFailed,
            loggingRate,
            fallbackMode: inFallbackMode.current,
            consecutiveFallbacks: consecutiveFallbacks.current
          });
        });
      } catch (error) {
        // Silent fail - worker might not be ready yet
      }
    };

    // Poll stats every 500ms (throttled)
    statsUpdateTimer.current = window.setInterval(pollStats, STATS_UPDATE_INTERVAL);

    // Cleanup on unmount
    return () => {
      unsubscribeBatch();
      unsubscribeError();
      
      if (statsUpdateTimer.current) {
        clearInterval(statsUpdateTimer.current);
      }
      
      if (rafHandle.current) {
        cancelAnimationFrame(rafHandle.current);
      }
      
      // Flush and terminate worker
      measurementLogger.current.flush()
        .then(() => {
          logger.log('✅ Flushed measurements on unmount');
        })
        .catch(err => {
          logger.error('❌ Failed to flush on unmount:', err);
        });
    };
  }, []);

  /**
   * Log a measurement (non-blocking, queued to worker)
   * Falls back to direct IndexedDB if worker is not ready or fails
   * CRITICAL: Updates cache IMMEDIATELY before worker batch for zero-lag UI
   */
  const logMeasurement = useCallback(async (measurement: Measurement): Promise<void> => {
    try {
      // Verbose logging disabled for production
      
      // CRITICAL FIX: Ensure feed is initialized before adding measurement
      // Race condition: feed.init() is async in useEffect, so logMeasurement
      // might run before init completes, causing addMeasurement to reject
      if (activeSurvey?.id) {
        await measurementFeed.current.init(activeSurvey.id);
      }
      
      // PERFORMANCE FIX: Update cache IMMEDIATELY (before worker batch)
      // This eliminates lag - UI sees measurements instantly from cache
      measurementFeed.current.addMeasurement(measurement);

      // Audit: fire poi_capture for user-triggered POI types (not continuous GPS or boundary markers)
      const skipAuditTypes = new Set(['START', 'END', 'PART_END', 'GPS_POSITION', 'GPS_TRACE']);
      if (measurement.poi_type && !skipAuditTypes.has(measurement.poi_type)) {
        try {
          const u = getCurrentUser();
          if (u) {
            auditLog.poiCapture(u.uid, u.email || '', measurement.id, measurement.poi_type, activeSurvey?.id || '');
            // Audit laser measurement if height data is present
            if (measurement.rel !== null && measurement.rel !== undefined) {
              logActivity({
                userId: u.uid,
                userEmail: u.email || '',
                actionType: 'laser_measurement',
                actionDetails: `Laser measurement: ${measurement.rel.toFixed(2)}m (${measurement.poi_type})`,
                resourceType: 'measurement',
                resourceName: measurement.poi_type,
              });
            }
          }
        } catch (_e) {}
      }

      // Track timestamp for logging rate calculation
      logTimestamps.current.push(Date.now());
      
      // Keep only recent timestamps (5 second window)
      const now = Date.now();
      logTimestamps.current = logTimestamps.current.filter(t => now - t < LOGGING_RATE_WINDOW);
      
      if (!isWorkerReady) {
        // Fallback to direct IndexedDB write if worker not ready
        logger.warn('⚠️ Worker not ready, using fallback addMeasurement');
        consecutiveFallbacks.current++;
        consecutiveSuccesses.current = 0;
        
        // Apply throttling if in fallback mode
        if (inFallbackMode.current) {
          const timeSinceLastWrite = Date.now() - lastFallbackWrite.current;
          if (timeSinceLastWrite < FALLBACK_THROTTLE_MS) {
            const delay = FALLBACK_THROTTLE_MS - timeSinceLastWrite;
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
        
        await fallbackAddMeasurement(measurement);
        lastFallbackWrite.current = Date.now();
        return;
      }
      
      // Try to queue to worker (non-blocking, returns immediately)
      try {
        const result = await measurementLogger.current.logMeasurement(measurement);
        
        // Worker accepted the measurement - reset fallback counters
        consecutiveFallbacks.current = 0;
        consecutiveSuccesses.current++;
        
        // Check if we can exit fallback mode
        if (inFallbackMode.current && consecutiveSuccesses.current >= FALLBACK_MODE_RESET_THRESHOLD) {
          inFallbackMode.current = false;
          fallbackModeNotificationShown.current = false;
          logger.log('✅ Exited fallback mode - worker accepting measurements again');
          
          // toast suppressed
        }
      } catch (workerError) {
        // Worker rejected the measurement (e.g., degraded mode, init failure)
        // CRITICAL: Use fallback immediately - don't return {queued: true} when worker fails
        logger.warn('⚠️ Worker rejected measurement, using fallback:', workerError);
        consecutiveFallbacks.current++;
        consecutiveSuccesses.current = 0;
        
        // Check if we've entered sustained fallback mode
        if (!inFallbackMode.current && consecutiveFallbacks.current >= FALLBACK_MODE_THRESHOLD) {
          inFallbackMode.current = true;
          logger.warn(`⚠️ CIRCUIT BREAKER: Entered fallback mode after ${consecutiveFallbacks.current} consecutive fallbacks`);
          
          // Show notification once when entering fallback mode
          if (!fallbackModeNotificationShown.current) {
            fallbackModeNotificationShown.current = true;
            toast.error('Performance degraded - fallback mode active', {
              description: 'Worker is failing. Measurements saved via main thread with throttling to prevent UI jank.',
              duration: 10000,
              id: 'sustained-fallback-mode'
            });
          }
        }
        
        // Apply throttling if in fallback mode
        if (inFallbackMode.current) {
          const timeSinceLastWrite = Date.now() - lastFallbackWrite.current;
          if (timeSinceLastWrite < FALLBACK_THROTTLE_MS) {
            const delay = FALLBACK_THROTTLE_MS - timeSinceLastWrite;
            logger.debug(`⏱️ Throttling fallback write by ${delay}ms to prevent main thread jank`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
        
        await fallbackAddMeasurement(measurement);
        lastFallbackWrite.current = Date.now();
        logger.debug('✅ Measurement saved via fallback after worker rejection');
        
        // Update stats
        if (rafHandle.current) {
          cancelAnimationFrame(rafHandle.current);
        }
        rafHandle.current = requestAnimationFrame(() => {
          setStats(prev => ({
            ...prev,
            fallbackMode: inFallbackMode.current,
            consecutiveFallbacks: consecutiveFallbacks.current
          }));
        });
      }
      
    } catch (error) {
      logger.error('❌ Failed to log measurement:', error);
      
      // Last resort fallback to direct write on error
      try {
        consecutiveFallbacks.current++;
        consecutiveSuccesses.current = 0;
        
        // Apply throttling if in fallback mode
        if (inFallbackMode.current) {
          const timeSinceLastWrite = Date.now() - lastFallbackWrite.current;
          if (timeSinceLastWrite < FALLBACK_THROTTLE_MS) {
            const delay = FALLBACK_THROTTLE_MS - timeSinceLastWrite;
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
        
        await fallbackAddMeasurement(measurement);
        lastFallbackWrite.current = Date.now();
        logger.debug('✅ Measurement saved via fallback (last resort)');
      } catch (fallbackError) {
        logger.error('❌ Fallback also failed:', fallbackError);
        throw fallbackError;
      }
    }
  }, [isWorkerReady, activeSurvey]);

  /**
   * Force flush buffered measurements
   */
  const flush = useCallback(async (): Promise<void> => {
    try {
      await measurementLogger.current.flush();
      logger.debug('✅ Measurements flushed');
    } catch (error) {
      logger.error('❌ Failed to flush measurements:', error);
      throw error;
    }
  }, []);

  return {
    logMeasurement,
    flush,
    stats,
    isWorkerReady
  };
}
