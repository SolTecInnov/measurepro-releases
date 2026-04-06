import React, { useState, useRef, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { toast } from 'sonner';
import { useGPSStore } from '../lib/stores/gpsStore';
import { useSerialStore } from '../lib/stores/serialStore';
import { useSurveyStore } from '../lib/survey';
import { usePOIStore, POI_TYPES, type POIType, MEASUREMENT_FREE_POI_TYPES, shouldRecordHeightClearance } from '../lib/poi';
import { usePOIActionsStore } from '../lib/poiActions';
import { useLayoutCustomization } from '../hooks/useLayoutCustomization';
import { useMeasurementLogging } from '../hooks/useMeasurementLogging';
import { useMeasurementLogger } from '../hooks/useMeasurementLogger';
import { soundManager } from '../lib/sounds';
import { useSettingsStore } from '../lib/settings';
import { deleteLastMeasurement } from '../lib/survey/measurements';
import type { Measurement } from '../lib/survey/types';
import { deleteDetectionImage } from '../lib/storage/detection-storage';
import { useEnabledFeatures } from '../hooks/useLicenseEnforcement';
import { isBetaUser } from '../lib/auth/masterAdmin';
import { getAuth } from 'firebase/auth';
import { Trash2, Camera, Layers } from 'lucide-react';
import { useCameraStore, type CameraPosition } from '../lib/camera';
import { useLidarService } from '../hooks/useLidarService';
import { ClearanceHUD } from '../components/lidar/ClearanceHUD';

// Import components
import AppHeader from '../components/AppHeader';
const VehicleMap = React.lazy(() => import('../components/VehicleMap'));
import MeasurementCards from '../components/MeasurementCards';
import LoggingControls from '../components/LoggingControls';
import SurveyManager from '../components/SurveyManager';
import GPSData from '../components/GPSData';
import MeasurementLog from '../components/MeasurementLog';
import LiveCamera from '../components/LiveCamera';
import CapturedImages from '../components/CapturedImages';
import TabManager from '../components/TabManager';
import { TimelapseCard } from '../components/TimelapseCard';
import ColumnResizer from '../components/ColumnResizer';
import { WifiStatusDialog, DatabaseStatusDialog } from '../components/StatusDialogs';
import { CardWrapper } from '../components/CardWrapper';
import KeyboardShortcutHandler from '../components/KeyboardShortcutHandler';
import VoiceCommandBridge from '../components/VoiceCommandBridge';
import MeasurementModeSelector from '../components/measurement/MeasurementModeSelector';
import MeasurementControls from '../components/measurement/MeasurementControls';
import POIHeightRow from '../components/POIHeightRow';
import EditMeasurementModal from '../components/EditMeasurementModal';
import VoiceNotePOIModal from '../components/VoiceNotePOIModal';
import GNSSStatusCard from '../components/gnss/GNSSStatusCard';
import RoadProfileCard from '../components/gnss/RoadProfileCard';
import { useLateralRearCaptureHandler } from '../hooks/useLateralRearCaptureHandler';
import LateralWidthDisplay from '../components/LateralWidthDisplay';
import RearOverhangDisplay from '../components/RearOverhangDisplay';
import CameraErrorBanner from '../components/CameraErrorBanner';
import CameraHUD from '../components/CameraHUD';
import { useCameraControl } from '../hooks/useCameraControl';

/**
 * Calculate haversine distance between two GPS coordinates
 * @param lat1 - Latitude of point 1 (degrees)
 * @param lon1 - Longitude of point 1 (degrees)
 * @param lat2 - Latitude of point 2 (degrees)
 * @param lon2 - Longitude of point 2 (degrees)
 * @returns Distance in meters
 */
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  return R * c; // Distance in meters
}

/**
 * Calculate next rel (longitudinal distance) value for measurement
 * Gets last measurement's rel and adds GPS distance from last position
 * Uses direct IndexedDB transaction to avoid mutating pagination state
 * @param surveyId - Active survey ID
 * @param currentLat - Current GPS latitude
 * @param currentLon - Current GPS longitude
 * @returns rel value in meters
 */
async function calculateNextRel(surveyId: string, currentLat: number, currentLon: number): Promise<number> {
  try {
    const { openSurveyDB } = await import('@/lib/survey/db');
    const db = await openSurveyDB();
    
    // Direct IndexedDB transaction (avoids pagination state mutation)
    // Use by-date index in reverse to efficiently find latest survey measurement
    const tx = db.transaction('measurements', 'readonly');
    const dateIndex = tx.store.index('by-date');
    
    // Walk by-date index in reverse (newest first) until we find this survey's latest entry
    let lastMeasurement: any = null;
    let cursor = await dateIndex.openCursor(null, 'prev');
    
    while (cursor) {
      // Check if this measurement belongs to the active survey
      if (cursor.value.user_id === surveyId) {
        lastMeasurement = cursor.value;
        break; // Found the last measurement for THIS survey
      }
      cursor = await cursor.continue();
    }
    
    await tx.done;
    
    if (!lastMeasurement) {
      return 0; // First measurement in survey
    }
    
    // Guard against missing coordinates (common in counter-detection entries)
    if (!lastMeasurement.latitude || !lastMeasurement.longitude ||
        typeof lastMeasurement.latitude !== 'number' || 
        typeof lastMeasurement.longitude !== 'number') {
      // Fallback: increment from last rel (small increment to maintain monotonicity)
      return (lastMeasurement.rel || 0) + 0.01;
    }
    
    // Guard against invalid current coordinates
    if (!currentLat || !currentLon || typeof currentLat !== 'number' || typeof currentLon !== 'number') {
      // Fallback: increment from last rel (small increment to maintain monotonicity)
      return (lastMeasurement.rel || 0) + 0.01;
    }
    
    // Calculate distance from last measurement
    const distanceFromLast = haversineDistance(
      lastMeasurement.latitude,
      lastMeasurement.longitude,
      currentLat,
      currentLon
    );
    
    // Ensure distance is a valid number
    if (!Number.isFinite(distanceFromLast)) {
      // Fallback: increment from last rel (small increment to maintain monotonicity)
      return (lastMeasurement.rel || 0) + 0.01;
    }
    
    return (lastMeasurement.rel || 0) + distanceFromLast;
  } catch (error) {
    console.error('Error calculating next rel:', error);
    return 0; // Fallback to 0 if calculation fails
  }
}

const Settings: React.FC = () => {
  // State management
  const [activeTab, setActiveTab] = useState('home');

  // Listen for Electron Settings menu tab navigation
  useEffect(() => {
    const handler = (e: Event) => {
      const { tab } = (e as CustomEvent).detail;
      if (tab) setActiveTab(tab);
    };
    window.addEventListener('electron-open-tab', handler);
    return () => window.removeEventListener('electron-open-tab', handler);
  }, []);
  const [showSurveyDialog, setShowSurveyDialog] = useState(false);
  const [pendingPhotos, setPendingPhotos] = useState<string[]>([]);
  const [capturedData, setCapturedData] = useState<any[]>([]);
  const [offlineItems, setOfflineItems] = useState(0);
  const [showWifiStatus, setShowWifiStatus] = useState(false);
  const [showDatabaseStatus, setShowDatabaseStatus] = useState(false);
  const [wifiStatus] = useState<'good' | 'poor' | 'none'>('good');
  const [showThreeColumns, setShowThreeColumns] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(() => {
    return useSettingsStore.getState().uiSettings.appZoomLevel;
  });
  const [editingMeasurement, setEditingMeasurement] = useState<Measurement | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [measurementCount, setMeasurementCount] = useState(0);
  const [lidarHudEnabled, setLidarHudEnabled] = useState<boolean>(() => {
    return useSettingsStore.getState().uiSettings.lidarHudEnabled;
  });

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);

  // Store hooks
  const { data: gpsData } = useGPSStore();
  const { lastMeasurement } = useSerialStore();
  const { activeSurvey } = useSurveyStore();
  const { selectedType, setSelectedType } = usePOIStore();
  useSettingsStore(); // Settings store initialization
  const { hasFeature, features } = useEnabledFeatures();
  
  // Initialize 360° camera control (polling, error banner, HUD)
  useCameraControl();

  // LiDAR service (only active when HUD is enabled)
  const lidar = useLidarService();
  
  // Beta user detection for UI simplification
  const auth = getAuth();
  const isBeta = isBetaUser(auth.currentUser, features);
  
  // Initialize worker-based measurement logger (PERFORMANCE CRITICAL)
  const { logMeasurement: logMeasurementViaWorker } = useMeasurementLogger();

  // Track measurement count for delete button
  useEffect(() => {
    const updateMeasurementCount = async () => {
      if (activeSurvey) {
        const { openSurveyDB } = await import('../lib/survey/db');
        const db = await openSurveyDB();
        const measurements = await db.getAllFromIndex('measurements', 'by-survey', activeSurvey.id);
        setMeasurementCount(measurements.length);
      } else {
        setMeasurementCount(0);
      }
    };

    updateMeasurementCount();
    
    // Listen for database changes
    const handleDBChange = () => updateMeasurementCount();
    window.addEventListener('dbchange', handleDBChange);
    
    return () => window.removeEventListener('dbchange', handleDBChange);
  }, [activeSurvey]);

  // Layout customization
  const { 
    leftColumnWidth, 
    setLeftColumnWidth, 
    getCardsForColumn,
    toggleCardCollapsed,
    layoutConfig
  } = useLayoutCustomization();

  // Detect mobile device
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkIfMobile = () => {
      const mobile = window.innerWidth <= 768 || 
                   /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      setIsMobile(mobile);
    };
    
    checkIfMobile();
    window.addEventListener('resize', checkIfMobile);
    return () => window.removeEventListener('resize', checkIfMobile);
  }, []);

  // Detect screen size for responsive layout
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 1024);
  useEffect(() => {
    const checkScreenSize = () => {
      setIsDesktop(window.innerWidth >= 1024);
    };
    
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  // Apply zoom level
  useEffect(() => {
    document.body.style.zoom = `${zoomLevel}%`;
    useSettingsStore.getState().setUISettings({ appZoomLevel: zoomLevel });
  }, [zoomLevel]);

  // Capture image function
  // STEP 1 FIX: Return Promise to enable synchronous return value from both buffered AND live capture
  const handleCaptureImage = React.useCallback(async (): Promise<string | null> => {
    if (!videoRef.current) return null;
    
    const { captureFrameWithOverlay } = await import('@/lib/camera/capture');
    const { overlayOptions, overlayFields } = useCameraStore.getState();
    
    // Generate POI ID
    const poiId = activeSurvey ? `R001-${String(Math.floor(Math.random() * 10000)).padStart(5, '0')}` : '#---';
    
    // Build overlay data with all survey info
    const overlayData = {
      poi: poiId,
      time: new Date().toISOString(),
      gps: { latitude: gpsData.latitude, longitude: gpsData.longitude, altitude: gpsData.altitude },
      height: lastMeasurement !== '--' ? lastMeasurement : '--',
      course: gpsData.course,
      surveyTitle: overlayFields.surveyTitle || activeSurvey?.surveyTitle || activeSurvey?.name || '',
      projectNumber: overlayFields.projectNumber || activeSurvey?.projectNumber || '',
      surveyorName: overlayFields.surveyorName || activeSurvey?.surveyorName || activeSurvey?.surveyor || '',
      poiNotes: overlayFields.poiNotes || '',
    };
    
    try {
      // Use captureFrameWithOverlay to bake the overlay into the image
      const result = await captureFrameWithOverlay(
        videoRef.current,
        overlayData,
        overlayOptions,
        'image/jpeg'
      );
      
      const imageUrl = result.dataUrl;
      
      // Add to pending photos
      setPendingPhotos(prev => [...prev, imageUrl]);
      
      // Play image captured sound
      soundManager.playImageCaptured();
      
      // Add to captured data with overlay information (for display, though overlay is already baked in)
      setCapturedData(prev => [...prev, { 
        imageUrl, 
        overlayData: {
          poi: poiId,
          time: new Date().toISOString(),
          gps: { latitude: gpsData.latitude, longitude: gpsData.longitude },
          height: lastMeasurement !== '--' ? lastMeasurement : '--',
          course: gpsData.course
        }
      }]);
      
      return imageUrl;
    } catch (error) {
      console.error('Failed to capture image with overlay:', error);
      return null;
    }
  }, [activeSurvey, gpsData.latitude, gpsData.longitude, gpsData.altitude, gpsData.course, lastMeasurement]);

  // Position-based camera capture for lateral/rear POIs
  const captureFromPositionCamera = React.useCallback(async (position: CameraPosition): Promise<string | null> => {
    const { getCameraForPosition, selectedCamera, multiCameraSettings } = useCameraStore.getState();
    const targetDeviceId = getCameraForPosition(position);
    
    // Determine the active camera (what's currently streaming in videoRef)
    const activeCamera = selectedCamera || multiCameraSettings.front;
    
    // If target camera is the same as the active camera, or no specific camera configured, use main capture
    const useMainCamera = !targetDeviceId || targetDeviceId === activeCamera;
    
    if (useMainCamera) {
      console.log(`[LateralRear] Using main camera for ${position} capture`);
      return handleCaptureImage?.() || null;
    }
    
    // Create a temporary stream from the position-specific camera
    let stream: MediaStream | null = null;
    let tempVideo: HTMLVideoElement | null = null;
    
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: targetDeviceId } }
      });
      
      // Create temporary video element
      tempVideo = document.createElement('video');
      tempVideo.srcObject = stream;
      tempVideo.muted = true;
      await tempVideo.play();
      
      // Wait for video to be ready
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Capture frame
      const canvas = document.createElement('canvas');
      canvas.width = tempVideo.videoWidth || 1280;
      canvas.height = tempVideo.videoHeight || 720;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Failed to get canvas context');
      }
      ctx.drawImage(tempVideo, 0, 0, canvas.width, canvas.height);
      
      const imageUrl = canvas.toDataURL('image/jpeg', 0.92);
      console.log(`[LateralRear] Captured from ${position} camera:`, targetDeviceId.substring(0, 8));
      return imageUrl;
    } catch (error) {
      console.warn(`[LateralRear] Failed to capture from ${position} camera, falling back to main:`, error);
      // Fall back to main camera
      return handleCaptureImage?.() || null;
    } finally {
      // Always clean up resources
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      if (tempVideo) {
        tempVideo.srcObject = null;
      }
    }
  }, [handleCaptureImage]);

  // Lateral/rear laser POI capture callback - integrates with measurement logging pipeline
  // MUST be defined after handleCaptureImage and logMeasurementViaWorker to avoid TDZ errors
  const handleLateralRearCapturePOI = React.useCallback(async (poiData: {
    type: 'lateralObstruction';
    subType: 'leftLateral' | 'rightLateral' | 'totalWidth' | 'rearOverhang';
    measurement: number | null;
    leftClearance?: number | null;
    rightClearance?: number | null;
    totalWidth?: number | null;
    rearDistance?: number | null;
    timestamp: number;
    cameraPosition: CameraPosition;
  }) => {
    if (!activeSurvey) {
      toast.warning('No active survey - measurement not logged');
      return;
    }

    try {
      // Capture image from the position-specific camera
      const imageUrl = await captureFromPositionCamera(poiData.cameraPosition);
      await new Promise(resolve => setTimeout(resolve, 200));

      const { getNextPOINumber } = await import('@/lib/survey/measurements');
      const nextPoiNumber = await getNextPOINumber(activeSurvey.id);
      const relValue = await calculateNextRel(activeSurvey.id, gpsData.latitude, gpsData.longitude);

      // Map subType to readable label
      const subTypeLabels: Record<string, string> = {
        leftLateral: 'Left Lateral',
        rightLateral: 'Right Lateral',
        totalWidth: 'Total Width',
        rearOverhang: 'Rear Overhang',
      };
      const label = subTypeLabels[poiData.subType] || poiData.subType;

      const newMeasurement = {
        id: crypto.randomUUID(),
        rel: relValue,
        altGPS: gpsData.altitude,
        latitude: gpsData.latitude,
        longitude: gpsData.longitude,
        utcDate: new Date().toISOString().split('T')[0],
        utcTime: new Date().toTimeString().split(' ')[0],
        speed: gpsData.speed,
        heading: gpsData.course,
        roadNumber: 1,
        poiNumber: nextPoiNumber,
        poi_type: poiData.type,
        imageUrl: imageUrl || undefined,
        images: imageUrl ? [imageUrl] : [],
        note: `${label}: ${poiData.measurement?.toFixed(2) ?? 'N/A'}m`,
        createdAt: new Date().toISOString(),
        user_id: activeSurvey.id,
        source: 'manual' as const,
        // Lateral/rear specific fields
        lateralSubType: poiData.subType,
        leftClearance: poiData.leftClearance ?? null,
        rightClearance: poiData.rightClearance ?? null,
        totalWidth: poiData.totalWidth ?? null,
        rearDistance: poiData.rearDistance ?? null,
      };

      await logMeasurementViaWorker(newMeasurement);

      // Add to timelapse if image captured
      if (imageUrl && newMeasurement) {
        const { addPOIFrameToTimelapse } = await import('@/lib/timelapse/poiIntegration');
        const { updateMeasurement } = await import('@/lib/survey/measurements');
        const frameNumber = await addPOIFrameToTimelapse(imageUrl, newMeasurement);
        if (frameNumber !== null) {
          await updateMeasurement(newMeasurement.id, { timelapseFrameNumber: frameNumber });
        }
      }

      toast.success(`${label} POI logged!`, {
        description: `POI ${newMeasurement.id.substring(0, 8)} - ${poiData.measurement?.toFixed(2) ?? 'N/A'}m`
      });
    } catch (error) {
      console.error('[LateralRear] Failed to log POI:', error);
      toast.error('Failed to log lateral/rear POI');
    }
  }, [activeSurvey, gpsData, captureFromPositionCamera, logMeasurementViaWorker]);

  // Lateral/rear laser capture handler (registers event listeners for keyboard shortcuts)
  useLateralRearCaptureHandler({ onCapturePOI: handleLateralRearCapturePOI });

  // Clear all captured images
  const clearCapturedImages = React.useCallback(() => {
    setPendingPhotos([]);
    setCapturedData([]);
  }, []);

  // Modal state for manual log entry
  const [showManualLogModal, setShowManualLogModal] = useState(false);
  const [preSelectedPOIType, setPreSelectedPOIType] = useState<POIType | null>(null);
  
  // Voice note modal state
  const [showVoiceNoteModal, setShowVoiceNoteModal] = useState(false);
  const [voiceNoteCapturedImage, setVoiceNoteCapturedImage] = useState<string | null>(null);
  // GPS snapshot taken at the moment recording starts (not at save time)
  const [voiceNoteStartGPS, setVoiceNoteStartGPS] = useState<{
    latitude: number;
    longitude: number;
    altitude: number;
    speed: number;
    course: number;
  } | null>(null);

  const handleAutoCaptureAndLog = React.useCallback(async (measurementData: number | number[]) => {
    if (!activeSurvey) {
      // Survey may have just auto-split — try to get the latest active survey
      const { useSurveyStore } = await import('@/lib/survey');
      const currentSurvey = useSurveyStore.getState().activeSurvey;
      if (!currentSurvey) {
        toast.error('No active survey', { description: 'Create a survey before logging POI.' });
        return;
      }
    }

    const currentSelectedType = usePOIStore.getState().selectedType;
    if (!currentSelectedType) {
      toast.warning('No POI type selected', { description: 'Select a POI type first (Stream Deck or keyboard shortcut).' });
      return;
    }

    // NOTE: Action check removed — caller already verified action type.
    // Double-checking here caused silent failures when localStorage config was stale.
    // If called, we always proceed with auto-capture-and-log behavior.

    const measurements = Array.isArray(measurementData) ? measurementData : [measurementData];
    if (measurements.length === 0) return;

    const { useLaserStore } = await import('@/lib/laser');
    const groundRef = useLaserStore.getState().groundReferenceHeight || 0;
    const thresholds = useSettingsStore.getState().alertSettings?.thresholds;
    const minH = thresholds?.minHeight ?? 0;
    const maxH = thresholds?.maxHeight ?? 99;

    const validMeasurements = measurements
      .map(m => parseFloat((m + groundRef).toFixed(2)))
      .filter(adjusted => adjusted >= minH && adjusted <= maxH);

    if (validMeasurements.length === 0) return;

    const poiTypeConfig = POI_TYPES.find(p => p.type === currentSelectedType);
    const poiTypeLabel = poiTypeConfig?.label || currentSelectedType;

    let relValue: number;
    let noteText: string;
    const isMulti = Array.isArray(measurementData) && measurementData.length > 1;

    if (isMulti) {
      relValue = Math.min(...validMeasurements);
      const readingsStr = validMeasurements.map(v => `${v.toFixed(2)}m`).join(', ');
      noteText = `Readings: ${readingsStr} | Min: ${relValue.toFixed(2)}m | GND REF: ${groundRef.toFixed(2)}m | ${poiTypeLabel}`;
    } else {
      relValue = validMeasurements[0];
      noteText = `Height: ${relValue.toFixed(2)}m | GND REF: ${groundRef.toFixed(2)}m | ${poiTypeLabel}`;
    }

    let savedSuccessfully = false;
    let imageUrl: string | null = null;
    let newMeasurement: any = null;

    try {
      imageUrl = await handleCaptureImage();
      await new Promise(resolve => setTimeout(resolve, 300));

      const { getNextPOINumber } = await import('@/lib/survey/measurements');
      const nextPoiNumber = await getNextPOINumber(activeSurvey.id);

      newMeasurement = {
        id: crypto.randomUUID(),
        rel: parseFloat(relValue.toFixed(2)),
        altGPS: gpsData.altitude,
        latitude: gpsData.latitude,
        longitude: gpsData.longitude,
        utcDate: new Date().toISOString().split('T')[0],
        utcTime: new Date().toTimeString().split(' ')[0],
        speed: gpsData.speed,
        heading: gpsData.course,
        roadNumber: 1,
        poiNumber: nextPoiNumber,
        poi_type: currentSelectedType,
        imageUrl: imageUrl || undefined,
        images: imageUrl ? [imageUrl] : [],
        note: noteText,
        createdAt: new Date().toISOString(),
        user_id: activeSurvey.id,
        source: 'manual' as const,
        measurementFree: false
      };

      await logMeasurementViaWorker(newMeasurement);
      savedSuccessfully = true;
    } catch (error) {
      toast.error('Failed to log POI', {
        description: 'Database error - please try again'
      });
      return;
    }

    if (savedSuccessfully) {
      try {
        if (imageUrl && newMeasurement) {
          const { addPOIFrameToTimelapse } = await import('@/lib/timelapse/poiIntegration');
          const { updateMeasurement } = await import('@/lib/survey/measurements');
          const frameNumber = await addPOIFrameToTimelapse(imageUrl, newMeasurement);
          
          if (frameNumber !== null) {
            await updateMeasurement(newMeasurement.id, { timelapseFrameNumber: frameNumber });
          }
        }

        setPendingPhotos([]);
        setCapturedData([]);
        
        toast.success(`${poiTypeLabel} logged!`, {
          description: `POI ${newMeasurement.id.substring(0, 8)} captured and saved`
        });

        soundManager.playInterface();
      } catch (uiError) {
      }
    }
  }, [activeSurvey, handleCaptureImage, gpsData]);

  // Auto-capture without measurement (for measurement-free types: gradeUp, gradeDown, autoturnRequired)
  const handleAutoCaptureNoMeasurement = React.useCallback(async () => {
    if (!activeSurvey) {
      toast.error('No active survey', {
        description: 'Please create a survey before logging POI.'
      });
      return;
    }

    // Read POI type directly from the store — same stale-closure fix as handleAutoCaptureAndLog
    const currentSelectedType = usePOIStore.getState().selectedType;

    let savedSuccessfully = false;
    let poiTypeLabel = '';
    let nextPoiNumber = 0;
    let imageUrl: string | null = null;
    let newMeasurement: any = null;

    try {
      imageUrl = await handleCaptureImage();
      await new Promise(resolve => setTimeout(resolve, 300));

      const poiTypeConfig = POI_TYPES.find(p => p.type === currentSelectedType);
      poiTypeLabel = poiTypeConfig?.label || currentSelectedType;

      const { getNextPOINumber } = await import('@/lib/survey/measurements');
      nextPoiNumber = await getNextPOINumber(activeSurvey.id);

      newMeasurement = {
        id: crypto.randomUUID(),
        rel: null,
        altGPS: gpsData.altitude,
        latitude: gpsData.latitude,
        longitude: gpsData.longitude,
        utcDate: new Date().toISOString().split('T')[0],
        utcTime: new Date().toTimeString().split(' ')[0],
        speed: gpsData.speed,
        heading: gpsData.course,
        roadNumber: 1,
        poiNumber: nextPoiNumber,
        poi_type: currentSelectedType,
        imageUrl: imageUrl || undefined,
        images: imageUrl ? [imageUrl] : [],
        note: poiTypeLabel,
        createdAt: new Date().toISOString(),
        user_id: activeSurvey.id,
        source: 'manual' as const,
        measurementFree: true
      };

      // PERFORMANCE FIX: Use worker-based logging for off-thread, batched writes
      await logMeasurementViaWorker(newMeasurement);
      savedSuccessfully = true;
    } catch (error) {
      toast.error('Failed to log POI', {
        description: 'Database error - please try again'
      });
      return;
    }

    // UI updates after successful save
    if (savedSuccessfully) {
      try {
        // Add POI image to timelapse if an image was captured
        if (imageUrl && newMeasurement) {
          const { addPOIFrameToTimelapse } = await import('@/lib/timelapse/poiIntegration');
          const { updateMeasurement } = await import('@/lib/survey/measurements');
          const frameNumber = await addPOIFrameToTimelapse(imageUrl, newMeasurement);
          
          if (frameNumber !== null) {
            await updateMeasurement(newMeasurement.id, { timelapseFrameNumber: frameNumber });
          }
        }

        setPendingPhotos([]);
        setCapturedData([]);
        
        toast.success(`${poiTypeLabel} logged!`, {
          description: `POI ${newMeasurement.id.substring(0, 8)} captured (no measurement)`
        });

        soundManager.playInterface();
      } catch (uiError) {
      }
    }
  }, [selectedType, activeSurvey, handleCaptureImage, gpsData]);

  // Open modal with pre-selected POI type
  const handleOpenModalWithPOIType = React.useCallback((poiType: POIType) => {
    setPreSelectedPOIType(poiType);
    setShowManualLogModal(true);
  }, []);
  
  // Handle voice note request
  const handleVoiceNoteRequested = React.useCallback(async () => {
    // Snapshot GPS at the moment recording STARTS (position may change by the time user taps Save)
    setVoiceNoteStartGPS({
      latitude: gpsData.latitude,
      longitude: gpsData.longitude,
      altitude: gpsData.altitude,
      speed: gpsData.speed,
      course: gpsData.course,
    });
    
    // Capture an image first
    const imageUrl = await handleCaptureImage();
    setVoiceNoteCapturedImage(imageUrl);
    
    // Show the voice note modal
    setShowVoiceNoteModal(true);
  }, [handleCaptureImage, gpsData]);
  
  // Handle voice note save
  const handleVoiceNoteSave = React.useCallback(async (audioBlob: Blob | null) => {
    if (!activeSurvey) {
      toast.error('No active survey', {
        description: 'Please create a survey before logging POI.'
      });
      setVoiceNoteCapturedImage(null);
      setSelectedType('');
      return;
    }
    
    if (!audioBlob) {
      // User cancelled - just clean up
      setVoiceNoteCapturedImage(null);
      setVoiceNoteStartGPS(null);
      setPendingPhotos([]);
      setCapturedData([]);
      setSelectedType('');
      return;
    }
    
    try {
      // Save voice note to database
      const { VoiceNoteManager } = await import('../lib/voice/VoiceNoteManager');
      const voiceNoteManager = new VoiceNoteManager();
      
      // Get next POI number
      const { getNextPOINumber } = await import('@/lib/survey/measurements');
      const nextPoiNumber = await getNextPOINumber(activeSurvey.id);
      
      // Use GPS snapshot from the moment recording STARTED (not current position)
      const startGPS = voiceNoteStartGPS ?? {
        latitude: gpsData.latitude,
        longitude: gpsData.longitude,
        altitude: gpsData.altitude,
        speed: gpsData.speed,
        course: gpsData.course,
      };
      
      // Create the measurement/POI entry first
      // rel: null — voice notes have no height/distance measurement
      // measurementFree: true — prevents spurious height column value
      const newMeasurement = {
        id: crypto.randomUUID(),
        rel: null,
        measurementFree: true,
        altGPS: startGPS.altitude,
        latitude: startGPS.latitude,
        longitude: startGPS.longitude,
        utcDate: new Date().toISOString().split('T')[0],
        utcTime: new Date().toTimeString().split(' ')[0],
        speed: startGPS.speed,
        heading: startGPS.course,
        roadNumber: 1,
        poiNumber: nextPoiNumber,
        poi_type: 'voiceNote',
        imageUrl: voiceNoteCapturedImage || undefined,
        images: voiceNoteCapturedImage ? [voiceNoteCapturedImage] : [],
        note: 'Voice note POI',
        createdAt: new Date().toISOString(),
        user_id: activeSurvey.id,
        source: 'manual' as const
      };
      
      // PERFORMANCE FIX: Use worker-based logging for off-thread, batched writes
      await logMeasurementViaWorker(newMeasurement);
      
      // Save voice note linked to this measurement
      await voiceNoteManager.saveVoiceNote(newMeasurement.id, audioBlob, 'en-US');
      
      // Clean up
      setPendingPhotos([]);
      setCapturedData([]);
      setVoiceNoteCapturedImage(null);
      setVoiceNoteStartGPS(null);
      setOfflineItems(prev => prev + 1);
      
      // Reset POI type to None
      setSelectedType('');
      
      toast.success('Voice note POI logged!', {
        description: `POI ${newMeasurement.id.substring(0, 8)} with voice note saved`
      });
      
      soundManager.playInterface();
    } catch (error) {
      toast.error('Failed to save voice note POI', {
        description: 'Please try again'
      });
    }
  }, [activeSurvey, gpsData, voiceNoteCapturedImage, voiceNoteStartGPS, setSelectedType]);

  // Set alert status (for keyboard shortcuts)
  const [, setAlertStatus] = useState<'OK' | 'WARNING' | 'DANGER'>('OK');

  // Wrapper for POI type selection (keyboard shortcuts compatibility)
  const handleSetPOIType = React.useCallback((type: string) => {
    setSelectedType(type as any);
  }, [setSelectedType]);

  // Delete last measurement handler
  const handleDeleteLastEntry = React.useCallback(async () => {
    if (!activeSurvey) {
      toast.error('No active survey', {
        description: 'Please start a survey first'
      });
      return;
    }

    try {
      const deletedMeasurement = await deleteLastMeasurement(activeSurvey.id);
      
      // Play interface sound
      soundManager.playInterface();
      
      // Show success toast
      toast.success(`POI ${deletedMeasurement.id.substring(0, 8)} deleted`, {
        description: 'Measurement has been removed'
      });
    } catch (error) {
      toast.error('Failed to delete measurement', {
        description: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    }
  }, [activeSurvey]);

  // Edit measurement handler
  const handleEditMeasurement = React.useCallback((measurement: Measurement) => {
    setEditingMeasurement(measurement);
    setIsEditModalOpen(true);
  }, []);

  // Measurement logging hook
  const {
    loggingMode,
    isLogging,
    isPaused,
    setLoggingMode,
    setIsLogging,
    handleLoggingModeChange,
    startLogging,
    stopLogging,
    pauseLogging,
    resumeLogging,
    logMeasurement,
  } = useMeasurementLogging({
    handleCaptureImage,
    pendingPhotos,
    setPendingPhotos,
    setOfflineItems,
    setShowSurveyDialog,
    selectedPOIType: selectedType,
    setCapturedData,
    capturedData,
    handleAutoCaptureAndLog
  });

  // Listen for layout config changes from the customizer
  const [layoutVersion, setLayoutVersion] = React.useState(0);
  React.useEffect(() => {
    const handleLayoutChange = () => {
      setLayoutVersion(v => v + 1);
    };
    
    window.addEventListener('layout-config-changed', handleLayoutChange);
    return () => window.removeEventListener('layout-config-changed', handleLayoutChange);
  }, []);

  // Get cards for each column - recalculate whenever layoutConfig changes
  const leftColumnCards = React.useMemo(() => getCardsForColumn(1), [layoutConfig, getCardsForColumn, layoutVersion]);
  const rightColumnCards = React.useMemo(() => getCardsForColumn(2), [layoutConfig, getCardsForColumn, layoutVersion]);

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      <div className="container mx-auto p-6">
        <AppHeader
          wifiStatus={wifiStatus}
          setShowWifiStatus={setShowWifiStatus}
          setShowDatabaseStatus={setShowDatabaseStatus}
          offlineItems={offlineItems}
          showThreeColumns={showThreeColumns}
          setShowThreeColumns={setShowThreeColumns}
          isMobile={isMobile}
        />

        {/* LiDAR HUD toggle button */}
        <div className="flex justify-end mb-2">
          <button
            data-testid="button-lidar-hud-toggle"
            onClick={() => {
              const next = !lidarHudEnabled;
              setLidarHudEnabled(next);
              useSettingsStore.getState().setUISettings({ lidarHudEnabled: next });
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono border transition-colors ${
              lidarHudEnabled
                ? 'bg-green-700/80 border-green-500 text-green-100 hover:bg-green-700'
                : 'bg-gray-800 border-gray-600 text-gray-400 hover:bg-gray-700 hover:text-gray-200'
            }`}
            title={lidarHudEnabled ? 'Hide LiDAR HUD overlay' : 'Show LiDAR HUD overlay'}
          >
            <Layers className="w-3.5 h-3.5" />
            LiDAR HUD
          </button>
        </div>

        {/* Conditional rendering: Only render ONE layout at a time */}
        {!isDesktop ? (
          /* Mobile & Tablet: Grid Layout (1 col on mobile, 2 cols on tablet) */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Combine all cards in order for mobile/tablet */}
          {[...leftColumnCards, ...rightColumnCards].map((card) => {
            switch (card.id) {
              case 'route-map':
                return (
                  <CardWrapper
                    key={card.id}
                    cardId={card.id}
                    title={card.name}
                    collapsed={card.collapsed}
                    onToggleCollapse={toggleCardCollapsed}
                  >
                    <React.Suspense fallback={<div className="h-full bg-gray-900" />}><VehicleMap /></React.Suspense>
                  </CardWrapper>
                );
              case 'measurement-cards':
                return (
                  <CardWrapper
                    key={card.id}
                    cardId={card.id}
                    title={card.name}
                    collapsed={card.collapsed}
                    onToggleCollapse={toggleCardCollapsed}
                  >
                    <MeasurementCards />
                  </CardWrapper>
                );
              case 'poi-height-row':
                return (
                  <CardWrapper
                    key={card.id}
                    cardId={card.id}
                    title={card.name}
                    collapsed={card.collapsed}
                    onToggleCollapse={toggleCardCollapsed}
                  >
                    <POIHeightRow
                      selectedType={selectedType}
                      setSelectedType={setSelectedType}
                      onAutoCaptureNoMeasurement={handleAutoCaptureNoMeasurement}
                      onModalOpenRequested={handleOpenModalWithPOIType}
                      onVoiceNoteRequested={handleVoiceNoteRequested}
                      activeSurvey={activeSurvey}
                      loggingMode={loggingMode}
                      isLogging={isLogging}
                    />
                  </CardWrapper>
                );
              case 'logging-controls':
                return (
                  <CardWrapper
                    key={card.id}
                    cardId={card.id}
                    title={card.name}
                    collapsed={card.collapsed}
                    onToggleCollapse={toggleCardCollapsed}
                  >
                    <LoggingControls
                      loggingMode={loggingMode}
                      setLoggingMode={setLoggingMode}
                      isLogging={isLogging}
                      setIsLogging={setIsLogging}
                      startLogging={startLogging}
                      stopLogging={stopLogging}
                      handleCaptureImage={handleCaptureImage}
                      pendingPhotos={pendingPhotos}
                      setPendingPhotos={setPendingPhotos}
                      setShowSurveyDialog={setShowSurveyDialog}
                      setOfflineItems={setOfflineItems}
                      selectedPOIType={selectedType}
                      videoRef={videoRef}
                      showManualLogModal={showManualLogModal}
                      setShowManualLogModal={setShowManualLogModal}
                      preSelectedPOIType={preSelectedPOIType}
                      setPreSelectedPOIType={setPreSelectedPOIType}
                      handleDeleteLastEntry={handleDeleteLastEntry}
                      measurementCount={measurementCount}
                    />
                  </CardWrapper>
                );
              case 'survey-manager':
                return (
                  <CardWrapper
                    key={card.id}
                    cardId={card.id}
                    title={card.name}
                    collapsed={card.collapsed}
                    onToggleCollapse={toggleCardCollapsed}
                  >
                    <SurveyManager
                      showSurveyDialog={showSurveyDialog}
                      setShowSurveyDialog={setShowSurveyDialog}
                      setOfflineItems={setOfflineItems}
                      videoRef={videoRef}
                    />
                  </CardWrapper>
                );
              case 'gps-data':
                return (
                  <CardWrapper
                    key={card.id}
                    cardId={card.id}
                    title={card.name}
                    collapsed={card.collapsed}
                    onToggleCollapse={toggleCardCollapsed}
                  >
                    <GPSData />
                  </CardWrapper>
                );
              case 'gnss-status':
                return (
                  <CardWrapper
                    key={card.id}
                    cardId={card.id}
                    title={card.name}
                    collapsed={card.collapsed}
                    onToggleCollapse={toggleCardCollapsed}
                  >
                    <GNSSStatusCard />
                  </CardWrapper>
                );
              case 'road-profile':
                return (
                  <CardWrapper
                    key={card.id}
                    cardId={card.id}
                    title={card.name}
                    collapsed={card.collapsed}
                    onToggleCollapse={toggleCardCollapsed}
                  >
                    <RoadProfileCard />
                  </CardWrapper>
                );
              case 'lateral-width':
                return (
                  <CardWrapper
                    key={card.id}
                    cardId={card.id}
                    title={card.name}
                    collapsed={card.collapsed}
                    onToggleCollapse={toggleCardCollapsed}
                  >
                    <LateralWidthDisplay />
                  </CardWrapper>
                );
              case 'rear-overhang':
                return (
                  <CardWrapper
                    key={card.id}
                    cardId={card.id}
                    title={card.name}
                    collapsed={card.collapsed}
                    onToggleCollapse={toggleCardCollapsed}
                  >
                    <RearOverhangDisplay />
                  </CardWrapper>
                );
              case 'measurement-log':
                return (
                  <CardWrapper
                    key={card.id}
                    cardId={card.id}
                    title={card.name}
                    collapsed={card.collapsed}
                    onToggleCollapse={toggleCardCollapsed}
                  >
                    <MeasurementLog onEditMeasurement={handleEditMeasurement} />
                  </CardWrapper>
                );
              case 'live-camera':
                return (
                  <CardWrapper
                    key={card.id}
                    cardId={card.id}
                    title={card.name}
                    collapsed={card.collapsed}
                    onToggleCollapse={toggleCardCollapsed}
                    headerAction={
                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-1.5 px-2 py-1 bg-gray-700/50 rounded cursor-pointer hover:bg-gray-700 transition-colors">
                          <input
                            type="checkbox"
                            checked={useCameraStore.getState().showLiveOverlay}
                            onChange={(e) => useCameraStore.getState().setShowLiveOverlay(e.target.checked)}
                            className="w-3 h-3 rounded accent-orange-500"
                            data-testid="checkbox-overlay-header"
                          />
                          <span className="text-xs text-gray-300">Overlay</span>
                        </label>
                        <button
                          onClick={handleCaptureImage}
                          className="px-2 py-1 bg-blue-500 hover:bg-blue-600 rounded text-xs flex items-center gap-1"
                          data-testid="button-capture-header"
                        >
                          <Camera className="w-3 h-3" />
                          Capture
                        </button>
                      </div>
                    }
                  >
                    <LiveCamera
                      captureImage={handleCaptureImage}
                      videoRef={videoRef}
                      measurements={[]}
                    />
                  </CardWrapper>
                );
              case 'captured-images':
                return (
                  <CardWrapper
                    key={card.id}
                    cardId={card.id}
                    title={card.name}
                    collapsed={card.collapsed}
                    onToggleCollapse={toggleCardCollapsed}
                    headerAction={
                      pendingPhotos.length > 0 ? (
                        <button
                          onClick={async () => {
                            for (const imageId of pendingPhotos) {
                              try {
                                await deleteDetectionImage(imageId);
                              } catch (error) {
                                console.error('Failed to delete detection image:', error);
                              }
                            }
                            setPendingPhotos([]);
                            setCapturedData([]);
                          }}
                          className="px-2 py-1 bg-red-500 hover:bg-red-600 rounded text-xs flex items-center gap-1"
                          data-testid="button-clear-all-header"
                        >
                          <Trash2 className="w-3 h-3" />
                          Clear All
                        </button>
                      ) : undefined
                    }
                  >
                    <CapturedImages
                      pendingPhotos={pendingPhotos}
                      capturedData={capturedData}
                      onDeletePhoto={async (index) => {
                        const imageId = pendingPhotos[index];
                        if (imageId) {
                          try {
                            await deleteDetectionImage(imageId);
                          } catch (error) {
                            console.error('Failed to delete detection image:', error);
                          }
                        }
                        setPendingPhotos(prev => prev.filter((_, i) => i !== index));
                        setCapturedData(prev => prev.filter((_, i) => i !== index));
                      }}
                      onClearAllPhotos={async () => {
                        for (const imageId of pendingPhotos) {
                          try {
                            await deleteDetectionImage(imageId);
                          } catch (error) {
                            console.error('Failed to delete detection image:', error);
                          }
                        }
                        setPendingPhotos([]);
                        setCapturedData([]);
                      }}
                    />
                  </CardWrapper>
                );
              case 'timelapse':
                if (isBeta) return null;
                return (
                  <CardWrapper
                    key={card.id}
                    cardId={card.id}
                    title={card.name}
                    collapsed={card.collapsed}
                    onToggleCollapse={toggleCardCollapsed}
                  >
                    <TimelapseCard videoRef={videoRef} />
                  </CardWrapper>
                );
              case 'settings-tabs':
                return (
                  <CardWrapper
                    key={card.id}
                    cardId={card.id}
                    title={card.name}
                    collapsed={card.collapsed}
                    onToggleCollapse={toggleCardCollapsed}
                  >
                    <TabManager
                      activeTab={activeTab}
                      setActiveTab={setActiveTab}
                      showSurveyDialog={showSurveyDialog}
                      setShowSurveyDialog={setShowSurveyDialog}
                      setOfflineItems={setOfflineItems}
                      videoRef={videoRef}
                      zoomLevel={zoomLevel}
                      setZoomLevel={setZoomLevel}
                    />
                  </CardWrapper>
                );
              case 'measurement-mode-selector':
                // Premium Feature - Measurement Configuration
                if (!hasFeature('measurement_configuration')) return null;
                return (
                  <CardWrapper
                    key={card.id}
                    cardId={card.id}
                    title={card.name}
                    collapsed={card.collapsed}
                    onToggleCollapse={toggleCardCollapsed}
                  >
                    <MeasurementModeSelector
                      onCameraHeightChange={() => {}}
                    />
                  </CardWrapper>
                );
              case 'measurement-controls':
                // Premium Feature - Measurement Controls
                if (!hasFeature('measurement_controls')) return null;
                return (
                  <CardWrapper
                    key={card.id}
                    cardId={card.id}
                    title={card.name}
                    collapsed={card.collapsed}
                    onToggleCollapse={toggleCardCollapsed}
                  >
                    <MeasurementControls
                      videoElement={videoRef.current}
                      cameraHeight={1.5}
                    />
                  </CardWrapper>
                );
              default:
                return null;
            }
          })}
          </div>
        ) : (
          /* Desktop: Resizable 2-Column Layout */
          <div className="flex gap-6">
          {/* Left Column */}
          <div 
            className="space-y-6 transition-all duration-200"
            style={{ width: `${leftColumnWidth}%` }}
          >
            {leftColumnCards.map((card) => {
              switch (card.id) {
                case 'route-map':
                  return (
                    <CardWrapper
                      key={card.id}
                      cardId={card.id}
                      title={card.name}
                      collapsed={card.collapsed}
                      onToggleCollapse={toggleCardCollapsed}
                    >
                      <React.Suspense fallback={<div className="h-full bg-gray-900" />}><VehicleMap /></React.Suspense>
                    </CardWrapper>
                  );
                case 'measurement-cards':
                  return (
                    <CardWrapper
                      key={card.id}
                      cardId={card.id}
                      title={card.name}
                      collapsed={card.collapsed}
                      onToggleCollapse={toggleCardCollapsed}
                    >
                      <MeasurementCards />
                    </CardWrapper>
                  );
                case 'poi-height-row':
                  return (
                    <CardWrapper
                      key={card.id}
                      cardId={card.id}
                      title={card.name}
                      collapsed={card.collapsed}
                      onToggleCollapse={toggleCardCollapsed}
                    >
                      <POIHeightRow
                        selectedType={selectedType}
                        setSelectedType={setSelectedType}
                        onAutoCaptureNoMeasurement={handleAutoCaptureNoMeasurement}
                        onModalOpenRequested={handleOpenModalWithPOIType}
                        activeSurvey={activeSurvey}
                        loggingMode={loggingMode}
                        isLogging={isLogging}
                      />
                    </CardWrapper>
                  );
                case 'logging-controls':
                  return (
                    <CardWrapper
                      key={card.id}
                      cardId={card.id}
                      title={card.name}
                      collapsed={card.collapsed}
                      onToggleCollapse={toggleCardCollapsed}
                    >
                      <LoggingControls
                        loggingMode={loggingMode}
                        setLoggingMode={setLoggingMode}
                        isLogging={isLogging}
                        setIsLogging={setIsLogging}
                        startLogging={startLogging}
                        stopLogging={stopLogging}
                        handleCaptureImage={handleCaptureImage}
                        pendingPhotos={pendingPhotos}
                        setPendingPhotos={setPendingPhotos}
                        setShowSurveyDialog={setShowSurveyDialog}
                        setOfflineItems={setOfflineItems}
                        selectedPOIType={selectedType}
                        videoRef={videoRef}
                        showManualLogModal={showManualLogModal}
                        setShowManualLogModal={setShowManualLogModal}
                        preSelectedPOIType={preSelectedPOIType}
                        setPreSelectedPOIType={setPreSelectedPOIType}
                        handleDeleteLastEntry={handleDeleteLastEntry}
                        measurementCount={measurementCount}
                      />
                    </CardWrapper>
                  );
                case 'survey-manager':
                  return (
                    <CardWrapper
                      key={card.id}
                      cardId={card.id}
                      title={card.name}
                      collapsed={card.collapsed}
                      onToggleCollapse={toggleCardCollapsed}
                    >
                      <SurveyManager
                        showSurveyDialog={showSurveyDialog}
                        setShowSurveyDialog={setShowSurveyDialog}
                        setOfflineItems={setOfflineItems}
                        videoRef={videoRef}
                      />
                    </CardWrapper>
                  );
                case 'gps-data':
                  return (
                    <CardWrapper
                      key={card.id}
                      cardId={card.id}
                      title={card.name}
                      collapsed={card.collapsed}
                      onToggleCollapse={toggleCardCollapsed}
                    >
                      <GPSData />
                    </CardWrapper>
                  );
                case 'gnss-status':
                  return (
                    <CardWrapper
                      key={card.id}
                      cardId={card.id}
                      title={card.name}
                      collapsed={card.collapsed}
                      onToggleCollapse={toggleCardCollapsed}
                    >
                      <GNSSStatusCard />
                    </CardWrapper>
                  );
                case 'road-profile':
                  return (
                    <CardWrapper
                      key={card.id}
                      cardId={card.id}
                      title={card.name}
                      collapsed={card.collapsed}
                      onToggleCollapse={toggleCardCollapsed}
                    >
                      <RoadProfileCard />
                    </CardWrapper>
                  );
                case 'lateral-width':
                  return (
                    <CardWrapper
                      key={card.id}
                      cardId={card.id}
                      title={card.name}
                      collapsed={card.collapsed}
                      onToggleCollapse={toggleCardCollapsed}
                    >
                      <LateralWidthDisplay />
                    </CardWrapper>
                  );
                case 'rear-overhang':
                  return (
                    <CardWrapper
                      key={card.id}
                      cardId={card.id}
                      title={card.name}
                      collapsed={card.collapsed}
                      onToggleCollapse={toggleCardCollapsed}
                    >
                      <RearOverhangDisplay />
                    </CardWrapper>
                  );
                case 'measurement-mode-selector':
                  // Premium Feature - Measurement Configuration
                  if (!hasFeature('measurement_configuration')) return null;
                  return (
                    <CardWrapper
                      key={card.id}
                      cardId={card.id}
                      title={card.name}
                      collapsed={card.collapsed}
                      onToggleCollapse={toggleCardCollapsed}
                    >
                      <MeasurementModeSelector
                        onCameraHeightChange={() => {}}
                      />
                    </CardWrapper>
                  );
                case 'measurement-log':
                  return (
                    <CardWrapper
                      key={card.id}
                      cardId={card.id}
                      title={card.name}
                      collapsed={card.collapsed}
                      onToggleCollapse={toggleCardCollapsed}
                    >
                      <MeasurementLog onEditMeasurement={handleEditMeasurement} />
                    </CardWrapper>
                  );
                case 'live-camera':
                  return (
                    <CardWrapper
                      key={card.id}
                      cardId={card.id}
                      title={card.name}
                      collapsed={card.collapsed}
                      onToggleCollapse={toggleCardCollapsed}
                      headerAction={
                        <div className="flex items-center gap-2">
                          <label className="flex items-center gap-1.5 px-2 py-1 bg-gray-700/50 rounded cursor-pointer hover:bg-gray-700 transition-colors">
                            <input
                              type="checkbox"
                              checked={useCameraStore.getState().showLiveOverlay}
                              onChange={(e) => useCameraStore.getState().setShowLiveOverlay(e.target.checked)}
                              className="w-3 h-3 rounded accent-orange-500"
                              data-testid="checkbox-overlay-header"
                            />
                            <span className="text-xs text-gray-300">Overlay</span>
                          </label>
                          <button
                            onClick={handleCaptureImage}
                            className="px-2 py-1 bg-blue-500 hover:bg-blue-600 rounded text-xs flex items-center gap-1"
                            data-testid="button-capture-header"
                          >
                            <Camera className="w-3 h-3" />
                            Capture
                          </button>
                        </div>
                      }
                    >
                      <LiveCamera
                        captureImage={handleCaptureImage}
                        videoRef={videoRef}
                        measurements={[]}
                      />
                    </CardWrapper>
                  );
                case 'captured-images':
                  return (
                    <CardWrapper
                      key={card.id}
                      cardId={card.id}
                      title={card.name}
                      collapsed={card.collapsed}
                      onToggleCollapse={toggleCardCollapsed}
                      headerAction={
                        pendingPhotos.length > 0 ? (
                          <button
                            onClick={async () => {
                              for (const imageId of pendingPhotos) {
                                try {
                                  await deleteDetectionImage(imageId);
                                } catch (error) {
                                  console.error('Failed to delete detection image:', error);
                                }
                              }
                              setPendingPhotos([]);
                              setCapturedData([]);
                            }}
                            className="px-2 py-1 bg-red-500 hover:bg-red-600 rounded text-xs flex items-center gap-1"
                            data-testid="button-clear-all-header"
                          >
                            <Trash2 className="w-3 h-3" />
                            Clear All
                          </button>
                        ) : undefined
                      }
                    >
                      <CapturedImages
                        pendingPhotos={pendingPhotos}
                        capturedData={capturedData}
                        onDeletePhoto={async (index) => {
                          const imageId = pendingPhotos[index];
                          if (imageId) {
                            try {
                              await deleteDetectionImage(imageId);
                            } catch (error) {
                              console.error('Failed to delete detection image:', error);
                            }
                          }
                          setPendingPhotos(prev => prev.filter((_, i) => i !== index));
                          setCapturedData(prev => prev.filter((_, i) => i !== index));
                        }}
                        onClearAllPhotos={async () => {
                          for (const imageId of pendingPhotos) {
                            try {
                              await deleteDetectionImage(imageId);
                            } catch (error) {
                              console.error('Failed to delete detection image:', error);
                            }
                          }
                          setPendingPhotos([]);
                          setCapturedData([]);
                        }}
                      />
                    </CardWrapper>
                  );
                case 'timelapse':
                  if (isBeta) return null;
                  return (
                    <CardWrapper
                      key={card.id}
                      cardId={card.id}
                      title={card.name}
                      collapsed={card.collapsed}
                      onToggleCollapse={toggleCardCollapsed}
                    >
                      <TimelapseCard videoRef={videoRef} />
                    </CardWrapper>
                  );
                case 'settings-tabs':
                  return (
                    <CardWrapper
                      key={card.id}
                      cardId={card.id}
                      title={card.name}
                      collapsed={card.collapsed}
                      onToggleCollapse={toggleCardCollapsed}
                    >
                      <TabManager
                        activeTab={activeTab}
                        setActiveTab={setActiveTab}
                        showSurveyDialog={showSurveyDialog}
                        setShowSurveyDialog={setShowSurveyDialog}
                        setOfflineItems={setOfflineItems}
                        videoRef={videoRef}
                        zoomLevel={zoomLevel}
                        setZoomLevel={setZoomLevel}
                      />
                    </CardWrapper>
                  );
                case 'measurement-controls':
                  // Premium Feature - Measurement Controls
                  if (!hasFeature('measurement_controls')) return null;
                  return (
                    <CardWrapper
                      key={card.id}
                      cardId={card.id}
                      title={card.name}
                      collapsed={card.collapsed}
                      onToggleCollapse={toggleCardCollapsed}
                    >
                      <MeasurementControls
                        videoElement={videoRef.current}
                        cameraHeight={1.5}
                      />
                    </CardWrapper>
                  );
                default:
                  return null;
              }
            })}
          </div>

          {/* Column Resizer (Desktop Only) */}
          <ColumnResizer
            leftWidth={leftColumnWidth}
            setLeftColumnWidth={setLeftColumnWidth}
          />

          {/* Right Column */}
          <div 
            className="space-y-6 transition-all duration-200"
            style={{ width: `${100 - leftColumnWidth}%` }}
          >
            {rightColumnCards.map((card) => {
              switch (card.id) {
                case 'measurement-log':
                  return (
                    <CardWrapper
                      key={card.id}
                      cardId={card.id}
                      title={card.name}
                      collapsed={card.collapsed}
                      onToggleCollapse={toggleCardCollapsed}
                    >
                      <MeasurementLog onEditMeasurement={handleEditMeasurement} />
                    </CardWrapper>
                  );
                case 'live-camera':
                  return (
                    <CardWrapper
                      key={card.id}
                      cardId={card.id}
                      title={card.name}
                      collapsed={card.collapsed}
                      onToggleCollapse={toggleCardCollapsed}
                      headerAction={
                        <div className="flex items-center gap-2">
                          <label className="flex items-center gap-1.5 px-2 py-1 bg-gray-700/50 rounded cursor-pointer hover:bg-gray-700 transition-colors">
                            <input
                              type="checkbox"
                              checked={useCameraStore.getState().showLiveOverlay}
                              onChange={(e) => useCameraStore.getState().setShowLiveOverlay(e.target.checked)}
                              className="w-3 h-3 rounded accent-orange-500"
                              data-testid="checkbox-overlay-header"
                            />
                            <span className="text-xs text-gray-300">Overlay</span>
                          </label>
                          <button
                            onClick={handleCaptureImage}
                            className="px-2 py-1 bg-blue-500 hover:bg-blue-600 rounded text-xs flex items-center gap-1"
                            data-testid="button-capture-header"
                          >
                            <Camera className="w-3 h-3" />
                            Capture
                          </button>
                        </div>
                      }
                    >
                      <LiveCamera
                        captureImage={handleCaptureImage}
                        videoRef={videoRef}
                        measurements={[]}
                      />
                    </CardWrapper>
                  );
                case 'captured-images':
                  return (
                    <CardWrapper
                      key={card.id}
                      cardId={card.id}
                      title={card.name}
                      collapsed={card.collapsed}
                      onToggleCollapse={toggleCardCollapsed}
                      headerAction={
                        pendingPhotos.length > 0 ? (
                          <button
                            onClick={async () => {
                              for (const imageId of pendingPhotos) {
                                try {
                                  await deleteDetectionImage(imageId);
                                } catch (error) {
                                  console.error('Failed to delete detection image:', error);
                                }
                              }
                              setPendingPhotos([]);
                              setCapturedData([]);
                            }}
                            className="px-2 py-1 bg-red-500 hover:bg-red-600 rounded text-xs flex items-center gap-1"
                            data-testid="button-clear-all-header"
                          >
                            <Trash2 className="w-3 h-3" />
                            Clear All
                          </button>
                        ) : undefined
                      }
                    >
                      <CapturedImages
                        pendingPhotos={pendingPhotos}
                        capturedData={capturedData}
                        onDeletePhoto={async (index) => {
                          const imageId = pendingPhotos[index];
                          if (imageId) {
                            try {
                              await deleteDetectionImage(imageId);
                            } catch (error) {
                              console.error('Failed to delete detection image:', error);
                            }
                          }
                          setPendingPhotos(prev => prev.filter((_, i) => i !== index));
                          setCapturedData(prev => prev.filter((_, i) => i !== index));
                        }}
                        onClearAllPhotos={async () => {
                          for (const imageId of pendingPhotos) {
                            try {
                              await deleteDetectionImage(imageId);
                            } catch (error) {
                              console.error('Failed to delete detection image:', error);
                            }
                          }
                          setPendingPhotos([]);
                          setCapturedData([]);
                        }}
                      />
                    </CardWrapper>
                  );
                case 'timelapse':
                  if (isBeta) return null;
                  return (
                    <CardWrapper
                      key={card.id}
                      cardId={card.id}
                      title={card.name}
                      collapsed={card.collapsed}
                      onToggleCollapse={toggleCardCollapsed}
                    >
                      <TimelapseCard videoRef={videoRef} />
                    </CardWrapper>
                  );
                case 'settings-tabs':
                  return (
                    <CardWrapper
                      key={card.id}
                      cardId={card.id}
                      title={card.name}
                      collapsed={card.collapsed}
                      onToggleCollapse={toggleCardCollapsed}
                    >
                      <TabManager
                        activeTab={activeTab}
                        setActiveTab={setActiveTab}
                        showSurveyDialog={showSurveyDialog}
                        setShowSurveyDialog={setShowSurveyDialog}
                        setOfflineItems={setOfflineItems}
                        videoRef={videoRef}
                        zoomLevel={zoomLevel}
                        setZoomLevel={setZoomLevel}
                      />
                    </CardWrapper>
                  );
                case 'measurement-controls':
                  // Premium Feature - Measurement Controls
                  if (!hasFeature('measurement_controls')) return null;
                  return (
                    <CardWrapper
                      key={card.id}
                      cardId={card.id}
                      title={card.name}
                      collapsed={card.collapsed}
                      onToggleCollapse={toggleCardCollapsed}
                    >
                      <MeasurementControls
                        videoElement={videoRef.current}
                        cameraHeight={1.5}
                      />
                    </CardWrapper>
                  );
                case 'route-map':
                  return (
                    <CardWrapper
                      key={card.id}
                      cardId={card.id}
                      title={card.name}
                      collapsed={card.collapsed}
                      onToggleCollapse={toggleCardCollapsed}
                    >
                      <React.Suspense fallback={<div className="h-full bg-gray-900" />}><VehicleMap /></React.Suspense>
                    </CardWrapper>
                  );
                case 'measurement-cards':
                  return (
                    <CardWrapper
                      key={card.id}
                      cardId={card.id}
                      title={card.name}
                      collapsed={card.collapsed}
                      onToggleCollapse={toggleCardCollapsed}
                    >
                      <MeasurementCards />
                    </CardWrapper>
                  );
                case 'poi-height-row':
                  return (
                    <CardWrapper
                      key={card.id}
                      cardId={card.id}
                      title={card.name}
                      collapsed={card.collapsed}
                      onToggleCollapse={toggleCardCollapsed}
                    >
                      <POIHeightRow
                        selectedType={selectedType}
                        setSelectedType={setSelectedType}
                        onAutoCaptureNoMeasurement={handleAutoCaptureNoMeasurement}
                        onModalOpenRequested={handleOpenModalWithPOIType}
                        activeSurvey={activeSurvey}
                        loggingMode={loggingMode}
                        isLogging={isLogging}
                      />
                    </CardWrapper>
                  );
                case 'logging-controls':
                  return (
                    <CardWrapper
                      key={card.id}
                      cardId={card.id}
                      title={card.name}
                      collapsed={card.collapsed}
                      onToggleCollapse={toggleCardCollapsed}
                    >
                      <LoggingControls
                        loggingMode={loggingMode}
                        setLoggingMode={setLoggingMode}
                        isLogging={isLogging}
                        setIsLogging={setIsLogging}
                        startLogging={startLogging}
                        stopLogging={stopLogging}
                        handleCaptureImage={handleCaptureImage}
                        pendingPhotos={pendingPhotos}
                        setPendingPhotos={setPendingPhotos}
                        setShowSurveyDialog={setShowSurveyDialog}
                        setOfflineItems={setOfflineItems}
                        selectedPOIType={selectedType}
                        videoRef={videoRef}
                        showManualLogModal={showManualLogModal}
                        setShowManualLogModal={setShowManualLogModal}
                        preSelectedPOIType={preSelectedPOIType}
                        setPreSelectedPOIType={setPreSelectedPOIType}
                        handleDeleteLastEntry={handleDeleteLastEntry}
                        measurementCount={measurementCount}
                      />
                    </CardWrapper>
                  );
                case 'survey-manager':
                  return (
                    <CardWrapper
                      key={card.id}
                      cardId={card.id}
                      title={card.name}
                      collapsed={card.collapsed}
                      onToggleCollapse={toggleCardCollapsed}
                    >
                      <SurveyManager
                        showSurveyDialog={showSurveyDialog}
                        setShowSurveyDialog={setShowSurveyDialog}
                        setOfflineItems={setOfflineItems}
                        videoRef={videoRef}
                      />
                    </CardWrapper>
                  );
                case 'gps-data':
                  return (
                    <CardWrapper
                      key={card.id}
                      cardId={card.id}
                      title={card.name}
                      collapsed={card.collapsed}
                      onToggleCollapse={toggleCardCollapsed}
                    >
                      <GPSData />
                    </CardWrapper>
                  );
                case 'gnss-status':
                  return (
                    <CardWrapper
                      key={card.id}
                      cardId={card.id}
                      title={card.name}
                      collapsed={card.collapsed}
                      onToggleCollapse={toggleCardCollapsed}
                    >
                      <GNSSStatusCard />
                    </CardWrapper>
                  );
                case 'road-profile':
                  return (
                    <CardWrapper
                      key={card.id}
                      cardId={card.id}
                      title={card.name}
                      collapsed={card.collapsed}
                      onToggleCollapse={toggleCardCollapsed}
                    >
                      <RoadProfileCard />
                    </CardWrapper>
                  );
                case 'lateral-width':
                  return (
                    <CardWrapper
                      key={card.id}
                      cardId={card.id}
                      title={card.name}
                      collapsed={card.collapsed}
                      onToggleCollapse={toggleCardCollapsed}
                    >
                      <LateralWidthDisplay />
                    </CardWrapper>
                  );
                case 'rear-overhang':
                  return (
                    <CardWrapper
                      key={card.id}
                      cardId={card.id}
                      title={card.name}
                      collapsed={card.collapsed}
                      onToggleCollapse={toggleCardCollapsed}
                    >
                      <RearOverhangDisplay />
                    </CardWrapper>
                  );
                case 'measurement-mode-selector':
                  // Premium Feature - Measurement Configuration
                  if (!hasFeature('measurement_configuration')) return null;
                  return (
                    <CardWrapper
                      key={card.id}
                      cardId={card.id}
                      title={card.name}
                      collapsed={card.collapsed}
                      onToggleCollapse={toggleCardCollapsed}
                    >
                      <MeasurementModeSelector
                        onCameraHeightChange={() => {}}
                      />
                    </CardWrapper>
                  );
                default:
                  return null;
              }
            })}
          </div>
          </div>
        )}

        {/* Keyboard Shortcut Handler */}
        <KeyboardShortcutHandler
          setSelectedPOIType={handleSetPOIType}
          handleCaptureImage={handleCaptureImage}
          clearCapturedImages={clearCapturedImages}
          handleLogMeasurement={logMeasurement}
          handleDeleteLastEntry={handleDeleteLastEntry}
          setAlertStatus={setAlertStatus}
          startLogging={startLogging}
          stopLogging={stopLogging}
          pauseLogging={pauseLogging}
          resumeLogging={resumeLogging}
          handleLoggingModeChange={handleLoggingModeChange}
          handleAutoCaptureNoMeasurement={handleAutoCaptureNoMeasurement}
          handleOpenModalWithPOIType={handleOpenModalWithPOIType}
          handleVoiceNoteRequested={handleVoiceNoteRequested}
          loggingMode={loggingMode}
          isLogging={isLogging}
        />

        {/* Voice Command Bridge - NOW SIMPLIFIED! Voice commands trigger keyboard shortcuts directly */}
        <VoiceCommandBridge
          setAlertStatus={setAlertStatus}
        />

        {/* Status Dialogs */}
        <WifiStatusDialog
          isOpen={showWifiStatus}
          onClose={() => setShowWifiStatus(false)}
        />
        
        <DatabaseStatusDialog
          isOpen={showDatabaseStatus}
          onClose={() => setShowDatabaseStatus(false)}
        />

        {/* Edit Measurement Modal */}
        <EditMeasurementModal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setEditingMeasurement(null);
          }}
          measurement={editingMeasurement}
        />
        
        {/* Voice Note POI Modal */}
        <VoiceNotePOIModal
          isOpen={showVoiceNoteModal}
          onClose={() => {
            setShowVoiceNoteModal(false);
            setVoiceNoteCapturedImage(null);
            setSelectedType('');
          }}
          onSave={handleVoiceNoteSave}
        />
      </div>

      <Outlet />

      {/* 360° Camera overlays — always rendered, never block driving UI */}
      <CameraErrorBanner />
      <CameraHUD />

      {/* LiDAR HUD overlay — fixed position, z-index above map, below modals */}
      {lidarHudEnabled && (
        <div
          className="fixed inset-0 pointer-events-none"
          style={{ zIndex: 800 }}
          data-testid="lidar-hud-overlay"
        >
          <div className="relative w-full h-full pointer-events-auto">
            <ClearanceHUD
              metrics={lidar.metrics}
              alerts={lidar.alerts}
              status={lidar.status}
              isConnected={lidar.isConnected}
              startStaticScan={lidar.startStaticScan}
              onClose={() => {
                setLidarHudEnabled(false);
                localStorage.removeItem('lidar_hud_enabled');
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;