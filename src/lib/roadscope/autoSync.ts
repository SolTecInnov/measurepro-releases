/**
 * RoadScope Auto-Sync
 * 
 * Automatically syncs survey to RoadScope every 250 entries when auto-sync is enabled.
 */

import { toast } from 'sonner';
import { API_BASE_URL } from '@/lib/config/environment';
import { syncSurveyToRoadScope, getSyncStatus } from './syncService';
import { openSurveyDB } from '../survey/db';
import { logger } from '../utils/logger';

// Threshold for auto-sync
const AUTO_SYNC_THRESHOLD = 250;

// Track last synced counts per survey to avoid redundant syncs
const lastSyncedCounts: Map<string, number> = new Map();

// Track if sync is in progress per survey
const syncInProgress: Map<string, boolean> = new Map();

// Debounce timers per survey
const debounceTimers: Map<string, number> = new Map();

/**
 * Check if RoadScope auto-sync is enabled for a user
 */
async function isRoadScopeAutoSyncEnabled(userId: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/roadscope/settings/${userId}`);
    const json = await res.json();
    
    if (json.success && json.data) {
      return json.data.autoSyncEnabled === true && json.data.apiKeyValidated === true;
    }
    return false;
  } catch (error) {
    logger.debug('[RoadScopeAutoSync] Failed to check settings:', error);
    return false;
  }
}

/**
 * Get the current POI count for a survey
 */
async function getSurveyPOICount(surveyId: string): Promise<number> {
  try {
    const db = await openSurveyDB();
    const measurements = await db.getAllFromIndex('measurements', 'by-survey', surveyId);
    // Count only entries with POI numbers (actual logged entries, not continuous data)
    const poiCount = measurements.filter(m => m.poiNumber != null).length;
    return poiCount;
  } catch (error) {
    logger.warn('[RoadScopeAutoSync] Failed to get POI count:', error);
    return 0;
  }
}

/**
 * Perform the auto-sync to RoadScope
 */
async function performAutoSync(surveyId: string, userId: string, poiCount: number): Promise<void> {
  if (syncInProgress.get(surveyId)) {
    logger.debug('[RoadScopeAutoSync] Sync already in progress, skipping');
    return;
  }
  
  syncInProgress.set(surveyId, true);
  
  try {
    // Get the survey data
    const db = await openSurveyDB();
    const survey = await db.get('surveys', surveyId);
    
    if (!survey) {
      logger.warn('[RoadScopeAutoSync] Survey not found:', surveyId);
      return;
    }
    
    // Check if already synced to RoadScope
    const status = await getSyncStatus(surveyId);
    
    logger.info(`[RoadScopeAutoSync] Auto-syncing survey ${surveyId} at ${poiCount} POIs`);
    /* toast removed */
    
    // Perform the sync
    const result = await syncSurveyToRoadScope(survey, userId, {
      includeFiles: false, // Don't sync files during auto-sync (too slow)
      targetSurveyId: status?.roadscopeSurveyId,
      onProgress: (progress) => {
        logger.debug('[RoadScopeAutoSync] Progress:', progress.phase, progress.current, '/', progress.total);
      }
    });
    
    if (result.success) {
      lastSyncedCounts.set(surveyId, poiCount);
      logger.info(`[RoadScopeAutoSync] Successfully synced ${result.poisSynced} POIs to RoadScope`);
      /* toast removed */
    } else {
      logger.warn('[RoadScopeAutoSync] Sync failed:', result.errors);
      // Don't show error toast for auto-sync to avoid spam
    }
    
  } catch (error) {
    logger.error('[RoadScopeAutoSync] Error during auto-sync:', error);
    // Don't show error toast for auto-sync to avoid spam
  } finally {
    syncInProgress.set(surveyId, false);
  }
}

/**
 * Check if auto-sync should be triggered and do it if needed
 */
export async function checkAndTriggerAutoSync(surveyId: string, userId: string): Promise<void> {
  // Clear any existing debounce timer
  const existingTimer = debounceTimers.get(surveyId);
  if (existingTimer) {
    window.clearTimeout(existingTimer);
  }
  
  // Debounce to avoid checking on every single measurement
  const timerId = window.setTimeout(async () => {
    try {
      // Check if auto-sync is enabled
      const autoSyncEnabled = await isRoadScopeAutoSyncEnabled(userId);
      if (!autoSyncEnabled) {
        return;
      }
      
      // Get current POI count
      const poiCount = await getSurveyPOICount(surveyId);
      
      // Get last synced count
      const lastSynced = lastSyncedCounts.get(surveyId) || 0;
      
      // Calculate if we've crossed a threshold
      const lastThreshold = Math.floor(lastSynced / AUTO_SYNC_THRESHOLD) * AUTO_SYNC_THRESHOLD;
      const currentThreshold = Math.floor(poiCount / AUTO_SYNC_THRESHOLD) * AUTO_SYNC_THRESHOLD;
      
      // Sync if we've crossed a new 250-entry threshold
      if (currentThreshold > lastThreshold && poiCount >= AUTO_SYNC_THRESHOLD) {
        logger.info(`[RoadScopeAutoSync] Threshold crossed: ${lastSynced} -> ${poiCount}, triggering sync`);
        await performAutoSync(surveyId, userId, poiCount);
      }
      
    } catch (error) {
      logger.warn('[RoadScopeAutoSync] Error checking auto-sync:', error);
    }
  }, 5000); // 5 second debounce
  
  debounceTimers.set(surveyId, timerId);
}

/**
 * Reset the last synced count for a survey (call when survey is closed/reset)
 */
export function resetAutoSyncState(surveyId: string): void {
  lastSyncedCounts.delete(surveyId);
  syncInProgress.delete(surveyId);
  
  const timer = debounceTimers.get(surveyId);
  if (timer) {
    window.clearTimeout(timer);
    debounceTimers.delete(surveyId);
  }
}

/**
 * Initialize the auto-sync state for a survey (call when survey is loaded)
 */
export async function initAutoSyncState(surveyId: string, userId: string): Promise<void> {
  try {
    const status = await getSyncStatus(surveyId);
    if (status?.synced) {
      // Set the last synced count based on what was synced
      lastSyncedCounts.set(surveyId, status.syncedPoiCount || 0);
      logger.debug(`[RoadScopeAutoSync] Initialized with ${status.syncedPoiCount} previously synced POIs`);
    }
  } catch (error) {
    logger.debug('[RoadScopeAutoSync] Failed to init state:', error);
  }
}
