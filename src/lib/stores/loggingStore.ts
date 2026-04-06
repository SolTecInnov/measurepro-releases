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
    toast.success(`Logging mode: ${modeNames[mode]}`);
  },
  startLogging: () => {
    set({ isLogging: true, isPaused: false });
    toast.success('Logging started');
  },
  stopLogging: () => {
    set({ isLogging: false, isPaused: false });
    toast.info('Logging stopped');
  },
  pauseLogging: () => {
    const { isLogging, isPaused } = get();
    if (isLogging && !isPaused) {
      set({ isPaused: true });
      toast.warning('Logging paused - POI recording suspended');
    }
  },
  resumeLogging: () => {
    const { isLogging, isPaused } = get();
    if (isLogging && isPaused) {
      set({ isPaused: false });
      toast.success('Logging resumed');
    } else if (!isLogging) {
      set({ isLogging: true, isPaused: false });
      toast.success('Logging started');
    }
  }
}));