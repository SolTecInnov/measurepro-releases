/**
 * Storage Worker Pool
 * Manages storage worker for IndexedDB operations
 */

export interface StorageTask {
  id: string;
  type: 'addPOI' | 'saveMeasurement' | 'saveVideoChunk' | 'batch';
  data: any;
}

export interface StorageResult {
  id: string;
  success: boolean;
  error?: string;
  data?: any;
}

export class StoragePool {
  private worker: Worker | null = null;
  private pendingTasks: Map<string, {
    resolve: (result: StorageResult) => void;
    reject: (error: Error) => void;
  }> = new Map();

  constructor() {
    this.initializeWorker();
  }

  private initializeWorker(): void {
    this.worker = new Worker(
      new URL('./storageWorker.ts', import.meta.url),
      { type: 'module' }
    );

    this.worker.onmessage = (event: MessageEvent<StorageResult>) => {
      this.handleWorkerMessage(event.data);
    };

    this.worker.onerror = (error) => {
    };
  }

  /**
   * Add POI to queue (batch processing)
   * CRITICAL: Worker batches writes with 500ms timeout OR 10 items threshold
   */
  public async queuePOI(measurement: any): Promise<StorageResult> {
    const task: StorageTask = {
      id: crypto.randomUUID(),
      type: 'addPOI',
      data: measurement,
    };

    return this.executeTask(task);
  }

  /**
   * Save measurement immediately (bypass queue)
   */
  public async saveMeasurement(measurement: any): Promise<StorageResult> {
    const task: StorageTask = {
      id: crypto.randomUUID(),
      type: 'saveMeasurement',
      data: measurement,
    };

    return this.executeTask(task);
  }

  /**
   * Save video chunk progressively
   */
  public async saveVideoChunk(
    recordingId: string,
    chunk: Blob,
    chunkIndex: number
  ): Promise<StorageResult> {
    const task: StorageTask = {
      id: crypto.randomUUID(),
      type: 'saveVideoChunk',
      data: {
        recordingId,
        chunk,
        chunkIndex,
        timestamp: Date.now(),
      },
    };

    return this.executeTask(task);
  }

  /**
   * Flush all pending POIs immediately
   * CRITICAL: Call on unmount, survey change, logging stop, error
   */
  public async flush(): Promise<StorageResult> {
    const task: StorageTask = {
      id: crypto.randomUUID(),
      type: 'batch',
      data: {},
    };

    return this.executeTask(task);
  }

  /**
   * Force batch write (alias for flush)
   */
  public async forceBatch(): Promise<StorageResult> {
    return this.flush();
  }

  private executeTask(task: StorageTask): Promise<StorageResult> {
    return new Promise((resolve, reject) => {
      if (!this.worker) {
        reject(new Error('Storage worker not initialized'));
        return;
      }

      this.pendingTasks.set(task.id, { resolve, reject });
      this.worker.postMessage(task);
    });
  }

  private handleWorkerMessage(result: StorageResult): void {
    const handlers = this.pendingTasks.get(result.id);
    
    if (handlers) {
      if (result.success) {
        handlers.resolve(result);
      } else {
        handlers.reject(new Error(result.error || 'Storage operation failed'));
      }
      this.pendingTasks.delete(result.id);
    }
  }

  /**
   * Terminate worker
   */
  public terminate(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.pendingTasks.clear();
  }
}

// Singleton instance
let storagePool: StoragePool | null = null;

export function getStoragePool(): StoragePool {
  if (!storagePool) {
    storagePool = new StoragePool();
  }
  return storagePool;
}

export function terminateStoragePool(): void {
  if (storagePool) {
    storagePool.terminate();
    storagePool = null;
  }
}
