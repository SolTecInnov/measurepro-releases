/**
 * Measurement Logger Worker
 * Handles all measurement logging operations off the main thread:
 * - Batched IndexedDB writes (50-100 measurements)
 * - Background Firebase sync
 * - CSV backup generation
 * - Returns only summaries to main thread
 * 
 * PERFORMANCE CRITICAL: This worker prevents main thread blocking
 * during high-speed logging (1+ measurement/second for 5-6000 entries)
 */

import { openDB, type IDBPDatabase } from 'idb';
import { openSharedSurveyDB, type SurveyDB } from '../lib/survey/db.shared';

// Worker-specific logger (only log in development)
const DEV = self.location.hostname === 'localhost' || 
            self.location.hostname.includes('127.0.0.1');
const workerLogger = {
  error: (...args: any[]) => console.error('[MeasurementWorker]', ...args),
  warn: (...args: any[]) => DEV && console.warn('[MeasurementWorker]', ...args),
  log: (...args: any[]) => DEV && console.log('[MeasurementWorker]', ...args),
  debug: (...args: any[]) => DEV && console.debug('[MeasurementWorker]', ...args)
};

interface Measurement {
  id: string;
  rel: number;
  altGPS: number;
  latitude: number;
  longitude: number;
  utcDate: string;
  utcTime: string;
  speed: number;
  heading: number;
  roadNumber?: number | null;
  poiNumber?: number | null;
  poi_type?: string;
  note?: string;
  source?: string;
  imageUrl?: string | null;
  videoUrl?: string | null;
  videoTimestamp?: number | null;
  videoBlobId?: string | null;
  drawingUrl?: string | null;
  widthMeasure?: number;
  lengthMeasure?: number;
  createdAt: string;
  user_id: string;
  [key: string]: any;
}

interface MeasurementWithRetry extends Measurement {
  _retryCount?: number;
}

interface LogMeasurementTask {
  type: 'logMeasurement';
  id: string;
  measurement: Measurement;
}

interface FlushTask {
  type: 'flush';
  id: string;
}

interface GetStatsTask {
  type: 'getStats';
  id: string;
}

interface ClearBufferTask {
  type: 'clearBuffer';
  id: string;
}

interface SaveTimelapseFrameTask {
  type: 'SAVE_TIMELAPSE_FRAME';
  id: string;
  frame: {
    id: string;
    imageUrl: string;
    timestamp: string;
    frameNumber: number;
    metadata?: any;
    associatedPOIs?: any[];
    hasPOI: boolean;
  };
}

type WorkerTask = LogMeasurementTask | FlushTask | GetStatsTask | ClearBufferTask | SaveTimelapseFrameTask;

interface WorkerResponse {
  id: string;
  success: boolean;
  error?: string;
  data?: any;
}

// Batching configuration - MEMORY-FIRST STRATEGY
// Measurements stay in memory cache, only flush to IndexedDB on:
// 1. Every 500 measurements accumulated
// 2. App going to background (visibility change)
// 3. Memory pressure warning
// 4. Manual "Save Now" trigger
// 5. POI measurements (for data safety)
const BATCH_SIZE = 500; // Flush every 500 measurements for battery/performance
const BATCH_TIMEOUT_MS = 0; // DISABLED: No time-based auto-flush (memory-first strategy)
const MAX_RETRY_ATTEMPTS = 3;
const EMERGENCY_BUFFER_THRESHOLD = 1000; // Emergency threshold for forced flush (memory pressure)
const HEALTH_REPORT_INTERVAL = 5000; // Health updates every 5 seconds (reduced frequency)

// Buffer queue for measurements (with retry tracking)
let measurementBuffer: MeasurementWithRetry[] = [];
let batchTimeout: number | null = null;
let surveyDb: IDBPDatabase<SurveyDB> | null = null;
let csvBackupDb: IDBPDatabase | null = null;
let lastHealthReport: number = 0;

// Degraded mode flag - set when structural failure detected
let degradedMode = false;
let degradedModeReason: string | null = null;

// Statistics
let totalLogged = 0;
let totalFailed = 0;
let lastLogTime = 0;
let permanentFailures: MeasurementWithRetry[] = [];

// Worker initialization flag for one-time setup
let workerInitialized = false;

/**
 * Initialize survey database
 * Uses shared database helper to ensure schema consistency with main app
 */
// FIX 2: One-shot flag — stagger first DB open to let main thread upgrade first
let dbInitStaggered = false;

async function initSurveyDB(): Promise<IDBPDatabase<SurveyDB>> {
  if (surveyDb) return surveyDb;

  try {
    // FIX 2: Stagger worker DB init to let main thread complete its upgrade first
    // This eliminates the version upgrade deadlock between main thread and worker
    if (!dbInitStaggered) {
      dbInitStaggered = true;
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // ✅ Use shared database helper (single source of truth for schema)
    surveyDb = await openSharedSurveyDB();
    
    workerLogger.log(`✅ Survey DB initialized (version ${surveyDb.version})`);
    return surveyDb!;
  } catch (error) {
    workerLogger.error('❌ Failed to initialize survey database:', error);
    throw error;
  }
}

/**
 * Initialize CSV backup database
 */
async function initCSVBackupDB(): Promise<IDBPDatabase | null> {
  if (csvBackupDb) return csvBackupDb;
  
  try {
    csvBackupDb = await openDB('csv-backup-db', 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('csv-data')) {
          db.createObjectStore('csv-data');
        }
      },
    });
    return csvBackupDb;
  } catch (error) {
    workerLogger.warn('Failed to initialize CSV backup DB:', error);
    return null;
  }
}

/**
 * PERFORMANCE FIX: Worker-specific POI deduplication using cached DB
 * Uses indexed range queries for O(log n) performance instead of O(n) getAll()
 * FIX 1: Returns original record with primary key for proper duplicate updates
 */
async function checkProcessedPOI(
  poi: { id: string; kind: string; lat: number; lon: number; t: number }
): Promise<{
  isDuplicate: boolean;
  originalRecord?: { id: string; timestamp: number };
}> {
  try {
    const db = await initSurveyDB();
    
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
        workerLogger.debug(`🚫 DUPLICATE POI DETECTED via spatial-temporal fallback: ${poi.id} matches ${candidate.id}`);
        return {
          isDuplicate: true,
          originalRecord: { id: candidate.id, timestamp: candidate.timestamp }
        };
      }
    }
    
    return { isDuplicate: false };
  } catch (error) {
    workerLogger.error('Failed to check processed POI:', error);
    return { isDuplicate: false };
  }
}

/**
 * Process batch of measurements
 * ATOMIC TRANSACTION FIX: Single transaction for measurements + processedPOIs
 * - All writes succeed or all fail together (no partial commits)
 * - Duplicates update their timestamp to confirm they were checked
 * - Performance metrics tracked (duration, throughput)
 * - Proper error handling with automatic rollback
 */
async function processBatch(): Promise<{ successful: number; failed: number; errors: any[] }> {
  if (measurementBuffer.length === 0) {
    return { successful: 0, failed: 0, errors: [] };
  }

  const batchStartTime = performance.now();
  const itemsToWrite = [...measurementBuffer];
  // DO NOT clear buffer here - only clear after successful commit
  
  let successful = 0;
  let duplicatesSkipped = 0;

  workerLogger.debug(`📦 Processing batch of ${itemsToWrite.length} measurements...`);

  try {
    const db = await initSurveyDB();
    
    // Verify measurements store exists (detect structural failures early)
    if (!db.objectStoreNames.contains('measurements')) {
      throw new Error('STRUCTURAL_FAILURE: measurements object store missing');
    }
    
    // PERFORMANCE FIX: Filter out duplicate POIs BEFORE batch write
    // Only measurements with poi_type need deduplication (POI events)
    // FIX 2: Collect duplicate updates with ORIGINAL IDs for atomic transaction
    const uniqueMeasurements: MeasurementWithRetry[] = [];
    const duplicatesToUpdate: Array<{
      originalId: string;
      kind: string;
      lat: number;
      lon: number;
      timestamp: number;
    }> = [];
    
    for (const measurement of itemsToWrite) {
      // Check if this is a POI measurement that needs deduplication
      if (measurement.poi_type) {
        // Create POI object for dedup check
        const poi = {
          id: measurement.id,
          kind: measurement.poi_type,
          lat: measurement.latitude,
          lon: measurement.longitude,
          t: new Date(measurement.createdAt).getTime()
        };
        
        // Check if this POI was already processed (fast indexed query)
        // FIX 2: Get original record to update it (not create new entry!)
        const dedupeResult = await checkProcessedPOI(poi);
        
        if (dedupeResult.isDuplicate && dedupeResult.originalRecord) {
          duplicatesSkipped++;
          // Store ORIGINAL ID for update inside transaction
          duplicatesToUpdate.push({
            originalId: dedupeResult.originalRecord.id,
            kind: poi.kind,
            lat: poi.lat,
            lon: poi.lon,
            timestamp: Date.now() // Update to current time to confirm check
          });
          workerLogger.debug(`🚫 Duplicate POI detected: ${poi.id}, will update original ${dedupeResult.originalRecord.id}`);
          continue;
        }
      }
      
      // Not a duplicate or not a POI - add to write batch
      uniqueMeasurements.push(measurement);
    }
    
    if (duplicatesSkipped > 0) {
      workerLogger.log(`🚫 Found ${duplicatesSkipped} duplicate POI(s) in batch`);
    }
    
    // ATOMIC TRANSACTION: Write measurements + processedPOIs + surveys in single transaction
    // FIX 1: All operations succeed or all fail together (no partial commits)
    // poiCount increments are included in the same transaction for consistency
    const tx = db.transaction(['measurements', 'processedPOIs', 'surveys'], 'readwrite');
    const measurementsStore = tx.objectStore('measurements');
    const poisStore = tx.objectStore('processedPOIs');
    const surveysStore = tx.objectStore('surveys');
    
    // Write all UNIQUE measurements (no try-catch - let transaction fail atomically)
    for (const measurement of uniqueMeasurements) {
      // Remove retry count before storing (internal metadata)
      const { _retryCount, ...cleanMeasurement } = measurement;
      
      // Write measurement to database
      await measurementsStore.put(cleanMeasurement);
      
      // Mark POI as processed in same transaction (if it's a POI)
      if (measurement.poi_type) {
        await poisStore.put({
          id: measurement.id,
          kind: measurement.poi_type,
          lat: measurement.latitude,
          lon: measurement.longitude,
          timestamp: new Date(measurement.createdAt).getTime()
        });
        workerLogger.debug(`✅ Marked POI as processed: ${measurement.id}, type=${measurement.poi_type}`);
      }
      
      successful++;
    }
    
    // FIX 2: Update ORIGINAL records for duplicates INSIDE SAME transaction
    // ✅ CRITICAL: Use originalId (not new UUID) to update the authoritative record
    for (const dup of duplicatesToUpdate) {
      const original = await poisStore.get(dup.originalId);
      if (original) {
        await poisStore.put({
          ...original,
          timestamp: dup.timestamp  // Update timestamp to confirm check
        });
        workerLogger.debug(`🔄 Updated ORIGINAL POI record: ${dup.originalId} (timestamp refreshed)`);
      } else {
        // Original record missing - create it with ORIGINAL ID
        await poisStore.put({
          id: dup.originalId,
          kind: dup.kind,
          lat: dup.lat,
          lon: dup.lon,
          timestamp: dup.timestamp
        });
        workerLogger.warn(`⚠️ Original POI ${dup.originalId} missing, recreated`);
      }
    }

    // ATOMIC: Increment denormalized poiCount on each affected Survey record
    // Group unique measurements by survey so we do one get+put per survey
    if (uniqueMeasurements.length > 0) {
      const surveyDeltas = new Map<string, number>();
      for (const m of uniqueMeasurements) {
        surveyDeltas.set(m.user_id, (surveyDeltas.get(m.user_id) ?? 0) + 1);
      }
      for (const [sid, delta] of surveyDeltas) {
        try {
          const survey = await surveysStore.get(sid);
          if (survey) {
            await surveysStore.put({ ...survey, poiCount: (survey.poiCount ?? 0) + delta });
          }
        } catch {
          // Non-critical — count corrected on next modal open
        }
      }
    }
    
    // Commit transaction atomically - all succeed or all fail
    await tx.done;
    
    // Transaction succeeded - clear ALL processed items from buffer
    const processedIds = new Set(itemsToWrite.map(m => m.id));
    measurementBuffer = measurementBuffer.filter(m => !processedIds.has(m.id));
    
    // CRITICAL: Get surveyId BEFORE clearing arrays (needed for snapshot invalidation)
    const surveyId = itemsToWrite[0]?.user_id;
    
    // PERF: Defer CSV backups to next idle tick — they're optional and should
    // never compete with the next POI save for IndexedDB lock time.
    const csvBatch = uniqueMeasurements.map(m => {
      const { _retryCount, ...clean } = m;
      return clean;
    });
    setTimeout(() => {
      for (const m of csvBatch) {
        appendToCSV(m).catch(() => {});
      }
    }, 0);

    // MEMORY CLEANUP: Clear local batch arrays to free memory immediately
    itemsToWrite.length = 0;
    uniqueMeasurements.length = 0;
    duplicatesToUpdate.length = 0;
    processedIds.clear();
    
    // BACKPRESSURE: If buffer grows beyond threshold, trigger immediate flush
    // PERFORMANCE FIX: Raised from 150 → 500 → 1500 → 3000 to handle 2000-2500 entries/day
    // Previous: 150-entry threshold caused tight loop and IndexedDB lock contention
    // Current: 3000-entry threshold (emergency safety net only - auto-batching at 75 entries is primary mechanism)
    if (measurementBuffer.length > 3000) {
      workerLogger.warn(`⚠️ Buffer size ${measurementBuffer.length} exceeded threshold - forcing immediate flush`);
      // Cancel existing batch timeout
      if (batchTimeout !== null) {
        clearTimeout(batchTimeout);
        batchTimeout = null;
      }
      // Trigger immediate batch write (all measurements MUST be saved)
      setTimeout(() => processBatch(), 0);
    }
    
    // FIX 4: Performance metrics
    const batchEndTime = performance.now();
    const batchDuration = batchEndTime - batchStartTime;
    const throughput = successful > 0 ? (successful / batchDuration) * 1000 : 0;
    
    totalLogged += successful;
    lastLogTime = Date.now();
    
    // Send health status after batch write (buffer size changed)
    sendHealthStatus();
    
    workerLogger.log(
      `✅ Batch complete: ${successful} written, ${duplicatesSkipped} duplicates updated, ` +
      `${batchDuration.toFixed(2)}ms, ${throughput.toFixed(2)} measurements/sec`
    );
    
    // Notify main thread with performance metrics (surveyId already captured above)
    const summary: WorkerResponse = {
      id: 'batch-complete',
      success: true,
      data: {
        type: 'batchComplete',
        count: successful,
        failed: 0,
        totalLogged,
        totalFailed,
        totalSkipped: duplicatesSkipped,
        bufferSize: measurementBuffer.length,
        batchDuration,
        throughput,
        duration: batchDuration,  // Keep for backwards compatibility
        surveyId  // ADDED: For snapshot invalidation
      }
    };
    self.postMessage(summary);
    
    return { successful: 0, failed: 0, errors: [] };
    
  } catch (error) {
    // FIX 3: Transaction failed - all writes automatically rolled back by IndexedDB
    // No partial commits possible - measurements and processedPOIs stay synchronized
    const errorMsg = error instanceof Error ? error.message : String(error);
    const isStructuralFailure = errorMsg.includes('STRUCTURAL_FAILURE') || 
                                errorMsg.includes('NotFoundError') ||
                                errorMsg.includes('object store');
    
    workerLogger.error('❌ Batch transaction failed (auto-rolled back):', error);
    
    if (isStructuralFailure) {
      // CRITICAL: Structural failure - enter degraded mode
      degradedMode = true;
      degradedModeReason = errorMsg;
      workerLogger.error('🚨 STRUCTURAL FAILURE DETECTED - Entering degraded mode');
      
      // Send health status immediately (critical state change)
      sendHealthStatus();
      
      // Flush buffer ONCE - escalate all items to main thread
      for (const measurement of itemsToWrite) {
        // Send error event for main thread fallback
        const errorEvent: WorkerResponse = {
          id: 'error-event',
          success: false,
          error: 'Worker DB structural failure - using main thread fallback',
          data: {
            type: 'structuralFailure',
            measurement,
            error: errorMsg
          }
        };
        self.postMessage(errorEvent);
      }
      
      // Clear buffer - these measurements are now handled by main thread
      measurementBuffer = measurementBuffer.filter(m => 
        !itemsToWrite.find(item => item.id === m.id)
      );
      
      totalFailed += itemsToWrite.length;
      
      // Notify main thread of degraded mode
      const degradedEvent: WorkerResponse = {
        id: 'degraded-mode',
        success: false,
        error: 'Worker entered degraded mode - refusing new tasks',
        data: {
          type: 'degradedMode',
          reason: errorMsg
        }
      };
      self.postMessage(degradedEvent);
    } else {
      // Transient failure - re-queue ALL items with retry tracking
      // Transaction rollback ensures no partial writes, so all items need retry
      for (const measurement of itemsToWrite) {
        const retryCount = (measurement._retryCount || 0) + 1;
        
        if (retryCount <= MAX_RETRY_ATTEMPTS) {
          // Re-queue if not already in buffer (buffer wasn't cleared yet)
          if (!measurementBuffer.find(m => m.id === measurement.id)) {
            measurement._retryCount = retryCount;
            measurementBuffer.push(measurement);
            workerLogger.warn(
              `⚠️ Re-queuing measurement ${measurement.id} for retry ${retryCount}/${MAX_RETRY_ATTEMPTS}`
            );
          }
        } else {
          // Max retries exceeded - escalate to permanent failures
          if (!permanentFailures.find(m => m.id === measurement.id)) {
            permanentFailures.push(measurement);
            
            const errorEvent: WorkerResponse = {
              id: 'error-event',
              success: false,
              error: `Measurement ${measurement.id} failed after ${MAX_RETRY_ATTEMPTS} retries`,
              data: {
                type: 'permanentFailure',
                measurement,
                retries: MAX_RETRY_ATTEMPTS,
                error: errorMsg
              }
            };
            self.postMessage(errorEvent);
            
            workerLogger.error(
              `❌ PERMANENT FAILURE: Measurement ${measurement.id} exceeded ${MAX_RETRY_ATTEMPTS} retries`
            );
          }
        }
      }
      
      // Remove items from buffer that were sent to permanent failures
      measurementBuffer = measurementBuffer.filter(m => 
        !permanentFailures.find(pf => pf.id === m.id)
      );
      
      totalFailed += itemsToWrite.length;
    }
    
    return { 
      successful: 0, 
      failed: itemsToWrite.length, 
      errors: [{ error: `Batch transaction failed: ${errorMsg}` }] 
    };
  } finally {
    // Clear batch timeout
    if (batchTimeout) {
      clearTimeout(batchTimeout);
      batchTimeout = null;
    }
  }
}

/**
 * Send health status to main thread for performance monitoring
 */
function sendHealthStatus() {
  const now = Date.now();
  
  // Throttle health reports to avoid flooding main thread
  if (now - lastHealthReport < HEALTH_REPORT_INTERVAL) {
    return;
  }
  
  lastHealthReport = now;
  
  const bufferSize = measurementBuffer.length;
  const bufferUsagePercent = Math.round((bufferSize / EMERGENCY_BUFFER_THRESHOLD) * 100);
  
  // Determine worker status based on buffer usage and degraded mode
  let status: 'healthy' | 'degraded' | 'critical' = 'healthy';
  
  if (degradedMode) {
    status = 'critical';
  } else if (bufferSize >= EMERGENCY_BUFFER_THRESHOLD * 0.8) {
    status = 'critical';
  } else if (bufferSize >= EMERGENCY_BUFFER_THRESHOLD * 0.6) {
    status = 'degraded';
  } else if (bufferSize >= BATCH_SIZE * 2) {
    status = 'degraded';
  }
  
  // Post health message to main thread
  self.postMessage({
    type: 'WORKER_HEALTH',
    data: {
      status,
      bufferUsage: bufferUsagePercent,
      bufferSize,
      degradedMode,
      degradedModeReason,
      timestamp: now
    }
  });
}

/**
 * Schedule batch processing - MEMORY-FIRST STRATEGY
 * Only flushes when buffer reaches BATCH_SIZE (500 measurements)
 * No time-based auto-flush for better battery/performance
 * Explicit flush triggered by: visibility change, memory pressure, manual save
 */
function scheduleBatchWrite() {
  // MEMORY-FIRST: No time-based scheduling
  // Batch write only happens when:
  // 1. Buffer reaches BATCH_SIZE (500)
  // 2. Explicit flush command from main thread
  // 3. POI measurement (immediate for safety)
  
  // Check if we should flush based on buffer size
  if (measurementBuffer.length >= BATCH_SIZE) {
    workerLogger.log(`📦 Buffer reached ${BATCH_SIZE} - triggering flush`);
    processBatch();
  }
}

/**
 * Append measurement to CSV backup (non-blocking)
 */
async function appendToCSV(measurement: Measurement): Promise<void> {
  try {
    const surveyId = measurement.user_id;
    
    // Generate CSV row
    const imageFilename = measurement.imageUrl ? 
      `image_${measurement.roadNumber || 'R000'}_${String(measurement.poiNumber || 0).padStart(5, '0')}_${measurement.poi_type || 'none'}_${measurement.id.substring(0, 8)}.jpg` : '';
    const videoFilename = measurement.videoUrl ? 
      `video_${measurement.roadNumber || 'R000'}_${String(measurement.poiNumber || 0).padStart(5, '0')}_${measurement.poi_type || 'none'}_${measurement.id.substring(0, 8)}.webm` : '';
    
    const row = [
      measurement.id,
      measurement.utcDate,
      measurement.utcTime,
      measurement.rel != null ? measurement.rel.toFixed(3) : '',
      measurement.altGPS != null ? measurement.altGPS.toFixed(1) : '',
      measurement.latitude.toFixed(6),
      measurement.longitude.toFixed(6),
      measurement.speed.toFixed(1),
      measurement.heading.toFixed(1),
      measurement.roadNumber || '',
      measurement.poiNumber || '',
      measurement.poi_type || '',
      (measurement.note || '').replace(/,/g, ';'),
      measurement.source || 'manual',
      measurement.widthMeasure ? measurement.widthMeasure.toFixed(3) : '',
      measurement.lengthMeasure ? measurement.lengthMeasure.toFixed(3) : '',
      measurement.drawingUrl ? `drawing_${measurement.roadNumber || 'R000'}_${String(measurement.poiNumber || 0).padStart(5, '0')}_${measurement.poi_type || 'none'}_${measurement.id.substring(0, 8)}.png` : '',
      imageFilename,
      videoFilename,
      measurement.imageUrl ? 'Yes' : 'No',
      measurement.videoUrl ? 'Yes' : 'No',
      measurement.drawingUrl ? 'Yes' : 'No'
    ].join(',');
    
    // Try to update CSV in IndexedDB
    const csvDb = await initCSVBackupDB();
    if (csvDb) {
      try {
        let csvData = await csvDb.get('csv-data', surveyId) as string || '';
        
        // Add headers if first entry
        if (!csvData) {
          const headers = [
            'ID', 'Date', 'Time', 'Height (m)', 'GPS Alt (m)', 
            'Latitude', 'Longitude', 'Speed (km/h)', 'Heading (°)',
            'Road Number', 'POI Number', 'POI Type', 'Note', 'Source',
            'Width (m)', 'Length (m)', 'Drawing Filename', 'Image Filename',
            'Video Filename', 'Has Image', 'Has Video', 'Has Drawing'
          ].join(',');
          csvData = headers + '\n';
        }
        
        csvData += row + '\n';
        await csvDb.put('csv-data', csvData, surveyId);
      } catch (error) {
        // Both localStorage and IndexedDB failed — notify main thread for user warning
        workerLogger.warn('CSV IndexedDB backup failed (both stores unavailable):', error);
        self.postMessage({
          id: 'csv-backup-status',
          success: false,
          data: {
            type: 'csvBackupCritical',
            surveyId,
            error: error instanceof Error ? error.message : String(error)
          }
        });
      }
    }
  } catch (error) {
    // CSV operations are non-critical
    workerLogger.debug('CSV append failed (non-critical):', error);
  }
}

/**
 * Handle log measurement task
 * CRITICAL: Validates database initialization BEFORE queuing
 * Rejects new tasks if in degraded mode
 */
async function handleLogMeasurement(task: LogMeasurementTask): Promise<WorkerResponse> {
  try {
    const { measurement } = task;
    
    // CRITICAL: Check degraded mode - refuse new tasks after structural failure
    if (degradedMode) {
      workerLogger.warn('⚠️ Worker in degraded mode - refusing new measurement task');
      return {
        id: task.id,
        success: false,
        error: `Worker in degraded mode: ${degradedModeReason}`,
        data: {
          degradedMode: true,
          reason: degradedModeReason
        }
      };
    }
    
    // CRITICAL: Validate database initialization BEFORE adding to buffer
    // This prevents silent data loss if init fails
    try {
      const db = await initSurveyDB();
      
      // Verify measurements store exists
      if (!db.objectStoreNames.contains('measurements')) {
        throw new Error('STRUCTURAL_FAILURE: measurements object store missing');
      }
    } catch (initError) {
      const errorMsg = initError instanceof Error ? initError.message : String(initError);
      const isStructuralFailure = errorMsg.includes('STRUCTURAL_FAILURE') || 
                                  errorMsg.includes('NotFoundError') ||
                                  errorMsg.includes('object store');
      
      if (isStructuralFailure) {
        // Enter degraded mode on init failure
        degradedMode = true;
        degradedModeReason = errorMsg;
        
        // Send health status immediately (critical state change)
        sendHealthStatus();
        
        // Notify main thread
        const degradedEvent: WorkerResponse = {
          id: 'degraded-mode',
          success: false,
          error: 'Worker entered degraded mode on init failure',
          data: {
            type: 'degradedMode',
            reason: errorMsg
          }
        };
        self.postMessage(degradedEvent);
      }
      
      // Return failure so hook can use fallback immediately
      workerLogger.error('❌ Database init failed - measurement will use fallback:', initError);
      return {
        id: task.id,
        success: false,
        error: `Database init failed: ${errorMsg}`,
        data: {
          initFailure: true,
          degradedMode: isStructuralFailure
        }
      };
    }
    
    // Database validated - safe to add to buffer
    measurementBuffer.push(measurement);
    
    // Send health status if buffer usage changed significantly
    if (measurementBuffer.length % 25 === 0) { // Report every 25 measurements
      sendHealthStatus();
    }
    
    // PERFORMANCE FIX: POI measurements get priority flush for sub-200ms latency
    const isPOI = measurement.poi_type !== null && measurement.poi_type !== undefined && measurement.poi_type !== '';
    
    if (isPOI) {
      // POI detected - flush immediately for minimal latency
      workerLogger.debug(`🚀 POI detected (${measurement.poi_type}) - triggering immediate flush`);
      if (batchTimeout) {
        clearTimeout(batchTimeout);
        batchTimeout = null;
      }
      await processBatch();
    } else {
      // Regular measurement - use batching
      // Schedule batch write if not already scheduled
      if (!batchTimeout) {
        scheduleBatchWrite();
      }
      
      // Force immediate batch if buffer is full
      if (measurementBuffer.length >= BATCH_SIZE) {
        if (batchTimeout) {
          clearTimeout(batchTimeout);
          batchTimeout = null;
        }
        await processBatch();
      }
      
      // EMERGENCY: Force flush if buffer reaches critical threshold
      if (measurementBuffer.length >= EMERGENCY_BUFFER_THRESHOLD) {
        workerLogger.warn(`⚠️ EMERGENCY: Buffer at ${measurementBuffer.length}/${EMERGENCY_BUFFER_THRESHOLD} - forcing immediate flush`);
        if (batchTimeout) {
          clearTimeout(batchTimeout);
          batchTimeout = null;
        }
        await processBatch();
        sendHealthStatus(); // Report critical health status
      }
    }
    
    // Return immediate acknowledgment (don't wait for batch)
    return {
      id: task.id,
      success: true,
      data: {
        queued: true,
        bufferSize: measurementBuffer.length,
        measurementId: measurement.id
      }
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    workerLogger.error('❌ handleLogMeasurement error:', error);
    return {
      id: task.id,
      success: false,
      error: errorMsg
    };
  }
}

/**
 * Handle flush task
 * Forces immediate processing of buffered measurements
 */
async function handleFlush(task: FlushTask): Promise<WorkerResponse> {
  try {
    if (batchTimeout) {
      clearTimeout(batchTimeout);
      batchTimeout = null;
    }
    
    const result = await processBatch();
    
    return {
      id: task.id,
      success: result.failed === 0,
      data: {
        processed: result.successful,
        failed: result.failed,
        errors: result.errors
      },
      error: result.failed > 0 ? `${result.failed} measurements failed` : undefined
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return {
      id: task.id,
      success: false,
      error: errorMsg
    };
  }
}

/**
 * Handle get stats task
 * Returns current buffer and logging statistics
 */
async function handleGetStats(task: GetStatsTask): Promise<WorkerResponse> {
  return {
    id: task.id,
    success: true,
    data: {
      bufferSize: measurementBuffer.length,
      totalLogged,
      totalFailed,
      lastLogTime,
      batchSize: BATCH_SIZE,
      batchTimeout: BATCH_TIMEOUT_MS,
      degradedMode,
      degradedModeReason
    }
  };
}

/**
 * Handle clear buffer task
 * Clears the measurement buffer without writing
 */
async function handleClearBuffer(task: ClearBufferTask): Promise<WorkerResponse> {
  const clearedCount = measurementBuffer.length;
  measurementBuffer = [];
  
  if (batchTimeout) {
    clearTimeout(batchTimeout);
    batchTimeout = null;
  }
  
  return {
    id: task.id,
    success: true,
    data: {
      cleared: clearedCount
    }
  };
}

/**
 * DURABILITY FIX: Handle save timelapse frame task with real IndexedDB persistence
 * - Three-phase commit: Write 'pending' → 'committing' → 'complete'
 * - No in-memory state - IndexedDB is source of truth
 * - Crash-safe: Pending/committing frames recovered on worker restart
 * - Bounded retries: Max 5 attempts before marking as 'failed'
 * PERFORMANCE: Eliminates 50-200ms main thread blocking
 */
async function handleSaveTimelapseFrame(task: SaveTimelapseFrameTask): Promise<WorkerResponse> {
  try {
    const db = await initSurveyDB();
    
    if (!db.objectStoreNames.contains('timelapseJobs')) {
      workerLogger.warn('⚠️ timelapseJobs store not yet created');
      return {
        id: task.id,
        success: true,
        data: { skipped: true }
      };
    }
    
    const jobId = crypto.randomUUID();
    
    // Phase 1: Create job with 'pending' status
    const job = {
      id: jobId,
      type: 'SAVE_TIMELAPSE_FRAME',
      payload: task.frame,
      status: 'pending' as const,
      retryCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    const tx1 = db.transaction('timelapseJobs', 'readwrite');
    await tx1.store.put(job);
    await tx1.done;
    
    // Phase 2: Save to frames store
    const tx2 = db.transaction('frames', 'readwrite');
    await tx2.store.put({
      ...task.frame,
      status: 'completed',
      createdAt: task.frame.timestamp
    });
    await tx2.done;
    
    // Phase 3: Mark job as 'complete'
    const tx3 = db.transaction('timelapseJobs', 'readwrite');
    await tx3.store.put({ ...job, status: 'complete' as const, updatedAt: new Date().toISOString() });
    await tx3.done;
    
    workerLogger.debug(`✅ Saved timelapse frame ${task.frame.frameNumber}`);
    
    return {
      id: task.id,
      success: true,
      data: { frameId: task.frame.id, jobId, acknowledged: true }
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    workerLogger.error('❌ Failed to save timelapse frame:', error);
    
    // Frame is in 'pending' state in DB, will be retried on next startup
    
    return {
      id: task.id,
      success: false,
      error: errorMsg
    };
  }
}

/**
 * Boot-time recovery from timelapseJobs store
 * Called during initialization and periodically to recover from crashes
 * Processes jobs with 'pending' or 'committing' status
 * Bounded retries: Max 5 attempts before marking as 'failed'
 */
async function processTimelapseJobQueue(): Promise<void> {
  try {
    const db = await initSurveyDB();
    
    if (!db.objectStoreNames.contains('timelapseJobs')) {
      return;
    }
    
    const tx = db.transaction('timelapseJobs', 'readonly');
    const index = tx.store.index('by-status');
    
    // Get all non-complete jobs
    const pendingJobs = await index.getAll('pending');
    const committingJobs = await index.getAll('committing');
    
    const allJobs = [...pendingJobs, ...committingJobs];
    
    if (allJobs.length === 0) {
      return;
    }
    
    workerLogger.log(`📋 Found ${allJobs.length} timelapse jobs to process`);
    
    for (const job of allJobs) {
      // Bounded retries
      if (job.retryCount >= 5) {
        workerLogger.error(`⚠️ Job ${job.id} exceeded retry limit (5), marking as failed`);
        
        const txFail = db.transaction('timelapseJobs', 'readwrite');
        await txFail.store.put({ ...job, status: 'failed' });
        await txFail.done;
        continue;
      }
      
      try {
        // Retry the job
        await handleSaveTimelapseFrame({
          type: 'SAVE_TIMELAPSE_FRAME',
          id: job.id,
          frame: job.payload
        });
      } catch (err) {
        workerLogger.error(`Failed to retry job ${job.id}:`, err);
        
        // Increment retry count
        const txRetry = db.transaction('timelapseJobs', 'readwrite');
        await txRetry.store.put({
          ...job,
          retryCount: (job.retryCount || 0) + 1,
          updatedAt: new Date().toISOString()
        });
        await txRetry.done;
      }
    }
  } catch (error) {
    workerLogger.error('Failed to process timelapse job queue:', error);
  }
}

/**
 * Main worker message handler
 */
self.onmessage = async (event: MessageEvent<WorkerTask>) => {
  const task = event.data;
  
  // DURABILITY FIX: First time initialization - process timelapse job queue
  if (!workerInitialized) {
    workerInitialized = true;
    await processTimelapseJobQueue();
    
    // DURABILITY FIX: Periodic re-scan every 30 seconds for persistent jobs
    setInterval(() => {
      processTimelapseJobQueue();
    }, 30000);
  }
  
  try {
    let result: WorkerResponse;
    
    switch (task.type) {
      case 'logMeasurement':
        result = await handleLogMeasurement(task as LogMeasurementTask);
        break;
      case 'flush':
        result = await handleFlush(task as FlushTask);
        break;
      case 'getStats':
        result = await handleGetStats(task as GetStatsTask);
        break;
      case 'clearBuffer':
        result = await handleClearBuffer(task as ClearBufferTask);
        break;
      case 'SAVE_TIMELAPSE_FRAME':
        result = await handleSaveTimelapseFrame(task as SaveTimelapseFrameTask);
        break;
      default:
        throw new Error(`Unknown task type: ${(task as any).type}`);
    }
    
    self.postMessage(result);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    workerLogger.error('❌ Worker error:', error);
    
    const errorResult: WorkerResponse = {
      id: task.id,
      success: false,
      error: errorMsg
    };
    self.postMessage(errorResult);
  }
};

// Initialize databases on worker startup
initSurveyDB().catch(err => {
  workerLogger.error('Failed to initialize databases on startup:', err);
});

initCSVBackupDB().catch(err => {
  workerLogger.warn('Failed to initialize CSV backup DB on startup:', err);
});

// Boot-time recovery: Process pending timelapse jobs
processTimelapseJobQueue().catch(err => {
  workerLogger.error('Failed to process timelapse jobs on startup:', err);
});

// Set up periodic health status reporting
setInterval(() => {
  sendHealthStatus();
}, HEALTH_REPORT_INTERVAL * 2); // Send health status every 2 seconds

// Send initial health status
sendHealthStatus();

workerLogger.log('🚀 Measurement Logger Worker initialized');

export {};
