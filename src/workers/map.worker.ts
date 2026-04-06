import type { WorkerMessage } from '../../shared/worker-types';

const WORKER_NAME = 'map';

interface MapPoint {
  poiId: string;
  latitude: number;
  longitude: number;
  poiType: string;
  timestamp: number;
  clusterId?: string;
}

const points: Map<string, MapPoint> = new Map();
let totalProcessed = 0;

const CLUSTER_THRESHOLD_METERS = 50;

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;
  
  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
           Math.cos(φ1) * Math.cos(φ2) *
           Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  return R * c;
}

function findNearbyCluster(lat: number, lon: number): string | undefined {
  for (const point of points.values()) {
    if (point.clusterId) {
      const dist = calculateDistance(lat, lon, point.latitude, point.longitude);
      if (dist < CLUSTER_THRESHOLD_METERS) {
        return point.clusterId;
      }
    }
  }
  return undefined;
}

self.onmessage = (e: MessageEvent) => {
  const { type, data } = e.data;
  
  switch (type) {
    case 'MAP_POINT': {
      const { poiId, latitude, longitude, poiType, timestamp } = data;
      
      const clusterId = findNearbyCluster(latitude, longitude) || `cluster-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      const point: MapPoint = {
        poiId,
        latitude,
        longitude,
        poiType,
        timestamp: timestamp || Date.now(),
        clusterId
      };
      
      points.set(poiId, point);
      totalProcessed++;
      
      self.postMessage({
        type: 'MAP_UPDATE',
        data: {
          poiId,
          latitude,
          longitude,
          poiType,
          clusterId
        }
      } as WorkerMessage);
      break;
    }
      
    case 'GET_STATUS': {
      self.postMessage({
        type: 'STATUS_UPDATE',
        data: {
          workerName: WORKER_NAME,
          queueSize: points.size,
          totalProcessed
        }
      } as WorkerMessage);
      break;
    }
      
    case 'GET_ALL_POINTS': {
      self.postMessage({
        type: 'ALL_MAP_POINTS',
        data: Array.from(points.values())
      });
      break;
    }
      
    case 'CLEAR': {
      points.clear();
      totalProcessed = 0;
      break;
    }
  }
};

self.postMessage({ type: 'ready' });
