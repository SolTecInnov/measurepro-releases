/**
 * usePointCloudScanner Hook
 * 
 * Orchestrates the complete point cloud scanning workflow:
 * 1. Camera depth capture (ZED 2i)
 * 2. Point cloud generation
 * 3. GPS position capture
 * 4. IndexedDB storage (primary)
 * 5. Firebase sync (optional cloud backup)
 * 6. Storage quota enforcement
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { useLicenseCheck } from './useLicenseEnforcement';
import { LICENSED_FEATURES } from '../lib/licensing/features';
import { usePointCloudStore } from '../stores/pointCloudStore';
import { useCameraStore } from '../lib/camera';
import { useGPSStore } from '../lib/stores/gpsStore';
import { generatePointCloud } from '../lib/pointCloud/PointCloudGenerator';
import { saveFrame, getStorageUsed, getScanMetadata, computeScanBounds } from '../lib/pointCloud/storage/indexedDbStore';
import { syncPointCloudScanToFirebase } from '../lib/firebase/pointCloudSync';
import { getDeviceStorageEstimate, checkStorageAvailable, formatBytes } from '../lib/utils/storageManager';
import type { DepthData, RGBFrame } from '../lib/camera/CameraInterface';
import type { PointCloudFrame, PointCloudScan } from '../lib/pointCloud/types';

export function usePointCloudScanner() {
  const { hasAccess, isLoading: licenseLoading } = useLicenseCheck(LICENSED_FEATURES.POINT_CLOUD_SCANNING);
  
  const {
    currentScan,
    setCurrentScan,
    resetCurrentScan,
    recordingStatus,
    setRecordingStatus,
    gpsStatus,
    setGPSStatus,
    storageQuota,
    setStorageQuota,
    incrementFrameCount,
    addPoints,
    updateStorageUsed,
  } = usePointCloudStore();

  const { camera, depthEnabled } = useCameraStore();
  const { data: gpsData } = useGPSStore();

  const [error, setError] = useState<string | null>(null);
  const frameIntervalRef = useRef<number | null>(null);
  const scanIdRef = useRef<string | null>(null);

  // Monitor GPS status
  useEffect(() => {
    if (gpsData.latitude !== 0 && gpsData.longitude !== 0) {
      setGPSStatus({
        available: true,
        lastPosition: {
          lat: gpsData.latitude,
          lon: gpsData.longitude,
          alt: gpsData.altitude || 0,
        },
        accuracy: gpsData.accuracy || null,
      });
    } else {
      setGPSStatus({ available: false });
    }
  }, [gpsData, setGPSStatus]);

  // Monitor storage usage (quota is total capacity, set once at app startup)
  useEffect(() => {
    const updateStorage = async () => {
      if (recordingStatus !== 'idle') {
        const used = await getStorageUsed();
        updateStorageUsed(used);
      }
    };

    updateStorage();
    const interval = setInterval(updateStorage, 2000);
    return () => clearInterval(interval);
  }, [recordingStatus, updateStorageUsed]);

  /**
   * Start recording a new scan
   */
  const startRecording = useCallback(async (scanName: string, surveyId?: string) => {
    if (!hasAccess) {
      toast.error('Point Cloud Scanning requires a premium license');
      return;
    }

    if (!depthEnabled || !camera) {
      toast.error('ZED 2i camera with depth sensing is required');
      return;
    }

    if (!gpsStatus.available) {
      toast.warning('GPS not available - scans will lack geo-referencing');
    }

    // Check REAL device storage (not artificial quota)
    // Estimated frame size: ~50KB per frame at 1 FPS = ~3MB per minute
    const estimatedScanSize = 100 * 1024 * 1024; // 100MB estimated for typical scan
    const storageCheck = await checkStorageAvailable(estimatedScanSize);
    
    if (!storageCheck.available) {
      toast.error('Insufficient Storage', {
        description: storageCheck.reason || 'Not enough device storage available',
        duration: 8000,
      });
      return;
    }
    
    const scanId = `scan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    scanIdRef.current = scanId;

    setCurrentScan({
      scanId,
      scanName,
      startTime: Date.now(),
      frameCount: 0,
      pointCount: 0,
      storageUsedBytes: 0,
      status: 'recording',
      surveyId,
    });

    setRecordingStatus('recording');
    setError(null);

    toast.success(`Started scan: ${scanName}`);

    // Start frame capture loop (1 fps)
    startFrameCapture();
  }, [hasAccess, depthEnabled, camera, gpsStatus, storageQuota, setCurrentScan, setRecordingStatus]);

  /**
   * Pause recording
   */
  const pauseRecording = useCallback(() => {
    if (recordingStatus === 'recording') {
      setRecordingStatus('paused');
      stopFrameCapture();
      toast.info('Scan paused');
    }
  }, [recordingStatus, setRecordingStatus]);

  /**
   * Resume recording
   */
  const resumeRecording = useCallback(() => {
    if (recordingStatus === 'paused') {
      setRecordingStatus('recording');
      startFrameCapture();
      toast.success('Scan resumed');
    }
  }, [recordingStatus, setRecordingStatus]);

  /**
   * Stop recording and finalize scan
   */
  const stopRecording = useCallback(async () => {
    if (recordingStatus === 'idle') return;

    stopFrameCapture();
    setRecordingStatus('idle');

    const scanData = { ...currentScan };
    const endTime = Date.now();
    resetCurrentScan();
    scanIdRef.current = null;

    toast.success(`Scan completed: ${scanData.scanName}`, {
      description: `${scanData.frameCount} frames, ${scanData.pointCount.toLocaleString()} points`,
    });

    // Sync to Firebase Firestore (optional cloud backup)
    if (scanData.scanId) {
      // Get real bounds and storage size from IndexedDB
      const bounds = await computeScanBounds(scanData.scanId);
      const metadata = await getScanMetadata(scanData.scanId);
      
      const scan: PointCloudScan = {
        id: scanData.scanId,
        name: scanData.scanName,
        surveyId: scanData.surveyId,
        startTime: scanData.startTime || Date.now(),
        endTime,
        totalFrames: metadata?.totalFrames || scanData.frameCount,
        totalPoints: metadata?.totalPoints || scanData.pointCount,
        bounds: bounds || {
          min: { x: 0, y: 0, z: 0 },
          max: { x: 0, y: 0, z: 0 },
        },
        gpsCenter: gpsStatus.lastPosition || { lat: 0, lon: 0, alt: 0 },
        status: 'completed',
        storageSizeBytes: metadata?.storageSizeBytes || 0,
      };

      await syncPointCloudScanToFirebase(scan);
    }

  }, [recordingStatus, currentScan, gpsStatus, setRecordingStatus, resetCurrentScan]);

  /**
   * Start frame capture loop
   */
  const startFrameCapture = useCallback(() => {
    if (frameIntervalRef.current) return;

    frameIntervalRef.current = window.setInterval(async () => {
      try {
        await captureFrame();
      } catch (err: any) {
        setError(err.message);
        toast.error('Frame capture failed', { description: err.message });
      }
    }, 1000); // 1 fps
  }, []);

  /**
   * Stop frame capture loop
   */
  const stopFrameCapture = useCallback(() => {
    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current);
      frameIntervalRef.current = null;
    }
  }, []);

  /**
   * Capture a single frame
   */
  const captureFrame = useCallback(async () => {
    if (!camera || !scanIdRef.current) return;

    // Check REAL device storage before capturing each frame
    // Estimated frame size: ~5MB max per frame
    const storageCheck = await checkStorageAvailable(5 * 1024 * 1024);
    if (!storageCheck.available) {
      stopRecording();
      toast.error('Insufficient device storage', {
        description: 'Device storage full - scan stopped automatically',
        duration: 8000,
      });
      return;
    }

    // Get depth data from camera
    const depthData: DepthData = await camera.captureDepth();
    const rgbFrame: RGBFrame = await camera.captureFrame();

    if (!depthData || !rgbFrame) {
      return;
    }

    // Get GPS position
    const gpsPosition = gpsStatus.lastPosition || { lat: 0, lon: 0, alt: 0 };

    // Generate point cloud
    const frame: PointCloudFrame = generatePointCloud(
      depthData,
      rgbFrame,
      undefined, // Use default ZED 2i intrinsics
      scanIdRef.current,
      currentScan.frameCount,
      gpsPosition,
      {
        skipInvalidDepth: true,
        maxDepth: 20.0,
        minDepth: 0.3,
        downsampleFactor: 2, // Downsample to reduce storage
      }
    );

    // Save to IndexedDB
    await saveFrame(frame);

    // Update stats
    incrementFrameCount();
    addPoints(frame.pointCount);

  }, [camera, currentScan, gpsStatus, storageQuota, incrementFrameCount, addPoints, stopRecording]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopFrameCapture();
    };
  }, [stopFrameCapture]);

  return {
    // State
    hasAccess,
    licenseLoading,
    currentScan,
    recordingStatus,
    gpsStatus,
    error,

    // Actions
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,

    // Stats
    storageQuota,
    storageUsed: currentScan.storageUsedBytes,
    storagePercent: (currentScan.storageUsedBytes / storageQuota) * 100,
  };
}
