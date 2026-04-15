import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock idb before importing store
vi.mock('idb', () => ({
  openDB: vi.fn().mockResolvedValue({
    get: vi.fn().mockResolvedValue(null),
    getAll: vi.fn().mockResolvedValue([]),
    put: vi.fn().mockResolvedValue(undefined),
    transaction: vi.fn(() => ({
      store: {
        clear: vi.fn().mockResolvedValue(undefined),
        put: vi.fn().mockResolvedValue(undefined),
      },
      done: Promise.resolve(),
    })),
  }),
}));

import { useSweptPathStore } from '../sweptPathStore';

describe('useSweptPathStore', () => {
  beforeEach(() => {
    useSweptPathStore.setState({
      settings: {
        enabled: false,
        autoDetect: true,
        animationSpeed: 1.0,
        showRoadBoundaries: true,
        showVehicleEnvelope: true,
        showCollisionMarkers: true,
        showClearanceZones: true,
      },
      currentAnalysis: null,
      playback: {
        isPlaying: false,
        currentFrame: 0,
        totalFrames: 0,
        speed: 1.0,
      },
      debugState: {
        isAnalyzing: false,
        roadBoundaries: null,
        confidence: 0,
      },
      analysisHistory: [],
    });
  });

  it('has correct defaults', () => {
    const state = useSweptPathStore.getState();
    expect(state.settings.enabled).toBe(false);
    expect(state.settings.autoDetect).toBe(true);
    expect(state.settings.animationSpeed).toBe(1.0);
    expect(state.currentAnalysis).toBeNull();
    expect(state.playback.isPlaying).toBe(false);
    expect(state.debugState.isAnalyzing).toBe(false);
    expect(state.analysisHistory).toEqual([]);
  });

  describe('setSettings', () => {
    it('merges partial settings', () => {
      useSweptPathStore.getState().setSettings({ enabled: true });
      const settings = useSweptPathStore.getState().settings;
      expect(settings.enabled).toBe(true);
      expect(settings.autoDetect).toBe(true); // unchanged
    });

    it('updates animationSpeed', () => {
      useSweptPathStore.getState().setSettings({ animationSpeed: 2.0 });
      expect(useSweptPathStore.getState().settings.animationSpeed).toBe(2.0);
    });
  });

  describe('setCurrentAnalysis', () => {
    it('sets analysis', () => {
      const analysis = {
        id: 'a1',
        vehicleProfileId: 'v1',
        roadBoundaries: { left: [], right: [] },
        turnRadius: 5,
        snapshots: [],
        verdict: 'feasible' as const,
        maxOffTracking: 0.3,
        worstClearance: 1.2,
        timestamp: '2025-01-01',
      };
      useSweptPathStore.getState().setCurrentAnalysis(analysis);
      expect(useSweptPathStore.getState().currentAnalysis).toEqual(analysis);
    });

    it('clears analysis with null', () => {
      useSweptPathStore.getState().setCurrentAnalysis(null);
      expect(useSweptPathStore.getState().currentAnalysis).toBeNull();
    });
  });

  describe('setPlaybackState', () => {
    it('merges partial playback state', () => {
      useSweptPathStore.getState().setPlaybackState({ isPlaying: true, currentFrame: 5 });
      const playback = useSweptPathStore.getState().playback;
      expect(playback.isPlaying).toBe(true);
      expect(playback.currentFrame).toBe(5);
      expect(playback.speed).toBe(1.0); // unchanged
    });
  });

  describe('setDebugState', () => {
    it('merges partial debug state', () => {
      useSweptPathStore.getState().setDebugState({ isAnalyzing: true, confidence: 0.95 });
      const debug = useSweptPathStore.getState().debugState;
      expect(debug.isAnalyzing).toBe(true);
      expect(debug.confidence).toBe(0.95);
      expect(debug.roadBoundaries).toBeNull(); // unchanged
    });
  });

  describe('analysisHistory', () => {
    const mockAnalysis = {
      id: 'a1',
      surveyId: 's1',
      vehicleProfileId: 'v1',
      turnData: {},
      verdict: 'feasible',
      timestamp: '2025-01-01',
    } as any;

    it('addToHistory appends', () => {
      useSweptPathStore.getState().addToHistory(mockAnalysis);
      expect(useSweptPathStore.getState().analysisHistory).toHaveLength(1);
    });

    it('removeFromHistory removes by id', () => {
      useSweptPathStore.getState().addToHistory(mockAnalysis);
      useSweptPathStore.getState().addToHistory({ ...mockAnalysis, id: 'a2' });
      useSweptPathStore.getState().removeFromHistory('a1');
      const history = useSweptPathStore.getState().analysisHistory;
      expect(history).toHaveLength(1);
      expect(history[0].id).toBe('a2');
    });

    it('clearHistory empties array', () => {
      useSweptPathStore.getState().addToHistory(mockAnalysis);
      useSweptPathStore.getState().addToHistory({ ...mockAnalysis, id: 'a2' });
      useSweptPathStore.getState().clearHistory();
      expect(useSweptPathStore.getState().analysisHistory).toEqual([]);
    });
  });

  describe('loadFromIndexedDB', () => {
    it('does not throw on load', async () => {
      await expect(useSweptPathStore.getState().loadFromIndexedDB()).resolves.not.toThrow();
    });
  });

  describe('saveToIndexedDB', () => {
    it('does not throw on save', async () => {
      await expect(useSweptPathStore.getState().saveToIndexedDB()).resolves.not.toThrow();
    });
  });
});
