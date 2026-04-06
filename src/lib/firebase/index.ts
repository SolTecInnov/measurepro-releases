/**
 * Firebase Module Exports
 * 
 * Centralized exports for all Firebase-related functionality.
 */

export {
  initFirebaseAutoSync,
  onSurveyClose,
  onSurveyExport,
  syncSurveyNow,
  syncAllPending,
  getSurveyLastSync,
  getConnectivityState,
  isReadyForFirebaseSync,
  getQueueStats,
  getSyncStatus
} from './autoSync';

export {
  enqueueFirebaseSync,
  getPendingItems,
  getLastSyncForSurvey
} from './syncQueue';
export type { SyncQueueItem } from './syncQueue';

export {
  connectivityMonitor,
  initConnectivityMonitor
} from './connectivityMonitor';
export type { ConnectivityState } from './connectivityMonitor';

export {
  firebaseSyncService,
  initFirebaseSyncService,
  manualSyncNow
} from './syncService';
