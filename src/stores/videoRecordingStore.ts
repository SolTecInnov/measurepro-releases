import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface VideoRecordingState {
  isRecording: boolean;
  currentRecordingId: string | null;
  recordingStartTime: number | null;
  currentSurveyId: string | null;
}

interface VideoRecordingActions {
  startRecording: (recordingId: string, surveyId: string) => void;
  stopRecording: () => void;
  getCurrentTimestamp: () => number | null;
  reset: () => void;
}

export type VideoRecordingStore = VideoRecordingState & VideoRecordingActions;

const initialState: VideoRecordingState = {
  isRecording: false,
  currentRecordingId: null,
  recordingStartTime: null,
  currentSurveyId: null,
};

export const useVideoRecordingStore = create<VideoRecordingStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      startRecording: (recordingId: string, surveyId: string) => {
        const startTime = Date.now();
        set({
          isRecording: true,
          currentRecordingId: recordingId,
          recordingStartTime: startTime,
          currentSurveyId: surveyId,
        });
      },

      stopRecording: () => {
        set({
          isRecording: false,
          currentRecordingId: null,
          recordingStartTime: null,
          currentSurveyId: null,
        });
      },

      getCurrentTimestamp: () => {
        const state = get();
        if (!state.isRecording || !state.recordingStartTime) {
          return null;
        }
        return (Date.now() - state.recordingStartTime) / 1000;
      },

      reset: () => {
        set(initialState);
      },
    }),
    {
      name: 'video-recording-storage',
      partialize: (state) => ({
        // Only persist the state flags, not the blobs
        isRecording: state.isRecording,
        currentRecordingId: state.currentRecordingId,
        recordingStartTime: state.recordingStartTime,
        currentSurveyId: state.currentSurveyId,
      }),
    }
  )
);
