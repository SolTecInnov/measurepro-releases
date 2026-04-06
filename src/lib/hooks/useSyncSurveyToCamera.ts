import { useEffect, useRef } from 'react';
import { useSurveyStore } from '../survey/store';
import { useCameraStore } from '../camera';

/**
 * Hook to automatically sync active survey data to camera overlay fields
 * Watches for changes in activeSurvey and updates camera overlay fields accordingly
 */
export function useSyncSurveyToCamera() {
  const activeSurvey = useSurveyStore((state) => state.activeSurvey);
  const syncOverlayFromSurvey = useCameraStore((state) => state.syncOverlayFromSurvey);
  
  // Track previous values to avoid unnecessary updates
  const previousSurveyRef = useRef<{
    surveyTitle: string;
    projectNumber: string;
    surveyorName: string;
  } | null>(null);

  useEffect(() => {
    // Extract current survey values
    const currentSurveyValues = activeSurvey
      ? {
          surveyTitle: activeSurvey.surveyTitle || activeSurvey.name || '',
          projectNumber: activeSurvey.projectNumber || '',
          surveyorName: activeSurvey.surveyorName || activeSurvey.surveyor || '',
        }
      : null;

    // Check if values actually changed
    const hasChanged =
      JSON.stringify(previousSurveyRef.current) !== JSON.stringify(currentSurveyValues);

    if (hasChanged) {
      // Update camera store with new survey data
      syncOverlayFromSurvey(activeSurvey);
      
      // Update ref to track current values
      previousSurveyRef.current = currentSurveyValues;
      
    }
  }, [activeSurvey, syncOverlayFromSurvey]);
}
