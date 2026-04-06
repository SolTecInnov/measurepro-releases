/**
 * Detection Image Storage
 * CRITICAL PERFORMANCE FIX: Store detection images in IndexedDB to eliminate
 * 300-750MB memory copies from React state array spreads
 */

import { logger } from '@/lib/utils/logger';

const DB_NAME = 'measurepro-detections';
const DB_VERSION = 1;
const IMAGES_STORE = 'detectionImages';

export interface DetectionAssetRef {
  imageId: string;
  capturedAt: number;
  overlaySnapshot?: any; // minimal metadata only
}

/**
 * Convert base64 data URL to Blob
 */
function dataURLtoBlob(dataURL: string): Blob {
  const arr = dataURL.split(',');
  const mimeMatch = arr[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
}

/**
 * Convert Blob to base64 data URL
 */
function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Open IndexedDB connection
 */
function openDetectionDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(IMAGES_STORE)) {
        const store = db.createObjectStore(IMAGES_STORE, { keyPath: 'id' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        logger.debug('✅ Created detectionImages object store');
      }
    };
  });
}

/**
 * Save detection image to IndexedDB
 * CRITICAL: This replaces storing base64 in React state
 * @param dataUrl Base64 data URL
 * @returns Promise<string> imageId for reference
 */
export async function saveDetectionImage(dataUrl: string): Promise<string> {
  try {
    const imageId = crypto.randomUUID();
    const blob = dataURLtoBlob(dataUrl);
    const timestamp = Date.now();
    
    const db = await openDetectionDB();
    const transaction = db.transaction(IMAGES_STORE, 'readwrite');
    const store = transaction.objectStore(IMAGES_STORE);
    
    await store.add({
      id: imageId,
      blob: blob,
      timestamp: timestamp
    });
    
    logger.debug(`💾 Saved detection image: ${imageId} (${(blob.size / 1024).toFixed(1)} KB)`);
    return imageId;
  } catch (error) {
    logger.error('Failed to save detection image:', error);
    throw error;
  }
}

/**
 * Get detection image from IndexedDB
 * @param id Image ID
 * @returns Promise<Blob | null>
 */
export async function getDetectionImage(id: string): Promise<Blob | null> {
  try {
    const db = await openDetectionDB();
    const transaction = db.transaction(IMAGES_STORE, 'readonly');
    const store = transaction.objectStore(IMAGES_STORE);
    
    const request = store.get(id);
    
    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        const result = request.result;
        if (result && result.blob) {
          logger.debug(`📥 Retrieved detection image: ${id}`);
          resolve(result.blob);
        } else {
          logger.warn(`⚠️ Detection image not found: ${id}`);
          resolve(null);
        }
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    logger.error('Failed to get detection image:', error);
    return null;
  }
}

/**
 * Get detection image as data URL (for compatibility)
 * @param id Image ID
 * @returns Promise<string | null>
 */
export async function getDetectionImageDataURL(id: string): Promise<string | null> {
  const blob = await getDetectionImage(id);
  if (!blob) return null;
  return blobToDataURL(blob);
}

/**
 * Delete detection image from IndexedDB
 * CRITICAL: Call this for orphaned/discarded detections
 * @param id Image ID
 */
export async function deleteDetectionImage(id: string): Promise<void> {
  try {
    const db = await openDetectionDB();
    const transaction = db.transaction(IMAGES_STORE, 'readwrite');
    const store = transaction.objectStore(IMAGES_STORE);
    
    await store.delete(id);
    logger.debug(`🗑️ Deleted detection image: ${id}`);
  } catch (error) {
    logger.error('Failed to delete detection image:', error);
  }
}

/**
 * Delete multiple detection images
 * @param ids Array of image IDs
 */
export async function deleteDetectionImages(ids: string[]): Promise<void> {
  try {
    const db = await openDetectionDB();
    const transaction = db.transaction(IMAGES_STORE, 'readwrite');
    const store = transaction.objectStore(IMAGES_STORE);
    
    for (const id of ids) {
      await store.delete(id);
    }
    logger.debug(`🗑️ Deleted ${ids.length} detection images`);
  } catch (error) {
    logger.error('Failed to delete detection images:', error);
  }
}

/**
 * Get all detection image IDs
 * @returns Promise<string[]>
 */
export async function getAllDetectionImageIds(): Promise<string[]> {
  try {
    const db = await openDetectionDB();
    const transaction = db.transaction(IMAGES_STORE, 'readonly');
    const store = transaction.objectStore(IMAGES_STORE);
    
    const request = store.getAllKeys();
    
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result as string[]);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    logger.error('Failed to get detection image IDs:', error);
    return [];
  }
}

/**
 * Clear all detection images older than specified age
 * CRITICAL: Periodic cleanup of orphaned images
 * @param maxAgeMs Maximum age in milliseconds (default: 24 hours)
 */
export async function clearOldDetectionImages(maxAgeMs: number = 24 * 60 * 60 * 1000): Promise<number> {
  try {
    const db = await openDetectionDB();
    const transaction = db.transaction(IMAGES_STORE, 'readwrite');
    const store = transaction.objectStore(IMAGES_STORE);
    const index = store.index('timestamp');
    
    const cutoffTime = Date.now() - maxAgeMs;
    const range = IDBKeyRange.upperBound(cutoffTime);
    const request = index.openCursor(range);
    
    let deletedCount = 0;
    
    return new Promise((resolve, reject) => {
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          cursor.delete();
          deletedCount++;
          cursor.continue();
        } else {
          logger.debug(`🧹 Cleared ${deletedCount} old detection images`);
          resolve(deletedCount);
        }
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    logger.error('Failed to clear old detection images:', error);
    return 0;
  }
}

/**
 * Get storage stats
 */
export async function getDetectionStorageStats(): Promise<{
  totalImages: number;
  totalSizeBytes: number;
}> {
  try {
    const db = await openDetectionDB();
    const transaction = db.transaction(IMAGES_STORE, 'readonly');
    const store = transaction.objectStore(IMAGES_STORE);
    
    const request = store.getAll();
    
    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        const results = request.result;
        const totalImages = results.length;
        const totalSizeBytes = results.reduce((sum, item) => {
          return sum + (item.blob ? item.blob.size : 0);
        }, 0);
        
        resolve({ totalImages, totalSizeBytes });
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    logger.error('Failed to get detection storage stats:', error);
    return { totalImages: 0, totalSizeBytes: 0 };
  }
}
