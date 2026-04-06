import { captureFrameWithOverlay, captureBufferedFrameWithOverlay, CaptureOverlayData, CaptureResult } from './capture';
import { logger } from '@/lib/utils/logger';

interface QueueItem {
  id: string;
  videoElement?: HTMLVideoElement;
  bufferedCapture?: {
    delaySeconds: number;
  };
  overlayData: CaptureOverlayData;
  overlayOptions: any;
  imageFormat: 'image/jpeg' | 'image/png';
  resolve: (result: CaptureResult | null) => void;
  reject: (error: Error) => void;
  queuedAt: number;
}

class CaptureQueue {
  private queue: QueueItem[] = [];
  private processing = false;
  private readonly MAX_QUEUE_SIZE = 50; // PRODUCTION FIX: Limit queue depth to prevent memory exhaustion
  private droppedCount = 0;

  public async queueCapture(
    videoElement: HTMLVideoElement,
    overlayData: CaptureOverlayData,
    overlayOptions: any,
    imageFormat: 'image/jpeg' | 'image/png' = 'image/jpeg'
  ): Promise<CaptureResult> {
    // PRODUCTION FIX: Back-pressure - reject if queue is full
    if (this.queue.length >= this.MAX_QUEUE_SIZE) {
      this.droppedCount++;
      logger.warn(`⚠️ Capture queue full (${this.queue.length}/${this.MAX_QUEUE_SIZE}), dropping capture request`);
      throw new Error(`Capture queue full (max ${this.MAX_QUEUE_SIZE}). Try again later.`);
    }
    
    return new Promise((resolve, reject) => {
      const id = crypto.randomUUID();
      
      this.queue.push({
        id,
        videoElement,
        overlayData,
        overlayOptions,
        imageFormat,
        resolve: resolve as (result: CaptureResult | null) => void,
        reject,
        queuedAt: performance.now()
      });
      
      logger.debug(`📸 Queued capture ${id} (queue size: ${this.queue.length})`);
      
      if (!this.processing) {
        this.processQueue();
      }
    });
  }

  public async queueBufferedCapture(
    delaySeconds: number,
    overlayData: CaptureOverlayData,
    overlayOptions: any,
    imageFormat: 'image/jpeg' | 'image/png' = 'image/jpeg'
  ): Promise<CaptureResult | null> {
    // PRODUCTION FIX: Back-pressure - reject if queue is full
    if (this.queue.length >= this.MAX_QUEUE_SIZE) {
      this.droppedCount++;
      logger.warn(`⚠️ Capture queue full (${this.queue.length}/${this.MAX_QUEUE_SIZE}), dropping buffered capture request`);
      throw new Error(`Capture queue full (max ${this.MAX_QUEUE_SIZE}). Try again later.`);
    }
    
    return new Promise((resolve, reject) => {
      const id = crypto.randomUUID();
      
      this.queue.push({
        id,
        bufferedCapture: { delaySeconds },
        overlayData,
        overlayOptions,
        imageFormat,
        resolve,
        reject,
        queuedAt: performance.now()
      });
      
      logger.debug(`📸 Queued buffered capture ${id} with ${delaySeconds}s delay (queue size: ${this.queue.length})`);
      
      if (!this.processing) {
        this.processQueue();
      }
    });
  }

  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;
    logger.debug(`🔄 Starting queue processing (${this.queue.length} items)`);

    while (this.queue.length > 0) {
      const item = this.queue.shift();
      if (!item) break;

      try {
        await new Promise<void>(resolve => {
          if ('requestIdleCallback' in window) {
            requestIdleCallback(() => resolve(), { timeout: 100 });
          } else {
            setTimeout(() => resolve(), 0);
          }
        });

        const startTime = performance.now();
        let result: CaptureResult | null;

        if (item.bufferedCapture) {
          logger.debug(`📸 Processing buffered capture ${item.id}`);
          result = await captureBufferedFrameWithOverlay(
            item.bufferedCapture.delaySeconds,
            item.overlayData,
            item.overlayOptions,
            item.imageFormat
          );
        } else if (item.videoElement) {
          logger.debug(`📸 Processing live capture ${item.id}`);
          result = await captureFrameWithOverlay(
            item.videoElement,
            item.overlayData,
            item.overlayOptions,
            item.imageFormat
          );
        } else {
          throw new Error('Invalid queue item: missing videoElement and bufferedCapture');
        }

        const duration = performance.now() - startTime;
        const queueTime = startTime - item.queuedAt;
        
        logger.debug(`✅ Completed capture ${item.id} (processing: ${duration.toFixed(0)}ms, queue wait: ${queueTime.toFixed(0)}ms)`);
        
        item.resolve(result);
      } catch (error) {
        logger.error(`❌ Failed capture ${item.id}:`, error);
        item.reject(error instanceof Error ? error : new Error(String(error)));
      }

      await new Promise(resolve => setTimeout(resolve, 10));
    }

    this.processing = false;
    logger.debug('✅ Queue processing complete');
  }

  public getQueueSize(): number {
    return this.queue.length;
  }

  public isProcessing(): boolean {
    return this.processing;
  }

  // PRODUCTION FIX: Add monitoring method for queue health
  public getStats() {
    return {
      queueSize: this.queue.length,
      isProcessing: this.processing,
      droppedCount: this.droppedCount,
      maxQueueSize: this.MAX_QUEUE_SIZE,
      utilizationPercent: (this.queue.length / this.MAX_QUEUE_SIZE) * 100
    };
  }

  public clearQueue(): void {
    const clearedCount = this.queue.length;
    this.queue.forEach(item => {
      item.reject(new Error('Queue cleared'));
    });
    this.queue = [];
    logger.debug(`🗑️ Cleared ${clearedCount} queued captures`);
  }
}

export const captureQueue = new CaptureQueue();
