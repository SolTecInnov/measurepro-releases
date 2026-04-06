import { useEffect, useState } from 'react';
import { useSurveyStore } from '../survey';
import { autoSaveSurvey, setupAutoSave, clearAutoSave } from '../utils/autoSaveUtils';

/**
 * Hook to set up auto-save for the active survey
 * @returns Object with auto-save status and functions
 */
export const useAutoSave = () => {
  const { activeSurvey } = useSurveyStore();
  const [autoSaveIntervalId, setAutoSaveIntervalId] = useState<number | null>(null);
  const [lastSaveTime, setLastSaveTime] = useState<Date | null>(null);
  const [isAutoSaveEnabled, setIsAutoSaveEnabled] = useState<boolean>(
    localStorage.getItem('autoSaveEnabled') !== 'false'
  );
  const [autoSaveInterval, setAutoSaveInterval] = useState<number>(
    parseInt(localStorage.getItem('autoSaveInterval') || '60')
  );

  // Set up auto-save when survey is active
  useEffect(() => {
    if (activeSurvey && isAutoSaveEnabled) {
      // Clear any existing interval
      if (autoSaveIntervalId) {
        clearAutoSave(autoSaveIntervalId);
      }
      
      // Set up new interval
      const intervalId = setupAutoSave(activeSurvey, autoSaveInterval);
      setAutoSaveIntervalId(intervalId);
      
      // Listen for auto-save completion events
      const handleAutoSaveComplete = (event: CustomEvent) => {
        setLastSaveTime(new Date(event.detail.timestamp));
      };
      
      window.addEventListener('autosave-complete', handleAutoSaveComplete as EventListener);
      
      return () => {
        clearAutoSave(intervalId);
        window.removeEventListener('autosave-complete', handleAutoSaveComplete as EventListener);
      };
    } else if (autoSaveIntervalId) {
      // Clear interval if survey is not active
      clearAutoSave(autoSaveIntervalId);
      setAutoSaveIntervalId(null);
    }
  }, [activeSurvey, isAutoSaveEnabled, autoSaveInterval]);

  // Update state when localStorage changes
  useEffect(() => {
    const handleStorageChange = () => {
      setIsAutoSaveEnabled(localStorage.getItem('autoSaveEnabled') !== 'false');
      setAutoSaveInterval(parseInt(localStorage.getItem('autoSaveInterval') || '60'));
    };
    
    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  // Function to trigger manual save
  const saveNow = () => {
    if (activeSurvey) {
      autoSaveSurvey(activeSurvey);
    }
  };

  // Function to enable/disable auto-save
  const setEnabled = (enabled: boolean) => {
    localStorage.setItem('autoSaveEnabled', enabled.toString());
    setIsAutoSaveEnabled(enabled);
    
    if (enabled && activeSurvey) {
      // Trigger immediate save when enabling
      autoSaveSurvey(activeSurvey);
    }
  };

  // Function to set auto-save interval
  const setInterval = (minutes: number) => {
    localStorage.setItem('autoSaveInterval', minutes.toString());
    setAutoSaveInterval(minutes);
    
    // Reset interval if active
    if (autoSaveIntervalId && activeSurvey) {
      clearAutoSave(autoSaveIntervalId);
      const newIntervalId = setupAutoSave(activeSurvey, minutes);
      setAutoSaveIntervalId(newIntervalId);
    }
  };

  return {
    isEnabled: isAutoSaveEnabled,
    interval: autoSaveInterval,
    lastSaveTime,
    saveNow,
    setEnabled,
    setInterval
  };
};