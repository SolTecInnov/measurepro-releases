import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useVideoRecordingStore } from '../videoRecordingStore';

describe('useVideoRecordingStore', () => {
  beforeEach(() => {
    useVideoRecordingStore.getState().reset();
  });

  it('has correct defaults', () => {
    const state = useVideoRecordingStore.getState();
    expect(state.isRecording).toBe(false);
    expect(state.currentRecordingId).toBeNull();
    expect(state.recordingStartTime).toBeNull();
    expect(state.currentSurveyId).toBeNull();
  });

  describe('startRecording', () => {
    it('sets recording state with id and surveyId', () => {
      useVideoRecordingStore.getState().startRecording('rec-1', 'survey-1');
      const state = useVideoRecordingStore.getState();
      expect(state.isRecording).toBe(true);
      expect(state.currentRecordingId).toBe('rec-1');
      expect(state.currentSurveyId).toBe('survey-1');
      expect(state.recordingStartTime).toBeGreaterThan(0);
    });
  });

  describe('stopRecording', () => {
    it('clears all recording state', () => {
      useVideoRecordingStore.getState().startRecording('rec-1', 'survey-1');
      useVideoRecordingStore.getState().stopRecording();
      const state = useVideoRecordingStore.getState();
      expect(state.isRecording).toBe(false);
      expect(state.currentRecordingId).toBeNull();
      expect(state.recordingStartTime).toBeNull();
      expect(state.currentSurveyId).toBeNull();
    });
  });

  describe('getCurrentTimestamp', () => {
    it('returns null when not recording', () => {
      expect(useVideoRecordingStore.getState().getCurrentTimestamp()).toBeNull();
    });

    it('returns elapsed time in seconds when recording', () => {
      vi.useFakeTimers();
      const now = Date.now();
      vi.setSystemTime(now);
      useVideoRecordingStore.getState().startRecording('rec-1', 'survey-1');

      vi.setSystemTime(now + 5000);
      const ts = useVideoRecordingStore.getState().getCurrentTimestamp();
      expect(ts).toBeCloseTo(5, 0);
      vi.useRealTimers();
    });
  });

  describe('reset', () => {
    it('resets to initial state', () => {
      useVideoRecordingStore.getState().startRecording('rec-1', 'survey-1');
      useVideoRecordingStore.getState().reset();
      const state = useVideoRecordingStore.getState();
      expect(state.isRecording).toBe(false);
      expect(state.currentRecordingId).toBeNull();
      expect(state.recordingStartTime).toBeNull();
      expect(state.currentSurveyId).toBeNull();
    });
  });

  describe('state transitions', () => {
    it('start -> stop -> start works correctly', () => {
      useVideoRecordingStore.getState().startRecording('rec-1', 'survey-1');
      useVideoRecordingStore.getState().stopRecording();
      useVideoRecordingStore.getState().startRecording('rec-2', 'survey-2');
      const state = useVideoRecordingStore.getState();
      expect(state.isRecording).toBe(true);
      expect(state.currentRecordingId).toBe('rec-2');
      expect(state.currentSurveyId).toBe('survey-2');
    });
  });
});
