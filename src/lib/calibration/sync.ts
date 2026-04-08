// Stub — original deleted during orphan cleanup
export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error' | 'offline';
export interface SyncState { status: SyncStatus; lastSync: string | null; error: string | null; }
export interface ConflictItem { id: string; field: string; localValue: any; remoteValue: any; }
export const calibrationSync = { getState: () => ({ status: 'idle' as SyncStatus, lastSync: null, error: null }), sync: async () => {}, resolve: async () => {} };
