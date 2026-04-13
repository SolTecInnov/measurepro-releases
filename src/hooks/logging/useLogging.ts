/**
 * useLogging — main orchestrator replacing useMeasurementLogging
 *
 * Exposes: startLogging, stopLogging, isLogging, loggingMode, poisLogged
 * Three modes: 'all_data' | 'counter' | 'buffer'
 * Manual logging via logManual()
 */

import { useState, useCallback, useRef } from 'react';
import { useAllDataMode } from './useAllDataMode';
import { useCounterMode } from './useCounterMode';
import { useLoggingCore, parseMeters, getGpsSnapshot } from './useLoggingCore';
import { usePOIStore } from '@/lib/poi';
import { useSerialStore } from '@/lib/stores/serialStore';
import { useRainModeStore } from '@/lib/stores/rainModeStore';
import { soundManager } from '@/lib/sounds';

export type LoggingMode = 'all_data' | 'counter' | 'manual';

interface UseLoggingProps {
  captureImage: () => Promise<string | null>;
}

export function useLogging({ captureImage }: UseLoggingProps) {
  const [isLogging, setIsLogging] = useState(false);
  const [loggingMode, setLoggingMode] = useState<LoggingMode>('manual');
  const [poisLogged, setPoisLogged] = useState(0);

  const { activeSurvey, groundRef, savePOI, getNextPoiNumber } = useLoggingCore();
  const { selectedType: selectedPOIType } = usePOIStore();
  const { lastMeasurement, lastMeasurementPoiType } = useSerialStore();

  const onPOILogged = useCallback((count: number) => {
    setPoisLogged(count);
  }, []);

  // ── Modes ─────────────────────────────────────────────────────────────────

  const allData = useAllDataMode({
    isActive: isLogging && loggingMode === 'all_data',
    captureImage,
    onPOILogged,
  });

  const counter = useCounterMode({
    isActive: isLogging && loggingMode === 'counter',
    captureImage,
    onPOILogged,
  });

  // ── Controls ──────────────────────────────────────────────────────────────

  const startLogging = useCallback((mode: LoggingMode = 'manual') => {
    if (!activeSurvey?.id) return false;
    setLoggingMode(mode);
    setIsLogging(true);
    setPoisLogged(0);
    soundManager.playModeChange?.();
    return true;
  }, [activeSurvey?.id]);

  const stopLogging = useCallback(() => {
    setIsLogging(false);
    setLoggingMode('manual');
    localStorage.setItem('loggingMode', 'manual');
    allData.reset();
    counter.reset();
  }, [allData, counter]);

  /**
   * logManual — log current laser reading immediately
   * Used in manual mode or as override in any mode
   */
  const logManual = useCallback(async (): Promise<boolean> => {
    if (!activeSurvey?.id) return false;
    if (!lastMeasurement) return false;

    // POI type "None" (empty string) = pause mode — don't record anything
    if (!selectedPOIType) return false;

    const reading = parseMeters(lastMeasurement, groundRef);
    if (!reading.isValid) return false;

    // Manual mode: use the CURRENT selected POI type (user just pressed the button)
    const poiType = selectedPOIType || 'wire';
    const gps = getGpsSnapshot();
    const now = new Date();
    const id = globalThis.crypto?.randomUUID?.() || `poi-${Date.now()}`;
    const poiNumber = await getNextPoiNumber();

    // PERF: Capture image async — save POI first for instant feedback
    const imageUrl = await captureImage().catch(() => null);

    // PERF: Fire-and-forget — don't block on worker response
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
      note: `${poiType} | ${reading.meters.toFixed(2)}m | GND:${groundRef.toFixed(2)}m${useRainModeStore.getState().isActive ? ' | RAIN MODE — no laser measurement' : ''}`,
      source: 'manual',
      loggingMode: 'manual',
    }).catch(() => {});

    setPoisLogged(n => n + 1);
    return true;
  }, [activeSurvey?.id, lastMeasurement, lastMeasurementPoiType, selectedPOIType, groundRef, savePOI, getNextPoiNumber, captureImage]);

  return {
    // State
    isLogging,
    loggingMode,
    poisLogged,
    isBuffering: false,
    bufferSize: 0,

    // Controls
    startLogging,
    stopLogging,
    logManual,

    // Mode shortcuts
    startAllData:  () => startLogging('all_data'),
    startCounter:  () => startLogging('counter'),
  };
}
