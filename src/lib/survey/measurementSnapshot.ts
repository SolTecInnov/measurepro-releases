/**
 * DEPRECATED: Snapshot-based loading has been replaced with direct IndexedDB cursor queries
 * This file provides compatibility stubs for existing code that still references these functions
 */

/**
 * @deprecated - Activity Log now reads directly from IndexedDB, version tracking is unnecessary
 */
export async function incrementPersistedVersion(surveyId: string): Promise<void> {
  // NO-OP: Version tracking removed in favor of direct IndexedDB reads
}

/**
 * @deprecated - Activity Log now reloads via 'dbchange' event instead of snapshot invalidation
 */
export function invalidateSnapshot(surveyId: string): void {
  // NO-OP: Snapshot invalidation system removed, using 'dbchange' events instead
}

// Event target for backward compatibility (unused by simplified Activity Log)
export const snapshotEvents = new EventTarget();
