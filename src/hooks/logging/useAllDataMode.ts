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
import { useLoggingCore, parseMeters, getGpsSnapshot } from './useLoggingCore';
// crypto available as globalThis.crypto in Electron renderer

interface UseAllDataModeProps {
  isActive: boolean;              // true when logging mode = 'all_data'
  captureImage: () => Promise<string | null>;
  onPOILogged?: (count: number) => void;
}

export function useAllDataMode({ isActive, captureImage, onPOILogged }: UseAllDataModeProps) {
  const { lastMeasurement } = useSerialStore();
  const { selectedType: selectedPOIType } = usePOIStore();
  const { getActionForPOI } = usePOIActionsStore();
  const { activeSurvey, groundRef, savePOI, getNextPoiNumber } = useLoggingCore();

  const lastLoggedRef = useRef<string | null>(null);
  const countRef = useRef(0);

  const logCurrent = useCallback(async () => {
    if (!isActive || !activeSurvey?.id) return;
    if (!lastMeasurement || lastMeasurement === lastLoggedRef.current) return;

    const reading = parseMeters(lastMeasurement, groundRef);
    if (!reading.isValid) return;  // DE02, sky, noise → silent skip

    const poiType = selectedPOIType || 'wire';
    const action = getActionForPOI(poiType as any);

    // Skip POI types configured as "no measurement" action
    if (action === 'skip' || action === 'no-action') return;

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
      note: `${poiType} | ${reading.meters.toFixed(2)}m | GND:${groundRef.toFixed(2)}m`,
    });

    if (saved) {
      countRef.current++;
      onPOILogged?.(countRef.current);

      // Capture image async — attaches to POI after
      if (action === 'auto-capture-and-log' || action === 'capture') {
        captureImage().then(imageUrl => {
          if (!imageUrl) return;
          // Update POI with image (best effort)
          import('@/lib/survey/db').then(({ openSurveyDB }) => {
            openSurveyDB().then(db => {
              db.get('measurements', id).then((m: any) => {
                if (m) db.put('measurements', { ...m, imageUrl, images: [imageUrl] });
              });
            });
          }).catch(() => {});
        }).catch(() => {});
      }
    }
  }, [isActive, activeSurvey?.id, lastMeasurement, selectedPOIType, groundRef, savePOI, getNextPoiNumber, captureImage, getActionForPOI, onPOILogged]);

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
