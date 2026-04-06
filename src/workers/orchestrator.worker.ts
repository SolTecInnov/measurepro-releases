import type {
  WorkerMessage,
  GpsSample,
  LaserEvent,
  ImageRef,
  TimelapseRef,
  VideoRef,
  PoiEventRecord,
  OrchestratorConfig,
  WorkerStatus
} from '../../shared/worker-types';
import { DEFAULT_ORCHESTRATOR_CONFIG } from '../../shared/worker-types';
import { openDB, type IDBPDatabase } from 'idb';

const WORKER_NAME = 'orchestrator';

const config: OrchestratorConfig = { ...DEFAULT_ORCHESTRATOR_CONFIG };

const queue: PoiEventRecord[] = [];
const gpsBuffer: GpsSample[] = [];
const pendingImageRequests = new Map<string, {
  poiId: string;
  resolve: (image: ImageRef | null) => void;
}>();

let db: IDBPDatabase | null = null;
let flushTimer: NodeJS.Timeout | null = null;
let totalProcessed = 0;
let droppedEvents = 0;
let backpressureActive = false;
let lastError: string | undefined;

const status: WorkerStatus = {
  queueSize: 0,
  backpressure: false,
  totalProcessed: 0,
  droppedEvents: 0
};

async function initDB() {
  db = await openDB('measurepro-v2', 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('poiEvents')) {
        const store = db.createObjectStore('poiEvents', { keyPath: 'id' });
        store.createIndex('by-timestamp', 'timestamp');
        store.createIndex('by-survey', 'surveyId');
        store.createIndex('by-poi-type', 'poiType');
        store.createIndex('by-survey-timestamp', ['surveyId', 'timestamp']);
      }
    }
  });
}

function findClosestGPS(targetTimestamp: number): GpsSample | null {
  if (gpsBuffer.length === 0) return null;
  
  let closest = gpsBuffer[0];
  let minDiff = Math.abs(gpsBuffer[0].timestamp - targetTimestamp);
  
  for (const sample of gpsBuffer) {
    const diff = Math.abs(sample.timestamp - targetTimestamp);
    if (diff < minDiff) {
      minDiff = diff;
      closest = sample;
    }
  }
  
  return minDiff < 5000 ? closest : null;
}

function requestImageFromPhotoWorker(targetTimestamp: number, poiId: string): Promise<ImageRef | null> {
  return new Promise((resolve) => {
    const requestId = `${poiId}-${Date.now()}`;
    pendingImageRequests.set(requestId, { poiId, resolve });
    
    self.postMessage({
      type: 'REQUEST_IMAGE',
      data: {
        requestId,
        targetTimestamp: targetTimestamp - config.imageOffset,
        offset: config.imageOffset
      }
    } as WorkerMessage);
    
    setTimeout(() => {
      if (pendingImageRequests.has(requestId)) {
        pendingImageRequests.delete(requestId);
        resolve(null);
      }
    }, 2000);
  });
}

async function processPendingPOI(laserEvent: LaserEvent, timelapseRef?: TimelapseRef, videoRef?: VideoRef) {
  const gps = findClosestGPS(laserEvent.timestamp);
  
  if (!gps) {
    droppedEvents++;
    lastError = 'No GPS available';
    sendStatusUpdate();
    return;
  }
  
  const poiId = `poi-${laserEvent.surveyId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  const image = await requestImageFromPhotoWorker(laserEvent.timestamp, poiId);
  
  const poiRecord: PoiEventRecord = {
    id: poiId,
    surveyId: laserEvent.surveyId,
    sessionId: laserEvent.sessionId,
    timestamp: laserEvent.timestamp,
    createdAt: Date.now(),
    poiType: laserEvent.poiType,
    lidar: {
      rawDistance: laserEvent.rawDistance,
      derivedClearance: laserEvent.derivedClearance,
      unit: 'm'
    },
    gps,
    image: image || undefined,
    timelapseRef,
    videoRef
  };
  
  queue.push(poiRecord);
  status.queueSize = queue.length;
  
  checkBackpressure();
  
  if (queue.length >= config.batchSize) {
    await flush();
  } else {
    scheduleFlush();
  }
  
  self.postMessage({
    type: 'POI_CREATED',
    data: {
      poiId,
      timestamp: laserEvent.timestamp
    }
  } as WorkerMessage);
}

function checkBackpressure() {
  const shouldActivate = queue.length >= config.queueCap * 0.8;
  
  if (shouldActivate !== backpressureActive) {
    backpressureActive = shouldActivate;
    status.backpressure = backpressureActive;
    
    self.postMessage({
      type: 'BACKPRESSURE',
      data: {
        workerName: WORKER_NAME,
        active: backpressureActive,
        queueSize: queue.length,
        queueCap: config.queueCap
      }
    } as WorkerMessage);
  }
}

function scheduleFlush() {
  if (flushTimer) return;
  
  flushTimer = setTimeout(() => {
    flush();
  }, config.flushInterval);
}

async function flush() {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  
  if (queue.length === 0 || !db) return;
  
  const batchSize = Math.min(queue.length, config.batchSize);
  const batch = queue.splice(0, batchSize);
  
  const startTime = performance.now();
  
  try {
    const tx = db.transaction('poiEvents', 'readwrite');
    const store = tx.objectStore('poiEvents');
    
    for (const poi of batch) {
      await store.add(poi);
    }
    
    await tx.done;
    
    const duration = performance.now() - startTime;
    totalProcessed += batchSize;
    status.totalProcessed = totalProcessed;
    status.queueSize = queue.length;
    
    self.postMessage({
      type: 'FLUSH_COMPLETE',
      data: {
        batchSize,
        duration,
        totalWritten: totalProcessed
      }
    } as WorkerMessage);
    
    sendStatusUpdate();
    checkBackpressure();
    
    if (queue.length > 0) {
      scheduleFlush();
    }
  } catch (error) {
    queue.unshift(...batch);
    lastError = error instanceof Error ? error.message : String(error);
    
    self.postMessage({
      type: 'ERROR',
      data: {
        workerName: WORKER_NAME,
        error: lastError,
        context: { batchSize }
      }
    } as WorkerMessage);
    
    sendStatusUpdate();
  }
}

function sendStatusUpdate() {
  self.postMessage({
    type: 'STATUS_UPDATE',
    data: {
      workerName: WORKER_NAME,
      queueSize: queue.length,
      totalProcessed,
      droppedEvents,
      lastError
    }
  } as WorkerMessage);
}

self.onmessage = async (e: MessageEvent<WorkerMessage>) => {
  const msg = e.data;
  
  switch (msg.type) {
    case 'GPS_SAMPLE':
      gpsBuffer.push(msg.data);
      if (gpsBuffer.length > 100) {
        gpsBuffer.shift();
      }
      break;
      
    case 'LASER_EVENT':
      await processPendingPOI(msg.data);
      break;
      
    case 'IMAGE_RESPONSE': {
      const request = pendingImageRequests.get(msg.data.requestId);
      if (request) {
        request.resolve(msg.data.image);
        pendingImageRequests.delete(msg.data.requestId);
      }
      break;
    }
      
    case 'TIMELAPSE_FRAME':
      break;
      
    case 'VIDEO_CHUNK':
      break;
      
    default:
      break;
  }
};

initDB().then(() => {
  self.postMessage({ type: 'ready' });
  setInterval(sendStatusUpdate, 1000);
});
