/**
 * useTraceRecorder — records GPS breadcrumbs along the survey route.
 *
 * While logging is active and a survey is open, samples the GPS position
 * every INTERVAL_MS and writes a VehicleTrace record to IndexedDB.
 *
 * The trace is displayed as a polyline on VehicleMap and FullscreenMap,
 * and exported as GPX with the survey package.
 */

import { useEffect, useRef } from 'react';
import { useGPSStore } from '@/lib/stores/gpsStore';
import { useSurveyStore } from '@/lib/survey';
import { openSurveyDB } from '@/lib/survey/db';
import type { VehicleTrace } from '@/lib/survey/types';

// Sample GPS every 5 seconds — ~720 points per hour at driving speed
const TRACE_INTERVAL_MS = 5000;
// Minimum distance (meters) between trace points to avoid duplicates when stopped
const MIN_DISTANCE_M = 2;

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Trace records whenever a survey is active — not just during laser logging.
 * The vehicle drives to the site, between POIs, during breaks — all part of the route.
 */
export function useTraceRecorder() {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastPointRef = useRef<{ lat: number; lon: number } | null>(null);
  const activeSurvey = useSurveyStore(s => s.activeSurvey);

  useEffect(() => {
    if (!activeSurvey?.id) {
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
      lastPointRef.current = null;
      return;
    }

    const surveyId = activeSurvey.id;

    const recordPoint = async () => {
      const { data: gps } = useGPSStore.getState();

      if (!surveyId) return;
      if (!gps.latitude || !gps.longitude) return;
      if (gps.latitude === 0 && gps.longitude === 0) return;

      // Skip if haven't moved enough
      if (lastPointRef.current) {
        const dist = haversineDistance(
          lastPointRef.current.lat, lastPointRef.current.lon,
          gps.latitude, gps.longitude
        );
        if (dist < MIN_DISTANCE_M) return;
      }

      lastPointRef.current = { lat: gps.latitude, lon: gps.longitude };

      const trace: VehicleTrace = {
        id: `trace-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        surveyId,
        routeId: '',
        latitude: gps.latitude,
        longitude: gps.longitude,
        speed: gps.speed || 0,
        heading: gps.course || 0,
        timestamp: new Date().toISOString(),
      };

      try {
        const db = await openSurveyDB();
        await db.put('vehicleTraces', trace);
      } catch {
        // Non-blocking — trace loss is not critical
      }
    };

    // Record first point immediately
    recordPoint();
    intervalRef.current = setInterval(recordPoint, TRACE_INTERVAL_MS);

    return () => {
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    };
  }, [activeSurvey?.id]);
}
