import { describe, it, expect, beforeEach, vi } from 'vitest';

// Stub browser globals before any imports
const localStorageMap = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (key: string) => localStorageMap.get(key) ?? null,
  setItem: (key: string, value: string) => localStorageMap.set(key, value),
  removeItem: (key: string) => localStorageMap.delete(key),
  clear: () => localStorageMap.clear(),
});

vi.stubGlobal('navigator', { onLine: true, userAgent: 'test' });
vi.stubGlobal('crypto', { randomUUID: () => 'test-uuid-1234' });

// Mock all heavy dependencies
vi.mock('@/lib/stores/gpsStore', () => ({
  useGPSStore: {
    getState: () => ({
      data: { latitude: 45.0, longitude: -73.0, altitude: 100, speed: 0, course: 0 },
    }),
  },
}));
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
  },
}));
vi.mock('@/lib/sounds', () => ({
  soundManager: { playLogEntry: vi.fn(), playWarning: vi.fn(), subscribe: vi.fn(() => vi.fn()) },
  soundPath: (f: string) => `/sounds/${f}`,
}));
vi.mock('@/lib/firebase', () => ({
  getCurrentUser: () => null,
  importSurveysFromFirebase: vi.fn(() => Promise.resolve([])),
}));
vi.mock('@/lib/firebase/autoSync', () => ({
  onSurveyClose: vi.fn(() => Promise.resolve()),
}));
vi.mock('../db', () => ({
  openSurveyDB: vi.fn(),
  initCSVBackupDB: vi.fn(() => Promise.resolve(null)),
  getSurveysPaginated: vi.fn(() => Promise.resolve({ surveys: [], total: 0, hasMore: false })),
  perfLog: vi.fn(),
  incrementMutationCounter: vi.fn(),
}));
vi.mock('../measurements', () => ({
  deleteAllMeasurements: vi.fn(() => Promise.resolve()),
}));
vi.mock('../../workers/MeasurementLoggerClient', () => ({
  getMeasurementLogger: () => ({ logMeasurement: vi.fn(() => Promise.resolve()) }),
}));
vi.mock('../MeasurementFeed', () => ({
  getMeasurementFeed: () => ({
    resetCache: vi.fn(),
    clear: vi.fn(),
    removeMeasurement: vi.fn(),
  }),
}));
vi.mock('../export', () => ({
  exportSurveyFunction: vi.fn(() => Promise.resolve()),
}));
vi.mock('../../utils/autoSaveUtils', () => ({
  autoSaveSurvey: vi.fn(),
}));
vi.mock('../../utils/storageManager', () => ({
  getStorageQuota: vi.fn(() => Promise.resolve({ quota: 1e9, usage: 0, available: 1e9 })),
}));
vi.mock('../../utils/storageCleanup', () => ({
  cleanupEmergencyData: vi.fn(() => Promise.resolve()),
}));
vi.mock('../checkpoints', () => ({
  startCheckpointTimer: vi.fn(),
  stopCheckpointTimer: vi.fn(),
}));

import {
  getLegacyPoiCountCache,
  setLegacyPoiCount,
  clearLegacyPoiCountCache,
  useSurveyStore,
} from '../store';

describe('survey/store', () => {
  beforeEach(() => {
    localStorageMap.clear();
    clearLegacyPoiCountCache();
    useSurveyStore.setState({
      activeSurvey: null,
      currentRoute: null,
      surveys: [],
      routes: [],
      alerts: [],
      vehicleTraces: [],
    });
  });

  // ── Legacy POI count cache ─────────────────────────────────────────
  describe('legacyPoiCountCache', () => {
    it('starts empty', () => {
      expect(getLegacyPoiCountCache().size).toBe(0);
    });

    it('setLegacyPoiCount stores values', () => {
      setLegacyPoiCount('survey-1', 42);
      expect(getLegacyPoiCountCache().get('survey-1')).toBe(42);
    });

    it('clearLegacyPoiCountCache clears all entries', () => {
      setLegacyPoiCount('survey-1', 10);
      setLegacyPoiCount('survey-2', 20);
      clearLegacyPoiCountCache();
      expect(getLegacyPoiCountCache().size).toBe(0);
    });
  });

  // ── Zustand store basic state ──────────────────────────────────────
  describe('store state', () => {
    it('starts with null activeSurvey', () => {
      expect(useSurveyStore.getState().activeSurvey).toBeNull();
    });

    it('starts with empty surveys array', () => {
      expect(useSurveyStore.getState().surveys).toEqual([]);
    });

    it('setActiveSurvey updates state', () => {
      const survey = { id: 'test', surveyTitle: 'Test' } as any;
      useSurveyStore.getState().setActiveSurvey(survey);
      expect(useSurveyStore.getState().activeSurvey).toEqual(survey);
    });

    it('setSurveys updates surveys array', () => {
      const surveys = [{ id: '1' }, { id: '2' }] as any[];
      useSurveyStore.getState().setSurveys(surveys);
      expect(useSurveyStore.getState().surveys).toHaveLength(2);
    });

    it('setCurrentRoute updates route', () => {
      const route = { id: 'r1', name: 'Route 1' } as any;
      useSurveyStore.getState().setCurrentRoute(route);
      expect(useSurveyStore.getState().currentRoute).toEqual(route);
    });

    it('setAlerts updates alerts', () => {
      const alerts = [{ id: 'a1', type: 'WARNING' }] as any[];
      useSurveyStore.getState().setAlerts(alerts);
      expect(useSurveyStore.getState().alerts).toHaveLength(1);
    });

    it('setVehicleTraces updates traces', () => {
      const traces = [{ id: 't1', latitude: 45 }] as any[];
      useSurveyStore.getState().setVehicleTraces(traces);
      expect(useSurveyStore.getState().vehicleTraces).toHaveLength(1);
    });
  });
});
