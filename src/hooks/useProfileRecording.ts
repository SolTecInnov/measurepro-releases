/**
 * useProfileRecording Hook
 * Integrates road profile recording with survey lifecycle
 * 
 * Features:
 * - Auto-start recording when survey starts (configurable)
 * - Pause/resume support for section marking
 * - GPS source selection (Duro, Browser, Auto)
 * - Real-time stats updates
 * - Auto-creates POIs and log entries when grade/K-factor/railroad alerts trigger
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { useSurveyStore } from '@/lib/survey';
import { useSettingsStore } from '@/lib/settings';
import {
  getProfileRecordingBuffer,
  checkPointForAlerts,
  AlertPOIDebouncer,
  GradeSegmentTracker,
  gradeCategoryToPOIType,
  formatGradeSegmentNote,
  type ProfileRecordingState,
  type ProfileRecordingStats,
  type ProfileGpsSource,
  type SectionMarker,
  type RoadProfilePoint,
  type ProfileAlertPOI,
  type GradeSegmentEvent
} from '@/lib/roadProfile';
import { getMeasurementLogger } from '@/lib/workers/MeasurementLoggerClient';
import { useGPSStore } from '@/lib/stores/gpsStore';

interface UseProfileRecordingReturn {
  isRecording: boolean;
  isPaused: boolean;
  state: ProfileRecordingState;
  stats: ProfileRecordingStats | null;
  points: RoadProfilePoint[];
  gpsSource: ProfileGpsSource;
  gradeEvents: GradeSegmentEvent[];
  startRecording: () => void;
  stopRecording: () => void;
  pauseRecording: () => void;
  resumeRecording: () => void;
  markSectionStart: (label?: string) => SectionMarker | null;
  markSectionEnd: (label?: string) => SectionMarker | null;
  setGpsSource: (source: ProfileGpsSource) => void;
}

export function useProfileRecording(): UseProfileRecordingReturn {
  const { activeSurvey } = useSurveyStore();
  const { profileSettings, setProfileSettings } = useSettingsStore();
  const buffer = getProfileRecordingBuffer();
  
  // CRITICAL: Initialize state from buffer to restore recording state across navigation
  // Without this, navigating away and back would reset the UI while buffer keeps recording
  const [state, setState] = useState<ProfileRecordingState>(() => buffer.getState());
  const [stats, setStats] = useState<ProfileRecordingStats | null>(() => buffer.getStats());
  const [points, setPoints] = useState<RoadProfilePoint[]>(() => buffer.getPoints());
  const [gradeEvents, setGradeEvents] = useState<GradeSegmentEvent[]>([]);
  const [gpsSource, setGpsSourceState] = useState<ProfileGpsSource>(
    profileSettings.gpsSource as ProfileGpsSource
  );
  
  const browserGpsWatchId = useRef<number | null>(null);
  const lastSurveyId = useRef<string | null>(null);
  const alertDebouncer = useRef(new AlertPOIDebouncer());
  // Initialize to current point count to avoid re-processing already-handled points on remount
  const initialPointCount = buffer.getPoints().length;
  const lastAlertPointIndex = useRef<number>(initialPointCount > 0 ? initialPointCount - 1 : -1);
  const gradeSegmentTracker = useRef(new GradeSegmentTracker());
  const lastGradePointIndex = useRef<number>(initialPointCount > 0 ? initialPointCount - 1 : -1);
  
  // Get GPS store for alert POI location data
  const { data: gpsData } = useGPSStore();

  // Create POI for profile alert (grade, K-factor).
  // Debounce is handled by the caller (processNewAlertPoints) before calling this function.
  const createAlertPOI = useCallback(async (alertPOI: ProfileAlertPOI): Promise<void> => {
    if (!activeSurvey?.id) return;
    
    // Create measurement entry for the alert POI
    const measurementLogger = getMeasurementLogger();
    
    const measurement = {
      id: alertPOI.id,
      rel: alertPOI.grade_pct,
      altGPS: gpsData?.altitude ?? null,
      latitude: alertPOI.lat,
      longitude: alertPOI.lon,
      utcDate: new Date().toISOString().split('T')[0],
      utcTime: new Date().toTimeString().split(' ')[0],
      speed: gpsData?.speed ?? 0,
      heading: gpsData?.course ?? 0,
      roadNumber: 1,
      poiNumber: Math.floor(Math.random() * 10000),
      poi_type: alertPOI.poiType,
      imageUrl: null,
      images: [],
      videoTimestamp: null,
      note: alertPOI.note,
      createdAt: alertPOI.timestamp,
      user_id: activeSurvey.id
    };
    
    try {
      await measurementLogger.logMeasurement(measurement);
    } catch (_e) {
      // Silent fail - don't spam console
    }
  }, [activeSurvey?.id, gpsData]);

  // Create POI for grade segment event (10-12%, 12-14%, 14%+)
  const createGradeSegmentPOI = useCallback(async (segment: GradeSegmentEvent) => {
    if (!activeSurvey?.id) return;
    
    const poiType = gradeCategoryToPOIType(segment.category, segment.direction);
    if (!poiType) return;
    
    const note = formatGradeSegmentNote(segment);
    const measurementLogger = getMeasurementLogger();
    
    const measurement = {
      id: segment.id,
      rel: segment.maxGrade_pct,
      altGPS: gpsData?.altitude ?? null,
      latitude: segment.startLat,
      longitude: segment.startLon,
      utcDate: new Date().toISOString().split('T')[0],
      utcTime: new Date().toTimeString().split(' ')[0],
      speed: gpsData?.speed ?? 0,
      heading: gpsData?.course ?? 0,
      roadNumber: 1,
      poiNumber: Math.floor(Math.random() * 10000),
      poi_type: poiType,
      imageUrl: null,
      images: [],
      videoTimestamp: null,
      note,
      createdAt: segment.startTimestamp,
      user_id: activeSurvey.id
    };
    
    try {
      await measurementLogger.logMeasurement(measurement);
    } catch (error) {
      // Silent fail - don't spam console
    }
  }, [activeSurvey?.id, gpsData]);

  // Process alert POIs and add to grade event log.
  // The index is advanced synchronously before any async POI logging begins,
  // preventing double-processing if this is called again before POI logging completes.
  const processNewAlertPoints = useCallback((currentPoints: ReturnType<typeof buffer.getPoints>) => {
    const startIndex = lastAlertPointIndex.current + 1;
    // Advance index immediately so re-entrant calls skip these points.
    lastAlertPointIndex.current = currentPoints.length - 1;

    for (let i = startIndex; i < currentPoints.length; i++) {
      const point = currentPoints[i];
      const alertPOI = checkPointForAlerts(point);
      if (alertPOI) {
        // Debounce check is synchronous — advance state before firing async log
        const shouldFire = alertDebouncer.current.shouldTrigger(alertPOI.alertType, alertPOI.chainage_m);
        if (shouldFire) {
          const alertDirection: 'up' | 'down' = alertPOI.alertType === 'GRADE_12_DOWN' ? 'down' : 'up';
          const alertCategory = alertPOI.alertType === 'K_OVER_10'
            ? 'kFactor'
            : Math.abs(alertPOI.grade_pct) >= 14 ? 'grade14plus' : 'grade12to14';
          const alertEvent: GradeSegmentEvent = {
            id: alertPOI.id,
            category: alertCategory,
            direction: alertDirection,
            startLat: alertPOI.lat,
            startLon: alertPOI.lon,
            endLat: alertPOI.lat,
            endLon: alertPOI.lon,
            startChainage_m: alertPOI.chainage_m,
            endChainage_m: alertPOI.chainage_m,
            length_m: 0,
            maxGrade_pct: alertPOI.grade_pct,
            avgGrade_pct: alertPOI.grade_pct,
            startTimestamp: alertPOI.timestamp,
            endTimestamp: alertPOI.timestamp
          };
          setGradeEvents(prev => [...prev, alertEvent]);
          // Fire-and-forget POI logging (async, does not gate UI update)
          createAlertPOI(alertPOI).catch(() => {});
        }
      }
    }
  }, [createAlertPOI]);

  // Subscribe to buffer events and check for alerts
  useEffect(() => {
    const unsubscribe = buffer.subscribe((event) => {
      switch (event.type) {
        case 'state':
          setState(event.data.state);
          // Reset trackers when recording stops
          if (event.data.state === 'idle') {
            alertDebouncer.current.reset();
            lastAlertPointIndex.current = -1;
            // Flush any remaining grade segment and reset
            const currentPts = buffer.getPoints();
            if (currentPts.length > 0) {
              const finalSegment = gradeSegmentTracker.current.flush(currentPts[currentPts.length - 1]);
              if (finalSegment) {
                createGradeSegmentPOI(finalSegment);
                setGradeEvents(prev => [...prev, finalSegment]);
              }
            }
            gradeSegmentTracker.current.reset();
            lastGradePointIndex.current = -1;
            setGradeEvents([]);
          }
          break;
        case 'stats':
          setStats(event.data);
          break;
        case 'point': {
          const currentPoints = buffer.getPoints();
          setPoints(currentPoints);
          
          // Check new points for alerts (only points we haven't checked yet)
          // processNewAlertPoints is async; fire-and-forget is safe here because
          // state updates inside it use functional updaters which are race-condition safe.
          void processNewAlertPoints(currentPoints);
          
          // Process new points through grade segment tracker (synchronous)
          for (let i = lastGradePointIndex.current + 1; i < currentPoints.length; i++) {
            const point = currentPoints[i];
            const completedSegment = gradeSegmentTracker.current.processPoint(point);
            if (completedSegment) {
              createGradeSegmentPOI(completedSegment);
              setGradeEvents(prev => [...prev, completedSegment]);
            }
          }
          lastGradePointIndex.current = currentPoints.length - 1;
          break;
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [buffer, processNewAlertPoints, createGradeSegmentPOI]);

  // Start browser GPS tracking
  const startBrowserGps = useCallback(() => {
    if (!navigator.geolocation) {
      console.warn('[ProfileRecording] Geolocation not available');
      return;
    }

    browserGpsWatchId.current = navigator.geolocation.watchPosition(
      (position) => {
        if (buffer.getState() !== 'recording') return;
        
        buffer.addSample({
          timestamp: new Date().toISOString(),
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          altitude: position.coords.altitude,
          speed: position.coords.speed,
          heading: position.coords.heading,
          accuracy: position.coords.accuracy,
          source: 'browser',
          quality: 'browser'
        });
      },
      (error) => {
        console.error('[ProfileRecording] GPS error:', error);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 1000
      }
    );
  }, [buffer]);

  // Stop browser GPS tracking
  const stopBrowserGps = useCallback(() => {
    if (browserGpsWatchId.current !== null) {
      navigator.geolocation.clearWatch(browserGpsWatchId.current);
      browserGpsWatchId.current = null;
    }
  }, []);

  // Start recording
  const startRecordingInternal = useCallback((surveyId: string) => {
    const effectiveSource = determineGpsSource(gpsSource);
    
    buffer.startRecording({
      surveyId,
      gpsSource: effectiveSource,
      thresholds: {
        grade_up_alert_pct: profileSettings.gradeUpAlertThreshold,
        grade_down_alert_pct: profileSettings.gradeDownAlertThreshold,
        k_factor_alert: profileSettings.kFactorAlertThreshold,
        sample_interval_m: profileSettings.sampleIntervalM
      },
      // Banking/Cross-slope settings for heavy haul safety
      crossSlopeMode: profileSettings.crossSlopeMode,
      bankingThresholds: profileSettings.bankingThresholds,
      minimumCurveRadius_m: profileSettings.minimumCurveRadius_m,
      curveDetectionThreshold_m: profileSettings.curveDetectionThreshold_m
    });

    // Start GPS tracking based on source
    // Note: determineGpsSource never returns 'auto' — it resolves to duro/serial/browser
    if (effectiveSource === 'browser') {
      startBrowserGps();
    }
    
    setState('recording');
  }, [buffer, gpsSource, profileSettings, startBrowserGps]);

  // Stop recording
  const stopRecordingInternal = useCallback(async () => {
    stopBrowserGps();
    
    // Recompute with smoothing for final results
    buffer.recomputeWithSmoothing();
    await buffer.stopRecording(); // Async - flushes to IndexedDB
    
    setState('idle');
    setStats(null);
  }, [buffer, stopBrowserGps]);

  // Public methods
  const startRecording = useCallback(() => {
    if (!activeSurvey?.id) {
      console.warn('[ProfileRecording] No active survey');
      return;
    }
    startRecordingInternal(activeSurvey.id);
  }, [activeSurvey?.id, startRecordingInternal]);

  const stopRecording = useCallback(async () => {
    await stopRecordingInternal();
  }, [stopRecordingInternal]);

  const pauseRecording = useCallback(() => {
    stopBrowserGps(); // Stop GPS tracking when paused to prevent background tracking
    buffer.pauseRecording();
    setState('paused');
  }, [buffer, stopBrowserGps]);

  const resumeRecording = useCallback(() => {
    buffer.resumeRecording();
    
    // Resume GPS tracking based on source
    const effectiveSource = determineGpsSource(gpsSource);
    if (effectiveSource === 'browser') {
      startBrowserGps();
    }
    
    setState('recording');
  }, [buffer, gpsSource, startBrowserGps]);

  const markSectionStart = useCallback((label?: string): SectionMarker | null => {
    return buffer.markSectionStart(label);
  }, [buffer]);

  const markSectionEnd = useCallback((label?: string): SectionMarker | null => {
    return buffer.markSectionEnd(label);
  }, [buffer]);

  const setGpsSource = useCallback((source: ProfileGpsSource) => {
    setGpsSourceState(source);
    setProfileSettings({
      ...profileSettings,
      gpsSource: source
    });
  }, [profileSettings, setProfileSettings]);

  // Auto-start/stop recording based on survey lifecycle
  useEffect(() => {
    const surveyId = activeSurvey?.id;
    
    // Survey started
    if (surveyId && surveyId !== lastSurveyId.current) {
      lastSurveyId.current = surveyId;
      
      // Auto-start if enabled
      if (profileSettings.autoRecordWithSurvey && buffer.getState() === 'idle') {
        startRecordingInternal(surveyId);
      }
    }
    
    // Survey ended - stop recording and persist data
    if (!surveyId && lastSurveyId.current && buffer.getState() !== 'idle') {
      stopRecordingInternal().then(() => {
        lastSurveyId.current = null;
      });
    }
  }, [activeSurvey?.id, profileSettings.autoRecordWithSurvey, buffer, startRecordingInternal, stopRecordingInternal]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopBrowserGps();
    };
  }, [stopBrowserGps]);

  return {
    isRecording: state === 'recording',
    isPaused: state === 'paused',
    state,
    stats,
    points,
    gpsSource,
    gradeEvents,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    markSectionStart,
    markSectionEnd,
    setGpsSource
  };
}

/**
 * Determine effective GPS source based on 'auto' setting.
 * In 'auto' mode: prefer Duro > Serial > Bluetooth > browser.
 * Reads from gpsStore synchronously (getState) so no async required.
 */
function determineGpsSource(source: ProfileGpsSource): ProfileGpsSource {
  if (source !== 'auto') return source;

  const gpsData = useGPSStore.getState().data;
  const recentThresholdMs = 5000; // consider source "active" if updated in last 5s
  const isRecent = gpsData.lastUpdate && (Date.now() - gpsData.lastUpdate) < recentThresholdMs;

  if (isRecent && gpsData.source === 'duro') return 'duro';
  if (isRecent && gpsData.source === 'serial') return 'serial';
  if (isRecent && gpsData.source === 'bluetooth') return 'bluetooth';

  return 'browser';
}

export default useProfileRecording;
