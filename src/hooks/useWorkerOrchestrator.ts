import { useEffect, useRef, useState, useCallback } from 'react';
import type { WorkerMessage, WorkerStatus, OrchestratorConfig } from '../../shared/worker-types';
import { DEFAULT_ORCHESTRATOR_CONFIG } from '../../shared/worker-types';

interface WorkerSet {
  orchestrator: Worker | null;
  gps: Worker | null;
  laser: Worker | null;
  photo: Worker | null;
  timelapse: Worker | null;
  video: Worker | null;
  map: Worker | null;
}

interface WorkersStatus {
  orchestrator: WorkerStatus;
  gps: Partial<WorkerStatus>;
  laser: Partial<WorkerStatus>;
  photo: Partial<WorkerStatus>;
  timelapse: Partial<WorkerStatus>;
  video: Partial<WorkerStatus>;
  map: Partial<WorkerStatus>;
}

const createDefaultStatus = (): WorkerStatus => ({
  queueSize: 0,
  backpressure: false,
  totalProcessed: 0,
  droppedEvents: 0
});

export function useWorkerOrchestrator(config: Partial<OrchestratorConfig> = {}) {
  const [isReady, setIsReady] = useState(false);
  const [status, setStatus] = useState<WorkersStatus>({
    orchestrator: createDefaultStatus(),
    gps: {},
    laser: {},
    photo: {},
    timelapse: {},
    video: {},
    map: {}
  });
  
  const workers = useRef<WorkerSet>({
    orchestrator: null,
    gps: null,
    laser: null,
    photo: null,
    timelapse: null,
    video: null,
    map: null
  });
  
  const handleWorkerMessage = useCallback((workerName: keyof WorkerSet) => (e: MessageEvent<WorkerMessage>) => {
    const msg = e.data;
    
    switch (msg.type) {
      case 'STATUS_UPDATE':
        setStatus(prev => ({
          ...prev,
          [workerName]: {
            ...prev[workerName],
            queueSize: msg.data.queueSize,
            totalProcessed: msg.data.totalProcessed,
            droppedEvents: msg.data.droppedEvents
          }
        }));
        break;
        
      case 'BACKPRESSURE':
        setStatus(prev => ({
          ...prev,
          orchestrator: {
            ...prev.orchestrator,
            backpressure: msg.data.active,
            queueSize: msg.data.queueSize
          }
        }));
        break;
        
      case 'GPS_SAMPLE':
        workers.current.orchestrator?.postMessage(msg);
        break;
        
      case 'LASER_EVENT':
        workers.current.orchestrator?.postMessage(msg);
        break;
        
      case 'REQUEST_IMAGE':
        workers.current.photo?.postMessage(msg);
        break;
        
      case 'IMAGE_RESPONSE':
        workers.current.orchestrator?.postMessage(msg);
        break;
        
      case 'MAP_UPDATE':
        break;
    }
  }, []);
  
  useEffect(() => {
    workers.current = {
      orchestrator: new Worker(new URL('../workers/orchestrator.worker.ts', import.meta.url), { type: 'module' }),
      gps: new Worker(new URL('../workers/gps.worker.ts', import.meta.url), { type: 'module' }),
      laser: new Worker(new URL('../workers/laser.worker.ts', import.meta.url), { type: 'module' }),
      photo: new Worker(new URL('../workers/photo.worker.ts', import.meta.url), { type: 'module' }),
      timelapse: new Worker(new URL('../workers/timelapse.worker.ts', import.meta.url), { type: 'module' }),
      video: new Worker(new URL('../workers/video.worker.ts', import.meta.url), { type: 'module' }),
      map: new Worker(new URL('../workers/map.worker.ts', import.meta.url), { type: 'module' })
    };
    
    let readyCount = 0;
    const checkReady = () => {
      readyCount++;
      if (readyCount === 7) {
        setIsReady(true);
      }
    };
    
    Object.entries(workers.current).forEach(([name, worker]) => {
      if (worker) {
        worker.onmessage = (e: MessageEvent) => {
          if (e.data.type === 'ready') {
            checkReady();
          } else {
            handleWorkerMessage(name as keyof WorkerSet)(e);
          }
        };
      }
    });
    
    return () => {
      Object.values(workers.current).forEach(worker => worker?.terminate());
    };
  }, [handleWorkerMessage]);
  
  const sendGpsData = useCallback((rawGps: any) => {
    workers.current.gps?.postMessage({
      type: 'GPS_RAW',
      data: rawGps
    });
  }, []);
  
  const sendLaserData = useCallback((distance: number, timestamp: number, surveyId: string, sessionId: string) => {
    workers.current.laser?.postMessage({
      type: 'LASER_RAW',
      data: { distance, timestamp, surveyId, sessionId }
    });
  }, []);
  
  const sendImageFrame = useCallback((data: string, timestamp: number, width: number, height: number) => {
    workers.current.photo?.postMessage({
      type: 'IMAGE_FRAME',
      data: { data, timestamp, width, height }
    });
  }, []);
  
  const setActivePoiType = useCallback((poiType: string, timestamp: number = Date.now()) => {
    workers.current.laser?.postMessage({
      type: 'SET_POI_TYPE',
      data: { poiType, timestamp }
    });
  }, []);
  
  const setLaserThresholds = useCallback((min: number, max: number) => {
    workers.current.laser?.postMessage({
      type: 'SET_THRESHOLDS',
      data: { min, max }
    });
  }, []);
  
  const setContext = useCallback((surveyId: string, sessionId: string) => {
    workers.current.laser?.postMessage({
      type: 'SET_CONTEXT',
      data: { surveyId, sessionId }
    });
  }, []);
  
  return {
    isReady,
    status,
    workers: workers.current,
    sendGpsData,
    sendLaserData,
    sendImageFrame,
    setActivePoiType,
    setLaserThresholds,
    setContext
  };
}
