import { create } from 'zustand';

export interface DemoStep {
  id: string;
  title: string;
  description: string;
  targetSelector?: string;
  tabId?: string;
  action?: () => void | Promise<void>;
  duration: number;
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
}

export interface DemoChapter {
  id: string;
  title: string;
  icon: string;
  steps: DemoStep[];
}

interface DemoState {
  isActive: boolean;
  isPlaying: boolean;
  currentChapterIndex: number;
  currentStepIndex: number;
  chapters: DemoChapter[];
  previewSnapshot: Record<string, unknown> | null;
  
  startDemo: () => void;
  stopDemo: () => void;
  pauseDemo: () => void;
  resumeDemo: () => void;
  nextStep: () => void;
  prevStep: () => void;
  goToChapter: (index: number) => void;
  setChapters: (chapters: DemoChapter[]) => void;
  getCurrentStep: () => DemoStep | null;
  getCurrentChapter: () => DemoChapter | null;
  getProgress: () => { chapter: number; step: number; total: number; percent: number };
}

export const useDemoStore = create<DemoState>((set, get) => ({
  isActive: false,
  isPlaying: false,
  currentChapterIndex: 0,
  currentStepIndex: 0,
  chapters: [],
  previewSnapshot: null,

  startDemo: () => {
    set({
      isActive: true,
      isPlaying: true,
      currentChapterIndex: 0,
      currentStepIndex: 0,
    });
  },

  stopDemo: () => {
    set({
      isActive: false,
      isPlaying: false,
      currentChapterIndex: 0,
      currentStepIndex: 0,
    });
  },

  pauseDemo: () => {
    set({ isPlaying: false });
  },

  resumeDemo: () => {
    set({ isPlaying: true });
  },

  nextStep: () => {
    const { chapters, currentChapterIndex, currentStepIndex } = get();
    const currentChapter = chapters[currentChapterIndex];
    
    if (!currentChapter) return;

    if (currentStepIndex < currentChapter.steps.length - 1) {
      set({ currentStepIndex: currentStepIndex + 1 });
    } else if (currentChapterIndex < chapters.length - 1) {
      set({
        currentChapterIndex: currentChapterIndex + 1,
        currentStepIndex: 0,
      });
    } else {
      get().stopDemo();
    }
  },

  prevStep: () => {
    const { chapters, currentChapterIndex, currentStepIndex } = get();
    
    if (currentStepIndex > 0) {
      set({ currentStepIndex: currentStepIndex - 1 });
    } else if (currentChapterIndex > 0) {
      const prevChapter = chapters[currentChapterIndex - 1];
      set({
        currentChapterIndex: currentChapterIndex - 1,
        currentStepIndex: prevChapter.steps.length - 1,
      });
    }
  },

  goToChapter: (index: number) => {
    const { chapters } = get();
    if (index >= 0 && index < chapters.length) {
      set({
        currentChapterIndex: index,
        currentStepIndex: 0,
      });
    }
  },

  setChapters: (chapters: DemoChapter[]) => {
    set({ chapters });
  },

  getCurrentStep: () => {
    const { chapters, currentChapterIndex, currentStepIndex } = get();
    return chapters[currentChapterIndex]?.steps[currentStepIndex] || null;
  },

  getCurrentChapter: () => {
    const { chapters, currentChapterIndex } = get();
    return chapters[currentChapterIndex] || null;
  },

  getProgress: () => {
    const { chapters, currentChapterIndex, currentStepIndex } = get();
    const totalSteps = chapters.reduce((sum, ch) => sum + ch.steps.length, 0);
    let completedSteps = 0;
    
    for (let i = 0; i < currentChapterIndex; i++) {
      completedSteps += chapters[i].steps.length;
    }
    completedSteps += currentStepIndex;

    return {
      chapter: currentChapterIndex + 1,
      step: currentStepIndex + 1,
      total: totalSteps,
      percent: totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0,
    };
  },
}));
