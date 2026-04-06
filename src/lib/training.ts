import { openDB, DBSchema, IDBPDatabase } from 'idb';

export interface TrainingFrame {
  id: string;
  timestamp: number;
  imageData: string; // Base64 encoded image
  metadata: {
    gps?: {
      latitude: number;
      longitude: number;
      altitude: number;
      accuracy?: number;
      heading?: number;
    };
    measurement?: {
      distance: number; // in meters
      height: number; // in meters
      groundReference: number; // in meters
    };
    poi?: {
      type: string;
      subtype: string;
    };
    survey?: {
      id: string;
      name: string;
    };
    camera?: {
      deviceId: string;
      resolution: {
        width: number;
        height: number;
      };
    };
    labels?: Array<{
      objectClass: string;
      confidence?: number;
      boundingBox?: {
        x: number;
        y: number;
        width: number;
        height: number;
      };
    }>;
  };
}

interface TrainingDB extends DBSchema {
  frames: {
    key: string;
    value: TrainingFrame;
    indexes: { 'by-timestamp': number };
  };
}

const DB_NAME = 'training-data-db';
const DB_VERSION = 1;

let db: Promise<IDBPDatabase<TrainingDB>> | null = null;

const initDB = () => {
  if (!db) {
    db = openDB<TrainingDB>(DB_NAME, DB_VERSION, {
      upgrade(database) {
        if (!database.objectStoreNames.contains('frames')) {
          const frameStore = database.createObjectStore('frames', {
            keyPath: 'id',
          });
          frameStore.createIndex('by-timestamp', 'timestamp');
        }
      },
    });
  }
  return db;
};

export const saveTrainingFrame = async (frame: TrainingFrame): Promise<void> => {
  const database = await initDB();
  await database.put('frames', frame);
};

export const getTrainingFrame = async (id: string): Promise<TrainingFrame | undefined> => {
  const database = await initDB();
  return await database.get('frames', id);
};

export const getAllTrainingFrames = async (): Promise<TrainingFrame[]> => {
  const database = await initDB();
  return await database.getAll('frames');
};

export const getTrainingFramesByDateRange = async (
  startDate: number,
  endDate: number
): Promise<TrainingFrame[]> => {
  const database = await initDB();
  const tx = database.transaction('frames', 'readonly');
  const index = tx.store.index('by-timestamp');
  const range = IDBKeyRange.bound(startDate, endDate);
  return await index.getAll(range);
};

export const deleteTrainingFrame = async (id: string): Promise<void> => {
  const database = await initDB();
  await database.delete('frames', id);
};

export const deleteAllTrainingFrames = async (): Promise<void> => {
  const database = await initDB();
  await database.clear('frames');
};

export const getTrainingFrameCount = async (): Promise<number> => {
  const database = await initDB();
  return await database.count('frames');
};

export const getTrainingDataSize = async (): Promise<{
  sizeInBytes: number;
  sizeInMB: number;
  frameCount: number;
}> => {
  const frames = await getAllTrainingFrames();
  let totalSize = 0;
  
  for (const frame of frames) {
    // Estimate size of base64 image data
    const imageSize = frame.imageData.length * 0.75; // Base64 overhead
    // Add metadata size
    const metadataSize = JSON.stringify(frame.metadata).length;
    totalSize += imageSize + metadataSize;
  }
  
  return {
    sizeInBytes: totalSize,
    sizeInMB: totalSize / (1024 * 1024),
    frameCount: frames.length,
  };
};

export const updateTrainingFrameLabels = async (
  id: string,
  labels: TrainingFrame['metadata']['labels']
): Promise<void> => {
  const database = await initDB();
  const frame = await database.get('frames', id);
  if (frame) {
    frame.metadata.labels = labels;
    await database.put('frames', frame);
  }
};

// Export training data as YOLO format
export const exportTrainingDataYOLO = async (
  frames: TrainingFrame[],
  classMapping: Map<string, number>
): Promise<Blob> => {
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();
  
  // Create images and labels folders
  const imagesFolder = zip.folder('images');
  const labelsFolder = zip.folder('labels');
  
  // Add each frame
  for (const frame of frames) {
    const frameIndex = frames.indexOf(frame);
    const imageName = `frame_${frameIndex.toString().padStart(6, '0')}.jpg`;
    const labelName = `frame_${frameIndex.toString().padStart(6, '0')}.txt`;
    
    // Add image (remove base64 prefix if present)
    const imageData = frame.imageData.replace(/^data:image\/\w+;base64,/, '');
    imagesFolder?.file(imageName, imageData, { base64: true });
    
    // Create YOLO format label file
    if (frame.metadata.labels && frame.metadata.labels.length > 0) {
      const labelLines: string[] = [];
      for (const label of frame.metadata.labels) {
        if (label.boundingBox) {
          const classId = classMapping.get(label.objectClass) ?? 0;
          // YOLO format: <class_id> <x_center> <y_center> <width> <height> (normalized 0-1)
          const xCenter = label.boundingBox.x + label.boundingBox.width / 2;
          const yCenter = label.boundingBox.y + label.boundingBox.height / 2;
          labelLines.push(
            `${classId} ${xCenter.toFixed(6)} ${yCenter.toFixed(6)} ${label.boundingBox.width.toFixed(6)} ${label.boundingBox.height.toFixed(6)}`
          );
        }
      }
      labelsFolder?.file(labelName, labelLines.join('\n'));
    }
  }
  
  // Add metadata file
  const metadata = {
    exportDate: new Date().toISOString(),
    frameCount: frames.length,
    classMapping: Object.fromEntries(classMapping),
    description: 'MeasurePRO+ AI Training Data',
  };
  zip.file('metadata.json', JSON.stringify(metadata, null, 2));
  
  // Add classes.txt file
  const classNames = Array.from(classMapping.entries())
    .sort((a, b) => a[1] - b[1])
    .map(([name]) => name);
  zip.file('classes.txt', classNames.join('\n'));
  
  // Generate ZIP
  return await zip.generateAsync({ type: 'blob' });
};

// Capture frame from video element
export const captureFrameFromVideo = async (
  videoElement: HTMLVideoElement
): Promise<string> => {
  const canvas = document.createElement('canvas');
  canvas.width = videoElement.videoWidth || 1280;
  canvas.height = videoElement.videoHeight || 720;
  
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }
  
  ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.92);
};

// Training session manager
export class TrainingSessionManager {
  private intervalId: number | null = null;
  private frameCount = 0;
  private isCapturing = false;
  
  constructor(
    private videoElement: HTMLVideoElement,
    private frameRate: number,
    private onFrameCaptured?: (frame: TrainingFrame) => void
  ) {}
  
  start(
    getMetadata: () => Omit<TrainingFrame['metadata'], 'labels'>
  ): void {
    if (this.isCapturing) {
      return;
    }
    
    this.isCapturing = true;
    this.frameCount = 0;
    
    const captureInterval = 1000 / this.frameRate; // Convert FPS to milliseconds
    
    this.intervalId = window.setInterval(async () => {
      try {
        const imageData = await captureFrameFromVideo(this.videoElement);
        const metadata = getMetadata();
        
        const frame: TrainingFrame = {
          id: `frame_${Date.now()}_${this.frameCount}`,
          timestamp: Date.now(),
          imageData,
          metadata: {
            ...metadata,
            labels: [],
          },
        };
        
        await saveTrainingFrame(frame);
        this.frameCount++;
        
        if (this.onFrameCaptured) {
          this.onFrameCaptured(frame);
        }
      } catch (error) {
      }
    }, captureInterval);
  }
  
  stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    this.isCapturing = false;
  }
  
  isRunning(): boolean {
    return this.isCapturing;
  }
  
  getFrameCount(): number {
    return this.frameCount;
  }
  
  updateFrameRate(frameRate: number): void {
    const wasRunning = this.isRunning();
    const metadata = this.isCapturing;
    
    if (wasRunning) {
      this.stop();
    }
    
    this.frameRate = frameRate;
    
    if (wasRunning && metadata) {
      // Restart with new frame rate - caller needs to handle this
    }
  }
}
