import { openDB, IDBPDatabase } from 'idb';
import * as bcrypt from 'bcryptjs';
import { isMasterAdmin } from './masterAdmin';
import { getFirestore, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { getApps } from 'firebase/app';

const DB_NAME = 'measurements-db';
const AUTH_CACHE_STORE = 'authCache';
const REAUTH_PERIOD_DAYS = 14;
const REAUTH_HARD_LOCKOUT_DAYS = 16;
const AUTH_CACHE_KEY = 'current_user_auth';
const USERS_COLLECTION = 'accounts';

/**
 * A single cached feature with its server-side expiry timestamp.
 * expiresAtMs = null means lifetime (no expiry).
 */
export interface CachedFeatureSnapshot {
  featureKey: string;
  expiresAtMs: number | null;
}

interface AuthCacheData {
  id: string;
  firebaseUid: string | null;
  email: string;
  passwordHash: string;
  accessToken: string | null;
  refreshToken: string | null;
  tokenExpiry: string | null;
  userProfile: {
    email: string;
    fullName: string | null;
    company: string | null;
    subscriptionTier: string | null;
    addOns: string[] | null;
  };
  licenseData: {
    activationStatus: boolean;
    expiryDate: string | null;
    featureFlags: Record<string, boolean> | null;
  } | null;
  // Hardened license cache (v2 — replaces simple enabledFeatureKeys)
  featureSnapshot: CachedFeatureSnapshot[] | null;
  featureSnapshotServerMs: number | null;   // Firebase server timestamp at sync (ms since epoch)
  featureSnapshotClientMs: number | null;   // Browser Date.now() at sync (for drift calc)
  featureSnapshotHmac: string | null;       // HMAC-SHA256 for tamper detection (legacy)
  featureSnapshotSyncAt: string | null;     // ISO string for display in UI
  featureSnapshotEcdsaSig: string | null;   // ECDSA P-256 signature over uid+features+expiry+timestamp
  featureSnapshotUid: string | null;        // Firebase UID bound into the ECDSA signature
  // Persisted monotonic floor: the highest effectiveNow ever computed for this cache entry.
  // Ensures offline expiry time can NEVER decrease across page reloads (clock rollback hardening).
  featureSnapshotMonotonicFloorMs: number | null;
  // Legacy field (kept for backward compat, not written to by new code)
  enabledFeatureKeys: string[] | null;
  lastFeatureKeysSyncAt: string | null;
  // Persistent expiry warning tracking (replaces sessionStorage)
  lastExpiryWarnDate: string | null;        // YYYY-MM-DD of last warning shown
  // Company membership — written at login for offline portal access (T006)
  companyId: string | null;
  companyRole: 'company_admin' | 'member' | null;
  lastOnlineTimestamp: string;
  authPeriodStart: string | null;
  requiresPasswordChange?: boolean;
  /** True when the account has been administratively revoked/suspended.
   *  Revoked accounts are locked immediately — even offline — unlike normal token expiry which
   *  enjoys a 14-day grace period. This flag is written at online login from the accounts doc. */
  isRevoked?: boolean;
  isOfflineMode: boolean;
  createdAt: string;
  updatedAt: string;
}

// Get database instance with proper upgrade logic
const getDB = async (): Promise<IDBPDatabase> => {
  return await openDB(DB_NAME, 5, {
    upgrade(db) {
      // Create authCache store if it doesn't exist
      if (!db.objectStoreNames.contains(AUTH_CACHE_STORE)) {
        db.createObjectStore(AUTH_CACHE_STORE, {
          keyPath: 'id',
          autoIncrement: false,
        });
      }
    },
  });
};

/**
 * Write lastOnlineAt and optionally authPeriodStart to Firestore (server-side persistence)
 */
export const writeAuthTimestampsToFirestore = async (uid: string, options?: { resetAuthPeriod?: boolean }): Promise<void> => {
  try {
    const apps = getApps();
    if (apps.length === 0) return;
    const db = getFirestore();
    const userRef = doc(db, USERS_COLLECTION, uid);
    const now = new Date().toISOString();
    const updates: Record<string, any> = {
      lastOnlineAt: now,
    };
    if (options?.resetAuthPeriod) {
      updates.authPeriodStart = now;
    }
    try {
      await updateDoc(userRef, updates);
    } catch {
      // If doc doesn't exist, set it
      await setDoc(userRef, updates, { merge: true });
    }
  } catch (error) {
    // Silent fail - Firestore may not be initialized client-side
  }
};

/**
 * Normalize a Firestore field value that may be a Timestamp, Date, or ISO string into an ISO string.
 * This is needed because Firestore serverTimestamp() returns a Timestamp object on read,
 * while older/direct writes may be ISO strings.
 */
function normalizeTimestamp(value: unknown): string | null {
  if (!value) return null;
  // Firestore Timestamp object (has toDate method)
  if (typeof value === 'object' && value !== null && typeof (value as { toDate?: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  // Plain Date object
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value.toISOString();
  }
  // ISO string or numeric timestamp
  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }
  return null;
}

export const fetchAuthTimestampsFromFirestore = async (uid: string): Promise<{ lastOnlineAt: string | null; authPeriodStart: string | null } | null> => {
  try {
    const apps = getApps();
    if (apps.length === 0) return null;
    const db = getFirestore();
    const userRef = doc(db, USERS_COLLECTION, uid);
    const snap = await getDoc(userRef);
    if (!snap.exists()) return null;
    const data = snap.data();
    return {
      lastOnlineAt: normalizeTimestamp(data.lastOnlineAt),
      authPeriodStart: normalizeTimestamp(data.authPeriodStart),
    };
  } catch {
    return null;
  }
};

/**
 * Save authentication data to IndexedDB cache
 */
export const saveAuthCache = async (
  email: string,
  password: string,
  userData: {
    firebaseUid?: string | null;
    accessToken?: string | null;
    refreshToken?: string | null;
    tokenExpiry?: string | null;
    userProfile: {
      email: string;
      fullName?: string | null;
      company?: string | null;
      subscriptionTier?: string | null;
      addOns?: string[] | null;
    };
    licenseData?: {
      activationStatus: boolean;
      expiryDate?: string | null;
      featureFlags?: Record<string, boolean> | null;
    } | null;
    requiresPasswordChange?: boolean;
    /** True when account is administratively revoked/suspended — hard lock even offline */
    isRevoked?: boolean;
    /** Company membership — persisted for offline Company Admin portal access (T006) */
    companyId?: string | null;
    companyRole?: 'company_admin' | 'member' | null;
  }
): Promise<void> => {
  try {
    const db = await getDB();
    
    // Hash the password for secure storage
    const passwordHash = await bcrypt.hash(password, 10);
    
    // Preserve existing authPeriodStart if it exists
    const existingCache = await db.get(AUTH_CACHE_STORE, AUTH_CACHE_KEY);
    const now = new Date().toISOString();
    
    const authData: AuthCacheData = {
      id: AUTH_CACHE_KEY,
      firebaseUid: userData.firebaseUid || existingCache?.firebaseUid || null,
      email: email.toLowerCase(),
      passwordHash,
      accessToken: userData.accessToken || null,
      refreshToken: userData.refreshToken || null,
      tokenExpiry: userData.tokenExpiry || null,
      userProfile: {
        email: userData.userProfile.email,
        fullName: userData.userProfile.fullName || null,
        company: userData.userProfile.company || null,
        subscriptionTier: userData.userProfile.subscriptionTier || null,
        addOns: userData.userProfile.addOns || null,
      },
      licenseData: userData.licenseData ? {
        activationStatus: userData.licenseData.activationStatus,
        expiryDate: userData.licenseData.expiryDate || null,
        featureFlags: userData.licenseData.featureFlags || null,
      } : null,
      featureSnapshot: existingCache?.featureSnapshot ?? null,
      featureSnapshotServerMs: existingCache?.featureSnapshotServerMs ?? null,
      featureSnapshotClientMs: existingCache?.featureSnapshotClientMs ?? null,
      featureSnapshotHmac: existingCache?.featureSnapshotHmac ?? null,
      featureSnapshotSyncAt: existingCache?.featureSnapshotSyncAt ?? null,
      // ECDSA signature fields must be preserved through all cache rewrites so the offline
      // verification check still works after a normal auth token refresh / profile update.
      featureSnapshotEcdsaSig: existingCache?.featureSnapshotEcdsaSig ?? null,
      featureSnapshotUid: existingCache?.featureSnapshotUid ?? null,
      // Monotonic floor must also be preserved so rollback protection survives cache rewrites.
      featureSnapshotMonotonicFloorMs: existingCache?.featureSnapshotMonotonicFloorMs ?? null,
      enabledFeatureKeys: existingCache?.enabledFeatureKeys ?? null,
      lastFeatureKeysSyncAt: existingCache?.lastFeatureKeysSyncAt ?? null,
      lastExpiryWarnDate: existingCache?.lastExpiryWarnDate ?? null,
      // Company membership — T006: persisted at login so offline Company Admin portal can check role
      companyId: userData.companyId !== undefined ? (userData.companyId ?? null) : (existingCache?.companyId ?? null),
      companyRole: userData.companyRole !== undefined ? (userData.companyRole ?? null) : (existingCache?.companyRole ?? null),
      lastOnlineTimestamp: now,
      authPeriodStart: existingCache?.authPeriodStart || now,
      requiresPasswordChange: userData.requiresPasswordChange || false,
      isRevoked: userData.isRevoked || false,
      isOfflineMode: false,
      createdAt: existingCache?.createdAt || now,
      updatedAt: now,
    };
    
    await db.put(AUTH_CACHE_STORE, authData);
  } catch (error) {
    throw error;
  }
};

/**
 * Clear the requiresPasswordChange flag from IndexedDB cache
 * Called after user successfully changes their password
 */
export const clearRequiresPasswordChangeInCache = async (): Promise<void> => {
  try {
    const db = await getDB();
    const existing = await db.get(AUTH_CACHE_STORE, AUTH_CACHE_KEY);
    if (existing) {
      existing.requiresPasswordChange = false;
      existing.updatedAt = new Date().toISOString();
      await db.put(AUTH_CACHE_STORE, existing);
    }
  } catch {
    // Silent fail
  }
};

/**
 * Get cached authentication data from IndexedDB
 */
export const getAuthCache = async (): Promise<AuthCacheData | null> => {
  try {
    const db = await getDB();
    const authData = await db.get(AUTH_CACHE_STORE, AUTH_CACHE_KEY);
    
    if (!authData) {
      return null;
    }
    
    return authData as AuthCacheData;
  } catch (error) {
    return null;
  }
};

/**
 * Verify password against cached hash
 */
export const verifyOfflinePassword = async (
  email: string,
  password: string
): Promise<{ valid: boolean; reason?: 'revoked' | 'invalid_credentials' | 'no_cache' }> => {
  try {
    const authData = await getAuthCache();
    
    if (!authData) {
      return { valid: false, reason: 'no_cache' };
    }
    
    if (authData.email.toLowerCase() !== email.toLowerCase()) {
      return { valid: false, reason: 'invalid_credentials' };
    }

    // Hard lock: revoked accounts cannot log in even offline
    if (authData.isRevoked) {
      return { valid: false, reason: 'revoked' };
    }
    
    // Verify password against cached hash
    const isValid = await bcrypt.compare(password, authData.passwordHash);
    
    return isValid ? { valid: true } : { valid: false, reason: 'invalid_credentials' };
  } catch (error) {
    return { valid: false, reason: 'invalid_credentials' };
  }
};

/**
 * Clear authentication cache from IndexedDB
 */
export const clearAuthCache = async (): Promise<void> => {
  try {
    const db = await getDB();
    await db.delete(AUTH_CACHE_STORE, AUTH_CACHE_KEY);
  } catch (error) {
    throw error;
  }
};

/**
 * Update last online timestamp in local IndexedDB cache (optimistic local update).
 * The authoritative server write is performed separately via /api/auth/record-online,
 * and its confirmed timestamps are synced back via syncTimestampsFromServer.
 */
export const updateLastOnline = async (): Promise<void> => {
  try {
    const authData = await getAuthCache();
    
    if (!authData) {
      return;
    }
    
    const db = await getDB();
    const updatedData: AuthCacheData = {
      ...authData,
      lastOnlineTimestamp: new Date().toISOString(),
      isOfflineMode: false,
      updatedAt: new Date().toISOString(),
    };
    
    await db.put(AUTH_CACHE_STORE, updatedData);
  } catch (error) {
  }
};

/**
 * Update auth cache with server-side timestamps from Firestore
 * Server timestamp is authoritative — never allow local to override server
 */
export const syncTimestampsFromServer = async (lastOnlineAt: string, authPeriodStart: string | null): Promise<void> => {
  try {
    const authData = await getAuthCache();
    if (!authData) return;
    const db = await getDB();
    const updatedData: AuthCacheData = {
      ...authData,
      lastOnlineTimestamp: lastOnlineAt,
      authPeriodStart: authPeriodStart || authData.authPeriodStart || new Date().toISOString(),
      isOfflineMode: false,
      updatedAt: new Date().toISOString(),
    };
    await db.put(AUTH_CACHE_STORE, updatedData);
  } catch {
  }
};

/**
 * Reset the authPeriodStart to now (after successful re-authentication)
 */
export const resetAuthPeriod = async (): Promise<void> => {
  try {
    const authData = await getAuthCache();
    if (!authData) return;
    const db = await getDB();
    const now = new Date().toISOString();
    const updatedData: AuthCacheData = {
      ...authData,
      authPeriodStart: now,
      lastOnlineTimestamp: now,
      isOfflineMode: false,
      updatedAt: now,
    };
    await db.put(AUTH_CACHE_STORE, updatedData);
  } catch {
  }
};

/**
 * Get the authPeriodStart from cache
 */
export const getAuthPeriodStart = async (): Promise<string | null> => {
  try {
    const authData = await getAuthCache();
    return authData?.authPeriodStart || null;
  } catch {
    return null;
  }
};

/**
 * Check if 14-day re-authentication is required (user online after period expired).
 * When local cache is missing, attempts to fetch authPeriodStart from Firestore directly
 * so that cache clears cannot bypass the re-auth requirement.
 */
export const isReauthRequired = async (uid?: string): Promise<boolean> => {
  try {
    const authData = await getAuthCache();
    let email: string | null = authData?.email || null;
    let periodStart: string | null = authData?.authPeriodStart || null;

    // If cache is missing or has no authPeriodStart, try Firestore directly (fail-safe)
    if (!periodStart && uid) {
      const firestoreTs = await fetchAuthTimestampsFromFirestore(uid);
      if (firestoreTs?.authPeriodStart) {
        periodStart = firestoreTs.authPeriodStart;
      }
    }

    if (!periodStart) return false;
    if (email && isMasterAdmin(email)) return false;

    const start = new Date(periodStart);
    const now = new Date();
    const daysSincePeriodStart = (now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    return daysSincePeriodStart > REAUTH_PERIOD_DAYS;
  } catch {
    return false;
  }
};

/**
 * Check if we're in the 2-day grace window (days 14-16) — read-only offline mode with warning.
 * Falls back to Firestore when local cache has no authPeriodStart.
 */
export const isInReauthGraceWindow = async (uid?: string): Promise<boolean> => {
  try {
    const authData = await getAuthCache();
    let email: string | null = authData?.email || null;
    let periodStart: string | null = authData?.authPeriodStart || null;

    if (!periodStart && uid) {
      const firestoreTs = await fetchAuthTimestampsFromFirestore(uid);
      if (firestoreTs?.authPeriodStart) {
        periodStart = firestoreTs.authPeriodStart;
      }
    }

    if (!periodStart) return false;
    if (email && isMasterAdmin(email)) return false;

    const start = new Date(periodStart);
    const now = new Date();
    const daysSincePeriodStart = (now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    return daysSincePeriodStart > REAUTH_PERIOD_DAYS && daysSincePeriodStart <= REAUTH_HARD_LOCKOUT_DAYS;
  } catch {
    return false;
  }
};

/**
 * Set offline mode flag
 */
export const setOfflineMode = async (isOffline: boolean): Promise<void> => {
  try {
    const authData = await getAuthCache();
    
    if (!authData) {
      return;
    }
    
    const db = await getDB();
    const updatedData: AuthCacheData = {
      ...authData,
      isOfflineMode: isOffline,
      updatedAt: new Date().toISOString(),
    };
    
    await db.put(AUTH_CACHE_STORE, updatedData);
  } catch (error) {
  }
};

/**
 * Get number of days since last online
 */
export const getDaysOffline = async (): Promise<number> => {
  try {
    const authData = await getAuthCache();
    
    if (!authData || !authData.lastOnlineTimestamp) {
      return 0;
    }
    
    const lastOnline = new Date(authData.lastOnlineTimestamp);
    const now = new Date();
    const diffMs = now.getTime() - lastOnline.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    return diffDays;
  } catch (error) {
    return 0;
  }
};

/**
 * Check if user is within grace period for offline login
 * Master admin always bypasses grace period
 */
export const isWithinGracePeriod = async (): Promise<boolean> => {
  try {
    // Check if current cached user is master admin
    const authData = await getAuthCache();
    if (authData && isMasterAdmin(authData.email)) {
      return true;
    }
    
    const daysOffline = await getDaysOffline();
    // Grace period: days 0-14 full access, days 14-16 = grace (re-auth prompt), day 16+ = hard lockout
    // isWithinGracePeriod returns true as long as we haven't hit the hard lockout threshold (16 days)
    const withinGracePeriod = daysOffline < REAUTH_HARD_LOCKOUT_DAYS;
    
    return withinGracePeriod;
  } catch (error) {
    return false;
  }
};

/**
 * Update auth tokens in cache
 */
export const updateAuthTokens = async (
  accessToken: string,
  refreshToken: string,
  tokenExpiry: string
): Promise<void> => {
  try {
    const authData = await getAuthCache();
    
    if (!authData) {
      return;
    }
    
    const db = await getDB();
    const updatedData: AuthCacheData = {
      ...authData,
      accessToken,
      refreshToken,
      tokenExpiry,
      updatedAt: new Date().toISOString(),
    };
    
    await db.put(AUTH_CACHE_STORE, updatedData);
  } catch (error) {
  }
};

/**
 * Update auth cache tokens, user profile, and license data WITHOUT modifying password hash
 * This function is used during token refresh to preserve the existing password hash
 */
export const updateAuthCacheTokens = async (
  email: string,
  tokens: {
    accessToken: string | null;
    refreshToken: string | null;
    tokenExpiry: string | null;
  },
  userProfile: {
    email: string;
    fullName: string | null;
    company: string | null;
    subscriptionTier: string | null;
    addOns: string[] | null;
  },
  licenseData: {
    activationStatus: boolean;
    expiryDate: string | null;
    featureFlags: Record<string, boolean> | null;
  } | null
): Promise<void> => {
  try {
    const authData = await getAuthCache();
    
    if (!authData) {
      return;
    }
    
    const db = await getDB();
    const now = new Date().toISOString();
    const updatedData: AuthCacheData = {
      ...authData,
      email: email.toLowerCase(),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      tokenExpiry: tokens.tokenExpiry,
      userProfile: {
        email: userProfile.email,
        fullName: userProfile.fullName,
        company: userProfile.company,
        subscriptionTier: userProfile.subscriptionTier,
        addOns: userProfile.addOns,
      },
      licenseData: licenseData,
      lastOnlineTimestamp: now,
      isOfflineMode: false,
      updatedAt: now,
    };
    
    await db.put(AUTH_CACHE_STORE, updatedData);
  } catch (error) {
    throw error;
  }
};

/**
 * Check if user requires a password change on next login
 */
export const getRequiresPasswordChange = async (): Promise<boolean> => {
  try {
    const authData = await getAuthCache();
    return authData?.requiresPasswordChange || false;
  } catch {
    return false;
  }
};

/**
 * Clear the requiresPasswordChange flag after user changes their password
 */
export const clearRequiresPasswordChange = async (): Promise<void> => {
  try {
    const authData = await getAuthCache();
    if (!authData) return;
    const db = await getDB();
    await db.put(AUTH_CACHE_STORE, { ...authData, requiresPasswordChange: false, updatedAt: new Date().toISOString() });
  } catch {
  }
};

// ==================== HMAC TAMPER DETECTION ====================

// ==================== ECDSA P-256 PUBLIC KEY (server-only counterpart stored in LICENSE_SNAPSHOT_PRIVATE_KEY secret) ====================
// The server signs `{uid}:{featureKey=expiresAtMs,...}:{serverNow}` with its private key.
// Expiry timestamps are bound into the signature so IndexedDB tampering is detectable.
// This public key (safe to embed) lets the client verify signatures without the private key.
// IMPORTANT: The private key must only be stored in Replit Secrets (LICENSE_SNAPSHOT_PRIVATE_KEY),
// never in .replit, source code, or any committed file.
const LICENSE_SNAPSHOT_PUBLIC_KEY_B64 =
  'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEw3tf9AVsrh7DoEY1N5+jeFa3u' +
  'Sz74pVnzELgvdqSYzsSNytVQ9q7mhD6626m1UMFZo95oHCQQeUsRzx/rs8NUg==';

let _cachedPublicKey: CryptoKey | null = null;

async function getPublicKey(): Promise<CryptoKey | null> {
  if (_cachedPublicKey) return _cachedPublicKey;
  try {
    const raw = Uint8Array.from(atob(LICENSE_SNAPSHOT_PUBLIC_KEY_B64), c => c.charCodeAt(0));
    _cachedPublicKey = await crypto.subtle.importKey(
      'spki',
      raw,
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['verify']
    );
    return _cachedPublicKey;
  } catch {
    return null;
  }
}

/**
 * Verify an ECDSA signature produced by the backend `/api/auth/feature-snapshot` endpoint.
 *
 * Payload format (mirrors what the server signs):
 *   `{uid}:{featureKey=expiresAtMs|lifetime,...sorted by featureKey}:{serverNow}`
 *
 * Expiry timestamps are bound into the signature so any IndexedDB tampering
 * (e.g. extending expiry dates) is detectable and causes verification to fail.
 *
 * Returns false on any error (fail-closed — tampered data is rejected).
 */
export async function verifyServerSignature(
  uid: string,
  snapshot: CachedFeatureSnapshot[],
  serverNow: number,
  signatureB64: string
): Promise<boolean> {
  try {
    const key = await getPublicKey();
    if (!key) return false;
    // Sort by featureKey to match server-side ordering
    const sortedEntries = [...snapshot]
      .sort((a, b) => a.featureKey.localeCompare(b.featureKey))
      .map(s => `${s.featureKey}=${s.expiresAtMs ?? 'lifetime'}`)
      .join(',');
    const payload = `${uid}:${sortedEntries}:${serverNow}`;
    const sig = Uint8Array.from(atob(signatureB64), c => c.charCodeAt(0));
    return await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      key,
      sig,
      new TextEncoder().encode(payload)
    );
  } catch {
    return false;
  }
}

// ==================== FEATURE SNAPSHOT CACHE (HARDENED) ====================

/**
 * Persist a server-signed feature snapshot to IndexedDB.
 *
 * @param snapshot        Per-feature list with expiry timestamps
 * @param serverMs        Server-authoritative timestamp (ms) — provided by the server, not Date.now()
 * @param ecdsaSignature  ECDSA P-256 signature from /api/auth/feature-snapshot
 * @param uid             Firebase UID (bound to the signature)
 */
export const updateCachedFeatureSnapshot = async (
  snapshot: CachedFeatureSnapshot[],
  serverMs: number,
  ecdsaSignature: string,
  uid: string
): Promise<void> => {
  try {
    const authData = await getAuthCache();
    if (!authData) return;
    const now = new Date().toISOString();
    const db = await getDB();
    await db.put(AUTH_CACHE_STORE, {
      ...authData,
      featureSnapshot: snapshot,
      featureSnapshotServerMs: serverMs,
      featureSnapshotClientMs: Date.now(),
      featureSnapshotHmac: null,      // legacy field — no longer used
      featureSnapshotEcdsaSig: ecdsaSignature,
      featureSnapshotUid: uid,
      featureSnapshotSyncAt: now,
      // Also populate legacy field for backward compatibility
      enabledFeatureKeys: snapshot.map(s => s.featureKey),
      lastFeatureKeysSyncAt: now,
      updatedAt: now,
    });
  } catch {
  }
};

/**
 * Retrieve the cached feature snapshot for offline fallback.
 *
 * Security:
 *  - The HMAC is verified before the snapshot is returned.
 *  - On signature mismatch the snapshot is cleared and null is returned,
 *    forcing the caller to perform an online re-check (fail closed).
 *
 * Returns: verified snapshot or null if absent/tampered/unverifiable.
 */
export const getCachedFeatureSnapshot = async (): Promise<{
  snapshot: CachedFeatureSnapshot[];
  serverMs: number;
  clientMs: number;
  syncAt: string;
  monotonicFloorMs: number | null;
} | null> => {
  try {
    const authData = await getAuthCache();
    if (
      !authData?.featureSnapshot ||
      !authData.featureSnapshotEcdsaSig ||
      !authData.featureSnapshotUid ||
      authData.featureSnapshotServerMs == null ||
      authData.featureSnapshotClientMs == null ||
      !authData.featureSnapshotSyncAt
    ) {
      return null;
    }

    // Cross-UID replay protection: the snapshot UID (embedded in the signature) must match
    // the currently authenticated Firebase user. This prevents an attacker from copying a
    // valid signed snapshot from a different user's IndexedDB and replaying it here.
    const currentFirebaseUid = authData.firebaseUid;
    if (currentFirebaseUid && authData.featureSnapshotUid !== currentFirebaseUid) {
      // UID mismatch — snapshot belongs to a different account; clear it and fail closed.
      try {
        const db = await getDB();
        await db.put(AUTH_CACHE_STORE, {
          ...authData,
          featureSnapshot: null,
          featureSnapshotServerMs: null,
          featureSnapshotClientMs: null,
          featureSnapshotHmac: null,
          featureSnapshotEcdsaSig: null,
          featureSnapshotUid: null,
          featureSnapshotSyncAt: null,
          updatedAt: new Date().toISOString(),
        });
      } catch { /* non-fatal */ }
      return null;
    }

    // Pass the full snapshot (including expiresAtMs) so the signature covers expiry timestamps.
    // Tampering with any expiry in IndexedDB will cause the hash to differ from the signed payload.
    const valid = await verifyServerSignature(
      authData.featureSnapshotUid,
      authData.featureSnapshot as CachedFeatureSnapshot[],
      authData.featureSnapshotServerMs,
      authData.featureSnapshotEcdsaSig
    );

    if (!valid) {
      // Tamper detected — clear the snapshot so the next online sync replaces it
      try {
        const db = await getDB();
        await db.put(AUTH_CACHE_STORE, {
          ...authData,
          featureSnapshot: null,
          featureSnapshotServerMs: null,
          featureSnapshotClientMs: null,
          featureSnapshotHmac: null,
          featureSnapshotEcdsaSig: null,
          featureSnapshotUid: null,
          featureSnapshotSyncAt: null,
          updatedAt: new Date().toISOString(),
        });
      } catch {
      }
      return null;
    }

    return {
      snapshot: authData.featureSnapshot,
      serverMs: authData.featureSnapshotServerMs,
      clientMs: authData.featureSnapshotClientMs,
      syncAt: authData.featureSnapshotSyncAt,
      monotonicFloorMs: authData.featureSnapshotMonotonicFloorMs ?? null,
    };
  } catch {
    return null;
  }
};

// ---- Monotonic clock reference (set once at module load, resets only on hard reload) ----
// Using performance.now() gives us a clock that cannot be rolled back by changing device time
// within the current page session. Combined with a signed-server-anchor + hard cap, this
// prevents an attacker from freezing effective time by setting system clock backward.
const _SESSION_START_WALL_MS = Date.now();
const _SESSION_START_PERF_MS = performance.now();

/** Returns a rollback-resistant approximation of the current wall-clock time.
 *  Within a page session this is fully monotonic; across reloads it falls back to wall clock. */
function getMonotonicNowMs(): number {
  // Start from the wall-clock time when this page session started, then advance
  // using the monotonic performance counter. This prevents in-session rollback.
  return _SESSION_START_WALL_MS + (performance.now() - _SESSION_START_PERF_MS);
}

/**
 * Compute the server-authoritative "effective now" timestamp for offline license checks.
 *
 * Strategy — five layers of clock-rollback protection:
 *
 * 1. **Tamper-signal detection (fail-closed)**: If the device wall clock has been rolled back
 *    more than CLOCK_ROLLBACK_TOLERANCE_MS before the snapshot's clientMs, we treat this as a
 *    deliberate manipulation and return the hard cap (serverMs + HARD_OFFLINE_LIMIT_MS), which
 *    makes all time-limited features appear expired immediately. This is the "fail closed"
 *    approach — clock manipulation results in loss of access, never extended access.
 *
 * 2. **In-session monotonic guard**: uses performance.now() (cannot be rolled back within a
 *    page session). Takes the MAX of wall-clock elapsed and monotonic elapsed.
 *
 * 3. **Persisted monotonic floor** (cross-reload): the caller supplies the highest effectiveNow
 *    value ever persisted in IndexedDB. Result = max(computed, floor), so time can NEVER
 *    decrease across page reloads. Callers advance this floor via updateMonotonicFloor().
 *
 * 4. **Minimum forward tick**: even if elapsed clamped to 0 (e.g. snapshot synced during this
 *    same reload), we advance by at least MIN_TICK_MS beyond the floor so the floor always
 *    progresses forward with each offline check.
 *
 * 5. **Hard upper cap**: effectiveNow can never exceed serverMs + HARD_OFFLINE_LIMIT_MS (17 days)
 *    regardless of any other path, so features always expire within the lockout window.
 */
const HARD_OFFLINE_LIMIT_MS = 17 * 24 * 60 * 60 * 1000;
// Tolerance for minor NTP adjustments / battery-swap clock resets (allow up to 5 minutes behind)
const CLOCK_ROLLBACK_TOLERANCE_MS = 5 * 60 * 1000;
// Minimum forward advancement per offline check — ensures floor cannot freeze
const MIN_TICK_MS = 1000; // 1 second

export function getEffectiveNowMs(
  serverMs: number,
  clientMs: number,
  persistedFloorMs: number | null,
): number {
  const wallElapsed = Date.now() - clientMs;

  // ── Layer 1: Clock rollback tamper signal ──────────────────────────────────────────────────
  // If wall clock is more than CLOCK_ROLLBACK_TOLERANCE_MS *behind* clientMs, the device clock
  // has been deliberately rolled back. Fail closed: treat this as fully expired (hard cap).
  if (wallElapsed < -CLOCK_ROLLBACK_TOLERANCE_MS) {
    return serverMs + HARD_OFFLINE_LIMIT_MS;
  }

  // ── Layer 2: In-session monotonic guard ───────────────────────────────────────────────────
  const syncOffsetFromSessionStart = clientMs - _SESSION_START_WALL_MS;
  const monotonicElapsed = (performance.now() - _SESSION_START_PERF_MS) - syncOffsetFromSessionStart;
  const elapsed = Math.max(wallElapsed, monotonicElapsed, 0);
  const computed = serverMs + elapsed;

  // ── Layer 3 + 4: Persisted floor + minimum tick ───────────────────────────────────────────
  // The floor is the highest value ever written to IndexedDB. We also ensure at least
  // MIN_TICK_MS of forward progress beyond the floor on every check so the floor never freezes.
  let withFloor = computed;
  if (persistedFloorMs != null) {
    // Always advance at least MIN_TICK_MS beyond the floor so repeated checks make progress
    withFloor = Math.max(computed, persistedFloorMs + MIN_TICK_MS);
  }

  // ── Layer 5: Hard cap ─────────────────────────────────────────────────────────────────────
  return Math.min(withFloor, serverMs + HARD_OFFLINE_LIMIT_MS);
}

/**
 * Atomically advance the persisted monotonic floor in IndexedDB.
 * Must be called after each `getEffectiveNowMs()` computation so the floor tracks real time.
 * On successful online sync the floor is implicitly reset by writing new serverMs/clientMs,
 * but must still be called to seed the new floor from the first offline check.
 * This is fire-and-forget; failures are silently swallowed.
 */
export async function updateMonotonicFloor(newFloorMs: number): Promise<void> {
  try {
    const db = await getDB();
    const authData = await db.get(AUTH_CACHE_STORE, AUTH_CACHE_KEY);
    if (!authData) return;
    const existing = authData.featureSnapshotMonotonicFloorMs ?? 0;
    if (newFloorMs <= existing) return; // already at or ahead of floor — no write needed
    await db.put(AUTH_CACHE_STORE, {
      ...authData,
      featureSnapshotMonotonicFloorMs: newFloorMs,
      updatedAt: new Date().toISOString(),
    });
  } catch { /* non-fatal — floor update is best-effort */ }
}

/**
 * Get the ISO string timestamp of the last feature snapshot sync.
 * Used by the license panel UI to show "Last verified: ..." to the user.
 */
export const getFeatureSnapshotSyncAt = async (): Promise<string | null> => {
  try {
    const authData = await getAuthCache();
    return authData?.featureSnapshotSyncAt ?? authData?.lastFeatureKeysSyncAt ?? null;
  } catch {
    return null;
  }
};

// ==================== PERSISTENT EXPIRY WARNING ====================

const TODAY_ISO = () => new Date().toISOString().slice(0, 10); // YYYY-MM-DD

/**
 * Check whether the expiry warning has already been shown today.
 * Uses IndexedDB for persistence across page refreshes (unlike sessionStorage).
 */
export const hasShownExpiryWarnToday = async (): Promise<boolean> => {
  try {
    const authData = await getAuthCache();
    return authData?.lastExpiryWarnDate === TODAY_ISO();
  } catch {
    return false;
  }
};

/**
 * Record that the expiry warning was shown today.
 */
export const markExpiryWarnShown = async (): Promise<void> => {
  try {
    const authData = await getAuthCache();
    if (!authData) return;
    const db = await getDB();
    await db.put(AUTH_CACHE_STORE, {
      ...authData,
      lastExpiryWarnDate: TODAY_ISO(),
      updatedAt: new Date().toISOString(),
    });
  } catch {
  }
};

/**
 * Fetch the current user's company membership from /api/my-company and cache it
 * in the company offline store so it's available for offline use.
 * Called after successful login when online.
 * Uses authedFetch so the bearer token is sent — /api/my-company requires verified auth.
 */
export const seedCompanyDataOffline = async (): Promise<void> => {
  try {
    // Dynamic import to avoid circular deps and to get authedFetch
    const { authedFetch } = await import('../authedFetch');
    const res = await authedFetch('/api/my-company');
    if (!res.ok) return;
    const data = await res.json();
    if (!data?.success || !data?.company) return;

    const { cacheCompany, cacheCompanyMembers } = await import('../companyOfflineStore');
    await cacheCompany(data.company);
    if (Array.isArray(data.members) && data.members.length > 0) {
      await cacheCompanyMembers(data.members);
    }

    // T006: Write companyId + companyRole into auth cache so the offline Company Admin portal
    // can check role without a network request.
    if (data.membership) {
      const authData = await getAuthCache();
      if (authData) {
        const db = await getDB();
        await db.put(AUTH_CACHE_STORE, {
          ...authData,
          companyId: data.membership.companyId ?? null,
          companyRole: data.membership.role ?? null,
          updatedAt: new Date().toISOString(),
        });
      }
    }
  } catch {
    // Best-effort — never block login
  }
};

/**
 * Get company membership (companyId + companyRole) from the offline auth cache.
 * Available without a network request, written at login via seedCompanyDataOffline.
 */
export const getCompanyMembershipFromCache = async (): Promise<{ companyId: string | null; companyRole: 'company_admin' | 'member' | null } | null> => {
  try {
    const authData = await getAuthCache();
    if (!authData) return null;
    return {
      companyId: authData.companyId ?? null,
      companyRole: authData.companyRole ?? null,
    };
  } catch {
    return null;
  }
};
