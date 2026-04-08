/**
 * useCounterMode — sky→measure→sky detection with intelligent buffering
 *
 * Logic:
 * 1. First valid reading → capture GPS + image immediately (async)
 * 2. Buffer all readings while object detected
 * 3. Log POI when first of these occurs:
 *    a) Sky detected for > skyTimeoutMs (default 1000ms)
 *    b) Max object duration exceeded (default 5000ms)
 *    c) Max object distance exceeded (default 300m)
 *    d) User changes POI type → log immediately
 * 4. POI = min reading in 'height', avg in 'notes'
 * 5. Restart immediately after each POI
 *
 * Applies SAME rules to all POI types (unlike Buffer mode which is per-type)
 */

import { useRef, useCallback, useEffect, useState } from 'react';
import { useSerialStore } from '@/lib/stores/serialStore';
import { useGPSStore } from '@/lib/stores/gpsStore';
import { usePOIStore } from '@/lib/poi';
import { getLaserLog } from '@/lib/laserLog';
import { useLoggingCore, parseMeters, getGpsSnapshot, isInvalidReading } from './useLoggingCore';
import { calculateDistance } from '@/lib/utils/geoUtils';

interface CounterConfig {
  skyTimeoutMs: number;      // ms of continuous sky to end object (default 1000)
  maxObjectMs: number;       // max duration before forced log (default 5000)
  maxObjectDistM: number;    // max distance before forced log (default 300)
  counterThreshold: number;  // consecutive sky readings to confirm sky (default 7 at 150ms = ~1s)
}

const DEFAULT_CONFIG: CounterConfig = {
  skyTimeoutMs: 1000,
  maxObjectMs: 5000,
  maxObjectDistM: 300,
  counterThreshold: 7,
};

interface UseCounterModeProps {
  isActive: boolean;
  captureImage: () => Promise<string | null>;
  config?: Partial<CounterConfig>;
  onPOILogged?: (count: number) => void;
}

type DetectionState = 'sky' | 'object';

export function useCounterMode({ isActive, captureImage, config = {}, onPOILogged }: UseCounterModeProps) {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const { activeSurvey, groundRef, savePOI, getNextPoiNumber } = useLoggingCore();
  const { selectedType: selectedPOIType } = usePOIStore();

  // Detection state
  const stateRef = useRef<DetectionState>('sky');
  const bufferRef = useRef<number[]>([]);           // buffered readings (meters)
  const skyCountRef = useRef(0);                     // consecutive sky readings
  const objectStartTimeRef = useRef<number>(0);
  const objectStartGpsRef = useRef<{ lat: number; lng: number } | null>(null);
  const capturedImageRef = useRef<string | null>(null);
  const capturedGpsRef = useRef<ReturnType<typeof getGpsSnapshot> | null>(null);
  const activePOITypeRef = useRef(selectedPOIType);
  const countRef = useRef(0);
  const lastProcessedSeqRef = useRef(0);
  const intervalRef = useRef<number | null>(null);

  // Track POI type changes
  useEffect(() => {
    if (!isActive) return;
    if (activePOITypeRef.current !== selectedPOIType && bufferRef.current.length > 0) {
      // User changed POI type mid-object → log immediately
      logBuffer('poi_type_change');
    }
    activePOITypeRef.current = selectedPOIType;
  }, [selectedPOIType, isActive]);

  const logBuffer = useCallback(async (reason: string) => {
    if (bufferRef.current.length === 0) return;

    const readings = bufferRef.current;
    const minReading = Math.min(...readings);
    const avgReading = readings.reduce((a, b) => a + b, 0) / readings.length;
    const poiType = activePOITypeRef.current || 'wire';
    const gps = capturedGpsRef.current || getGpsSnapshot();
    const imageUrl = capturedImageRef.current;
    const now = new Date();

    // Reset buffer immediately so next object can start
    bufferRef.current = [];
    capturedImageRef.current = null;
    capturedGpsRef.current = null;
    objectStartGpsRef.current = null;
    stateRef.current = 'sky';
    skyCountRef.current = 0;

    if (!activeSurvey?.id) return;

    const id = globalThis.crypto?.randomUUID?.() || `poi-${Date.now()}`;
    const poiNumber = await getNextPoiNumber();

    await savePOI({
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
      note: `${poiType} | Min:${minReading.toFixed(2)}m Avg:${avgReading.toFixed(2)}m | ${readings.length} readings | GND:${groundRef.toFixed(2)}m | Reason:${reason}`,
      source: 'counter',
      loggingMode: 'counter_detection',
    });

    countRef.current++;
    onPOILogged?.(countRef.current);
  }, [activeSurvey?.id, groundRef, savePOI, getNextPoiNumber, onPOILogged]);

  const processTick = useCallback(async () => {
    if (!isActive || !activeSurvey?.id) return;

    const rawLog = getLaserLog();
    if (!rawLog) return;

    const lines = rawLog.split('\n').filter(l => l.trim());
    if (lines.length === 0) return;

    const currentSeq = lines.length;
    if (currentSeq === lastProcessedSeqRef.current) return;
    lastProcessedSeqRef.current = currentSeq;

    const lastLine = lines[lines.length - 1].trim();
    const isSky = isInvalidReading(lastLine) || 
                  /^D\s+0+\.0+/.test(lastLine) ||  // very close reading
                  lastLine.includes('[ERR]');

    // Parse measurement
    let measuredM: number | null = null;
    if (!isSky) {
      // Try raw LDM71 format: "D xxxx.xxx ampl" or "D xxxx.xxx"
      const m = lastLine.match(/^D\s+(\d+\.\d+)/);
      if (m) measuredM = parseFloat(m[1]) + groundRef;
      // Try other formats
      if (!measuredM) {
        const n = parseFloat(lastLine);
        if (!isNaN(n) && n > 0.1) measuredM = n + groundRef;
      }
    }

    if (isSky || measuredM === null) {
      // Sky reading
      skyCountRef.current++;
      
      if (stateRef.current === 'object' && bufferRef.current.length > 0) {
        // Check if sky timeout exceeded
        const skyDurationMs = skyCountRef.current * 150;
        if (skyDurationMs >= cfg.skyTimeoutMs) {
          await logBuffer('sky_timeout');
        }
      }
    } else {
      // Valid reading
      skyCountRef.current = 0;

      if (stateRef.current === 'sky') {
        // Transition: sky → object
        stateRef.current = 'object';
        objectStartTimeRef.current = Date.now();
        const gps = getGpsSnapshot();
        capturedGpsRef.current = gps;
        objectStartGpsRef.current = { lat: gps.latitude, lng: gps.longitude };

        // Capture image immediately (async)
        captureImage().then(url => { capturedImageRef.current = url; }).catch(() => {});
      }

      // Add to buffer
      bufferRef.current.push(measuredM);

      // Check max duration
      const elapsed = Date.now() - objectStartTimeRef.current;
      if (elapsed >= cfg.maxObjectMs) {
        await logBuffer('max_duration');
        return;
      }

      // Check max distance
      if (objectStartGpsRef.current) {
        const gps = getGpsSnapshot();
        const distKm = calculateDistance(
          objectStartGpsRef.current.lat, objectStartGpsRef.current.lng,
          gps.latitude, gps.longitude
        );
        if (distKm * 1000 >= cfg.maxObjectDistM) {
          await logBuffer('max_distance');
        }
      }
    }
  }, [isActive, activeSurvey?.id, groundRef, cfg, logBuffer, captureImage]);

  // Start/stop 150ms timer
  useEffect(() => {
    if (isActive) {
      intervalRef.current = window.setInterval(processTick, 150);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
      // Flush any remaining buffer when stopping
      if (bufferRef.current.length > 0) logBuffer('mode_stopped');
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isActive]);

  const reset = useCallback(() => {
    bufferRef.current = [];
    capturedImageRef.current = null;
    capturedGpsRef.current = null;
    stateRef.current = 'sky';
    skyCountRef.current = 0;
    countRef.current = 0;
    lastProcessedSeqRef.current = 0;
  }, []);

  return { count: countRef.current, state: stateRef.current, reset };
}
