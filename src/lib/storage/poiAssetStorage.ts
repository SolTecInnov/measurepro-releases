/**
 * POI Asset Blob Storage
 * 
 * Stores image and drawing blobs separately from measurement records
 * to eliminate base64 duplication and reduce IndexedDB size by 60-80%.
 * 
 * Storage pattern:
 * - Measurement records store lightweight asset IDs (e.g., "img_abc123")
 * - This store holds the actual binary blobs keyed by those IDs
 * - Rendering retrieves blobs and creates object URLs on demand
 */

const DB_NAME = 'poi-assets-db';
const DB_VERSION = 1;
const STORE_NAME = 'assets';

export interface POIAsset {
  id: string;           // Format: img_{measurementId} or draw_{measurementId}
  type: 'image' | 'drawing' | 'thumbnail';
  blob: Blob;
  measurementId: string;
  surveyId: string;
  mimeType: string;
  size: number;         // Original blob size in bytes
  createdAt: string;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openAssetDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => {
      dbPromise = null;
      reject(request.error);
    };
    
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('by-measurement', 'measurementId', { unique: false });
        store.createIndex('by-survey', 'surveyId', { unique: false });
        store.createIndex('by-type', 'type', { unique: false });
        store.createIndex('by-created', 'createdAt', { unique: false });
      }
    };
  });
  
  return dbPromise;
}

/**
 * Save a blob asset to the store
 */
export async function saveAsset(asset: POIAsset): Promise<boolean> {
  try {
    const db = await openAssetDB();
    
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.put(asset);
      
      request.onsuccess = () => resolve(true);
      request.onerror = () => {
        console.warn('[POIAssetStorage] Failed to save asset:', asset.id, request.error);
        resolve(false);
      };
    });
  } catch (error) {
    console.error('[POIAssetStorage] Error saving asset:', error);
    return false;
  }
}

/**
 * Get an asset by ID
 */
export async function getAsset(id: string): Promise<POIAsset | null> {
  try {
    const db = await openAssetDB();
    
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(id);
      
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => resolve(null);
    });
  } catch (error) {
    return null;
  }
}

/**
 * Get all assets for a measurement
 */
export async function getAssetsForMeasurement(measurementId: string): Promise<POIAsset[]> {
  try {
    const db = await openAssetDB();
    
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const index = store.index('by-measurement');
      const request = index.getAll(measurementId);
      
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => resolve([]);
    });
  } catch (error) {
    return [];
  }
}

/**
 * Get all assets for a survey
 */
export async function getAssetsForSurvey(surveyId: string): Promise<POIAsset[]> {
  try {
    const db = await openAssetDB();
    
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const index = store.index('by-survey');
      const request = index.getAll(surveyId);
      
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => resolve([]);
    });
  } catch (error) {
    return [];
  }
}

/**
 * Delete an asset by ID
 */
export async function deleteAsset(id: string): Promise<boolean> {
  try {
    const db = await openAssetDB();
    
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.delete(id);
      
      request.onsuccess = () => resolve(true);
      request.onerror = () => resolve(false);
    });
  } catch (error) {
    return false;
  }
}

/**
 * Delete all assets for a survey
 */
export async function deleteAssetsForSurvey(surveyId: string): Promise<number> {
  try {
    const db = await openAssetDB();
    const assets = await getAssetsForSurvey(surveyId);
    
    if (assets.length === 0) return 0;
    
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      let deleted = 0;
      
      for (const asset of assets) {
        const request = store.delete(asset.id);
        request.onsuccess = () => deleted++;
      }
      
      tx.oncomplete = () => {
        console.log(`[POIAssetStorage] Deleted ${deleted} assets for survey ${surveyId}`);
        resolve(deleted);
      };
      tx.onerror = () => resolve(deleted);
    });
  } catch (error) {
    return 0;
  }
}

/**
 * Get total storage size for a survey
 */
export async function getSurveyAssetSize(surveyId: string): Promise<number> {
  const assets = await getAssetsForSurvey(surveyId);
  return assets.reduce((total, asset) => total + asset.size, 0);
}

/**
 * Get total storage size across all assets
 */
export async function getTotalAssetSize(): Promise<number> {
  try {
    const db = await openAssetDB();
    
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.openCursor();
      
      let totalSize = 0;
      
      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          totalSize += cursor.value.size || 0;
          cursor.continue();
        } else {
          resolve(totalSize);
        }
      };
      
      request.onerror = () => resolve(0);
    });
  } catch (error) {
    return 0;
  }
}

/**
 * Convert base64 data URL to Blob
 */
export function dataURLToBlob(dataURL: string): Blob | null {
  try {
    const parts = dataURL.split(',');
    if (parts.length !== 2) return null;
    
    const mimeMatch = parts[0].match(/:(.*?);/);
    if (!mimeMatch) return null;
    
    const mimeType = mimeMatch[1];
    const base64Data = parts[1];
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    return new Blob([bytes], { type: mimeType });
  } catch (error) {
    console.error('[POIAssetStorage] Failed to convert data URL to blob:', error);
    return null;
  }
}

/**
 * Convert Blob to base64 data URL (for legacy compatibility during migration)
 */
export function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Create a compressed thumbnail from an image blob
 */
export async function createThumbnail(
  imageBlob: Blob, 
  maxWidth: number = 320,
  quality: number = 0.7
): Promise<Blob | null> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(imageBlob);
    
    img.onload = () => {
      URL.revokeObjectURL(url);
      
      const canvas = document.createElement('canvas');
      const scale = Math.min(1, maxWidth / img.width);
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(null);
        return;
      }
      
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      
      canvas.toBlob(
        (blob) => resolve(blob),
        'image/webp',
        quality
      );
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    
    img.src = url;
  });
}

/**
 * Generate asset ID from measurement ID
 */
export function generateAssetId(measurementId: string, type: 'image' | 'drawing' | 'thumbnail'): string {
  const prefix = type === 'image' ? 'img' : type === 'drawing' ? 'draw' : 'thumb';
  return `${prefix}_${measurementId}`;
}

/**
 * Get asset count
 */
export async function getAssetCount(): Promise<number> {
  try {
    const db = await openAssetDB();
    
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.count();
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(0);
    });
  } catch (error) {
    return 0;
  }
}

/**
 * Clear all assets (use with caution!)
 */
export async function clearAllAssets(): Promise<boolean> {
  try {
    const db = await openAssetDB();
    
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.clear();
      
      request.onsuccess = () => resolve(true);
      request.onerror = () => resolve(false);
    });
  } catch (error) {
    return false;
  }
}

// Object URL cache to prevent memory leaks
const objectURLCache = new Map<string, string>();

/**
 * Get an object URL for an asset (with caching)
 */
export async function getAssetURL(assetId: string): Promise<string | null> {
  // Check cache first
  const cached = objectURLCache.get(assetId);
  if (cached) return cached;
  
  const asset = await getAsset(assetId);
  if (!asset) return null;
  
  const url = URL.createObjectURL(asset.blob);
  objectURLCache.set(assetId, url);
  return url;
}

/**
 * Revoke an object URL (call when component unmounts)
 */
export function revokeAssetURL(assetId: string): void {
  const url = objectURLCache.get(assetId);
  if (url) {
    URL.revokeObjectURL(url);
    objectURLCache.delete(assetId);
  }
}

/**
 * Revoke all cached object URLs for a survey
 */
export function revokeAllSurveyURLs(_surveyId?: string): void {
  // Clear all cached URLs (future: could track by survey for selective cleanup)
  for (const [id, url] of objectURLCache.entries()) {
    URL.revokeObjectURL(url);
    objectURLCache.delete(id);
  }
}

export default {
  saveAsset,
  getAsset,
  getAssetsForMeasurement,
  getAssetsForSurvey,
  deleteAsset,
  deleteAssetsForSurvey,
  getSurveyAssetSize,
  getTotalAssetSize,
  dataURLToBlob,
  blobToDataURL,
  createThumbnail,
  generateAssetId,
  getAssetCount,
  clearAllAssets,
  getAssetURL,
  revokeAssetURL,
  revokeAllSurveyURLs
};
