export interface GpsSample {
  timestamp: number;
  latitude: number;
  longitude: number;
  altitude?: number;
  speed?: number;
  heading?: number;
  accuracy?: number;
  satellites?: number;
  hdop?: number;
}

export interface LaserEvent {
  timestamp: number;
  rawDistance: number;
  derivedClearance?: number;
  poiType: string;
  surveyId: string;
  sessionId: string;
}

export interface TimelapseRef {
  frameIndex: number;
  timestamp: number;
  surveyTime: number;
}

export interface VideoRef {
  timestamp: number;
  videoOffset: number;
  videoId?: string;
}

export interface ImageRef {
  data: string;
  timestamp: number;
  compressed: boolean;
  width: number;
  height: number;
}

export interface PoiEventRecord {
  id: string;
  surveyId: string;
  sessionId: string;
  timestamp: number;
  createdAt: number;
  
  poiType: string;
  
  lidar: {
    rawDistance: number;
    derivedClearance?: number;
    unit: string;
  };
  
  gps: GpsSample;
  
  image?: ImageRef;
  
  timelapseRef?: TimelapseRef;
  
  videoRef?: VideoRef;
  
  metadata?: {
    vehicleId?: string;
    operatorId?: string;
    notes?: string;
  };
}

export type WorkerMessageType = 
  | 'GPS_SAMPLE'
  | 'LASER_EVENT'
  | 'IMAGE_FRAME'
  | 'REQUEST_IMAGE'
  | 'IMAGE_RESPONSE'
  | 'TIMELAPSE_FRAME'
  | 'VIDEO_CHUNK'
  | 'MAP_UPDATE'
  | 'POI_CREATED'
  | 'SET_ACTIVE_POI_TYPE'
  | 'STATUS_UPDATE'
  | 'BACKPRESSURE'
  | 'FLUSH_COMPLETE'
  | 'ERROR';

export interface GpsSampleMessage {
  type: 'GPS_SAMPLE';
  data: GpsSample;
}

export interface LaserEventMessage {
  type: 'LASER_EVENT';
  data: LaserEvent;
}

export interface ImageFrameMessage {
  type: 'IMAGE_FRAME';
  data: {
    timestamp: number;
    data: string;
    width: number;
    height: number;
  };
}

export interface RequestImageMessage {
  type: 'REQUEST_IMAGE';
  data: {
    requestId: string;
    targetTimestamp: number;
    offset: number;
  };
}

export interface ImageResponseMessage {
  type: 'IMAGE_RESPONSE';
  data: {
    requestId: string;
    image: ImageRef | null;
  };
}

export interface TimelapseFrameMessage {
  type: 'TIMELAPSE_FRAME';
  data: {
    frameIndex: number;
    timestamp: number;
    surveyTime: number;
    data?: string;
  };
}

export interface VideoChunkMessage {
  type: 'VIDEO_CHUNK';
  data: {
    timestamp: number;
    offset: number;
    chunk: Blob;
  };
}

export interface MapUpdateMessage {
  type: 'MAP_UPDATE';
  data: {
    poiId: string;
    latitude: number;
    longitude: number;
    poiType: string;
    clusterId?: string;
  };
}

export interface PoiCreatedMessage {
  type: 'POI_CREATED';
  data: {
    poiId: string;
    timestamp: number;
  };
}

export interface SetActivePoiTypeMessage {
  type: 'SET_ACTIVE_POI_TYPE';
  data: {
    poiType: string;
    timestamp: number;
  };
}

export interface StatusUpdateMessage {
  type: 'STATUS_UPDATE';
  data: {
    workerName: string;
    queueSize: number;
    lastBatchSize?: number;
    lastBatchDuration?: number;
    totalProcessed?: number;
    droppedEvents?: number;
  };
}

export interface BackpressureMessage {
  type: 'BACKPRESSURE';
  data: {
    workerName: string;
    active: boolean;
    queueSize: number;
    queueCap: number;
  };
}

export interface FlushCompleteMessage {
  type: 'FLUSH_COMPLETE';
  data: {
    batchSize: number;
    duration: number;
    totalWritten: number;
  };
}

export interface ErrorMessage {
  type: 'ERROR';
  data: {
    workerName: string;
    error: string;
    context?: any;
  };
}

export type WorkerMessage = 
  | GpsSampleMessage
  | LaserEventMessage
  | ImageFrameMessage
  | RequestImageMessage
  | ImageResponseMessage
  | TimelapseFrameMessage
  | VideoChunkMessage
  | MapUpdateMessage
  | PoiCreatedMessage
  | SetActivePoiTypeMessage
  | StatusUpdateMessage
  | BackpressureMessage
  | FlushCompleteMessage
  | ErrorMessage;

export interface OrchestratorConfig {
  batchSize: number;
  flushInterval: number;
  queueCap: number;
  imageOffset: number;
}

export interface WorkerStatus {
  queueSize: number;
  backpressure: boolean;
  totalProcessed: number;
  droppedEvents: number;
  lastError?: string;
}

export const DEFAULT_ORCHESTRATOR_CONFIG: OrchestratorConfig = {
  batchSize: 35,
  flushInterval: 600,
  queueCap: 120,
  imageOffset: 1000,
};
