/**
 * Firebase Auto-Sync Integration
 *
 * Manual-sync only — no automatic uploads happen in the background.
 * Data stays local until the user explicitly clicks "Save to Cloud".
 */

import { getLastSyncForSurvey, openSyncQueueDB } from './syncQueue';
import { initConnectivityMonitor, getConnectivityState } from './connectivityMonitor';
import { manualSyncNow } from './syncService';
import { openSurveyDB } from '../survey/db';
import { Survey } from '../survey/types';

async function markSurveyAsSynced(surveyId: string, type: string): Promise<void> {
  try {
    const surveyDb = await openSurveyDB();
    const survey = await surveyDb.get('surveys', surveyId);
    if (survey) {
      survey.cloudUploadStatus = 'synced';
      survey.lastSyncedAt = new Date().toISOString();
      await surveyDb.put('surveys', survey);
      console.log(`[AutoSync] ✅ Survey ${surveyId} marked as synced`);
    }

    const db = await openSyncQueueDB();
    await db.put('syncLog', {
      id: `log_${surveyId}_${Date.now()}`,
      surveyId,
      type,
      timestamp: Date.now(),
      success: true
    });

    const tx = db.transaction('queue', 'readwrite');
    const store = tx.objectStore('queue');
    const allItems = await store.getAll();
    for (const item of allItems) {
      if (item.surveyId === surveyId) {
        await store.delete(item.id);
        console.log(`[AutoSync] Removed completed queue item for survey ${surveyId}`);
      }
    }
    await tx.done;

  } catch (error) {
    console.error('[AutoSync] Failed to mark survey as synced:', error);
  }
}

let isInitialized = false;

export function initFirebaseAutoSync(): void {
  if (isInitialized) return;
  isInitialized = true;

  // Only initialise the connectivity monitor — auto-sync is disabled.
  // The sync service (and its event listeners) are NOT started here so that
  // no automatic uploads happen in the background.
  initConnectivityMonitor();

  console.log('[AutoSync] Connectivity monitor initialised (auto-sync disabled — manual save only)');
}

export async function onSurveyClose(_survey: Survey): Promise<void> {
  // Auto-sync on close is intentionally disabled.
  // Data stays local until the user explicitly clicks "Save to Cloud".
  console.log(`[AutoSync] Survey closed — auto-upload skipped (manual save only)`);
}

export async function onSurveyExport(_survey: Survey): Promise<void> {
  // Auto-sync on export is intentionally disabled.
  // Data stays local until the user explicitly clicks "Save to Cloud".
  console.log(`[AutoSync] Survey exported — auto-upload skipped (manual save only)`);
}

export async function syncSurveyNow(surveyId: string): Promise<boolean> {
  return manualSyncNow(surveyId);
}

export async function syncAllPending(): Promise<boolean> {
  return manualSyncNow();
}

export async function getSurveyLastSync(surveyId: string): Promise<Date | null> {
  const timestamp = await getLastSyncForSurvey(surveyId);
  return timestamp ? new Date(timestamp) : null;
}

export { getConnectivityState } from './connectivityMonitor';
export { isReadyForFirebaseSync } from './connectivityMonitor';
export { getQueueStats } from './syncQueue';
export { getSyncStatus } from './syncService';

export { markSurveyAsSynced };
