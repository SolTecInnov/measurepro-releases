import { useEffect, useCallback } from 'react';
import { useDemoStore } from '@/lib/demo/demoStore';
import { DEMO_CHAPTERS } from '@/lib/demo/demoChapters';
import { demoDataInjector, LaserData, GPSData } from '@/lib/demo/demoDataInjector';

interface UseDemoModeOptions {
  onMeasurement?: (data: LaserData) => void;
  onGPS?: (data: GPSData) => void;
  setActiveTab?: (tab: string) => void;
}

export function useDemoMode(options: UseDemoModeOptions = {}) {
  const { 
    isActive, 
    isPlaying,
    startDemo, 
    stopDemo,
    setChapters,
    getCurrentStep,
    currentChapterIndex,
    currentStepIndex,
  } = useDemoStore();

  const initializeDemo = useCallback(() => {
    setChapters(DEMO_CHAPTERS);
    startDemo();
    
    const handleMeasurement = (data: LaserData) => {
      options.onMeasurement?.(data);
    };
    
    const handleGPS = (data: GPSData) => {
      options.onGPS?.(data);
    };
    
    demoDataInjector.start(handleMeasurement, handleGPS);
  }, [setChapters, startDemo, options]);

  const cleanupDemo = useCallback(() => {
    demoDataInjector.stop();
    stopDemo();
  }, [stopDemo]);

  useEffect(() => {
    if (!isActive) return;

    const step = getCurrentStep();
    if (step?.tabId && options.setActiveTab) {
      options.setActiveTab(step.tabId);
    }

    if (step?.action) {
      step.action();
    }
  }, [isActive, currentChapterIndex, currentStepIndex, getCurrentStep, options]);

  useEffect(() => {
    return () => {
      if (isActive) {
        demoDataInjector.stop();
      }
    };
  }, [isActive]);

  return {
    isActive,
    isPlaying,
    initializeDemo,
    cleanupDemo,
  };
}
