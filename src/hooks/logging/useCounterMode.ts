/**
 * useCounterMode — auto-detect (sky→object→sky)
 *
 * Rules:
 * - Active POI type does NOT require measurement → IGNORE all laser readings
 * - Active POI type REQUIRES measurement:
 *   1. Wait for sky→object transition (first valid reading after sky)
 *   2. Buffer readings while under object
 *   3. Log POI when FIRST of these triggers:
 *      a) Sky returns for skyTimeoutMs seconds → log with min height
 *      b) maxObjectMs elapsed since first reading → force-log
 *      c) maxObjectDistM meters traveled since first reading → force-log
 *   4. Image captured ONCE at the moment of logging, NOT at every reading
 */

import { useRef, useCallback, useEffect } from 'react';
import { useSerialStore } from '@/lib/stores/serialStore';
import { usePOIStore, shouldRecordHeightClearance } from '@/lib/poi';
import { useSettingsStore } from '@/lib/settings';
import { useRainModeStore } from '@/lib/stores/rainModeStore';
import { useLoggingCore, parseMeters, getGpsSnapshot, isInvalidReading } from './useLoggingCore';

interface CounterConfig {
  skyTimeoutMs: number;
  maxObjectMs: number;
  maxObjectDistM: number;
  counterThreshold: number;
}

const DEFAULT_CONFIG: CounterConfig = {
  skyTimeoutMs: 500,
  maxObjectMs: 3000,
  maxObjectDistM: 50,
  counterThreshold: 7,
};

function loadAutoCaptureConfig(): Partial<CounterConfig> {
  try {
    const saved = localStorage.getItem('auto_capture_config');
    if (!saved) return {};
    return JSON.parse(saved) as Partial<CounterConfig>;
  } catch { return {}; }
}

export function saveAutoCaptureConfig(config: Partial<CounterConfig>) {
  localStorage.setItem('auto_capture_config', JSON.stringify(config));
}

export function getAutoCaptureConfig(): CounterConfig {
  return { ...DEFAULT_CONFIG, ...loadAutoCaptureConfig() };
}

interface UseCounterModeProps {
  isActive: boolean;
  captureImage: () => Promise<string | null>;
  config?: Partial<CounterConfig>;
  onPOILogged?: (count: number) => void;
}

type DetectionState = 'sky' | 'object';

export function useCounterMode({ isActive, captureImage, onPOILogged }: UseCounterModeProps) {
  const cfg = { ...DEFAULT_CONFIG, ...loadAutoCaptureConfig() };
  const { lastMeasurement } = useSerialStore();
  const { activeSurvey, groundRef, savePOI, getNextPoiNumber } = useLoggingCore();
  const { selectedType: selectedPOIType } = usePOIStore();
  const { alertSettings } = useSettingsStore();

  const stateRef = useRef<DetectionState>('sky');
  const bufferRef = useRef<number[]>([]);
  const skyCountRef = useRef(0);
  const objectStartTimeRef = useRef<number>(0);
  const capturedGpsRef = useRef<ReturnType<typeof getGpsSnapshot> | null>(null);
  const bufferPoiTypeRef = useRef<string | null>(null);
  const countRef = useRef(0);
  const skyTimerRef = useRef<number | null>(null);

  // Log the buffered readings as a single POI.
  // Image is captured NOW (at log time), not during buffering.
  const logBuffer = useCallback(async () => {
    if (bufferRef.current.length === 0 || !activeSurvey?.id) return;

    const poiType = bufferPoiTypeRef.current || selectedPOIType || 'wire';

    const readings = bufferRef.current;
    const minReading = Math.min(...readings);
    const avgReading = readings.reduce((a, b) => a + b, 0) / readings.length;
    const gps = capturedGpsRef.current || getGpsSnapshot();
    const now = new Date();

    // Reset state immediately so new detections can start
    bufferRef.current = [];
    capturedGpsRef.current = null;
    bufferPoiTypeRef.current = null;
    stateRef.current = 'sky';
    skyCountRef.current = 0;

    const id = globalThis.crypto?.randomUUID?.() || `poi-${Date.now()}`;
    const poiNumber = await getNextPoiNumber();

    // Capture image NOW — at the moment we log, not during detection
    const imageUrl = await captureImage().catch(() => null);

    // Fire-and-forget
    savePOI({
      id,
      surveyId: activeSurvey.id,
      poiType,
      poiNumber,
      roadNumber: activeSurvey.roadNumber || 1,
      heightM: Math.round(minReading * 100) / 100,
      heightRawM: Math.round((minReading - groundRef) * 100) / 100,
      groundRefM: groundRef,
      heightMinM: Math.round(minReading * 100) / 100,
      heightAvgM: Math.round(avgReading * 100) / 100,
      readingCount: readings.length,
      gps,
      utcDate: now.toISOString().split('T')[0],
      utcTime: now.toTimeString().split(' ')[0],
      createdAt: now.toISOString(),
      imageUrl,
      images: imageUrl ? [imageUrl] : [],
      note: `Min: ${minReading.toFixed(2)}m | Avg: ${avgReading.toFixed(2)}m | ${readings.length} readings | GND: ${groundRef.toFixed(2)}m${useRainModeStore.getState().isActive ? ' | RAIN MODE' : ''}`,
      source: 'counter',
      loggingMode: 'counter_detection',
    }).catch(() => {});

    countRef.current++;
    onPOILogged?.(countRef.current);
  }, [activeSurvey?.id, groundRef, savePOI, getNextPoiNumber, selectedPOIType, captureImage, onPOILogged]);

  // React to every measurement change
  useEffect(() => {
    if (!isActive || !activeSurvey?.id) return;
    if (!lastMeasurement) return;

    // If the active POI type does NOT require a laser measurement, ignore everything.
    const currentType = selectedPOIType || '';
    if (!shouldRecordHeightClearance(currentType)) return;

    const isSky = isInvalidReading(lastMeasurement);

    if (isSky) {
      skyCountRef.current++;

      if (stateRef.current === 'object' && bufferRef.current.length > 0) {
        // Sky detected while under object — start sky timer
        if (!skyTimerRef.current) {
          skyTimerRef.current = window.setTimeout(() => {
            skyTimerRef.current = null;
            logBuffer();
          }, cfg.skyTimeoutMs);
        }
      }
    } else {
      // Valid reading
      skyCountRef.current = 0;

      // Cancel sky timer if we get a valid reading (still under object)
      if (skyTimerRef.current) {
        clearTimeout(skyTimerRef.current);
        skyTimerRef.current = null;
      }

      const reading = parseMeters(lastMeasurement, groundRef);
      if (!reading.isValid) return;

      // Height range filter
      const minH = alertSettings?.thresholds?.minHeight ?? 4;
      const maxH = alertSettings?.thresholds?.maxHeight ?? 25;
      if (reading.meters < minH || reading.meters > maxH) return;

      if (stateRef.current === 'sky') {
        // Transition: sky → object
        stateRef.current = 'object';
        objectStartTimeRef.current = Date.now();
        capturedGpsRef.current = getGpsSnapshot();
        bufferPoiTypeRef.current = currentType || null;
        // NO image capture here — image is captured at log time
      }

      bufferRef.current.push(reading.meters);

      // Force log if max duration OR max distance exceeded (FIRST wins)
      const elapsed = Date.now() - objectStartTimeRef.current;
      if (elapsed >= cfg.maxObjectMs) {
        if (skyTimerRef.current) { clearTimeout(skyTimerRef.current); skyTimerRef.current = null; }
        logBuffer();
        return;
      }

      if (cfg.maxObjectDistM > 0 && capturedGpsRef.current) {
        const gpsNow = getGpsSnapshot();
        if (gpsNow.latitude && gpsNow.longitude && capturedGpsRef.current.latitude && capturedGpsRef.current.longitude) {
          const R = 6371000;
          const dLat = (gpsNow.latitude - capturedGpsRef.current.latitude) * Math.PI / 180;
          const dLon = (gpsNow.longitude - capturedGpsRef.current.longitude) * Math.PI / 180;
          const a = Math.sin(dLat/2)**2 + Math.cos(capturedGpsRef.current.latitude * Math.PI/180) * Math.cos(gpsNow.latitude * Math.PI/180) * Math.sin(dLon/2)**2;
          const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
          if (dist >= cfg.maxObjectDistM) {
            if (skyTimerRef.current) { clearTimeout(skyTimerRef.current); skyTimerRef.current = null; }
            logBuffer();
          }
        }
      }
    }
  }, [lastMeasurement, isActive]);

  // Cleanup on deactivation
  useEffect(() => {
    if (!isActive) {
      if (bufferRef.current.length > 0) logBuffer();
      if (skyTimerRef.current) { clearTimeout(skyTimerRef.current); skyTimerRef.current = null; }
    }
  }, [isActive]);

  const reset = useCallback(() => {
    bufferRef.current = [];
    capturedGpsRef.current = null;
    bufferPoiTypeRef.current = null;
    stateRef.current = 'sky';
    skyCountRef.current = 0;
    countRef.current = 0;
    if (skyTimerRef.current) { clearTimeout(skyTimerRef.current); skyTimerRef.current = null; }
  }, []);

  return { count: countRef.current, state: stateRef.current, reset };
}
