import { describe, it, expect, vi, beforeEach } from 'vitest';

// The SoundManager constructor accesses localStorage, document, and Audio at import time.
// We must stub ALL globals before any import.

// vi.hoisted runs before vi.mock hoisting — must define localStorageMap INSIDE hoisted
const { mockPlay, mockPause, mockRemove, mockAddEventListener, localStorageMap } = vi.hoisted(() => {
  const localStorageMap = new Map<string, string>();
  const mockPlay = vi.fn(() => Promise.resolve());
  const mockPause = vi.fn();
  const mockRemove = vi.fn();
  const mockAddEventListener = vi.fn();

  // Set up globals immediately (before any module import)
  (globalThis as any).localStorage = {
    getItem: (key: string) => localStorageMap.get(key) ?? null,
    setItem: (key: string, value: string) => localStorageMap.set(key, value),
    removeItem: (key: string) => localStorageMap.delete(key),
    clear: () => localStorageMap.clear(),
  };

  (globalThis as any).Audio = class MockAudio {
    src: string;
    preload = 'auto';
    volume = 1.0;
    loop = false;
    currentTime = 0;
    play = mockPlay;
    pause = mockPause;
    remove = mockRemove;
    addEventListener = mockAddEventListener;
    constructor(src?: string) { this.src = src || ''; }
  };

  const mockResume = vi.fn(() => Promise.resolve());
  const MockAudioContext = vi.fn(() => ({
    state: 'running',
    resume: mockResume,
    createBuffer: vi.fn(() => ({})),
    createBufferSource: vi.fn(() => ({
      buffer: null,
      connect: vi.fn(),
      start: vi.fn(),
    })),
    destination: {},
  }));

  (globalThis as any).AudioContext = MockAudioContext;
  (globalThis as any).document = {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };

  // Ensure window has location for soundPath
  if (typeof globalThis.window !== 'undefined') {
    Object.defineProperty(globalThis.window, 'AudioContext', { value: MockAudioContext, writable: true });
  }

  return { mockPlay, mockPause, mockRemove, mockAddEventListener, localStorageMap };
});

// Ensure navigator and window.location are set
vi.stubGlobal('navigator', { onLine: true, userAgent: 'test' });

import { soundPath, AVAILABLE_SOUNDS, soundManager } from '../sounds';

describe('sounds', () => {
  beforeEach(() => {
    localStorageMap.clear();
    mockPlay.mockClear();
  });

  // ── soundPath ──────────────────────────────────────────────────────
  describe('soundPath', () => {
    it('returns /sounds/ prefixed path for browser', () => {
      const result = soundPath('test.wav');
      expect(result).toBe('/sounds/test.wav');
    });
  });

  // ── AVAILABLE_SOUNDS ───────────────────────────────────────────────
  describe('AVAILABLE_SOUNDS', () => {
    it('has at least 10 sound options', () => {
      expect(AVAILABLE_SOUNDS.length).toBeGreaterThanOrEqual(10);
    });

    it('all entries have label, file, path, and category', () => {
      for (const sound of AVAILABLE_SOUNDS) {
        expect(sound.label).toBeTruthy();
        expect(sound.file).toBeTruthy();
        expect(sound.path).toBeTruthy();
        expect(['new', 'legacy', 'custom']).toContain(sound.category);
      }
    });

    it('has both new and legacy categories', () => {
      const categories = new Set(AVAILABLE_SOUNDS.map(s => s.category));
      expect(categories.has('new')).toBe(true);
      expect(categories.has('legacy')).toBe(true);
    });
  });

  // ── SoundManager ───────────────────────────────────────────────────
  describe('SoundManager', () => {
    it('soundManager is defined', () => {
      expect(soundManager).toBeDefined();
    });

    it('getConfig returns config with expected keys', () => {
      const config = soundManager.getConfig();
      expect(config).toHaveProperty('logEntry');
      expect(config).toHaveProperty('warning');
      expect(config).toHaveProperty('critical');
      expect(config).toHaveProperty('volume');
    });

    it('setVolume clamps to 0-1 range', () => {
      soundManager.setVolume(1.5);
      expect(soundManager.getConfig().volume).toBeLessThanOrEqual(1);
      soundManager.setVolume(-0.5);
      expect(soundManager.getConfig().volume).toBeGreaterThanOrEqual(0);
    });

    it('setVolume saves to localStorage', () => {
      soundManager.setVolume(0.7);
      const saved = localStorageMap.get('soundConfig');
      expect(saved).toBeDefined();
      const parsed = JSON.parse(saved!);
      expect(parsed.volume).toBeCloseTo(0.7);
    });

    it('setLooping updates config', () => {
      soundManager.setLooping('warning', true);
      expect(soundManager.getConfig().warningLoop).toBe(true);
      soundManager.setLooping('warning', false);
      expect(soundManager.getConfig().warningLoop).toBe(false);
    });

    it('setAlertSoundsEnabled persists setting', () => {
      soundManager.setAlertSoundsEnabled(false);
      expect(soundManager.getConfig().alertSoundsEnabled).toBe(false);
      soundManager.setAlertSoundsEnabled(true);
      expect(soundManager.getConfig().alertSoundsEnabled).toBe(true);
    });

    it('setNotificationEnabled updates individual toggles', () => {
      soundManager.setNotificationEnabled('poiTypeChange', false);
      expect(soundManager.getConfig().poiTypeChangeEnabled).toBe(false);
      soundManager.setNotificationEnabled('poiTypeChange', true);
      expect(soundManager.getConfig().poiTypeChangeEnabled).toBe(true);
    });

    it('subscribe returns an unsubscribe function', () => {
      const listener = vi.fn();
      const unsub = soundManager.subscribe(listener);
      expect(typeof unsub).toBe('function');
      soundManager.setVolume(0.5);
      expect(listener).toHaveBeenCalled();
      unsub();
    });

    it('stopSound does not throw for non-looping types', () => {
      expect(() => soundManager.stopSound('warning')).not.toThrow();
      expect(() => soundManager.stopSound('critical')).not.toThrow();
      expect(() => soundManager.stopSound('emergency')).not.toThrow();
    });
  });
});
