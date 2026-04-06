import { getCurrentUser } from './firebase';
import { getDoc, doc, getFirestore } from 'firebase/firestore';
import { 
  updateLastOnline as updateAuthLastOnline,
  getAuthCache,
  updateAuthCacheTokens,
} from './auth/offlineAuth';
import { syncManager } from './sync';
import { flushAuditQueue } from './auditLog';

/**
 * Background Sync Service
 * 
 * Runs every 24 hours when online to:
 * 1. Reset offline countdown (update lastOnline timestamp)
 * 2. Sync license status from Firebase
 * 3. Sync local data to cloud
 * 4. Update feature flags
 */
export class BackgroundSyncService {
  private syncInterval: number | null = null;
  private readonly SYNC_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
  private isRunning = false;

  /**
   * Start the background sync service
   * Runs sync immediately, then every 24 hours
   */
  start() {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;

    // Run sync immediately on start (if online)
    this.performSync();

    // Then run every 24 hours
    this.syncInterval = window.setInterval(() => {
      this.performSync();
    }, this.SYNC_INTERVAL);
  }

  /**
   * Stop the background sync service
   */
  stop() {
    if (this.syncInterval) {
      window.clearInterval(this.syncInterval);
      this.syncInterval = null;
      this.isRunning = false;
    }
  }

  /**
   * Perform a complete background sync
   * This is the main sync method that coordinates all sync operations
   */
  async performSync(): Promise<boolean> {
    // Skip if offline
    if (!navigator.onLine) {
      return false;
    }

    // Skip if no user is logged in
    const user = getCurrentUser();
    if (!user) {
      return false;
    }

    try {
      // 0. Drain any offline-queued audit events now that we're online
      flushAuditQueue().catch(() => {});

      // 1. Update lastOnline timestamp (resets offline countdown)
      await this.updateLastOnline();

      // 2. Sync license status from Firebase
      await this.syncLicenseStatus();

      // 3. Sync local data to cloud (surveys, measurements, traces)
      await this.syncLocalData();

      // 4. Update feature flags
      await this.updateFeatureFlags();

      // 5. Refresh enabled feature keys cache for offline fallback
      await this.refreshEnabledFeatureKeysCache();
      
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Update lastOnline timestamp in auth cache
   * This resets the offline countdown timer
   */
  private async updateLastOnline(): Promise<void> {
    try {
      await updateAuthLastOnline();
    } catch (error) {
      throw error;
    }
  }

  /**
   * Sync license status from Firebase
   * Fetches the latest license data and updates local cache
   */
  private async syncLicenseStatus(): Promise<void> {
    try {
      const user = getCurrentUser();
      if (!user) {
        return;
      }

      // Get auth cache
      const authCache = await getAuthCache();
      if (!authCache) {
        return;
      }

      // Initialize Firestore
      const db = getFirestore();

      // Try to fetch license data from Firebase
      // Check multiple possible collections/locations
      let licenseData: any = null;

      // Try 'licenses' collection first
      try {
        const licenseDoc = await getDoc(doc(db, 'licenses', user.uid));
        if (licenseDoc.exists()) {
          licenseData = licenseDoc.data();
        }
      } catch (error) {
      }

      // If no license found, try 'users' collection with license subcollection
      if (!licenseData) {
        try {
          const userLicenseDoc = await getDoc(doc(db, 'users', user.uid, 'license', 'current'));
          if (userLicenseDoc.exists()) {
            licenseData = userLicenseDoc.data();
          }
        } catch (error) {
        }
      }

      // Update auth cache with license data
      await updateAuthCacheTokens(
        authCache.email,
        {
          accessToken: authCache.accessToken,
          refreshToken: authCache.refreshToken,
          tokenExpiry: authCache.tokenExpiry,
        },
        authCache.userProfile,
        licenseData ? {
          activationStatus: licenseData.activationStatus || false,
          expiryDate: licenseData.expiryDate || null,
          featureFlags: licenseData.featureFlags || null,
        } : authCache.licenseData
      );
    } catch (error) {
      // Don't throw - continue with other sync operations
    }
  }

  /**
   * Sync local data to cloud
   * Uses the existing syncManager to upload surveys, measurements, and traces
   */
  private async syncLocalData(): Promise<void> {
    try {
      // Check if there are pending changes
      const pendingCount = await syncManager.checkPendingChanges();
      
      if (pendingCount === 0) {
        return;
      }

      // Use the existing sync manager to perform the sync
      await syncManager.startSync();
    } catch (error) {
      // Don't throw - continue with other sync operations
    }
  }

  /**
   * Refresh the enabled feature keys cache for offline fallback.
   * Calls getUserEnabledFeatures() which persists the result to IndexedDB.
   * This is a background operation — errors are swallowed intentionally.
   */
  private async refreshEnabledFeatureKeysCache(): Promise<void> {
    try {
      const user = getCurrentUser();
      if (!user) return;
      // getUserEnabledFeatures() internally saves a signed feature snapshot to IndexedDB
      const { getUserEnabledFeatures } = await import('./licensing');
      await getUserEnabledFeatures();
    } catch {
      // Don't throw — this is a best-effort offline cache refresh
    }
  }

  /**
   * Update feature flags in local cache
   * Fetches latest feature flags from Firebase
   */
  private async updateFeatureFlags(): Promise<void> {
    try {
      const user = getCurrentUser();
      if (!user) {
        return;
      }

      const authCache = await getAuthCache();
      if (!authCache) {
        return;
      }

      // Initialize Firestore
      const db = getFirestore();

      // Try to fetch feature flags from Firebase
      let featureFlags: Record<string, boolean> = {};

      // Try 'featureFlags' collection
      try {
        const flagsDoc = await getDoc(doc(db, 'featureFlags', user.uid));
        if (flagsDoc.exists()) {
          featureFlags = flagsDoc.data() as Record<string, boolean>;
        }
      } catch (error) {
      }

      // If no dedicated flags doc, try to get from license data
      if (Object.keys(featureFlags).length === 0 && authCache.licenseData?.featureFlags) {
        featureFlags = authCache.licenseData.featureFlags;
      }

      // Update cache with feature flags
      if (Object.keys(featureFlags).length > 0) {
        await updateAuthCacheTokens(
          authCache.email,
          {
            accessToken: authCache.accessToken,
            refreshToken: authCache.refreshToken,
            tokenExpiry: authCache.tokenExpiry,
          },
          authCache.userProfile,
          authCache.licenseData ? {
            ...authCache.licenseData,
            featureFlags,
          } : null
        );
      }
    } catch (error) {
      // Don't throw - this is not critical
    }
  }
}

// Export a singleton instance for convenience
export const backgroundSyncService = new BackgroundSyncService();
