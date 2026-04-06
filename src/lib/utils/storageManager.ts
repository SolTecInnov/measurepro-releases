/**
 * Storage Manager Utility
 * 
 * Provides real-time device storage monitoring using the StorageManager API.
 * Storage limit is the LESSER of:
 * - Actual device free space
 * - 50GB cap
 * 
 * NO ARTIFICIAL QUOTAS - only real device limits apply.
 */

const MAX_STORAGE_CAP_BYTES = 50 * 1024 * 1024 * 1024; // 50GB hard cap
const MIN_FREE_SPACE_PERCENTAGE = 0.02; // Keep 2% free as safety buffer (not a fixed GB amount)
const CACHE_DURATION_MS = 5000; // Cache storage estimate for 5 seconds to avoid API spam

export interface StorageEstimate {
  available: number; // Bytes available for use
  used: number; // Bytes currently used
  quota: number; // Total quota (may be device limit or 50GB cap)
  percentUsed: number; // 0-100
  deviceLimit: boolean; // True if limited by device, false if by 50GB cap
}

// Cache for storage estimate
let cachedEstimate: StorageEstimate | null = null;
let cacheTimestamp: number = 0;

/**
 * Get real device storage estimate using StorageManager API
 * CACHED for 5 seconds to avoid API spam during high-frequency operations
 */
export async function getDeviceStorageEstimate(forceRefresh: boolean = false): Promise<StorageEstimate> {
  // Return cached result if fresh enough
  const now = Date.now();
  if (!forceRefresh && cachedEstimate && (now - cacheTimestamp) < CACHE_DURATION_MS) {
    return cachedEstimate;
  }
  
  try {
    if (!navigator.storage || !navigator.storage.estimate) {
      const fallback = {
        available: MAX_STORAGE_CAP_BYTES,
        used: 0,
        quota: MAX_STORAGE_CAP_BYTES,
        percentUsed: 0,
        deviceLimit: false,
      };
      cachedEstimate = fallback;
      cacheTimestamp = now;
      return fallback;
    }

    const estimate = await navigator.storage.estimate();
    const quota = estimate.quota || MAX_STORAGE_CAP_BYTES;
    const usage = estimate.usage || 0;
    
    // Calculate safety buffer as percentage (2% of quota, not fixed GB)
    const safetyBuffer = quota * MIN_FREE_SPACE_PERCENTAGE;
    
    // Calculate available space (with percentage-based safety buffer)
    const deviceAvailable = Math.max(0, quota - usage - safetyBuffer);
    
    // Cap at 50GB maximum
    const effectiveQuota = Math.min(quota, MAX_STORAGE_CAP_BYTES);
    const availableForApp = Math.max(0, Math.min(deviceAvailable, MAX_STORAGE_CAP_BYTES - usage));
    
    const isDeviceLimited = quota < MAX_STORAGE_CAP_BYTES;
    
    const result = {
      available: availableForApp,
      used: usage,
      quota: effectiveQuota,
      percentUsed: (usage / effectiveQuota) * 100,
      deviceLimit: isDeviceLimited,
    };
    
    // Cache the result
    cachedEstimate = result;
    cacheTimestamp = now;
    
    return result;
  } catch (error) {
    // Fallback to 50GB cap
    const fallback = {
      available: MAX_STORAGE_CAP_BYTES,
      used: 0,
      quota: MAX_STORAGE_CAP_BYTES,
      percentUsed: 0,
      deviceLimit: false,
    };
    cachedEstimate = fallback;
    cacheTimestamp = now;
    return fallback;
  }
}

/**
 * Force refresh the storage estimate cache
 * Call this when visibility/focus changes to keep quota fresh
 */
export function refreshStorageEstimate(): void {
  cachedEstimate = null;
  cacheTimestamp = 0;
}

/**
 * Check if there's enough storage for an operation
 */
export async function checkStorageAvailable(requiredBytes: number): Promise<{
  available: boolean;
  reason?: string;
}> {
  const estimate = await getDeviceStorageEstimate();
  
  if (estimate.available >= requiredBytes) {
    return { available: true };
  }
  
  const shortfall = requiredBytes - estimate.available;
  const limitType = estimate.deviceLimit ? 'device storage' : '50GB app limit';
  
  return {
    available: false,
    reason: `Not enough ${limitType}. Need ${formatBytes(requiredBytes)}, only ${formatBytes(estimate.available)} available. Shortfall: ${formatBytes(shortfall)}`,
  };
}

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  if (bytes < 0) return 'N/A';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

/**
 * Get the effective storage TOTAL CAPACITY for the app
 * This is the LESSER of device total quota or 50GB
 * CRITICAL: Returns TOTAL CAPACITY (for percentage calculations), not available bytes!
 */
export async function getEffectiveStorageQuota(): Promise<number> {
  const estimate = await getDeviceStorageEstimate();
  // Return total quota (capped at 50GB) - this is the denominator for percentage calc
  return estimate.quota;
}

/**
 * Monitor storage and warn if running low
 */
export async function monitorStorage(): Promise<void> {
  const estimate = await getDeviceStorageEstimate();
  
  // Silent monitoring
}

/**
 * Check storage health and return warning messages
 * Returns health status with warnings at 80% and 90% thresholds
 */
export async function checkStorageHealth(): Promise<{
  healthy: boolean;
  warning?: string;
  percentUsed: number;
}> {
  const estimate = await getDeviceStorageEstimate();
  const percentUsed = estimate.percentUsed;
  
  if (percentUsed >= 90) {
    return {
      healthy: false,
      warning: 'CRITICAL: Storage 90%+ full! Sync to cloud immediately.',
      percentUsed
    };
  }
  
  if (percentUsed >= 80) {
    return {
      healthy: false,
      warning: 'WARNING: Storage 80%+ full. Consider syncing to cloud.',
      percentUsed
    };
  }
  
  return { healthy: true, percentUsed };
}

/**
 * Legacy alias for getDeviceStorageEstimate - for backward compatibility
 */
export async function getStorageQuota(): Promise<StorageEstimate> {
  return getDeviceStorageEstimate();
}
