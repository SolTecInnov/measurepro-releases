import type { ConvoyBlackBoxEvent } from '@shared/schema';
import { getUnsyncedEvents, updateEventsSyncStatus, getCurrentMemberId } from './eventLogger';
import { useConvoyStore } from '@/lib/stores/convoyStore';

// Sync configuration
export const SYNC_INTERVAL_MS = 150000; // 2.5 minutes
const RETRY_DELAYS_MS = [30000, 60000, 120000, 300000]; // 30s, 1m, 2m, 5m
const MAX_BATCH_SIZE = 100; // Limit events per sync
const MAX_RETRIES = 4; // After 4 retries, give up
const ACK_TIMEOUT_MS = 10000; // 10 seconds timeout for acknowledgment

// CRITICAL FIX: Track pending acknowledgments to detect leader offline
// Maps eventIds key (sorted, comma-joined) to timeout ID
const pendingTimeouts = new Map<string, NodeJS.Timeout>();

/**
 * Sync a batch of events to the leader
 */
export async function syncEventBatch(
  events: ConvoyBlackBoxEvent[],
  memberName: string,
  sessionId: string
): Promise<{ success: boolean; syncedEventIds: string[] }> {
  try {
    const { ws, connected } = useConvoyStore.getState();
    
    if (!ws || !connected) {
      return { success: false, syncedEventIds: [] };
    }

    // Limit batch size
    const batch = events.slice(0, MAX_BATCH_SIZE);
    const eventIds = batch.map(e => e.id);

    // BUG FIX: Update lastSyncAttempt timestamp BEFORE sending
    // This ensures exponential backoff works properly by tracking when we last attempted to send
    updateEventsSyncStatus(eventIds, 'local', false);

    // Send via WebSocket
    // Use convoy-assigned member ID for proper acknowledgment routing
    const convoyMemberId = useConvoyStore.getState().myMemberId || getCurrentMemberId();
    
    const message = {
      type: 'log_sync_batch',
      sessionId,
      data: {
        memberId: convoyMemberId,
        memberName,
        events: batch,
        timestamp: Date.now(),
      },
      timestamp: Date.now(),
      senderId: convoyMemberId,
    };

    ws.send(JSON.stringify(message));

    // CRITICAL FIX: Set timeout to detect if leader never acknowledges
    // This fixes the issue where ws.send() succeeds even if leader is offline
    const eventIdsKey = eventIds.sort().join(',');
    
    const timeoutId = setTimeout(() => {
      // Check if these events are still in 'local' status after timeout
      const stillUnsynced = getUnsyncedEvents().filter(e => 
        eventIds.includes(e.id) && e.syncStatus === 'local'
      );
      
      if (stillUnsynced.length > 0) {
        const failedIds = stillUnsynced.map(e => e.id);
        updateEventsSyncStatus(failedIds, 'failed', true);
      }
      
      // Remove from pending map
      pendingTimeouts.delete(eventIdsKey);
    }, ACK_TIMEOUT_MS);

    // Track this pending acknowledgment
    pendingTimeouts.set(eventIdsKey, timeoutId);

    return { success: true, syncedEventIds: eventIds };
  } catch (error) {
    return { success: false, syncedEventIds: [] };
  }
}

/**
 * Process sync acknowledgment from leader
 */
export function processSyncAcknowledgment(eventIds: string[]): void {
  try {
    // CRITICAL FIX: Clear timeout when acknowledgment is received
    // This prevents false timeouts when leader is online and responding
    const eventIdsKey = eventIds.sort().join(',');
    if (pendingTimeouts.has(eventIdsKey)) {
      clearTimeout(pendingTimeouts.get(eventIdsKey)!);
      pendingTimeouts.delete(eventIdsKey);
    }
    
    updateEventsSyncStatus(eventIds, 'synced', false);
  } catch (error) {
  }
}

/**
 * Retry failed syncs with exponential backoff
 */
export async function retryFailedSyncs(memberName: string, sessionId: string): Promise<void> {
  try {
    const unsyncedEvents = getUnsyncedEvents();
    const failedEvents = unsyncedEvents.filter(e => e.syncStatus === 'failed');
    
    if (failedEvents.length === 0) {
      return;
    }

    // Group by retry count to apply appropriate backoff
    const eventsToRetry: ConvoyBlackBoxEvent[] = [];
    const eventIdsToGiveUp: string[] = [];

    for (const event of failedEvents) {
      const retries = event.syncRetries || 0;
      
      // Give up after max retries
      if (retries >= MAX_RETRIES) {
        eventIdsToGiveUp.push(event.id);
        continue;
      }

      // BUG FIX: Use retries-1 as index for delay calculation
      // This ensures proper backoff intervals: 30s after 1st failure, 60s after 2nd, etc.
      const delayIndex = Math.max(0, retries - 1);
      const delay = RETRY_DELAYS_MS[Math.min(delayIndex, RETRY_DELAYS_MS.length - 1)];
      const timeSinceLastAttempt = Date.now() - (event.lastSyncAttempt || 0);
      
      if (timeSinceLastAttempt >= delay) {
        eventsToRetry.push(event);
      }
    }

    // Mark events that have exceeded max retries
    if (eventIdsToGiveUp.length > 0) {
      // Keep them as 'failed' but don't retry anymore
    }

    // Retry eligible events
    if (eventsToRetry.length > 0) {
      const result = await syncEventBatch(eventsToRetry, memberName, sessionId);
      
      if (result.success) {
        // Events will be marked as synced when acknowledgment is received
      } else {
        // Mark as failed with incremented retry count
        const eventIds = eventsToRetry.map(e => e.id);
        updateEventsSyncStatus(eventIds, 'failed', true);
      }
    }
  } catch (error) {
  }
}

/**
 * Perform periodic sync of all unsynced events
 */
export async function performPeriodicSync(memberName: string, sessionId: string): Promise<void> {
  try {
    const unsyncedEvents = getUnsyncedEvents();
    const localEvents = unsyncedEvents.filter(e => e.syncStatus === 'local');
    
    if (localEvents.length === 0) {
      return;
    }
    
    const result = await syncEventBatch(localEvents, memberName, sessionId);
    
    if (!result.success) {
      // Mark as failed with retry count
      const eventIds = localEvents.map(e => e.id);
      updateEventsSyncStatus(eventIds, 'failed', true);
    }
  } catch (error) {
  }
}

/**
 * Immediately sync high-severity events (emergency/alert)
 */
export async function immediateSync(
  event: ConvoyBlackBoxEvent,
  memberName: string,
  sessionId: string
): Promise<void> {
  try {
    // Check if this is a high-severity event
    const isHighSeverity = 
      event.eventCategory === 'emergency' || 
      event.eventCategory === 'alert' ||
      (event.eventCategory === 'measurement' && event.payload?.alertLevel);

    if (!isHighSeverity) {
      return; // Not high-severity, will be synced in periodic batch
    }
    
    const result = await syncEventBatch([event], memberName, sessionId);
    
    if (!result.success) {
      updateEventsSyncStatus([event.id], 'failed', true);
    }
  } catch (error) {
  }
}

/**
 * Get sync statistics
 */
export function getSyncStats(): {
  total: number;
  local: number;
  synced: number;
  failed: number;
  lastSyncTime: number | null;
} {
  try {
    const allEvents = getUnsyncedEvents();
    const stats = {
      total: allEvents.length,
      local: allEvents.filter(e => e.syncStatus === 'local').length,
      synced: 0, // unsynced events don't include synced ones
      failed: allEvents.filter(e => e.syncStatus === 'failed').length,
      lastSyncTime: null as number | null,
    };

    // Find most recent sync attempt
    if (allEvents.length > 0) {
      const mostRecent = allEvents.reduce((latest, event) => {
        const eventTime = event.lastSyncAttempt || 0;
        return eventTime > (latest || 0) ? eventTime : latest;
      }, null as number | null);
      stats.lastSyncTime = mostRecent;
    }

    return stats;
  } catch (error) {
    return { total: 0, local: 0, synced: 0, failed: 0, lastSyncTime: null };
  }
}
