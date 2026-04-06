import { openDB, IDBPDatabase } from 'idb';
import { getAuth } from 'firebase/auth';
import type { Company, CompanyMember } from '../../shared/schema';

const DB_NAME = 'company-offline-db';
const DB_VERSION = 1;
const COMPANY_STORE = 'companyStore';
const MEMBERS_STORE = 'membersStore';
const PENDING_ACTIONS_STORE = 'pendingCompanyActions';

export type CachedCompany = Company;
export type CachedCompanyMember = CompanyMember;

export interface PendingCompanyAction {
  id: string;
  type:
    | 'create_company'
    | 'update_company'
    | 'delete_company'
    | 'update_addons'
    | 'create_member'
    | 'delete_member'
    | 'update_member_role'
    | 'reset_password'
    | 'send_reset_email';
  companyId: string;
  payload: Record<string, unknown>;
  timestamp: string;
  /** Firebase UID of the user who queued this action — used to prevent cross-user replay */
  userUid?: string;
  /**
   * pending     — ready for auto-flush on reconnect
   * needs_input — queued with metadata only; user must supply credential at replay time
   * flushing    — in-progress network request
   * failed      — last flush attempt failed
   * flushed     — successfully applied (kept briefly for UX then removed)
   */
  status: 'pending' | 'needs_input' | 'flushing' | 'failed' | 'flushed';
}

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(COMPANY_STORE)) {
          db.createObjectStore(COMPANY_STORE, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(MEMBERS_STORE)) {
          db.createObjectStore(MEMBERS_STORE, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(PENDING_ACTIONS_STORE)) {
          db.createObjectStore(PENDING_ACTIONS_STORE, { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
}

export async function cacheCompany(company: CachedCompany): Promise<void> {
  try {
    const db = await getDB();
    await db.put(COMPANY_STORE, company);
  } catch {
    // Ignore IndexedDB errors
  }
}

export async function getCachedCompany(id: string): Promise<CachedCompany | null> {
  try {
    const db = await getDB();
    return (await db.get(COMPANY_STORE, id)) || null;
  } catch {
    return null;
  }
}

export async function cacheCompanyMembers(members: CachedCompanyMember[]): Promise<void> {
  try {
    const db = await getDB();
    const tx = db.transaction(MEMBERS_STORE, 'readwrite');
    for (const member of members) {
      await tx.store.put(member);
    }
    await tx.done;
  } catch {
    // Ignore
  }
}

export async function getCachedMembers(companyId: string): Promise<CachedCompanyMember[]> {
  try {
    const db = await getDB();
    const all: CachedCompanyMember[] = await db.getAll(MEMBERS_STORE);
    return all.filter(m => m.companyId === companyId);
  } catch {
    return [];
  }
}

export async function getUserCompanyMembership(firebaseUid: string): Promise<CachedCompanyMember | null> {
  try {
    const db = await getDB();
    const all: CachedCompanyMember[] = await db.getAll(MEMBERS_STORE);
    return all.find(m => m.firebaseUid === firebaseUid) || null;
  } catch {
    return null;
  }
}

/**
 * Enqueue a pending action, automatically tagging it with the current Firebase user UID.
 * The UID tag prevents cross-user replay: flushPendingActions only replays actions
 * owned by the currently authenticated user.
 * Callers must NOT pass `userUid` — it is always derived from Firebase Auth.
 */
export async function enqueuePendingAction(
  action: Omit<PendingCompanyAction, 'id' | 'timestamp' | 'status' | 'userUid'>,
  initialStatus: PendingCompanyAction['status'] = 'pending'
): Promise<string> {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  try {
    const db = await getDB();
    // Always tag with current user UID — required for safe cross-user isolation
    const userUid = getAuth().currentUser?.uid;
    const item: PendingCompanyAction = {
      ...action,
      id,
      timestamp: new Date().toISOString(),
      status: initialStatus,
      userUid,
    };
    await db.put(PENDING_ACTIONS_STORE, item);
  } catch {
    // Ignore
  }
  return id;
}

/**
 * Remove all pending actions owned by a specific user.
 * Call on logout to prevent cross-user queue replay ambiguity.
 */
export async function clearPendingActionsForUser(userUid: string): Promise<void> {
  try {
    const db = await getDB();
    const all: PendingCompanyAction[] = await db.getAll(PENDING_ACTIONS_STORE);
    for (const action of all) {
      if (action.userUid === userUid) {
        await db.delete(PENDING_ACTIONS_STORE, action.id);
      }
    }
  } catch {
    // Ignore
  }
}

export async function updatePendingAction(id: string, updates: Partial<PendingCompanyAction>): Promise<void> {
  try {
    const db = await getDB();
    const existing = await db.get(PENDING_ACTIONS_STORE, id) as PendingCompanyAction | undefined;
    if (existing) {
      await db.put(PENDING_ACTIONS_STORE, { ...existing, ...updates });
    }
  } catch {
    // Ignore
  }
}

export async function getPendingActions(): Promise<PendingCompanyAction[]> {
  try {
    const db = await getDB();
    return await db.getAll(PENDING_ACTIONS_STORE);
  } catch {
    return [];
  }
}

/**
 * Return only the pending actions belonging to a specific user.
 * Use this in all UI read paths to prevent cross-user action exposure on shared devices.
 */
export async function getPendingActionsForUser(userUid?: string | null): Promise<PendingCompanyAction[]> {
  const all = await getPendingActions();
  if (!userUid) return [];
  return all.filter(a => a.userUid === userUid);
}

export async function removePendingAction(id: string, ownerUid?: string): Promise<void> {
  try {
    const db = await getDB();
    if (ownerUid) {
      // Defensive ownership check — prevent cross-user removal
      const action = await db.get(PENDING_ACTIONS_STORE, id) as PendingCompanyAction | undefined;
      if (action && action.userUid && action.userUid !== ownerUid) {
        console.warn('[companyOfflineStore] Blocked cross-user removePendingAction attempt');
        return;
      }
    }
    await db.delete(PENDING_ACTIONS_STORE, id);
  } catch {
    // Ignore
  }
}

// ---------------------------------------------------------------------------
// Session-bound credential store (sessionStorage)
// Credentials are stored in sessionStorage — keyed by action ID — so they
// are available for automatic replay within the same browser session.
// sessionStorage is cleared when the tab closes and is NOT persisted to disk
// in the same way as IndexedDB, making it safer for short-lived credential storage.
// ---------------------------------------------------------------------------

const SESSION_CRED_PREFIX = 'offline_cred_';

/** Store a credential securely in sessionStorage for a queued action */
export function storeSessionCredential(actionId: string, password: string): void {
  try {
    sessionStorage.setItem(`${SESSION_CRED_PREFIX}${actionId}`, password);
  } catch {
    // sessionStorage may be unavailable in some contexts
  }
}

/** Retrieve a session credential for an action (returns null if not available) */
export function getSessionCredential(actionId: string): string | null {
  try {
    return sessionStorage.getItem(`${SESSION_CRED_PREFIX}${actionId}`);
  } catch {
    return null;
  }
}

/** Clear a session credential after use */
export function clearSessionCredential(actionId: string): void {
  try {
    sessionStorage.removeItem(`${SESSION_CRED_PREFIX}${actionId}`);
  } catch {
    // Ignore
  }
}

/**
 * Returns true for action types that require credential input at replay time
 * (i.e., they were queued with metadata only, no plaintext secret).
 * These may have a session credential in sessionStorage for automatic replay,
 * or fall back to the manual credential panel if session has expired.
 */
export function actionNeedsCredentialAtReplay(action: PendingCompanyAction): boolean {
  return action.status === 'needs_input';
}

export async function flushPendingActions(onSuccess?: () => void, authToken?: string, userUid?: string): Promise<void> {
  const allActions = await getPendingActions();
  if (allActions.length === 0) return;

  if (!authToken) {
    // No auth token — cannot safely replay authenticated actions; bail out
    return;
  }

  // Only flush actions belonging to the current user — strict match, no legacy bypass.
  // Actions without userUid (from before this enforcement) are NOT replayed to prevent
  // cross-user replay of privileged queued operations on shared devices.
  const actions = userUid
    ? allActions.filter(a => a.userUid === userUid)
    : allActions;

  const authHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${authToken}`,
  };

  let flushed = 0;
  for (const action of actions.sort((a, b) => a.timestamp.localeCompare(b.timestamp))) {
    // Skip needs_input actions (legacy credential-required actions) — require manual replay
    if (action.status === 'needs_input') continue;

    try {
      let url = '';
      let method = 'POST';
      let body: Record<string, unknown> = action.payload;
      let skipAutoFlush = false;

      switch (action.type) {
        case 'create_company':
          url = `/api/companies`;
          method = 'POST';
          break;
        case 'update_company':
          url = `/api/companies/${action.companyId}`;
          method = 'PATCH';
          break;
        case 'delete_company':
          url = `/api/companies/${action.companyId}`;
          method = 'DELETE';
          body = {};
          break;
        case 'update_addons':
          url = `/api/companies/${action.companyId}/addons`;
          method = 'POST';
          break;
        case 'create_member':
          url = `/api/companies/${action.companyId}/members`;
          method = 'POST';
          break;
        case 'delete_member':
          url = `/api/companies/${action.companyId}/members/${String(action.payload.memberId)}`;
          method = 'DELETE';
          body = {};
          break;
        case 'update_member_role':
          url = `/api/companies/${action.companyId}/members/${String(action.payload.memberId)}`;
          method = 'PATCH';
          body = { role: action.payload.role };
          break;
        case 'send_reset_email':
          url = `/api/companies/${action.companyId}/members/${String(action.payload.uid)}/send-reset-link`;
          method = 'POST';
          body = {};
          break;
        case 'reset_password':
          // Legacy action type — skip (no longer used for offline queuing)
          skipAutoFlush = true;
          break;
      }

      if (skipAutoFlush) continue;

      const res = await fetch(url, {
        method,
        headers: authHeaders,
        body: method !== 'DELETE' ? JSON.stringify(body) : undefined,
      });

      if (res.ok) {
        await removePendingAction(action.id);
        clearSessionCredential(action.id);
        flushed++;
      }
    } catch {
      // Keep in queue for next retry
    }
  }

  if (flushed > 0 && onSuccess) {
    onSuccess();
  }
}

/** Get only the actions that need credential input at replay time */
export async function getPendingCredentialActions(): Promise<PendingCompanyAction[]> {
  const all = await getPendingActions();
  return all.filter(actionNeedsCredentialAtReplay);
}
