import { create } from 'zustand';
import { toast } from 'sonner';

export type LoggingMode = 'manual' | 'all' | 'detection' | 'manualDetection' | 'counterDetection';

interface LoggingState {
  mode: LoggingMode;
  isLogging: boolean;
  isPaused: boolean;
  setLoggingMode: (mode: LoggingMode) => void;
  startLogging: () => void;
  stopLogging: () => void;
  pauseLogging: () => void;
  resumeLogging: () => void;
}

export const useLoggingStore = create<LoggingState>((set, get) => ({
  mode: 'manual',
  isLogging: false,
  isPaused: false,
  setLoggingMode: (mode) => {
    set({ mode });
    const modeNames: Record<LoggingMode, string> = {
      manual: 'Manual',
      all: 'All Data',
      detection: 'Detection (AI)',
      manualDetection: 'Manual Detection',
      counterDetection: 'Counter Detection'
    };
    /* toast removed */
  },
  startLogging: () => {
    set({ isLogging: true, isPaused: false });
    /* toast removed */
  },
  stopLogging: () => {
    set({ isLogging: false, isPaused: false });
    /* toast removed */
  },
  pauseLogging: () => {
    const { isLogging, isPaused } = get();
    if (isLogging && !isPaused) {
      set({ isPaused: true });
      /* toast removed */
    }
  },
  resumeLogging: () => {
    const { isLogging, isPaused } = get();
    if (isLogging && isPaused) {
      set({ isPaused: false });
      /* toast removed */
    } else if (!isLogging) {
      set({ isLogging: true, isPaused: false });
      /* toast removed */
    }
  }
}));