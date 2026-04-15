import { describe, it, expect, beforeEach } from 'vitest';
import { useLoggingStore, type LoggingMode } from '../loggingStore';

describe('useLoggingStore', () => {
  beforeEach(() => {
    useLoggingStore.setState({
      mode: 'manual',
      isLogging: false,
      isPaused: false,
    });
  });

  it('has correct defaults', () => {
    const state = useLoggingStore.getState();
    expect(state.mode).toBe('manual');
    expect(state.isLogging).toBe(false);
    expect(state.isPaused).toBe(false);
  });

  describe('setLoggingMode', () => {
    const modes: LoggingMode[] = ['manual', 'all', 'detection', 'manualDetection', 'counterDetection'];

    modes.forEach((mode) => {
      it(`sets mode to "${mode}"`, () => {
        useLoggingStore.getState().setLoggingMode(mode);
        expect(useLoggingStore.getState().mode).toBe(mode);
      });
    });
  });

  describe('startLogging', () => {
    it('sets isLogging to true and isPaused to false', () => {
      useLoggingStore.getState().startLogging();
      const state = useLoggingStore.getState();
      expect(state.isLogging).toBe(true);
      expect(state.isPaused).toBe(false);
    });

    it('clears paused state when starting', () => {
      useLoggingStore.setState({ isPaused: true });
      useLoggingStore.getState().startLogging();
      expect(useLoggingStore.getState().isPaused).toBe(false);
    });
  });

  describe('stopLogging', () => {
    it('sets isLogging to false and isPaused to false', () => {
      useLoggingStore.setState({ isLogging: true, isPaused: true });
      useLoggingStore.getState().stopLogging();
      const state = useLoggingStore.getState();
      expect(state.isLogging).toBe(false);
      expect(state.isPaused).toBe(false);
    });
  });

  describe('pauseLogging', () => {
    it('pauses when logging is active and not paused', () => {
      useLoggingStore.setState({ isLogging: true, isPaused: false });
      useLoggingStore.getState().pauseLogging();
      expect(useLoggingStore.getState().isPaused).toBe(true);
    });

    it('does not pause when not logging', () => {
      useLoggingStore.setState({ isLogging: false, isPaused: false });
      useLoggingStore.getState().pauseLogging();
      expect(useLoggingStore.getState().isPaused).toBe(false);
    });

    it('does not change state when already paused', () => {
      useLoggingStore.setState({ isLogging: true, isPaused: true });
      useLoggingStore.getState().pauseLogging();
      expect(useLoggingStore.getState().isPaused).toBe(true);
    });
  });

  describe('resumeLogging', () => {
    it('resumes when logging is active and paused', () => {
      useLoggingStore.setState({ isLogging: true, isPaused: true });
      useLoggingStore.getState().resumeLogging();
      const state = useLoggingStore.getState();
      expect(state.isLogging).toBe(true);
      expect(state.isPaused).toBe(false);
    });

    it('starts logging when not currently logging', () => {
      useLoggingStore.setState({ isLogging: false, isPaused: false });
      useLoggingStore.getState().resumeLogging();
      const state = useLoggingStore.getState();
      expect(state.isLogging).toBe(true);
      expect(state.isPaused).toBe(false);
    });

    it('does nothing when logging and not paused', () => {
      useLoggingStore.setState({ isLogging: true, isPaused: false });
      useLoggingStore.getState().resumeLogging();
      const state = useLoggingStore.getState();
      expect(state.isLogging).toBe(true);
      expect(state.isPaused).toBe(false);
    });
  });

  describe('state transitions', () => {
    it('start -> pause -> resume cycle', () => {
      useLoggingStore.getState().startLogging();
      expect(useLoggingStore.getState().isLogging).toBe(true);

      useLoggingStore.getState().pauseLogging();
      expect(useLoggingStore.getState().isPaused).toBe(true);

      useLoggingStore.getState().resumeLogging();
      expect(useLoggingStore.getState().isPaused).toBe(false);
      expect(useLoggingStore.getState().isLogging).toBe(true);
    });

    it('start -> stop -> resume starts fresh', () => {
      useLoggingStore.getState().startLogging();
      useLoggingStore.getState().stopLogging();
      useLoggingStore.getState().resumeLogging();
      const state = useLoggingStore.getState();
      expect(state.isLogging).toBe(true);
      expect(state.isPaused).toBe(false);
    });

    it('mode persists through start/stop', () => {
      useLoggingStore.getState().setLoggingMode('detection');
      useLoggingStore.getState().startLogging();
      useLoggingStore.getState().stopLogging();
      expect(useLoggingStore.getState().mode).toBe('detection');
    });
  });
});
