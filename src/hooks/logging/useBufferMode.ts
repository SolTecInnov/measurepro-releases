/**
 * useBufferMode — per-POI-type buffer detection
 *
 * Unlike counter mode (same rules for all types), buffer mode lets each POI type
 * define its own timer and distance. First of 3 conditions triggers POI creation:
 *   1. Sky detected > skyTimeoutMs
 *   2. Timer expires (per-type maxTimeMs)
 *   3. Distance exceeds (per-type maxDistM)
 *
 * After POI is created → immediately restart buffer for next POI of same type.
 * POI type change → log current buffer immediately, restart with new type.
 *
 * GPS + image captured at BEGINNING of buffer (not end).
 */

import { useRef, useCallback, useEffect } from 'react';
import { usePOIStore } from '@/lib/poi';
import { usePOIActionsStore } from '@/lib/poiActions';
import { getLaserLog } from '@/lib/laserLog';
import { useLoggingCore, getGpsSnapshot, isInvalidReading } from './useLoggingCore';
import { calculateDistance } from '@/lib/utils/geoUtils';
import { useBufferConfigStore } from '@/lib/detection/BufferDetectionService';
import type { POIType } from '@/lib/poi';

interface UseBufferModeProps {
  isActive: boolean;
  captureImage: () => Promise<string | null>;
  onPOILogged?: (count: number) => void;
}

export function useBufferMode({ isActive, captureImage, onPOILogged }: UseBufferModeProps) {
  const { activeSurvey, groundRef, savePOI, getNextPoiNumber } = useLoggingCore();
  const { selectedType: selectedPOIType } = usePOIStore();
  const { getActionForPOI } = usePOIActionsStore();
  const { getConfig } = useBufferConfigStore();

  const bufferRef = useRef<number[]>([]);
  const startTimeRef = useRef<number>(0);
  const startGpsRef = useRef<{ lat: number; lng: number } | null>(null);
  const capturedImageRef = useRef<string | null>(null);
  const capturedGpsRef = useRef<ReturnType<typeof getGpsSnapshot> | null>(null);
  const currentPOITypeRef = useRef(selectedPOIType);
  const skyStartTimeRef = useRef<number | null>(null);
  const bufferActiveRef = useRef(false);
  const lastProcessedSeqRef = useRef(0);
  const countRef = useRef(0);
  const intervalRef = useRef<number | null>(null);

  const getSkyTimeout = () => 1000; // 1 second of sky = end of object
  
  const getTypeConfig = (poiType: string) => {
    const cfg = getConfig(poiType as POIType);
    return {
      maxTimeMs:  (cfg?.timeSeconds  || 15) * 1000,
      maxDistM:   cfg?.distanceMeters || 100,
      mode:       cfg?.mode || 'distance',
    };
  };

  const flushBuffer = useCallback(async (reason: string, poiTypeOverride?: string) => {
    if (bufferRef.current.length === 0) return;

    const poiType = poiTypeOverride || currentPOITypeRef.current || 'wire';
    const action = getActionForPOI(poiType as any);

    // Skip POI types that should not auto-log (voice-note requires manual input)
    if (action === 'voice-note') {
      bufferRef.current = [];
      capturedImageRef.current = null;
      capturedGpsRef.current = null;
      startGpsRef.current = null;
      bufferActiveRef.current = false;
      skyStartTimeRef.current = null;
      startTimeRef.current = 0;
      return;
    }

    const readings = [...bufferRef.current];
    const gps = capturedGpsRef.current || getGpsSnapshot();
    const imageUrl = capturedImageRef.current;
    const minReading = Math.min(...readings);
    const avgReading = readings.reduce((a, b) => a + b, 0) / readings.length;
    const now = new Date();

    // Reset immediately so next object can start
    bufferRef.current = [];
    capturedImageRef.current = null;
    capturedGpsRef.current = null;
    startGpsRef.current = null;
    bufferActiveRef.current = false;
    skyStartTimeRef.current = null;
    startTimeRef.current = 0;

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
      note: `${poiType} | Min:${minReading.toFixed(2)}m Avg:${avgReading.toFixed(2)}m | ${readings.length} rdgs | GND:${groundRef.toFixed(2)}m | ${reason}`,
      source: 'buffer',
      loggingMode: 'buffer_detection',
    });

    countRef.current++;
    onPOILogged?.(countRef.current);
  }, [activeSurvey?.id, groundRef, savePOI, getNextPoiNumber, getActionForPOI, onPOILogged]);

  // Watch for POI type changes
  useEffect(() => {
    if (!isActive) return;
    const prevType = currentPOITypeRef.current;
    if (prevType !== selectedPOIType && bufferRef.current.length > 0) {
      flushBuffer('poi_type_change', prevType);
    }
    currentPOITypeRef.current = selectedPOIType;
  }, [selectedPOIType, isActive]);

  const processTick = useCallback(async () => {
    if (!isActive || !activeSurvey?.id) return;

    const rawLog = getLaserLog();
    if (!rawLog) return;
    const lines = rawLog.split('\n').filter(l => l.trim());
    if (!lines.length) return;

    const seq = lines.length;
    if (seq === lastProcessedSeqRef.current) return;
    lastProcessedSeqRef.current = seq;

    const lastLine = lines[lines.length - 1].trim();
    const isSky = isInvalidReading(lastLine) || lastLine.includes('[ERR]');

    let measuredM: number | null = null;
    if (!isSky) {
      const m = lastLine.match(/^D\s+(\d+\.\d+)/);
      if (m) measuredM = parseFloat(m[1]) + groundRef;
      else {
        const n = parseFloat(lastLine);
        if (!isNaN(n) && n > 0.1) measuredM = n + groundRef;
      }
    }

    const now = Date.now();
    const poiType = currentPOITypeRef.current || 'wire';
    const typeCfg = getTypeConfig(poiType);

    if (isSky || measuredM === null) {
      if (bufferActiveRef.current) {
        if (!skyStartTimeRef.current) skyStartTimeRef.current = now;
        const skyDuration = now - skyStartTimeRef.current;
        if (skyDuration >= getSkyTimeout()) {
          await flushBuffer('sky_timeout');
        }
      }
    } else {
      skyStartTimeRef.current = null; // Reset sky timer

      if (!bufferActiveRef.current) {
        // Start new buffer
        bufferActiveRef.current = true;
        startTimeRef.current = now;
        const gps = getGpsSnapshot();
        capturedGpsRef.current = gps;
        startGpsRef.current = { lat: gps.latitude, lng: gps.longitude };
        captureImage().then(url => { capturedImageRef.current = url; }).catch(() => {});
      }

      bufferRef.current.push(measuredM);

      // Check time limit
      const elapsed = now - startTimeRef.current;
      if (elapsed >= typeCfg.maxTimeMs) {
        await flushBuffer('max_time');
        return;
      }

      // Check distance limit
      if (startGpsRef.current) {
        const gps = getGpsSnapshot();
        const distKm = calculateDistance(
          startGpsRef.current.lat, startGpsRef.current.lng,
          gps.latitude, gps.longitude
        );
        if (distKm * 1000 >= typeCfg.maxDistM) {
          await flushBuffer('max_distance');
        }
      }
    }
  }, [isActive, activeSurvey?.id, groundRef, flushBuffer, captureImage]);

  useEffect(() => {
    if (isActive) {
      intervalRef.current = window.setInterval(processTick, 150);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (bufferRef.current.length > 0) flushBuffer('mode_stopped');
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isActive]);

  const reset = useCallback(() => {
    bufferRef.current = [];
    capturedImageRef.current = null;
    capturedGpsRef.current = null;
    bufferActiveRef.current = false;
    startGpsRef.current = null;
    countRef.current = 0;
    lastProcessedSeqRef.current = 0;
  }, []);

  return {
    count: countRef.current,
    isBuffering: bufferActiveRef.current,
    bufferSize: bufferRef.current.length,
    reset,
  };
}
