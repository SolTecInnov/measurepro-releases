import type { ImageRef, WorkerMessage } from '../../shared/worker-types';

const WORKER_NAME = 'photo';

const BUFFER_DURATION_MS = 2000;
const MAX_BUFFER_SIZE = 60;

interface BufferedFrame {
  timestamp: number;
  data: string;
  width: number;
  height: number;
  compressed: boolean;
}

const frameBuffer: BufferedFrame[] = [];
let totalProcessed = 0;
let droppedFrames = 0;

function cleanupOldFrames() {
  const now = Date.now();
  const cutoff = now - BUFFER_DURATION_MS;
  
  while (frameBuffer.length > 0 && frameBuffer[0].timestamp < cutoff) {
    frameBuffer.shift();
    droppedFrames++;
  }
  
  while (frameBuffer.length > MAX_BUFFER_SIZE) {
    frameBuffer.shift();
    droppedFrames++;
  }
}

function findBestMatchFrame(targetTimestamp: number): BufferedFrame | null {
  if (frameBuffer.length === 0) return null;
  
  let bestMatch = frameBuffer[0];
  let minDiff = Math.abs(frameBuffer[0].timestamp - targetTimestamp);
  
  for (const frame of frameBuffer) {
    const diff = Math.abs(frame.timestamp - targetTimestamp);
    if (diff < minDiff) {
      minDiff = diff;
      bestMatch = frame;
    }
  }
  
  return minDiff < BUFFER_DURATION_MS ? bestMatch : null;
}

async function compressFrame(dataUrl: string, width: number, height: number): Promise<string> {
  try {
    const img = await createImageBitmap(await fetch(dataUrl).then(r => r.blob()));
    
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    if (!ctx) return dataUrl;
    
    ctx.drawImage(img, 0, 0, width, height);
    
    const blob = await canvas.convertToBlob({
      type: 'image/webp',
      quality: 0.75
    });
    
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  } catch {
    return dataUrl;
  }
}

self.onmessage = async (e: MessageEvent) => {
  const { type, data } = e.data;
  
  switch (type) {
    case 'IMAGE_FRAME': {
      totalProcessed++;
      
      const targetWidth = data.width > 800 ? 800 : data.width;
      const targetHeight = Math.round(data.height * (targetWidth / data.width));
      
      const compressedData = await compressFrame(data.data, targetWidth, targetHeight);
      
      const frame: BufferedFrame = {
        timestamp: data.timestamp || Date.now(),
        data: compressedData,
        width: targetWidth,
        height: targetHeight,
        compressed: true
      };
      
      frameBuffer.push(frame);
      cleanupOldFrames();
      break;
    }
      
    case 'REQUEST_IMAGE': {
      const { requestId, targetTimestamp } = data;
      
      const bestFrame = findBestMatchFrame(targetTimestamp);
      
      let imageRef: ImageRef | null = null;
      if (bestFrame) {
        imageRef = {
          data: bestFrame.data,
          timestamp: bestFrame.timestamp,
          compressed: bestFrame.compressed,
          width: bestFrame.width,
          height: bestFrame.height
        };
      }
      
      self.postMessage({
        type: 'IMAGE_RESPONSE',
        data: {
          requestId,
          image: imageRef
        }
      } as WorkerMessage);
      break;
    }
      
    case 'GET_STATUS': {
      self.postMessage({
        type: 'STATUS_UPDATE',
        data: {
          workerName: WORKER_NAME,
          queueSize: frameBuffer.length,
          totalProcessed,
          droppedEvents: droppedFrames
        }
      } as WorkerMessage);
      break;
    }
      
    case 'CLEAR_BUFFER': {
      frameBuffer.length = 0;
      break;
    }
  }
};

self.postMessage({ type: 'ready' });
