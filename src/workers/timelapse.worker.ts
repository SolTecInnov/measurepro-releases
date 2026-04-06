import type { TimelapseRef, WorkerMessage } from '../../shared/worker-types';

const WORKER_NAME = 'timelapse';

interface TimelapseFrame {
  frameIndex: number;
  timestamp: number;
  surveyTime: number;
  data?: string;
}

const frames: TimelapseFrame[] = [];
let totalProcessed = 0;
let currentSurveyStartTime: number = 0;

self.onmessage = (e: MessageEvent) => {
  const { type, data } = e.data;
  
  switch (type) {
    case 'START_SURVEY': {
      currentSurveyStartTime = data.timestamp || Date.now();
      frames.length = 0;
      totalProcessed = 0;
      break;
    }
      
    case 'TIMELAPSE_FRAME': {
      const surveyTime = (data.timestamp || Date.now()) - currentSurveyStartTime;
      
      const frame: TimelapseFrame = {
        frameIndex: frames.length,
        timestamp: data.timestamp || Date.now(),
        surveyTime,
        data: data.data
      };
      
      frames.push(frame);
      totalProcessed++;
      
      self.postMessage({
        type: 'TIMELAPSE_FRAME',
        data: {
          frameIndex: frame.frameIndex,
          timestamp: frame.timestamp,
          surveyTime: frame.surveyTime
        }
      } as WorkerMessage);
      break;
    }
      
    case 'GET_FRAME_REF': {
      const { targetTimestamp } = data;
      
      let closestFrame: TimelapseFrame | null = null;
      let minDiff = Infinity;
      
      for (const frame of frames) {
        const diff = Math.abs(frame.timestamp - targetTimestamp);
        if (diff < minDiff) {
          minDiff = diff;
          closestFrame = frame;
        }
      }
      
      if (closestFrame) {
        const ref: TimelapseRef = {
          frameIndex: closestFrame.frameIndex,
          timestamp: closestFrame.timestamp,
          surveyTime: closestFrame.surveyTime
        };
        
        self.postMessage({
          type: 'TIMELAPSE_REF_RESPONSE',
          data: ref
        });
      } else {
        self.postMessage({
          type: 'TIMELAPSE_REF_RESPONSE',
          data: null
        });
      }
      break;
    }
      
    case 'GET_STATUS': {
      self.postMessage({
        type: 'STATUS_UPDATE',
        data: {
          workerName: WORKER_NAME,
          queueSize: frames.length,
          totalProcessed
        }
      } as WorkerMessage);
      break;
    }
      
    case 'EXPORT_TIMELAPSE': {
      self.postMessage({
        type: 'TIMELAPSE_EXPORT',
        data: {
          frames: frames.map(f => ({
            frameIndex: f.frameIndex,
            timestamp: f.timestamp,
            surveyTime: f.surveyTime
          })),
          totalFrames: frames.length
        }
      });
      break;
    }
      
    case 'CLEAR': {
      frames.length = 0;
      totalProcessed = 0;
      currentSurveyStartTime = 0;
      break;
    }
  }
};

self.postMessage({ type: 'ready' });
