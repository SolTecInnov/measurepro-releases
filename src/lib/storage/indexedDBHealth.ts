/**
 * IndexedDB Health Check Utility
 * Detects if IndexedDB is available and functional before app initialization
 */

let healthCheckResult: boolean | null = null;

export async function checkIndexedDBHealth(): Promise<boolean> {
  if (healthCheckResult !== null) {
    return healthCheckResult;
  }

  try {
    if (typeof indexedDB === 'undefined') {
      console.error('IndexedDB not available in this browser');
      healthCheckResult = false;
      return false;
    }

    const testDB = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('__measurepro_healthcheck__', 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        console.error('Failed to open IndexedDB test database:', request.error);
        reject(request.error);
      };
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('test')) {
          db.createObjectStore('test');
        }
      };
    });

    await new Promise<void>((resolve, reject) => {
      const transaction = testDB.transaction(['test'], 'readwrite');
      const store = transaction.objectStore('test');
      const request = store.put({ timestamp: Date.now() }, 'healthcheck');
      request.onsuccess = () => resolve();
      request.onerror = () => {
        console.error('IndexedDB write test failed:', request.error);
        reject(request.error);
      };
    });

    testDB.close();

    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      const usagePercent = estimate.usage && estimate.quota
        ? (estimate.usage / estimate.quota) * 100
        : 0;

      if (usagePercent > 95) {
        console.error(`Storage quota critical: ${usagePercent.toFixed(1)}% used`);
        healthCheckResult = false;
        return false;
      }
    }

    healthCheckResult = true;
    return true;

  } catch (error: any) {
    console.error('IndexedDB health check failed:', {
      errorName: error?.name,
      errorMessage: error?.message,
      errorCode: error?.code,
    });
    healthCheckResult = false;
    return false;
  }
}

export async function clearAllIndexedDBDatabases(): Promise<void> {
  const databases = [
    // Main survey database
    'survey-db',
    // Asset / media stores
    'poi-assets-db',
    'measurepro-detections',
    'geo-video-recordings-db',
    'MeasureProVideo',
    'MeasurePRO_PointClouds',
    // Feature stores
    'routes-db',
    'routeEnforcementDB',
    'alignment-profiles-db',
    'calibration-storage',
    'training-data-db',
    'company-offline-db',
    'MeasurePRO',
    // Auth & sync
    'measurements-db',
    'firebase-sync-queue',
    'audit-queue-db',
    // Legacy databases (may exist from older installs)
    'measurepro-v2',
    'ConvoyVideoStore',
    'csv-backup-db',
    'offline-auth-db',
    'measurepro-recovery',
    // Health check
    '__measurepro_healthcheck__',
  ];

  for (const dbName of databases) {
    try {
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.deleteDatabase(dbName);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
        request.onblocked = () => {
          console.warn(`Deletion blocked for: ${dbName}`);
          resolve();
        };
      });
    } catch (error) {
      console.error(`Failed to delete ${dbName}:`, error);
    }
  }

  healthCheckResult = null;
  console.log('All IndexedDB databases cleared. Please reload the page.');
}

// Expose globally for debugging
if (typeof window !== 'undefined') {
  (window as any).clearAllDatabases = clearAllIndexedDBDatabases;
  (window as any).checkDBHealth = checkIndexedDBHealth;
}
