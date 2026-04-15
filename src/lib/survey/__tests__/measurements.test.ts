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
vi.stubGlobal('crypto', { randomUUID: () => 'meas-uuid-1234' });

// Mock window.dispatchEvent so it doesn't fail
vi.stubGlobal('window', {
  ...globalThis.window,
  dispatchEvent: vi.fn(),
});

// Track mock measurements
const mockMeasurements: any[] = [];

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock('@/lib/sounds', () => ({
  soundManager: { playLogEntry: vi.fn(), subscribe: vi.fn(() => vi.fn()) },
  soundPath: (f: string) => `/sounds/${f}`,
}));

const mockPut = vi.fn(async (_store: string, data: any) => {
  const idx = mockMeasurements.findIndex((m: any) => m.id === data.id);
  if (idx >= 0) mockMeasurements[idx] = data;
  else mockMeasurements.push(data);
});

vi.mock('../db', () => ({
  openSurveyDB: vi.fn(async () => ({
    get: vi.fn(async (_store: string, id: string) =>
      mockMeasurements.find((m: any) => m.id === id) || null
    ),
    put: mockPut,
    delete: vi.fn(async (_store: string, id: string) => {
      const idx = mockMeasurements.findIndex((m: any) => m.id === id);
      if (idx >= 0) mockMeasurements.splice(idx, 1);
    }),
    getAllFromIndex: vi.fn(async () => [...mockMeasurements]),
    transaction: vi.fn(() => ({
      objectStore: vi.fn(() => ({
        index: vi.fn(() => ({
          openCursor: vi.fn(async (_key: string, _dir?: string) => {
            // Return measurements in reverse (simulating 'prev' cursor)
            const items = [...mockMeasurements].reverse();
            let idx = 0;
            const makeCursor = (): any => {
              if (idx >= items.length) return null;
              const value = items[idx];
              idx++;
              return {
                value,
                continue: vi.fn(async () => makeCursor()),
              };
            };
            return makeCursor();
          }),
        })),
        getAll: vi.fn(async () => [...mockMeasurements]),
        delete: vi.fn(async (id: string) => {
          const idx = mockMeasurements.findIndex((m: any) => m.id === id);
          if (idx >= 0) mockMeasurements.splice(idx, 1);
        }),
      })),
    })),
  })),
  initCSVBackupDB: vi.fn(() => Promise.resolve(null)),
  incrementMutationCounter: vi.fn(),
}));

vi.mock('../../stores/videoRecordingStore', () => ({
  useVideoRecordingStore: {
    getState: () => ({ isRecording: false, currentRecordingId: null, getCurrentTimestamp: () => null }),
  },
}));

vi.mock('../measurementSnapshot', () => ({
  incrementPersistedVersion: vi.fn(() => Promise.resolve()),
  invalidateSnapshot: vi.fn(),
}));

vi.mock('../workerAdapter', () => ({
  addMeasurementViaWorker: vi.fn(() => Promise.resolve()),
  isWorkerArchitectureAvailable: vi.fn(() => false), // force main-thread path for testing
}));

vi.mock('../MeasurementFeed', () => ({
  getMeasurementFeed: () => ({
    removeMeasurement: vi.fn(),
    updateMeasurement: vi.fn(),
    resetCache: vi.fn(),
  }),
}));

import { getNextPOINumber, addMeasurement } from '../measurements';

describe('survey/measurements', () => {
  beforeEach(() => {
    localStorageMap.clear();
    mockMeasurements.length = 0;
    mockPut.mockClear();
  });

  // ── getNextPOINumber ───────────────────────────────────────────────
  describe('getNextPOINumber', () => {
    it('returns 1 when no measurements exist', async () => {
      const result = await getNextPOINumber('survey-1');
      expect(result).toBe(1);
    });

    it('returns max+1 based on cursor scan', async () => {
      // Cursor scans in reverse, finds first with poiNumber
      mockMeasurements.push(
        { id: 'm1', user_id: 'survey-1', poiNumber: null },
        { id: 'm2', user_id: 'survey-1', poiNumber: 5 },
        { id: 'm3', user_id: 'survey-1', poiNumber: 3 },
      );
      // Reversed: m3(3), m2(5), m1(null)
      // Cursor finds m3 first (poiNumber=3) -> returns 4
      const result = await getNextPOINumber('survey-1');
      expect(result).toBe(4);
    });

    it('skips measurements without poiNumber', async () => {
      mockMeasurements.push(
        { id: 'm1', user_id: 'survey-1', poiNumber: null },
        { id: 'm2', user_id: 'survey-1', poiNumber: undefined },
        { id: 'm3', user_id: 'survey-1', poiNumber: 7 },
      );
      // Reversed: m3(7), m2(undefined), m1(null)
      // First with poiNumber is m3(7)
      const result = await getNextPOINumber('survey-1');
      expect(result).toBe(8);
    });
  });

  // ── addMeasurement ─────────────────────────────────────────────────
  describe('addMeasurement', () => {
    it('saves measurement and returns it', async () => {
      const measurement = {
        id: 'new-m-1',
        user_id: 'survey-1',
        latitude: 45.0,
        longitude: -73.0,
        altGPS: 100,
        speed: 0,
        heading: 0,
        utcDate: '2025-01-01',
        utcTime: '12:00:00',
        poiNumber: 1,
        roadNumber: 1,
      } as any;

      const result = await addMeasurement(measurement);
      expect(result).toBeDefined();
      expect(result!.id).toBe('new-m-1');
      expect(mockPut).toHaveBeenCalled();
    });
  });
});
