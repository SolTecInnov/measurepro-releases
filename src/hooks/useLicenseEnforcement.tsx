import { useState, useEffect, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getAuth } from 'firebase/auth';
import { getUserEnabledFeatures } from '../lib/licensing';
import { isMasterAdmin, isBetaTestAccount, getBetaRestrictedFeatures, getBetaRestrictedFeaturesForUser, getAdminViewOverride, type AdminViewOverride } from '../lib/auth/masterAdmin';
import { useAuth } from '../lib/auth/AuthContext';
import { getAuthCache } from '../lib/auth/offlineAuth';
import type { Company, CompanyMember, MemberAddonOverride } from '../../shared/schema';

interface MyCompanyData {
  company: Company | null;
  membership: CompanyMember | null;
  members: CompanyMember[];
}

/**
 * Fetch current user's company membership data (including per-member allowedAddons and betaAccess).
 * Returns null when user is not in a company or request fails.
 */
function useMemberAccess(): { membership: CompanyMember | null; company: Company | null } {
  const { user } = useAuth();
  const { data } = useQuery<MyCompanyData>({
    queryKey: ['firestore-my-company', user?.uid],
    enabled: !!user?.uid,
    queryFn: async () => {
      const { getApp } = await import('firebase/app');
      const { getFirestore, collection, doc, getDoc, getDocs, query, where } = await import('firebase/firestore');
      const db = getFirestore(getApp());
      try {
        // Memberships are in top-level 'companyMemberships' collection
        const mSnap = await getDocs(query(collection(db, 'companyMemberships'), where('userId', '==', user!.uid)));
        if (mSnap.empty) {
          // Fallback: check users doc for companyId field
          const userDoc = await getDoc(doc(db, 'users', user!.uid));
          if (userDoc.exists() && userDoc.data()?.companyId) {
            const companyDoc = await getDoc(doc(db, 'companies', userDoc.data().companyId));
            const company = companyDoc.exists() ? { id: companyDoc.id, ...companyDoc.data() } : null;
            return { company: company as any, membership: { role: userDoc.data().role || 'member', userId: user!.uid } as any, members: [] };
          }
          return { company: null, membership: null, members: [] };
        }
        const memberData = { id: mSnap.docs[0].id, ...mSnap.docs[0].data() } as any;
        const companyId = memberData.companyId;
        if (!companyId) return { company: null, membership: memberData, members: [] };
        const companyDoc = await getDoc(doc(db, 'companies', companyId));
        const company = companyDoc.exists() ? { id: companyDoc.id, ...companyDoc.data() } : null;
        // Get all members of this company
        const allMembersSnap = await getDocs(query(collection(db, 'companyMemberships'), where('companyId', '==', companyId)));
        const members = allMembersSnap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
        return { company: company as any, membership: memberData, members };
      } catch (e) {
        console.error('[LicenseEnforcement] Firestore query failed:', e);
        return { company: null, membership: null, members: [] };
      }
    },
    staleTime: 5 * 60_000,
    retry: false,
    refetchOnWindowFocus: false,
  });
  return { membership: data?.membership ?? null, company: data?.company ?? null };
}

/**
 * Fetch current user's active add-on overrides (granted by Master Admin).
 * Returns the set of addonKey values that have an active override.
 *
 * IMPORTANT: The returned Set is memoized so its reference only changes when
 * the underlying query data changes.  Do NOT return `new Set(...)` inline —
 * that creates a new reference on every render and causes an infinite loop
 * in any useEffect that lists the Set as a dependency.
 */
function useAddonOverrides(): Set<string> {
  const { user } = useAuth();
  const { data } = useQuery<{ success: boolean; overrides: MemberAddonOverride[] }>({
    queryKey: ['/api/my-addon-overrides'],
    enabled: !!user,
    queryFn: async () => {
      try {
        const { getApp } = await import('firebase/app');
        const { getFirestore, collection, getDocs, query, where, Timestamp } = await import('firebase/firestore');
        const db = getFirestore(getApp());
        const snap = await getDocs(query(collection(db, 'memberAddonOverrides'), where('userId', '==', user!.uid), where('isActive', '==', true)));
        const overrides = snap.docs.map(d => {
          const data = d.data();
          return { id: d.id, ...data, expiresAt: data.expiresAt instanceof Timestamp ? data.expiresAt.toDate().toISOString() : data.expiresAt };
        });
        return { success: true, overrides } as any;
      } catch { return { success: true, overrides: [] }; }
    },
    staleTime: 5 * 60_000,
    retry: false,
    refetchOnWindowFocus: false,
  });

  return useMemo(() => {
    const featureKeys = (data?.overrides ?? [])
      .filter(o => o.isActive && new Date(o.expiresAt) > new Date())
      .map(o => COMPANY_ADDON_TO_FEATURE_KEY[o.addonKey])
      .filter((k): k is string => !!k);
    return new Set(featureKeys);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.overrides]);
}

/**
 * Maps company add-on IDs (as stored in Company.enabledAddons) to their
 * corresponding feature keys used in license enforcement.
 */
const COMPANY_ADDON_TO_FEATURE_KEY: Record<string, string> = {
  ai_plus: 'ai_detection',
  envelope: 'envelope_clearance',
  convoy: 'convoy_guardian',
  route_analysis: 'route_enforcement',
  swept_path: 'swept_path_analysis',
  calibration: 'calibration',
  '3d_view': 'point_cloud_scanning',
};

/** Maps an array of addon IDs to feature keys using COMPANY_ADDON_TO_FEATURE_KEY. */
function mapAddonIdsToFeatureKeys(addonIds: string[] | null | undefined): string[] {
  return (addonIds ?? [])
    .map(id => COMPANY_ADDON_TO_FEATURE_KEY[id] ?? id)
    .filter(Boolean);
}

/**
 * Returns the full set of feature keys explicitly granted to a beta user:
 * - member.allowedAddons (mapped addon IDs → feature keys)
 *   • If allowedAddons is null (no restriction set), we fall back to company.enabledAddons
 *     so that members without an explicit per-member list still see all company add-ons.
 * - active Master Admin add-on overrides (already feature keys)
 *
 * Used across all beta enforcement branches to ensure consistent bypass logic.
 */
function computeBetaGrantedFeatureKeys(
  allowedAddons: string[] | null | undefined,
  addonOverrides: Set<string>,
  companyEnabledAddons?: string[] | null
): Set<string> {
  const granted = new Set<string>(addonOverrides);
  // When allowedAddons is null (no per-member restriction), inherit all company add-ons.
  // When it's an empty array [], the member has no allowed add-ons — respect that.
  const effectiveAddons = allowedAddons ?? companyEnabledAddons ?? [];
  for (const key of mapAddonIdsToFeatureKeys(effectiveAddons)) granted.add(key);
  return granted;
}

/**
 * Hook to check if user has access to a specific licensed feature
 * Master admin has access to all features (works offline via cached data)
 * Supports admin view override for testing different views
 * Respects per-member allowedAddons and betaAccess overrides
 */
export function useLicenseCheck(featureKey: string): {
  hasAccess: boolean;
  isLoading: boolean;
  error: string | null;
} {
  const [hasAccess, setHasAccess] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adminOverride, setAdminOverride] = useState<AdminViewOverride>(() => getAdminViewOverride());
  // Increment to force re-check when company add-ons change
  const [companyAddonsVersion, setCompanyAddonsVersion] = useState(0);

  let auth: any = null;
  try { auth = getAuth(); } catch { /* Firebase not initialized yet */ }
  const { user: authContextUser, isMasterAdmin: cachedIsMasterAdmin } = useAuth();
  const { membership, company } = useMemberAccess();
  const addonOverrides = useAddonOverrides();

  // Stable string key — prevents the Set from causing infinite re-renders in useEffect deps.
  const addonOverridesKey = useMemo(
    () => Array.from(addonOverrides).sort().join(','),
    [addonOverrides]
  );

  // Listen for admin view override changes
  useEffect(() => {
    const handleOverrideChange = (e: Event) => {
      const customEvent = e as CustomEvent<AdminViewOverride>;
      setAdminOverride(customEvent.detail);
    };
    window.addEventListener('admin-view-override-changed', handleOverrideChange);
    return () => window.removeEventListener('admin-view-override-changed', handleOverrideChange);
  }, []);

  // Re-check when company add-ons change (same tab via custom event, or cross-tab via BroadcastChannel)
  useEffect(() => {
    const bump = () => setCompanyAddonsVersion(v => v + 1);
    window.addEventListener('company-addons-changed', bump);
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel('company-addons-changed');
      bc.onmessage = bump;
    } catch { /* BroadcastChannel not available in all environments */ }
    return () => {
      window.removeEventListener('company-addons-changed', bump);
      bc?.close();
    };
  }, []);

  // Poll every 60 s for cross-device propagation of company add-on changes.
  // The poll simply bumps the version counter, which causes checkAccess to re-run.
  useEffect(() => {
    const interval = setInterval(() => {
      setCompanyAddonsVersion(v => v + 1);
    }, 60_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const checkAccess = async () => {
      // Check if user is master admin
      const userIsMasterAdmin = cachedIsMasterAdmin || 
        (auth?.currentUser && isMasterAdmin(auth?.currentUser.email)) ||
        (authContextUser?.email && isMasterAdmin(authContextUser.email));

      // Master admins are not affected by per-member overrides.
      // IMPORTANT: when adminOverride === 'beta' and featureKey === 'admin',
      // we must never deny access to the master admin — even if auth hasn't
      // fully loaded yet. If we can't confirm master admin status yet (auth
      // still initializing), keep isLoading=true rather than showing Access Denied.
      if (adminOverride === 'beta' && featureKey === 'admin') {
        if (userIsMasterAdmin) {
          // Confirmed master admin — grant access immediately.
          setHasAccess(true);
          setIsLoading(false);
          setError(null);
          return;
        }
        if (!auth?.currentUser && !authContextUser && !cachedIsMasterAdmin) {
          // Auth not loaded yet — stay in loading state; effect will re-run once auth resolves.
          setIsLoading(true);
          return;
        }
        // Auth is loaded but user is NOT master admin — deny access.
        setHasAccess(false);
        setIsLoading(false);
        setError(null);
        return;
      }

      if (userIsMasterAdmin && adminOverride) {
        if (adminOverride === 'beta') {
          // Note: featureKey === 'admin' is already handled by the top-level
          // guard above, so this branch only runs for non-admin feature keys.
          // Even in beta view, company-enabled add-ons are always accessible.
          // Granted add-ons take priority over beta restrictions.
          const granted = computeBetaGrantedFeatureKeys(membership?.allowedAddons, addonOverrides, company?.enabledAddons);
          if (granted.has(featureKey)) {
            setHasAccess(true);
            setIsLoading(false);
            setError(null);
            return;
          }
          const restricted = getBetaRestrictedFeaturesForUser(granted);
          setHasAccess(!restricted.includes(featureKey));
          setIsLoading(false);
          setError(null);
          return;
        } else if (adminOverride === 'pro') {
          setHasAccess(true);
          setIsLoading(false);
          setError(null);
          return;
        }
      }

      // 0. Check localStorage cache for master admin (works fully offline)
      const cachedEmail = localStorage.getItem('last_logged_in_email') || localStorage.getItem('auth_email_cache');
      if (cachedEmail && isMasterAdmin(cachedEmail)) {
        setHasAccess(true);
        setIsLoading(false);
        setError(null);
        return;
      }

      // 1. Check cached master admin flag FIRST (works offline)
      if (cachedIsMasterAdmin) {
        setHasAccess(true);
        setIsLoading(false);
        setError(null);
        return;
      }

      // 2. Check Firebase user (only works online)
      if (!auth?.currentUser) {
        if (authContextUser?.email && isMasterAdmin(authContextUser.email)) {
          // Cache email for offline use
          try { localStorage.setItem('last_logged_in_email', authContextUser.email); } catch {}
          setHasAccess(true);
          setIsLoading(false);
          setError(null);
          return;
        }
        setHasAccess(false);
        setIsLoading(false);
        return;
      }

      // 3. Check Firebase user email
      if (isMasterAdmin(auth?.currentUser.email)) {
        // Cache email so feature access works offline next session
        try { localStorage.setItem('last_logged_in_email', auth?.currentUser.email || ''); } catch {}
        setHasAccess(true);
        setIsLoading(false);
        setError(null);
        return;
      }

      // 4. Per-member betaAccess override
      // If member.betaAccess === true, force beta UI (treat as beta user)
      // If member.betaAccess === false, skip all beta checks for this member
      const memberBetaOverride = membership?.betaAccess ?? null;

      if (memberBetaOverride === true) {
        const granted = computeBetaGrantedFeatureKeys(membership?.allowedAddons, addonOverrides, company?.enabledAddons);
        if (granted.has(featureKey)) {
          setHasAccess(true);
          setIsLoading(false);
          setError(null);
          return;
        }
        const restricted = getBetaRestrictedFeaturesForUser(granted);
        setHasAccess(!restricted.includes(featureKey));
        setIsLoading(false);
        setError(null);
        return;
      }

      // 5. Check if beta test account (hardcoded list OR subscription tier from cache)
      //    Only if member.betaAccess is not explicitly false
      if (memberBetaOverride !== false) {
        const isHardcodedBeta = isBetaTestAccount(auth?.currentUser.email);
        let isTierBeta = false;
        if (!isHardcodedBeta) {
          try {
            const authCache = await getAuthCache();
            isTierBeta = authCache?.userProfile?.subscriptionTier === 'beta_tester';
          } catch { /* ignore cache read errors */ }
        }
        if (isHardcodedBeta || isTierBeta) {
          const granted = computeBetaGrantedFeatureKeys(membership?.allowedAddons, addonOverrides, company?.enabledAddons);
          if (granted.has(featureKey)) {
            setHasAccess(true);
            setIsLoading(false);
            setError(null);
            return;
          }
          const restricted = getBetaRestrictedFeaturesForUser(granted);
          setHasAccess(!restricted.includes(featureKey));
          setIsLoading(false);
          setError(null);
          return;
        }
      }

      try {
        setIsLoading(true);
        const enabledFeatures = await getUserEnabledFeatures();

        // 6. Per-member allowedAddons: intersect company-enabled add-ons with member's allowed list
        // Also check Master Admin overrides for any add-on not in allowed list
        const memberAllowedAddons = membership?.allowedAddons;
        if (memberAllowedAddons !== null && memberAllowedAddons !== undefined) {
          // Member has a restricted add-on list — map addon IDs → feature keys for comparison
          const companyAddonIds = company?.enabledAddons ?? [];
          const companyFeatureKeys = companyAddonIds
            .map(id => COMPANY_ADDON_TO_FEATURE_KEY[id] ?? id)
            .filter(Boolean);
          const isCompanyAddon = companyFeatureKeys.includes(featureKey);
          if (isCompanyAddon) {
            const memberGrantedFKeys = memberAllowedAddons
              .map(id => COMPANY_ADDON_TO_FEATURE_KEY[id] ?? id)
              .filter(Boolean);
            setHasAccess(memberGrantedFKeys.includes(featureKey) || addonOverrides.has(featureKey));
          } else {
            setHasAccess(enabledFeatures.includes(featureKey) || addonOverrides.has(featureKey));
          }
        } else {
          // No per-member restriction: also check company add-ons
          const companyFeatureKeys = mapAddonIdsToFeatureKeys(company?.enabledAddons);
          setHasAccess(enabledFeatures.includes(featureKey) || companyFeatureKeys.includes(featureKey) || addonOverrides.has(featureKey));
        }
        setError(null);
      } catch {
        // Cloud Function unreachable (CORS, network, etc.) — fall back to company add-ons
        // so members still see their assigned features rather than being fully locked out.
        const companyFeatureKeys = mapAddonIdsToFeatureKeys(company?.enabledAddons);
        const memberAllowedAddons = membership?.allowedAddons;
        if (memberAllowedAddons !== null && memberAllowedAddons !== undefined) {
          const memberGrantedFKeys = memberAllowedAddons
            .map((id: string) => COMPANY_ADDON_TO_FEATURE_KEY[id] ?? id)
            .filter(Boolean);
          setHasAccess(memberGrantedFKeys.includes(featureKey) || addonOverrides.has(featureKey));
        } else {
          setHasAccess(companyFeatureKeys.includes(featureKey) || addonOverrides.has(featureKey));
        }
        setError(null);
      } finally {
        setIsLoading(false);
      }
    };

    checkAccess();
  // addonOverridesKey is a stable string derived from addonOverrides — using it prevents
  // an infinite-loop caused by a new Set reference on every render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth?.currentUser, authContextUser, cachedIsMasterAdmin, featureKey, adminOverride, companyAddonsVersion, membership, company, addonOverridesKey]);

  return { hasAccess, isLoading, error };
}

/**
 * Hook to get all enabled features for current user
 * Master admin has access to all features (works offline via cached data)
 * Supports admin view override for testing different views
 * Respects per-member allowedAddons and betaAccess overrides
 */
export function useEnabledFeatures(): {
  features: string[];
  isLoading: boolean;
  error: string | null;
  hasFeature: (featureKey: string) => boolean;
  adminViewOverride: AdminViewOverride;
} {
  const [features, setFeatures] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adminOverride, setAdminOverride] = useState<AdminViewOverride>(() => getAdminViewOverride());
  // Increment this to force the loadFeatures effect to re-run (e.g. on company add-on changes)
  const [companyAddonsVersion, setCompanyAddonsVersion] = useState(0);

  let auth: any = null;
  try { auth = getAuth(); } catch { /* Firebase not initialized yet */ }
  const { user: authContextUser, isMasterAdmin: cachedIsMasterAdmin } = useAuth();
  const { membership, company } = useMemberAccess();
  const addonOverrides = useAddonOverrides();

  // Stable string key derived from addonOverrides — only changes when the actual
  // set of override keys changes, not on every render.  Use this in dependency
  // arrays instead of the Set itself to avoid infinite-loop re-renders.
  const addonOverridesKey = useMemo(
    () => Array.from(addonOverrides).sort().join(','),
    [addonOverrides]
  );

  // Keep a ref so the 60s poll can read current features without being a dep.
  const featuresRef = useRef(features);
  featuresRef.current = features;

  // Listen for admin view override changes
  useEffect(() => {
    const handleOverrideChange = (e: Event) => {
      const customEvent = e as CustomEvent<AdminViewOverride>;
      setAdminOverride(customEvent.detail);
    };
    window.addEventListener('admin-view-override-changed', handleOverrideChange);
    return () => window.removeEventListener('admin-view-override-changed', handleOverrideChange);
  }, []);

  // Listen for company add-on changes dispatched by CompanyManager after a successful
  // add-on save. This ensures beta users in the same browser see updated access
  // immediately, without needing to re-login. BroadcastChannel extends this to
  // other open tabs/windows in the same origin.
  useEffect(() => {
    const bump = () => setCompanyAddonsVersion(v => v + 1);
    window.addEventListener('company-addons-changed', bump);
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel('company-addons-changed');
      bc.onmessage = bump;
    } catch { /* BroadcastChannel not available in all environments */ }
    return () => {
      window.removeEventListener('company-addons-changed', bump);
      bc?.close();
    };
  }, []);

  // Poll every 60 s so add-on grants from another device are picked up promptly.
  // Uses featuresRef so the interval is created only once (no `features` dep).
  useEffect(() => {
    const interval = setInterval(() => {
      const f = featuresRef.current;
      if (f.includes('BETA_ACCOUNT') || f.length === 0) {
        setCompanyAddonsVersion(v => v + 1);
      }
    }, 60_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const loadFeatures = async () => {
      // Check if user is master admin
      const userIsMasterAdmin = cachedIsMasterAdmin || 
        (auth?.currentUser && isMasterAdmin(auth?.currentUser.email)) ||
        (authContextUser?.email && isMasterAdmin(authContextUser.email));

      // Master admins are not affected by per-member overrides
      if (userIsMasterAdmin && adminOverride) {
        if (adminOverride === 'beta') {
          // Even in beta view, company-enabled add-ons are always shown.
          // Granted add-on feature keys are included alongside BETA_ACCOUNT.
          // Also always include 'admin' so hasFeature('admin') returns true for
          // master admin regardless of the beta override.
          const granted = computeBetaGrantedFeatureKeys(membership?.allowedAddons, addonOverrides, company?.enabledAddons);
          setFeatures(['BETA_ACCOUNT', 'admin', ...Array.from(granted)]);
          setIsLoading(false);
          setError(null);
          return;
        } else if (adminOverride === 'pro') {
          setFeatures(['*']);
          setIsLoading(false);
          setError(null);
          return;
        }
      }

      // 1. Check cached master admin flag FIRST (works offline)
      if (cachedIsMasterAdmin) {
        setFeatures(['*']);
        setIsLoading(false);
        setError(null);
        return;
      }

      // 2. Check Firebase user (only works online)
      if (!auth?.currentUser) {
        if (authContextUser?.email && isMasterAdmin(authContextUser.email)) {
          setFeatures(['*']);
          setIsLoading(false);
          setError(null);
          return;
        }
        setFeatures([]);
        setIsLoading(false);
        return;
      }

      // 3. Check Firebase user email
      if (isMasterAdmin(auth?.currentUser.email)) {
        setFeatures(['*']);
        setIsLoading(false);
        setError(null);
        return;
      }

      // 4. Per-member betaAccess override
      const memberBetaOverride = membership?.betaAccess ?? null;

      if (memberBetaOverride === true) {
        const granted = computeBetaGrantedFeatureKeys(membership?.allowedAddons, addonOverrides, company?.enabledAddons);
        setFeatures(['BETA_ACCOUNT', ...Array.from(granted)]);
        setIsLoading(false);
        setError(null);
        return;
      }

      // 5. Check if beta test account (hardcoded list OR subscription tier from cache)
      //    Only if member.betaAccess is not explicitly false
      if (memberBetaOverride !== false) {
        const isHardcodedBeta = isBetaTestAccount(auth?.currentUser.email);
        let isTierBeta = false;
        if (!isHardcodedBeta) {
          try {
            const authCache = await getAuthCache();
            isTierBeta = authCache?.userProfile?.subscriptionTier === 'beta_tester';
          } catch { /* ignore cache read errors */ }
        }
        if (isHardcodedBeta || isTierBeta) {
          const granted = computeBetaGrantedFeatureKeys(membership?.allowedAddons, addonOverrides, company?.enabledAddons);
          setFeatures(['BETA_ACCOUNT', ...Array.from(granted)]);
          setIsLoading(false);
          setError(null);
          return;
        }
      }

      try {
        setIsLoading(true);
        const enabledFeatures = await getUserEnabledFeatures();

        // 6. Per-member allowedAddons: intersect company-enabled add-ons with member's allowed set.
        // Master Admin override keys are added unconditionally — they bypass company restrictions.
        const overrideKeys = Array.from(addonOverrides);
        const memberAllowedAddons = membership?.allowedAddons;
        if (memberAllowedAddons !== null && memberAllowedAddons !== undefined) {
          const companyFeatureKeys = mapAddonIdsToFeatureKeys(company?.enabledAddons);
          const memberGrantedKeys = mapAddonIdsToFeatureKeys(memberAllowedAddons);
          // Keep non-addon features as-is; restrict company addon features to member's allowed set
          const filtered = enabledFeatures.filter(f =>
            companyFeatureKeys.includes(f) ? memberGrantedKeys.includes(f) : true
          );
          setFeatures(Array.from(new Set([...filtered, ...memberGrantedKeys, ...overrideKeys])));
        } else {
          // No per-member restriction: include all company add-ons alongside subscription features
          const companyFeatureKeys = mapAddonIdsToFeatureKeys(company?.enabledAddons);
          setFeatures(Array.from(new Set([...enabledFeatures, ...companyFeatureKeys, ...overrideKeys])));
        }
        setError(null);
      } catch {
        // Cloud Function unreachable (CORS, network, etc.) — fall back to company add-ons
        // so members still see their assigned features rather than being fully locked out.
        const overrideKeys = Array.from(addonOverrides);
        const memberAllowedAddons = membership?.allowedAddons;
        if (memberAllowedAddons !== null && memberAllowedAddons !== undefined) {
          const memberGrantedKeys = mapAddonIdsToFeatureKeys(memberAllowedAddons);
          setFeatures(Array.from(new Set([...memberGrantedKeys, ...overrideKeys])));
        } else {
          const companyFeatureKeys = mapAddonIdsToFeatureKeys(company?.enabledAddons);
          setFeatures(Array.from(new Set([...companyFeatureKeys, ...overrideKeys])));
        }
        setError(null);
      } finally {
        setIsLoading(false);
      }
    };

    loadFeatures();
  // addonOverridesKey is a stable string derived from addonOverrides; using it instead
  // of the Set itself prevents a new-reference-every-render infinite loop.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth?.currentUser, authContextUser, cachedIsMasterAdmin, adminOverride, companyAddonsVersion, membership, company, addonOverridesKey]);

  const hasFeature = (featureKey: string): boolean => {
    // Master admin has all features
    if (features.includes('*')) return true;
    
    // Beta test account — explicitly granted features (allowedAddons + overrides) are in `features`
    // and bypass restrictions. Use the override-aware restricted list for consistent evaluation.
    if (features.includes('BETA_ACCOUNT')) {
      if (features.includes(featureKey)) return true;
      // features includes granted feature keys; pass them as the "granted" set
      const grantedKeys = features.filter(f => f !== 'BETA_ACCOUNT');
      const restrictedFeatures = getBetaRestrictedFeaturesForUser(grantedKeys);
      return !restrictedFeatures.includes(featureKey);
    }
    
    // Regular user - only has explicitly granted features
    return features.includes(featureKey);
  };

  return { features, isLoading, error, hasFeature, adminViewOverride: adminOverride };
}

/**
 * License enforcement component wrapper
 * Conditionally renders children based on feature access
 */
interface LicenseGateProps {
  featureKey: string;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export function LicenseGate({ featureKey, fallback = null, children }: LicenseGateProps) {
  const { hasAccess, isLoading } = useLicenseCheck(featureKey);

  if (isLoading) {
    return null;
  }

  if (!hasAccess) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
