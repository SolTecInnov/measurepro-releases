import { openDB, type IDBPDatabase } from 'idb';
import type { PoiEventRecord } from '../../shared/worker-types';

interface LoadPageRequest {
  type: 'LOAD_PAGE';
  surveyId: string;
  pageSize: number;
  offset: number;
}

interface LoadPageResponse {
  type: 'PAGE_LOADED';
  requestId: string;
  records: PoiEventRecord[];
  totalCount: number;
  hasMore: boolean;
}

interface CountRequest {
  type: 'COUNT';
  surveyId: string;
}

interface CountResponse {
  type: 'COUNT_RESPONSE';
  surveyId: string;
  totalCount: number;
}

let db: IDBPDatabase | null = null;

async function initDB() {
  db = await openDB('measurepro-v2', 1);
}

async function getCount(surveyId: string): Promise<number> {
  if (!db) return 0;
  
  const tx = db.transaction('poiEvents', 'readonly');
  const index = tx.objectStore('poiEvents').index('by-survey');
  
  let count = 0;
  let cursor = await index.openCursor(surveyId);
  
  while (cursor) {
    count++;
    cursor = await cursor.continue();
  }
  
  return count;
}

async function loadPage(surveyId: string, pageSize: number, offset: number): Promise<{ records: PoiEventRecord[], totalCount: number, hasMore: boolean }> {
  if (!db) {
    return { records: [], totalCount: 0, hasMore: false };
  }
  
  const tx = db.transaction('poiEvents', 'readonly');
  const index = tx.objectStore('poiEvents').index('by-survey-timestamp');
  
  const records: PoiEventRecord[] = [];
  let cursor = await index.openCursor(IDBKeyRange.bound([surveyId, 0], [surveyId, Date.now()]), 'prev');
  
  let skipped = 0;
  while (cursor && skipped < offset) {
    cursor = await cursor.continue();
    skipped++;
  }
  
  while (cursor && records.length < pageSize) {
    records.push(cursor.value as PoiEventRecord);
    cursor = await cursor.continue();
  }
  
  const totalCount = await getCount(surveyId);
  const hasMore = (offset + records.length) < totalCount;
  
  return { records, totalCount, hasMore };
}

self.onmessage = async (e: MessageEvent<LoadPageRequest | CountRequest>) => {
  const msg = e.data;
  
  switch (msg.type) {
    case 'LOAD_PAGE': {
      const result = await loadPage(msg.surveyId, msg.pageSize, msg.offset);
      
      self.postMessage({
        type: 'PAGE_LOADED',
        requestId: `${msg.surveyId}-${msg.offset}`,
        records: result.records,
        totalCount: result.totalCount,
        hasMore: result.hasMore
      } as LoadPageResponse);
      break;
    }
      
    case 'COUNT': {
      const totalCount = await getCount(msg.surveyId);
      
      self.postMessage({
        type: 'COUNT_RESPONSE',
        surveyId: msg.surveyId,
        totalCount
      } as CountResponse);
      break;
    }
  }
};

initDB().then(() => {
  self.postMessage({ type: 'ready' });
});
