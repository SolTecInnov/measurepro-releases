/**
 * useMeasurementFeed Hook
 * React hook for accessing the in-memory measurement cache
 * 
 * PERFORMANCE: Components use this instead of querying IndexedDB directly
 * This prevents the "150+ measurements lag" issue by avoiding reactive IndexedDB queries
 */

import { useEffect, useState, useMemo, useRef } from 'react';
import { getMeasurementFeed, type MeasurementStats, type MapCluster } from '../lib/survey/MeasurementFeed';
import { useSurveyStore } from '../lib/survey';
import type { Measurement } from '../lib/survey/types';
import { 
  initLiveBroadcastIntegration, 
  handleSurveyStart, 
  handleSurveyClose 
} from '../lib/firebase/liveBroadcastIntegration';

/**
 * Hook to access measurement feed with automatic survey sync
 */
export function useMeasurementFeed() {
  const { activeSurvey } = useSurveyStore();
  const [, setUpdateTrigger] = useState(0);
  const feed = useMemo(() => getMeasurementFeed(), []);
  const liveBroadcastInitialized = useRef(false);

  // Initialize feed when survey changes
  useEffect(() => {
    if (activeSurvey?.id) {
      feed.init(activeSurvey.id).catch(error => {
        console.error('Failed to initialize measurement feed:', error);
      });
      
      // Initialize live broadcast integration (once)
      if (!liveBroadcastInitialized.current) {
        initLiveBroadcastIntegration();
        liveBroadcastInitialized.current = true;
      }
      
      // Auto-start live broadcasting if enabled in settings
      handleSurveyStart(activeSurvey.id, activeSurvey.surveyTitle || 'Untitled Survey');
    } else {
      feed.clear();
      
      // Stop live broadcasting when survey closes
      handleSurveyClose();
    }
  }, [activeSurvey?.id, feed]);

  // Subscribe to feed updates
  useEffect(() => {
    const unsubscribe = feed.subscribe(() => {
      // Trigger re-render when cache updates
      setUpdateTrigger(prev => prev + 1);
    });

    return unsubscribe;
  }, [feed]);

  return {
    // Data accessors
    measurements: feed.getMeasurements(),
    getMeasurement: (id: string) => feed.getMeasurement(id),
    getMeasurementsWithLimit: (limit: number) => feed.getMeasurementsWithLimit(limit),
    getMapMeasurements: (limit?: number) => feed.getMapMeasurements(limit),
    
    // Filters
    filterByPOIType: (poiType: string) => feed.filterByPOIType(poiType),
    filterBySearch: (query: string) => feed.filterBySearch(query),
    
    // Stats
    stats: feed.getStats(),
    poiTypeCounts: feed.getPOITypeCounts(),
    
    // Map
    mapClusters: feed.getMapClusters(),
    
    // Actions
    refresh: () => feed.refresh(),
    
    // Metadata
    cacheSize: feed.getCacheSize()
  };
}

/**
 * Hook for accessing just measurements (most common use case)
 */
export function useMeasurements(limit?: number): Measurement[] {
  const { measurements, getMeasurementsWithLimit } = useMeasurementFeed();
  
  if (limit) {
    return getMeasurementsWithLimit(limit);
  }
  
  return measurements;
}

/**
 * Hook for accessing measurement statistics
 */
export function useMeasurementStats(): MeasurementStats {
  const { stats } = useMeasurementFeed();
  return stats;
}

/**
 * Hook for accessing map measurements
 */
export function useMapMeasurements(limit = 100): Measurement[] {
  const { getMapMeasurements } = useMeasurementFeed();
  return getMapMeasurements(limit);
}

/**
 * Hook for accessing map clusters
 */
export function useMapClusters(): MapCluster[] {
  const { mapClusters } = useMeasurementFeed();
  return mapClusters;
}
