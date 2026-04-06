/**
 * Image Processing Worker Pool
 * Manages multiple workers for parallel image processing
 */

import type { ImageProcessingTask, ImageProcessingResult } from './imageProcessingWorker';

export class ImageProcessingPool {
  private workers: Worker[] = [];
  private availableWorkers: Worker[] = [];
  private taskQueue: Array<{
    task: ImageProcessingTask;
    resolve: (result: ImageProcessingResult) => void;
    reject: (error: Error) => void;
  }> = [];
  private poolSize: number;

  constructor(poolSize: number = navigator.hardwareConcurrency || 2) {
    // Limit pool size to reasonable range (2-4 workers)
    this.poolSize = Math.max(2, Math.min(4, poolSize));
    this.initializePool();
  }

  private initializePool(): void {
    for (let i = 0; i < this.poolSize; i++) {
      const worker = new Worker(
        new URL('./imageProcessingWorker.ts', import.meta.url),
        { type: 'module' }
      );
      
      worker.onmessage = (event: MessageEvent<ImageProcessingResult>) => {
        this.handleWorkerMessage(worker, event.data);
      };

      worker.onerror = (error) => {
        this.handleWorkerError(worker, error);
      };

      this.workers.push(worker);
      this.availableWorkers.push(worker);
    }
  }

  /**
   * Process image task using available worker
   */
  public async processImage(task: ImageProcessingTask): Promise<ImageProcessingResult> {
    return new Promise((resolve, reject) => {
      this.taskQueue.push({ task, resolve, reject });
      this.processQueue();
    });
  }

  /**
   * Capture and compress image from video element
   */
  public async captureFromVideo(
    videoElement: HTMLVideoElement,
    options: {
      quality?: number;
      format?: 'jpeg' | 'png';
      maxWidth?: number;
      maxHeight?: number;
    } = {}
  ): Promise<ImageProcessingResult> {
    // Create ImageBitmap from video (fast, off main thread)
    const bitmap = await createImageBitmap(videoElement);

    const task: ImageProcessingTask = {
      id: crypto.randomUUID(),
      type: 'capture',
      videoFrame: bitmap,
      options: {
        quality: options.quality || 0.75,
        format: options.format || 'jpeg',
        maxWidth: options.maxWidth,
        maxHeight: options.maxHeight,
      },
    };

    return this.processImage(task);
  }

  /**
   * Compress existing image blob
   */
  public async compressImage(
    blob: Blob,
    options: {
      quality?: number;
      format?: 'jpeg' | 'png';
      maxWidth?: number;
      maxHeight?: number;
    } = {}
  ): Promise<ImageProcessingResult> {
    // Convert blob to ImageBitmap
    const bitmap = await createImageBitmap(blob);

    const task: ImageProcessingTask = {
      id: crypto.randomUUID(),
      type: 'compress',
      videoFrame: bitmap,
      options,
    };

    return this.processImage(task);
  }

  /**
   * Apply overlay to video frame
   */
  public async applyOverlay(
    videoElement: HTMLVideoElement,
    overlayData: {
      text?: string;
      timestamp?: string;
      gps?: { lat: number; lon: number };
      height?: number;
    },
    options: {
      quality?: number;
      format?: 'jpeg' | 'png';
    } = {}
  ): Promise<ImageProcessingResult> {
    const bitmap = await createImageBitmap(videoElement);

    const task: ImageProcessingTask = {
      id: crypto.randomUUID(),
      type: 'overlay',
      videoFrame: bitmap,
      options: {
        quality: options.quality || 0.75,
        format: options.format || 'jpeg',
        overlay: overlayData,
      },
    };

    return this.processImage(task);
  }

  private processQueue(): void {
    while (this.taskQueue.length > 0 && this.availableWorkers.length > 0) {
      const worker = this.availableWorkers.pop()!;
      const { task, resolve, reject } = this.taskQueue.shift()!;

      // Store resolve/reject for this task
      (worker as any)._currentTask = { resolve, reject };

      // Send task to worker
      worker.postMessage(task);
    }
  }

  private handleWorkerMessage(worker: Worker, result: ImageProcessingResult): void {
    const taskHandlers = (worker as any)._currentTask;
    
    if (taskHandlers) {
      if (result.error) {
        taskHandlers.reject(new Error(result.error));
      } else {
        taskHandlers.resolve(result);
      }
      delete (worker as any)._currentTask;
    }

    // Return worker to available pool
    this.availableWorkers.push(worker);
    
    // Process next task if queue has items
    this.processQueue();
  }

  private handleWorkerError(worker: Worker, error: ErrorEvent): void {
    const taskHandlers = (worker as any)._currentTask;
    
    if (taskHandlers) {
      taskHandlers.reject(new Error(error.message || 'Worker error'));
      delete (worker as any)._currentTask;
    }

    // Return worker to pool (it's still usable)
    this.availableWorkers.push(worker);
    this.processQueue();
  }

  /**
   * Get pool statistics
   */
  public getStats(): {
    totalWorkers: number;
    availableWorkers: number;
    queueLength: number;
  } {
    return {
      totalWorkers: this.workers.length,
      availableWorkers: this.availableWorkers.length,
      queueLength: this.taskQueue.length,
    };
  }

  /**
   * Terminate all workers
   */
  public terminate(): void {
    this.workers.forEach(worker => worker.terminate());
    this.workers = [];
    this.availableWorkers = [];
    this.taskQueue = [];
  }
}

// Singleton instance
let imageProcessingPool: ImageProcessingPool | null = null;

export function getImageProcessingPool(): ImageProcessingPool {
  if (!imageProcessingPool) {
    imageProcessingPool = new ImageProcessingPool();
  }
  return imageProcessingPool;
}

export function terminateImageProcessingPool(): void {
  if (imageProcessingPool) {
    imageProcessingPool.terminate();
    imageProcessingPool = null;
  }
}
