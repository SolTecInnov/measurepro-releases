/**
 * RoadScope Auto-Sync — time-based interval
 *
 * Periodically syncs the active survey to RoadScope so the office team can
 * start working on the data while the field operator is still in the field.
 *
 * This module replaces the previous count-based trigger (every 250 POIs).
 * The interval is read from the user's RoadScope settings (`syncInterval`,
 * interpreted as MINUTES, default 60).
 *
 * Files (photos, drawings) ARE included in the auto-sync — without them
 * the office team can't actually use the data. Users on cellular plans should
 * keep auto-sync disabled (it's OFF by default and the settings UI shows a
 * cellular-data warning when enabling).
 */

import { API_BASE_URL } from '@/lib/config/environment';
import { syncSurveyToRoadScope, getSyncStatus } from './syncService';
import { openSurveyDB } from '../survey/db';
import { useSurveyStore } from '../survey/store';
import { logger } from '../utils/logger';

// Interval limits in minutes — kept loose so the settings UI can offer
// 30 / 60 / 120 / 240 without server-side rejection.
const MIN_INTERVAL_MIN = 15;
const MAX_INTERVAL_MIN = 1440; // 24h
const DEFAULT_INTERVAL_MIN = 60;

// Per-survey lock — prevents the time-based timer and the AutoPart drain
// from running for the same survey simultaneously.
const syncInProgress: Map<string, boolean> = new Map();

// Singleton timer + currently-active config
let autoSyncTimer: number | null = null;
let activeUserId: string | null = null;
let activeIntervalMs: number | null = null;

interface RoadScopeSettings {
  hasApiKey: boolean;
  apiKeyValidated: boolean;
  autoSyncEnabled: boolean;
  syncInterval: number; // MINUTES (was seconds in pre-v16.1.19 builds)
}

/**
 * Read the user's RoadScope settings from the server.
 * Returns null if the call fails.
 */
async function readSettings(userId: string): Promise<RoadScopeSettings | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/roadscope/settings/${userId}`);
    const json = await res.json();
    if (json.success && json.data) {
      return json.data as RoadScopeSettings;
    }
    return null;
  } catch (error) {
    logger.debug('[RoadScopeAutoSync] Failed to read settings:', error);
    return null;
  }
}

/**
 * Fetch and set the user's RoadScope API key on the singleton client.
 * Returns true if a key was successfully loaded.
 */
async function ensureApiKeyLoaded(userId: string): Promise<boolean> {
  try {
    const { getRoadScopeClient } = await import('./client');
    const client = getRoadScopeClient();
    if (client.getApiKey()) return true;

    const res = await fetch(`${API_BASE_URL}/api/roadscope/settings/${userId}/key`);
    const json = await res.json();
    if (json.success && json.apiKey) {
      client.setApiKey(json.apiKey);
      return true;
    }
    return false;
  } catch (error) {
    logger.debug('[RoadScopeAutoSync] Failed to fetch API key:', error);
    return false;
  }
}

/**
 * Perform an auto-sync for a specific survey. This is the single shared code
 * path used by both the time-based timer AND the AutoPart drain — both routes
 * share the same in-progress lock so they can never overlap on the same survey.
 *
 * Includes files (photos) — without them the office team can't review the work.
 */
export async function performAutoSync(surveyId: string, userId: string): Promise<boolean> {
  if (syncInProgress.get(surveyId)) {
    logger.debug(`[RoadScopeAutoSync] Sync already in progress for ${surveyId}, skipping`);
    return false;
  }
  syncInProgress.set(surveyId, true);

  try {
    const db = await openSurveyDB();
    const survey = await db.get('surveys', surveyId);
    if (!survey) {
      logger.warn('[RoadScopeAutoSync] Survey not found:', surveyId);
      return false;
    }

    if (!(await ensureApiKeyLoaded(userId))) {
      logger.warn('[RoadScopeAutoSync] No API key available, skipping sync');
      return false;
    }

    // Reuse the existing roadscope survey id if this survey was previously synced
    const status = await getSyncStatus(surveyId);

    logger.log(`[RoadScopeAutoSync] Auto-syncing survey ${surveyId}`);

    const result = await syncSurveyToRoadScope(survey, {
      includeFiles: true, // Photos ARE included — office team needs them to work
      targetSurveyId: status?.roadscopeSurveyId,
      onProgress: (progress) => {
        logger.debug('[RoadScopeAutoSync] Progress:', progress.phase, progress.current, '/', progress.total);
      }
    });

    if (result.success) {
      logger.log(`[RoadScopeAutoSync] Synced ${result.poisSynced} POIs, ${result.filesSynced} files`);
    } else {
      logger.warn('[RoadScopeAutoSync] Sync incomplete:', result.errors);
    }
    return result.success;
  } catch (error) {
    logger.error('[RoadScopeAutoSync] Error during auto-sync:', error);
    return false;
  } finally {
    syncInProgress.set(surveyId, false);
  }
}

/**
 * Drain hook for AutoPartManager — call this RIGHT BEFORE closing a part to
 * push everything currently in the part to RoadScope. Best-effort: failures
 * are logged but never block the part transition (data stays safe in IndexedDB).
 */
export async function triggerAutoSyncForPartTransition(surveyId: string, userId: string): Promise<void> {
  if (!navigator.onLine) {
    logger.debug('[RoadScopeAutoSync] Skipping part-transition drain — offline');
    return;
  }
  // Even if the user has auto-sync OFF, part transitions still attempt a sync —
  // they're already a major checkpoint and the existing AutoPartManager has
  // always synced to RoadScope on close. We honor that contract.
  try {
    await performAutoSync(surveyId, userId);
  } catch (error) {
    logger.warn('[RoadScopeAutoSync] Part-transition drain failed (non-blocking):', error);
  }
}

/**
 * The interval tick: read the active survey from the store, check that
 * auto-sync is still enabled, then run a sync if there's anything to do.
 * Silent on failure — auto-sync errors must never spam toasts.
 */
async function autoSyncTick(): Promise<void> {
  // PERF: Defer to idle callback so sync never competes with active POI logging.
  // requestIdleCallback yields to higher-priority work (IndexedDB writes, UI).
  const runSync = async () => {
    try {
      if (!activeUserId) return;
      if (!navigator.onLine) {
        logger.debug('[RoadScopeAutoSync] Tick skipped — offline');
        return;
      }

      // Re-check settings each tick so a user toggling auto-sync OFF mid-day
      // takes effect on the next tick without requiring an app restart.
      const settings = await readSettings(activeUserId);
      if (!settings || !settings.autoSyncEnabled || !settings.apiKeyValidated) {
        logger.debug('[RoadScopeAutoSync] Tick skipped — auto-sync disabled or key not validated');
        return;
      }

      const activeSurvey = useSurveyStore.getState().activeSurvey;
      if (!activeSurvey) {
        logger.debug('[RoadScopeAutoSync] Tick skipped — no active survey');
        return;
      }

      await performAutoSync(activeSurvey.id, activeUserId);
    } catch (error) {
      logger.warn('[RoadScopeAutoSync] Tick error (non-blocking):', error);
    }
  };

  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(() => { runSync(); }, { timeout: 30000 });
  } else {
    setTimeout(runSync, 100);
  }
}

/**
 * Start the periodic auto-sync timer for a user. Safe to call multiple times —
 * if the timer is already running with the same interval, this is a no-op.
 * Reads the user's settings to determine the interval.
 */
export async function startRoadScopeAutoSyncTimer(userId: string): Promise<void> {
  const settings = await readSettings(userId);
  if (!settings || !settings.autoSyncEnabled) {
    logger.debug('[RoadScopeAutoSync] Not starting timer — auto-sync disabled in settings');
    stopRoadScopeAutoSyncTimer();
    return;
  }

  // syncInterval is interpreted as MINUTES in v16.1.19+. Older builds stored
  // it as seconds (30-600); those values fall well below the 15-minute minimum
  // and would clamp to MIN_INTERVAL_MIN, which is the safest fallback.
  const intervalMinutes = Math.max(
    MIN_INTERVAL_MIN,
    Math.min(MAX_INTERVAL_MIN, settings.syncInterval ?? DEFAULT_INTERVAL_MIN)
  );
  const intervalMs = intervalMinutes * 60 * 1000;

  // Already running with the same config? No-op.
  if (autoSyncTimer !== null && activeUserId === userId && activeIntervalMs === intervalMs) {
    return;
  }

  // Reconfigure: clear any existing timer first
  stopRoadScopeAutoSyncTimer();

  activeUserId = userId;
  activeIntervalMs = intervalMs;
  autoSyncTimer = window.setInterval(autoSyncTick, intervalMs);
  logger.log(`[RoadScopeAutoSync] Timer started — every ${intervalMinutes} minutes for user ${userId}`);
}

/**
 * Stop the periodic timer. Safe to call when no timer is running.
 */
export function stopRoadScopeAutoSyncTimer(): void {
  if (autoSyncTimer !== null) {
    window.clearInterval(autoSyncTimer);
    autoSyncTimer = null;
    activeIntervalMs = null;
    logger.log('[RoadScopeAutoSync] Timer stopped');
  }
}

/**
 * App-boot initializer: starts the timer if a user is logged in AND auto-sync
 * is enabled in their saved settings. Called once from main.tsx.
 */
export async function initRoadScopeAutoSync(): Promise<void> {
  const userId = localStorage.getItem('current_user_id');
  if (!userId) {
    logger.debug('[RoadScopeAutoSync] No userId at boot — timer will be started after login');
    return;
  }
  await startRoadScopeAutoSyncTimer(userId);
}
