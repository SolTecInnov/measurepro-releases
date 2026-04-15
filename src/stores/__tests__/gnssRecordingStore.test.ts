import { describe, it, expect, beforeEach, vi } from 'vitest';

// Ensure window is defined for module-level code
vi.stubGlobal('window', {
  ...globalThis,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
});

// Mock must use inline factory (hoisted above variable declarations)
vi.mock('@/lib/roadProfile', () => ({
  getProfileRecordingBuffer: vi.fn(() => ({
    subscribe: vi.fn(),
  })),
}));

import { useGnssRecordingStore } from '../gnssRecordingStore';

describe('useGnssRecordingStore', () => {
  beforeEach(() => {
    useGnssRecordingStore.setState({
      isRecording: false,
      isPaused: false,
      pointCount: 0,
      totalDistance_m: 0,
      sessionId: null,
      startTime: null,
      isSubscribed: false,
    });
  });

  it('has correct defaults', () => {
    const state = useGnssRecordingStore.getState();
    expect(state.isRecording).toBe(false);
    expect(state.isPaused).toBe(false);
    expect(state.pointCount).toBe(0);
    expect(state.totalDistance_m).toBe(0);
    expect(state.sessionId).toBeNull();
    expect(state.startTime).toBeNull();
  });

  describe('setRecording', () => {
    it('sets isRecording to true', () => {
      useGnssRecordingStore.getState().setRecording(true);
      expect(useGnssRecordingStore.getState().isRecording).toBe(true);
    });

    it('sets isRecording to false', () => {
      useGnssRecordingStore.setState({ isRecording: true });
      useGnssRecordingStore.getState().setRecording(false);
      expect(useGnssRecordingStore.getState().isRecording).toBe(false);
    });
  });

  describe('setPaused', () => {
    it('sets isPaused', () => {
      useGnssRecordingStore.getState().setPaused(true);
      expect(useGnssRecordingStore.getState().isPaused).toBe(true);
    });
  });

  describe('updateStats', () => {
    it('updates pointCount and totalDistance_m', () => {
      useGnssRecordingStore.getState().updateStats(42, 123.5);
      const state = useGnssRecordingStore.getState();
      expect(state.pointCount).toBe(42);
      expect(state.totalDistance_m).toBe(123.5);
    });
  });

  describe('startSession', () => {
    it('sets sessionId, isRecording, isPaused, startTime and resets stats', () => {
      useGnssRecordingStore.getState().updateStats(10, 50);
      useGnssRecordingStore.getState().startSession('session-abc');
      const state = useGnssRecordingStore.getState();
      expect(state.sessionId).toBe('session-abc');
      expect(state.isRecording).toBe(true);
      expect(state.isPaused).toBe(false);
      expect(state.startTime).toBeInstanceOf(Date);
      expect(state.pointCount).toBe(0);
      expect(state.totalDistance_m).toBe(0);
    });
  });

  describe('endSession', () => {
    it('resets all session state', () => {
      useGnssRecordingStore.getState().startSession('session-abc');
      useGnssRecordingStore.getState().updateStats(100, 500);
      useGnssRecordingStore.getState().endSession();
      const state = useGnssRecordingStore.getState();
      expect(state.sessionId).toBeNull();
      expect(state.isRecording).toBe(false);
      expect(state.isPaused).toBe(false);
      expect(state.startTime).toBeNull();
      expect(state.pointCount).toBe(0);
      expect(state.totalDistance_m).toBe(0);
    });
  });

  describe('initSubscription', () => {
    it('sets isSubscribed to true', () => {
      useGnssRecordingStore.getState().initSubscription();
      expect(useGnssRecordingStore.getState().isSubscribed).toBe(true);
    });

    it('is idempotent (second call is a no-op)', () => {
      useGnssRecordingStore.setState({ isSubscribed: false });
      useGnssRecordingStore.getState().initSubscription();
      const first = useGnssRecordingStore.getState().isSubscribed;
      useGnssRecordingStore.getState().initSubscription();
      const second = useGnssRecordingStore.getState().isSubscribed;
      expect(first).toBe(true);
      expect(second).toBe(true);
    });
  });
});
