import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.hoisted(() => {
  (globalThis as any).localStorage = {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  };
});

describe('indexedDBHealth', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  describe('checkIndexedDBHealth', () => {
    it('returns false when indexedDB is undefined', async () => {
      const origIDB = globalThis.indexedDB;
      (globalThis as any).indexedDB = undefined;

      const { checkIndexedDBHealth } = await import('../indexedDBHealth');
      const result = await checkIndexedDBHealth();
      expect(result).toBe(false);

      (globalThis as any).indexedDB = origIDB;
    });

    it('returns false when indexedDB.open fails', async () => {
      const origIDB = globalThis.indexedDB;
      const mockError = new Error('blocked');
      (globalThis as any).indexedDB = {
        open: vi.fn(() => {
          const req = { error: mockError } as any;
          setTimeout(() => req.onerror?.(), 0);
          return req;
        }),
        deleteDatabase: vi.fn(),
      };

      const { checkIndexedDBHealth } = await import('../indexedDBHealth');
      const result = await checkIndexedDBHealth();
      expect(result).toBe(false);

      (globalThis as any).indexedDB = origIDB;
    });

    it('returns true when indexedDB works and storage is fine', async () => {
      const origIDB = globalThis.indexedDB;

      const mockStore = {
        put: vi.fn(() => {
          const req = {} as any;
          setTimeout(() => req.onsuccess?.(), 0);
          return req;
        }),
      };
      const mockTransaction = {
        objectStore: vi.fn(() => mockStore),
      };
      const mockDb = {
        transaction: vi.fn(() => mockTransaction),
        close: vi.fn(),
        objectStoreNames: { contains: vi.fn(() => true) },
      };

      (globalThis as any).indexedDB = {
        open: vi.fn(() => {
          const req = { result: mockDb } as any;
          setTimeout(() => req.onsuccess?.(), 0);
          return req;
        }),
        deleteDatabase: vi.fn(),
      };

      // Mock navigator.storage using vi.stubGlobal
      vi.stubGlobal('navigator', {
        ...navigator,
        storage: {
          estimate: vi.fn(() => Promise.resolve({ usage: 100, quota: 10000 })),
        },
      });

      const { checkIndexedDBHealth } = await import('../indexedDBHealth');
      const result = await checkIndexedDBHealth();
      expect(result).toBe(true);

      (globalThis as any).indexedDB = origIDB;
    });

    it('returns cached result on second call', async () => {
      const origIDB = globalThis.indexedDB;
      (globalThis as any).indexedDB = undefined;

      const { checkIndexedDBHealth } = await import('../indexedDBHealth');
      const first = await checkIndexedDBHealth();
      expect(first).toBe(false);

      (globalThis as any).indexedDB = origIDB;
      const second = await checkIndexedDBHealth();
      expect(second).toBe(false);
    });

    it('returns false when storage quota is critical (>95%)', async () => {
      const origIDB = globalThis.indexedDB;

      const mockStore = {
        put: vi.fn(() => {
          const req = {} as any;
          setTimeout(() => req.onsuccess?.(), 0);
          return req;
        }),
      };
      const mockDb = {
        transaction: vi.fn(() => ({ objectStore: vi.fn(() => mockStore) })),
        close: vi.fn(),
        objectStoreNames: { contains: vi.fn(() => true) },
      };

      (globalThis as any).indexedDB = {
        open: vi.fn(() => {
          const req = { result: mockDb } as any;
          setTimeout(() => req.onsuccess?.(), 0);
          return req;
        }),
        deleteDatabase: vi.fn(),
      };

      vi.stubGlobal('navigator', {
        ...navigator,
        storage: {
          estimate: vi.fn(() => Promise.resolve({ usage: 9600, quota: 10000 })),
        },
      });

      const { checkIndexedDBHealth } = await import('../indexedDBHealth');
      const result = await checkIndexedDBHealth();
      expect(result).toBe(false);

      (globalThis as any).indexedDB = origIDB;
    });
  });

  describe('clearAllIndexedDBDatabases', () => {
    it('calls deleteDatabase for each known database', async () => {
      const origIDB = globalThis.indexedDB;
      const deletedDbs: string[] = [];

      (globalThis as any).indexedDB = {
        open: vi.fn(),
        deleteDatabase: vi.fn((name: string) => {
          deletedDbs.push(name);
          const req = {} as any;
          setTimeout(() => req.onsuccess?.(), 0);
          return req;
        }),
      };

      const { clearAllIndexedDBDatabases } = await import('../indexedDBHealth');
      await clearAllIndexedDBDatabases();

      expect(deletedDbs.length).toBeGreaterThan(10);
      expect(deletedDbs).toContain('survey-db');
      expect(deletedDbs).toContain('__measurepro_healthcheck__');

      (globalThis as any).indexedDB = origIDB;
    });

    it('handles blocked deletion gracefully', async () => {
      const origIDB = globalThis.indexedDB;

      (globalThis as any).indexedDB = {
        open: vi.fn(),
        deleteDatabase: vi.fn(() => {
          const req = {} as any;
          setTimeout(() => req.onblocked?.(), 0);
          return req;
        }),
      };

      const { clearAllIndexedDBDatabases } = await import('../indexedDBHealth');
      await expect(clearAllIndexedDBDatabases()).resolves.toBeUndefined();

      (globalThis as any).indexedDB = origIDB;
    });
  });
});
