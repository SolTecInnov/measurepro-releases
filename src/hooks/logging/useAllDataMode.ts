/**
 * useAllDataMode — logs every valid laser reading immediately
 *
 * Rules:
 * - Each unique valid reading → 1 POI immediately
 * - POI type = user's current selection
 * - POI action = user's configured action for that type
 * - DE02/sky/invalid → silent skip
 * - Image captured async (doesn't delay logging)
 * - No buffer, no algorithm, no conditions
 */

import { useRef, useCallback, useEffect } from 'react';
import { useSerialStore } from '@/lib/stores/serialStore';
import { usePOIStore } from '@/lib/poi';
import { usePOIActionsStore } from '@/lib/poiActions';
import { useSettingsStore } from '@/lib/settings';
import { useRainModeStore } from '@/lib/stores/rainModeStore';
import { useLoggingCore, parseMeters, getGpsSnapshot } from './useLoggingCore';

interface UseAllDataModeProps {
  isActive: boolean;              // true when logging mode = 'all_data'
  captureImage: () => Promise<string | null>;
  onPOILogged?: (count: number) => void;
}

export function useAllDataMode({ isActive, captureImage, onPOILogged }: UseAllDataModeProps) {
  const { lastMeasurement, lastMeasurementPoiType } = useSerialStore();
  const { selectedType: selectedPOIType } = usePOIStore();
  const { getActionForPOI } = usePOIActionsStore();
  const { alertSettings } = useSettingsStore();
  const { activeSurvey, groundRef, savePOI, getNextPoiNumber } = useLoggingCore();

  const lastLoggedRef = useRef<string | null>(null);
  const countRef = useRef(0);

  const logCurrent = useCallback(async () => {
    if (!isActive || !activeSurvey?.id) return;
    if (!lastMeasurement || lastMeasurement === lastLoggedRef.current) return;

    const reading = parseMeters(lastMeasurement, groundRef);
    if (!reading.isValid) return;  // DE02, sky, noise → silent skip

    // HEIGHT RANGE FILTER (v16.1.27): skip measurements outside the "ignore
    // above/below" thresholds set in Settings → Alerts. This was missing from
    // All Data and Counter modes — only Detection mode checked it, so the
    // user was getting POIs at <4m (ground reflections) and >25m (sky bounces).
    const minH = alertSettings?.thresholds?.minHeight ?? 4;
    const maxH = alertSettings?.thresholds?.maxHeight ?? 25;
    if (reading.meters < minH || reading.meters > maxH) return;

    // RACE FIX: Use the POI type that was active at the MOMENT this laser
    // reading was captured, not the current store value. The user may have
    // already switched to the next POI type in anticipation of the next item.
    const poiType = lastMeasurementPoiType || selectedPOIType || 'wire';
    const action = getActionForPOI(poiType as any);

    // Skip POI types that should not auto-log from laser readings.
    // 'auto-capture-no-measurement' types (road, intersection, bridge, etc.)
    // are only triggered by user action (StreamDeck/keyboard), never by laser.
    if (action === 'voice-note' || action === 'select-only' || action === 'auto-capture-no-measurement') return;

    lastLoggedRef.current = lastMeasurement;

    // Capture image ASYNC — doesn't block POI save
    const gps = getGpsSnapshot();
    const now = new Date();
    const id = globalThis.crypto?.randomUUID?.() || `poi-${Date.now()}-${Math.random()}`;
    const poiNumber = await getNextPoiNumber();

    // Save POI immediately (without image)
    const saved = await savePOI({
      id,
      surveyId: activeSurvey.id,
      poiType,
      poiNumber,
      roadNumber: activeSurvey.roadNumber || 1,
      heightM: reading.meters,
      heightRawM: parseFloat(lastMeasurement),
      groundRefM: groundRef,
      gps,
      utcDate: now.toISOString().split('T')[0],
      utcTime: now.toTimeString().split(' ')[0],
      createdAt: now.toISOString(),
      source: 'all_data',
      loggingMode: 'all_data',
      note: `${poiType} | ${reading.meters.toFixed(2)}m | GND:${groundRef.toFixed(2)}m${useRainModeStore.getState().isActive ? ' | RAIN MODE' : ''}${useRainModeStore.getState().isSurveyMode ? ' | GPS-ONLY — NO VERTICAL CLEARANCE ASSESSMENT' : ''}`,
    });

    if (saved) {
      countRef.current++;
      onPOILogged?.(countRef.current);

      // Capture image async — attaches to POI after
      if (action === 'auto-capture-and-log' || action === 'auto-capture-no-measurement') {
        captureImage().then(imageUrl => {
          if (!imageUrl) return;
          // Update POI with image in DB and in-memory cache
          import('@/lib/survey/db').then(({ openSurveyDB }) => {
            openSurveyDB().then(db => {
              db.get('measurements', id).then((m: any) => {
                if (m) {
                  const updated = { ...m, imageUrl, images: [imageUrl] };
                  db.put('measurements', updated);
                  // Update in-memory cache so UI shows the image
                  import('@/lib/survey/MeasurementFeed').then(({ getMeasurementFeed }) => {
                    getMeasurementFeed().addMeasurement(updated);
                  }).catch(() => {});
                  // Clear from captured images card
                  window.dispatchEvent(new CustomEvent('poi-image-attached', { detail: imageUrl }));
                }
              });
            });
          }).catch(() => {});
        }).catch(() => {});
      }
    }
  }, [isActive, activeSurvey?.id, lastMeasurement, lastMeasurementPoiType, selectedPOIType, groundRef, savePOI, getNextPoiNumber, captureImage, getActionForPOI, onPOILogged]);

  // React to measurement changes
  useEffect(() => {
    if (!isActive) return;
    logCurrent();
  }, [lastMeasurement, isActive]);

  const reset = useCallback(() => {
    lastLoggedRef.current = null;
    countRef.current = 0;
  }, []);

  return { count: countRef.current, reset };
}
