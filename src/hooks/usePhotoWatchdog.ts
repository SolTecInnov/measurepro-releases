/**
 * Photo Watchdog — monitors that POIs have photos attached.
 *
 * Runs while logging is active. After each POI is created,
 * checks if the image was actually saved. If a POI has no image
 * after a grace period, shows a persistent warning toast.
 *
 * Also monitors camera connection — if camera disconnects during
 * logging, shows an immediate warning.
 */

import { useEffect, useRef, useCallback } from 'react';
import { useCameraStore } from '@/lib/camera';
import { getMeasurementFeed } from '@/lib/survey/MeasurementFeed';
import { toast } from 'sonner';

interface UsePhotoWatchdogProps {
  isLogging: boolean;
  loggingMode: string;
}

// How long to wait after POI creation before checking for image (ms)
const IMAGE_CHECK_DELAY_MS = 3000;
// How often to check camera status (ms)
const CAMERA_CHECK_INTERVAL_MS = 5000;
// Don't spam warnings — minimum interval between warnings
const WARNING_COOLDOWN_MS = 30000;

export function usePhotoWatchdog({ isLogging, loggingMode }: UsePhotoWatchdogProps) {
  const lastWarningRef = useRef(0);
  const cameraWarningShownRef = useRef(false);
  const checkedPOIsRef = useRef(new Set<string>());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const showWarning = useCallback((title: string, description: string) => {
    const now = Date.now();
    if (now - lastWarningRef.current < WARNING_COOLDOWN_MS) return;
    lastWarningRef.current = now;
    toast.warning(title, { description, duration: 10000 });
  }, []);

  // Camera connection watchdog
  useEffect(() => {
    if (!isLogging) {
      cameraWarningShownRef.current = false;
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
      return;
    }

    intervalRef.current = setInterval(() => {
      const { isCameraConnected } = useCameraStore.getState();
      if (!isCameraConnected && !cameraWarningShownRef.current) {
        cameraWarningShownRef.current = true;
        toast.error('Camera disconnected', {
          description: 'POIs are being logged WITHOUT photos. Reconnect camera or check USB connection.',
          duration: 15000,
        });
      } else if (isCameraConnected && cameraWarningShownRef.current) {
        cameraWarningShownRef.current = false;
        toast.success('Camera reconnected', { duration: 3000 });
      }
    }, CAMERA_CHECK_INTERVAL_MS);

    return () => {
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    };
  }, [isLogging]);

  // POI image watchdog — check new POIs for missing images
  useEffect(() => {
    if (!isLogging) {
      checkedPOIsRef.current.clear();
      return;
    }

    const feed = getMeasurementFeed();
    const unsubscribe = feed.subscribe(() => {
      const measurements = feed.getMeasurementsWithLimit(5);

      for (const m of measurements) {
        if (checkedPOIsRef.current.has(m.id)) continue;

        // Schedule a check after the grace period
        const poiId = m.id;
        setTimeout(() => {
          // Re-read the POI from feed to see if image was attached
          const updated = feed.getMeasurement(poiId);
          if (!updated) return;

          checkedPOIsRef.current.add(poiId);

          // Skip measurement-free POIs that intentionally have no image in some modes
          if (updated.measurementFree && !updated.imageUrl && !updated.images?.length) {
            // This is expected for some POI types — don't warn
            return;
          }

          // Check if image is missing on a POI that should have one
          const hasImage = updated.imageUrl || (updated.images && updated.images.length > 0 && updated.images[0]);
          if (!hasImage) {
            showWarning(
              'POI missing photo',
              `POI #${updated.poiNumber || '?'} (${updated.poi_type || 'unknown'}) has no photo. Check camera connection.`
            );
          }
        }, IMAGE_CHECK_DELAY_MS);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [isLogging, showWarning]);
}
