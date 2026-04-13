/**
 * useCounterMode — sky→object→sky detection
 *
 * Reacts to lastMeasurement changes from serialStore (same as All Data).
 * State machine: sky → object (buffer readings) → sky (log POI with min height)
 */

import { useRef, useCallback, useEffect } from 'react';
import { useSerialStore } from '@/lib/stores/serialStore';
import { usePOIStore } from '@/lib/poi';
import { usePOIActionsStore } from '@/lib/poiActions';
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
  skyTimeoutMs: 500,       // 0.5s — field-tested optimal for driving speed
  maxObjectMs: 3000,       // 3s — force-log after 3s under object
  maxObjectDistM: 50,      // 50m — force-log after 50m travel under object
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
  const { lastMeasurement, lastMeasurementPoiType } = useSerialStore();
  const { activeSurvey, groundRef, savePOI, getNextPoiNumber } = useLoggingCore();
  const { selectedType: selectedPOIType } = usePOIStore();
  const { getActionForPOI } = usePOIActionsStore();
  const { alertSettings } = useSettingsStore();

  const stateRef = useRef<DetectionState>('sky');
  const bufferRef = useRef<number[]>([]);
  const skyCountRef = useRef(0);
  const objectStartTimeRef = useRef<number>(0);
  const capturedImageRef = useRef<string | null>(null);
  const capturedGpsRef = useRef<ReturnType<typeof getGpsSnapshot> | null>(null);
  // RACE FIX: Snapshot the POI type at the sky→object transition. The user is
  // free to switch to the next POI type while we're still buffering this one's
  // readings; without this snapshot we'd log the buffer with the new type.
  const bufferPoiTypeRef = useRef<string | null>(null);
  const countRef = useRef(0);
  const skyTimerRef = useRef<number | null>(null);

  const logBuffer = useCallback(async () => {
    if (bufferRef.current.length === 0 || !activeSurvey?.id) return;

    // Use the snapshot taken at object detection, not the live store value.
    const poiType = bufferPoiTypeRef.current || selectedPOIType || 'wire';
    const action = getActionForPOI(poiType as any);
    if (action === 'voice-note' || action === 'select-only' || action === 'auto-capture-no-measurement') {
      bufferRef.current = [];
      stateRef.current = 'sky';
      return;
    }

    const readings = bufferRef.current;
    const minReading = Math.min(...readings);
    const avgReading = readings.reduce((a, b) => a + b, 0) / readings.length;
    const gps = capturedGpsRef.current || getGpsSnapshot();
    const imageUrl = capturedImageRef.current;
    const now = new Date();

    // Reset immediately
    bufferRef.current = [];
    capturedImageRef.current = null;
    capturedGpsRef.current = null;
    bufferPoiTypeRef.current = null;
    stateRef.current = 'sky';
    skyCountRef.current = 0;

    const id = globalThis.crypto?.randomUUID?.() || `poi-${Date.now()}`;
    const poiNumber = await getNextPoiNumber();

    // PERF: Fire-and-forget — don't await worker. Cache update is synchronous.
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
      note: `Min: ${minReading.toFixed(2)}m | Avg: ${avgReading.toFixed(2)}m | ${readings.length} readings | GND: ${groundRef.toFixed(2)}m${useRainModeStore.getState().isActive ? ' | RAIN MODE — no laser measurement' : ''}`,
      source: 'counter',
      loggingMode: 'counter_detection',
    }).catch(() => {});

    countRef.current++;
    onPOILogged?.(countRef.current);
  }, [activeSurvey?.id, groundRef, savePOI, getNextPoiNumber, selectedPOIType, getActionForPOI, onPOILogged]);

  // React to every measurement change
  useEffect(() => {
    if (!isActive || !activeSurvey?.id) return;
    if (!lastMeasurement) return;

    const isSky = isInvalidReading(lastMeasurement);

    if (isSky) {
      skyCountRef.current++;

      if (stateRef.current === 'object' && bufferRef.current.length > 0) {
        // Start sky timer — if sky persists for skyTimeoutMs, log the buffer
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

      // Cancel sky timer if we get a valid reading
      if (skyTimerRef.current) {
        clearTimeout(skyTimerRef.current);
        skyTimerRef.current = null;
      }

      const reading = parseMeters(lastMeasurement, groundRef);
      if (!reading.isValid) return;

      // HEIGHT RANGE FILTER (v16.1.27): skip readings outside the "ignore
      // above/below" thresholds. Without this, ground reflections (<4m) and
      // sky bounces (>25m) entered the buffer and produced garbage POIs.
      const minH = alertSettings?.thresholds?.minHeight ?? 4;
      const maxH = alertSettings?.thresholds?.maxHeight ?? 25;
      if (reading.meters < minH || reading.meters > maxH) return;

      if (stateRef.current === 'sky') {
        // Transition: sky → object
        stateRef.current = 'object';
        objectStartTimeRef.current = Date.now();
        capturedGpsRef.current = getGpsSnapshot();
        // Lock in the POI type at the moment we detect this object. The user
        // hears the capture sound here and is free to switch to the next type.
        bufferPoiTypeRef.current = lastMeasurementPoiType || selectedPOIType || null;

        // Capture image immediately
        captureImage().then(url => { capturedImageRef.current = url; }).catch(() => {});
      }

      bufferRef.current.push(reading.meters);

      // Force log if max duration exceeded
      const elapsed = Date.now() - objectStartTimeRef.current;
      if (elapsed >= cfg.maxObjectMs) {
        if (skyTimerRef.current) { clearTimeout(skyTimerRef.current); skyTimerRef.current = null; }
        logBuffer();
        return;
      }

      // Force log if max distance exceeded (GPS-based)
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
    capturedImageRef.current = null;
    capturedGpsRef.current = null;
    bufferPoiTypeRef.current = null;
    stateRef.current = 'sky';
    skyCountRef.current = 0;
    countRef.current = 0;
    if (skyTimerRef.current) { clearTimeout(skyTimerRef.current); skyTimerRef.current = null; }
  }, []);

  return { count: countRef.current, state: stateRef.current, reset };
}
