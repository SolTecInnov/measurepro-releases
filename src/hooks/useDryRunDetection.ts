/**
 * Dry Run Detection Hook
 * Integrates LiDAR point cloud processing with detection zones and POI logging
 */

import { useEffect, useCallback, useRef } from 'react';
import { useDryRunStore, dryRunDetector } from '@/lib/dryRun';
import type { DetectionEvent } from '@/lib/dryRun/types';
import type { VisualizationData } from '@/lib/lidar/types';
import { useSurveyStore } from '@/lib/survey';
import { useGPSStore } from '@/lib/stores/gpsStore';
import { useMeasurementLogger } from './useMeasurementLogger';
import { toast } from 'sonner';

interface UseDryRunDetectionProps {
  visualization: VisualizationData | null;
  isConnected: boolean;
  handleCaptureImage?: () => Promise<string | null>;
}

interface UseDryRunDetectionResult {
  isEnabled: boolean;
  recentEvents: DetectionEvent[];
  processedPointCount: number;
}

export function useDryRunDetection({
  visualization,
  isConnected,
  handleCaptureImage,
}: UseDryRunDetectionProps): UseDryRunDetectionResult {
  const config = useDryRunStore(state => state.config);
  const recentEvents = useDryRunStore(state => state.recentEvents);
  const { activeSurvey } = useSurveyStore();
  const gpsData = useGPSStore(state => state.data);
  const { logMeasurement } = useMeasurementLogger();
  
  const processedCountRef = useRef(0);
  const lastProcessTimeRef = useRef(0);

  const createDetectionPOI = useCallback(async (event: DetectionEvent) => {
    if (!activeSurvey || !config.autoCreatePOI) return;

    try {
      let imageUrl: string | null = null;
      
      if (config.captureSnapshot && handleCaptureImage) {
        imageUrl = await handleCaptureImage();
      }

      const sideLabel = event.side === 'left' ? 'Left' : event.side === 'right' ? 'Right' : 'Rear';
      const zoneName = 'name' in event.zone ? event.zone.name : `${sideLabel} Threshold`;

      const { getNextPOINumber } = await import('@/lib/survey/measurements');
      const nextPoiNumber = await getNextPOINumber(activeSurvey.id);

      const measurement = {
        id: crypto.randomUUID(),
        rel: event.closestPointDistance,
        altGPS: gpsData.altitude,
        latitude: gpsData.latitude,
        longitude: gpsData.longitude,
        utcDate: new Date().toISOString().split('T')[0],
        utcTime: new Date().toTimeString().split(' ')[0],
        speed: gpsData.speed,
        heading: gpsData.course,
        roadNumber: 1,
        poiNumber: nextPoiNumber,
        poi_type: 'dryRunDetection',
        imageUrl: imageUrl || undefined,
        images: imageUrl ? [imageUrl] : [],
        note: `${zoneName}: ${event.pointCount} points detected at ${event.averageHeight.toFixed(1)}m height`,
        createdAt: new Date().toISOString(),
        user_id: activeSurvey.id,
        source: 'detection' as const,
        lateralSubType: (event.side === 'rear' ? 'rearOverhang' : event.side === 'left' ? 'leftLateral' : 'rightLateral') as 'leftLateral' | 'rightLateral' | 'rearOverhang',
        leftClearance: event.side === 'left' ? event.closestPointDistance : null,
        rightClearance: event.side === 'right' ? event.closestPointDistance : null,
        rearDistance: event.side === 'rear' ? event.closestPointDistance : null,
      };

      await logMeasurement(measurement);

      useDryRunStore.getState().updateDetectionEvent(event.id, { 
        poiCreated: true, 
        poiId: measurement.id 
      });

      toast.success(`${sideLabel} detection logged`, {
        description: `POI ${measurement.id.substring(0, 8)} - ${zoneName}`,
      });
    } catch (error) {
      console.error('[DryRun] Failed to create detection POI:', error);
      toast.error('Failed to log detection POI');
    }
  }, [activeSurvey, config.autoCreatePOI, config.captureSnapshot, gpsData, handleCaptureImage, logMeasurement]);

  useEffect(() => {
    const unsubscribe = dryRunDetector.onDetection((event) => {
      if (config.autoCreatePOI && activeSurvey) {
        createDetectionPOI(event);
      }
    });

    return () => { unsubscribe(); };
  }, [config.autoCreatePOI, activeSurvey, createDetectionPOI]);

  useEffect(() => {
    if (!config.enabled || !isConnected || !visualization?.pointCloud) return;

    const now = Date.now();
    if (now - lastProcessTimeRef.current < 100) return;
    lastProcessTimeRef.current = now;

    const points = visualization.pointCloud;
    if (points.length === 0) return;

    processedCountRef.current = points.length;

    const results = dryRunDetector.processPointCloud(points);
    dryRunDetector.handleDetectionResults(results);
  }, [config.enabled, isConnected, visualization?.pointCloud]);

  return {
    isEnabled: config.enabled,
    recentEvents,
    processedPointCount: processedCountRef.current,
  };
}
