import type { LaserEvent, WorkerMessage } from '@shared/worker-types';

const WORKER_NAME = 'laser';

let currentPoiType: string = 'none';
let currentSurveyId: string = '';
let currentSessionId: string = '';
let totalProcessed = 0;
let detectedEvents = 0;

let minThreshold: number = 0;
let maxThreshold: number = 100;

function detectEvent(rawDistance: number): boolean {
  if (minThreshold === 0 && maxThreshold === 0) return false;
  
  if (minThreshold > 0 && rawDistance < minThreshold) return false;
  if (maxThreshold > 0 && rawDistance > maxThreshold) return false;
  
  return true;
}

self.onmessage = (e: MessageEvent) => {
  const { type, data } = e.data;
  
  switch (type) {
    case 'LASER_RAW': {
      totalProcessed++;
      
      const { distance, timestamp, surveyId, sessionId } = data;
      
      if (surveyId) currentSurveyId = surveyId;
      if (sessionId) currentSessionId = sessionId;
      
      if (detectEvent(distance)) {
        detectedEvents++;
        
        const event: LaserEvent = {
          timestamp: timestamp || Date.now(),
          rawDistance: distance,
          derivedClearance: distance,
          poiType: currentPoiType,
          surveyId: currentSurveyId,
          sessionId: currentSessionId
        };
        
        self.postMessage({
          type: 'LASER_EVENT',
          data: event
        } as WorkerMessage);
      }
      break;
    }
      
    case 'SET_POI_TYPE': {
      currentPoiType = data.poiType;
      break;
    }
      
    case 'SET_THRESHOLDS': {
      minThreshold = data.min || 0;
      maxThreshold = data.max || 100;
      break;
    }
      
    case 'SET_CONTEXT': {
      if (data.surveyId) currentSurveyId = data.surveyId;
      if (data.sessionId) currentSessionId = data.sessionId;
      break;
    }
      
    case 'GET_STATUS': {
      self.postMessage({
        type: 'STATUS_UPDATE',
        data: {
          workerName: WORKER_NAME,
          queueSize: 0,
          totalProcessed,
          droppedEvents: 0
        }
      } as WorkerMessage);
      break;
    }
  }
};

self.postMessage({ type: 'ready' });
