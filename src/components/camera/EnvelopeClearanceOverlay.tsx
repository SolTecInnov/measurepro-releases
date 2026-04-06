import React, { useState, useEffect, useRef } from 'react';
import { useEnvelopeStore } from '../../stores/envelopeStore';
import { useSerialStore } from '../../lib/stores/serialStore';
import { useCameraStore } from '../../lib/camera';
import { useLicenseCheck } from '../../hooks/useLicenseEnforcement';
import { AlertTriangle, CheckCircle, XCircle, Camera, Zap } from 'lucide-react';
import { useSurveyStore } from '../../lib/survey';
import { useMeasurementLogger } from '../../hooks/useMeasurementLogger';
import { useGPSStore } from '../../lib/stores/gpsStore';
import { captureFrameWithOverlay } from '../../lib/camera/capture';
import { toast } from 'sonner';

interface EnvelopeClearanceOverlayProps {
  videoWidth: number;
  videoHeight: number;
}

type ClearanceStatus = 'safe' | 'warning' | 'critical';
type MeasurementSource = 'laser' | 'zed2i';

interface ClearanceData {
  status: ClearanceStatus;
  measurement: number;
  vehicleHeight: number;
  clearance: number;
  deficit: number;
  source: MeasurementSource;
}

const EnvelopeClearanceOverlay: React.FC<EnvelopeClearanceOverlayProps> = ({
  videoWidth,
  videoHeight
}) => {
  const { settings, getActiveProfile, isMonitoring, logViolation: addViolationToStore } = useEnvelopeStore();
  const { lastMeasurement } = useSerialStore();
  const { cameraType, activeCamera, overlayOptions, overlayFields, videoMode } = useCameraStore();
  const { hasAccess: hasZED2iLicense } = useLicenseCheck('zed2i_support');
  const { activeSurvey } = useSurveyStore();
  const { data: gpsData } = useGPSStore();
  
  // PERFORMANCE FIX: Use worker-based measurement logging
  const { logMeasurement: logMeasurementViaWorker } = useMeasurementLogger();
  const [clearanceData, setClearanceData] = useState<ClearanceData | null>(null);
  const [displayData, setDisplayData] = useState<ClearanceData | null>(null);
  const displayTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Cooldown tracking to prevent duplicate logging
  const lastLoggedTimestamp = useRef<{ warning: number; critical: number }>({
    warning: 0,
    critical: 0
  });
  const COOLDOWN_MS = 5000; // 5 seconds cooldown

  // Determine measurement source - only use ZED 2i if camera instance available
  const useZED2i = cameraType === 'zed2i' && hasZED2iLicense && activeCamera !== null;

  // Calculate clearance status
  useEffect(() => {
    if (!settings.enabled || !settings.visualEnabled || !isMonitoring) {
      setClearanceData(null);
      return;
    }

    const activeProfile = getActiveProfile();
    if (!activeProfile) {
      setClearanceData(null);
      return;
    }

    let measurement: number;
    let measurementSource: MeasurementSource = 'laser';

    // Try ZED 2i depth sensing if available
    if (useZED2i && activeCamera) {
      // Use ZED 2i depth sensing for clearance measurement
      const measureWithZED2i = async () => {
        try {
          // Use shared camera instance from store
          if (!activeCamera.measureClearance) {
            throw new Error('ZED 2i clearance measurement not available');
          }

          // Convert profile height to meters if needed
          let vehicleHeight = activeProfile.height;
          let vehicleWidth = activeProfile.width || 2.5; // Default width
          let vehicleLength = activeProfile.length || 10; // Default length
          
          if (activeProfile.heightUnit === 'feet') {
            vehicleHeight = vehicleHeight * 0.3048;
          }

          const clearanceMeasurement = await activeCamera.measureClearance({
            width: vehicleWidth,
            height: vehicleHeight,
            length: vehicleLength,
          });

          // Use minimum clearance from ZED 2i
          measurement = clearanceMeasurement.minClearance;
          measurementSource = 'zed2i';

          // Calculate clearance status
          const { warningThreshold, criticalThreshold } = settings;
          const clearance = measurement;

          let status: ClearanceStatus;
          let deficit: number;

          if (clearance > warningThreshold) {
            status = 'safe';
            deficit = 0;
          } else if (clearance > criticalThreshold) {
            status = 'warning';
            deficit = warningThreshold - clearance;
          } else {
            status = 'critical';
            deficit = criticalThreshold - clearance;
          }

          setClearanceData({
            status,
            measurement,
            vehicleHeight,
            clearance,
            deficit,
            source: measurementSource,
          });
        } catch (error) {
          // Fall back to laser measurement
          measurementSource = 'laser';
        }
      };

      measureWithZED2i();
      return;
    }

    // Use laser meter measurement (standard mode)
    if (!lastMeasurement || lastMeasurement === '--') {
      setClearanceData(null);
      return;
    }

    // Parse measurement (assumed to be in meters)
    measurement = parseFloat(lastMeasurement);
    if (isNaN(measurement)) {
      setClearanceData(null);
      return;
    }

    // Convert profile height to meters if needed
    let vehicleHeight = activeProfile.height;
    if (activeProfile.heightUnit === 'feet') {
      vehicleHeight = vehicleHeight * 0.3048; // feet to meters
    }

    const { warningThreshold, criticalThreshold } = settings;

    // Calculate clearance (measurement minus vehicle height)
    const clearance = measurement - vehicleHeight;
    
    // Determine status
    let status: ClearanceStatus;
    let deficit: number;

    if (clearance > warningThreshold) {
      // Safe: clearance is above warning threshold
      status = 'safe';
      deficit = 0;
    } else if (clearance > criticalThreshold) {
      // Warning: clearance is between critical and warning thresholds
      status = 'warning';
      deficit = warningThreshold - clearance;
    } else {
      // Critical: clearance is below critical threshold
      status = 'critical';
      deficit = criticalThreshold - clearance;
    }

    setClearanceData({
      status,
      measurement,
      vehicleHeight,
      clearance,
      deficit,
      source: measurementSource,
    });

  }, [settings, isMonitoring, lastMeasurement, getActiveProfile, useZED2i]);

  // Update display data and reset timer when new clearance data arrives
  useEffect(() => {
    if (clearanceData) {
      // Update display data immediately when new clearance data arrives
      setDisplayData(clearanceData);
      
      // Clear any existing timer to reset the 4-second window
      if (displayTimerRef.current) {
        clearTimeout(displayTimerRef.current);
      }
      
      // Set new timer to clear display data after 4 seconds
      displayTimerRef.current = setTimeout(() => {
        setDisplayData(null);
        displayTimerRef.current = null;
      }, 4000);
    }
    // DO NOT clear timer in cleanup - let it run to completion
  }, [clearanceData]);

  // Cleanup timer only on unmount
  useEffect(() => {
    return () => {
      if (displayTimerRef.current) {
        clearTimeout(displayTimerRef.current);
        displayTimerRef.current = null;
      }
    };
  }, []);

  // Violation logging effect - automatically log warning/critical violations
  useEffect(() => {
    // Only log if we have clearance data and it's a violation
    if (!clearanceData || clearanceData.status === 'safe') {
      return;
    }

    // Must have an active survey to log
    if (!activeSurvey) {
      return;
    }

    const logViolation = async () => {
      const now = Date.now();
      const { status } = clearanceData;
      
      // Check cooldown - only log if enough time has passed since last violation of this severity
      if (status !== 'safe') {
        const lastLogged = lastLoggedTimestamp.current[status];
        if (now - lastLogged < COOLDOWN_MS) {
          return;
        }

        // Update cooldown timestamp
        lastLoggedTimestamp.current[status] = now;
      }

      try {

        // Get active vehicle profile
        const activeProfile = getActiveProfile();
        if (!activeProfile) {
          return;
        }

        // GPS data null guards - provide safe defaults when GPS unavailable
        const safeGpsData = gpsData || {
          latitude: 0,
          longitude: 0,
          altitude: 0,
          speed: 0,
          course: 0,
          satellites: 0,
          hdop: 0
        };

        // Capture camera image if available
        let imageUrl: string | undefined;
        let images: string[] | undefined;
        
        try {
          const videoElement = document.querySelector('video') as HTMLVideoElement;
          if (videoElement && videoElement.readyState >= 2) {
            const captureResult = await captureFrameWithOverlay(
              videoElement,
              {
                poi: `Envelope ${status.toUpperCase()}`,
                gps: {
                  latitude: safeGpsData.latitude || 0,
                  longitude: safeGpsData.longitude || 0,
                  altitude: safeGpsData.altitude || 0
                },
                height: `${(clearanceData.clearance ?? 0).toFixed(2)}m clearance`,
                course: safeGpsData.course || 0,
                time: new Date().toISOString(),
                surveyTitle: overlayFields.surveyTitle,
                projectNumber: overlayFields.projectNumber,
                surveyorName: overlayFields.surveyorName,
                poiNotes: overlayFields.poiNotes
              },
              overlayOptions,
              'image/jpeg'
            );
            
            imageUrl = captureResult.dataUrl;
            images = [captureResult.dataUrl];
          }
        } catch (captureError) {
          // Continue logging without image
        }

        // Get video timestamp if recording
        let videoTimestamp: number | null = null;
        if (videoMode) {
          try {
            const videoRecordingState = (await import('../../stores/videoRecordingStore')).useVideoRecordingStore.getState();
            if (videoRecordingState.isRecording) {
              videoTimestamp = videoRecordingState.getCurrentTimestamp();
            }
          } catch (videoError) {
          }
        }

        // Mile marker calculation - set to null if unavailable
        // Future enhancement: Calculate from route if available
        let mileMarker: number | null = null;
        // TODO: Calculate from route data when route enforcement is active

        // Format comprehensive note
        const note = [
          `ENVELOPE CLEARANCE ${status.toUpperCase()}`,
          `Vehicle: ${activeProfile.name}`,
          `Profile Height: ${(clearanceData.vehicleHeight ?? 0).toFixed(2)}m`,
          `Measured: ${(clearanceData.measurement ?? 0).toFixed(2)}m`,
          `Clearance: ${(clearanceData.clearance ?? 0).toFixed(2)}m`,
          status !== 'safe' ? `Deficit: ${(clearanceData.deficit ?? 0).toFixed(2)}m` : null,
          `Source: ${clearanceData.source.toUpperCase()}`,
          `Warning Threshold: ${(settings.warningThreshold ?? 0).toFixed(2)}m`,
          `Critical Threshold: ${(settings.criticalThreshold ?? 0).toFixed(2)}m`,
          (safeGpsData.speed || 0) > 0 ? `Speed: ${(safeGpsData.speed ?? 0).toFixed(1)} km/h` : null
        ].filter(Boolean).join(' | ');

        // Create measurement object with all required fields
        const measurement = {
          rel: clearanceData.clearance, // Store clearance value as measurement
          altGPS: safeGpsData.altitude || 0,
          latitude: safeGpsData.latitude || 0,
          longitude: safeGpsData.longitude || 0,
          utcDate: new Date().toISOString().split('T')[0],
          utcTime: new Date().toTimeString().split(' ')[0],
          speed: safeGpsData.speed || 0,
          heading: safeGpsData.course || 0,
          roadNumber: null, // Could be derived from route if available
          poiNumber: null, // Will be auto-assigned by addMeasurement
          note,
          createdAt: new Date().toISOString(),
          user_id: activeSurvey.id,
          source: 'detection' as const, // Automatic detection
          poi_type: 'envelope',
          imageUrl,
          images,
          videoTimestamp,
          // Additional metadata as widthMeasure/lengthMeasure for context
          widthMeasure: clearanceData.measurement, // Store raw measurement
          lengthMeasure: clearanceData.vehicleHeight, // Store vehicle height
          // GPS quality fields
          satellites: safeGpsData.satellites !== undefined ? safeGpsData.satellites : undefined,
          hdop: safeGpsData.hdop !== undefined ? safeGpsData.hdop : undefined,
          mileMarker
        };

        // PERFORMANCE FIX: Use worker-based logging for off-thread, batched writes
        await logMeasurementViaWorker(measurement);
        
        // Dispatch database change event to trigger MeasurementLog refresh
        window.dispatchEvent(new CustomEvent('dbchange'));
        
        // Also add to envelope store violations for EnvelopeSettings display
        addViolationToStore({
          id: measurement.id,
          timestamp: new Date().toISOString(),
          status,
          vehicleProfile: activeProfile.name,
          clearance: clearanceData.clearance,
          deficit: clearanceData.deficit,
          location: (safeGpsData.latitude || 0) !== 0 ? {
            latitude: safeGpsData.latitude || 0,
            longitude: safeGpsData.longitude || 0
          } : undefined,
          imageUrl,
          videoTimestamp,
          note
        });

        toast.success(`Envelope ${status} violation logged`, {
          description: `Clearance: ${clearanceData.clearance.toFixed(2)}m`
        });

      } catch (error) {
        toast.error('Failed to log envelope violation', {
          description: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    };

    logViolation();
  }, [clearanceData, activeSurvey, gpsData, settings, getActiveProfile, overlayOptions, overlayFields, videoMode, addViolationToStore]);

  // Don't render if monitoring is disabled or no data to display
  if (!settings.enabled || !settings.visualEnabled || !isMonitoring || !displayData) {
    return null;
  }

  const { status, measurement, vehicleHeight, clearance, deficit, source } = displayData;

  // Define colors and styles based on status
  const statusConfig = {
    safe: {
      color: 'rgb(34, 197, 94)', // green-500
      bgColor: 'rgba(34, 197, 94, 0.15)',
      borderColor: 'rgba(34, 197, 94, 0.5)',
      icon: CheckCircle,
      label: 'SAFE',
      glow: 'rgba(34, 197, 94, 0.3)'
    },
    warning: {
      color: 'rgb(234, 179, 8)', // yellow-500
      bgColor: 'rgba(234, 179, 8, 0.15)',
      borderColor: 'rgba(234, 179, 8, 0.5)',
      icon: AlertTriangle,
      label: 'WARNING',
      glow: 'rgba(234, 179, 8, 0.3)'
    },
    critical: {
      color: 'rgb(239, 68, 68)', // red-500
      bgColor: 'rgba(239, 68, 68, 0.15)',
      borderColor: 'rgba(239, 68, 68, 0.5)',
      icon: XCircle,
      label: 'CRITICAL',
      glow: 'rgba(239, 68, 68, 0.3)'
    }
  };

  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <div 
      className="absolute inset-0 pointer-events-none z-30"
      style={{ width: videoWidth, height: videoHeight }}
    >
      {/* Top border indicator */}
      <div 
        className={`absolute top-0 left-0 right-0 h-1 ${status === 'critical' ? 'animate-pulse' : ''}`}
        style={{ 
          backgroundColor: config.color,
          boxShadow: `0 0 20px ${config.glow}`
        }}
      />

      {/* Clearance zone visualization - top third of screen */}
      <div 
        className="absolute top-0 left-0 right-0"
        style={{ 
          height: '33%',
          backgroundColor: config.bgColor,
          border: `2px solid ${config.borderColor}`,
          borderTop: 'none'
        }}
      />

      {/* Status indicator - top right */}
      <div 
        className={`absolute top-4 right-4 px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 ${
          status === 'critical' ? 'animate-pulse' : ''
        }`}
        style={{ 
          backgroundColor: config.bgColor,
          border: `2px solid ${config.borderColor}`,
          color: config.color,
          boxShadow: `0 0 15px ${config.glow}`
        }}
      >
        <Icon className="w-5 h-5" />
        <span>{config.label}</span>
      </div>

      {/* Measurement source indicator - below status */}
      <div 
        className="absolute top-16 right-4 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2"
        style={{ 
          backgroundColor: source === 'zed2i' ? 'rgba(6, 182, 212, 0.2)' : 'rgba(100, 116, 139, 0.2)',
          border: `1px solid ${source === 'zed2i' ? 'rgb(6, 182, 212)' : 'rgb(100, 116, 139)'}`,
          color: source === 'zed2i' ? 'rgb(6, 182, 212)' : 'rgb(148, 163, 184)'
        }}
        data-testid="measurement-source-indicator"
      >
        {source === 'zed2i' ? (
          <>
            <Camera className="w-4 h-4" />
            <span>Using ZED 2i Depth Sensing</span>
          </>
        ) : (
          <>
            <Zap className="w-4 h-4" />
            <span>Using Laser Meter</span>
          </>
        )}
      </div>

      {/* Clearance data - top left */}
      <div 
        className="absolute top-4 left-4 px-3 py-2 rounded-lg text-xs font-mono"
        style={{ 
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          border: `1px solid ${config.borderColor}`,
          color: config.color
        }}
        data-testid="clearance-data-display"
      >
        <div className="flex flex-col gap-1">
          <div>Measurement: {measurement.toFixed(2)}m</div>
          <div>Vehicle: {vehicleHeight.toFixed(2)}m</div>
          <div>Clearance: {clearance.toFixed(2)}m</div>
          {deficit > 0 && (
            <div className="font-bold">
              Deficit: {deficit.toFixed(2)}m
            </div>
          )}
        </div>
      </div>

      {/* Bottom border indicator */}
      <div 
        className={`absolute bottom-0 left-0 right-0 h-1 ${status === 'critical' ? 'animate-pulse' : ''}`}
        style={{ 
          backgroundColor: config.color,
          boxShadow: `0 0 20px ${config.glow}`
        }}
      />
    </div>
  );
};

export default EnvelopeClearanceOverlay;
