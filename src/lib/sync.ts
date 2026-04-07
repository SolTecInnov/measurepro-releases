import { syncSurveyToFirebase, syncMeasurementsToFirebase, syncVehicleTracesToFirebase, isOnline, getCurrentUser } from './firebase';
import { toast } from 'sonner';
import { sendSyncCompletionEmail } from './utils/emailUtils';
import { openSurveyDB } from './survey/db';
import { logger } from './utils/logger';
import { useSettingsStore } from './settings';

// Sync status types
export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error';

// Interface for sync manager
export interface SyncManager {
  status: SyncStatus;
  lastSyncTime: Date | null;
  pendingChanges: number;
  syncInProgress: boolean;
  startSync: () => Promise<boolean>;
  forceSync: (email: string, password: string) => Promise<boolean>;
  checkPendingChanges: () => Promise<number>;
}

// Create a sync manager
export const createSyncManager = (): SyncManager => {
  let status: SyncStatus = 'idle';
  let lastSyncTime: Date | null = null;
  let pendingChanges = 0;
  let syncInProgress = false;

  // Email rate limiting to prevent spam (persisted across sessions)
  const EMAIL_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hour cooldown
  const MAX_EMAILS_PER_DAY = 5; // Maximum emails per 24h period
  
  // Atomic email state management - always read/write localStorage directly
  const getEmailState = () => {
    try {
      const saved = localStorage.getItem('syncEmailState');
      if (saved) {
        const state = JSON.parse(saved);
        // Reset counter if it's a new day
        const dayMs = 24 * 60 * 60 * 1000;
        if (Date.now() - state.lastResetTime > dayMs) {
          const freshState = { lastEmailSentTime: null, emailsSentToday: 0, lastResetTime: Date.now() };
          localStorage.setItem('syncEmailState', JSON.stringify(freshState));
          return freshState;
        }
        return state;
      }
    } catch (err) {
      logger.warn('Failed to load email rate limit state:', err);
    }
    const defaultState = { lastEmailSentTime: null, emailsSentToday: 0, lastResetTime: Date.now() };
    try {
      localStorage.setItem('syncEmailState', JSON.stringify(defaultState));
    } catch (err) {
      // Silent fail
    }
    return defaultState;
  };
  
  const updateEmailState = async (updates: Partial<{ lastEmailSentTime: number, emailsSentToday: number, lastResetTime: number }>): Promise<boolean> => {
    try {
      // Use Web Locks API for true atomic reservation across tabs
      // PRODUCTION-SAFE: Require Web Locks API - no fallback to prevent race conditions
      
      if (!('locks' in navigator)) {
        // Web Locks unavailable - email notifications disabled for safety
        // This affects browsers like Safari <15.4 and older Chrome/Edge versions
        logger.warn('Email notifications disabled: Web Locks API unavailable (required for atomic multi-tab safety)');
        return false;
      }
      
      // ATOMIC: Web Locks API ensures only ONE tab can execute this code at a time
      const result = await navigator.locks.request('email-rate-limit-lock', { ifAvailable: true }, async (lock) => {
        if (!lock) {
          // Another tab holds the lock, abort
          logger.debug('Email rate limit: lock unavailable (concurrent operation)');
          return false;
        }
        
        // We have exclusive lock - safe to read/modify/write
        // CRITICAL: Re-check ALL conditions against fresh state inside lock
        const baseState = getEmailState();
        const now = Date.now();
        
        // Check 24h cooldown against fresh state
        const canSendEmail = !baseState.lastEmailSentTime || 
                            (now - baseState.lastEmailSentTime > EMAIL_COOLDOWN_MS);
        if (!canSendEmail) {
          const hoursRemaining = Math.ceil((EMAIL_COOLDOWN_MS - (now - (baseState.lastEmailSentTime || 0))) / 3600000);
          logger.debug(`Email rate limit: cooldown active inside lock (${hoursRemaining}h remaining)`);
          return false;
        }
        
        // Check daily limit against fresh state
        if (updates.emailsSentToday !== undefined) {
          const newCount = baseState.emailsSentToday + 1;
          if (newCount > MAX_EMAILS_PER_DAY) {
            logger.debug(`Email rate limit: would exceed daily cap (${newCount}/${MAX_EMAILS_PER_DAY})`);
            return false;
          }
          updates.emailsSentToday = newCount;
        }
        
        // All checks passed - write new state while holding lock
        const newState = { ...baseState, ...updates };
        localStorage.setItem('syncEmailState', JSON.stringify(newState));
        return true;
      });
      
      return result || false;
    } catch (err) {
      logger.warn('Failed to save email rate limit state:', err);
      return false;
    }
  };

  // Load last sync time from localStorage
  try {
    const savedLastSyncTime = localStorage.getItem('lastSyncTime');
    if (savedLastSyncTime) {
      lastSyncTime = new Date(savedLastSyncTime);
    }
  } catch (error) {
    // localStorage access failed - continue without saved time
    logger.warn('Failed to load lastSyncTime from localStorage');
  }

  // Start sync process
  const startSync = async (): Promise<boolean> => {
    if (syncInProgress) {
      logger.debug('Sync already in progress');
      return false;
    }

    if (!isOnline()) {
      toast.error('Cannot sync while offline', {
        description: 'Please check your internet connection and try again'
      });
      return false;
    }

    // Check if user is signed in
    if (!getCurrentUser()) {
      toast.error('Authentication required', {
        description: 'Please sign in to sync your data'
      });
      
      // Dispatch auth required event
      window.dispatchEvent(new CustomEvent('auth-required', { 
        detail: { reason: 'sync' }
      }));
      
      return false;
    }

    try {
      syncInProgress = true;
      status = 'syncing';
      
      // Dispatch sync start event
      window.dispatchEvent(new CustomEvent('sync-status-change', { 
        detail: { status: 'syncing', pendingChanges }
      }));

      logger.log('Starting sync process');

      // Open the database
      const db = await openSurveyDB();

      // Get all surveys
      const surveys = await db.getAllFromIndex('surveys', 'by-date');
      logger.log(`Found ${surveys.length} surveys to sync`);
      
      // MEMORY FIX: Skip orphaned measurement diagnostic during sync to prevent memory issues
      // This was loading ALL measurements into memory which causes crashes with large databases
      // Orphaned measurement cleanup is now handled separately via window.orphanedMeasurements utilities
      
      // Track total items and synced items
      let totalItems = 0;
      let syncedItems = 0;

      // Sync each survey
      let successCount = 0;
      for (const survey of surveys) {
        try {
          totalItems++;
          
          // Sync survey data
          const surveySuccess = await syncSurveyToFirebase(survey);
          
          if (surveySuccess) {
            syncedItems++;
            
            // Get measurements for this survey
            // MEMORY FIX: Use by-survey index to only load this survey's measurements, not ALL measurements
            let surveyMeasurements: any[] = [];
            
            if (db.objectStoreNames.contains('measurements')) {
              try {
                surveyMeasurements = await db.getAllFromIndex('measurements', 'by-survey', survey.id);
              } catch (error) {
                logger.warn('Failed to access measurements:', error);
                surveyMeasurements = [];
              }
            } else {
              logger.warn('Measurements store not found, skipping');
            }
            
            // Sync measurements
            if (surveyMeasurements.length > 0) {
              totalItems += surveyMeasurements.length;
              
              const measurementsSuccess = await syncMeasurementsToFirebase(surveyMeasurements, survey.id);
              
              if (measurementsSuccess) {
                syncedItems += surveyMeasurements.length;
                
                // Get vehicle traces for this survey if available
                if (db.objectStoreNames.contains('vehicleTraces')) {
                  try {
                    const vehicleTraces = await db.getAllFromIndex('vehicleTraces', 'by-survey', survey.id);
                    
                    if (vehicleTraces.length > 0) {
                      totalItems += vehicleTraces.length;
                      
                      // Sync vehicle traces to trackpoints collection
                      const tracesSuccess = await syncVehicleTracesToFirebase(vehicleTraces, survey.id);
                      
                      if (tracesSuccess) {
                        syncedItems += vehicleTraces.length;
                        logger.log(`Successfully synced ${vehicleTraces.length} vehicle traces for survey ${survey.id}`);
                        
                        // Update vehicle traces sync status in local DB
                        for (const trace of vehicleTraces) {
                          await db.put('vehicleTraces', {
                            ...trace,
                            cloudUploadStatus: 'synced',
                            lastSyncedAt: new Date().toISOString()
                          });
                        }
                      }
                    }
                  } catch (error) {
                    logger.warn('Failed to sync vehicle traces:', error);
                  }
                }
                
                logger.log(`Successfully synced survey ${survey.id} with ${surveyMeasurements.length} measurements`);
                successCount++;
                
                // Update survey sync status in local DB
                await db.put('surveys', {
                  ...survey,
                  cloudUploadStatus: 'synced',
                  lastSyncedAt: new Date().toISOString()
                });
                
                // Update measurements sync status in local DB
                for (const measurement of surveyMeasurements) {
                  await db.put('measurements', {
                    ...measurement,
                    cloudUploadStatus: 'synced',
                    lastSyncedAt: new Date().toISOString()
                  });
                }
              }
            } else {
              logger.log(`Survey ${survey.id} has no measurements to sync`);
              successCount++;
              
              // Update survey sync status in local DB
              await db.put('surveys', {
                ...survey,
                cloudUploadStatus: 'synced',
                lastSyncedAt: new Date().toISOString()
              });
            }
          }
        } catch (error) {
          logger.error(`Error syncing survey ${survey.id}:`, error);
        }
      }

      // Update sync status
      lastSyncTime = new Date();
      try {
        localStorage.setItem('lastSyncTime', lastSyncTime.toISOString());
      } catch (error) {
        // localStorage quota exceeded - continue sync anyway
        logger.warn('Failed to save lastSyncTime to localStorage (quota exceeded)');
      }
      
      // Check for pending changes
      // Force a recount of pending changes after sync
      pendingChanges = await checkPendingChanges(true);
      
      // Set status to success if we synced everything we attempted to sync
      status = syncedItems === totalItems ? 'success' : 'error';
      
      // Dispatch sync complete event
      window.dispatchEvent(new CustomEvent('sync-status-change', { 
        detail: { 
          status, 
          pendingChanges,
          lastSyncTime,
          successCount,
          syncedItems,
          totalItems
        }
      }));

      if (successCount > 0) {
        // toast suppressed

        // Send sync completion email notification (rate limited to prevent spam)
        // Require explicit opt-in (=== true) to prevent emails before settings hydrate
        const emailEnabled = useSettingsStore.getState().loggingSettings?.emailNotifications === true;
        
        if (emailEnabled) {
          // Get fresh email state atomically from localStorage
          const emailState = getEmailState();
          
          const now = Date.now();
          const canSendEmail = !emailState.lastEmailSentTime || 
                              (now - emailState.lastEmailSentTime > EMAIL_COOLDOWN_MS);
          const underDailyLimit = emailState.emailsSentToday < MAX_EMAILS_PER_DAY;
          
          if (canSendEmail && underDailyLimit) {
            // ATOMICITY FIX: Reserve slot BEFORE sending email to prevent race conditions
            const reservationSuccess = await updateEmailState({
              lastEmailSentTime: now,
              emailsSentToday: emailState.emailsSentToday + 1
            });
            
            if (reservationSuccess) {
              const syncDuration = ((Date.now() - (lastSyncTime?.getTime() || Date.now())) / 1000).toFixed(1);
              const failedItems = totalItems - syncedItems;
              
              try {
                const emailSent = await sendSyncCompletionEmail('admin@soltec.ca', {
                  syncStatus: failedItems === 0 ? 'success' : 'partial',
                  totalItems,
                  syncedItems,
                  failedItems,
                  syncDuration: `${syncDuration}s`,
                  summary: `Successfully synced ${syncedItems} of ${totalItems} items to cloud storage.`
                });
                
                if (emailSent) {
                  logger.log('Sync completion email sent successfully');
                } else {
                  logger.warn('Sync notification email failed to send (slot already reserved)');
                }
              } catch (err) {
                logger.error('Failed to send sync completion email (slot already reserved):', err);
              }
            } else {
              logger.warn('Failed to reserve email slot - localStorage full or unavailable');
            }
          } else {
            if (!underDailyLimit) {
              logger.debug(`Daily email limit reached (${emailState.emailsSentToday}/${MAX_EMAILS_PER_DAY})`);
            } else {
              const hoursRemaining = Math.ceil((EMAIL_COOLDOWN_MS - (now - (emailState.lastEmailSentTime || 0))) / 3600000);
              logger.debug(`Skipping sync email (cooldown active, ${hoursRemaining}h remaining)`);
            }
          }
        } else {
          logger.debug('Sync email notifications disabled by user');
        }
      } else {
        toast.error('Sync failed', {
          description: 'No surveys were successfully synced'
        });

        // Send failure email notification (rate limited to prevent spam)
        // Require explicit opt-in (=== true) to prevent emails before settings hydrate
        const emailEnabled = useSettingsStore.getState().loggingSettings?.emailNotifications === true;
        
        if (emailEnabled) {
          // Get fresh email state atomically from localStorage
          const emailState = getEmailState();
          
          const now = Date.now();
          const canSendEmail = !emailState.lastEmailSentTime || 
                              (now - emailState.lastEmailSentTime > EMAIL_COOLDOWN_MS);
          const underDailyLimit = emailState.emailsSentToday < MAX_EMAILS_PER_DAY;
          
          if (canSendEmail && underDailyLimit) {
            // ATOMICITY FIX: Reserve slot BEFORE sending email to prevent race conditions
            const reservationSuccess = await updateEmailState({
              lastEmailSentTime: now,
              emailsSentToday: emailState.emailsSentToday + 1
            });
            
            if (reservationSuccess) {
              try {
                const emailSent = await sendSyncCompletionEmail('admin@soltec.ca', {
                  syncStatus: 'failed',
                  totalItems,
                  syncedItems: 0,
                  failedItems: totalItems,
                  syncDuration: '0s',
                  summary: 'Sync failed - no surveys were successfully synced to cloud storage.'
                });
                
                if (emailSent) {
                  logger.log('Sync failure email sent successfully');
                } else {
                  logger.warn('Sync failure notification email failed to send (slot already reserved)');
                }
              } catch (err) {
                logger.error('Failed to send sync failure email (slot already reserved):', err);
              }
            } else {
              logger.warn('Failed to reserve email slot - localStorage full or unavailable');
            }
          } else {
            if (!underDailyLimit) {
              logger.debug(`Daily email limit reached (${emailState.emailsSentToday}/${MAX_EMAILS_PER_DAY})`);
            } else {
              const hoursRemaining = Math.ceil((EMAIL_COOLDOWN_MS - (now - (emailState.lastEmailSentTime || 0))) / 3600000);
              logger.debug(`Skipping sync failure email (cooldown active, ${hoursRemaining}h remaining)`);
            }
          }
        } else {
          logger.debug('Sync failure email notifications disabled by user');
        }
      }

      return successCount > 0;
    } catch (error) {
      logger.error('Error during sync:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        error
      });
      status = 'error';
      
      // Dispatch sync error event
      window.dispatchEvent(new CustomEvent('sync-status-change', { 
        detail: { status: 'error', error }
      }));
      
      toast.error('Sync failed', {
        description: error instanceof Error ? error.message : 'Unknown error occurred'
      });
      
      return false;
    } finally {
      syncInProgress = false;
    }
  };

  // Force sync with credentials
  const forceSync = async (_email: string, _password: string): Promise<boolean> => {
    if (syncInProgress) {
      logger.debug('Sync already in progress');
      return false;
    }

    if (!isOnline()) {
      toast.error('Cannot sync while offline', {
        description: 'Please check your internet connection and try again'
      });
      return false;
    }

    try {
      // Authentication will be handled by the caller
      return await startSync();
    } catch (error) {
      logger.error('Error during forced sync:', error);
      return false;
    }
  };

  // Cache for pending changes to avoid expensive DB queries
  let cachedPendingCount = { value: 0, timestamp: 0 };
  const CACHE_TTL_MS = 5000; // 5-second cache to prevent DB pressure during rapid logging

  // Check for pending changes with cursor-based counting for better performance
  const checkPendingChanges = async (forceRecount: boolean = false): Promise<number> => {
    const startTime = performance.now();
    
    try {
      // Return cached value if fresh and not forcing recount
      if (!forceRecount && (Date.now() - cachedPendingCount.timestamp) < CACHE_TTL_MS) {
        logger.debug('[Sync] Using cached pending count:', cachedPendingCount.value, '(cache hit)');
        return cachedPendingCount.value;
      }
      
      if ((!isOnline() || !getCurrentUser()) && !forceRecount) {
        // If offline or not signed in, don't update the pending changes count
        return pendingChanges;
      }
      
      logger.debug('[Sync] Computing pending changes (cache miss)...');
      
      // Open the database using correct version
      const db = await openSurveyDB();

      // Count using cursors instead of loading all data into memory
      let count = 0;
      
      // If not signed in, count all surveys using cursor
      if (!getCurrentUser()) {
        const tx = db.transaction('surveys', 'readonly');
        const store = tx.objectStore('surveys');
        let cursor = await store.openCursor();
        
        while (cursor) {
          count++;
          cursor = await cursor.continue();
        }
        
        await tx.done;
        
        // Update cache
        cachedPendingCount = { value: count, timestamp: Date.now() };
        pendingChanges = count;
        
        const duration = performance.now() - startTime;
        logger.debug(`[Sync] Pending changes check completed: ${count} items in ${duration.toFixed(1)}ms`);
        if (duration > 200) {
          logger.warn(`[Sync] WARNING: checkPendingChanges took ${duration.toFixed(1)}ms (>200ms threshold)`);
        }
        
        return count;
      }
      
      // Count surveys that need syncing using cursor
      const surveyTx = db.transaction('surveys', 'readonly');
      const surveyStore = surveyTx.objectStore('surveys');
      let surveyCursor = await surveyStore.openCursor();
      
      const surveysNeedingSync: string[] = [];
      
      while (surveyCursor) {
        const survey = surveyCursor.value;
        
        // If survey has never been synced or was modified after last sync
        if (!survey.lastSyncedAt || survey.cloudUploadStatus !== 'synced' ||
            (survey.updatedAt && survey.lastSyncedAt && new Date(survey.updatedAt) > new Date(survey.lastSyncedAt))) {
          count++;
          surveysNeedingSync.push(survey.id);
        }
        
        surveyCursor = await surveyCursor.continue();
      }
      
      await surveyTx.done;
      
      // Get all survey IDs to check for orphaned measurements
      const allSurveyIds = new Set<string>();
      const allSurveysTx = db.transaction('surveys', 'readonly');
      const allSurveysStore = allSurveysTx.objectStore('surveys');
      let allSurveysCursor = await allSurveysStore.openCursor();
      
      while (allSurveysCursor) {
        allSurveyIds.add(allSurveysCursor.value.id);
        allSurveysCursor = await allSurveysCursor.continue();
      }
      
      await allSurveysTx.done;
      
      // Count measurements that need syncing using cursor (EXCLUDING orphaned measurements)
      const measurementTx = db.transaction('measurements', 'readonly');
      const measurementStore = measurementTx.objectStore('measurements');
      let measurementCursor = await measurementStore.openCursor();
      let orphanedCount = 0;
      
      while (measurementCursor) {
        const measurement = measurementCursor.value;
        
        // Skip orphaned measurements (no matching survey)
        if (!allSurveyIds.has(measurement.user_id)) {
          orphanedCount++;
          measurementCursor = await measurementCursor.continue();
          continue;
        }
        
        // Only count if survey doesn't already need syncing (avoid double counting)
        if (!surveysNeedingSync.includes(measurement.user_id)) {
          if (!measurement.lastSyncedAt || measurement.cloudUploadStatus !== 'synced' ||
              (measurement.updatedAt && measurement.lastSyncedAt && 
               new Date(measurement.updatedAt) > new Date(measurement.lastSyncedAt))) {
            count++;
          }
        }
        
        measurementCursor = await measurementCursor.continue();
      }
      
      await measurementTx.done;
      
      // Log orphaned measurements for diagnostics
      if (orphanedCount > 0) {
        logger.warn(`⚠️ Excluded ${orphanedCount} orphaned measurements from sync count (no matching survey)`);
      }
      
      // Count vehicle traces that need syncing if the store exists
      if (db.objectStoreNames.contains('vehicleTraces')) {
        try {
          const traceTx = db.transaction('vehicleTraces', 'readonly');
          const traceStore = traceTx.objectStore('vehicleTraces');
          let traceCursor = await traceStore.openCursor();
          
          while (traceCursor) {
            const trace = traceCursor.value;
            
            // Only count if survey doesn't already need syncing
            if (!surveysNeedingSync.includes(trace.surveyId)) {
              if (!trace.lastSyncedAt || trace.cloudUploadStatus !== 'synced' ||
                  (trace.updatedAt && trace.lastSyncedAt && 
                   new Date(trace.updatedAt) > new Date(trace.lastSyncedAt))) {
                count++;
              }
            }
            
            traceCursor = await traceCursor.continue();
          }
          
          await traceTx.done;
        } catch (error) {
          logger.warn('Failed to count vehicle traces:', error);
        }
      }
      
      // Update cache with fresh count
      cachedPendingCount = { value: count, timestamp: Date.now() };
      pendingChanges = count;
      
      // Dispatch event with updated count
      window.dispatchEvent(new CustomEvent('sync-status-change', { 
        detail: { pendingChanges: count }
      }));
      
      const duration = performance.now() - startTime;
      
      // Performance warning if operation is slow
      if (duration > 200) {
        logger.warn(`[Sync] WARNING: checkPendingChanges took ${duration.toFixed(1)}ms (>200ms threshold)`);
      }
      
      return count;
    } catch (error) {
      logger.error('Error checking pending changes:', error);
      
      const duration = performance.now() - startTime;
      logger.error(`[Sync] Error after ${duration.toFixed(1)}ms`);
      
      return pendingChanges;
    }
  };

  // Initialize by checking pending changes
  checkPendingChanges().then(count => {
    pendingChanges = count;
    logger.log(`Found ${count} pending changes`);
  });

  return {
    get status() { return status; },
    get lastSyncTime() { return lastSyncTime; },
    get pendingChanges() { return pendingChanges; },
    get syncInProgress() { return syncInProgress; },
    startSync,
    forceSync,
    checkPendingChanges
  };
};

// Create a global sync manager instance
export const syncManager = createSyncManager();

// Set up automatic sync when online
export const setupAutoSync = () => {
  // Sync when we come back online
  window.addEventListener('online', () => {
    logger.log('Back online, checking for pending changes');
    
    // Update pending changes count - wrap in try-catch to prevent crashes
    syncManager.checkPendingChanges().catch(err => {
      logger.warn('Failed to check pending changes on online event:', err);
    });
    
    // Only auto-sync if user is signed in
    if (getCurrentUser()) {
      syncManager.checkPendingChanges().then(count => {
        if (count > 0) {
          logger.log(`Found ${count} pending changes, starting sync`);
          syncManager.startSync().catch(err => {
            logger.warn('Auto-sync failed on online event:', err);
          });
        }
      }).catch(err => {
        logger.warn('Failed to check pending changes for auto-sync:', err);
      });
    } else {
      logger.log('User not signed in, skipping auto-sync');
    }
  });

  // Check for pending changes periodically when online (reduced to 30s to prevent DB pressure during rapid logging)
  setInterval(() => {
    if (isOnline() && getCurrentUser()) {
      syncManager.checkPendingChanges().catch(err => {
        logger.warn('Failed to check pending changes on periodic check:', err);
      });
      
      // Only auto-sync if there are pending changes
      if (syncManager.pendingChanges > 0 && !syncManager.syncInProgress) {
        logger.log(`Found ${syncManager.pendingChanges} pending changes during periodic check, starting sync`);
        syncManager.startSync().catch(err => {
          logger.warn('Periodic auto-sync failed:', err);
        });
      }
    }
  }, 30 * 1000); // Check every 30 seconds
  
  // Also check pending changes when auth state changes
  // CRITICAL FIX: Wrap in try-catch to prevent crashes when internet drops mid-session
  window.addEventListener('auth-state-changed', () => {
    logger.log('Auth state changed, checking pending changes');
    // Add debounce to prevent multiple rapid calls
    clearTimeout(pendingChangesDebounceTimer);
    pendingChangesDebounceTimer = setTimeout(() => {
      syncManager.checkPendingChanges().catch(err => {
        // Silent fail - this prevents crashes when internet drops during active session
        logger.debug('Auth state changed but failed to check pending changes (likely offline):', err);
      });
    }, 500) as unknown as number;
  });
};

// Add debounce timer for pending changes check
let pendingChangesDebounceTimer: number;