/**
 * Firebase Sync Diagnostic — DevTools-callable
 *
 * Exposes the Firebase sync internals on window.__measurePro.firebaseSync so
 * the queue can be inspected and triggered from the DevTools console without
 * needing UI clicks. Read-only by default; the action verbs (processQueue,
 * syncNow) call the same code paths the UI already calls — they do not bypass
 * any guards.
 *
 * Why a window global instead of an Electron IPC handler:
 *   The Firebase sync service runs entirely in the renderer process (uses the
 *   Firebase Web SDK + IndexedDB). DevTools also runs in the renderer, so a
 *   window global is the natural surface — no IPC bridge needed. Adding an
 *   IPC layer would just shuttle calls from renderer→main→renderer for no
 *   reason.
 *
 * Usage from DevTools console:
 *   await __measurePro.firebaseSync.help()
 *   await __measurePro.firebaseSync.stats()
 *   await __measurePro.firebaseSync.status()
 *   await __measurePro.firebaseSync.surveys()
 *   await __measurePro.firebaseSync.processQueue()
 *   await __measurePro.firebaseSync.syncNow('survey-id-here')
 */

import { firebaseSyncService, manualSyncNow } from '../firebase/syncService';
import {
  getQueueStats,
  getPendingItems,
  getLastSyncForSurvey,
} from '../firebase/syncQueue';
import { getConnectivityState } from '../firebase/connectivityMonitor';
import { openSurveyDB } from '../survey/db';

interface FirebaseSyncDiagnosticAPI {
  help: () => void;
  stats: () => Promise<void>;
  status: () => Promise<void>;
  pending: () => Promise<void>;
  surveys: () => Promise<void>;
  connectivity: () => void;
  lastSync: (surveyId: string) => Promise<void>;
  processQueue: () => Promise<void>;
  syncNow: (surveyId?: string) => Promise<boolean>;
}

declare global {
  interface Window {
    __measurePro?: {
      firebaseSync?: FirebaseSyncDiagnosticAPI;
    };
  }
}

const HELP_TEXT = `
Firebase Sync Diagnostic — DevTools commands

  __measurePro.firebaseSync.help()         show this help
  __measurePro.firebaseSync.stats()        queue counts (pending/inflight/failed/completed)
  __measurePro.firebaseSync.status()       full status: queue + connectivity + isProcessing
  __measurePro.firebaseSync.pending()      list pending queue items in a table
  __measurePro.firebaseSync.surveys()      list local surveys with cloudUploadStatus + lastSyncedAt
  __measurePro.firebaseSync.connectivity() current online/auth/firebase reachable state
  __measurePro.firebaseSync.lastSync(id)   last successful sync time for a survey
  __measurePro.firebaseSync.processQueue() manually trigger queue processing (no toasts)
  __measurePro.firebaseSync.syncNow(id?)   sync one survey by id, or all pending if no id

  All commands return Promises — use 'await' in DevTools.
`;

function logHelp(): void {
  console.info(HELP_TEXT);
}

async function logStats(): Promise<void> {
  const stats = await getQueueStats();
  console.table(stats);
}

async function logStatus(): Promise<void> {
  const status = await firebaseSyncService.getStatus();
  console.group('[firebaseSync.status]');
  console.log('isProcessing:', status.isProcessing);
  console.log('queue:');
  console.table(status.queueStats);
  console.log('connectivity:');
  console.table(status.connectivity);
  console.groupEnd();
}

async function logPending(): Promise<void> {
  const items = await getPendingItems();
  if (items.length === 0) {
    console.info('[firebaseSync.pending] queue is empty');
    return;
  }
  console.table(
    items.map((i) => ({
      id: i.id,
      surveyId: i.surveyId,
      title: i.payloadMeta.surveyTitle,
      type: i.type,
      status: i.status,
      attempts: `${i.attempts}/${i.maxAttempts}`,
      poiCount: i.payloadMeta.poiCount,
      lastError: i.lastError ?? '',
      createdAt: new Date(i.createdAt).toISOString(),
      lastTriedAt: i.lastTriedAt ? new Date(i.lastTriedAt).toISOString() : null,
    }))
  );
}

async function logSurveys(): Promise<void> {
  const db = await openSurveyDB();
  const all = (await db.getAll('surveys')) as Array<Record<string, unknown>>;
  if (all.length === 0) {
    console.info('[firebaseSync.surveys] no local surveys');
    return;
  }
  console.table(
    all.map((s) => ({
      id: s.id,
      title: s.surveyTitle ?? s.name ?? '',
      cloudUploadStatus: s.cloudUploadStatus ?? 'local-only',
      lastSyncedAt: s.lastSyncedAt ?? '',
      closedAt: s.closedAt ?? '',
    }))
  );
}

function logConnectivity(): void {
  console.table(getConnectivityState());
}

async function logLastSync(surveyId: string): Promise<void> {
  if (!surveyId) {
    console.warn('[firebaseSync.lastSync] surveyId required');
    return;
  }
  const ts = await getLastSyncForSurvey(surveyId);
  if (ts === null) {
    console.info(`[firebaseSync.lastSync] no successful sync recorded for ${surveyId}`);
  } else {
    console.info(
      `[firebaseSync.lastSync] ${surveyId} → ${new Date(ts).toISOString()} (${ts})`
    );
  }
}

async function runProcessQueue(): Promise<void> {
  console.info('[firebaseSync.processQueue] starting…');
  await firebaseSyncService.processQueue();
  console.info('[firebaseSync.processQueue] done');
  await logStats();
}

async function runSyncNow(surveyId?: string): Promise<boolean> {
  console.info(`[firebaseSync.syncNow] ${surveyId ?? '(all pending)'}`);
  const ok = await manualSyncNow(surveyId);
  console.info(`[firebaseSync.syncNow] result: ${ok}`);
  return ok;
}

export function installFirebaseSyncDiagnostic(): void {
  if (typeof window === 'undefined') return;

  const api: FirebaseSyncDiagnosticAPI = {
    help: logHelp,
    stats: logStats,
    status: logStatus,
    pending: logPending,
    surveys: logSurveys,
    connectivity: logConnectivity,
    lastSync: logLastSync,
    processQueue: runProcessQueue,
    syncNow: runSyncNow,
  };

  window.__measurePro = window.__measurePro ?? {};
  window.__measurePro.firebaseSync = api;

  console.info(
    '%c[Diagnostic] Firebase sync diagnostic ready — try __measurePro.firebaseSync.help()',
    'color: #00ff88; font-weight: bold'
  );
}
