/**
 * Firebase Sync Queue
 * 
 * Manages offline-first sync queue for surveys to Firebase.
 * Queue items are persisted in IndexedDB and processed when online.
 */

import { openDB, IDBPDatabase } from 'idb';

export interface SyncQueueItem {
  id: string;
  surveyId: string;
  type: 'survey_close' | 'survey_export' | 'survey_update';
  status: 'pending' | 'inflight' | 'failed' | 'completed';
  createdAt: number;
  lastTriedAt: number | null;
  attempts: number;
  maxAttempts: number;
  lastError: string | null;
  payloadMeta: {
    surveyTitle: string;
    poiCount: number;
    hasMedia: boolean;
  };
}

const SYNC_QUEUE_DB_NAME = 'firebase-sync-queue';
const SYNC_QUEUE_DB_VERSION = 1;

let dbInstance: IDBPDatabase | null = null;

export async function openSyncQueueDB(): Promise<IDBPDatabase> {
  if (dbInstance) {
    return dbInstance;
  }

  dbInstance = await openDB(SYNC_QUEUE_DB_NAME, SYNC_QUEUE_DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('queue')) {
        const store = db.createObjectStore('queue', { keyPath: 'id' });
        store.createIndex('by-status', 'status');
        store.createIndex('by-surveyId', 'surveyId');
        store.createIndex('by-createdAt', 'createdAt');
      }
      
      if (!db.objectStoreNames.contains('syncLog')) {
        const logStore = db.createObjectStore('syncLog', { keyPath: 'id' });
        logStore.createIndex('by-surveyId', 'surveyId');
        logStore.createIndex('by-timestamp', 'timestamp');
      }
    }
  });

  return dbInstance;
}

export async function enqueueFirebaseSync(
  surveyId: string,
  type: SyncQueueItem['type'],
  payloadMeta: SyncQueueItem['payloadMeta']
): Promise<string> {
  const db = await openSyncQueueDB();
  
  const existingItems = await db.getAllFromIndex('queue', 'by-surveyId', surveyId);
  const pendingOrInflight = existingItems.filter(
    item => (item.status === 'pending' || item.status === 'inflight') && item.type === type
  );
  
  if (pendingOrInflight.length > 0) {
    console.log(`[SyncQueue] Survey ${surveyId} already queued for ${type}, skipping duplicate`);
    return pendingOrInflight[0].id;
  }

  const queueItem: SyncQueueItem = {
    id: `sync_${surveyId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    surveyId,
    type,
    status: 'pending',
    createdAt: Date.now(),
    lastTriedAt: null,
    attempts: 0,
    maxAttempts: 5,
    lastError: null,
    payloadMeta
  };

  await db.put('queue', queueItem);
  console.log(`[SyncQueue] Enqueued ${type} for survey ${surveyId}`, queueItem.id);
  
  window.dispatchEvent(new CustomEvent('firebase-sync-queue-updated', {
    detail: { action: 'enqueue', item: queueItem }
  }));

  return queueItem.id;
}

export async function getPendingItems(): Promise<SyncQueueItem[]> {
  const db = await openSyncQueueDB();
  const pending = await db.getAllFromIndex('queue', 'by-status', 'pending');
  const failed = await db.getAllFromIndex('queue', 'by-status', 'failed');
  
  const retriable = failed.filter(item => {
    if (item.attempts >= item.maxAttempts) return false;
    
    const backoffMs = getBackoffMs(item.attempts);
    const nextRetryAt = (item.lastTriedAt || 0) + backoffMs;
    return Date.now() >= nextRetryAt;
  });

  return [...pending, ...retriable].sort((a, b) => a.createdAt - b.createdAt);
}

export async function getQueueStats(): Promise<{
  pending: number;
  inflight: number;
  failed: number;
  completed: number;
  total: number;
}> {
  const db = await openSyncQueueDB();
  
  const pending = await db.countFromIndex('queue', 'by-status', 'pending');
  const inflight = await db.countFromIndex('queue', 'by-status', 'inflight');
  const failed = await db.countFromIndex('queue', 'by-status', 'failed');
  const completed = await db.countFromIndex('queue', 'by-status', 'completed');

  return {
    pending,
    inflight,
    failed,
    completed,
    total: pending + inflight + failed + completed
  };
}

export async function markItemInflight(itemId: string): Promise<void> {
  const db = await openSyncQueueDB();
  const item = await db.get('queue', itemId);
  
  if (item) {
    item.status = 'inflight';
    item.lastTriedAt = Date.now();
    item.attempts += 1;
    await db.put('queue', item);
  }
}

export async function markItemCompleted(itemId: string): Promise<void> {
  const db = await openSyncQueueDB();
  const item = await db.get('queue', itemId);
  
  if (item) {
    // 1. Update the survey's cloudUploadStatus in the survey database
    try {
      const { openSurveyDB } = await import('../survey/db');
      const surveyDb = await openSurveyDB();
      const survey = await surveyDb.get('surveys', item.surveyId);
      if (survey) {
        survey.cloudUploadStatus = 'synced';
        survey.lastSyncedAt = new Date().toISOString();
        await surveyDb.put('surveys', survey);
        console.log(`[SyncQueue] ✅ Survey ${item.surveyId} cloudUploadStatus updated to 'synced'`);
      }
    } catch (err) {
      console.error('[SyncQueue] Failed to update survey cloudUploadStatus:', err);
    }
    
    // 2. Delete the queue item instead of leaving it completed
    // This keeps the queue clean and prevents confusion
    await db.delete('queue', itemId);
    console.log(`[SyncQueue] Removed completed queue item ${itemId}`);
    
    // 3. Write to sync log for tracking
    await db.put('syncLog', {
      id: `log_${item.surveyId}_${Date.now()}`,
      surveyId: item.surveyId,
      type: item.type,
      timestamp: Date.now(),
      success: true
    });
    
    window.dispatchEvent(new CustomEvent('firebase-sync-queue-updated', {
      detail: { action: 'completed', item }
    }));
  }
}

export async function markItemFailed(itemId: string, error: string): Promise<void> {
  const db = await openSyncQueueDB();
  const item = await db.get('queue', itemId);
  
  if (item) {
    item.status = 'failed';
    item.lastError = error;
    await db.put('queue', item);
    
    window.dispatchEvent(new CustomEvent('firebase-sync-queue-updated', {
      detail: { action: 'failed', item, error }
    }));
  }
}

export async function removeCompletedItems(olderThanMs: number = 24 * 60 * 60 * 1000): Promise<number> {
  const db = await openSyncQueueDB();
  const completed = await db.getAllFromIndex('queue', 'by-status', 'completed');
  const cutoff = Date.now() - olderThanMs;
  
  let removedCount = 0;
  for (const item of completed) {
    if (item.createdAt < cutoff) {
      await db.delete('queue', item.id);
      removedCount++;
    }
  }

  return removedCount;
}

export async function getLastSyncForSurvey(surveyId: string): Promise<number | null> {
  const db = await openSyncQueueDB();
  const logs = await db.getAllFromIndex('syncLog', 'by-surveyId', surveyId);
  
  if (logs.length === 0) return null;
  
  const successfulLogs = logs.filter(log => log.success);
  if (successfulLogs.length === 0) return null;
  
  return Math.max(...successfulLogs.map(log => log.timestamp));
}

function getBackoffMs(attempts: number): number {
  const backoffs = [60000, 300000, 900000, 1800000, 3600000];
  return backoffs[Math.min(attempts, backoffs.length - 1)];
}
