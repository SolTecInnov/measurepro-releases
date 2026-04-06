import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { useSerialStore } from "../lib/stores/serialStore";
import { getLaserLog } from "../lib/laserLog";
import { useSurveyStore } from "../lib/survey";
import { useGPSStore } from "../lib/stores/gpsStore";
import { useLaserStore } from "../lib/laser";
import { usePOIStore, MEASUREMENT_FREE_POI_TYPES, shouldRecordHeightClearance } from "../lib/poi";
import { usePOIActionsStore } from "../lib/poiActions";
import { soundManager } from "../lib/sounds";
import { useSettingsStore } from "../lib/settings";
import {
  convertToMeters,
  isInvalidMeasurement,
  createObjectDetectionLog,
} from "../lib/utils/laserUtils";
import { saveImageAsset } from "../lib/storage/assetHelper";

/**
 * Round a measurement to 2 decimal places for clean display and storage
 * All measurements should be in meters with format x.xx
 */
const roundMeasurement = (value: number | null | undefined): number | null => {
  if (value === null || value === undefined || isNaN(value)) return null;
  return Math.round(value * 100) / 100;
};

/**
 * Check if a POI type should have no measurement data
 */
const isMeasurementFreePOI = (poiType: string | null | undefined): boolean => {
  if (!poiType) return false;
  return MEASUREMENT_FREE_POI_TYPES.includes(poiType as any);
};
import { videoRecorder } from "../lib/video/VideoRecorder";
import { useCameraStore } from "../lib/camera";
import { useCameraStore360 } from "../stores/cameraStore360";
import { useAlertsStore } from "../lib/stores/alertsStore";
import { OverheadAggregator } from "../lib/overhead/overhead-aggregator";
import { CounterDetectionAggregator } from "../lib/overhead/counter-detection-aggregator";
import type { Sample, POI } from "../lib/overhead/types";
import { calculateDistance } from "../lib/utils/geoUtils";
import {
  classifyDetections,
  formatDetectionSummary,
  type BufferedDetection,
  type ClassifiedDetections,
} from "../lib/utils/bridgeAndWiresUtils";
import { addPOIFrameToTimelapse } from "@/lib/timelapse/poiIntegration";
import { getStoragePool } from "@/lib/workers/StoragePool";
import { logger } from "@/lib/utils/logger";
import { frameBuffer } from "@/lib/camera/frameBuffer";
import { captureQueue } from "@/lib/camera/captureQueue";
import {
  saveDetectionImage,
  getDetectionImageDataURL,
  deleteDetectionImages,
} from "@/lib/storage/detection-storage";
import { useMeasurementLogger } from "./useMeasurementLogger";
import { useBluetoothStore } from "../lib/bluetooth/bluetoothStore";
import {
  bufferDetectionService,
  useBufferConfigStore,
  BufferDetectionService,
  type BufferSession,
} from "../lib/detection/BufferDetectionService";

// Define the type for captured data
interface CapturedData {
  imageUrl: string;
  overlayData: {
    poi: string;
    time: string;
    gps: { latitude: number; longitude: number };
    height: string;
    course: number;
  };
}

interface UseMeasurementLoggingProps {
  handleCaptureImage: () => Promise<string | null>;
  pendingPhotos: string[];
  setPendingPhotos: (photos: string[]) => void;
  setOfflineItems: (items: number | ((prev: number) => number)) => void;
  setShowSurveyDialog: (show: boolean) => void;
  selectedPOIType: string;
  setCapturedData?: (data: CapturedData[]) => void;
  capturedData?: CapturedData[];
  handleAutoCaptureAndLog?: (measurementData: number | number[]) => Promise<void>;
}

export const useMeasurementLogging = ({
  handleCaptureImage,
  pendingPhotos,
  setPendingPhotos,
  setOfflineItems,
  setShowSurveyDialog,
  selectedPOIType,
  setCapturedData,
  capturedData,
  handleAutoCaptureAndLog,
}: UseMeasurementLoggingProps) => {
  // PERFORMANCE FIX: Use worker-based measurement logger for non-blocking, batched writes
  const measurementLogger = useMeasurementLogger();

  const [loggingMode, setLoggingMode] = useState<
    "manual" | "all" | "detection" | "manualDetection" | "counterDetection"
  >("manual");
  const [isLogging, setIsLogging] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [_lastLoggedMeasurement, setLastLoggedMeasurement] = useState<
    string | null
  >(null);
  const [lastDisplayedMeasurement, setLastDisplayedMeasurement] = useState<
    string | null
  >(null);
  const loggingIntervalRef = useRef<number | null>(null);
  const measurementBuffer = useRef<string[]>([]);
  const isDetectingObject = useRef<boolean>(false);
  const lastLaserOutput = useRef<string>("");
  const detectionStartTime = useRef<Date | null>(null);
  const prevMeasurementRef = useRef<string | null>(null);
  const stopRequested = useRef<boolean>(false);

  // CRITICAL FIX: Event-level deduplication to prevent duplicate POI logging
  // Tracks processed POI events using composite key: kind-lat-lon-timestamp
  const processedEventIds = useRef<Set<string>>(new Set());

  // HYBRID ARCHITECTURE FIX: Ref to store latest capture, bypassing React state batching
  const latestCaptureRef = useRef<{ imageId: string; dataUrl: string } | null>(
    null,
  );

  // PERFORMANCE FIX: Helper to convert image IDs to data URLs
  // Now pendingPhotos contains UUIDs (< 50 bytes) instead of multi-MB base64 strings
  const getImagesAsDataURLs = async (imageIds: string[]): Promise<string[]> => {
    const dataUrls: string[] = [];
    for (const id of imageIds) {
      try {
        const dataUrl = await getDetectionImageDataURL(id);
        if (dataUrl) {
          dataUrls.push(dataUrl);
        } else {
          // If ID is actually a data URL (fallback compatibility), use it directly
          if (id.startsWith("data:")) {
            dataUrls.push(id);
          }
        }
      } catch (error) {
        logger.error(`Failed to retrieve image ${id}:`, error);
        // Check if it's already a data URL (fallback)
        if (id.startsWith("data:")) {
          dataUrls.push(id);
        }
      }
    }
    return dataUrls;
  };

  // PERFORMANCE FIX: Helper to clear pending photos and cleanup IndexedDB
  const clearPendingPhotos = async () => {
    // Delete images from IndexedDB (ignore errors for data URLs)
    const imageIdsToDelete = pendingPhotos.filter(
      (id) => !id.startsWith("data:"),
    );
    if (imageIdsToDelete.length > 0) {
      try {
        await deleteDetectionImages(imageIdsToDelete);
        logger.debug(
          `🗑️ Cleaned up ${imageIdsToDelete.length} detection images from IndexedDB`,
        );
      } catch (error) {
        logger.warn("Failed to cleanup detection images:", error);
      }
    }
    setPendingPhotos([]);
  };

  // HYBRID ARCHITECTURE FIX: Capture image and resolve to both ID and data URL synchronously
  // This bypasses React state batching to ensure image pairs correctly with POI
  // DATA INTEGRITY FIX: Accept optional overrides to ensure overlay matches database values
  const captureAndResolveImage = async (options?: {
    heightOverride?: string;
    gpsOverride?: { latitude: number; longitude: number; altitude?: number };
  }): Promise<{
    imageId: string;
    dataUrl: string;
  } | null> => {
    const imageId = await captureImageWithBuffer(options);
    if (!imageId) {
      logger.warn("📸 Image capture failed, returning null");
      return null;
    }

    // FALLBACK HANDLING: Check if imageId is already a data URL (IndexedDB save failed)
    let dataUrl: string;
    if (imageId.startsWith("data:")) {
      // imageId is already a data URL from fallback path
      logger.debug("📸 Using data URL directly from fallback path");
      dataUrl = imageId;
    } else {
      // imageId is a storage key, need to convert to data URL
      const retrievedDataUrl = await getDetectionImageDataURL(imageId);
      if (!retrievedDataUrl) {
        logger.error("📸 Failed to convert image ID to data URL:", imageId);
        return null;
      }
      dataUrl = retrievedDataUrl;
    }

    const capture = { imageId, dataUrl };
    latestCaptureRef.current = capture;
    logger.debug(
      `📸 Captured and resolved image: ID=${imageId.substring(0, 8)}..., size=${dataUrl.length} bytes`,
    );
    return capture;
  };

  // HYBRID ARCHITECTURE FIX: Cleanup helper to discard capture assets
  const discardCaptureAssets = async (imageIds: string[]) => {
    await deleteDetectionImages(imageIds);
    latestCaptureRef.current = null;
    logger.debug(`🗑️ Discarded ${imageIds.length} capture asset(s)`);
  };

  // HYBRID ARCHITECTURE FIX: Helper to remove specific capture assets
  const removeCaptureAssets = async (imageIds: string[]) => {
    // Filter out data URLs (only remove IndexedDB-stored images)
    const idsToRemove = imageIds.filter((id) => !id.startsWith("data:"));
    if (idsToRemove.length > 0) {
      await deleteDetectionImages(idsToRemove);
      logger.debug(
        `🗑️ Removed ${idsToRemove.length} capture asset(s) from IndexedDB`,
      );
    }
  };

  // Manual Detection state machine refs (deprecated, replaced by OverheadAggregator)
  const manualDetectionBuffer = useRef<
    Array<{ timestamp: number; value: number; raw: string }>
  >([]);
  const manualDetectionState = useRef<"idleSky" | "buffering" | "skyHold">(
    "idleSky",
  );
  const skyHoldTimer = useRef<number | null>(null);
  const detectionMetadata = useRef<{
    startTime: number;
    minValue: number;
    maxValue: number;
    count: number;
  }>({
    startTime: 0,
    minValue: Infinity,
    maxValue: -Infinity,
    count: 0,
  });

  // NEW: Overhead Aggregator for advanced Manual Detection
  const aggregatorRef = useRef<OverheadAggregator | null>(null);
  const lastFeedTime = useRef<number>(0);

  // Counter Detection Aggregator for Counter Detection mode
  const counterAggregatorRef = useRef<CounterDetectionAggregator | null>(null);
  const _lastCounterFeedTime = useRef<number>(0);
  
  // RSA HIGH-SPEED: Buffer for all RSA measurements (populated via event listener)
  // This captures EVERY measurement at full rate, not just throttled UI updates
  const rsaMeasurementBuffer = useRef<string[]>([]);

  // Bridge & Wires detection buffer - uses BufferedDetection type from bridgeAndWiresUtils
  const bridgeAndWiresBuffer = useRef<BufferedDetection[]>([]);
  const bridgeAndWiresTimeout = useRef<number | null>(null);
  const bridgeAndWiresAssets = useRef<{
    pendingPhotos: string[];
    videoTimestamp: number | null;
  }>({ pendingPhotos: [], videoTimestamp: null });
  const bridgeAndWiresFlushPromise = useRef<Promise<void> | null>(null); // Promise-based mutex for atomic re-entrancy guard

  // Automatic alert threshold logging refs
  const lastAlertLoggedRef = useRef<{ warning: number; critical: number }>({
    warning: 0,
    critical: 0,
  });
  const alertCooldownMs = 5000; // 5 seconds cooldown between same-type alerts

  const { laserPort, gpsPort, lastMeasurement } = useSerialStore();
  const { data: gpsData, connected: gpsStoreConnected } = useGPSStore();
  const { activeSurvey } = useSurveyStore();
  const { groundReferenceHeight } = useLaserStore();
  const { selectedType: _selectedType, getSelectedType } = usePOIStore();
  const { alertSettings, loggingSettings } = useSettingsStore();
  const {
    videoMode,
    videoBufferDuration: _videoBufferDuration,
    overlayOptions,
  } = useCameraStore();
  const [videoRecordingInProgress, setVideoRecordingInProgress] =
    useState(false);

  const {
    laserStatus: btLaserStatus,
    gpsStatus: btGpsStatus,
    lastBluetoothMeasurement,
  } = useBluetoothStore();

  const isWiredLaserConnected = laserPort !== null;
  const isWiredGpsConnected = gpsPort !== null;
  const isBluetoothLaserConnected = btLaserStatus === "connected";
  const isBluetoothGpsConnected = btGpsStatus === "connected";
  // Duro/GNSS is connected when gpsStore reports connected AND source is 'duro'
  const isDuroConnected = gpsStoreConnected && gpsData.source === 'duro';
  // Browser GPS failsafe is equivalent to hardware GPS for logging purposes
  const isBrowserGpsConnected = gpsStoreConnected && gpsData.source === 'browser';

  const hasLaserConnection = isWiredLaserConnected || isBluetoothLaserConnected;
  // GPS connection can be from USB, Bluetooth, Duro/GNSS, OR browser failsafe
  const hasGpsConnection = isWiredGpsConnected || isBluetoothGpsConnected || isDuroConnected || isBrowserGpsConnected;

  // Get alert settings with defaults
  const settings = alertSettings || {
    thresholds: {
      minHeight: 4,
      maxHeight: 25,
      warningThreshold: 0.0,
      criticalThreshold: 0.0,
    },
  };

  // Buffer Detection Service callback setup
  // Creates POI when buffer completes (distance/time target reached or POI type change)
  useEffect(() => {
    // BUG 2 FIX: Read activeSurvey and gpsData from stores inside the callback
    // instead of relying on closure values. This prevents stale-closure bugs
    // (activeSurvey was null at registration time) and eliminates the 10-Hz
    // re-registration race caused by gpsData in the dependency array.
    const handleBufferComplete = async (session: BufferSession) => {
      const currentSurvey = useSurveyStore.getState().activeSurvey;
      if (!currentSurvey || !session.minMeasurement) {
        logger.debug('[BufferDetection] No survey or no measurements - skipping POI creation');
        return;
      }

      if (!shouldRecordHeightClearance(session.poiType)) {
        logger.debug(`[BufferDetection] POI type "${session.poiType}" doesn't record height clearance - skipping`);
        return;
      }

      const bufferPoiAction = usePOIActionsStore.getState().getActionForPOI(session.poiType);
      if (bufferPoiAction === 'auto-capture-and-log' && handleAutoCaptureAndLog) {
        const rawValues = session.measurements.map(m => m.value);
        logger.debug(`[BufferDetection] Delegating to handleAutoCaptureAndLog with ${rawValues.length} raw measurements`);
        await handleAutoCaptureAndLog(rawValues);
        return;
      }

      const groundRef = useLaserStore.getState().groundReferenceHeight || 0;
      const adjustedMeasurementValue = session.minMeasurement.value + groundRef;

      // CRITICAL: Validate measurement is within ignoreAbove/ignoreBelow thresholds
      // BUG 2 FIX: Read from store to avoid stale closure
      const currentSettings = useSettingsStore.getState().alertSettings || { thresholds: { minHeight: 4, maxHeight: 25 } };
      if (adjustedMeasurementValue < currentSettings.thresholds.minHeight || adjustedMeasurementValue > currentSettings.thresholds.maxHeight) {
        logger.debug(`[BufferDetection] Measurement ${adjustedMeasurementValue.toFixed(2)}m outside thresholds [${currentSettings.thresholds.minHeight}, ${currentSettings.thresholds.maxHeight}] - skipping`);
        return;
      }

      logger.debug(`[BufferDetection] Buffer complete for ${session.poiType}, creating POI with min=${adjustedMeasurementValue.toFixed(2)}m (raw=${(session.minMeasurement.value ?? 0).toFixed(2)}m + groundRef=${groundRef.toFixed(2)}m)`);

      try {
        // Capture image at the location of the minimum measurement
        const capture = await captureAndResolveImage({
          heightOverride: adjustedMeasurementValue.toFixed(2) + 'm',
          gpsOverride: {
            latitude: session.minMeasurement.latitude,
            longitude: session.minMeasurement.longitude,
            altitude: session.minMeasurement.altitude,
          },
        });

        if (!capture) {
          logger.warn('[BufferDetection] No camera frame available — logging POI without image');
        }

        // Get next POI number
        let nextPoiNumber = 1;
        try {
          const { getNextPOINumber } = await import('../lib/survey/measurements');
          nextPoiNumber = await getNextPOINumber(currentSurvey.id);
        } catch (err) {
          logger.error('[BufferDetection] Failed to get next POI number:', err);
        }

        // Derive road number from survey projectNumber or default to 1
        let roadNumber = 1;
        if (currentSurvey?.projectNumber) {
          const parsed = parseInt(currentSurvey.projectNumber);
          if (!isNaN(parsed) && parsed > 0) {
            roadNumber = parsed;
          }
        }

        // Get video timestamp if recording
        let videoTimestamp: number | null = null;
        try {
          const { useVideoRecordingStore } = await import('../stores/videoRecordingStore');
          const recordingState = useVideoRecordingStore.getState();
          if (recordingState.isRecording && recordingState.recordingStartTime) {
            videoTimestamp = Date.now() - recordingState.recordingStartTime;
          }
        } catch (err) {}

        const isMeasurementFree = isMeasurementFreePOI(session.poiType);

        // #85 FIX: Proper note format with POI label, readings, GND REF
        const { POI_TYPES } = await import('../lib/poi');
        const poiConfig = POI_TYPES.find(p => p.type === session.poiType);
        const poiLabel = poiConfig?.label || session.poiType;

        const allAdjusted = session.measurements
          .map(m => parseFloat((m.value + groundRef).toFixed(2)))
          .filter(v => v >= currentSettings.thresholds.minHeight && v <= currentSettings.thresholds.maxHeight);
        const minVal = allAdjusted.length > 0 ? Math.min(...allAdjusted) : adjustedMeasurementValue;

        let bufferNote: string;
        if (isMeasurementFree) {
          bufferNote = poiLabel;
        } else {
          if (allAdjusted.length > 1) {
            const readingsStr = allAdjusted.map(v => `${v.toFixed(2)}m`).join(', ');
            bufferNote = `Readings: ${readingsStr} | Min: ${minVal.toFixed(2)}m | GND REF: ${groundRef.toFixed(2)}m | ${poiLabel}`;
          } else {
            bufferNote = `Height: ${adjustedMeasurementValue.toFixed(2)}m | GND REF: ${groundRef.toFixed(2)}m | ${poiLabel}`;
          }
        }

        // BUG 2 FIX: Read live GPS data from store (not stale closure)
        const currentGpsData = useGPSStore.getState().data;

        const now = new Date();
        const measurement = {
          id: crypto.randomUUID(),
          rel: isMeasurementFree ? null : roundMeasurement(minVal),
          altGPS: roundMeasurement(session.minMeasurement.altitude ?? null),
          latitude: session.minMeasurement.latitude,
          longitude: session.minMeasurement.longitude,
          utcDate: now.toISOString().split('T')[0],
          utcTime: now.toTimeString().split(' ')[0],
          speed: roundMeasurement(currentGpsData.speed),
          heading: roundMeasurement(currentGpsData.course),
          roadNumber: roadNumber,
          poiNumber: nextPoiNumber,
          note: bufferNote,
          createdAt: now.toISOString(),
          user_id: currentSurvey.id,
          source: 'buffer' as const,
          poi_type: session.poiType,
          imageUrl: capture?.dataUrl || null,
          images: capture ? [capture.dataUrl] : [],
          videoTimestamp: videoTimestamp,
          measurementFree: isMeasurementFree,
        };

        await measurementLogger.logMeasurement(measurement);

        // Add to timelapse if active (skip wires/trees)
        if (
          capture &&
          useCameraStore.getState().isTimelapseActive &&
          session.poiType !== 'wire' &&
          session.poiType !== 'tree'
        ) {
          try {
            await addPOIFrameToTimelapse(capture.dataUrl, measurement);
            logger.debug('[BufferDetection] Added POI to timelapse');
          } catch (timelapseError) {
            logger.error('[BufferDetection] Timelapse frame failed:', timelapseError);
          }
        }

        // Cleanup - skip data URLs (only delete IndexedDB-stored images)
        if (capture && !capture.imageId.startsWith('data:')) {
          await discardCaptureAssets([capture.imageId]);
        }

        setOfflineItems((prev) => prev + 1);
        soundManager.playLogEntry();

        toast.success(`Buffered POI logged: ${adjustedMeasurementValue.toFixed(2)}m`, {
          description: `${session.measurements.length} readings collected${groundRef > 0 ? ` (incl. ${groundRef.toFixed(2)}m ground ref)` : ''}`,
        });

        logger.debug(`[BufferDetection] POI created successfully: ${adjustedMeasurementValue.toFixed(2)}m (${session.measurements.length} readings, groundRef=${groundRef.toFixed(2)}m)`);
      } catch (error) {
        logger.error('[BufferDetection] Failed to create POI:', error);
        toast.error('Failed to log buffered POI');
      }
    };

    bufferDetectionService.setCallbacks({
      onComplete: handleBufferComplete,
      onProgress: (progress) => {
        logger.debug(`[BufferDetection] Progress: ${progress.progressPercent.toFixed(0)}%, min=${progress.currentMin?.toFixed(2) ?? 'N/A'}m`);
      },
    });

    return () => {
      bufferDetectionService.setCallbacks({});
    };
  }, [measurementLogger]);

  // Helper function to capture image with buffered frames if available
  // STEP 3 FIX: Return ID from BOTH buffered AND live capture paths
  // DATA INTEGRITY FIX: Accept optional heightOverride to ensure overlay shows the SAME value saved to database
  const captureImageWithBuffer = async (options?: {
    heightOverride?: string;
    gpsOverride?: { latitude: number; longitude: number; altitude?: number };
  }): Promise<string | null> => {
    const captureDelay = loggingSettings?.captureDelay ?? 1.0;
    const bufferStats = frameBuffer.getBufferStats();

    // Check if frame buffer has frames and is old enough for the requested offset
    if (
      bufferStats.isRunning &&
      bufferStats.frameCount > 0 &&
      bufferStats.oldestFrameAge >= captureDelay
    ) {
      logger.debug(
        `📸 Attempting buffered capture with ${captureDelay}s delay (buffer has ${bufferStats.frameCount} frames, oldest: ${bufferStats.oldestFrameAge.toFixed(1)}s)`,
      );

      // DATA INTEGRITY FIX: Use override values if provided, otherwise use current values
      // This ensures the overlay shows the EXACT same value that gets saved to the database
      const heightToShow = options?.heightOverride || lastMeasurement || "0.00m";
      const gpsToShow = options?.gpsOverride || {
        latitude: gpsData.latitude,
        longitude: gpsData.longitude,
        altitude: gpsData.altitude,
      };

      // Generate a temporary POI ID for the overlay (first 8 chars of UUID)
      const tempPoiId = crypto.randomUUID().substring(0, 8);
      
      // Prepare overlay data
      const overlayData = {
        poi: tempPoiId,
        poiType: currentPOIType || '',
        gps: gpsToShow,
        height: heightToShow,
        course: gpsData.course,
        time: new Date().toISOString(),
        surveyTitle: activeSurvey?.title,
        projectNumber: activeSurvey?.projectNumber,
        surveyorName: activeSurvey?.surveyorName,
      };

      const overlayOpts = overlayOptions || {
        showPOI: true,
        showPOIType: true,
        showGPS: true,
        showHeight: true,
        showDateTime: true,
        showHeading: true,
        showLogo: false,
        showSurveyTitle: true,
        showProjectNumber: true,
        showSurveyorName: true,
      };

      try {
        // PERFORMANCE OPTIMIZATION: Use async queue to eliminate main thread blocking
        const result = await captureQueue.queueBufferedCapture(
          captureDelay,
          overlayData,
          overlayOpts,
          "image/jpeg",
        );

        if (result) {
          logger.debug("✅ Buffered capture successful (queued)");
          // PERFORMANCE FIX: Save to IndexedDB and store only the ID
          try {
            const imageId = await saveDetectionImage(result.dataUrl);
            setPendingPhotos([...pendingPhotos, imageId]);
            logger.debug(`💾 Saved detection image to IndexedDB: ${imageId}`);
            return imageId; // Return the ID from buffered capture path
          } catch (saveError) {
            logger.error(
              "Failed to save detection image, falling back to inline storage:",
              saveError,
            );
            // Fallback: store data URL directly (old behavior)
            setPendingPhotos([...pendingPhotos, result.dataUrl]);
            return result.dataUrl; // Return the data URL from buffered capture path
          }
        } else {
          logger.debug(
            "⚠️ Buffered capture returned null, falling back to live capture",
          );
        }
      } catch (error) {
        logger.debug(
          "⚠️ Buffered capture failed, falling back to live capture:",
          error,
        );
      }
    } else {
      logger.debug(
        `⚠️ Buffer not ready (running: ${bufferStats.isRunning}, frames: ${bufferStats.frameCount}, age: ${bufferStats.oldestFrameAge.toFixed(1)}s, need: ${captureDelay}s)`,
      );
    }

    // ARCHITECT'S FIX: Fallback to live capture - now RETURNS data URL from Promise
    logger.debug("📸 Using live capture (fallback)");
    const dataUrl = await handleCaptureImage(); // Now returns Promise<string | null>
    return dataUrl; // Return data URL or null from live capture path
  };

  // Flush Bridge & Wires buffer and log detections
  const flushBridgeAndWiresBuffer = async () => {
    // CRITICAL FIX: Debug logging for flush tracking
    logger.debug("🔄 flushBridgeAndWiresBuffer CALLED", {
      bufferLength: bridgeAndWiresBuffer.current.length,
      flushInProgress: bridgeAndWiresFlushPromise.current !== null,
      currentPOIType: selectedPOIType,
      callStack: new Error().stack?.split("\n").slice(1, 4).join(" -> "),
    });

    // CRITICAL FIX: Only flush if we're still in Bridge & Wires mode
    // This prevents stale timeouts from creating unwanted wire/tree POIs after POI type change
    if (selectedPOIType !== "bridgeAndWires") {
      logger.debug(
        "🚫 FLUSH BLOCKED - Not in Bridge & Wires mode, discarding buffer",
        {
          currentPOIType: selectedPOIType,
          discardedDetections: bridgeAndWiresBuffer.current.length,
        },
      );
      // Discard buffer and cancel timeout
      bridgeAndWiresBuffer.current = [];
      bridgeAndWiresAssets.current = {
        pendingPhotos: [],
        videoTimestamp: null,
      };
      if (bridgeAndWiresTimeout.current !== null) {
        clearTimeout(bridgeAndWiresTimeout.current);
        bridgeAndWiresTimeout.current = null;
      }
      return;
    }

    // CRITICAL FIX: Promise-based mutex for atomic re-entrancy guard
    if (bridgeAndWiresFlushPromise.current) {
      logger.debug(
        "🚫 FLUSH BLOCKED - Already in progress, waiting for completion",
      );
      await bridgeAndWiresFlushPromise.current;
      return;
    }

    if (bridgeAndWiresBuffer.current.length === 0) {
      logger.debug("⚠️ Buffer empty, skipping flush");
      return;
    }

    // Create promise and start flush
    bridgeAndWiresFlushPromise.current = (async () => {
      logger.debug("🔒 Flush mutex LOCKED - starting atomic flush");

      const detectionsToFlush = [...bridgeAndWiresBuffer.current];
      const assetsToUse = { ...bridgeAndWiresAssets.current };

      // CRITICAL FIX 2: Clear buffer and timeout IMMEDIATELY BEFORE async operations
      bridgeAndWiresBuffer.current = [];
      bridgeAndWiresAssets.current = {
        pendingPhotos: [],
        videoTimestamp: null,
      };
      if (bridgeAndWiresTimeout.current !== null) {
        clearTimeout(bridgeAndWiresTimeout.current);
        bridgeAndWiresTimeout.current = null;
      }

      logger.debug(
        `✅ BUFFER CLEARED IMMEDIATELY - ${detectionsToFlush.length} detections snapshotted for processing, buffer now empty`,
        {
          snapshotCount: detectionsToFlush.length,
          currentBufferLength: bridgeAndWiresBuffer.current.length,
          assetsCleared:
            bridgeAndWiresAssets.current.pendingPhotos.length === 0,
        },
      );

      try {
        // CRITICAL: Skip reclassification if this is a retry (intendedPOIType already set)
        const isRetry = detectionsToFlush.every(
          (d): d is BufferedDetection => d.intendedPOIType !== undefined,
        );

        let classified: ClassifiedDetections;

        if (isRetry) {
          // Retry path: Use preserved types directly without reclassifying
          logger.debug("🔄 Retry detected, using preserved POI types");
          const bridges = detectionsToFlush.filter(
            (d): d is BufferedDetection => d.intendedPOIType === "overpass",
          );
          const wires = detectionsToFlush.filter(
            (d): d is BufferedDetection => d.intendedPOIType === "wire",
          );
          // Combined is never used anymore - we always classify
          const combined: BufferedDetection[] = [];
          classified = { bridges, wires, combined };
        } else {
          // First flush: Classify and set intendedPOIType
          logger.debug("🆕 First flush, classifying detections");
          classified = classifyDetections(detectionsToFlush);
        }

        // Log summary
        logger.debug(formatDetectionSummary(classified));

        // CRITICAL: Track successes/failures to only retry failed detections
        const failedDetections: BufferedDetection[] = [];

        // Helper to create POI entry with specific type
        const logDetectionWithType = async (
          detection: BufferedDetection,
          poiType: string,
        ): Promise<boolean> => {
          // Reuse logMeasurement logic but override POI type
          if (!activeSurvey) return false;
          if (!detection.capture) return false; // Safety check - capture should already exist

          try {
            // PERFORMANCE FIX: Generate measurement ID (worker handles deduplication)
            const measurementId = crypto.randomUUID();

            // HYBRID ARCHITECTURE FIX: Use stored capture (already resolved in loop below)
            const capture = detection.capture;
            logger.debug(
              "📸 Using stored capture for Bridge & Wires detection",
            );

            // Get road number (same method as All Data mode)
            let currentRoadNumber = 1;
            try {
              const surveyManagerElement =
                document.querySelector("select[value]");
              if (surveyManagerElement) {
                currentRoadNumber = parseInt(
                  (surveyManagerElement as HTMLSelectElement).value,
                );
              }
            } catch (err) {}

            const poiNumber = Math.floor(Math.random() * 10000);
            const _poiIdString = `R${String(currentRoadNumber).padStart(3, "0")}-ID-${String(poiNumber).padStart(5, "0")}`;

            // HYBRID ARCHITECTURE FIX: Use captured image directly
            const imagesToSave = [capture.dataUrl];

            // CRITICAL: Add ground reference to detection value for true height clearance
            const adjustedDetectionValue = detection.value + groundReferenceHeight;

            const newMeasurement = {
              rel: roundMeasurement(adjustedDetectionValue), // Round to 2 decimal places (includes ground ref)
              id: measurementId,
              altGPS: roundMeasurement(gpsData.altitude),
              latitude: gpsData.latitude,
              longitude: gpsData.longitude,
              utcDate: new Date().toISOString().split("T")[0],
              utcTime: new Date().toTimeString().split(" ")[0],
              speed: roundMeasurement(gpsData.speed),
              heading: roundMeasurement(gpsData.course),
              roadNumber: currentRoadNumber,
              poiNumber: poiNumber,
              poi_type: poiType, // Override with bridge or wire
              imageUrl: imagesToSave[0] || null,
              images: imagesToSave,
              videoTimestamp:
                detection.videoTimestamp || assetsToUse.videoTimestamp,
              note: `${roundMeasurement(adjustedDetectionValue).toFixed(2)}m${groundReferenceHeight > 0 ? ` (incl. ${groundReferenceHeight.toFixed(2)}m ground ref)` : ''}`,
              createdAt: new Date().toISOString(),
              user_id: activeSurvey.id,
            };

            // PERFORMANCE FIX: Send to worker immediately - worker handles deduplication
            await measurementLogger.logMeasurement(newMeasurement);

            // HYBRID ARCHITECTURE FIX: Add to timelapse if active (skip wires/trees)
            if (
              useCameraStore.getState().isTimelapseActive &&
              poiType !== "wire" &&
              poiType !== "tree"
            ) {
              try {
                await addPOIFrameToTimelapse(capture.dataUrl, newMeasurement);
                logger.debug("📹 Added Bridge & Wires POI to timelapse frame");
              } catch (err) {
                logger.error("Timelapse frame failed:", err);
              }
            }

            setOfflineItems((prev) => prev + 1);
            logger.debug(
              `✅ Logged ${poiType} POI:`,
              (detection.value ?? 0).toFixed(2),
              "m",
            );

            // ❌ NO cleanup here - moved to batch cleanup after all succeed

            return true; // Success
          } catch (err) {
            logger.error("Failed to log detection:", err);
            return false; // Failure
          }
        };

        // Track successful captures for cleanup
        const successfulCaptureIds: string[] = [];

        // SIMPLIFIED: Always create 2 separate POIs - never combine
        // bridges array = overpass POIs, wires array = wire POIs
        const allDetections = [
          ...classified.bridges.map((d) => ({
            detection: d,
            poiType: d.intendedPOIType || "overpass",
          })),
          ...classified.wires.map((d) => ({
            detection: d,
            poiType: d.intendedPOIType || "wire",
          })),
        ];

        // Capture all images in parallel
        const capturePromises = allDetections.map(async ({ detection }) => {
          if (!detection.capture) {
            const captureResult = await captureAndResolveImage();
            if (!captureResult) {
              logger.error(
                "Failed to capture image for Bridge & Wires detection",
              );
              return { detection, success: false };
            }
            detection.capture = captureResult;
          } else {
            logger.debug(
              "📸 Reusing stored capture for retry (preserving temporal accuracy)",
            );
          }
          return { detection, success: true };
        });

        const captureResults = await Promise.all(capturePromises);

        // Track failures from capture phase
        for (const result of captureResults) {
          if (!result.success) {
            failedDetections.push(result.detection);
          }
        }

        // Log all detections in parallel (only those with successful captures)
        const loggingPromises = allDetections
          .filter(({ detection }) => detection.capture) // Only process detections with captures
          .map(async ({ detection, poiType }) => {
            const success = await logDetectionWithType(
              detection,
              poiType as string,
            );
            return { detection, success, poiType };
          });

        const loggingResults = await Promise.all(loggingPromises);

        // Collect results
        for (const result of loggingResults) {
          if (!result.success) {
            failedDetections.push(result.detection);
          } else if (result.detection.capture) {
            successfulCaptureIds.push(result.detection.capture.imageId);
          }
        }

        // Check if any detections failed
        if (failedDetections.length > 0) {
          const error: any = new Error(
            `${failedDetections.length} detection(s) failed to log`,
          );
          error.failedDetections = failedDetections; // Attach failed detections to error
          throw error;
        }

        // All succeeded!
        // Play sounds
        soundManager.playLogEntry();
        soundManager.playMeasureDetected();

        // ✅ Cleanup ONLY after all succeed
        if (successfulCaptureIds.length > 0) {
          await clearPendingPhotos();
          await removeCaptureAssets(successfulCaptureIds);
          logger.debug(
            `🗑️ Cleaned up ${successfulCaptureIds.length} successful captures`,
          );
        }
      } catch (error: any) {
        // CRITICAL: Only restore FAILED detections to prevent duplicates on partial success
        // If error has failedDetections attached, use those; otherwise restore all (complete failure)
        const failedDetections: BufferedDetection[] =
          error.failedDetections || detectionsToFlush;

        // Only restore if survey still exists (don't restore if survey was deleted)
        if (activeSurvey && failedDetections.length > 0) {
          logger.debug(
            `🔄 Restoring ${failedDetections.length} failed detection(s) for retry`,
          );
          bridgeAndWiresBuffer.current = failedDetections;
          bridgeAndWiresAssets.current = assetsToUse;

          // Reset timeout for retry (6 seconds from now)
          if (bridgeAndWiresTimeout.current !== null) {
            clearTimeout(bridgeAndWiresTimeout.current);
          }
          bridgeAndWiresTimeout.current = window.setTimeout(() => {
            logger.debug(
              "⏰ Bridge & Wires retry timeout reached, flushing buffer",
            );
            flushBridgeAndWiresBuffer();
          }, 6000);

          toast.error(
            "Failed to log Bridge & Wires detections. Will retry in 6 seconds...",
          );
        } else {
          logger.debug("⚠️ Survey deleted, discarding Bridge & Wires buffer");
          toast.error(
            "Failed to log Bridge & Wires detections (no active survey)",
          );
        }
      } finally {
        // Always clear the promise mutex, even on error
        logger.debug("🔓 Flush mutex RELEASED");
      }
    })();

    // Wait for flush to complete
    await bridgeAndWiresFlushPromise.current;
    bridgeAndWiresFlushPromise.current = null;
  };

  // Log a single measurement
  const logMeasurement = async (_poiId?: string) => {
    if (
      !lastMeasurement ||
      lastMeasurement === "--" ||
      lastMeasurement === "infinity"
    ) {
      toast.error("No laser reading", {
        description: "Connect the laser and wait for a valid measurement before logging.",
        duration: 3000,
      });
      return;
    }
    logger.debug(
      "🔍 logMeasurement called with lastMeasurement:",
      lastMeasurement,
      "activeSurvey:",
      !!activeSurvey,
    );

    // CRITICAL: Filter out DE02 infinity codes
    if (
      lastMeasurement === "DE02" ||
      (typeof lastMeasurement === "string" && lastMeasurement.includes("DE02"))
    ) {
      logger.debug(
        "🔍 DE02 infinity code detected in logMeasurement, skipping",
      );
      return;
    }

    // If no active survey, dispatch event and prompt user
    if (!activeSurvey) {
      window.dispatchEvent(new CustomEvent("log-independent-measurement"));
      toast.error("Please create a survey first", {
        description: "Please create a new survey before logging measurements.",
        action: {
          label: "Create Survey",
          onClick: () => {
            if (typeof setShowSurveyDialog === "function") {
              setShowSurveyDialog(true);
            }
          },
        },
      });
      return;
    }

    // Check if measurement is within valid range
    let rawValue = parseFloat(lastMeasurement);

    // CRITICAL: Validate the raw value first
    if (isNaN(rawValue)) {
      logger.debug("🔍 Invalid raw value, skipping logging:", lastMeasurement);
      return;
    }

    // Use the utility function to convert to meters based on laser type
    const laserType = useSerialStore.getState().laserType;
    // Convert raw laser value to meters (no ground reference added here)
    const rawMeters = convertToMeters(rawValue, laserType);
    // Add ground reference to get the canonical height value used for BOTH
    // threshold decisions AND stored rel — must be the same value throughout
    let adjustedValue = parseFloat((rawMeters + groundReferenceHeight).toFixed(2));

    logger.debug(
      "🔍 Adjusted measurement value:",
      adjustedValue,
      "min:",
      settings.thresholds.minHeight,
      "max:",
      settings.thresholds.maxHeight,
    );

    // CRITICAL: Enforce the "ignore below" and "ignore above" thresholds strictly
    if (
      adjustedValue < settings.thresholds.minHeight ||
      adjustedValue > settings.thresholds.maxHeight
    ) {
      logger.debug(
        "🚫 FILTERING OUT - Measurement outside valid range:",
        adjustedValue,
        "min:",
        settings.thresholds.minHeight,
        "max:",
        settings.thresholds.maxHeight,
      );
      // Note: Removed annoying toast notification - filtered measurements are silent now
      return; // Skip logging for invalid measurements
    }

    logger.debug(
      "🔍 Measurement is within valid range, proceeding with logging",
    );

    const activePOIType = selectedPOIType || "none";
    const poiAction = usePOIActionsStore.getState().getActionForPOI(activePOIType);
    if (poiAction === 'auto-capture-and-log' && handleAutoCaptureAndLog && shouldRecordHeightClearance(activePOIType)) {
      if (loggingMode === 'manual' || loggingMode === 'all' || loggingMode === 'detection' || loggingMode === 'manualDetection' || loggingMode === 'counterDetection') {
        logger.debug(`🔍 Height-clearance POI "${activePOIType}" — delegating to handleAutoCaptureAndLog with rawMeters=${rawMeters}`);
        await handleAutoCaptureAndLog(rawMeters);
      }
      return;
    }

    // HYBRID ARCHITECTURE FIX: Capture image using new helper
    logger.debug("🔍 Capturing image for Counter Detection...");
    const capture = await captureAndResolveImage();
    if (!capture) {
      logger.warn("🔍 No camera frame available — proceeding without image");
    }

    // Get the current road number from SurveyManager component
    let currentRoadNumber = 1;
    try {
      const surveyManagerElement = document.querySelector("select[value]");
      if (surveyManagerElement) {
        currentRoadNumber = parseInt(
          (surveyManagerElement as HTMLSelectElement).value,
        );
      }
    } catch (err) {}

    // Generate POI number (random for now, ideally should be sequential)
    const poiNumber = Math.floor(Math.random() * 10000);
    const poiIdString = `R${String(currentRoadNumber).padStart(3, "0")}-ID-${String(poiNumber).padStart(5, "0")}`;
    logger.debug("🔍 Generated POI ID:", poiIdString);

    // Get the current POI type
    const currentPOIType = selectedPOIType || "none";
    logger.debug("🔍 Current POI type:", currentPOIType);

    // OPTIMIZATION: Get video timestamp synchronously (fast operation)
    // Note: This gets the timestamp offset from the current recording, if any
    let videoTimestamp: number | null = null;
    if (videoMode) {
      try {
        const { useVideoRecordingStore } = await import(
          "../stores/videoRecordingStore"
        );
        const recordingState = useVideoRecordingStore.getState();
        if (recordingState.isRecording && recordingState.recordingStartTime) {
          videoTimestamp = Date.now() - recordingState.recordingStartTime;
        }
      } catch (err) {}
    }

    // HYBRID ARCHITECTURE FIX: Use captured image directly from helper
    const imagesToSave = capture ? [capture.dataUrl] : [];

    // Update captured data with POI information (synchronous - fast)
    if (setCapturedData && capturedData && imagesToSave.length > 0) {
      const newCapturedData = [...capturedData];
      const lastIndex = newCapturedData.length - 1;

      if (lastIndex >= 0) {
        // Update the last captured image with the POI information
        newCapturedData[lastIndex] = {
          ...newCapturedData[lastIndex],
          overlayData: {
            ...newCapturedData[lastIndex].overlayData,
            poi: poiIdString,
            height: adjustedValue.toString(),
            gps: { latitude: gpsData.latitude, longitude: gpsData.longitude },
            course: gpsData.course,
          },
        };

        setCapturedData(newCapturedData);
      }
    }

    // Check if this is a measurement-free POI type
    const isMeasurementFree = isMeasurementFreePOI(currentPOIType);

    // Calculate the measurement value - round to 2 decimal places
    // Use adjustedValue (raw + ground reference) to be consistent with threshold check above.
    // For measurement-free POIs, set rel to null
    const measurementValue = isMeasurementFree
      ? null
      : roundMeasurement(adjustedValue);

    const GPS_STALE_THRESHOLD_MS = 5000;
    const gpsAge = gpsData.lastUpdate > 0 ? Date.now() - gpsData.lastUpdate : Infinity;
    const hasValidGpsFix =
      gpsData.fixQuality !== 'No Fix' &&
      (gpsData.latitude !== 0 || gpsData.longitude !== 0) &&
      gpsAge < GPS_STALE_THRESHOLD_MS;

    if (!hasValidGpsFix) {
      const reason =
        gpsData.fixQuality === 'No Fix' ? 'no GPS fix' :
        gpsAge >= GPS_STALE_THRESHOLD_MS ? `stale GPS data (${Math.round(gpsAge / 1000)}s old)` :
        'coordinates at 0,0';
      toast.warning(`Measurement logged without valid GPS (${reason})`, {
        description: "The entry is tagged 'noGpsFix' so it can be corrected later.",
        duration: 4000,
        id: "no-gps-fix-warning",
      });
    }

    let newMeasurement = {
      rel: measurementValue, // Rounded to 2 decimal places (x.xx meters), or null for measurement-free POIs
      id: crypto.randomUUID(),
      altGPS: roundMeasurement(gpsData.altitude),
      latitude: gpsData.latitude,
      longitude: gpsData.longitude,
      utcDate: new Date().toISOString().split("T")[0],
      utcTime: new Date().toTimeString().split(" ")[0],
      speed: roundMeasurement(gpsData.speed),
      heading: roundMeasurement(gpsData.course),
      roadNumber: currentRoadNumber,
      poiNumber: poiNumber,
      poi_type: currentPOIType || "none",
      imageUrl: imagesToSave[0] || null, // Primary image
      images: imagesToSave, // All captured images
      videoTimestamp, // Video timestamp in milliseconds
      note:
        loggingMode === "manual"
          ? `Manual measurement (${currentPOIType})`
          : `Auto-logged measurement (${currentPOIType})`,
      createdAt: new Date().toISOString(),
      user_id: activeSurvey.id,
      measurementFree: isMeasurementFree, // Explicit flag for measurement-free POIs
      noGpsFix: !hasValidGpsFix,
    };

    // CRITICAL FIX: Await database write to ensure data integrity and proper error handling
    logger.debug(
      `🔍 Adding measurement to database: images=${imagesToSave.length}, videoTimestamp=${videoTimestamp}ms`,
    );

    try {
      await measurementLogger.logMeasurement(newMeasurement);

      // HYBRID ARCHITECTURE FIX: Add POI to timelapse if active (skip wires/trees)
      if (
        useCameraStore.getState().isTimelapseActive &&
        currentPOIType !== "wire" &&
        currentPOIType !== "tree"
      ) {
        try {
          if (capture) {
            await addPOIFrameToTimelapse(capture.dataUrl, newMeasurement);
            logger.debug("📹 Added POI to timelapse frame");
          }
        } catch (timelapseError) {
          logger.error("Timelapse frame failed:", timelapseError);
        }
      }

      // 360° camera: fire-and-forget photo at every POI — never blocks, errors surface via banner
      {
        const cam360 = useCameraStore360.getState();
        if (cam360.cameraConnected && cam360.settings.capturePhotosAtPOI && cam360.activeSurveyId) {
          void cam360.capturePhotoPOI({
            lat: useGPSStore.getState().data?.lat ?? 0,
            lng: useGPSStore.getState().data?.lng ?? 0,
            altitude: useGPSStore.getState().data?.altitude ?? 0,
            heading: useGPSStore.getState().data?.heading ?? 0,
            surveyId: activeSurvey.id,
            poiType: currentPOIType ?? 'poi',
            poiLabel: newMeasurement.id
          });
        }
      }

      // AFTER SUCCESSFUL DATABASE WRITE: Update UI state and play feedback sounds
      setLastLoggedMeasurement(lastMeasurement);
      setLastDisplayedMeasurement(adjustedValue.toFixed(2));
      soundManager.playLogEntry();
      soundManager.playMeasureDetected();

      setOfflineItems((prev) => prev + 1);

      // HYBRID ARCHITECTURE FIX: Cleanup captured images
      await clearPendingPhotos();
      if (capture) await discardCaptureAssets([capture.imageId]);
      logger.debug(
        `✅ Measurement logged successfully: ${adjustedValue.toFixed(2)}m (road=${currentRoadNumber}, poi=${poiNumber}, type=${currentPOIType})`,
      );
    } catch (error) {
      toast.error("Failed to log measurement", {
        description:
          "Database write failed. Please try again or contact support.",
      });
      // Don't cleanup on error - allow retry with same images
      // Don't update UI state or play sounds on failure
    }
  };

  // Automatic alert threshold logging function
  const logAutomaticAlert = async (
    adjustedValue: number,
    severity: "warning" | "critical",
  ) => {
    const now = Date.now();
    const lastLogTime =
      severity === "warning"
        ? lastAlertLoggedRef.current.warning
        : lastAlertLoggedRef.current.critical;
    const thresholdValue =
      severity === "warning"
        ? settings.thresholds.warningThreshold
        : settings.thresholds.criticalThreshold;

    logger.debug(
      `🚨🚨🚨 ${severity.toUpperCase()} THRESHOLD CROSSED! Value: ${adjustedValue.toFixed(2)}m`,
    );

    // Check if we should log to database (only if survey exists and cooldown passed)
    if (!activeSurvey) {
      // CRITICAL FIX: No active survey - show error ONLY, do NOT trigger UI alerts or sounds
      logger.debug(
        "⚠️ No active survey - cannot trigger alert (no database save)",
      );
      toast.warning("Cannot trigger alert - no active survey", {
        description: `${adjustedValue.toFixed(2)}m crossed ${severity} threshold (${thresholdValue.toFixed(2)}m) but was not saved. Please create a survey first.`,
        duration: 5000,
      });
      return;
    }

    // Check cooldown to prevent spam logging
    if (now - lastLogTime < alertCooldownMs) {
      logger.debug(
        `⏰ Alert cooldown active (${Math.round((alertCooldownMs - (now - lastLogTime)) / 1000)}s remaining) - skipping database log`,
      );
      return;
    }

    // Update last log time
    if (severity === "warning") {
      lastAlertLoggedRef.current.warning = now;
    } else {
      lastAlertLoggedRef.current.critical = now;
    }

    logger.debug(`📝 Logging ${severity} alert to database...`);

    // HYBRID ARCHITECTURE FIX: Capture image using new helper
    const capture = await captureAndResolveImage();
    if (!capture) {
      toast.error(`Failed to capture image for ${severity} alert`);
      return;
    }

    // Get GPS data from BOTH sources
    const gpsStoreData = useGPSStore.getState();
    const gpsData = {
      latitude: gpsStoreData.data.latitude || 0,
      longitude: gpsStoreData.data.longitude || 0,
      altitude: gpsStoreData.data.altitude || 0,
      speed: gpsStoreData.data.speed || 0,
      heading: gpsStoreData.data.course || 0,
      source: gpsStoreData.data.source || "none",
    };

    // Get POI type from POI selector (user's active selection)
    // Use "none" as fallback when user selects "None" type (empty string)
    const detectionPOIType = usePOIStore.getState().selectedType || "none";

    // Get last POI number from database and increment
    let nextPoiNumber = 1;
    try {
      const { getNextPOINumber } = await import("../lib/survey/measurements");
      nextPoiNumber = await getNextPOINumber(activeSurvey.id);
    } catch (err) {}

    // Format note with threshold info and ground reference
    const groundRef = useLaserStore.getState().groundReferenceHeight || 0;
    const note = `AUTOMATIC ${severity.toUpperCase()} ALERT: ${adjustedValue.toFixed(2)}m crossed ${severity} threshold (${thresholdValue.toFixed(2)}m)${groundRef > 0 ? `. Ground ref: ${groundRef.toFixed(2)}m` : ''}`;

    // HYBRID ARCHITECTURE FIX: Use captured image directly
    const imagesToSave = [capture.dataUrl];
    const imageUrl = capture.dataUrl;
    const images = imagesToSave;

    const nowDate = new Date();
    const measurement = {
      id: crypto.randomUUID(),
      rel: roundMeasurement(adjustedValue), // Round to 2 decimal places
      altGPS: roundMeasurement(gpsData.altitude),
      latitude: gpsData.latitude,
      longitude: gpsData.longitude,
      utcDate: nowDate.toISOString().split("T")[0],
      utcTime: nowDate.toTimeString().split(" ")[0],
      speed: roundMeasurement(gpsData.speed),
      heading: roundMeasurement(gpsData.heading),
      roadNumber: activeSurvey.roadNumber || null,
      poiNumber: nextPoiNumber,
      note: note,
      createdAt: nowDate.toISOString(),
      user_id: activeSurvey.id,
      source: "detection" as const,
      poi_type: detectionPOIType,
      imageUrl: imageUrl,
      images: images,
    };

    // CRITICAL FIX: Await database write to ensure data integrity and proper error handling
    try {
      await measurementLogger.logMeasurement(measurement);

      // HYBRID ARCHITECTURE FIX: Add POI to timelapse if active (skip wires/trees)
      if (
        useCameraStore.getState().isTimelapseActive &&
        measurement.poi_type !== "wire" &&
        measurement.poi_type !== "tree"
      ) {
        try {
          await addPOIFrameToTimelapse(capture.dataUrl, measurement);
          logger.debug("📹 Added alert POI to timelapse frame");
        } catch (timelapseError) {
          logger.error("Timelapse frame failed:", timelapseError);
        }
      }

      // AFTER SUCCESSFUL DATABASE WRITE: Trigger UI alert and play sounds
      logger.debug(
        `🚨 Setting alert status to: ${severity}, trigger value: ${adjustedValue.toFixed(2)}m`,
      );
      useAlertsStore.getState().setAlertStatus(severity);
      useAlertsStore.getState().setTriggerValue(adjustedValue);

      if (severity === "critical") {
        soundManager.playCritical();
        logger.debug("🔊 Playing CRITICAL sound");
      } else {
        soundManager.playWarning();
        logger.debug("🔊 Playing WARNING sound");
      }

      toast.error(`${severity.toUpperCase()} Alert!`, {
        description: `${adjustedValue.toFixed(2)}m crossed ${severity} threshold (${thresholdValue.toFixed(2)}m)`,
        duration: severity === "critical" ? 15000 : 10000,
      });

      setOfflineItems((prev) => prev + 1);
      logger.debug(
        `✅ ${severity.toUpperCase()} alert logged to database: POI #${nextPoiNumber}, ${adjustedValue.toFixed(2)}m`,
      );

      // HYBRID ARCHITECTURE FIX: Cleanup
      await clearPendingPhotos();
      await discardCaptureAssets([capture.imageId]);
    } catch (err) {
      toast.error(`Failed to log ${severity} alert`, {
        description:
          "Database write failed. Alert not displayed to maintain state fidelity.",
      });
      // Don't cleanup on error - allow retry with same images
      // Don't trigger alert UI or sounds on failure to maintain state fidelity
    }
  };

  // Sky reading threshold - measurements at or below this are considered sky
  const SKY_READING_THRESHOLD_M = 0.1;

  // Helper function to check if measurement is "sky" (no object detected)
  // NOW checks the RAW laser output for recent sky readings, not just state
  // Also treats measurements <= 0.1m as sky (noise/ground reflection)
  const isSkyReading = (measurement: string | null): boolean => {
    // First check the state-based measurement
    if (!measurement) return true;
    if (
      measurement === "--" ||
      measurement === "infinity" ||
      measurement === "DE02"
    )
      return true;
    if (measurement.includes("DE02")) return true;

    // Check only the MOST RECENT raw output line for sky indicators
    const rawOutput = getLaserLog();
    if (rawOutput) {
      const recentLines = rawOutput.split("\n").filter(l => l.trim());
      const lastRawLine = recentLines.length > 0 ? recentLines[recentLines.length - 1] : '';

      if (
        lastRawLine.includes("DE02") ||
        lastRawLine.includes("-> --m") ||
        lastRawLine.includes("Received: --") ||
        lastRawLine.includes("[RSA] Invalid reading") ||
        lastRawLine.includes("[LDM71] --") ||
        lastRawLine.includes("[SolTec] --")
      ) {
        logger.debug("🌤️ Sky detected from raw output:", lastRawLine.trim());
        return true;
      }
    }

    // Parse numeric value
    const value = parseFloat(measurement);
    if (isNaN(value)) return true;

    // Also consider very high values as "sky" (> 50m)
    if (value > 50) return true;

    // CRITICAL: Treat measurements <= 0.1m as sky for ALL laser types
    // This catches noise, ground reflections, or invalid readings
    if (value <= SKY_READING_THRESHOLD_M) {
      logger.debug(
        `🌤️ Sky detected: raw value ${value.toFixed(3)}m <= ${SKY_READING_THRESHOLD_M}m threshold`,
      );
      return true;
    }

    return false;
  };

  // NEW: Process Manual Detection using OverheadAggregator
  const processManualDetection = async () => {
    // CRITICAL: Skip processing entirely if current POI type doesn't record height clearance
    const currentPOIType = selectedPOIType || getSelectedType();
    if (currentPOIType && !shouldRecordHeightClearance(currentPOIType)) {
      // Non-height-clearance POI type - don't auto-record measurements
      return;
    }

    if (!aggregatorRef.current) {
      aggregatorRef.current = new OverheadAggregator();
      logger.debug("🎯 OverheadAggregator initialized for Manual Detection");
    }

    const now = Date.now();

    // Throttle to 15 Hz (every ~67ms)
    if (now - lastFeedTime.current < 67) {
      return;
    }
    lastFeedTime.current = now;

    // CRITICAL: Notify aggregator of laser packet arrival (for watchdog)
    aggregatorRef.current.onLaserPacket(now);

    // Convert current measurement + GPS to Sample
    const sample: Sample = {
      t: now,
      lat: gpsData.latitude || 0,
      lon: gpsData.longitude || 0,
      headingDeg: gpsData.course || 0,
      speedKph: gpsData.speed || 0,
      rawDistM: null,
      status: {},
    };

    // Parse laser measurement
    const currentMeasurement = lastMeasurement;
    const isSky = isSkyReading(currentMeasurement);

    if (isSky) {
      sample.rawDistM = null;
      sample.status = { noTarget: true };
      logger.debug("🎯 Manual Detection: SKY reading (no target)");
    } else if (currentMeasurement && currentMeasurement !== "--") {
      const rawValue = parseFloat(currentMeasurement);
      if (!isNaN(rawValue)) {
        const laserType = useSerialStore.getState().laserType;
        const groundRef = useLaserStore.getState().groundReferenceHeight;
        sample.rawDistM = convertToMeters(rawValue, laserType, groundRef);
        logger.debug(
          `🎯 Manual Detection: OBJECT at ${sample.rawDistM?.toFixed(2)}m (raw: ${currentMeasurement}, +${groundRef.toFixed(2)}m ground ref)`,
        );
      }
    }

    // Feed sample to aggregator
    const pois = aggregatorRef.current.feed(sample);

    // Log diagnostics every 10 samples (reduce spam)
    if (Math.random() < 0.1) {
      const diag = aggregatorRef.current.getDiagnostics();
      logger.debug(
        `🎯 Aggregator Status: Phase=${diag.phase}, Baseline=${diag.baseline?.toFixed(2) || "null"}m, Current=${diag.lastDistM?.toFixed(2) || "null"}m, Speed=${gpsData.speed}km/h, Events=${diag.eventsEmittedTotal}`,
      );
    }

    // Handle POI emissions
    if (pois.length > 0) {
      logger.debug(`🎯🎯🎯 Aggregator emitted ${pois.length} POI(s)!`);
      for (const poi of pois) {
        await logPOI(poi);
      }
    }
  };

  // Log a POI from the OverheadAggregator
  const logPOI = async (poi: POI) => {
    // PERFORMANCE FIX: Worker handles deduplication - just validate and send
    logger.debug(
      `🎯 logPOI called for POI: ${poi.id}, kind=${poi.kind}, distance=${poi.distance_m}m`,
    );

    // CRITICAL FIX 2: Check if survey exists BEFORE any expensive operations
    if (!activeSurvey) {
      logger.debug("⚠️ No active survey - skipping POI logging");
      return;
    }

    const currentPOIType = selectedPOIType || getSelectedType() || poi.kind;
    if (!shouldRecordHeightClearance(currentPOIType)) {
      logger.debug(`🚫 POI type "${currentPOIType}" doesn't record height clearance - skipping`);
      return;
    }

    const lpPoiAction = usePOIActionsStore.getState().getActionForPOI(currentPOIType);
    if (lpPoiAction === 'auto-capture-and-log' && handleAutoCaptureAndLog) {
      logger.debug(`🎯 logPOI: delegating single measurement ${poi.distance_m}m to handleAutoCaptureAndLog`);
      await handleAutoCaptureAndLog(poi.distance_m);
      return;
    }

    const adjustedValue = poi.distance_m;
    if (
      adjustedValue < settings.thresholds.minHeight ||
      adjustedValue > settings.thresholds.maxHeight
    ) {
      logger.debug(
        `🚫 POI REJECTED - Outside valid range: ${adjustedValue.toFixed(2)}m (min: ${settings.thresholds.minHeight}m, max: ${settings.thresholds.maxHeight}m)`,
      );
      return; // Skip POI outside valid range - NO image capture, NO database write
    }

    logger.debug(
      `✅ POI ACCEPTED - Value ${adjustedValue.toFixed(2)}m is within range [${settings.thresholds.minHeight}m - ${settings.thresholds.maxHeight}m]`,
    );

    // Get road number (same method as All Data mode)
    let currentRoadNumber = 1;
    try {
      const surveyManagerElement = document.querySelector("select[value]");
      if (surveyManagerElement) {
        currentRoadNumber = parseInt(
          (surveyManagerElement as HTMLSelectElement).value,
        );
      }
    } catch (err) {}

    const poiNumber = Math.floor(Math.random() * 10000);

    const note = `AUTO-DETECTED ${poi.kind.toUpperCase()} - Distance: ${poi.distance_m}m, Source: ${poi.source}, Tags: ${poi.tags?.join(",") || "none"}`;

    // Get video timestamp if video is recording
    let videoTimestamp: number | null = null;
    if (videoMode && useCameraStore.getState().videoBuffer.length > 0) {
      const lastVideo = useCameraStore.getState().videoBuffer[0];
      if (lastVideo?.startTime) {
        // Calculate timestamp relative to video start
        videoTimestamp = Date.now() - lastVideo.startTime;
      }
    }

    const newMeasurement = {
      id: crypto.randomUUID(),
      rel: poi.distance_m,
      altGPS: gpsData.altitude,
      latitude: poi.lat,
      longitude: poi.lon,
      utcDate: new Date().toISOString().split("T")[0],
      utcTime: new Date().toTimeString().split(" ")[0],
      speed: gpsData.speed,
      heading: gpsData.course,
      roadNumber: currentRoadNumber,
      poiNumber,
      poi_type: currentPOIType,
      imageUrl: null, // Will be set after capture
      images: [], // Will be populated after capture
      videoTimestamp, // Video timestamp in milliseconds
      note,
      createdAt: new Date().toISOString(),
      user_id: activeSurvey.id,
    };

    try {
      // HYBRID ARCHITECTURE FIX: Capture image using new helper
      logger.debug("📸 Capturing image for AI POI...");
      const capture = await captureAndResolveImage();
      if (!capture) {
        logger.error(
          "Failed to capture image for AI POI - logging without image",
        );
        // Continue logging without image
      } else {
        // Update measurement with captured image
        newMeasurement.imageUrl = capture.dataUrl;
        newMeasurement.images = [capture.dataUrl];
      }

      // PERFORMANCE FIX: Send to worker immediately - worker handles deduplication
      await measurementLogger.logMeasurement(newMeasurement);
      logger.debug(`✅ POI sent to worker: ${poi.id}`);

      // HYBRID ARCHITECTURE FIX: Add POI to timelapse if active (skip wires/trees)
      if (
        capture &&
        useCameraStore.getState().isTimelapseActive &&
        currentPOIType !== "wire" &&
        currentPOIType !== "tree"
      ) {
        try {
          await addPOIFrameToTimelapse(capture.dataUrl, newMeasurement);
          logger.debug("📹 Added AI POI to timelapse frame");
        } catch (timelapseError) {
          logger.error("Timelapse frame failed:", timelapseError);
        }
      }

      setOfflineItems((prev) => prev + 1);
      soundManager.playLogEntry();
      soundManager.playMeasureDetected();

      // HYBRID ARCHITECTURE FIX: Cleanup
      if (capture) {
        await clearPendingPhotos();
        await discardCaptureAssets([capture.imageId]);
      }

      logger.debug(
        `🎯✅ POI LOGGED SUCCESSFULLY: ID=${poi.id}, Kind=${poi.kind}, Distance=${poi.distance_m}m, Road=${currentRoadNumber}, POI#=${poiNumber}, Images=${newMeasurement.images.length}, VideoTS=${videoTimestamp}ms`,
      );
    } catch (error) {
      logger.error(`❌ POI WRITE FAILED: ${poi.id}`, error);
      toast.error("Failed to log POI");
    }
  };

  // OLD Manual Detection (deprecated, kept for reference)
  const _processManualDetection_OLD = async () => {
    const currentMeasurement = lastMeasurement;
    const isSky = isSkyReading(currentMeasurement);
    const now = Date.now();

    logger.debug(
      `🎯 Manual Detection State: ${manualDetectionState.current}, Sky: ${isSky}, Measurement: ${currentMeasurement}`,
    );

    if (manualDetectionState.current === "idleSky") {
      // Waiting for object detection
      if (!isSky) {
        // Object detected! Start buffering
        logger.debug("🎯 Object detected, starting buffer");
        manualDetectionState.current = "buffering";
        const value = parseFloat(currentMeasurement || "0");
        const laserType = useSerialStore.getState().laserType;
        const valueInMeters = convertToMeters(
          value,
          laserType,
          groundReferenceHeight,
        );

        manualDetectionBuffer.current = [
          {
            timestamp: now,
            value: valueInMeters,
            raw: currentMeasurement || "",
          },
        ];
        detectionMetadata.current = {
          startTime: now,
          minValue: valueInMeters,
          maxValue: valueInMeters,
          count: 1,
        };
      }
    } else if (manualDetectionState.current === "buffering") {
      // Actively buffering object measurements
      if (!isSky) {
        // Still detecting object, add to buffer
        const value = parseFloat(currentMeasurement || "0");
        if (!isNaN(value)) {
          const laserType = useSerialStore.getState().laserType;
          const valueInMeters = convertToMeters(
            value,
            laserType,
            groundReferenceHeight,
          );

          manualDetectionBuffer.current.push({
            timestamp: now,
            value: valueInMeters,
            raw: currentMeasurement || "",
          });
          detectionMetadata.current.minValue = Math.min(
            detectionMetadata.current.minValue,
            valueInMeters,
          );
          detectionMetadata.current.maxValue = Math.max(
            detectionMetadata.current.maxValue,
            valueInMeters,
          );
          detectionMetadata.current.count++;

          logger.debug(
            `🎯 Buffering: ${manualDetectionBuffer.current.length} measurements, min: ${detectionMetadata.current.minValue.toFixed(2)}m`,
          );
        }
      } else {
        // Object lost, enter sky hold to confirm
        logger.debug("🎯 Object lost, entering sky hold");
        manualDetectionState.current = "skyHold";

        // Start settle timer (250ms)
        if (skyHoldTimer.current) clearTimeout(skyHoldTimer.current);
        skyHoldTimer.current = window.setTimeout(async () => {
          // Confirmed sky, finalize detection and log
          logger.debug("🎯 Sky confirmed, finalizing detection");
          await finalizeManualDetection();
        }, 250);
      }
    } else if (manualDetectionState.current === "skyHold") {
      // Waiting to confirm sky (anti-flicker)
      if (!isSky) {
        // Object reappeared, cancel sky hold and resume buffering
        logger.debug("🎯 Object reappeared, resuming buffering");
        if (skyHoldTimer.current) {
          clearTimeout(skyHoldTimer.current);
          skyHoldTimer.current = null;
        }
        manualDetectionState.current = "buffering";

        // Add current measurement to buffer
        const value = parseFloat(currentMeasurement || "0");
        if (!isNaN(value)) {
          const laserType = useSerialStore.getState().laserType;
          const valueInMeters = convertToMeters(
            value,
            laserType,
            groundReferenceHeight,
          );

          manualDetectionBuffer.current.push({
            timestamp: now,
            value: valueInMeters,
            raw: currentMeasurement || "",
          });
          detectionMetadata.current.minValue = Math.min(
            detectionMetadata.current.minValue,
            valueInMeters,
          );
          detectionMetadata.current.maxValue = Math.max(
            detectionMetadata.current.maxValue,
            valueInMeters,
          );
          detectionMetadata.current.count++;
        }
      }
      // If still sky, let the timer handle finalization
    }
  };

  // Finalize manual detection and log the lowest measurement
  const finalizeManualDetection = async () => {
    const buffer = manualDetectionBuffer.current;
    const metadata = detectionMetadata.current;

    // Require minimum 3 measurements to avoid noise
    if (buffer.length < 3) {
      logger.debug(
        `🎯 Buffer too small (${buffer.length} measurements), ignoring detection`,
      );
      resetManualDetection();
      return;
    }

    // Require minimum duration (150ms)
    const duration = Date.now() - metadata.startTime;
    if (duration < 150) {
      logger.debug(`🎯 Duration too short (${duration}ms), ignoring detection`);
      resetManualDetection();
      return;
    }

    // Find lowest measurement
    const lowestMeasurement = buffer.reduce((min, current) =>
      current.value < min.value ? current : min,
    );

    logger.debug(
      `🎯 Finalizing detection: ${buffer.length} measurements, min: ${lowestMeasurement.value.toFixed(2)}m, duration: ${duration}ms`,
    );

    if (!activeSurvey) {
      resetManualDetection();
      return;
    }

    const currentPOIType = selectedPOIType || getSelectedType();

    const mdPoiAction = usePOIActionsStore.getState().getActionForPOI(currentPOIType);
    if (mdPoiAction === 'auto-capture-and-log' && handleAutoCaptureAndLog && shouldRecordHeightClearance(currentPOIType)) {
      const rawValues = buffer.map(m => m.value);
      logger.debug(`🎯 ManualDetection: delegating ${rawValues.length} measurements to handleAutoCaptureAndLog`);
      await handleAutoCaptureAndLog(rawValues);
      resetManualDetection();
      return;
    }

    let currentRoadNumber = 1;
    try {
      const surveyManagerElement = document.querySelector("select[value]");
      if (surveyManagerElement) {
        currentRoadNumber = parseInt(
          (surveyManagerElement as HTMLSelectElement).value,
        );
      }
    } catch (err) {}

    const poiNumber = Math.floor(Math.random() * 10000);

    const groundRef = useLaserStore.getState().groundReferenceHeight || 0;
    const adjustedMinForNote = metadata.minValue + groundRef;
    const bufferValues = buffer.map((m) => (m.value + groundRef).toFixed(2) + 'm').join(', ');
    const detectionNote = `min=${adjustedMinForNote.toFixed(2)}m from ${buffer.length} readings (${bufferValues})${groundRef > 0 ? ` (incl. ${groundRef.toFixed(2)}m ground ref)` : ''}`;

    // Get video timestamp if video is recording
    let videoTimestamp: number | null = null;
    if (videoMode && useCameraStore.getState().videoBuffer.length > 0) {
      const lastVideo = useCameraStore.getState().videoBuffer[0];
      if (lastVideo?.timestamp) {
        videoTimestamp = Date.now() - new Date(lastVideo.timestamp).getTime();
      }
    }

    // HYBRID ARCHITECTURE FIX: Capture image using new helper
    // DATA INTEGRITY FIX: Pass the MINIMUM measurement value to the overlay
    // CRITICAL: Use the SAME rounding (2 decimals) as the database persistence
    // CRITICAL: Add ground reference for true height clearance
    logger.debug("📸 Capturing image for Manual Detection...");
    const adjustedMinValue = lowestMeasurement.value + groundRef;
    const roundedAdjustedValue = roundMeasurement(adjustedMinValue);
    const capture = await captureAndResolveImage({
      heightOverride: `${roundedAdjustedValue.toFixed(2)}m`,
    });
    if (!capture) {
      toast.error("Failed to capture image for Manual Detection");
      resetManualDetection();
      return;
    }

    const newMeasurement = {
      id: crypto.randomUUID(),
      rel: roundMeasurement(adjustedMinValue), // Round to 2 decimal places (includes ground ref)
      altGPS: roundMeasurement(gpsData.altitude),
      latitude: gpsData.latitude,
      longitude: gpsData.longitude,
      utcDate: new Date().toISOString().split("T")[0],
      utcTime: new Date().toTimeString().split(" ")[0],
      speed: roundMeasurement(gpsData.speed),
      heading: roundMeasurement(gpsData.course),
      roadNumber: currentRoadNumber,
      poiNumber,
      poi_type: currentPOIType,
      imageUrl: capture?.dataUrl || null, // Primary image
      images: capture ? [capture.dataUrl] : [], // All captured images
      videoTimestamp, // Video timestamp in milliseconds
      note: detectionNote,
      createdAt: new Date().toISOString(),
      user_id: activeSurvey.id,
    };

    try {
      await measurementLogger.logMeasurement(newMeasurement);

      // HYBRID ARCHITECTURE FIX: Add POI to timelapse if active (skip wires/trees)
      if (
        capture &&
        useCameraStore.getState().isTimelapseActive &&
        currentPOIType !== "wire" &&
        currentPOIType !== "tree"
      ) {
        try {
          await addPOIFrameToTimelapse(capture.dataUrl, newMeasurement);
          logger.debug("📹 Added Manual Detection POI to timelapse frame");
        } catch (timelapseError) {
          logger.error("Timelapse frame failed:", timelapseError);
        }
      }

      setOfflineItems((prev) => prev + 1);
      soundManager.playLogEntry();

      // HYBRID ARCHITECTURE FIX: Cleanup
      if (capture) {
        await clearPendingPhotos();
        await discardCaptureAssets([capture.imageId]);
      }

      logger.debug(
        `🎯 Manual detection logged: ${adjustedMinValue.toFixed(2)}m (raw=${lowestMeasurement.value.toFixed(2)}m + groundRef=${groundRef.toFixed(2)}m), POI: ${currentPOIType}, images: ${newMeasurement.images.length}, videoTimestamp: ${videoTimestamp}ms`,
      );
    } catch (error) {
      toast.error("Failed to log detection");
    }

    resetManualDetection();
  };

  // Reset manual detection state
  const resetManualDetection = () => {
    manualDetectionBuffer.current = [];
    manualDetectionState.current = "idleSky";
    if (skyHoldTimer.current) {
      clearTimeout(skyHoldTimer.current);
      skyHoldTimer.current = null;
    }
    detectionMetadata.current = {
      startTime: 0,
      minValue: Infinity,
      maxValue: -Infinity,
      count: 0,
    };

    // Reset OverheadAggregator
    if (aggregatorRef.current) {
      aggregatorRef.current.reset();
      logger.debug("🎯 OverheadAggregator reset");
    }

    // Reset CounterDetectionAggregator
    if (counterAggregatorRef.current) {
      counterAggregatorRef.current.reset();
      logger.debug("🔢 CounterDetectionAggregator reset");
    }
  };

  // COUNTER DETECTION STATE (vehicle-mounted laser pointing UP)
  // State flow: sky_baseline → object_detected → counting_sky → log → sky_baseline
  const counterDetectionStateRef = useRef<{
    mode: "sky_baseline" | "object_detected" | "counting_sky" | "idle";
    buffer: number[]; // All valid measurements while under object
    intensityBuffer: number[]; // RSA intensity values for diagnostics
    minValue: number | null;
    minIntensity: number | null; // Minimum intensity seen (for weak signal detection)
    skyCount: number;
    capturedImageId: string | null;
    lastProcessedSeq: number; // Track buffer length to detect NEW readings (not string content)
    startTime: number | null; // Timestamp when first object detected (for time-based buffer)
    startLatitude: number | null; // GPS latitude when first object detected (for distance-based buffer)
    startLongitude: number | null; // GPS longitude when first object detected (for distance-based buffer)
  }>({
    mode: "sky_baseline", // Start in sky (vehicle driving, laser pointing up)
    buffer: [],
    intensityBuffer: [],
    minValue: null,
    minIntensity: null,
    skyCount: 0,
    capturedImageId: null,
    lastProcessedSeq: 0,
    startTime: null,
    startLatitude: null,
    startLongitude: null,
  });

  // RSA HIGH-SPEED: Helper to process a single measurement for counter detection
  // This is called for each measurement in the RSA buffer
  const processCounterDetectionMeasurement = async (
    measurement: string,
    intensity: number | null,
    counterThreshold: number
  ) => {
    const state = counterDetectionStateRef.current;
    
    // Check if this is a sky reading
    const isSky = measurement === 'Sky' || measurement === '--' || measurement === 'infinity';
    
    // Parse distance if not sky
    let valueMeters: number | null = null;
    if (!isSky) {
      const parsed = parseFloat(measurement);
      if (!isNaN(parsed) && parsed > 0.1) {
        valueMeters = parsed;
      } else if (!isNaN(parsed) && parsed <= 0.1) {
        // Treat very close readings as sky (noise)
        return processCounterDetectionMeasurement('Sky', null, counterThreshold);
      }
    }
    
    if (valueMeters !== null) {
      // Valid object measurement
      if (state.mode === "sky_baseline") {
        // First measurement after sky - start detection
        state.mode = "object_detected";
        state.buffer = [valueMeters];
        state.minValue = valueMeters;
        state.skyCount = 0;
        state.startTime = Date.now();
        state.startLatitude = useGPSStore.getState().data.latitude;
        state.startLongitude = useGPSStore.getState().data.longitude;
        if (intensity !== null) {
          state.intensityBuffer = [intensity];
          state.minIntensity = intensity;
        }
        logger.debug(`🔢 Counter Detection: Object detected at ${valueMeters.toFixed(2)}m`);
      } else if (state.mode === "object_detected" || state.mode === "counting_sky") {
        // Continue tracking object
        state.mode = "object_detected";
        state.buffer.push(valueMeters);
        state.skyCount = 0;
        if (state.minValue === null || valueMeters < state.minValue) {
          state.minValue = valueMeters;
        }
        if (intensity !== null) {
          state.intensityBuffer.push(intensity);
          if (state.minIntensity === null || intensity < state.minIntensity) {
            state.minIntensity = intensity;
          }
        }
      }
    } else if (isSky) {
      // Sky reading
      if (state.mode === "object_detected") {
        // Start counting sky readings
        state.mode = "counting_sky";
        state.skyCount = 1;
      } else if (state.mode === "counting_sky") {
        state.skyCount++;
        
        // Check if we've seen enough consecutive sky readings to confirm end of object
        if (state.skyCount >= counterThreshold) {
          // Object detection complete - log POI
          if (state.buffer.length > 0 && state.minValue !== null) {
            const minMeasurement = state.minValue.toFixed(3);
            const readingCount = state.buffer.length;
            const avgIntensity = state.intensityBuffer.length > 0 
              ? Math.round(state.intensityBuffer.reduce((a, b) => a + b, 0) / state.intensityBuffer.length)
              : null;
            
            logger.debug(`🔢 Counter Detection: Object complete! Min=${minMeasurement}m from ${readingCount} readings`);
            
            // Set the measurement and log
            useSerialStore.getState().setLastLaserData(minMeasurement);
            
            // DATA INTEGRITY FIX: Capture image with the MINIMUM value
            // CRITICAL: Use 2 decimal rounding to match database persistence
            if (pendingPhotos.length === 0) {
              const roundedMin = parseFloat(minMeasurement).toFixed(2);
              await captureImageWithBuffer({
                heightOverride: `${roundedMin}m`,
              });
              await new Promise((resolve) => setTimeout(resolve, 200));
            }
            
            // Log with intensity info in notes
            const intensityNote = avgIntensity !== null ? `. Signal: min=${state.minIntensity}, avg=${avgIntensity}` : '';
            await logMeasurement();
          }
          
          // Reset state
          state.mode = "sky_baseline";
          state.buffer = [];
          state.intensityBuffer = [];
          state.minValue = null;
          state.minIntensity = null;
          state.skyCount = 0;
          state.startTime = null;
          state.startLatitude = null;
          state.startLongitude = null;
        }
      }
    }
  };

  // NEW: Process Counter Detection - uses RSA buffer for high-speed, laserOutput for ASCII
  const processCounterDetection = async () => {
    try {
      // CRITICAL: Skip processing entirely if current POI type doesn't record height clearance
      const currentPOIType = selectedPOIType || getSelectedType();
      if (currentPOIType && !shouldRecordHeightClearance(currentPOIType)) {
        // Non-height-clearance POI type - don't auto-record measurements
        return;
      }

      // Get threshold from config
      const configJson = localStorage.getItem("overhead_detection_config");
      let counterThreshold = 10; // Default: 10 consecutive sky readings to confirm end of object
      if (configJson) {
        try {
          const config = JSON.parse(configJson);
          if (config.global?.counterThreshold) {
            counterThreshold = config.global.counterThreshold;
          }
        } catch (e) {}
      }

      // ASCII LASER PATH: Use module-level laser log
      const rawOutput = getLaserLog();
      if (!rawOutput) {
        return;
      }

      // Get the last line (most recent)
      const lines = rawOutput.split("\n").filter((l) => l.trim());
      if (lines.length === 0) {
        return;
      }

      const lastLine = lines[lines.length - 1];

      // Check for valid measurement in FIVE formats:
      // 1. "[LASER] D xxxx.xxx [quality] -> y.yyyy m" (Astech/Jenoptik ASCII)
      //    Format with optional quality field: "D 0002.192 021.9 -> 2.192m"
      //    Format without quality field:       "D 0002.192 -> 2.192m"
      //    Regex: match anything between [LASER] and "-> value m"
      // 2. "Received: y.yyyy" (fallback from serialStore callback)
      // 3. "[LDM71] y.yyyym"
      // 4. "[RSA] y.yyyym" (legacy, no longer emitted but kept for robustness)
      // 5. "[SolTec] y.yyyym (xdB)" (new soltec-standard LDM71 driver path)
      let measurementMatch = lastLine.match(
        /\[LASER\].*->\s+([\d.]+)m/,
      );
      
      // Extract intensity for RSA laser (for diagnostics)
      let rsaIntensity: number | null = null;
      if (!measurementMatch) {
        // Try SolTec format: "[SolTec] 2.530m (18.6dB)"
        measurementMatch = lastLine.match(/\[SolTec\]\s+(\d+\.?\d+)m/);
      }
      if (!measurementMatch) {
        // Try LDM71 format: "[LDM71] 2.530m (18.6dB)"
        measurementMatch = lastLine.match(/\[LDM71\]\s+(\d+\.?\d+)m/);
      }
      if (!measurementMatch) {
        // Try RSA format: "[RSA] 5.230m (intensity: 120, raw: aa bb cc)"
        const rsaMatch = lastLine.match(/\[RSA\]\s+(\d+\.?\d+)m\s+\(intensity:\s*(\d+)/);
        if (rsaMatch) {
          measurementMatch = rsaMatch;
          rsaIntensity = parseInt(rsaMatch[2], 10);
        } else {
          // Try simpler RSA format without intensity
          measurementMatch = lastLine.match(/\[RSA\]\s+(\d+\.?\d+)m/);
        }
      }
      if (!measurementMatch) {
        // Try alternate format: "Received: 1.234"
        measurementMatch = lastLine.match(/Received:\s+(\d+\.?\d+)/);
      }

      // Check for sky: error codes, invalid readings, Sky marker, OR measurements <= 0.1m
      // CRITICAL: Only check the LAST LINE for sky indicators, not recent history
      // Otherwise a single DE02 would poison subsequent valid measurements
      let isSky =
        lastLine.includes("DE02") ||
        lastLine.includes("-> --m") ||
        lastLine.includes("Received: --") ||
        lastLine.includes("Received: Sky") ||
        lastLine.includes("[RSA] Sky") ||
        lastLine.includes("[RSA] Invalid reading") ||
        lastLine.includes("[LDM71] --") ||
        lastLine.includes("[SolTec] --");

      // CRITICAL: Also treat measurements <= 0.1m as sky (noise/ground reflection)
      if (!isSky && measurementMatch) {
        const measuredValue = parseFloat(measurementMatch[1]);
        if (!isNaN(measuredValue) && measuredValue <= 0.1) {
          isSky = true;
          logger.debug(
            `🔢 🌤️ Counter Detection: Measurement ${measuredValue.toFixed(3)}m <= 0.1m treated as SKY`,
          );
        }
      }

      const state = counterDetectionStateRef.current;

      // CRITICAL: Check if buffer has NEW data by comparing total line count
      const currentSeq = lines.length;
      if (currentSeq === state.lastProcessedSeq) {
        return; // Skip - no new lines added to buffer since last check
      }
      state.lastProcessedSeq = currentSeq;

      logger.debug("🔢 NEW", {
        seq: currentSeq,
        line: lastLine.substring(0, 40),
        mode: state.mode,
        isSky,
        hasMeasurement: !!measurementMatch,
      });

      // CRITICAL: Only treat as valid measurement if we have a match AND it's NOT a sky reading
      // (measurementMatch can exist but still be sky if value <= 0.1m)
      if (measurementMatch && !isSky) {
        // Overhead object detected (bridge, sign, wire)
        const valueMeters = parseFloat(measurementMatch[1]);

        // BUGFIX: 'idle' is set after handleAutoCaptureAndLog — treat same as sky_baseline
        if (state.mode === "idle") state.mode = "sky_baseline";

        if (state.mode === "sky_baseline") {
          // ISSUE 3 FIX: Apply filter check BEFORE capture to avoid wasting resources
          const adjustedValue = valueMeters + groundReferenceHeight;

          // Check if within valid range BEFORE capturing image
          if (
            adjustedValue >= settings.thresholds.minHeight &&
            adjustedValue <= settings.thresholds.maxHeight
          ) {
            // First object detected while driving - capture and buffer
            logger.debug(
              `🔢 ⚠️ OVERHEAD OBJECT! ${valueMeters.toFixed(2)}m (adjusted: ${adjustedValue.toFixed(2)}m)${rsaIntensity !== null ? ` intensity: ${rsaIntensity}` : ''} - PASSES FILTER, capturing image`,
            );
            state.mode = "object_detected";
            state.buffer = [valueMeters];
            state.intensityBuffer = rsaIntensity !== null ? [rsaIntensity] : [];
            state.minValue = valueMeters;
            state.minIntensity = rsaIntensity;
            state.skyCount = 0;

            // STEP 4 FIX: Capture image and STORE the returned ID/URL
            // DATA INTEGRITY FIX: Pass the current minimum value with 2 decimal rounding
            logger.debug("📸 Capturing overhead object image");
            const capturedImageId = await captureImageWithBuffer({
              heightOverride: `${valueMeters.toFixed(2)}m`,
            });
            state.capturedImageId = capturedImageId;
            logger.debug(
              `📸 Captured image ID: ${capturedImageId ? capturedImageId.substring(0, 20) + "..." : "null"}`,
            );
          } else {
            logger.debug(
              `🔢 🚫 FILTERED OUT - Overhead object ${valueMeters.toFixed(2)}m (adjusted: ${adjustedValue.toFixed(2)}m) outside valid range [${settings.thresholds.minHeight}, ${settings.thresholds.maxHeight}], skipping capture`,
            );
            // Don't transition to object_detected, stay in sky_baseline
            return;
          }
        } else if (state.mode === "object_detected") {
          // Still under object - continue buffering
          state.buffer.push(valueMeters);
          if (rsaIntensity !== null) {
            state.intensityBuffer.push(rsaIntensity);
            if (state.minIntensity === null || rsaIntensity < state.minIntensity) {
              state.minIntensity = rsaIntensity;
            }
          }
          if (state.minValue === null || valueMeters < state.minValue) {
            state.minValue = valueMeters;
            logger.debug(
              `🔢 Under object: ${valueMeters.toFixed(2)}m min${rsaIntensity !== null ? ` (intensity: ${rsaIntensity})` : ''} (buffer: ${state.buffer.length})`,
            );
          }
          // Reset sky count
          state.skyCount = 0;
        } else if (state.mode === "counting_sky") {
          // Another object detected while counting sky - back to buffering
          logger.debug(
            `🔢 ⚠️ Another object at ${valueMeters.toFixed(2)}m${rsaIntensity !== null ? ` (intensity: ${rsaIntensity})` : ''} - resuming buffer`,
          );
          state.mode = "object_detected";
          state.buffer.push(valueMeters);
          if (rsaIntensity !== null) {
            state.intensityBuffer.push(rsaIntensity);
            if (state.minIntensity === null || rsaIntensity < state.minIntensity) {
              state.minIntensity = rsaIntensity;
            }
          }
          if (state.minValue === null || valueMeters < state.minValue) {
            state.minValue = valueMeters;
          }
          state.skyCount = 0;
        }
      } else if (isSky) {
        // Sky detected
        // BUGFIX: 'idle' after a successful POI log — treat as sky_baseline
        if (state.mode === "idle") state.mode = "sky_baseline";

        if (state.mode === "object_detected") {
          // First sky after object - start counting
          state.mode = "counting_sky";
          state.skyCount = 1;
          logger.debug(
            `Counter Detection: Sky after object! Counting: 1/${counterThreshold}`,
          );
        } else if (state.mode === "counting_sky") {
          // Continue counting
          state.skyCount++;
          logger.debug(`🔢 Sky count: ${state.skyCount}/${counterThreshold}`);

          if (state.skyCount >= counterThreshold) {
            // Threshold reached - LOG POI!
            logger.debug(
              `🔢✅ Threshold reached! Logging minimum: ${state.minValue?.toFixed(2)}m`,
            );

            // BUGFIX: Always read activeSurvey from store (not closure) to handle auto-split surveys
            const currentActiveSurvey = useSurveyStore.getState().activeSurvey;
            if (state.minValue !== null && currentActiveSurvey) {
              // Apply ground reference
              const adjustedValue = state.minValue + groundReferenceHeight;

              // NOTE: Filter check already happened at capture time (line 1310), so this is a safety check
              // This should never filter anything out since we already filtered at capture
              if (
                adjustedValue >= settings.thresholds.minHeight &&
                adjustedValue <= settings.thresholds.maxHeight
              ) {
                const currentPOIType =
                  selectedPOIType || getSelectedType() || "overhead";

                const cdPoiAction = usePOIActionsStore.getState().getActionForPOI(currentPOIType);
                // BUGFIX: For HEIGHT_CLEARANCE types, always use handleAutoCaptureAndLog
                // even if cdPoiAction is not explicitly 'auto-capture-and-log' (stale localStorage)
                const isHeightClearancePOI = shouldRecordHeightClearance(currentPOIType);
                const shouldDelegate = handleAutoCaptureAndLog && isHeightClearancePOI && 
                  (cdPoiAction === 'auto-capture-and-log' || cdPoiAction === 'auto-capture-no-measurement');
                
                if (shouldDelegate) {
                  const rawValues = [...state.buffer];
                  logger.debug(`CounterDetection: delegating ${rawValues.length} measurements to handleAutoCaptureAndLog (action=${cdPoiAction})`);
                  await handleAutoCaptureAndLog(rawValues);
                  state.mode = "idle";
                  state.buffer = [];
                  state.minValue = null;
                  state.skyCount = 0;
                  return;
                }

                const isMeasurementFree = isMeasurementFreePOI(currentPOIType);
                if (isMeasurementFree) {
                  logger.debug(
                    `🔢 📋 Measurement-free POI type "${currentPOIType}" - creating POI without clearance height`,
                  );
                }

                let currentRoadNumber = 1;
                try {
                  const surveyManagerElement =
                    document.querySelector("select[value]");
                  if (surveyManagerElement) {
                    currentRoadNumber = parseInt(
                      (surveyManagerElement as HTMLSelectElement).value,
                    );
                  }
                } catch (e) {}

                // ISSUE 2 FIX: Convert capturedImageId to data URL if needed
                let imagesToSave: string[] = [];
                if (state.capturedImageId) {
                  // Check if it's already a data URL or needs to be loaded from IndexedDB
                  if (state.capturedImageId.startsWith("data:")) {
                    // Already a data URL, use directly
                    imagesToSave = [state.capturedImageId];
                    logger.debug(`📸 Using captured data URL directly for POI`);
                  } else {
                    // It's an IndexedDB ID, load the data URL
                    imagesToSave = await getImagesAsDataURLs([
                      state.capturedImageId,
                    ]);
                    logger.debug(
                      `📸 Loaded image from IndexedDB for POI: ${imagesToSave.length} images`,
                    );
                  }
                }

                // Get video timestamp if video is recording
                let videoTimestamp: number | null = null;
                if (videoMode) {
                  try {
                    const { useVideoRecordingStore } = await import(
                      "../stores/videoRecordingStore"
                    );
                    const recordingState = useVideoRecordingStore.getState();
                    if (
                      recordingState.isRecording &&
                      recordingState.recordingStartTime
                    ) {
                      videoTimestamp =
                        Date.now() - recordingState.recordingStartTime;
                    }
                  } catch (err) {}
                }

                // Create measurement object with proper field names (imageUrl, images, not photoIds)
                // BUG FIX: For measurement-free POI types, set rel to null (no clearance height)
                const newMeasurement: any = {
                  id: crypto.randomUUID(),
                  rel: isMeasurementFree ? null : roundMeasurement(adjustedValue), // No height for measurement-free types
                  altGPS: roundMeasurement(gpsData.altitude || 0),
                  latitude: gpsData.latitude || 0,
                  longitude: gpsData.longitude || 0,
                  utcDate: new Date().toISOString().split("T")[0],
                  utcTime: new Date().toTimeString().split(" ")[0],
                  speed: roundMeasurement(gpsData.speed || 0),
                  heading: roundMeasurement(gpsData.course || 0),
                  roadNumber: currentRoadNumber,
                  poiNumber: Math.floor(Math.random() * 10000),
                  poi_type: currentPOIType,
                  imageUrl: imagesToSave[0] || null, // Primary image
                  images: imagesToSave, // All captured images as data URLs
                  videoTimestamp, // Video timestamp in milliseconds
                  note: isMeasurementFree 
                    ? `${currentPOIType} marker (no clearance measurement)` 
                    : `min=${adjustedValue.toFixed(2)}m from ${state.buffer.length} readings (${state.buffer.map((v) => v.toFixed(2) + 'm').join(', ')})${state.intensityBuffer.length > 0 ? `. Signal: min=${state.minIntensity}, avg=${Math.round(state.intensityBuffer.reduce((a, b) => a + b, 0) / state.intensityBuffer.length)}` : ''}${groundReferenceHeight > 0 ? `. Ground ref: ${groundReferenceHeight.toFixed(2)}m` : ''}`,
                  createdAt: new Date().toISOString(),
                  user_id: activeSurvey.id,
                  source: "counterDetection",
                };

                try {
                  // CRITICAL: Use worker batch for non-blocking saves
                  logger.debug(
                    "⚡ Logging Counter Detection POI via measurementLogger",
                  );
                  await measurementLogger.logMeasurement(newMeasurement);

                  // Add POI to timelapse if active
                  if (
                    useCameraStore.getState().isTimelapseActive &&
                    imagesToSave.length > 0
                  ) {
                    try {
                      await addPOIFrameToTimelapse(
                        imagesToSave[0],
                        newMeasurement,
                      );
                      logger.debug("📹 Added POI to timelapse frame");
                    } catch (timelapseError) {
                      // Don't fail the POI logging if timelapse fails
                    }
                  }

                  // Success! Update UI state immediately
                  setOfflineItems((prev) => prev + 1);
                  soundManager.playLogEntry();
                  soundManager.playMeasureDetected();

                  logger.debug(
                    isMeasurementFree
                      ? `🔢✅ Measurement-free POI (${currentPOIType}) logged successfully, images: ${imagesToSave.length}`
                      : `🔢✅ POI logged successfully: ${adjustedValue.toFixed(2)}m, images: ${imagesToSave.length}, videoTimestamp: ${videoTimestamp}ms`,
                  );
                } catch (error) {
                  logger.error(
                    "❌ Failed to log Counter Detection POI:",
                    error,
                  );
                  toast.error("Failed to log Counter Detection POI", {
                    description:
                      "Database write failed. Please try again or contact support.",
                  });
                }
              } else {
                logger.debug(
                  `🔢 🚫 Safety check: Measurement ${adjustedValue.toFixed(2)}m outside valid range [${settings.thresholds.minHeight}, ${settings.thresholds.maxHeight}], not logging (this should not happen - filter should have caught it at capture)`,
                );
              }
            }

            // Reset to sky_baseline - ready for next overhead object
            state.mode = "sky_baseline";
            state.buffer = [];
            state.intensityBuffer = [];
            state.minValue = null;
            state.minIntensity = null;
            state.skyCount = 0;
            state.capturedImageId = null;
            logger.debug("🔢 🔄 Reset to sky_baseline - ready for next object");
          }
        }
      }
    } catch (error) {}
  };

  // Handle logging mode changes
  const handleLoggingModeChange = (
    mode:
      | "manual"
      | "all"
      | "detection"
      | "manualDetection"
      | "counterDetection",
  ) => {
    logger.debug(
      "Changing logging mode to:",
      mode,
      "activeSurvey:",
      !!activeSurvey,
    );

    if (!activeSurvey) {
      toast.error("Please create a survey first", {
        description:
          "Please create a new survey before selecting a logging mode.",
        action: {
          label: "Create Survey",
          onClick: () => {
            setShowSurveyDialog(true);
            setTimeout(() => {
              const surveyButton = document.querySelector(".animate-pulse");
              if (surveyButton) {
                surveyButton.scrollIntoView({
                  behavior: "smooth",
                  block: "center",
                });
              }
            }, 100);
          },
        },
      });
      return;
    }

    if (
      (mode === "all" ||
        mode === "detection" ||
        mode === "manualDetection" ||
        mode === "counterDetection") &&
      (!hasLaserConnection || !hasGpsConnection)
    ) {
      toast.error("Connection required", {
        description:
          "Both Laser and GPS must be connected (wired or Bluetooth) for automated logging modes.",
        action: {
          label: "Connect Devices",
          onClick: () => {
            const connectionSection = document.querySelector(".bg-gray-800");
            if (connectionSection) {
              connectionSection.scrollIntoView({
                behavior: "smooth",
                block: "start",
              });
            }
          },
        },
      });
      return;
    }

    setLoggingMode(mode);
    stopRequested.current = false;

    if (mode === "manual") {
      stopLogging();
      resetManualDetection();
    } else if (mode === "all") {
      startLogging(mode);
    } else if (mode === "manualDetection") {
      // Reset detection state for clean manual detection cycle
      isDetectingObject.current = false;
      measurementBuffer.current = [];
      detectionStartTime.current = null;
      lastLaserOutput.current = "";
      prevMeasurementRef.current = null;

      resetManualDetection();
      startLogging(mode);
    } else if (mode === "counterDetection") {
      // Reset detection state for clean counter detection cycle
      resetManualDetection();
      startLogging(mode);
    }
  };

  // Start logging measurements
  const startLogging = (
    modeOverride?:
      | "manual"
      | "all"
      | "detection"
      | "manualDetection"
      | "counterDetection",
  ) => {
    const effectiveMode = modeOverride ?? loggingMode;
    logger.debug(
      "🚀🚀🚀 Starting logging, effectiveMode:",
      effectiveMode,
      "activeSurvey:",
      !!activeSurvey,
    );

    // Object Detection mode can run without survey (detection only)
    if (!activeSurvey && effectiveMode !== "counterDetection") {
      logger.debug("❌ Blocked: No survey and not counterDetection mode");
      toast.error("Please create a survey first");
      return;
    }

    if (!activeSurvey && effectiveMode === "counterDetection") {
      logger.debug(
        "⚠️ Object Detection mode starting WITHOUT survey - objects will be detected but NOT logged",
      );
      toast.warning("Object Detection: No survey active", {
        description:
          "Objects will be detected but NOT logged. Create a survey to save measurements.",
      });
    }

    // Check device connections for automated modes (wired OR Bluetooth)
    if (
      (effectiveMode === "all" ||
        effectiveMode === "detection" ||
        effectiveMode === "manualDetection" ||
        effectiveMode === "counterDetection") &&
      (!hasLaserConnection || !hasGpsConnection)
    ) {
      toast.error("Connection required", {
        description:
          "Both Laser and GPS must be connected (wired or Bluetooth) for automated logging modes.",
        action: {
          label: "Connect Devices",
          onClick: () => {
            const connectionSection = document.querySelector(".bg-gray-800");
            if (connectionSection) {
              connectionSection.scrollIntoView({
                behavior: "smooth",
                block: "start",
              });
            }
          },
        },
      });
      return;
    }

    logger.debug("🚀 startLogging() called, effectiveMode:", effectiveMode);
    setIsLogging(true);
    stopRequested.current = false;
    logger.debug("✅ stopRequested.current set to FALSE");

    // PERFORMANCE: Removed all success/info toast notifications (user requested)

    if (effectiveMode === "manual") {
      logMeasurement();
    } else if (effectiveMode === "all") {
      // For 'all' mode, we'll log measurements as they come in
      // PERFORMANCE: Removed toast notification
    } else if (effectiveMode === "detection") {
      // For 'detection' mode, start logging and monitor for object detection
      setIsLogging(true);
      // PERFORMANCE: Removed toast notification
      // Reset detection state
      isDetectingObject.current = false;
      measurementBuffer.current = [];
    } else if (effectiveMode === "manualDetection") {
      // For 'manualDetection' mode, monitor laser and auto-log on sky→object→sky transitions
      // PERFORMANCE: Removed toast notification
      resetManualDetection();
    } else if (effectiveMode === "counterDetection") {
      // For 'counterDetection' mode, use counter-based debouncing
      logger.debug("🔢 Starting Counter Detection mode");
      // PERFORMANCE: Removed toast notification
      resetManualDetection();
      logger.debug(
        "🔢 Counter Detection initialized, stopRequested:",
        stopRequested.current,
      );
    }
  };

  // Stop logging measurements
  const stopLogging = async () => {
    if (!isLogging) return;
    logger.debug("🛑 stopLogging() called, setting stopRequested to TRUE");
    stopRequested.current = true;

    // CRITICAL: Flush all pending POIs before stopping
    try {
      const storagePool = getStoragePool();
      await storagePool.flush();
      logger.debug("✅ Flushed pending POIs on logging stop");
    } catch (error) {}

    setIsLogging(false);
    setLoggingMode("manual"); // Reset to manual mode when stopping

    if (loggingIntervalRef.current) {
      clearInterval(loggingIntervalRef.current);
      loggingIntervalRef.current = null;
    }

    // Clear detection state
    isDetectingObject.current = false;
    resetManualDetection();

    // PERFORMANCE: Removed toast notification (unnecessary positive feedback)
  };

  // Pause logging - suspend POI recording without changing mode
  const pauseLogging = () => {
    if (isLogging && !isPaused) {
      setIsPaused(true);
      toast.warning("Logging paused - POI recording suspended");
    }
  };

  // Resume logging - continue in the same mode
  const resumeLogging = () => {
    if (isLogging && isPaused) {
      // Already logging, just unpause
      setIsPaused(false);
      toast.success("Logging resumed");
    } else if (!isLogging) {
      // If not logging, delegate to startLogging for full initialization
      startLogging();
    }
  };

  // Watch for measurement changes in 'all' mode
  useEffect(() => {
    const handleMeasurementChange = async () => {
      // Store the current measurement for comparison
      const currentMeasurement = lastMeasurement;

      // AUTOMATIC ALERT THRESHOLD LOGGING - runs independently of logging mode
      // NOTE: Disabled for Object Detection (counterDetection) mode as it uses buffer logging instead
      // Check if measurement crosses warning or critical thresholds
      if (
        activeSurvey &&
        currentMeasurement &&
        !isInvalidMeasurement(currentMeasurement) &&
        loggingMode !== "counterDetection"
      ) {
        try {
          const rawValue = parseFloat(currentMeasurement);
          if (!isNaN(rawValue)) {
            const adjustedValue = rawValue + groundReferenceHeight;

            // CRITICAL FIX: Only trigger alerts if measurement is within the valid display range
            // This prevents "ghost alerts" for measurements the user has filtered out
            if (
              adjustedValue < settings.thresholds.minHeight ||
              adjustedValue > settings.thresholds.maxHeight
            ) {
              logger.debug(
                `🚫 Alert skipped - measurement ${adjustedValue.toFixed(2)}m outside valid range (${settings.thresholds.minHeight}m - ${settings.thresholds.maxHeight}m)`,
              );
              // Skip alert for filtered measurements - user has intentionally excluded this range
            } else {
              // Measurement is within valid range - check thresholds
              logger.debug(
                `✅ Measurement ${adjustedValue.toFixed(2)}m is within valid range (${settings.thresholds.minHeight}m - ${settings.thresholds.maxHeight}m), checking thresholds...`,
              );

              // Check critical threshold (lower = more dangerous)
              if (
                adjustedValue > 0 &&
                adjustedValue <= settings.thresholds.criticalThreshold
              ) {
                logger.debug(
                  `🚨 CRITICAL threshold crossed: ${adjustedValue.toFixed(2)}m <= ${settings.thresholds.criticalThreshold}m - triggering alert`,
                );
                await logAutomaticAlert(adjustedValue, "critical");
              }
              // Check warning threshold (only if not already in critical)
              else if (
                adjustedValue > settings.thresholds.criticalThreshold &&
                adjustedValue <= settings.thresholds.warningThreshold
              ) {
                logger.debug(
                  `⚠️ WARNING threshold crossed: ${adjustedValue.toFixed(2)}m <= ${settings.thresholds.warningThreshold}m - triggering alert`,
                );
                await logAutomaticAlert(adjustedValue, "warning");
              } else {
                logger.debug(
                  `✓ Measurement ${adjustedValue.toFixed(2)}m within range but no threshold crossed (warning: ${settings.thresholds.warningThreshold}m, critical: ${settings.thresholds.criticalThreshold}m)`,
                );
              }
            }
          }
        } catch (err) {}
      }

      // Object Detection mode can run without a survey (detection only)
      const requiresSurvey = loggingMode !== "counterDetection";

      if (
        !isLogging ||
        isPaused ||
        (requiresSurvey && !activeSurvey) ||
        stopRequested.current
      ) {
        // Debug: Log why we're returning early
        if (!isLogging) logger.debug("🔍 handleMeasurementChange: Not logging");
        if (isPaused)
          logger.debug("🔍 handleMeasurementChange: Logging paused");
        if (requiresSurvey && !activeSurvey)
          logger.debug("🔍 handleMeasurementChange: No active survey");
        if (stopRequested.current)
          logger.debug("🔍 handleMeasurementChange: Stop requested");
        return;
      }

      // DEBUG: Show which mode we're in
      if (loggingMode === "counterDetection") {
        logger.debug(
          `🎯 Object Detection: measurement=${currentMeasurement}, isLogging=${isLogging}, stopRequested=${stopRequested.current}`,
        );
      }
      const prevMeasurement = prevMeasurementRef.current;

      // Update previous measurement reference
      prevMeasurementRef.current = currentMeasurement;

      // Handle "All Data" mode - log every valid measurement change
      if (loggingMode === "all" && isLogging && !stopRequested.current) {
        // Only log if measurement has changed, is valid, and is within display range
        if (
          !isInvalidMeasurement(currentMeasurement) &&
          currentMeasurement !== prevMeasurement
        ) {
          // Check if measurement is within valid range
          try {
            if (!currentMeasurement) return;

            const rawValue = parseFloat(currentMeasurement);
            if (isNaN(rawValue)) return;

            // Convert to meters based on laser type
            const _laserType = useSerialStore.getState().laserType;
            const adjustedValue = rawValue + groundReferenceHeight;

            // CRITICAL: Only log if measurement would be displayed in current measure card
            // This means it must be within the valid range (min/max height thresholds)
            if (
              adjustedValue >= settings.thresholds.minHeight &&
              adjustedValue <= settings.thresholds.maxHeight
            ) {
              const formattedValue = adjustedValue.toFixed(2);

              // Only log if the formatted value has changed from the last logged value
              if (formattedValue !== lastDisplayedMeasurement) {
                logger.debug(
                  "All Data Mode: Logging measurement:",
                  formattedValue + "m",
                );

                // Add delay to prevent rapid logging that causes database errors
                await new Promise((resolve) => setTimeout(resolve, 100));

                try {
                  // Check if Bridge & Wires mode is active
                  if (selectedPOIType === "bridgeAndWires") {
                    // CRITICAL FIX: Do NOT capture images early - they will be captured in flush
                    // Store only video timestamp metadata
                    if (bridgeAndWiresBuffer.current.length === 0) {
                      bridgeAndWiresAssets.current = {
                        pendingPhotos: [], // No early capture - images captured during flush
                        videoTimestamp:
                          videoMode &&
                          useCameraStore.getState().videoBuffer.length > 0
                            ? Date.now() -
                              new Date(
                                useCameraStore.getState().videoBuffer[0].timestamp,
                              ).getTime()
                            : null,
                      };
                    }

                    // Add to buffer WITHOUT images (will be captured during flush)
                    bridgeAndWiresBuffer.current.push({
                      value: adjustedValue,
                      timestamp: Date.now(),
                      rawValue: currentMeasurement,
                      // No imageUrl or images - will be captured during flush
                      videoTimestamp:
                        bridgeAndWiresAssets.current.videoTimestamp,
                    });

                    logger.debug(
                      `📦 Added to Bridge & Wires buffer: ${adjustedValue.toFixed(2)}m (${bridgeAndWiresBuffer.current.length} total)`,
                    );

                    // Reset 6-second timeout
                    if (bridgeAndWiresTimeout.current !== null) {
                      clearTimeout(bridgeAndWiresTimeout.current);
                    }

                    bridgeAndWiresTimeout.current = window.setTimeout(() => {
                      logger.debug(
                        "⏰ Bridge & Wires timeout reached, flushing buffer",
                      );
                      flushBridgeAndWiresBuffer();
                    }, 6000);

                    // Don't call regular logMeasurement
                  } else {
                    // Check if buffer detection is enabled for this POI type
                    const isBufferEnabled = useBufferConfigStore.getState().isBufferEnabled(selectedPOIType as any);
                    
                    if (isBufferEnabled && loggingMode === 'all') {
                      // Buffer Detection Mode: Collect measurements until distance/time target is reached
                      const currentGpsData = useGPSStore.getState().data;
                      const groundRef = useLaserStore.getState().groundReferenceHeight || 0;

                      if (!bufferDetectionService.isActive()) {
                        // BUG 2 FIX: Skip starting buffer if GPS is at 0,0 (no fix yet)
                        // Distance-based completion would never trigger with invalid coordinates
                        if (!currentGpsData.latitude && !currentGpsData.longitude) {
                          logger.debug('[BufferDetection] GPS at 0,0 - skipping buffer start (no fix)');
                        } else {
                        // Start a new buffer session
                        const started = bufferDetectionService.start(
                          selectedPOIType as any,
                          { latitude: currentGpsData.latitude, longitude: currentGpsData.longitude },
                          groundRef
                        );
                        if (started) {
                          logger.debug(`[BufferDetection] Started buffer for ${selectedPOIType}`);
                        }
                        }
                      }
                      
                      // Add measurement to active buffer
                      if (bufferDetectionService.isActive()) {
                        bufferDetectionService.addMeasurement(
                          adjustedValue,
                          currentMeasurement,
                          { 
                            latitude: currentGpsData.latitude, 
                            longitude: currentGpsData.longitude, 
                            altitude: currentGpsData.altitude 
                          },
                          groundRef
                        );
                      }
                    } else {
                      // Normal logging for non-buffered modes
                      // CRITICAL FIX: Do NOT capture images early - let logMeasurement → logPOI handle it
                      // logPOI captures images AFTER validation and markProcessedPOI
                      await logMeasurement();
                    }
                  }
                } catch (error) {
                  // Don't stop logging on individual errors
                }

                setLastDisplayedMeasurement(formattedValue);
              }
            } else {
              logger.debug(
                "All Data Mode: Measurement filtered out (not displayed in current measure card):",
                adjustedValue,
                "min:",
                settings.thresholds.minHeight,
                "max:",
                settings.thresholds.maxHeight,
              );
            }
          } catch (err) {}
        }
      }

      // Handle "Manual Detection" mode - auto-log on sky→object→sky transitions
      else if (
        loggingMode === "manualDetection" &&
        isLogging &&
        !stopRequested.current
      ) {
        await processManualDetection();
      }

      // BUG 1 FIX: Counter detection Path B DISABLED (#85)
      // processCounterDetection() via the 150ms timer (Path A) is the ONLY
      // authoritative code path for counter detection logging.
      // The duplicate logBufferedPOI block that was here caused 5-6 duplicate
      // POIs per object because both paths raced on counterDetectionStateRef.

      // Handle "Detection" mode - detect objects and log the minimum height
      else if (
        loggingMode === "detection" &&
        isLogging &&
        !stopRequested.current
      ) {
        try {
          // CRITICAL: Only consider measurements that would be displayed in current measure card
          const rawValue = parseFloat(currentMeasurement);
          const isValidForDisplay =
            !isNaN(rawValue) &&
            !isInvalidMeasurement(currentMeasurement) &&
            rawValue + groundReferenceHeight >= settings.thresholds.minHeight &&
            rawValue + groundReferenceHeight <= settings.thresholds.maxHeight;

          const wasValidForDisplay =
            !isNaN(parseFloat(prevMeasurement || "")) &&
            !isInvalidMeasurement(prevMeasurement) &&
            prevMeasurement &&
            parseFloat(prevMeasurement) + groundReferenceHeight >=
              settings.thresholds.minHeight &&
            parseFloat(prevMeasurement) + groundReferenceHeight <=
              settings.thresholds.maxHeight;

          // If we were detecting an object and now measurement is not valid for display, log the minimum
          if (isDetectingObject.current && !isValidForDisplay) {
            logger.debug(
              "Detection Mode: Object detection ended, logging minimum height",
            );
            const detectionEndTime = new Date();
            isDetectingObject.current = false; // End detection

            // If video mode is enabled, save the buffer
            if (videoMode && !videoRecordingInProgress) {
              try {
                // Import dynamically to avoid circular dependencies
                const { videoRecorder } = await import(
                  "../lib/video/VideoRecorder"
                );
                setVideoRecordingInProgress(true);

                // Save the buffer
                const recording = await videoRecorder.saveBuffer();

                if (recording) {
                  logger.debug("Video buffer saved for object detection");

                  // Add metadata to the recording
                  recording.metadata = {
                    latitude: gpsData.latitude,
                    longitude: gpsData.longitude,
                    height:
                      measurementBuffer.current.length > 0
                        ? parseFloat(measurementBuffer.current[0])
                        : 0,
                  };
                }
              } catch (error) {
              } finally {
                setVideoRecordingInProgress(false);
              }
            }

            // Find the minimum measurement in the buffer
            if (measurementBuffer.current.length > 0) {
              // Filter measurements that would be displayed in current measure card
              const validMeasurements = measurementBuffer.current
                .filter((m) => {
                  const val = parseFloat(m);
                  return (
                    !isInvalidMeasurement(m) &&
                    !isNaN(val) &&
                    val + groundReferenceHeight >=
                      settings.thresholds.minHeight &&
                    val + groundReferenceHeight <= settings.thresholds.maxHeight
                  );
                })
                .map((m) => parseFloat(m));

              if (validMeasurements.length > 0) {
                const dmPoiType = selectedPOIType || "none";
                const dmPoiAction = usePOIActionsStore.getState().getActionForPOI(dmPoiType);
                if (dmPoiAction === 'auto-capture-and-log' && handleAutoCaptureAndLog && shouldRecordHeightClearance(dmPoiType)) {
                  logger.debug(`🎯 DetectionMode: delegating ${validMeasurements.length} measurements to handleAutoCaptureAndLog`);
                  await handleAutoCaptureAndLog(validMeasurements);
                  measurementBuffer.current = [];
                  return;
                }

                const minMeasurement = Math.min(
                  ...validMeasurements,
                ).toString();
                logger.debug(
                  "Detection Mode: Minimum measurement:",
                  minMeasurement,
                );

                const originalLastMeasurement = lastMeasurement;

                try {
                  await new Promise((resolve) => setTimeout(resolve, 200));

                  // Temporarily set the last measurement to the minimum value
                  useSerialStore.getState().setLastLaserData(minMeasurement);

                  // HYBRID ARCHITECTURE FIX: Capture image using new helper
                  logger.debug("📸 Capturing image for Detection Mode...");
                  const capture = await captureAndResolveImage();
                  if (!capture) {
                    logger.error(
                      "Failed to capture image for Detection Mode - logging without image",
                    );
                    // Continue logging without image (graceful fallback)
                  }

                  // Create a new measurement object with the minimum value
                  let currentRoadNumber = 1;
                  try {
                    const surveyManagerElement =
                      document.querySelector("select[value]");
                    if (surveyManagerElement) {
                      currentRoadNumber = parseInt(
                        (surveyManagerElement as HTMLSelectElement).value,
                      );
                    }
                  } catch (err) {}

                  // Generate POI number
                  const poiNumber = Math.floor(Math.random() * 10000);

                  // Get video timestamp if video is recording
                  let videoTimestamp: number | null = null;
                  if (
                    videoMode &&
                    useCameraStore.getState().videoBuffer.length > 0
                  ) {
                    const lastVideo = useCameraStore.getState().videoBuffer[0];
                    if (lastVideo?.timestamp) {
                      videoTimestamp =
                        Date.now() - new Date(lastVideo.timestamp).getTime();
                    }
                  }

                  // Create the measurement object with properly rounded values
                  const measurementHeight = roundMeasurement(
                    parseFloat(minMeasurement) + groundReferenceHeight,
                  );
                  const newMeasurement = {
                    id: crypto.randomUUID(),
                    rel: measurementHeight, // Round to 2 decimal places
                    altGPS: roundMeasurement(gpsData.altitude),
                    latitude: gpsData.latitude,
                    longitude: gpsData.longitude,
                    utcDate: new Date().toISOString().split("T")[0],
                    utcTime: new Date().toTimeString().split(" ")[0],
                    speed: roundMeasurement(gpsData.speed),
                    heading: roundMeasurement(gpsData.course),
                    roadNumber: currentRoadNumber,
                    poiNumber: poiNumber,
                    poi_type: selectedPOIType || "none",
                    imageUrl: capture?.dataUrl || null, // Primary image
                    images: capture ? [capture.dataUrl] : [], // All captured images
                    videoTimestamp, // Video timestamp in milliseconds
                    note: `min=${measurementHeight?.toFixed(2) || "N/A"}m from ${validMeasurements.length} readings (${validMeasurements.map((v) => v.toFixed(2) + 'm').join(', ')})${groundReferenceHeight > 0 ? `. Ground ref: ${groundReferenceHeight.toFixed(2)}m` : ''}`,
                    createdAt: new Date().toISOString(),
                    user_id: activeSurvey?.id || "",
                    source: "detection" as const,
                  };

                  // Add the measurement to the database
                  if (activeSurvey) {
                    await measurementLogger.logMeasurement(newMeasurement);
                  }

                  // HYBRID ARCHITECTURE FIX: Add POI to timelapse if active (skip wires/trees)
                  if (
                    capture &&
                    useCameraStore.getState().isTimelapseActive &&
                    newMeasurement.poi_type !== "wire" &&
                    newMeasurement.poi_type !== "tree"
                  ) {
                    try {
                      await addPOIFrameToTimelapse(
                        capture.dataUrl,
                        newMeasurement,
                      );
                      logger.debug(
                        "📹 Added Detection Mode POI to timelapse frame",
                      );
                    } catch (err) {
                      logger.error("Timelapse frame failed:", err);
                    }
                  }

                  setOfflineItems((prev) => prev + 1);

                  // HYBRID ARCHITECTURE FIX: Cleanup
                  if (capture) {
                    await clearPendingPhotos();
                    await discardCaptureAssets([capture.imageId]);
                  }

                  logger.debug(
                    `📸 Detection mode logged: images: ${newMeasurement.images.length}, videoTimestamp: ${videoTimestamp}ms`,
                  );

                  // Play sound
                  soundManager.playLogEntry();

                  // Create detailed detection log
                  if (detectionStartTime.current) {
                    const detectionLog = createObjectDetectionLog(
                      parseFloat(minMeasurement),
                      measurementBuffer.current,
                      detectionStartTime.current,
                      detectionEndTime,
                      gpsData,
                    );

                    logger.debug("📊 Object Detection Log:", detectionLog);

                    // Store detection log in localStorage for analysis
                    try {
                      const logs = JSON.parse(
                        localStorage.getItem("objectDetectionLogs") || "[]",
                      );
                      logs.push(detectionLog);
                      localStorage.setItem(
                        "objectDetectionLogs",
                        JSON.stringify(logs),
                      );
                    } catch (err) {}
                  }
                } finally {
                  // Restore the original last measurement if needed
                  if (originalLastMeasurement !== minMeasurement) {
                    useSerialStore
                      .getState()
                      .setLastLaserData(originalLastMeasurement);
                  }
                }
              }

              // Clear the buffer
              measurementBuffer.current = [];
              detectionStartTime.current = null;
            }
          }
          // If we're not detecting an object and got a measurement valid for display, start detection
          else if (
            !isDetectingObject.current &&
            isValidForDisplay &&
            !wasValidForDisplay
          ) {
            logger.debug(
              "Detection Mode: Object detection started with measurement:",
              currentMeasurement,
            );
            isDetectingObject.current = true;
            detectionStartTime.current = new Date();
            // Initialize the buffer with the current measurement
            measurementBuffer.current = [currentMeasurement];

            // Start video recording if video mode is enabled
            if (videoMode && !videoRecorder.isCurrentlyRecording()) {
              try {
                videoRecorder.startRecording();
                logger.debug("Video recording started for object detection");
              } catch (error) {}
            }

            // Show toast notification that object detection has started
            toast.info("Object detection started", {
              description: "Tracking object measurements...",
            });
          }
          // If we're already detecting an object and got another measurement valid for display, add to buffer
          else if (isDetectingObject.current && isValidForDisplay) {
            logger.debug(
              "Detection Mode: Adding to detection buffer:",
              currentMeasurement,
            );
            measurementBuffer.current.push(currentMeasurement);
          }
        } catch (err) {}
      }
    };

    handleMeasurementChange();
  }, [
    isLogging,
    loggingMode,
    lastMeasurement,
    activeSurvey,
    lastDisplayedMeasurement,
  ]);

  // NEW: Dedicated timer-based interval for Counter Detection mode
  // This runs on a timer (not measurement changes) to catch repeated sky readings
  useEffect(() => {
    logger.debug(
      `🔍 Counter Detection useEffect triggered: loggingMode=${loggingMode}, isLogging=${isLogging}, stopRequested=${stopRequested.current}`,
    );

    if (
      loggingMode === "counterDetection" &&
      isLogging &&
      !stopRequested.current
    ) {
      logger.debug("🔢✅ Starting Counter Detection timer (150ms interval)");

      const intervalId = setInterval(async () => {
        if (!isLogging || stopRequested.current) {
          logger.debug(
            "🔢 Timer stopped - isLogging:",
            isLogging,
            "stopRequested:",
            stopRequested.current,
          );
          clearInterval(intervalId);
          return;
        }

        try {
          await processCounterDetection();
        } catch (error) {}
      }, 150); // Run every 150ms to catch all sky readings

      return () => {
        logger.debug("🔢 Stopping Counter Detection timer (cleanup)");
        clearInterval(intervalId);
      };
    } else {
      logger.debug(
        "🔢❌ Counter Detection timer NOT started - conditions not met",
      );
    }
  }, [loggingMode, isLogging]);

  // Monitor laser output for detection mode
  useEffect(() => {
    // Subscribe to laser output changes
    const _handleLaserOutputChange = async (output: string) => {
      lastLaserOutput.current = output;

      // For detection mode, we need to watch for "infinity" or "--" in the output
      if (isLogging && loggingMode === "detection") {
        const isInfinityOutput = isInvalidMeasurement(output);

        if (isDetectingObject.current && isInfinityOutput) {
          logger.debug("Object detection ended (from output)");
          isDetectingObject.current = false;

          // Process the buffer and log the minimum measurement
          if (measurementBuffer.current.length > 0) {
            const validMeasurements = measurementBuffer.current
              .filter((m) => !isInvalidMeasurement(m) && !isNaN(parseFloat(m)))
              .map((m) => parseFloat(m));

            if (validMeasurements.length > 0) {
              const minMeasurement = Math.min(...validMeasurements).toString();
              logger.debug("Minimum measurement from output:", minMeasurement);

              // Store the minimum value temporarily
              const originalLastMeasurement = lastMeasurement;

              try {
                // Temporarily set the last measurement to the minimum value
                useSerialStore.getState().setLastLaserData(minMeasurement);

                // Capture image if needed
                if (pendingPhotos.length === 0) {
                  await captureImageWithBuffer();
                  await new Promise((resolve) => setTimeout(resolve, 500));
                }

                // Log the minimum measurement
                await logMeasurement();
              } finally {
                // Restore the original last measurement if needed
                if (originalLastMeasurement !== minMeasurement) {
                  useSerialStore
                    .getState()
                    .setLastLaserData(originalLastMeasurement);
                }
              }
            }

            // Clear the buffer
            measurementBuffer.current = [];
          }
        }
      }
    };

    // Clean up function
    return () => {
      // No need to unsubscribe as we're using a ref
    };
  }, [isLogging, loggingMode]);

  // RSA HIGH-SPEED: Listen for all RSA measurements via event
  // This captures EVERY measurement at full rate for accurate detection
  useEffect(() => {
    const handleRsaMeasurement = (event: CustomEvent<{ measurement: string; timestamp: number }>) => {
      if (isLogging && (loggingMode === 'counterDetection' || loggingMode === 'detection')) {
        rsaMeasurementBuffer.current.push(event.detail.measurement);
        // Cap buffer size to prevent memory issues
        if (rsaMeasurementBuffer.current.length > 1000) {
          rsaMeasurementBuffer.current = rsaMeasurementBuffer.current.slice(-500);
        }
      }
    };
    
    window.addEventListener('rsa-measurement', handleRsaMeasurement as EventListener);
    
    return () => {
      window.removeEventListener('rsa-measurement', handleRsaMeasurement as EventListener);
    };
  }, [isLogging, loggingMode]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopRequested.current = true;
      if (loggingIntervalRef.current) {
        clearInterval(loggingIntervalRef.current);
        loggingIntervalRef.current = null;
      }
      measurementBuffer.current = [];
      rsaMeasurementBuffer.current = [];
      isDetectingObject.current = false;
      detectionStartTime.current = null;

      // CRITICAL: Flush all pending POIs before unmount
      try {
        const storagePool = getStoragePool();
        storagePool.flush().catch((err) => {});
        logger.debug("🔄 Flushing pending POIs on unmount");
      } catch (error) {}

      // Stop video recording if active
      if (videoMode && videoRecorder.isCurrentlyRecording()) {
        videoRecorder.stopRecording();
      }
    };
  }, []);

  // Watch for stop requests
  useEffect(() => {
    if (!isLogging && loggingIntervalRef.current) {
      clearInterval(loggingIntervalRef.current);
      loggingIntervalRef.current = null;
      stopRequested.current = true;
      isDetectingObject.current = false;
      detectionStartTime.current = null;
      measurementBuffer.current = [];

      // Stop video recording if active
      if (videoMode && videoRecorder.isCurrentlyRecording()) {
        videoRecorder.stopRecording();
      }

      logger.debug("Logging stopped due to isLogging state change");
    }
  }, [isLogging]);

  // Handle POI type switching - DISCARD buffer when switching away from Bridge & Wires mode
  // FIX: Previously this flushed the buffer, causing wire/tree POIs to be created
  // even when the user had already switched to a different POI type (bridge, culvert, intersection)
  const prevPOITypeRef = useRef<string>("");
  useEffect(() => {
    // Abort active buffer detection session when POI type changes
    // This triggers early completion with whatever measurements were collected
    if (bufferDetectionService.isActive() && prevPOITypeRef.current !== selectedPOIType) {
      const activeType = bufferDetectionService.getActivePoiType();
      if (activeType && activeType !== selectedPOIType) {
        logger.debug(
          `[BufferDetection] POI type changed from ${activeType} to ${selectedPOIType} - aborting buffer`,
        );
        // Abort returns the session with collected measurements, onComplete callback will create POI
        bufferDetectionService.abort();
      }
    }
    
    // DISCARD buffer if switching away from Bridge & Wires mode
    // The user has explicitly chosen a different POI type - don't create wire/tree POIs from stale buffer
    if (
      prevPOITypeRef.current === "bridgeAndWires" &&
      selectedPOIType !== "bridgeAndWires"
    ) {
      logger.debug(
        "🚫 POI type changed away from Bridge & Wires - DISCARDING buffer (not flushing)",
      );
      logger.debug(
        `   Previous: ${prevPOITypeRef.current} → Current: ${selectedPOIType}`,
      );
      logger.debug(
        `   Buffer had ${bridgeAndWiresBuffer.current.length} detections that will be discarded`,
      );

      // Clear buffer entirely - user wants to log a different POI type now
      bridgeAndWiresBuffer.current = [];
      bridgeAndWiresAssets.current = {
        pendingPhotos: [],
        videoTimestamp: null,
      };

      // Cancel any pending timeout
      if (bridgeAndWiresTimeout.current !== null) {
        clearTimeout(bridgeAndWiresTimeout.current);
        bridgeAndWiresTimeout.current = null;
        logger.debug("   Cancelled pending 6-second timeout");
      }
    }
    prevPOITypeRef.current = selectedPOIType;
  }, [selectedPOIType]);

  // Handle survey change/deletion - flush pending POIs
  const prevSurveyRef = useRef<string | null>(null);
  useEffect(() => {
    const currentSurveyId = activeSurvey?.id || null;

    // If survey changed (not initial mount), flush pending POIs for old survey
    if (
      prevSurveyRef.current !== null &&
      prevSurveyRef.current !== currentSurveyId
    ) {
      logger.debug("🔄 Survey changed, flushing pending POIs");
      try {
        const storagePool = getStoragePool();
        storagePool.flush().catch((err) => {});
      } catch (error) {}
    }

    prevSurveyRef.current = currentSurveyId;

    // Handle survey deletion - discard buffer when survey is deleted
    if (!activeSurvey && bridgeAndWiresBuffer.current.length > 0) {
      logger.debug("⚠️ Survey deleted, discarding Bridge & Wires buffer");
      bridgeAndWiresBuffer.current = [];
      if (bridgeAndWiresTimeout.current !== null) {
        clearTimeout(bridgeAndWiresTimeout.current);
        bridgeAndWiresTimeout.current = null;
      }
    }
  }, [activeSurvey]);

  return {
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
  };
};
