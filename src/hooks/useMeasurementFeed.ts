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
 *
 * PERFORMANCE (v16.1.27):
 * The derived data properties (measurements, stats, poiTypeCounts, etc.) are
 * wrapped in React.useMemo keyed on `updateTrigger`. Before this, every render
 * of every consumer called all the getters synchronously — at 800+ POIs with
 * ~10 consumers that meant ~24,000 array operations per POI add, which hid
 * behind the v16.1.23 O(1) addMeasurement fix and kept the app feeling slow.
 * Now the getters run AT MOST ONCE per subscriber per POI add.
 */
export function useMeasurementFeed() {
  const { activeSurvey } = useSurveyStore();
  const [updateTrigger, setUpdateTrigger] = useState(0);
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

  // PERF: memoize all derived properties keyed on updateTrigger.
  // This means getMeasurements / getStats / getPOITypeCounts / getMapClusters
  // only run when the feed has actually changed, not on every parent render.
  const measurements = useMemo(() => feed.getMeasurements(), [feed, updateTrigger]);
  const stats = useMemo(() => feed.getStats(), [feed, updateTrigger]);
  const poiTypeCounts = useMemo(() => feed.getPOITypeCounts(), [feed, updateTrigger]);
  const mapClusters = useMemo(() => feed.getMapClusters(), [feed, updateTrigger]);
  const cacheSize = useMemo(() => feed.getCacheSize(), [feed, updateTrigger]);

  return {
    // Data accessors
    measurements,
    getMeasurement: (id: string) => feed.getMeasurement(id),
    getMeasurementsWithLimit: (limit: number) => feed.getMeasurementsWithLimit(limit),
    getMapMeasurements: (limit?: number) => feed.getMapMeasurements(limit),

    // Filters
    filterByPOIType: (poiType: string) => feed.filterByPOIType(poiType),
    filterBySearch: (query: string) => feed.filterBySearch(query),

    // Stats
    stats,
    poiTypeCounts,

    // Map
    mapClusters,

    // Actions
    refresh: () => feed.refresh(),

    // Metadata
    cacheSize,
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
