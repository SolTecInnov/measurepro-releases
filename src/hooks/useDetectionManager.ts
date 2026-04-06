import { useEffect, useRef, useState, useCallback } from 'react';
import { MockDetectionGenerator, type Detection } from '../lib/mockDetection';
import { TensorFlowDetector, type ModelLoadStatus } from '../lib/ai/tensorflowDetection';
import { useDetectionStore } from '../lib/stores/detectionStore';
import { useSettingsStore } from '../lib/settings';
import { useSerialStore } from '../lib/stores/serialStore';
import { useLaserStore } from '../lib/laser';
import { useGPSStore } from '../lib/stores/gpsStore';
import { usePOIStore } from '../lib/poi';
import { useMeasurementLogger } from './useMeasurementLogger';
import { soundManager } from '../lib/sounds';
import { toast } from 'sonner';

interface UseDetectionManagerProps {
  videoRef?: React.RefObject<HTMLVideoElement>;
}

export const useDetectionManager = (props?: UseDetectionManagerProps) => {
  const { videoRef } = props || {};
  const { aiSettings } = useSettingsStore();
  const { 
    activeDetections, 
    addDetection,
    acceptDetection,
    rejectDetection,
    correctDetection,
    setPendingDetection,
    clearPendingDetection,
  } = useDetectionStore();
  
  const { lastMeasurement } = useSerialStore();
  const { groundReferenceHeight } = useLaserStore();
  const { data: gpsData } = useGPSStore();
  const { setSelectedType: setPOIType } = usePOIStore();
  
  // PERFORMANCE FIX: Use worker-based measurement logging
  const { logMeasurement: logMeasurementViaWorker } = useMeasurementLogger();
  
  const [isActive, setIsActive] = useState(false);
  const [detectionCount, setDetectionCount] = useState(0);
  const [showCorrectionDialog, setShowCorrectionDialog] = useState(false);
  const [currentDetection, setCurrentDetection] = useState<Detection | null>(null);
  const [modelLoadStatus, setModelLoadStatus] = useState<ModelLoadStatus>('idle');
  const [modelError, setModelError] = useState<string | null>(null);
  
  const mockGeneratorRef = useRef<MockDetectionGenerator | null>(null);
  const tensorFlowDetectorRef = useRef<TensorFlowDetector | null>(null);
  const pendingTimeoutRef = useRef<number | null>(null);
  const detectionLoopRef = useRef<number | null>(null);

  // Initialize mock detection generator
  useEffect(() => {
    if (!mockGeneratorRef.current && aiSettings?.enabledClasses) {
      mockGeneratorRef.current = new MockDetectionGenerator(
        aiSettings.enabledClasses,
        3000, // 3 seconds between detections
        (detection: Detection) => {
          handleNewDetection(detection);
        }
      );
    }

    return () => {
      if (mockGeneratorRef.current?.isActive()) {
        mockGeneratorRef.current.stop();
      }
    };
  }, [aiSettings?.enabledClasses]);

  // Update enabled classes when settings change
  useEffect(() => {
    if (mockGeneratorRef.current && aiSettings?.enabledClasses) {
      mockGeneratorRef.current.updateEnabledClasses(aiSettings.enabledClasses);
    }
  }, [aiSettings?.enabledClasses]);

  // Initialize TensorFlow detector when needed
  useEffect(() => {
    const initializeTensorFlow = async () => {
      if (aiSettings?.enabled && !aiSettings?.mockDetectionMode && !aiSettings?.trainingMode) {
        if (!tensorFlowDetectorRef.current) {
          tensorFlowDetectorRef.current = new TensorFlowDetector({
            minConfidence: aiSettings.detectionConfidence || 0.5,
            maxDetections: 20,
            backend: 'webgl',
          });
          
          setModelLoadStatus('loading');
          setModelError(null);
          
          try {
            await tensorFlowDetectorRef.current.initialize();
            setModelLoadStatus('loaded');
            toast.success('AI model loaded successfully');
          } catch (error) {
            setModelLoadStatus('error');
            const errorMsg = error instanceof Error ? error.message : String(error);
            setModelError(errorMsg);
            toast.error(`Failed to load AI model: ${errorMsg}`);
          }
        }
      }
    };

    initializeTensorFlow();

    return () => {
      if (tensorFlowDetectorRef.current) {
        tensorFlowDetectorRef.current.dispose();
        tensorFlowDetectorRef.current = null;
      }
    };
  }, [aiSettings?.enabled, aiSettings?.mockDetectionMode, aiSettings?.trainingMode]);

  // Update TensorFlow detection throttle based on training frame rate
  useEffect(() => {
    if (tensorFlowDetectorRef.current && aiSettings?.trainingFrameRate) {
      tensorFlowDetectorRef.current.setDetectionThrottle(aiSettings.trainingFrameRate);
    }
  }, [aiSettings?.trainingFrameRate]);

  // Reinitialize detector when confidence changes
  useEffect(() => {
    // Only reinitialize if detector already exists and confidence is defined
    if (!tensorFlowDetectorRef.current || !aiSettings?.detectionConfidence) {
      return;
    }
    
    const reinitializeDetector = async () => {
      // Dispose old detector to clean up resources
      tensorFlowDetectorRef.current!.dispose();
      
      // Create new detector with updated confidence
      tensorFlowDetectorRef.current = new TensorFlowDetector({
        minConfidence: aiSettings.detectionConfidence,
        maxDetections: 20,
        backend: 'webgl',
      });
      
      setModelLoadStatus('loading');
      setModelError(null);
      
      try {
        // Reinitialize the detector
        await tensorFlowDetectorRef.current.initialize();
        setModelLoadStatus('loaded');
        toast.success(`AI detector reinitialized with ${(aiSettings.detectionConfidence * 100).toFixed(0)}% confidence`);
      } catch (error) {
        setModelLoadStatus('error');
        const errorMsg = error instanceof Error ? error.message : String(error);
        setModelError(errorMsg);
        toast.error(`Failed to reinitialize detector: ${errorMsg}`);
      }
    };
    
    reinitializeDetector();
  }, [aiSettings?.detectionConfidence]);

  // TensorFlow detection loop
  useEffect(() => {
    if (!videoRef?.current || !aiSettings?.enabled || aiSettings?.mockDetectionMode || aiSettings?.trainingMode) {
      return;
    }

    if (modelLoadStatus !== 'loaded' || !tensorFlowDetectorRef.current) {
      return;
    }

    const runDetection = async () => {
      if (!videoRef.current || !tensorFlowDetectorRef.current) {
        return;
      }

      try {
        const detections = await tensorFlowDetectorRef.current.detect(
          videoRef.current,
          aiSettings?.detectionZone,
          aiSettings?.classFilters
        );
        
        if (detections.length > 0) {
          detections.forEach(detection => {
            handleNewDetection(detection);
          });
        }
      } catch (error) {
      }

      detectionLoopRef.current = window.requestAnimationFrame(runDetection);
    };

    detectionLoopRef.current = window.requestAnimationFrame(runDetection);

    return () => {
      if (detectionLoopRef.current !== null) {
        cancelAnimationFrame(detectionLoopRef.current);
        detectionLoopRef.current = null;
      }
    };
  }, [videoRef, aiSettings?.enabled, aiSettings?.mockDetectionMode, aiSettings?.trainingMode, modelLoadStatus]);

  // Auto-start/stop based on mock detection mode
  useEffect(() => {
    if (aiSettings?.mockDetectionMode && !isActive) {
      startDetection();
    } else if (!aiSettings?.mockDetectionMode && isActive) {
      stopDetection();
    }
  }, [aiSettings?.mockDetectionMode]);

  const handleNewDetection = useCallback((detection: Detection) => {
    // Add to active detections
    addDetection(detection);
    setDetectionCount(prev => prev + 1);
    
    // Set as pending detection
    setPendingDetection(detection);
    
    // Auto-remove after 5 seconds if no action taken
    if (pendingTimeoutRef.current) {
      clearTimeout(pendingTimeoutRef.current);
    }
    
    pendingTimeoutRef.current = window.setTimeout(() => {
      handleAccept(detection);
    }, 5000);
    
    // Check for clearance alerts
    if (aiSettings?.clearanceAlerts && detection.metadata?.clearance) {
      const clearance = detection.metadata.clearance;
      
      if (clearance < 4.0) {
        // Critical clearance
        soundManager.playCritical();
      } else if (clearance < 4.2) {
        // Warning clearance
        soundManager.playWarning();
      }
    }
  }, [addDetection, setPendingDetection, aiSettings]);

  const handleAccept = useCallback(async (detection: Detection) => {
    // Clear timeout
    if (pendingTimeoutRef.current) {
      clearTimeout(pendingTimeoutRef.current);
      pendingTimeoutRef.current = null;
    }
    
    // Accept in store
    acceptDetection(detection.id);
    clearPendingDetection();
    
    // Auto-log if enabled (only in counter detection mode, not manual)
    if (aiSettings?.autoLogging) {
      await logDetectionToMeasurement(detection, 'accepted');
    }
    
    // PERFORMANCE: Removed toast notification (sound is sufficient)
    soundManager.playLogEntry();
  }, [acceptDetection, clearPendingDetection, aiSettings]);

  const handleReject = useCallback((detection: Detection) => {
    // Clear timeout
    if (pendingTimeoutRef.current) {
      clearTimeout(pendingTimeoutRef.current);
      pendingTimeoutRef.current = null;
    }
    
    // Reject in store
    rejectDetection(detection.id);
    clearPendingDetection();
  }, [rejectDetection, clearPendingDetection]);

  const handleCorrect = useCallback((detection: Detection) => {
    // Show correction dialog
    setCurrentDetection(detection);
    setShowCorrectionDialog(true);
  }, []);

  const handleCorrectionSubmit = useCallback(async (correctedClass: string) => {
    if (!currentDetection) return;
    
    // Clear timeout
    if (pendingTimeoutRef.current) {
      clearTimeout(pendingTimeoutRef.current);
      pendingTimeoutRef.current = null;
    }
    
    // Update POI selector to match correction
    setPOIType(correctedClass as any);
    
    // Correct in store
    correctDetection(currentDetection.id, correctedClass);
    clearPendingDetection();
    
    // Auto-log with corrected class if enabled
    if (aiSettings?.autoLogging) {
      await logDetectionToMeasurement(currentDetection, 'corrected', correctedClass);
    }
    
    // Close dialog
    setShowCorrectionDialog(false);
    setCurrentDetection(null);
    
    // Play confirmation sound
    soundManager.playLogEntry();
  }, [currentDetection, correctDetection, clearPendingDetection, setPOIType, aiSettings]);

  const logDetectionToMeasurement = async (
    detection: Detection,
    status: 'accepted' | 'corrected',
    correctedClass?: string
  ) => {
    try {
      // CRITICAL: Don't auto-log if user is in manual mode
      const currentMode = localStorage.getItem('loggingMode') || 'manual';
      if (currentMode === 'manual') {
        return;
      }
      
      // Get current measurement data
      const distance = lastMeasurement && lastMeasurement !== '--' 
        ? parseFloat(lastMeasurement) 
        : detection.metadata?.distance || 0;
      
      // BUGFIX: Add ground reference (not subtract) - same as manual logging
      const height = distance + groundReferenceHeight;
      const finalClass = correctedClass || detection.objectClass;
      
      // CRITICAL: Enforce min/max height thresholds (same as manual logging)
      const alertSettings = useSettingsStore.getState().alertSettings;
      const minHeight = alertSettings?.thresholds?.minHeight || 4;
      const maxHeight = alertSettings?.thresholds?.maxHeight || 25;
      
      if (height < minHeight || height > maxHeight) {
        return; // Skip logging for out-of-range measurements
      }
      
      // Create measurement log entry with minimal required fields
      const measurement: any = {
        rel: height,
        latitude: gpsData?.latitude || 0,
        longitude: gpsData?.longitude || 0,
        altGPS: gpsData?.altitude || 0,
        speed: gpsData?.speed || 0,
        heading: gpsData?.course || 0,
        note: `${height.toFixed(2)}m${groundReferenceHeight > 0 ? `. Ground ref: ${groundReferenceHeight.toFixed(2)}m` : ''}${
          status === 'corrected' ? `. Corrected from ${detection.objectClass}` : ''
        }`,
        poi_type: finalClass,
        source: 'detection' as const,
      };
      
      // PERFORMANCE FIX: Use worker-based logging for off-thread, batched writes
      await logMeasurementViaWorker(measurement);
    } catch (error) {
    }
  };

  const startDetection = useCallback(() => {
    if (!mockGeneratorRef.current || isActive) return;
    
    mockGeneratorRef.current.start();
    setIsActive(true);
    setDetectionCount(0);
  }, [isActive]);

  const stopDetection = useCallback(() => {
    if (!mockGeneratorRef.current || !isActive) return;
    
    mockGeneratorRef.current.stop();
    setIsActive(false);
    
    // Clear pending timeout
    if (pendingTimeoutRef.current) {
      clearTimeout(pendingTimeoutRef.current);
      pendingTimeoutRef.current = null;
    }
    
    clearPendingDetection();
  }, [isActive, clearPendingDetection]);

  const triggerTestDetection = useCallback(() => {
    if (!mockGeneratorRef.current) {
      return;
    }
    
    const detection = mockGeneratorRef.current.generateManualDetection();
    handleNewDetection(detection);
  }, [handleNewDetection]);

  return {
    isActive,
    detectionCount,
    activeDetections,
    showCorrectionDialog,
    currentDetection,
    modelLoadStatus,
    modelError,
    handleAccept,
    handleReject,
    handleCorrect,
    handleCorrectionSubmit,
    setShowCorrectionDialog,
    startDetection,
    stopDetection,
    triggerTestDetection,
  };
};
