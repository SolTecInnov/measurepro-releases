import { describe, it, expect, beforeEach, vi } from 'vitest';

// Stub browser globals before any imports
vi.stubGlobal('localStorage', {
  getItem: vi.fn(() => null),
  setItem: vi.fn(),
  removeItem: vi.fn(),
});

vi.stubGlobal('window', {
  dispatchEvent: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
});

// In-memory stores shared across all tests
const queueStore = new Map<string, any>();
const syncLogStore = new Map<string, any>();

const indexDefs: Record<string, Record<string, string>> = {
  queue: {
    'by-status': 'status',
    'by-surveyId': 'surveyId',
    'by-createdAt': 'createdAt',
  },
  syncLog: {
    'by-surveyId': 'surveyId',
    'by-timestamp': 'timestamp',
  },
};

function getStore(name: string): Map<string, any> {
  return name === 'queue' ? queueStore : syncLogStore;
}

const fakeDB = {
  put: vi.fn(async (storeName: string, value: any) => {
    getStore(storeName).set(value.id, value);
  }),
  get: vi.fn(async (storeName: string, key: string) => {
    return getStore(storeName).get(key) || undefined;
  }),
  delete: vi.fn(async (storeName: string, key: string) => {
    getStore(storeName).delete(key);
  }),
  getAll: vi.fn(async (storeName: string) => {
    return Array.from(getStore(storeName).values());
  }),
  getAllFromIndex: vi.fn(async (storeName: string, indexName: string, value: any) => {
    const field = indexDefs[storeName]?.[indexName];
    if (!field) return [];
    return Array.from(getStore(storeName).values()).filter((item: any) => item[field] === value);
  }),
  countFromIndex: vi.fn(async (storeName: string, indexName: string, value: any) => {
    const field = indexDefs[storeName]?.[indexName];
    if (!field) return 0;
    return Array.from(getStore(storeName).values()).filter((item: any) => item[field] === value).length;
  }),
  objectStoreNames: { contains: () => false },
  createObjectStore: vi.fn(() => ({ createIndex: vi.fn() })),
};

vi.mock('idb', () => ({
  openDB: vi.fn(async () => fakeDB),
}));

// Mock the survey/db import used in markItemCompleted
vi.mock('../../survey/db', () => ({
  openSurveyDB: vi.fn(async () => ({
    get: vi.fn(async () => null),
    put: vi.fn(async () => {}),
  })),
}));

// We must reset the cached dbInstance in the module between tests.
// Since we can't access it directly, we reset modules.
let enqueueFirebaseSync: typeof import('../syncQueue').enqueueFirebaseSync;
let getPendingItems: typeof import('../syncQueue').getPendingItems;
let getQueueStats: typeof import('../syncQueue').getQueueStats;
let markItemInflight: typeof import('../syncQueue').markItemInflight;
let markItemFailed: typeof import('../syncQueue').markItemFailed;
let markItemCompleted: typeof import('../syncQueue').markItemCompleted;
let removeCompletedItems: typeof import('../syncQueue').removeCompletedItems;
let getLastSyncForSurvey: typeof import('../syncQueue').getLastSyncForSurvey;

describe('syncQueue', () => {
  beforeEach(async () => {
    queueStore.clear();
    syncLogStore.clear();
    vi.resetModules();

    const mod = await import('../syncQueue');
    enqueueFirebaseSync = mod.enqueueFirebaseSync;
    getPendingItems = mod.getPendingItems;
    getQueueStats = mod.getQueueStats;
    markItemInflight = mod.markItemInflight;
    markItemFailed = mod.markItemFailed;
    markItemCompleted = mod.markItemCompleted;
    removeCompletedItems = mod.removeCompletedItems;
    getLastSyncForSurvey = mod.getLastSyncForSurvey;
  });

  const meta = { surveyTitle: 'Test', poiCount: 5, hasMedia: false };

  describe('enqueueFirebaseSync', () => {
    it('enqueues a new item and returns its id', async () => {
      const id = await enqueueFirebaseSync('survey-1', 'survey_close', meta);
      expect(id).toMatch(/^sync_survey-1_/);
      expect(queueStore.size).toBe(1);
    });

    it('deduplicates pending items for same survey and type', async () => {
      const id1 = await enqueueFirebaseSync('survey-1', 'survey_close', meta);
      const id2 = await enqueueFirebaseSync('survey-1', 'survey_close', meta);
      expect(id2).toBe(id1);
      expect(queueStore.size).toBe(1);
    });

    it('allows different types for the same survey', async () => {
      await enqueueFirebaseSync('survey-1', 'survey_close', meta);
      await enqueueFirebaseSync('survey-1', 'survey_export', meta);
      expect(queueStore.size).toBe(2);
    });

    it('sets correct initial status fields', async () => {
      const id = await enqueueFirebaseSync('survey-1', 'survey_update', meta);
      const item = queueStore.get(id);
      expect(item.status).toBe('pending');
      expect(item.attempts).toBe(0);
      expect(item.lastTriedAt).toBeNull();
      expect(item.lastError).toBeNull();
      expect(item.maxAttempts).toBe(5);
    });
  });

  describe('getPendingItems', () => {
    it('returns pending items sorted by createdAt', async () => {
      await enqueueFirebaseSync('s1', 'survey_close', meta);
      await enqueueFirebaseSync('s2', 'survey_close', meta);
      const items = await getPendingItems();
      expect(items).toHaveLength(2);
      expect(items[0].createdAt).toBeLessThanOrEqual(items[1].createdAt);
    });

    it('includes failed items that are retriable', async () => {
      // Directly insert a failed item that should be retriable
      queueStore.set('sync_s1_failed', {
        id: 'sync_s1_failed',
        surveyId: 's1',
        type: 'survey_close',
        status: 'failed',
        createdAt: Date.now() - 200000,
        lastTriedAt: Date.now() - 400000, // ~6.7 min ago, backoff for attempt 1 is 300s (5 min)
        attempts: 1,
        maxAttempts: 5,
        lastError: 'network',
        payloadMeta: meta,
      });

      const pending = await getPendingItems();
      expect(pending).toHaveLength(1);
    });

    it('excludes failed items that exceeded maxAttempts', async () => {
      queueStore.set('sync_s1_max', {
        id: 'sync_s1_max',
        surveyId: 's1',
        type: 'survey_close',
        status: 'failed',
        createdAt: Date.now() - 200000,
        lastTriedAt: Date.now() - 120000,
        attempts: 5,
        maxAttempts: 5,
        lastError: 'network',
        payloadMeta: meta,
      });

      const pending = await getPendingItems();
      expect(pending).toHaveLength(0);
    });
  });

  describe('getQueueStats', () => {
    it('returns zeroes on empty queue', async () => {
      const stats = await getQueueStats();
      expect(stats).toEqual({ pending: 0, inflight: 0, failed: 0, completed: 0, total: 0 });
    });

    it('counts items by status', async () => {
      await enqueueFirebaseSync('s1', 'survey_close', meta);
      const stats = await getQueueStats();
      expect(stats.pending).toBe(1);
      expect(stats.total).toBe(1);
    });
  });

  describe('markItemInflight', () => {
    it('updates status, attempts, and lastTriedAt', async () => {
      const id = await enqueueFirebaseSync('s1', 'survey_close', meta);
      await markItemInflight(id);
      const item = queueStore.get(id);
      expect(item.status).toBe('inflight');
      expect(item.attempts).toBe(1);
      expect(item.lastTriedAt).toBeGreaterThan(0);
    });

    it('does nothing for non-existent item', async () => {
      await expect(markItemInflight('nonexistent')).resolves.toBeUndefined();
    });
  });

  describe('markItemFailed', () => {
    it('sets status to failed with error message', async () => {
      const id = await enqueueFirebaseSync('s1', 'survey_close', meta);
      await markItemFailed(id, 'Network error');
      const item = queueStore.get(id);
      expect(item.status).toBe('failed');
      expect(item.lastError).toBe('Network error');
    });
  });

  describe('markItemCompleted', () => {
    it('removes item from queue and writes sync log', async () => {
      const id = await enqueueFirebaseSync('s1', 'survey_close', meta);
      await markItemCompleted(id);
      expect(queueStore.has(id)).toBe(false);
      expect(syncLogStore.size).toBe(1);
    });
  });

  describe('removeCompletedItems', () => {
    it('removes completed items older than cutoff', async () => {
      queueStore.set('old_completed', {
        id: 'old_completed',
        surveyId: 's1',
        type: 'survey_close',
        status: 'completed',
        createdAt: Date.now() - 2 * 86400000, // 2 days ago
        attempts: 1,
        maxAttempts: 5,
        payloadMeta: meta,
      });

      const removed = await removeCompletedItems(86400000);
      expect(removed).toBe(1);
    });

    it('keeps recent completed items', async () => {
      queueStore.set('recent_completed', {
        id: 'recent_completed',
        surveyId: 's1',
        type: 'survey_close',
        status: 'completed',
        createdAt: Date.now(), // just now
        attempts: 1,
        maxAttempts: 5,
        payloadMeta: meta,
      });

      const removed = await removeCompletedItems(86400000);
      expect(removed).toBe(0);
    });
  });

  describe('getLastSyncForSurvey', () => {
    it('returns null when no logs exist', async () => {
      const result = await getLastSyncForSurvey('s1');
      expect(result).toBeNull();
    });

    it('returns the latest successful sync timestamp', async () => {
      syncLogStore.set('log1', {
        id: 'log1', surveyId: 's1', timestamp: 1000, success: true,
      });
      syncLogStore.set('log2', {
        id: 'log2', surveyId: 's1', timestamp: 2000, success: true,
      });

      const result = await getLastSyncForSurvey('s1');
      expect(result).toBe(2000);
    });

    it('ignores failed sync logs', async () => {
      syncLogStore.set('log1', {
        id: 'log1', surveyId: 's1', timestamp: 1000, success: false,
      });

      const result = await getLastSyncForSurvey('s1');
      expect(result).toBeNull();
    });
  });
});
