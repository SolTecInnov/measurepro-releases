import type { Measurement } from './types';
import type { WorkerMessage } from '../../../shared/worker-types';
import { openSurveyDB } from './db';
import { invalidateSnapshot, incrementPersistedVersion } from './measurementSnapshot';

let orchestratorWorker: Worker | null = null;
let workerReady = false;

function getOrchestratorWorker(): Worker {
  if (!orchestratorWorker) {
    orchestratorWorker = new Worker(
      new URL('../../workers/orchestrator.worker.ts', import.meta.url),
      { type: 'module' }
    );
    
    orchestratorWorker.onmessage = (event: MessageEvent<any>) => {
      if (event.data.type === 'ready') {
        workerReady = true;
      }
    };
  }
  return orchestratorWorker;
}

interface MeasurementToWorkerOptions {
  measurement: Measurement;
  gpsData?: {
    latitude: number;
    longitude: number;
    altitude?: number;
    accuracy?: number;
    speed?: number;
    heading?: number;
  };
  imageBlob?: Blob;
}

/**
 * MIGRATION ADAPTER: Routes measurement creation through new worker architecture
 * while maintaining backwards compatibility with existing code
 */
export async function addMeasurementViaWorker(options: MeasurementToWorkerOptions): Promise<void> {
  const { measurement, gpsData, imageBlob } = options;
  const worker = getOrchestratorWorker();
  
  // Wait for worker to be ready (with timeout)
  if (!workerReady) {
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => resolve(), 1000);
      const checkReady = () => {
        if (workerReady) {
          clearTimeout(timeout);
          resolve();
        } else {
          setTimeout(checkReady, 50);
        }
      };
      checkReady();
    });
  }
  
  // Send GPS data if available
  if (gpsData) {
    worker.postMessage({
      type: 'GPS_DATA',
      data: {
        timestamp: new Date(measurement.createdAt).getTime(),
        latitude: gpsData.latitude,
        longitude: gpsData.longitude,
        altitude: gpsData.altitude || 0,
        accuracy: gpsData.accuracy || 10,
        speed: gpsData.speed || 0,
        heading: gpsData.heading || 0
      }
    });
  }
  
  // Send laser event (POI trigger)
  worker.postMessage({
    type: 'LASER_EVENT',
    data: {
      timestamp: new Date(measurement.createdAt).getTime(),
      distance: measurement.rel || 0,
      poiType: measurement.poi_type || 'manual',
      surveyId: measurement.user_id,
      sessionId: '', // TODO: Get from session manager
      note: measurement.note || ''
    }
  });
  
  // Send image if available
  if (imageBlob) {
    // Convert blob to base64
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      worker.postMessage({
        type: 'IMAGE_FRAME',
        data: {
          timestamp: new Date(measurement.createdAt).getTime(),
          imageData: base64
        }
      });
    };
    reader.readAsDataURL(imageBlob);
  }
  
  // Also write to legacy database for backwards compatibility.
  // NOTE: poiCount is intentionally NOT incremented here.  The worker's
  // processBatch() is the single authoritative incrementer (avoids ×2 counts
  // when both paths fire for the same POI).  If the worker path fails,
  // poiCount lags but countMeasurementsForSurvey() — which counts actual
  // measurement records — remains the source of truth for AutoPartManager.
  try {
    const db = await openSurveyDB();

    const tx = db.transaction(['measurements'], 'readwrite');
    const measurementsStore = tx.objectStore('measurements');

    await measurementsStore.put(measurement);

    await tx.done;
    
    // Invalidate snapshot for live updates
    await incrementPersistedVersion(measurement.user_id);
    invalidateSnapshot(measurement.user_id);
    
    // Dispatch change event for legacy listeners
    window.dispatchEvent(new Event('dbchange'));
  } catch (error) {
    console.error('Legacy database write failed:', error);
    // Continue - worker will handle the new database
  }
}

/**
 * Check if new worker architecture is available
 */
export function isWorkerArchitectureAvailable(): boolean {
  return workerReady;
}

/**
 * Initialize worker architecture (call on app startup)
 */
export function initializeWorkerArchitecture(): void {
  getOrchestratorWorker();
}
