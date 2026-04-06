/**
 * Storage Worker
 * Handles all IndexedDB operations off the main thread:
 * - Batch POI writes
 * - Progressive video chunk saving
 * - Survey data persistence
 */

import { openDB, type IDBPDatabase } from 'idb';
import { openSharedSurveyDB } from '../survey/db.shared';

// Worker-specific logger (workers can't import the main logger)
// Only log in development mode (localhost or when DEBUG flag is set via message)
const DEV = self.location.hostname === 'localhost' || 
            self.location.hostname.includes('127.0.0.1') ||
            self.location.hostname.includes('.local');
const workerLogger = {
  error: (...args: any[]) => console.error(...args), // Always log errors
  warn: (...args: any[]) => DEV && console.warn(...args),
  log: (...args: any[]) => DEV && console.log(...args),
  debug: (...args: any[]) => DEV && console.log(...args)
};

interface StorageTask {
  id: string;
  type: 'addPOI' | 'saveMeasurement' | 'saveVideoChunk' | 'batch';
  data: any;
}

interface StorageResult {
  id: string;
  success: boolean;
  error?: string;
  data?: any;
}

// Queue for batch processing
const poiQueue: any[] = [];
let batchTimeout: number | null = null;
const BATCH_DELAY = 500; // 500ms batch window
const MAX_BATCH_SIZE = 10;

// Database instances - separate databases for different purposes
let surveyDb: IDBPDatabase | null = null;
let videoDb: IDBPDatabase | null = null;

// Initialize survey database (MUST match version in src/lib/survey/db.shared.ts)
async function initSurveyDB() {
  if (surveyDb) return surveyDb;

  surveyDb = await openSharedSurveyDB();

  return surveyDb;
}

// Initialize video database (MUST match GeoVideoRecorder schema)
async function initVideoDB() {
  if (videoDb) return videoDb;

  videoDb = await openDB('geo-video-recordings-db', 2, {
    upgrade(db, oldVersion) {
      if (!db.objectStoreNames.contains('videoRecordings')) {
        db.createObjectStore('videoRecordings', { keyPath: 'id' });
      }
      // Add videoChunks store for progressive saving
      if (oldVersion < 2 && !db.objectStoreNames.contains('videoChunks')) {
        const chunkStore = db.createObjectStore('videoChunks', { keyPath: 'id' });
        chunkStore.createIndex('by-recording', 'recordingId');
        chunkStore.createIndex('by-timestamp', 'timestamp');
      }
    },
  });

  return videoDb;
}

// Worker message handler
self.onmessage = async (event: MessageEvent<StorageTask>) => {
  const task = event.data;

  try {
    let result: StorageResult;

    switch (task.type) {
      case 'addPOI':
        result = await handleAddPOI(task);
        break;
      case 'saveMeasurement':
        result = await handleSaveMeasurement(task);
        break;
      case 'saveVideoChunk':
        result = await handleSaveVideoChunk(task);
        break;
      case 'batch':
        result = await handleBatch(task);
        break;
      default:
        throw new Error(`Unknown task type: ${(task as any).type}`);
    }

    self.postMessage(result);
  } catch (error) {
    const errorResult: StorageResult = {
      id: task.id,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
    self.postMessage(errorResult);
  }
};

/**
 * Handle adding POI to queue for batch processing
 */
async function handleAddPOI(task: StorageTask): Promise<StorageResult> {
  poiQueue.push(task.data);

  // Schedule batch write if not already scheduled
  if (!batchTimeout) {
    batchTimeout = self.setTimeout(() => {
      processBatch();
    }, BATCH_DELAY) as unknown as number;
  }

  // Force batch write if queue is full
  if (poiQueue.length >= MAX_BATCH_SIZE) {
    if (batchTimeout) {
      clearTimeout(batchTimeout);
      batchTimeout = null;
    }
    await processBatch();
  }

  return {
    id: task.id,
    success: true,
    data: { queued: true, queueSize: poiQueue.length },
  };
}

/**
 * Handle saving single measurement immediately
 */
async function handleSaveMeasurement(task: StorageTask): Promise<StorageResult> {
  const database = await initSurveyDB();
  const tx = database.transaction('measurements', 'readwrite');
  
  await tx.store.put(task.data);
  await tx.done;

  return {
    id: task.id,
    success: true,
    data: { measurementId: task.data.id },
  };
}

/**
 * Handle saving video chunk (CRITICAL for progressive saving)
 * IMPORTANT: Uses video database to match GeoVideoRecorder schema
 */
async function handleSaveVideoChunk(task: StorageTask): Promise<StorageResult> {
  const database = await initVideoDB();
  const { recordingId, chunk, chunkIndex, timestamp } = task.data;

  const chunkData = {
    id: `${recordingId}_chunk_${chunkIndex}`,
    recordingId,
    chunk,
    chunkIndex,
    timestamp,
    savedAt: Date.now(),
  };

  const tx = database.transaction('videoChunks', 'readwrite');
  await tx.store.put(chunkData);
  await tx.done;

  return {
    id: task.id,
    success: true,
    data: { chunkId: chunkData.id, chunkIndex },
  };
}

/**
 * Process batch of POIs
 * CRITICAL: Returns individual success/failure for each item
 */
async function processBatch(): Promise<{ successful: number; failed: number; errors: any[] }> {
  if (poiQueue.length === 0) {
    return { successful: 0, failed: 0, errors: [] };
  }

  const database = await initSurveyDB();
  const itemsToWrite = [...poiQueue];
  poiQueue.length = 0; // Clear queue immediately
  
  let successful = 0;
  let failed = 0;
  const errors: any[] = [];

  // Write each item individually to track failures
  for (const item of itemsToWrite) {
    try {
      const tx = database.transaction('measurements', 'readwrite');
      await tx.store.put(item);
      await tx.done;
      successful++;
    } catch (error) {
      failed++;
      errors.push({
        itemId: item.id,
        error: error instanceof Error ? error.message : String(error)
      });
      workerLogger.error(`❌ Failed to save POI ${item.id}:`, error);
      
      // CRITICAL: Re-queue failed item for retry
      poiQueue.push(item);
    }
  }

  workerLogger.log(`💾 Batch saved ${successful}/${itemsToWrite.length} POIs to IndexedDB (${failed} failed)`);
  
  batchTimeout = null;
  
  return { successful, failed, errors };
}

/**
 * Handle batch operation
 */
async function handleBatch(task: StorageTask): Promise<StorageResult> {
  const result = await processBatch();
  
  return {
    id: task.id,
    success: result.failed === 0,
    data: { 
      processedCount: result.successful,
      failedCount: result.failed,
      errors: result.errors
    },
    error: result.failed > 0 ? `${result.failed} items failed to save` : undefined
  };
}

export {};
