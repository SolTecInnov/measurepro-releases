// Stub — original deleted during orphan cleanup
export const SYNC_INTERVAL_MS = 150000;
export async function syncEventBatch(_memberName: string, _sessionId: string): Promise<void> {}
export function processSyncAcknowledgment(_eventIds: string[]): void {}
export async function retryFailedSyncs(_memberName: string, _sessionId: string): Promise<void> {}
export async function performPeriodicSync(_memberName: string, _sessionId: string): Promise<void> {}
export async function immediateSync(_memberName: string, _sessionId: string): Promise<void> {}
export function getSyncStats(): { pending: number; failed: number; synced: number } { return { pending: 0, failed: 0, synced: 0 }; }
