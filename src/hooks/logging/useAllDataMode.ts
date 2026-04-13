/**
 * useAllDataMode — logs every valid laser reading as a POI
 *
 * Rules:
 * - Active POI type REQUIRES measurement → each valid reading = 1 POI + 1 image
 * - Active POI type does NOT require measurement → IGNORE laser readings entirely
 *   (those POIs are created by user action via StreamDeck/keyboard, not by laser)
 * - DE02/sky/invalid → silent skip
 * - Image captured once per POI, not per reading
 */

import { useRef, useCallback, useEffect } from 'react';
import { useSerialStore } from '@/lib/stores/serialStore';
import { usePOIStore, shouldRecordHeightClearance } from '@/lib/poi';
import { useSettingsStore } from '@/lib/settings';
import { useRainModeStore } from '@/lib/stores/rainModeStore';
import { useLoggingCore, parseMeters, getGpsSnapshot } from './useLoggingCore';

interface UseAllDataModeProps {
  isActive: boolean;
  captureImage: () => Promise<string | null>;
  onPOILogged?: (count: number) => void;
}

export function useAllDataMode({ isActive, captureImage, onPOILogged }: UseAllDataModeProps) {
  const { lastMeasurement } = useSerialStore();
  const { selectedType: selectedPOIType } = usePOIStore();
  const { alertSettings } = useSettingsStore();
  const { activeSurvey, groundRef, savePOI, getNextPoiNumber } = useLoggingCore();

  const lastLoggedRef = useRef<string | null>(null);
  const countRef = useRef(0);

  const logCurrent = useCallback(async () => {
    if (!isActive || !activeSurvey?.id) return;
    if (!lastMeasurement || lastMeasurement === lastLoggedRef.current) return;

    // If the active POI type does NOT require a laser measurement, ignore.
    // Those POIs are created by user pressing a button, not by laser readings.
    const poiType = selectedPOIType || 'wire';
    if (!shouldRecordHeightClearance(poiType)) return;

    const reading = parseMeters(lastMeasurement, groundRef);
    if (!reading.isValid) return;

    // Height range filter
    const minH = alertSettings?.thresholds?.minHeight ?? 4;
    const maxH = alertSettings?.thresholds?.maxHeight ?? 25;
    if (reading.meters < minH || reading.meters > maxH) return;

    lastLoggedRef.current = lastMeasurement;

    // Capture timestamp + GPS + image NOW (this reading = this POI)
    const gps = getGpsSnapshot();
    const now = new Date();
    const id = globalThis.crypto?.randomUUID?.() || `poi-${Date.now()}-${Math.random()}`;
    const poiNumber = await getNextPoiNumber();
    const imageUrl = await captureImage().catch(() => null);

    // Save POI — fire-and-forget
    savePOI({
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
      imageUrl,
      images: imageUrl ? [imageUrl] : [],
      source: 'all_data',
      loggingMode: 'all_data',
      note: `${poiType} | ${reading.meters.toFixed(2)}m | GND:${groundRef.toFixed(2)}m${useRainModeStore.getState().isActive ? ' | RAIN MODE' : ''}`,
    }).catch(() => {});

    countRef.current++;
    onPOILogged?.(countRef.current);
  }, [isActive, activeSurvey?.id, lastMeasurement, selectedPOIType, groundRef, savePOI, getNextPoiNumber, captureImage, onPOILogged, alertSettings]);

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
