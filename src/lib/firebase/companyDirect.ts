/**
 * companyDirect — Firestore-direct company/member reads
 *
 * Bypasses the Express server entirely. The Replit server has been unreliable
 * (401s due to missing FIREBASE_SERVICE_ACCOUNT_KEY, stale deployments).
 * These operations are simple Firestore reads that the client SDK can do
 * directly with the authenticated user's token.
 *
 * Firestore schema (Replit's structure):
 *   companies/{companyId}                    — company doc
 *   companies/{companyId}/members/{memberId} — member subdocument
 *   memberAddonOverrides/{overrideId}        — addon override docs
 *   users/{uid}                              — user presence/timestamps
 */

import { getApp } from 'firebase/app';
import { sanitizeTimestamps } from '../queryClient';
import {
  getFirestore,
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  setDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';

function getDb() {
  try {
    return getFirestore(getApp());
  } catch {
    return null;
  }
}

// ── Types (match what the server returns) ─────────────────────────────────

export interface CompanyData {
  id: string;
  name: string;
  enabledAddons: string[];
  [key: string]: any;
}

export interface MemberData {
  id: string;
  companyId: string;
  userId: string;
  email: string;
  fullName?: string;
  role: string;
  allowedAddons?: string[] | null;
  betaAccess?: boolean | null;
  [key: string]: any;
}

export interface AddonOverride {
  id: string;
  userId: string;
  addonKey: string;
  isActive: boolean;
  expiresAt: string;
  [key: string]: any;
}

// ── My Company (replaces GET /api/my-company) ─────────────────────────────

export async function getMyCompanyDirect(uid: string): Promise<{
  company: CompanyData | null;
  membership: MemberData | null;
  members: MemberData[];
}> {
  const db = getDb();
  if (!db || !uid) return { company: null, membership: null, members: [] };

  try {
    // Try collectionGroup query first (requires Firestore index)
    const membersQuery = query(
      collectionGroup(db, 'members'),
      where('userId', '==', uid)
    );
    const snap = await getDocs(membersQuery);

    if (snap.empty) {
      return { company: null, membership: null, members: [] };
    }

    // Found membership — extract company ID from parent path
    const memberDoc = snap.docs[0];
    const memberData = sanitizeTimestamps({ id: memberDoc.id, ...memberDoc.data() }) as MemberData;
    const companyId = memberData.companyId || memberDoc.ref.parent.parent?.id;

    if (!companyId) {
      return { company: null, membership: memberData, members: [memberData] };
    }

    // Get company doc
    const companyDoc = await getDoc(doc(db, 'companies', companyId));
    const company = companyDoc.exists()
      ? sanitizeTimestamps({ id: companyDoc.id, ...companyDoc.data() }) as CompanyData
      : null;

    // Get all members of this company
    const allMembersSnap = await getDocs(collection(db, 'companies', companyId, 'members'));
    const members = allMembersSnap.docs.map(d => sanitizeTimestamps({ id: d.id, ...d.data() }) as MemberData);

    return { company, membership: memberData, members };
  } catch (err: any) {
    // FAILED_PRECONDITION = missing collectionGroup index — fall back to scanning
    if (err?.code === 'failed-precondition') {
      console.warn('[CompanyDirect] collectionGroup index missing, trying fallback scan');
      return getMyCompanyFallback(db, uid);
    }
    console.error('[CompanyDirect] getMyCompanyDirect failed:', err);
    return { company: null, membership: null, members: [] };
  }
}

/**
 * Fallback: scan all companies and check members subcollection.
 * Slower but works without the collectionGroup index.
 */
async function getMyCompanyFallback(db: any, uid: string): Promise<{
  company: CompanyData | null;
  membership: MemberData | null;
  members: MemberData[];
}> {
  try {
    const companiesSnap = await getDocs(collection(db, 'companies'));
    for (const companyDoc of companiesSnap.docs) {
      const membersSnap = await getDocs(
        query(collection(db, 'companies', companyDoc.id, 'members'), where('userId', '==', uid))
      );
      if (!membersSnap.empty) {
        const memberData = { id: membersSnap.docs[0].id, ...membersSnap.docs[0].data() } as MemberData;
        const company = { id: companyDoc.id, ...companyDoc.data() } as CompanyData;
        const allMembersSnap = await getDocs(collection(db, 'companies', companyDoc.id, 'members'));
        const members = allMembersSnap.docs.map(d => sanitizeTimestamps({ id: d.id, ...d.data() }) as MemberData);
        return { company, membership: memberData, members };
      }
    }
    return { company: null, membership: null, members: [] };
  } catch (err) {
    console.error('[CompanyDirect] fallback scan failed:', err);
    return { company: null, membership: null, members: [] };
  }
}

// ── My Addon Overrides (replaces GET /api/my-addon-overrides) ─────────────

export async function getMyAddonOverridesDirect(uid: string): Promise<AddonOverride[]> {
  const db = getDb();
  if (!db || !uid) return [];

  try {
    const q = query(
      collection(db, 'memberAddonOverrides'),
      where('userId', '==', uid),
      where('isActive', '==', true)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        ...data,
        expiresAt: data.expiresAt instanceof Timestamp
          ? data.expiresAt.toDate().toISOString()
          : data.expiresAt,
      } as AddonOverride;
    });
  } catch (err) {
    console.error('[CompanyDirect] getMyAddonOverridesDirect failed:', err);
    return [];
  }
}

// ── Record Online (replaces POST /api/auth/record-online) ─────────────────

export async function recordOnlineDirect(uid: string, resetAuthPeriod = false): Promise<{
  lastOnlineAt: string | null;
  authPeriodStart: string | null;
} | null> {
  const db = getDb();
  if (!db || !uid) return null;

  try {
    const now = new Date().toISOString();
    const update: Record<string, any> = {
      lastOnlineAt: serverTimestamp(),
      _lastOnlineAtISO: now,
    };
    if (resetAuthPeriod) {
      update.authPeriodStart = serverTimestamp();
      update._authPeriodStartISO = now;
    }

    await setDoc(doc(db, 'users', uid), update, { merge: true });

    // Read back to get server timestamps
    const userDoc = await getDoc(doc(db, 'users', uid));
    if (userDoc.exists()) {
      const data = userDoc.data();
      const lastOnline = data.lastOnlineAt instanceof Timestamp
        ? data.lastOnlineAt.toDate().toISOString()
        : data._lastOnlineAtISO || now;
      const authStart = data.authPeriodStart instanceof Timestamp
        ? data.authPeriodStart.toDate().toISOString()
        : data._authPeriodStartISO || null;
      return { lastOnlineAt: lastOnline, authPeriodStart: authStart };
    }
    return { lastOnlineAt: now, authPeriodStart: resetAuthPeriod ? now : null };
  } catch (err) {
    console.error('[CompanyDirect] recordOnlineDirect failed:', err);
    return null;
  }
}
