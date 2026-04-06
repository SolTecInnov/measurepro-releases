import type { VideoRef, WorkerMessage } from '../../shared/worker-types';

const WORKER_NAME = 'video';

interface VideoSegment {
  timestamp: number;
  offset: number;
  videoId: string;
}

const segments: VideoSegment[] = [];
let currentVideoId: string = '';
let videoStartTime: number = 0;
let totalProcessed = 0;

self.onmessage = (e: MessageEvent) => {
  const { type, data } = e.data;
  
  switch (type) {
    case 'START_VIDEO': {
      currentVideoId = data.videoId || `video-${Date.now()}`;
      videoStartTime = data.timestamp || Date.now();
      segments.length = 0;
      break;
    }
      
    case 'VIDEO_CHUNK': {
      const offset = (data.timestamp || Date.now()) - videoStartTime;
      
      const segment: VideoSegment = {
        timestamp: data.timestamp || Date.now(),
        offset,
        videoId: currentVideoId
      };
      
      segments.push(segment);
      totalProcessed++;
      
      self.postMessage({
        type: 'VIDEO_CHUNK',
        data: {
          timestamp: segment.timestamp,
          offset: segment.offset,
          chunk: data.chunk
        }
      } as WorkerMessage);
      break;
    }
      
    case 'GET_VIDEO_REF': {
      const { targetTimestamp } = data;
      
      let closestSegment: VideoSegment | null = null;
      let minDiff = Infinity;
      
      for (const segment of segments) {
        const diff = Math.abs(segment.timestamp - targetTimestamp);
        if (diff < minDiff) {
          minDiff = diff;
          closestSegment = segment;
        }
      }
      
      if (closestSegment) {
        const ref: VideoRef = {
          timestamp: closestSegment.timestamp,
          videoOffset: closestSegment.offset,
          videoId: closestSegment.videoId
        };
        
        self.postMessage({
          type: 'VIDEO_REF_RESPONSE',
          data: ref
        });
      } else {
        self.postMessage({
          type: 'VIDEO_REF_RESPONSE',
          data: null
        });
      }
      break;
    }
      
    case 'STOP_VIDEO': {
      currentVideoId = '';
      videoStartTime = 0;
      break;
    }
      
    case 'GET_STATUS': {
      self.postMessage({
        type: 'STATUS_UPDATE',
        data: {
          workerName: WORKER_NAME,
          queueSize: segments.length,
          totalProcessed
        }
      } as WorkerMessage);
      break;
    }
      
    case 'CLEAR': {
      segments.length = 0;
      totalProcessed = 0;
      currentVideoId = '';
      videoStartTime = 0;
      break;
    }
  }
};

self.postMessage({ type: 'ready' });
