import { useEffect, useRef, useState, useCallback } from 'react';
import { TrainingSessionManager, type TrainingFrame } from '../lib/training';
import { useSettingsStore } from '../lib/settings';
import { useSerialStore } from '../lib/stores/serialStore';
import { useLaserStore } from '../lib/laser';
import { useGPSStore } from '../lib/stores/gpsStore';
import { useSurveyStore } from '../lib/survey';
import { usePOIStore } from '../lib/poi';

export const useTrainingSession = (videoRef: React.RefObject<HTMLVideoElement>) => {
  const { aiSettings } = useSettingsStore();
  const { lastMeasurement } = useSerialStore();
  const { groundReferenceHeight } = useLaserStore();
  const { data: gpsData } = useGPSStore();
  const { activeSurvey } = useSurveyStore();
  const { selectedType: selectedPOI } = usePOIStore();
  
  const [isActive, setIsActive] = useState(false);
  const [frameCount, setFrameCount] = useState(0);
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);
  const sessionManagerRef = useRef<TrainingSessionManager | null>(null);

  // Initialize session manager when video element is available
  useEffect(() => {
    if (videoRef.current && !sessionManagerRef.current) {
      sessionManagerRef.current = new TrainingSessionManager(
        videoRef.current,
        aiSettings?.trainingFrameRate || 2,
        (frame: TrainingFrame) => {
          setFrameCount(prev => prev + 1);
        }
      );
    }

    return () => {
      if (sessionManagerRef.current?.isRunning()) {
        sessionManagerRef.current.stop();
      }
    };
  }, [videoRef, aiSettings?.trainingFrameRate]);

  // Update frame rate when settings change
  useEffect(() => {
    if (sessionManagerRef.current && aiSettings?.trainingFrameRate) {
      sessionManagerRef.current.updateFrameRate(aiSettings.trainingFrameRate);
    }
  }, [aiSettings?.trainingFrameRate]);

  const getMetadata = useCallback((): Omit<TrainingFrame['metadata'], 'labels'> => {
    const metadata: Omit<TrainingFrame['metadata'], 'labels'> = {};

    // Add GPS data if available
    if (gpsData && gpsData.latitude !== 0 && gpsData.longitude !== 0) {
      metadata.gps = {
        latitude: gpsData.latitude,
        longitude: gpsData.longitude,
        altitude: gpsData.altitude,
        accuracy: gpsData.hdop,
        heading: gpsData.course,
      };
    }

    // Add measurement data if available
    if (lastMeasurement && lastMeasurement !== '--') {
      const distance = parseFloat(lastMeasurement);
      if (!isNaN(distance)) {
        // BUGFIX: Add ground reference (not subtract) - same as other logging
        const height = distance + groundReferenceHeight;
        metadata.measurement = {
          distance,
          height,
          groundReference: groundReferenceHeight,
        };
      }
    }

    // Add POI data if available
    if (selectedPOI) {
      metadata.poi = {
        type: selectedPOI,
        subtype: '',
      };
    }

    // Add survey data if available
    if (activeSurvey) {
      metadata.survey = {
        id: activeSurvey.id,
        name: activeSurvey.surveyTitle || activeSurvey.name || 'Unnamed Survey',
      };
    }

    // Add camera data
    if (videoRef.current) {
      metadata.camera = {
        deviceId: 'active-camera',
        resolution: {
          width: videoRef.current.videoWidth || 1280,
          height: videoRef.current.videoHeight || 720,
        },
      };
    }

    return metadata;
  }, [gpsData, lastMeasurement, groundReferenceHeight, selectedPOI, activeSurvey, videoRef]);

  const startSession = useCallback(() => {
    if (!sessionManagerRef.current || !videoRef.current) {
      return;
    }

    if (isActive) {
      return;
    }

    sessionManagerRef.current.start(getMetadata);
    setIsActive(true);
    setFrameCount(0);
    setSessionStartTime(Date.now());
  }, [isActive, getMetadata, videoRef]);

  const stopSession = useCallback(() => {
    if (sessionManagerRef.current) {
      sessionManagerRef.current.stop();
      setIsActive(false);
      setSessionStartTime(null);
    }
  }, []);

  const toggleSession = useCallback(() => {
    if (isActive) {
      stopSession();
    } else {
      startSession();
    }
  }, [isActive, startSession, stopSession]);

  // Auto-start/stop based on training mode setting
  useEffect(() => {
    if (aiSettings?.trainingMode && !isActive) {
      // Training mode enabled but session not running - start it
      if (videoRef.current && sessionManagerRef.current) {
        startSession();
      }
    } else if (!aiSettings?.trainingMode && isActive) {
      // Training mode disabled but session running - stop it
      stopSession();
    }
  }, [aiSettings?.trainingMode, isActive, startSession, stopSession, videoRef]);

  return {
    isActive,
    frameCount,
    sessionStartTime,
    startSession,
    stopSession,
    toggleSession,
  };
};
