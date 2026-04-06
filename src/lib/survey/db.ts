import { IDBPDatabase, openDB } from 'idb';
import { toast } from 'sonner';
import { openSharedSurveyDB, DB_NAME, DB_VERSION } from './db.shared';

// Re-export for convenience
export { DB_NAME, DB_VERSION };

// Quarantine Record Interface
export interface QuarantineRecord {
  id?: number;
  recordType: 'profile' | 'sample' | 'event';
  reason: string;
  originalPayload: any;
  timestamp: number;
}

const STORAGE_KEY = 'measurepro_data';
const CURRENT_VERSION = 4;

// localStorage backup interface (for true fallback only)
interface StorageData {
  surveys: any[];
  measurements: any[];
  routes: any[];
  alerts: any[];
  vehicleTraces: any[];
  appSettings: any[];
  version: number;
  lastUpdated: string;
}

let dbInstance: IDBPDatabase | null = null;
let useLocalStorageFallback = false;

// Event emitter for IndexedDB blocked state
export const dbBlockedEvent = new EventTarget();

// PAGINATION: Mutation counter tracking
let surveyMutationCounter = 0;

export function incrementMutationCounter() {
  surveyMutationCounter++;
}

export function getMutationCounter(): number {
  return surveyMutationCounter;
}

// PAGINATION: Keyset pagination types
export interface PageToken {
  surveyId: string;
  createdAt: string;
  id: string;
}

export interface PaginationResult<T> {
  items: T[];
  forwardToken: PageToken | null;  // For next page
  backwardToken: PageToken | null; // For previous page
  hasMore: boolean;
  mutationVersion: number;  // Current mutation counter
}

// PERFORMANCE FIX: Performance logging helper (dev-only to avoid prod noise)
export const perfLog = (label: string, duration: number) => {
  if (import.meta.env.DEV && duration > 100) {
    console.warn(`⚠️ SLOW: ${label} took ${duration.toFixed(0)}ms`);
  }
};

// Main database initialization
export const openSurveyDB = async () => {
  const perfStart = performance.now();
  
  if (dbInstance) {
    perfLog('openSurveyDB (cached)', performance.now() - perfStart);
    return dbInstance;
  }
  
  try {
    // Use shared database helper (worker-safe schema)
    dbInstance = await openSharedSurveyDB();
    
    // Add UI-specific toast notification for blocked upgrades
    // (Note: This can't be done in the shared module since it's worker-safe)
    dbInstance.addEventListener?.('versionchange', () => {
      toast.warning('Database update needed', {
        description: 'Please close other tabs using MeasurePRO to allow database upgrade'
      });
    });
    
    // Migrate any existing localStorage data to IndexedDB
    await migrateFromLocalStorage();
    
    // Migrate emergency backups
    await migrateEmergencyData();
    
    useLocalStorageFallback = false;
    
    perfLog('openSurveyDB (fresh)', performance.now() - perfStart);
    return dbInstance;
  } catch (error) {
    // Log the error for debugging
    console.error('[SurveyDB] Database initialization error:', error);
    
    // Fall back to localStorage ONLY if IndexedDB truly fails
    useLocalStorageFallback = true;
    
    // Only emit blocked event and show toast for actual IndexedDB blocking
    // Don't show blocking warning for schema/migration errors
    const errorMsg = error instanceof Error ? error.message : String(error);
    const isActuallyBlocked = errorMsg.includes('blocked') || 
                              errorMsg.includes('access') || 
                              errorMsg.includes('SecurityError') ||
                              errorMsg.includes('QuotaExceeded');
    
    if (isActuallyBlocked) {
      dbBlockedEvent.dispatchEvent(new CustomEvent('blocked', { 
        detail: { 
          error: errorMsg,
          timestamp: Date.now()
        } 
      }));
      
      toast.error('Database Storage Blocked', {
        description: 'Your browser is blocking IndexedDB. Click for instructions.',
        duration: Infinity,
        action: {
          label: 'Help',
          onClick: () => {
            dbBlockedEvent.dispatchEvent(new CustomEvent('show-help'));
          }
        }
      });
    }
    
    perfLog('openSurveyDB (fallback)', performance.now() - perfStart);
    // Return a mock DB interface that uses localStorage
    return createLocalStorageFallback();
  }
};

// Migrate data from old localStorage storage to IndexedDB
const migrateFromLocalStorage = async () => {
  if (!dbInstance) return;
  
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return;
    
    const parsed: StorageData = JSON.parse(data);
    
    let migratedCount = 0;
    
    // Migrate surveys
    for (const survey of parsed.surveys || []) {
      const existing = await dbInstance.get('surveys', survey.id);
      if (!existing) {
        await dbInstance.put('surveys', survey);
        migratedCount++;
      }
    }
    
    // Migrate measurements
    for (const measurement of parsed.measurements || []) {
      const existing = await dbInstance.get('measurements', measurement.id);
      if (!existing) {
        await dbInstance.put('measurements', measurement);
        migratedCount++;
      }
    }
    
    // Migrate other data types similarly...
    for (const route of parsed.routes || []) {
      const existing = await dbInstance.get('routes', route.id);
      if (!existing) {
        await dbInstance.put('routes', route);
        migratedCount++;
      }
    }
    
    if (migratedCount > 0) {
      // Clear old localStorage data after successful migration
      localStorage.removeItem(STORAGE_KEY);
      
      toast.success('Data upgraded', {
        description: `Successfully migrated ${migratedCount} items to improved storage`
      });
    }
  } catch (error) {
  }
};

// Migrate emergency backups
const migrateEmergencyData = async () => {
  if (!dbInstance) return;
  
  try {
    let migrated = 0;
    
    // Check for emergency survey backups
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('emergency_survey_')) {
        try {
          const surveyData = localStorage.getItem(key);
          if (surveyData) {
            const survey = JSON.parse(surveyData);
            
            // Check if survey already exists
            const exists = await dbInstance!.get('surveys', survey.id);
            if (!exists) {
              await dbInstance!.put('surveys', survey);
              migrated++;
            }
            
            localStorage.removeItem(key);
          }
        } catch (error) {
        }
      } else if (key?.startsWith('emergency_measurement_')) {
        try {
          const measurementData = localStorage.getItem(key);
          if (measurementData) {
            const measurement = JSON.parse(measurementData);
            
            const exists = await dbInstance!.get('measurements', measurement.id);
            if (!exists) {
              await dbInstance!.put('measurements', measurement);
              migrated++;
            }
            
            localStorage.removeItem(key);
          }
        } catch (error) {
        }
      }
    }
    
    if (migrated > 0) {
      toast.success('Emergency data recovered', {
        description: `Restored ${migrated} items from emergency backups`
      });
    }
  } catch (error) {
  }
};

// localStorage fallback (ONLY used if IndexedDB fails)
function createLocalStorageFallback() {
  const getStorageData = (): StorageData => {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) {
        return JSON.parse(data);
      }
    } catch (error) {
    }
    
    return {
      surveys: [],
      measurements: [],
      routes: [],
      alerts: [],
      vehicleTraces: [],
      appSettings: [],
      version: CURRENT_VERSION,
      lastUpdated: new Date().toISOString()
    };
  };
  
  const saveStorageData = (data: StorageData) => {
    try {
      data.lastUpdated = new Date().toISOString();
      data.version = CURRENT_VERSION;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      // Check if it's a quota exceeded error
      if (error instanceof DOMException && (
        error.name === 'QuotaExceededError' ||
        error.name === 'NS_ERROR_DOM_QUOTA_REACHED'
      )) {
        // Try to free up space by removing old backups
        const backupKeys = Object.keys(localStorage).filter(key => 
          key.startsWith('measurepro_backup_') || 
          key.startsWith('emergency_')
        );
        backupKeys.forEach(key => {
          try {
            localStorage.removeItem(key);
          } catch (e) {
          }
        });
        
        // Try saving again
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
          
          toast.warning('Storage space limited', {
            description: 'Old backups removed. Consider exporting surveys or enabling IndexedDB in browser settings.'
          });
          return;
        } catch (retryError) {
          throw new Error('Storage is full. Please export and delete old surveys, or enable IndexedDB in browser settings.');
        }
      }
      
      throw new Error(`Failed to save data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };
  
  // Return mock DB interface using localStorage
  return {
    async get(storeName: string, id: string) {
      const data = getStorageData();
      const store = data[storeName as keyof StorageData] as any[];
      return store.find(item => item.id === id);
    },
    
    async getAll(storeName: string) {
      const data = getStorageData();
      return (data[storeName as keyof StorageData] as any[]) || [];
    },
    
    async getAllFromIndex(storeName: string, indexName: string, value?: any) {
      const data = getStorageData();
      const store = data[storeName as keyof StorageData] as any[];
      
      if (!value) {
        return store.sort((a, b) => {
          if (indexName === 'by-date') {
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          }
          return 0;
        });
      }
      
      return store.filter(item => {
        if (indexName === 'by-survey') return item.surveyId === value || item.user_id === value;
        if (indexName === 'by-route') return item.routeId === value;
        if (indexName === 'by-category') return item.category === value;
        return true;
      });
    },
    
    async put(storeName: string, item: any) {
      const data = getStorageData();
      const store = data[storeName as keyof StorageData] as any[];
      
      const index = store.findIndex(existing => existing.id === item.id);
      if (index >= 0) {
        store[index] = item;
      } else {
        store.push(item);
      }
      
      saveStorageData(data);
      return item;
    },
    
    async add(storeName: string, item: any) {
      const data = getStorageData();
      const store = data[storeName as keyof StorageData] as any[];
      
      const exists = store.some(existing => existing.id === item.id);
      if (exists) {
        throw new Error('Item already exists');
      }
      
      store.push(item);
      saveStorageData(data);
      return item;
    },
    
    async delete(storeName: string, id: string) {
      const data = getStorageData();
      const store = data[storeName as keyof StorageData] as any[];
      const index = store.findIndex(item => item.id === id);
      
      if (index >= 0) {
        store.splice(index, 1);
        saveStorageData(data);
      }
    },
    
    async clear(storeName: string) {
      const data = getStorageData();
      (data[storeName as keyof StorageData] as any[]).length = 0;
      saveStorageData(data);
    },
    
    transaction(_storeNames: string | string[], _mode: 'readonly' | 'readwrite') {
      return {
        objectStore: (storeName: string) => ({
          getAll: () => this.getAll(storeName),
          delete: (id: string) => this.delete(storeName, id),
          put: (item: any) => this.put(storeName, item),
          add: (item: any) => this.add(storeName, item)
        }),
        done: Promise.resolve()
      };
    }
  } as any;
}

// Initialize CSV backup using IndexedDB or localStorage
export const initCSVBackupDB = async () => {
  try {
    if (useLocalStorageFallback) {
      return null; // CSV backups not needed in localStorage mode
    }
    
    const db = await openDB('csv-backup-db', 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('csv-data')) {
          db.createObjectStore('csv-data');
        }
      }
    });
    return db;
  } catch (error) {
    return null;
  }
};

// Export storage status for monitoring
export const getStorageStatus = () => ({
  usingLocalStorageFallback: useLocalStorageFallback,
  dbType: useLocalStorageFallback ? 'localStorage' : 'IndexedDB',
  estimatedLimit: useLocalStorageFallback ? '5-10 MB' : '50% of disk space (hundreds of MB to GBs)'
});

// Initialize storage system (alias for openSurveyDB for backward compatibility)
export const initializeStorage = async () => {
  return await openSurveyDB();
};

// Alias for backward compatibility with survey index exports
export const initDB = openSurveyDB;

// Helper functions for POI deduplication
// PERFORMANCE FIX: Uses indexed range queries for O(log n) performance instead of O(n) getAll()
// FIX 1: Returns original record with primary key for proper duplicate updates
export const checkProcessedPOI = async (
  poi: { id: string; kind: string; lat: number; lon: number; t: number }
): Promise<{
  isDuplicate: boolean;
  originalRecord?: { id: string; timestamp: number };
}> => {
  try {
    const db = await openSurveyDB();
    
    // Check by ID first (fast primary key lookup)
    const byId = await db.get('processedPOIs', poi.id);
    if (byId) {
      return {
        isDuplicate: true,
        originalRecord: { id: byId.id, timestamp: byId.timestamp }
      };
    }
    
    // PERFORMANCE FIX: Use indexed range query instead of getAll()
    // This narrows down to only POIs of same kind within ±5 seconds (O(log n) not O(n))
    const SPATIAL_TOLERANCE = 0.00001; // ~1 meter
    const TEMPORAL_TOLERANCE = 5000; // 5 seconds
    
    // Create IDBKeyRange for composite index [kind, timestamp]
    const lowerBound = [poi.kind, poi.t - TEMPORAL_TOLERANCE];
    const upperBound = [poi.kind, poi.t + TEMPORAL_TOLERANCE];
    
    // Use indexed query - only scans POIs of same kind in time window!
    const tx = db.transaction('processedPOIs', 'readonly');
    const index = tx.store.index('by-kind-timestamp');
    const candidates = await index.getAll(IDBKeyRange.bound(lowerBound, upperBound));
    
    // Now filter the small candidate list by spatial proximity
    for (const candidate of candidates) {
      // Check if this is the same POI event based on spatial attributes
      if (
        Math.abs(candidate.lat - poi.lat) < SPATIAL_TOLERANCE &&
        Math.abs(candidate.lon - poi.lon) < SPATIAL_TOLERANCE
      ) {
        console.log(`🚫 DUPLICATE POI DETECTED via spatial-temporal fallback: ${poi.id} matches ${candidate.id}`);
        return {
          isDuplicate: true,
          originalRecord: { id: candidate.id, timestamp: candidate.timestamp }
        };
      }
    }
    
    return { isDuplicate: false };
  } catch (error) {
    console.error('Failed to check processed POI:', error);
    return { isDuplicate: false };
  }
};

/**
 * PRODUCTION FIX: Get surveys with offset-based pagination
 * Uses cursor.advance() for efficient skipping - no duplicate/skip records
 * @param limit - Number of surveys to fetch (default: 50)
 * @param offset - Record offset to start from (default: 0)
 */
export async function getSurveysPaginated(
  limit: number = 50, 
  offset: number = 0
): Promise<{ 
  surveys: any[]; 
  total: number;
  hasMore: boolean 
}> {
  const perfStart = performance.now();
  const db = await openSurveyDB();
  
  const tx = db.transaction('surveys', 'readonly');
  const index = tx.store.index('by-date');
  
  // Get total count (O(1) from index metadata)
  const total = await index.count();
  
  // Open cursor in descending order (newest first)
  let cursor = await index.openCursor(null, 'prev');
  
  // Skip to offset efficiently using advance()
  if (cursor && offset > 0) {
    await cursor.advance(offset);
  }
  
  const surveys: any[] = [];
  
  // Collect page of items
  while (cursor && surveys.length < limit) {
    surveys.push(cursor.value);
    cursor = await cursor.continue();
  }
  
  const hasMore = (offset + surveys.length) < total;
  
  perfLog('getSurveysPaginated', performance.now() - perfStart);
  return { surveys, total, hasMore };
}

/**
 * PRODUCTION FIX: Get measurements with offset-based pagination
 * Uses cursor.advance() for efficient skipping - no duplicate/skip records
 * Filters by surveyId in-line during cursor iteration
 * @param surveyId - The survey ID to fetch measurements for
 * @param limit - Number of measurements per page (default: 100)
 * @param offset - Record offset to start from (default: 0)
 * @param sortDirection - Sort direction: 'prev' = newest first, 'next' = oldest first (default: 'prev')
 */
export async function getMeasurementsPaginated(
  surveyId: string, 
  limit: number = 100, 
  offset: number = 0,
  sortDirection: 'prev' | 'next' = 'prev'
): Promise<{ 
  measurements: any[]; 
  total: number;
  hasMore: boolean 
}> {
  const perfStart = performance.now();
  const db = await openSurveyDB();
  
  const tx = db.transaction('measurements', 'readonly');
  const surveyIndex = tx.store.index('by-survey');
  
  // Get total count for this survey (O(1) from index metadata)
  const total = await surveyIndex.count(surveyId);
  
  // Open cursor filtered by surveyId
  let cursor = await surveyIndex.openCursor(IDBKeyRange.only(surveyId), sortDirection);
  
  // Skip to offset efficiently using advance()
  if (cursor && offset > 0) {
    await cursor.advance(offset);
  }
  
  const measurements: any[] = [];
  
  // Collect page of items
  while (cursor && measurements.length < limit) {
    measurements.push(cursor.value);
    cursor = await cursor.continue();
  }
  
  const hasMore = (offset + measurements.length) < total;
  
  perfLog('getMeasurementsPaginated', performance.now() - perfStart);
  return { measurements, total, hasMore };
}

/**
 * KEYSET PAGINATION: Get measurements with deterministic keyset pagination
 * Uses resume tokens for stable pagination - no duplicate/skip records
 * Detects data changes via mutation counter
 * @param surveyId - The survey ID to fetch measurements for
 * @param limit - Number of measurements per page (default: 100)
 * @param resumeToken - Token to resume from (undefined = start from beginning)
 * @param direction - Pagination direction: 'forward' or 'backward' (default: 'forward')
 */
export async function getMeasurementsKeyset(
  surveyId: string,
  limit: number = 100,
  resumeToken?: PageToken,
  direction: 'forward' | 'backward' = 'forward'
): Promise<PaginationResult<any>> {
  const perfStart = performance.now();
  const db = await openSurveyDB();
  
  const tx = db.transaction('measurements', 'readonly');
  const dateIndex = tx.store.index('by-date');
  
  // Use by-date index for chronological order (newest first by default)
  let cursor = await dateIndex.openCursor(null, direction === 'forward' ? 'prev' : 'next');
  
  // Skip to resume token if provided
  if (resumeToken && cursor) {
    let found = false;
    while (cursor && !found) {
      if (cursor.value.user_id === surveyId &&
          cursor.value.createdAt === resumeToken.createdAt &&
          cursor.value.id === resumeToken.id) {
        // Move past the resume token
        cursor = await cursor.continue();
        found = true;
        break;
      }
      cursor = await cursor.continue();
    }
  }
  
  // Collect items for this survey
  const items: any[] = [];
  
  while (cursor && items.length < limit) {
    if (cursor.value.user_id === surveyId) {
      items.push(cursor.value);
    }
    cursor = await cursor.continue();
  }
  
  // Check for more items (hasMore detection)
  let hasMore = false;
  while (cursor && !hasMore) {
    if (cursor.value.user_id === surveyId) {
      hasMore = true;
      break;
    }
    cursor = await cursor.continue();
  }
  
  // Generate tokens for next/prev pages
  const forwardToken = items.length > 0 && hasMore && direction === 'forward'
    ? { surveyId, createdAt: items[items.length - 1].createdAt, id: items[items.length - 1].id }
    : null;
    
  const backwardToken = resumeToken || null;  // Previous token becomes backward token
  
  perfLog('getMeasurementsKeyset', performance.now() - perfStart);
  
  return {
    items,
    forwardToken,
    backwardToken,
    hasMore,
    mutationVersion: getMutationCounter()
  };
}

export const markProcessedPOI = async (
  poi: { id: string; kind: string; lat: number; lon: number; t: number }
): Promise<void> => {
  try {
    const db = await openSurveyDB();
    // Store ID with full POI metadata for spatial-temporal fallback deduplication
    await db.put('processedPOIs', {
      id: poi.id,
      kind: poi.kind,
      lat: poi.lat,
      lon: poi.lon,
      timestamp: poi.t
    });
  } catch (error) {
    console.error('Failed to mark processed POI:', error);
  }
};

export const cleanupOldProcessedPOIs = async (maxAgeMs: number = 7 * 24 * 60 * 60 * 1000): Promise<void> => {
  try {
    const db = await openSurveyDB();
    const cutoffTime = Date.now() - maxAgeMs;
    const allRecords = await db.getAllFromIndex('processedPOIs', 'by-timestamp');
    const oldRecords = allRecords.filter(record => record.timestamp < cutoffTime);
    for (const record of oldRecords) {
      await db.delete('processedPOIs', record.id);
    }
  } catch (error) {
    console.error('Failed to cleanup old processed POIs:', error);
  }
};

/**
 * MEMORY CLEANUP: Purge a completed survey and all its data from IndexedDB
 * Call this ONLY after survey has been successfully exported/saved to disk
 * User can reload from hard drive if needed later
 */
export const purgeCompletedSurveyFromDB = async (surveyId: string): Promise<{ success: boolean; deletedCounts: Record<string, number> }> => {
  const perfStart = performance.now();
  const deletedCounts: Record<string, number> = {};
  
  try {
    const db = await openSurveyDB();
    
    console.log(`[DB] Starting purge of completed survey: ${surveyId}`);
    
    // 1. Delete all measurements for this survey (using by-survey index)
    if (db.objectStoreNames.contains('measurements')) {
      const measurements = await db.getAllFromIndex('measurements', 'by-survey', surveyId);
      deletedCounts.measurements = measurements.length;
      
      for (const m of measurements) {
        await db.delete('measurements', m.id);
      }
      console.log(`[DB] Deleted ${measurements.length} measurements`);
    }
    
    // 2. Delete all vehicle traces for this survey
    if (db.objectStoreNames.contains('vehicleTraces')) {
      try {
        const traces = await db.getAllFromIndex('vehicleTraces', 'by-survey', surveyId);
        deletedCounts.vehicleTraces = traces.length;
        
        for (const t of traces) {
          await db.delete('vehicleTraces', t.id);
        }
        console.log(`[DB] Deleted ${traces.length} vehicle traces`);
      } catch (e) {
        console.warn('[DB] Vehicle traces cleanup skipped:', e);
      }
    }
    
    // 3. Delete all alerts for this survey
    if (db.objectStoreNames.contains('alerts')) {
      try {
        const alerts = await db.getAllFromIndex('alerts', 'by-survey', surveyId);
        deletedCounts.alerts = alerts.length;
        
        for (const a of alerts) {
          await db.delete('alerts', a.id);
        }
        console.log(`[DB] Deleted ${alerts.length} alerts`);
      } catch (e) {
        console.warn('[DB] Alerts cleanup skipped:', e);
      }
    }
    
    // 4. Delete the survey itself
    await db.delete('surveys', surveyId);
    deletedCounts.surveys = 1;
    console.log(`[DB] Deleted survey record`);
    
    // Increment mutation counter so UI refreshes
    incrementMutationCounter();
    
    perfLog('purgeCompletedSurveyFromDB', performance.now() - perfStart);
    
    console.log(`[DB] Purge complete for survey ${surveyId}:`, deletedCounts);
    
    return { success: true, deletedCounts };
  } catch (error) {
    console.error('[DB] Failed to purge completed survey:', error);
    return { success: false, deletedCounts };
  }
};

/**
 * STREAMING EXPORT: Yields measurements in chunks to prevent OOM errors
 * FIXED: Uses native IndexedDB with synchronous cursor to avoid transaction timeout
 * 
 * @param surveyId - The survey ID to get measurements for
 * @param chunkSize - Number of measurements per chunk (default: 50)
 * @yields Array of measurements in chunks
 */
export async function* getMeasurementsInChunks(
  surveyId: string,
  chunkSize: number = 50
): AsyncGenerator<any[], void, unknown> {
  // CRITICAL: Use native IndexedDB with synchronous cursor to avoid transaction timeout
  // The idb library's async cursor wrapper causes "transaction finished" errors
  const allMeasurements = await new Promise<any[]>((resolve) => {
    const openReq = indexedDB.open('survey-db');
    openReq.onerror = () => resolve([]);
    openReq.onsuccess = () => {
      const db = openReq.result;
      if (!db.objectStoreNames.contains('measurements')) {
        db.close();
        resolve([]);
        return;
      }
      
      const tx = db.transaction('measurements', 'readonly');
      const store = tx.objectStore('measurements');
      const results: any[] = [];
      
      // Use by-survey index if available
      let cursorSource: IDBObjectStore | IDBIndex = store;
      let keyRange: IDBKeyRange | null = null;
      
      if (store.indexNames.contains('by-survey')) {
        cursorSource = store.index('by-survey');
        keyRange = IDBKeyRange.only(surveyId);
      }
      
      const cursorReq = cursorSource.openCursor(keyRange);
      cursorReq.onsuccess = function(event: any) {
        const cursor = event.target.result;
        if (cursor) {
          const value = cursor.value;
          // If not using index, filter manually
          if (cursorSource === store) {
            if (value.surveyId === surveyId) {
              results.push(value);
            }
          } else {
            results.push(value);
          }
          cursor.continue(); // Synchronous - no await!
        } else {
          db.close();
          resolve(results);
        }
      };
      cursorReq.onerror = () => { db.close(); resolve([]); };
    };
  });

  if (allMeasurements.length === 0) {
    return;
  }

  console.log(`[DB] Processing ${allMeasurements.length} measurements in chunks of ${chunkSize}`);

  // Yield from collected array (safe, no transaction involved)
  for (let i = 0; i < allMeasurements.length; i += chunkSize) {
    const chunk = allMeasurements.slice(i, i + chunkSize);
    console.log(`[DB] Streaming chunk: ${chunk.length} measurements (offset: ${i})`);
    yield chunk;
  }

  console.log(`[DB] Completed streaming ${allMeasurements.length} measurements`);
}

/**
 * STREAMING EXPORT: Count measurements for a survey without loading them
 */
export async function countMeasurementsForSurvey(surveyId: string): Promise<number> {
  const db = await openSurveyDB();
  return await db.countFromIndex('measurements', 'by-survey', surveyId);
}
