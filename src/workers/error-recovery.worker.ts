import { openDB, type IDBPDatabase } from 'idb';

interface ErrorRecoveryState {
  failedBatches: Map<string, any[]>;
  retryCount: Map<string, number>;
  maxRetries: number;
}

const state: ErrorRecoveryState = {
  failedBatches: new Map(),
  retryCount: new Map(),
  maxRetries: 3
};

let db: IDBPDatabase | null = null;

async function initDB() {
  db = await openDB('measurepro-recovery', 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('failedBatches')) {
        const store = db.createObjectStore('failedBatches', { keyPath: 'id', autoIncrement: true });
        store.createIndex('by-timestamp', 'timestamp');
        store.createIndex('by-worker', 'workerName');
      }
    }
  });
}

async function persistFailedBatch(workerName: string, batch: any[], error: string) {
  if (!db) return;
  
  try {
    await db.add('failedBatches', {
      workerName,
      batch,
      error,
      timestamp: Date.now(),
      retryAttempts: 0
    });
  } catch (err) {
    console.error('Failed to persist failed batch:', err);
  }
}

async function recoverFailedBatches() {
  if (!db) return;
  
  const tx = db.transaction('failedBatches', 'readwrite');
  const store = tx.objectStore('failedBatches');
  
  const batches = await store.getAll();
  
  for (const record of batches) {
    if (record.retryAttempts >= state.maxRetries) {
      // Give up on this batch after max retries
      console.error(`Giving up on batch ${record.id} after ${state.maxRetries} retries`);
      await store.delete(record.id);
      continue;
    }
    
    // Notify orchestrator to retry this batch
    self.postMessage({
      type: 'RETRY_BATCH',
      workerName: record.workerName,
      batch: record.batch,
      batchId: record.id
    });
    
    // Increment retry count
    record.retryAttempts++;
    await store.put(record);
  }
  
  await tx.done;
}

async function markBatchRecovered(batchId: number) {
  if (!db) return;
  
  try {
    await db.delete('failedBatches', batchId);
  } catch (err) {
    console.error('Failed to delete recovered batch:', err);
  }
}

self.onmessage = async (e: MessageEvent) => {
  const msg = e.data;
  
  switch (msg.type) {
    case 'PERSIST_FAILED_BATCH':
      await persistFailedBatch(msg.workerName, msg.batch, msg.error);
      break;
      
    case 'RECOVER_FAILED_BATCHES':
      await recoverFailedBatches();
      break;
      
    case 'BATCH_RECOVERED':
      await markBatchRecovered(msg.batchId);
      break;
      
    case 'GET_STATS':
      if (!db) {
        self.postMessage({
          type: 'STATS_RESPONSE',
          failedBatchCount: 0
        });
        return;
      }
      
      const count = await db.count('failedBatches');
      self.postMessage({
        type: 'STATS_RESPONSE',
        failedBatchCount: count
      });
      break;
  }
};

initDB().then(() => {
  self.postMessage({ type: 'ready' });
  
  // Auto-recover on startup
  recoverFailedBatches();
});
