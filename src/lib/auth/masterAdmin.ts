/**
 * Master Admin Utilities
 * 
 * Central location for master admin email and checking functions.
 * The master admin (jfprince@soltec.ca) has unrestricted access to all features,
 * bypassing subscription, license, grace period, and offline restrictions.
 */

export const MASTER_ADMIN_EMAIL = 'jfprince@soltec.ca';

/**
 * Beta Test Accounts
 * Limited access accounts for testing purposes with restricted features
 */
export const BETA_TEST_ACCOUNTS = [
  'chris@novapermits.com',
  // info@groupebellemare.com removed — now managed via admin panel (subscriptionTier / subscriptionEndDate)
];

/**
 * Check if an email belongs to the master admin
 * @param email - Email address to check (can be null or undefined)
 * @returns true if email matches master admin email
 */
export function isMasterAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.toLowerCase() === MASTER_ADMIN_EMAIL.toLowerCase();
}

/**
 * Check if current user is master admin (from Firebase User object)
 */
export function isMasterAdminUser(user: { email?: string | null } | null | undefined): boolean {
  return isMasterAdmin(user?.email);
}

/**
 * Check if an email belongs to a beta test account
 * @param email - Email address to check (can be null or undefined)
 * @returns true if email is in beta test accounts list
 */
export function isBetaTestAccount(email: string | null | undefined): boolean {
  if (!email) return false;
  return BETA_TEST_ACCOUNTS.some(betaEmail => betaEmail.toLowerCase() === email.toLowerCase());
}

/** Complete list of feature keys that are BLOCKED for beta accounts. */
const BETA_RESTRICTED_FEATURE_KEYS: string[] = [
  // Add-ons (blocked)
  'calibration',
  'ai_detection',
  'envelope_clearance',
  'convoy_guardian',
  'route_enforcement',
  'swept_path_analysis',

  // Admin features (blocked)
  'admin',

  // 3D scanning (blocked)
  'point_cloud_scanning',

  // GNSS (blocked)
  'gnss_profiling',

  // Measurement configuration (blocked)
  'measurement_configuration',
  'measurement_controls',

  // Slave app (blocked)
  'slave_app',

  // Detection modes (blocked)
  'ai_detection_mode',
  'manual_detection_mode',
];

/**
 * Get restricted features for beta test accounts.
 * Returns the full list of feature keys that are BLOCKED for beta accounts.
 */
export function getBetaRestrictedFeatures(): string[] {
  return [...BETA_RESTRICTED_FEATURE_KEYS];
}

/**
 * Get restricted features for beta test accounts, excluding any features that
 * have been explicitly granted via Master Admin overrides or member allowedAddons.
 *
 * @param grantedFeatureKeys - Feature keys granted via overrides or allowedAddons
 *   (e.g. from useAddonOverrides or member.allowedAddons mapped through ADDON_KEY_TO_FEATURE_KEY)
 * @returns Array of feature keys that remain blocked after accounting for grants
 */
export function getBetaRestrictedFeaturesForUser(grantedFeatureKeys: Iterable<string>): string[] {
  const granted = new Set(grantedFeatureKeys);
  return BETA_RESTRICTED_FEATURE_KEYS.filter(k => !granted.has(k));
}

/**
 * Check if user should get beta UI customizations
 * Applies to: not logged in users OR users with beta license/tag
 * @param user - Firebase user object (can be null for not logged in)
 * @param features - Array of enabled features from useLicenseEnforcement
 * @returns true if user should get beta customizations
 */
export function isBetaUser(
  user: { email?: string | null } | null | undefined,
  features?: string[]
): boolean {
  // Not logged in = beta UI
  if (!user) return true;

  // Has beta license marker = beta UI
  if (features?.includes('BETA_ACCOUNT')) return true;

  // Is in beta test accounts list = beta UI
  if (isBetaTestAccount(user.email)) return true;

  return false;
}

/**
 * Admin View Override
 * Allows master admin to switch between Beta and MeasurePRO+ views for testing
 */
export type AdminViewOverride = 'beta' | 'pro' | null;

const ADMIN_VIEW_OVERRIDE_KEY = 'admin_view_override';

/**
 * Get the current admin view override setting
 * @returns 'beta' | 'pro' | null
 */
export function getAdminViewOverride(): AdminViewOverride {
  try {
    const value = localStorage.getItem(ADMIN_VIEW_OVERRIDE_KEY);
    if (value === 'beta' || value === 'pro') {
      return value;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Set the admin view override
 * @param view - 'beta' | 'pro' | null (null clears the override)
 */
export function setAdminViewOverride(view: AdminViewOverride): void {
  try {
    if (view === null) {
      localStorage.removeItem(ADMIN_VIEW_OVERRIDE_KEY);
    } else {
      localStorage.setItem(ADMIN_VIEW_OVERRIDE_KEY, view);
    }
    // Dispatch a storage event so hooks can react
    window.dispatchEvent(new CustomEvent('admin-view-override-changed', { detail: view }));
  } catch {
    // Ignore localStorage errors
  }
}
