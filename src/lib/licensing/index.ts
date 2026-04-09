import { API_BASE_URL } from '@/lib/config/environment';
import type {
  LicenseFeature,
  LicensePackage,
  ActivationCode,
  UserLicense,
  UserDevice,
  InsertLicenseFeature,
  InsertLicensePackage,
  InsertActivationCode,
  LicenseValidationResult,
  ActivationRequest,
} from '../../../shared/schema';
import {
  updateCachedFeatureSnapshot,
  getCachedFeatureSnapshot,
  getEffectiveNowMs,
  updateMonotonicFloor,
  type CachedFeatureSnapshot,
} from '../auth/offlineAuth';
import {
  createLicenseFeatureAPI,
  updateLicenseFeatureAPI,
  deleteLicenseFeatureAPI,
  getAllLicenseFeaturesAPI,
  createLicensePackageAPI,
  updateLicensePackageAPI,
  deleteLicensePackageAPI,
  getAllLicensePackagesAPI,
  generateActivationCodeAPI,
  deactivateActivationCodeAPI,
  deleteActivationCodeAPI,
  getAllActivationCodesAPI,
  activateLicenseCodeAPI,
  getUserLicensesAPI,
  getAllUserLicensesAPI,
  deactivateUserLicenseAPI,
  getUserDevicesAPI,
  deactivateDeviceAPI,
  deleteDeviceAPI,
  getAllDevicesAPI,
} from './cloudFunctionsAPI';

// ==================== DEVICE FINGERPRINTING ====================

/**
 * Generate a device fingerprint based on browser properties
 * This is not perfect security, but provides reasonable device tracking
 */
export function generateDeviceFingerprint(): string {
  const components = [
    navigator.userAgent,
    navigator.language,
    new Date().getTimezoneOffset().toString(),
    screen.colorDepth.toString(),
    screen.width + 'x' + screen.height,
    navigator.hardwareConcurrency?.toString() || '0',
    navigator.platform,
  ];

  const fingerprint = components.join('|');
  return hashString(fingerprint);
}

/**
 * Simple hash function for fingerprinting
 */
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Get current device info for registration
 */
export function getDeviceInfo() {
  return {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    screenResolution: `${screen.width}x${screen.height}`,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    language: navigator.language,
  };
}

/**
 * Generate a friendly device name
 */
export function generateDeviceName(): string {
  const ua = navigator.userAgent;
  let browser = 'Unknown Browser';
  let os = 'Unknown OS';

  // Detect browser
  if (ua.includes('Chrome') && !ua.includes('Edg')) browser = 'Chrome';
  else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari';
  else if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Edg')) browser = 'Edge';

  // Detect OS
  if (ua.includes('Win')) os = 'Windows';
  else if (ua.includes('Mac')) os = 'Mac';
  else if (ua.includes('Linux')) os = 'Linux';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iOS')) os = 'iOS';

  return `${browser} on ${os}`;
}

// ==================== ACTIVATION CODE GENERATION ====================

/**
 * Generate a secure activation code
 * Format: MPRO-[TYPE]-[RANDOM]-[CHECKSUM]
 */
export function generateActivationCodeString(type: 'FEAT' | 'PACK' = 'FEAT'): string {
  const randomPart = generateRandomString(4);
  const checksum = generateChecksum(`MPRO${type}${randomPart}`);
  return `MPRO-${type}-${randomPart}-${checksum}`;
}

function generateRandomString(length: number): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude similar chars
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function generateChecksum(input: string): string {
  const hash = hashString(input);
  return hash.substring(0, 4).toUpperCase();
}

/**
 * Validate activation code format
 */
export function validateActivationCodeFormat(code: string): boolean {
  const pattern = /^MPRO-(FEAT|PACK)-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
  return pattern.test(code);
}

// ==================== DURATION HELPERS ====================

/**
 * Convert duration string to days
 */
export function durationToDays(duration: '1month' | '3months' | '6months' | '12months' | 'lifetime'): number {
  switch (duration) {
    case '1month': return 30;
    case '3months': return 90;
    case '6months': return 180;
    case '12months': return 365;
    case 'lifetime': return 36500; // 100 years
    default: return 30;
  }
}

/**
 * Calculate expiry date from activation date
 */
export function calculateExpiryDate(activatedAt: string, durationDays: number): string | null {
  if (durationDays >= 36500) return null; // Lifetime
  const date = new Date(activatedAt);
  date.setDate(date.getDate() + durationDays);
  return date.toISOString();
}

// ==================== LICENSE FEATURE CRUD ====================

export async function createLicenseFeature(data: InsertLicenseFeature): Promise<void> {
  await createLicenseFeatureAPI(data);
}

export async function getAllLicenseFeatures(): Promise<LicenseFeature[]> {
  return await getAllLicenseFeaturesAPI();
}

export async function updateLicenseFeature(id: string, data: Partial<InsertLicenseFeature>): Promise<void> {
  await updateLicenseFeatureAPI(id, data as InsertLicenseFeature);
}

export async function deleteLicenseFeature(id: string): Promise<void> {
  await deleteLicenseFeatureAPI(id);
}

// ==================== LICENSE PACKAGE CRUD ====================

export async function createLicensePackage(data: InsertLicensePackage): Promise<void> {
  await createLicensePackageAPI(data);
}

export async function getAllLicensePackages(): Promise<LicensePackage[]> {
  return await getAllLicensePackagesAPI();
}

export async function updateLicensePackage(id: string, data: Partial<InsertLicensePackage>): Promise<void> {
  await updateLicensePackageAPI(id, data as InsertLicensePackage);
}

export async function deleteLicensePackage(id: string): Promise<void> {
  await deleteLicensePackageAPI(id);
}

// ==================== ACTIVATION CODE CRUD ====================

export async function createActivationCode(data: InsertActivationCode): Promise<void> {
  await generateActivationCodeAPI(data);
}

export async function getAllActivationCodes(): Promise<ActivationCode[]> {
  return await getAllActivationCodesAPI();
}

export async function deactivateActivationCode(id: string): Promise<void> {
  await deactivateActivationCodeAPI(id);
}

export async function deleteActivationCode(id: string): Promise<void> {
  await deleteActivationCodeAPI(id);
}

// ==================== USER LICENSE CRUD ====================

export async function getUserLicenses(): Promise<UserLicense[]> {
  return await getUserLicensesAPI();
}

export async function getAllUserLicenses(): Promise<UserLicense[]> {
  return await getAllUserLicensesAPI();
}

export async function deactivateUserLicense(id: string): Promise<void> {
  await deactivateUserLicenseAPI(id);
}

// ==================== USER DEVICE CRUD ====================

export async function getUserDevices(): Promise<UserDevice[]> {
  return await getUserDevicesAPI();
}

export async function getAllDevices(): Promise<UserDevice[]> {
  return await getAllDevicesAPI();
}

export async function deactivateDevice(deviceId: string): Promise<void> {
  await deactivateDeviceAPI(deviceId);
}

export async function deleteDevice(deviceId: string): Promise<void> {
  await deleteDeviceAPI(deviceId);
}

// ==================== LICENSE VALIDATION ====================

/**
 * Check if user has a specific feature
 */
export async function validateUserFeature(featureKey: string): Promise<LicenseValidationResult> {
  const licenses = await getUserLicenses();
  const packages = await getAllLicensePackages();
  const now = new Date();

  for (const license of licenses) {
    if (!license.isActive) continue;

    // Check expiry
    if (license.expiresAt) {
      const expiryDate = new Date(license.expiresAt);
      if (now > expiryDate) continue;
    }

    // Check if license covers this feature
    if (license.licenseType === 'feature' && license.featureKey === featureKey) {
      return {
        isValid: true,
        hasFeature: true,
        expiresAt: license.expiresAt || undefined,
        daysRemaining: license.expiresAt ? Math.ceil((new Date(license.expiresAt).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : undefined,
      };
    }

    // Check if package includes this feature
    if (license.licenseType === 'package' && license.packageId) {
      const package_ = packages.find(p => p.id === license.packageId);
      if (package_ && package_.featureKeys.includes(featureKey)) {
        return {
          isValid: true,
          hasFeature: true,
          expiresAt: license.expiresAt || undefined,
          daysRemaining: license.expiresAt ? Math.ceil((new Date(license.expiresAt).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : undefined,
        };
      }
    }
  }

  return {
    isValid: false,
    hasFeature: false,
    reason: 'No valid license found for this feature',
  };
}

// Module-level singleton: ensures only one in-flight snapshot sync at a time.
// Multiple components calling getUserEnabledFeatures() concurrently will all
// await the same promise rather than each firing a separate HTTP request.
let _snapshotSyncInFlight: Promise<void> | null = null;

/**
 * Fetch a fresh server-signed feature snapshot from the backend and persist it to IndexedDB.
 *
 * This is separated from `getUserEnabledFeatures` so the explicit "Verify Now" UI path can
 * await the snapshot write before reading `featureSnapshotSyncAt`, ensuring "Last verified"
 * is immediately fresh without a race between fire-and-forget writes and UI reads.
 *
 * @param authUser - Firebase User with a valid ID token (caller must ensure non-null)
 */
export async function syncFeatureSnapshot(authUser: { getIdToken: () => Promise<string> }): Promise<void> {
  const idToken = await authUser.getIdToken();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  let resp: Response;
  try {
    resp = await fetch(`${API_BASE_URL}/api/auth/feature-snapshot`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({}),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
  clearTimeout(timer);
  if (!resp.ok) throw new Error(`feature-snapshot returned ${resp.status}`);
  const data = await resp.json() as {
    success: boolean;
    features: Array<{ featureKey: string; expiresAtMs: number | null }>;
    serverNow: number;
    uid: string;
    signature: string;
  };
  if (data.success && data.signature) {
    const serverSnapshot: CachedFeatureSnapshot[] = data.features.map(f => ({
      featureKey: f.featureKey,
      expiresAtMs: f.expiresAtMs,
    }));
    await updateCachedFeatureSnapshot(serverSnapshot, data.serverNow, data.signature, data.uid);
  }
}

/**
 * Get all features enabled for a user.
 * Master admin has ALL features enabled.
 *
 * Offline behaviour:
 *  - When the Cloud Function call succeeds (online) the resolved feature keys are
 *    persisted to IndexedDB so they survive network loss.
 *  - When the call fails (offline / network error) the cached keys are returned
 *    automatically, keeping the user's access intact until they reconnect.
 */
export async function getUserEnabledFeatures(): Promise<string[]> {
  // Check if current user is master admin - if so, return all features
  const { getSafeAuth } = await import('../firebase');
  const auth = getSafeAuth();
  const currentUser = auth?.currentUser;
  
  if (currentUser) {
    const { isMasterAdmin } = await import('../auth/masterAdmin');
    if (isMasterAdmin(currentUser.email)) {
      // Master admin has access to all features
      // Return a comprehensive list of all known features
      try {
        const allFeatures = await getAllLicenseFeatures();
        return allFeatures.map(f => f.featureKey);
      } catch {
        // Offline: master admin always has access — return wildcard signal
        return ['*'];
      }
    }
  }

  try {
    const licenses = await getUserLicenses();
    const packages = await getAllLicensePackages();
    const now = new Date();

    // featureMap: featureKey → earliest expiresAtMs (null = lifetime)
    const featureMap = new Map<string, number | null>();

    const mergeExpiry = (key: string, expiresAtMs: number | null) => {
      const existing = featureMap.get(key);
      if (existing === undefined) {
        // New entry
        featureMap.set(key, expiresAtMs);
      } else if (existing === null || expiresAtMs === null) {
        // At least one is lifetime — lifetime wins
        featureMap.set(key, null);
      } else {
        // Keep the latest expiry (most permissive for offline access)
        featureMap.set(key, Math.max(existing, expiresAtMs));
      }
    };

    for (const license of licenses) {
      if (!license.isActive) continue;

      // Check expiry (skip already-expired licenses)
      if (license.expiresAt) {
        const expiryDate = new Date(license.expiresAt);
        if (now > expiryDate) continue;
      }

      const expiresAtMs = license.expiresAt ? new Date(license.expiresAt).getTime() : null;

      if (license.licenseType === 'feature' && license.featureKey) {
        mergeExpiry(license.featureKey, expiresAtMs);
      }

      if (license.licenseType === 'package' && license.packageId) {
        const package_ = packages.find(p => p.id === license.packageId);
        if (package_) {
          package_.featureKeys.forEach(key => mergeExpiry(key, expiresAtMs));
        }
      }
    }

    // Sync the server-signed snapshot, which includes company add-ons as Source C.
    // Uses a module-level singleton so concurrent calls don't each fire a separate
    // HTTP request. If no cached snapshot exists yet (first login), await the sync
    // so company add-ons are immediately included in the returned feature list.
    const authUser = currentUser; // already resolved from the top of the function
    if (authUser) {
      const existingCache = await getCachedFeatureSnapshot();
      if (existingCache === null) {
        // First time — sync synchronously so company add-ons appear on first load.
        if (!_snapshotSyncInFlight) {
          _snapshotSyncInFlight = syncFeatureSnapshot(authUser).finally(() => {
            _snapshotSyncInFlight = null;
          });
        }
        await _snapshotSyncInFlight.catch(() => {});
      } else {
        // Cache exists — refresh in the background, don't block the return.
        if (!_snapshotSyncInFlight) {
          _snapshotSyncInFlight = syncFeatureSnapshot(authUser).finally(() => {
            _snapshotSyncInFlight = null;
          });
          _snapshotSyncInFlight.catch(() => {});
        }
      }
    }

    // Merge cached snapshot features (includes company add-ons) into the feature map.
    // This ensures company members see their add-ons even with no individual licenses.
    const updatedCache = await getCachedFeatureSnapshot();
    if (updatedCache !== null) {
      const effectiveNow = getEffectiveNowMs(updatedCache.serverMs, updatedCache.clientMs, updatedCache.monotonicFloorMs);
      for (const s of updatedCache.snapshot) {
        if (s.expiresAtMs === null || s.expiresAtMs > effectiveNow) {
          mergeExpiry(s.featureKey, s.expiresAtMs);
        }
      }
    }

    const featureKeys = Array.from(featureMap.keys());
    return featureKeys;
  } catch (error) {
    // Network / Firebase unavailable — fall back to ECDSA-verified snapshot
    const cached = await getCachedFeatureSnapshot();
    if (cached !== null) {
      const effectiveNow = getEffectiveNowMs(cached.serverMs, cached.clientMs, cached.monotonicFloorMs);
      // Advance the persisted monotonic floor so time cannot go backward on the next reload.
      updateMonotonicFloor(effectiveNow).catch(() => {});
      const validKeys = cached.snapshot
        .filter(s => s.expiresAtMs === null || s.expiresAtMs > effectiveNow)
        .map(s => s.featureKey);
      return validKeys;
    }
    // No verified cache available yet — propagate so callers can handle gracefully
    throw error;
  }
}

/**
 * Activate a license code for current user
 */
export async function activateLicenseCode(request: ActivationRequest): Promise<{ success: boolean; error?: string; license?: UserLicense }> {
  return await activateLicenseCodeAPI(request);
}
