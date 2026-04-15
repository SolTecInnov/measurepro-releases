import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Stub globals before any vi.mock
const { localStorageMap } = vi.hoisted(() => {
  const localStorageMap = new Map<string, string>();

  (globalThis as any).localStorage = {
    getItem: (key: string) => localStorageMap.get(key) ?? null,
    setItem: (key: string, value: string) => localStorageMap.set(key, value),
    removeItem: (key: string) => localStorageMap.delete(key),
    clear: () => localStorageMap.clear(),
  };

  (globalThis as any).Audio = class MockAudio {
    src = '';
    preload = 'auto';
    volume = 1;
    play = vi.fn(() => Promise.resolve());
    pause = vi.fn();
    remove = vi.fn();
    addEventListener = vi.fn();
  };
  (globalThis as any).AudioContext = vi.fn(() => ({
    state: 'running',
    resume: vi.fn(() => Promise.resolve()),
    createBuffer: vi.fn(() => ({})),
    createBufferSource: vi.fn(() => ({ buffer: null, connect: vi.fn(), start: vi.fn() })),
    destination: {},
  }));
  if (typeof globalThis.document === 'undefined') {
    (globalThis as any).document = { addEventListener: vi.fn(), createElement: vi.fn(() => ({})), body: { appendChild: vi.fn() } };
  }

  return { localStorageMap };
});

vi.mock('@/lib/sounds', () => ({
  soundManager: {
    playBufferStart: vi.fn(),
    playBufferComplete: vi.fn(),
  },
}));

import {
  useBufferConfigStore,
  useBufferDetectionStore,
  BufferDetectionService,
  DEFAULT_BUFFER_CONFIGS,
  BUFFER_ENABLED_POI_TYPES,
  type BufferedMeasurement,
  type BufferSession,
} from '../BufferDetectionService';

describe('BufferDetectionService', () => {
  beforeEach(() => {
    localStorageMap.clear();
    useBufferConfigStore.setState({ configs: {} as any });
    useBufferConfigStore.getState().resetToDefaults();
    useBufferDetectionStore.getState().reset();
  });

  describe('DEFAULT_BUFFER_CONFIGS', () => {
    it('provides configs for all buffer-enabled POI types', () => {
      for (const poiType of BUFFER_ENABLED_POI_TYPES) {
        expect(DEFAULT_BUFFER_CONFIGS[poiType]).toBeDefined();
        expect(DEFAULT_BUFFER_CONFIGS[poiType]!.enabled).toBe(true);
      }
    });

    it('has valid distance and time values', () => {
      for (const poiType of BUFFER_ENABLED_POI_TYPES) {
        const cfg = DEFAULT_BUFFER_CONFIGS[poiType]!;
        expect(cfg.distanceMeters).toBeGreaterThan(0);
        expect(cfg.timeSeconds).toBeGreaterThan(0);
        expect(['distance', 'time']).toContain(cfg.mode);
      }
    });
  });

  describe('useBufferConfigStore', () => {
    it('loads default configs on creation', () => {
      const store = useBufferConfigStore.getState();
      const cfg = store.getConfig('wire');
      expect(cfg).toBeDefined();
      expect(cfg!.enabled).toBe(true);
      expect(cfg!.distanceMeters).toBe(100);
    });

    it('returns null for unknown POI types', () => {
      const store = useBufferConfigStore.getState();
      expect(store.getConfig('unknownType' as any)).toBeNull();
    });

    it('setConfig persists to localStorage', () => {
      const store = useBufferConfigStore.getState();
      store.setConfig('wire', { enabled: false, distanceMeters: 200, timeSeconds: 30, mode: 'time' });
      const cfg = useBufferConfigStore.getState().getConfig('wire');
      expect(cfg!.enabled).toBe(false);
      expect(cfg!.distanceMeters).toBe(200);
      expect(localStorageMap.has('buffer_detection_configs')).toBe(true);
    });

    it('isBufferEnabled returns correct value', () => {
      const store = useBufferConfigStore.getState();
      expect(store.isBufferEnabled('wire')).toBe(true);
      store.setConfig('wire', { enabled: false, distanceMeters: 100, timeSeconds: 15, mode: 'distance' });
      expect(useBufferConfigStore.getState().isBufferEnabled('wire')).toBe(false);
    });

    it('resetToDefaults clears localStorage', () => {
      const store = useBufferConfigStore.getState();
      store.setConfig('wire', { enabled: false, distanceMeters: 200, timeSeconds: 30, mode: 'time' });
      useBufferConfigStore.getState().resetToDefaults();
      expect(localStorageMap.has('buffer_detection_configs')).toBe(false);
    });
  });

  describe('useBufferDetectionStore', () => {
    it('starts in idle state', () => {
      const store = useBufferDetectionStore.getState();
      expect(store.state).toBe('idle');
      expect(store.session).toBeNull();
    });

    it('start creates a session for enabled POI types', () => {
      const store = useBufferDetectionStore.getState();
      const result = store.start('wire', { latitude: 45.5, longitude: -73.5 }, 1.0);
      expect(result).toBe(true);

      const state = useBufferDetectionStore.getState();
      expect(state.state).toBe('buffering');
      expect(state.session).toBeDefined();
      expect(state.session!.poiType).toBe('wire');
      expect(state.session!.groundReference).toBe(1.0);
    });

    it('start returns false for disabled POI types', () => {
      useBufferConfigStore.getState().setConfig('wire', { enabled: false, distanceMeters: 100, timeSeconds: 15, mode: 'distance' });
      const result = useBufferDetectionStore.getState().start('wire', { latitude: 45.5, longitude: -73.5 }, 1.0);
      expect(result).toBe(false);
    });

    it('start returns false when session already active', () => {
      const store = useBufferDetectionStore.getState();
      store.start('wire', { latitude: 45.5, longitude: -73.5 }, 1.0);
      const result = useBufferDetectionStore.getState().start('tree', { latitude: 45.5, longitude: -73.5 }, 1.0);
      expect(result).toBe(false);
    });

    it('addMeasurement tracks min and max', () => {
      const store = useBufferDetectionStore.getState();
      store.start('wire', { latitude: 45.5, longitude: -73.5 }, 1.0);

      const m1: BufferedMeasurement = { value: 5.5, rawValue: '5.50', timestamp: Date.now(), latitude: 45.5, longitude: -73.5, groundReference: 1.0 };
      const m2: BufferedMeasurement = { value: 3.2, rawValue: '3.20', timestamp: Date.now(), latitude: 45.5, longitude: -73.5, groundReference: 1.0 };
      const m3: BufferedMeasurement = { value: 7.1, rawValue: '7.10', timestamp: Date.now(), latitude: 45.5, longitude: -73.5, groundReference: 1.0 };

      useBufferDetectionStore.getState().addMeasurement(m1);
      useBufferDetectionStore.getState().addMeasurement(m2);
      useBufferDetectionStore.getState().addMeasurement(m3);

      const session = useBufferDetectionStore.getState().session!;
      expect(session.measurements).toHaveLength(3);
      expect(session.minMeasurement!.value).toBe(3.2);
      expect(session.maxMeasurement!.value).toBe(7.1);
    });

    it('addMeasurement does nothing when not buffering', () => {
      const m: BufferedMeasurement = { value: 5.5, rawValue: '5.50', timestamp: Date.now(), latitude: 45.5, longitude: -73.5, groundReference: 1.0 };
      useBufferDetectionStore.getState().addMeasurement(m);
      expect(useBufferDetectionStore.getState().progress.measurementCount).toBe(0);
    });

    it('finalize returns session and resets', () => {
      const store = useBufferDetectionStore.getState();
      store.start('wire', { latitude: 45.5, longitude: -73.5 }, 1.0);
      const m: BufferedMeasurement = { value: 5.0, rawValue: '5.00', timestamp: Date.now(), latitude: 45.5, longitude: -73.5, groundReference: 1.0 };
      useBufferDetectionStore.getState().addMeasurement(m);

      const session = useBufferDetectionStore.getState().finalize();
      expect(session).toBeDefined();
      expect(session!.measurements).toHaveLength(1);
      expect(useBufferDetectionStore.getState().state).toBe('idle');
      expect(useBufferDetectionStore.getState().session).toBeNull();
    });

    it('finalize returns null when no session', () => {
      expect(useBufferDetectionStore.getState().finalize()).toBeNull();
    });

    it('abort returns session and resets', () => {
      useBufferDetectionStore.getState().start('wire', { latitude: 45.5, longitude: -73.5 }, 1.0);
      const session = useBufferDetectionStore.getState().abort();
      expect(session).toBeDefined();
      expect(useBufferDetectionStore.getState().state).toBe('idle');
    });

    it('abort returns null when no session', () => {
      expect(useBufferDetectionStore.getState().abort()).toBeNull();
    });

    it('getFormattedNotes returns empty string when no session', () => {
      expect(useBufferDetectionStore.getState().getFormattedNotes()).toBe('');
    });

    it('getFormattedNotes formats notes with measurements', () => {
      useBufferDetectionStore.getState().start('wire', { latitude: 45.5, longitude: -73.5 }, 1.5);
      const m: BufferedMeasurement = { value: 4.25, rawValue: '4.25', timestamp: 1700000000000, latitude: 45.5, longitude: -73.5, groundReference: 1.5 };
      useBufferDetectionStore.getState().addMeasurement(m);

      const notes = useBufferDetectionStore.getState().getFormattedNotes();
      expect(notes).toContain('Lowest: 4.25m');
      expect(notes).toContain('Ground ref: 1.50m');
      expect(notes).toContain('Measurements (1):');
    });
  });

  describe('BufferDetectionService.formatSessionNotes', () => {
    it('formats a session with measurements', () => {
      const now = Date.now();
      const session: BufferSession = {
        poiType: 'wire',
        startTime: now - 5000,
        startPosition: { latitude: 45.5, longitude: -73.5 },
        measurements: [
          { value: 5.0, rawValue: '5.00', timestamp: now - 4000, latitude: 45.5, longitude: -73.5, groundReference: 1.0 },
          { value: 3.5, rawValue: '3.50', timestamp: now - 2000, latitude: 45.5, longitude: -73.5, groundReference: 1.0 },
        ],
        minMeasurement: { value: 3.5, rawValue: '3.50', timestamp: now - 2000, latitude: 45.5, longitude: -73.5, groundReference: 1.0 },
        maxMeasurement: { value: 5.0, rawValue: '5.00', timestamp: now - 4000, latitude: 45.5, longitude: -73.5, groundReference: 1.0 },
        targetDistanceMeters: 100,
        targetTimeSeconds: null,
        mode: 'distance',
        groundReference: 1.0,
      };

      // Set minMeasurement to be same object reference as measurements[1]
      session.minMeasurement = session.measurements[1];

      const notes = BufferDetectionService.formatSessionNotes(session);
      expect(notes).toContain('Lowest: 3.50m');
      expect(notes).toContain('Ground ref: 1.00m');
      expect(notes).toContain('Readings: 2');
      expect(notes).toContain('LOWEST');
      expect(notes).toContain('All measurements:');
    });

    it('formats session with zero ground reference', () => {
      const now = Date.now();
      const session: BufferSession = {
        poiType: 'wire',
        startTime: now,
        startPosition: { latitude: 45.5, longitude: -73.5 },
        measurements: [],
        minMeasurement: null,
        maxMeasurement: null,
        targetDistanceMeters: 100,
        targetTimeSeconds: null,
        mode: 'distance',
        groundReference: 0,
      };

      const notes = BufferDetectionService.formatSessionNotes(session);
      expect(notes).not.toContain('Ground ref');
      expect(notes).toContain('Readings: 0');
    });
  });
});
