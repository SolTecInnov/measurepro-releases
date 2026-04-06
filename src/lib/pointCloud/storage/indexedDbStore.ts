/**
 * IndexedDB Storage for Point Cloud Frames
 * 
 * STORAGE STRATEGY:
 * - Point data (large binary) stored in IndexedDB
 * - Metadata stored in PostgreSQL
 * - Quota enforcement based on license tier
 * - Background cleanup of old scans
 */

import { openDB, IDBPDatabase } from 'idb';
import type { PointCloudFrame } from '../types';

const DB_NAME = 'MeasurePRO_PointClouds';
const DB_VERSION = 1;
const STORE_NAME = 'frames';
const SCANS_STORE_NAME = 'scans_metadata';

interface ScanMetadata {
  scanId: string;
  totalFrames: number;
  totalPoints: number;
  storageSizeBytes: number;
  lastModified: number;
}

async function initDB(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Frames store - stores actual point cloud data
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const frameStore = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        frameStore.createIndex('scanId', 'scanId', { unique: false });
        frameStore.createIndex('scanId_frameNumber', ['scanId', 'frameNumber'], { unique: true });
      }

      // Scan metadata store - tracks storage usage
      if (!db.objectStoreNames.contains(SCANS_STORE_NAME)) {
        db.createObjectStore(SCANS_STORE_NAME, { keyPath: 'scanId' });
      }
    },
  });
}

/**
 * Save a point cloud frame to IndexedDB
 */
export async function saveFrame(frame: PointCloudFrame): Promise<void> {
  const db = await initDB();
  
  try {
    await db.put(STORE_NAME, frame);
    
    // Update scan metadata
    await updateScanMetadata(db, frame.scanId, {
      totalFrames: 1, // Will be accumulated
      totalPoints: frame.pointCount,
      storageSizeBytes: frame.points.byteLength + (frame.colors?.byteLength || 0),
    });
    
  } catch (error) {
    throw error;
  }
}

/**
 * Load a specific frame from IndexedDB
 */
export async function loadFrame(frameId: string): Promise<PointCloudFrame | null> {
  const db = await initDB();
  
  try {
    const frame = await db.get(STORE_NAME, frameId);
    return frame || null;
  } catch (error) {
    return null;
  }
}

/**
 * Load all frames for a scan
 */
export async function loadScanFrames(scanId: string): Promise<PointCloudFrame[]> {
  const db = await initDB();
  
  try {
    const index = db.transaction(STORE_NAME, 'readonly').store.index('scanId');
    const frames = await index.getAll(scanId);
    return frames;
  } catch (error) {
    return [];
  }
}

/**
 * Delete all frames for a scan
 */
export async function deleteScan(scanId: string): Promise<void> {
  const db = await initDB();
  
  try {
    const tx = db.transaction([STORE_NAME, SCANS_STORE_NAME], 'readwrite');
    
    // Delete all frames
    const frameStore = tx.objectStore(STORE_NAME);
    const index = frameStore.index('scanId');
    const keys = await index.getAllKeys(scanId);
    
    for (const key of keys) {
      await frameStore.delete(key);
    }
    
    // Delete metadata
    await tx.objectStore(SCANS_STORE_NAME).delete(scanId);
    
    await tx.done;
  } catch (error) {
    throw error;
  }
}

/**
 * Get total storage used across all scans
 */
export async function getStorageUsed(): Promise<number> {
  const db = await initDB();
  
  try {
    const scans = await db.getAll(SCANS_STORE_NAME);
    return scans.reduce((total, scan) => total + scan.storageSizeBytes, 0);
  } catch (error) {
    return 0;
  }
}

/**
 * Get storage used by a specific scan
 */
export async function getScanStorageUsed(scanId: string): Promise<number> {
  const db = await initDB();
  
  try {
    const metadata = await db.get(SCANS_STORE_NAME, scanId);
    return metadata?.storageSizeBytes || 0;
  } catch (error) {
    return 0;
  }
}

/**
 * Check if there's enough storage quota available
 */
export async function checkQuota(requiredBytes: number, quotaBytes: number): Promise<boolean> {
  const used = await getStorageUsed();
  return (used + requiredBytes) <= quotaBytes;
}

/**
 * Update scan metadata (accumulate stats)
 */
async function updateScanMetadata(
  db: IDBPDatabase,
  scanId: string,
  updates: Partial<Omit<ScanMetadata, 'scanId' | 'lastModified'>>
): Promise<void> {
  const existing = await db.get(SCANS_STORE_NAME, scanId) as ScanMetadata | undefined;
  
  const metadata: ScanMetadata = {
    scanId,
    totalFrames: (existing?.totalFrames || 0) + (updates.totalFrames || 0),
    totalPoints: (existing?.totalPoints || 0) + (updates.totalPoints || 0),
    storageSizeBytes: (existing?.storageSizeBytes || 0) + (updates.storageSizeBytes || 0),
    lastModified: Date.now(),
  };
  
  await db.put(SCANS_STORE_NAME, metadata);
}

/**
 * Get scan metadata by ID
 */
export async function getScanMetadata(scanId: string): Promise<ScanMetadata | null> {
  const db = await initDB();
  
  try {
    const metadata = await db.get(SCANS_STORE_NAME, scanId);
    return metadata || null;
  } catch (error) {
    return null;
  }
}

/**
 * Get all scan metadata
 */
export async function getAllScansMetadata(): Promise<ScanMetadata[]> {
  const db = await initDB();
  
  try {
    return await db.getAll(SCANS_STORE_NAME);
  } catch (error) {
    return [];
  }
}

/**
 * Compute bounds from all frames in a scan
 */
export async function computeScanBounds(scanId: string): Promise<{
  min: { x: number; y: number; z: number };
  max: { x: number; y: number; z: number };
} | null> {
  const frames = await loadScanFrames(scanId);
  
  if (frames.length === 0) {
    return null;
  }

  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

  for (const frame of frames) {
    const points = frame.points;
    for (let i = 0; i < points.length; i += 3) {
      const x = points[i];
      const y = points[i + 1];
      const z = points[i + 2];

      if (!isFinite(x) || !isFinite(y) || !isFinite(z)) continue;

      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      minZ = Math.min(minZ, z);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      maxZ = Math.max(maxZ, z);
    }
  }

  if (!isFinite(minX)) {
    return null;
  }

  return {
    min: { x: minX, y: minY, z: minZ },
    max: { x: maxX, y: maxY, z: maxZ },
  };
}

/**
 * Clean up old scans (keep only N most recent scans)
 */
export async function cleanupOldScans(keepCount: number = 10): Promise<void> {
  const db = await initDB();
  
  try {
    const scans = await db.getAll(SCANS_STORE_NAME);
    
    // Sort by last modified (newest first)
    scans.sort((a, b) => b.lastModified - a.lastModified);
    
    // Delete scans beyond keepCount
    const scansToDelete = scans.slice(keepCount);
    
    for (const scan of scansToDelete) {
      await deleteScan(scan.scanId);
    }
  } catch (error) {
  }
}

/**
 * Export scan data (for PLY/LAS export)
 */
export async function exportScanData(scanId: string): Promise<{
  frames: PointCloudFrame[];
  metadata: ScanMetadata | null;
}> {
  const db = await initDB();
  
  try {
    const frames = await loadScanFrames(scanId);
    const metadata = await db.get(SCANS_STORE_NAME, scanId) as ScanMetadata | null;
    
    return { frames, metadata };
  } catch (error) {
    return { frames: [], metadata: null };
  }
}
