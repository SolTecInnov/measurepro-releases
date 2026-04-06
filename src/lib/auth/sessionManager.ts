/**
 * Concurrent Session Manager
 *
 * Implements "last-login-wins" session enforcement:
 *   1. On login, a fresh UUID session ID is written to Firestore `sessions/{uid}`.
 *   2. A Firestore listener watches that document.
 *   3. When another device logs in, they overwrite `activeSessionId`.
 *   4. The existing session detects the mismatch and forces a local logout.
 *
 * This prevents simultaneous active sessions for a single account without
 * requiring server-side request interception.
 */

import {
  doc,
  setDoc,
  onSnapshot,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';

const SESSION_ID_KEY = 'measPro_activeSessionId';

function newSessionId(): string {
  return crypto.randomUUID();
}

function getLocalSessionId(): string | null {
  return localStorage.getItem(SESSION_ID_KEY);
}

function setLocalSessionId(id: string): void {
  localStorage.setItem(SESSION_ID_KEY, id);
}

function clearLocalSessionId(): void {
  localStorage.removeItem(SESSION_ID_KEY);
}

/**
 * Register a new session for this device.
 * Overwrites any previous session in Firestore (other devices will be evicted).
 * Returns the new session ID.
 */
export async function registerSession(uid: string): Promise<string> {
  const sessionId = newSessionId();
  setLocalSessionId(sessionId);

  const sessionRef = doc(db, 'sessions', uid);
  await setDoc(sessionRef, {
    activeSessionId: sessionId,
    loginAt: serverTimestamp(),
    userAgent: navigator.userAgent.slice(0, 200),
  });

  return sessionId;
}

let unsubscribeSessionListener: (() => void) | null = null;

/**
 * Start watching for session eviction.
 * If another device registers a new session (changing `activeSessionId`),
 * `onEvicted` is called so AuthContext can force logout.
 *
 * Call once after login. Call `stopSessionGuard()` on logout.
 */
export function startSessionGuard(
  uid: string,
  onEvicted: () => void
): void {
  stopSessionGuard();

  const sessionRef = doc(db, 'sessions', uid);

  // Snapshot fires immediately on subscribe (with current Firestore state), then on changes.
  // We do NOT skip the first snapshot — if the guard is started on page refresh and another
  // device logged in while we were offline/navigating, the very first snapshot will show a
  // different activeSessionId and we must detect that stale session immediately.
  unsubscribeSessionListener = onSnapshot(
    sessionRef,
    (snap) => {
      const localId = getLocalSessionId();
      const remoteId = snap.data()?.activeSessionId as string | undefined;

      if (remoteId && localId && remoteId !== localId) {
        // Another device has taken over this account.
        clearLocalSessionId();
        onEvicted();
      }
    },
    () => {
      // Ignore listener errors (network, permission) — do not force logout.
    }
  );
}

/**
 * Stop watching for session eviction.
 * Call on logout or component unmount.
 */
export function stopSessionGuard(): void {
  if (unsubscribeSessionListener) {
    unsubscribeSessionListener();
    unsubscribeSessionListener = null;
  }
}

/**
 * Remove this session record from Firestore on VOLUNTARY logout.
 * Reads the current Firestore state first — if another device has already
 * written a newer session ID, we skip the delete so we don't orphan their session.
 * Call `clearLocalSessionOnly()` instead when logging out due to eviction.
 */
export async function unregisterSession(uid: string): Promise<void> {
  const localId = getLocalSessionId();
  clearLocalSessionId();
  if (!localId) return; // Already cleared (e.g. eviction path)
  try {
    const sessionRef = doc(db, 'sessions', uid);
    // Only delete if we still own the session document (i.e., another device hasn't taken over)
    const snap = await import('firebase/firestore').then(({ getDoc }) => getDoc(sessionRef));
    const remoteId = snap.data()?.activeSessionId as string | undefined;
    if (remoteId === localId) {
      await deleteDoc(sessionRef);
    }
    // If remoteId !== localId, another device owns the document — leave it alone
  } catch {
    // Non-critical — doc will be overwritten on next login anyway.
  }
}

/**
 * Clear only the local session state (localStorage) without touching Firestore.
 * Use this when the session has been evicted by another device logging in —
 * the Firestore document now belongs to the new device and must not be deleted.
 */
export function clearLocalSessionOnly(): void {
  clearLocalSessionId();
}
