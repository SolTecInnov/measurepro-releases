import type { GpsSample, WorkerMessage } from '../../shared/worker-types';

const WORKER_NAME = 'gps';
let totalProcessed = 0;

function validateAndNormalize(rawGps: any): GpsSample | null {
  const lat = typeof rawGps.latitude === 'number' ? rawGps.latitude : parseFloat(rawGps.latitude);
  const lon = typeof rawGps.longitude === 'number' ? rawGps.longitude : parseFloat(rawGps.longitude);
  
  if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return null;
  }
  
  const sample: GpsSample = {
    timestamp: rawGps.timestamp || Date.now(),
    latitude: lat,
    longitude: lon,
    altitude: rawGps.altitude !== undefined ? parseFloat(rawGps.altitude) : undefined,
    speed: rawGps.speed !== undefined ? parseFloat(rawGps.speed) : undefined,
    heading: rawGps.heading !== undefined ? parseFloat(rawGps.heading) : undefined,
    accuracy: rawGps.accuracy !== undefined ? parseFloat(rawGps.accuracy) : undefined,
    satellites: rawGps.satellites !== undefined ? parseInt(rawGps.satellites) : undefined,
    hdop: rawGps.hdop !== undefined ? parseFloat(rawGps.hdop) : undefined
  };
  
  return sample;
}

self.onmessage = (e: MessageEvent) => {
  const { type, data } = e.data;
  
  if (type === 'GPS_RAW') {
    const normalized = validateAndNormalize(data);
    
    if (normalized) {
      totalProcessed++;
      
      self.postMessage({
        type: 'GPS_SAMPLE',
        data: normalized
      } as WorkerMessage);
    } else {
      self.postMessage({
        type: 'ERROR',
        data: {
          workerName: WORKER_NAME,
          error: 'Invalid GPS data',
          context: data
        }
      } as WorkerMessage);
    }
  }
  
  if (type === 'GET_STATUS') {
    self.postMessage({
      type: 'STATUS_UPDATE',
      data: {
        workerName: WORKER_NAME,
        queueSize: 0,
        totalProcessed
      }
    } as WorkerMessage);
  }
};

self.postMessage({ type: 'ready' });
