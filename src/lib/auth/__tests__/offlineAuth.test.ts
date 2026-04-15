import { describe, it, expect, beforeEach, vi } from 'vitest';

// Stub browser globals
const localStorageMap = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (key: string) => localStorageMap.get(key) ?? null,
  setItem: (key: string, value: string) => localStorageMap.set(key, value),
  removeItem: (key: string) => localStorageMap.delete(key),
  clear: () => localStorageMap.clear(),
});
vi.stubGlobal('navigator', { onLine: true, userAgent: 'test' });

// Mock firebase modules
vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(),
  doc: vi.fn(),
  getDoc: vi.fn(() => Promise.resolve({ exists: () => false, data: () => null })),
  setDoc: vi.fn(() => Promise.resolve()),
  updateDoc: vi.fn(() => Promise.resolve()),
}));
vi.mock('firebase/app', () => ({
  getApps: vi.fn(() => []),
}));
vi.mock('../masterAdmin', () => ({
  isMasterAdmin: (email: string | null | undefined) => email?.toLowerCase() === 'jfprince@soltec.ca',
}));

// Mock idb
const mockStore = new Map<string, any>();
vi.mock('idb', () => ({
  openDB: vi.fn(() => Promise.resolve({
    get: vi.fn((_store: string, key: string) => Promise.resolve(mockStore.get(key))),
    put: vi.fn((_store: string, data: any) => {
      mockStore.set(data.id, data);
      return Promise.resolve();
    }),
    delete: vi.fn((_store: string, key: string) => {
      mockStore.delete(key);
      return Promise.resolve();
    }),
  })),
}));

// Mock bcryptjs
vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn((pw: string) => Promise.resolve(`hashed_${pw}`)),
    compare: vi.fn((pw: string, hash: string) => Promise.resolve(hash === `hashed_${pw}`)),
  },
  hash: vi.fn((pw: string) => Promise.resolve(`hashed_${pw}`)),
  compare: vi.fn((pw: string, hash: string) => Promise.resolve(hash === `hashed_${pw}`)),
}));

import { getEffectiveNowMs } from '../offlineAuth';

describe('offlineAuth', () => {
  beforeEach(() => {
    localStorageMap.clear();
    mockStore.clear();
  });

  // ── getEffectiveNowMs (pure function, no DB) ───────────────────────
  describe('getEffectiveNowMs', () => {
    it('returns a value >= serverMs', () => {
      const serverMs = Date.now() - 5000;
      const clientMs = Date.now() - 5000;
      const result = getEffectiveNowMs(serverMs, clientMs, null);
      expect(result).toBeGreaterThanOrEqual(serverMs);
    });

    it('returns hard cap on extreme clock rollback', () => {
      const serverMs = Date.now() - 60000;
      // clientMs is far in the future relative to Date.now() => wallElapsed is very negative
      const clientMs = Date.now() + 10 * 60 * 1000; // 10 min in the future
      const hardCap = serverMs + 17 * 24 * 60 * 60 * 1000;
      const result = getEffectiveNowMs(serverMs, clientMs, null);
      expect(result).toBe(hardCap);
    });

    it('respects persisted monotonic floor', () => {
      const serverMs = Date.now() - 1000;
      const clientMs = Date.now() - 1000;
      const floorMs = serverMs + 100000; // floor well ahead
      const result = getEffectiveNowMs(serverMs, clientMs, floorMs);
      // Should be at least floor + 1000 (MIN_TICK_MS)
      expect(result).toBeGreaterThanOrEqual(floorMs + 1000);
    });

    it('never exceeds hard offline limit', () => {
      const serverMs = Date.now() - 1000;
      const clientMs = Date.now() - 1000;
      const hugeFloor = serverMs + 20 * 24 * 60 * 60 * 1000; // 20 days ahead
      const hardCap = serverMs + 17 * 24 * 60 * 60 * 1000;
      const result = getEffectiveNowMs(serverMs, clientMs, hugeFloor);
      expect(result).toBeLessThanOrEqual(hardCap);
    });

    it('advances at least MIN_TICK_MS beyond floor', () => {
      const serverMs = Date.now();
      const clientMs = Date.now();
      const floorMs = serverMs + 500;
      const result = getEffectiveNowMs(serverMs, clientMs, floorMs);
      expect(result).toBeGreaterThanOrEqual(floorMs + 1000);
    });

    it('handles null floor like no floor', () => {
      const serverMs = Date.now() - 2000;
      const clientMs = Date.now() - 2000;
      const result = getEffectiveNowMs(serverMs, clientMs, null);
      expect(result).toBeGreaterThanOrEqual(serverMs);
      expect(result).toBeLessThanOrEqual(serverMs + 17 * 24 * 60 * 60 * 1000);
    });
  });
});
