/**
 * useLoggingCore — shared primitives for all logging modes
 *
 * Handles:
 * - Saving a POI to IndexedDB (via measurementLogger worker) + SQLite (via IPC)
 * - Getting current GPS snapshot
 * - Async image capture (non-blocking — doesn't delay POI creation)
 * - Getting next POI number
 */

import React, { useCallback } from 'react';
import { useGPSStore } from '@/lib/stores/gpsStore';
import { useLaserStore } from '@/lib/laser';
import { useSurveyStore } from '@/lib/survey';
import { usePOIActionsStore } from '@/lib/poiActions';
import { soundManager } from '@/lib/sounds';
import { openSurveyDB } from '@/lib/survey/db';
import { getMeasurementFeed } from '@/lib/survey/MeasurementFeed';
import { getMeasurementLogger } from '@/lib/workers/MeasurementLoggerClient';
import type { POIType } from '@/lib/poi';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface GpsSnapshot {
  latitude: number;
  longitude: number;
  altitude: number;
  speed: number;       // km/h
  heading: number;     // degrees
  source: string;
  fixQuality: string;
}

export interface LaserReading {
  raw: string;         // raw string from laser
  meters: number;      // converted to meters
  isValid: boolean;
  isSky: boolean;      // DE02, --, infinity, <= 0.1m
}

export interface POIRecord {
  id: string;
  surveyId: string;
  poiType: string;
  poiNumber: number;
  roadNumber: number;

  heightM: number | null;          // adjusted = raw + groundRef
  heightRawM: number | null;       // raw laser reading
  groundRefM: number;
  heightMinM?: number | null;      // min in buffer
  heightAvgM?: number | null;      // avg in buffer
  readingCount?: number;

  gps: GpsSnapshot;
  utcDate: string;
  utcTime: string;
  createdAt: string;

  imageUrl?: string | null;
  images?: string[];
  note?: string;
  source: 'manual' | 'all_data' | 'counter' | 'buffer';
  loggingMode?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function isInvalidReading(value: string | null | undefined): boolean {
  if (!value) return true;
  const s = value.trim();
  if (s === '--' || s === 'infinity' || s === 'DE02' || s === 'de02') return true;
  if (/^[Dd][Ee]\d+$/.test(s)) return true;  // DE02, De02, de02
  if (/^[Ee]\d+$/.test(s)) return true;       // E001
  if (s === '[ERR]') return true;
  const n = parseFloat(s);
  if (isNaN(n) || n <= 0.1) return true;      // noise/ground reflection
  return false;
}

export function parseMeters(raw: string, groundRef = 0): LaserReading {
  if (isInvalidReading(raw)) {
    return { raw, meters: 0, isValid: false, isSky: true };
  }
  const n = parseFloat(raw);
  if (isNaN(n)) return { raw, meters: 0, isValid: false, isSky: false };
  return {
    raw,
    meters: Math.round((n + groundRef) * 1000) / 1000,
    isValid: true,
    isSky: false,
  };
}

export function getGpsSnapshot(): GpsSnapshot {
  const gps = useGPSStore.getState().data;
  return {
    latitude:   gps.latitude  || 0,
    longitude:  gps.longitude || 0,
    altitude:   gps.altitude  || 0,
    speed:      gps.speed     || 0,
    heading:    gps.course    || 0,
    source:     gps.source    || 'none',
    fixQuality: gps.fixQuality || 'No Fix',
  };
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useLoggingCore() {
  const { activeSurvey } = useSurveyStore();
  const { groundReferenceHeight } = useLaserStore();

  /**
   * Save a POI record to IndexedDB immediately.
   * Image capture happens async and attaches itself later.
   * Returns true if saved, false if no active survey.
   */
  const savePOI = useCallback(async (record: POIRecord): Promise<boolean> => {
    if (!activeSurvey?.id) return false;

    const now = new Date();
    const measurement = {
      id:         record.id,
      user_id:    record.surveyId,
      poi_type:   record.poiType,
      poiNumber:  record.poiNumber,
      roadNumber: record.roadNumber,
      rel:        record.heightM !== null ? Math.round((record.heightM) * 100) / 100 : null,
      // GND REF FIX: persist the ground reference value alongside the measurement.
      // Was previously only embedded in the `note` string, leaving the dedicated
      // `Ground Ref (m)` CSV column at 0.000 for every historical export.
      groundRefM: record.groundRefM ?? 0,
      altGPS:     record.gps.altitude,
      latitude:   record.gps.latitude,
      longitude:  record.gps.longitude,
      utcDate:    record.utcDate,
      utcTime:    record.utcTime,
      speed:      record.gps.speed,
      heading:    record.gps.heading,
      imageUrl:   record.imageUrl || null,
      images:     record.images || [],
      note:       record.note || '',
      createdAt:  record.createdAt,
      source:     record.source,
    };

    try {
      // PERF: Update in-memory cache FIRST for instant UI feedback
      getMeasurementFeed().addMeasurement(measurement as any);

      // PERF: Queue IndexedDB write to worker (non-blocking, batched).
      // Before this fix, `await db.put()` on the main thread blocked 10-200ms
      // per write due to IndexedDB lock contention with the worker's batch writes.
      try {
        const logger = getMeasurementLogger();
        await logger.logMeasurement(measurement as any);
      } catch {
        // Worker unavailable — fallback to direct write (still works, just slower)
        const db = await openSurveyDB();
        await db.put('measurements', measurement);
      }

      // Clear the captured image from pending photos
      if (measurement.imageUrl) {
        window.dispatchEvent(new CustomEvent('poi-image-attached', { detail: measurement.imageUrl }));
      }
      soundManager.playLogEntry();
      return true;
    } catch (e) {
      console.error('[LoggingCore] savePOI failed:', e);
      return false;
    }
  }, [activeSurvey?.id]);

  /**
   * Get the next available POI number for the current survey.
   *
   * PERF (v16.1.27): cached in-memory counter seeded once from IndexedDB when
   * the survey first opens. Before this fix, every single POI creation did a
   * full IndexedDB getAllFromIndex + O(n) reduce over all measurements, which
   * cost 50-200ms per POI at 800+ entries. Now it's a local variable increment.
   */
  const poiCounterRef = React.useRef<{ surveyId: string | null; nextNumber: number }>({
    surveyId: null,
    nextNumber: 1,
  });

  const getNextPoiNumber = useCallback(async (): Promise<number> => {
    if (!activeSurvey?.id) return 1;

    // If the counter is already seeded for this survey, just increment.
    if (poiCounterRef.current.surveyId === activeSurvey.id) {
      return poiCounterRef.current.nextNumber++;
    }

    // First call for this survey: seed from IndexedDB (one-time cost).
    try {
      const db = await openSurveyDB();
      const all = await db.getAllFromIndex('measurements', 'by-survey', activeSurvey.id);
      const maxPOI = all.reduce((max: number, m: any) => Math.max(max, m.poiNumber || 0), 0);
      poiCounterRef.current = { surveyId: activeSurvey.id, nextNumber: maxPOI + 2 };
      return maxPOI + 1;
    } catch {
      poiCounterRef.current = { surveyId: activeSurvey.id, nextNumber: 2 };
      return 1;
    }
  }, [activeSurvey?.id]);

  /**
   * Capture image async — never blocks POI creation
   * Call BEFORE creating the POI, then attach result when ready
   */
  const captureImageAsync = useCallback(async (
    captureImageFn: () => Promise<string | null>
  ): Promise<string | null> => {
    try {
      return await captureImageFn();
    } catch (e) {
      console.warn('[LoggingCore] Image capture failed (non-blocking):', e);
      return null;
    }
  }, []);

  return {
    activeSurvey,
    groundRef: isNaN(groundReferenceHeight) ? 0 : groundReferenceHeight,
    savePOI,
    getNextPoiNumber,
    captureImageAsync,
    getGpsSnapshot,
    parseMeters,
    isInvalidReading,
  };
}
