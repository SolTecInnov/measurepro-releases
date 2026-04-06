import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { getAuth } from 'firebase/auth';
import { useOnlineStatus } from './useOnlineStatus';
import { enqueuePendingAction, flushPendingActions, getPendingActionsForUser, getSessionCredential, PendingCompanyAction } from '../lib/companyOfflineStore';

/** Get the current user's Firebase ID token (or null if not signed in) */
async function getCurrentIdToken(): Promise<string | null> {
  try {
    const user = getAuth().currentUser;
    if (!user) return null;
    return await user.getIdToken();
  } catch {
    return null;
  }
}

/**
 * useOfflineQueue — wires the company offline action queue.
 * On reconnect, flushes all pending actions using a fresh auth token.
 */
export function useOfflineQueue() {
  const { isOnline } = useOnlineStatus();
  const wasOfflineRef = useRef(!isOnline);

  /** Flush the pending queue if online. Called both on mount and on reconnect. */
  const tryFlushQueue = async (silent = false) => {
    const token = await getCurrentIdToken();
    if (!token) {
      if (!silent) toast.warning('Cannot sync offline actions: not authenticated');
      return;
    }
    const currentUid = getAuth().currentUser?.uid;
    const pending = await getPendingActionsForUser(currentUid);
    if (pending.length === 0) return;
    // Check needs_input actions — those with session credentials will auto-replay
    const needsInputActions = pending.filter(a => a.status === 'needs_input');
    const canAutoReplay = needsInputActions.filter(a => getSessionCredential(a.id) !== null);
    const requiresManual = needsInputActions.filter(a => getSessionCredential(a.id) === null);
    if (!silent) {
      if (requiresManual.length > 0) {
        toast.info(`${requiresManual.length} queued action(s) need your input to complete`, {
          description: 'Open the Company Admin panel and use the "Pending Actions" section to complete them.',
          duration: 10000,
        });
      }
      if (canAutoReplay.length > 0) {
        toast.info(`Replaying ${canAutoReplay.length} credential action(s) from this session…`);
      }
    }
    await flushPendingActions(() => {
      toast.success('Offline changes synced', {
        description: 'Your queued company actions have been applied.',
      });
    }, token, currentUid);
  };

  // On mount: flush immediately if already online (handles page reload with pending queue)
  useEffect(() => {
    if (isOnline) {
      tryFlushQueue(true).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // On connectivity transition: flush when coming back online
  useEffect(() => {
    if (isOnline && wasOfflineRef.current) {
      tryFlushQueue(false).catch(() => {});
    }
    wasOfflineRef.current = !isOnline;
  }, [isOnline]);

  const enqueueOrExecute = async <T>(
    action: Omit<PendingCompanyAction, 'id' | 'timestamp' | 'status'>,
    executeOnline: () => Promise<T>
  ): Promise<{ queued: boolean; result?: T }> => {
    if (isOnline) {
      const result = await executeOnline();
      return { queued: false, result };
    } else {
      // enqueuePendingAction auto-tags with current user UID (cross-user replay protection)
      await enqueuePendingAction(action);
      return { queued: true };
    }
  };

  return { isOnline, enqueueOrExecute };
}

/**
 * useOnlineRequired — returns a wrapper that either executes the action online
 * or queues it offline with proper user feedback.
 *
 * For actions that require credentials (like password resets / new account creation),
 * pass `requiresOnline: true` to block offline usage with a clear message.
 *
 * Usage:
 *   const { executeAction } = useOnlineRequired();
 *   await executeAction({ type: 'delete_member', ... }, () => deleteMember(id));
 */
export function useOnlineRequired() {
  const { isOnline, enqueueOrExecute } = useOfflineQueue();

  const executeAction = async <T>(
    action: Omit<PendingCompanyAction, 'id' | 'timestamp' | 'status'>,
    onlineExecutor: () => Promise<T>,
    options?: { requiresOnline?: boolean; offlineMessage?: string }
  ): Promise<{ queued: boolean; result?: T; blocked?: boolean }> => {
    if (!isOnline && options?.requiresOnline) {
      toast.error(options.offlineMessage ?? 'This action requires an internet connection. Please reconnect and try again.');
      return { queued: false, blocked: true };
    }
    const outcome = await enqueueOrExecute(action, onlineExecutor);
    if (outcome.queued) {
      toast.info('Action queued — will sync when you reconnect');
    }
    return { ...outcome, blocked: false };
  };

  return { isOnline, executeAction };
}
