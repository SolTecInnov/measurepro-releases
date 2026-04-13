/**
 * HardwareWatchdog
 *
 * Monitors laser and GPS freshness while logging is active. When either device
 * stops reporting new data for a configurable number of seconds, shows a
 * persistent red/amber banner at the top of the screen and plays an alert sound.
 *
 * Why this matters: the user lost 15+ minutes of data on 2026-04-10 because the
 * GPS froze after losing internet at a gas station. All POIs during that window
 * were stacked on the same coordinates. Without a visual/audio alert, there's no
 * way to notice the freeze while driving.
 *
 * Design:
 * - Laser frozen = `measurementSampleId` from serialStore hasn't incremented in
 *   N seconds while the laser is connected. This fires even if the store
 *   throttle skips updates, because sampleId ticks on EVERY raw reading.
 * - GPS frozen = `data.lastUpdate` from gpsStore is older than M seconds while
 *   GPS reports connected. Covers both "no NMEA sentences arriving" and
 *   "NMEA arriving but coordinates stuck" (because lastUpdate is set when the
 *   coordinates actually change, not just when any NMEA sentence parses).
 * - Sound plays ONCE on entering frozen state, then every 30 seconds if still
 *   frozen. Does NOT spam.
 * - Banner auto-dismisses as soon as fresh data resumes.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { AlertTriangle, Satellite, Crosshair, X } from 'lucide-react';
import { useSerialStore } from '@/lib/stores/serialStore';
import { useGPSStore } from '@/lib/stores/gpsStore';
import { soundManager } from '@/lib/sounds';
import { useSurveyStore } from '@/lib/survey/store';

// Configurable thresholds (seconds). Could be moved to settings later.
const LASER_STALE_THRESHOLD_S = 10;   // 10 seconds without a new sample
const GPS_STALE_THRESHOLD_S   = 30;   // 30 seconds without a GPS update
const ALERT_REPEAT_INTERVAL_S = 30;   // re-play sound every 30s while frozen
const CHECK_INTERVAL_MS       = 3000; // check every 3 seconds

export default function HardwareWatchdog() {
  const { activeSurvey } = useSurveyStore();
  const laserConnected = useSerialStore(s => s.electronLaserConnected);
  const sampleId       = useSerialStore(s => s.measurementSampleId);
  const gpsConnected   = useGPSStore(s => s.connected);
  const gpsLastUpdate  = useGPSStore(s => s.data.lastUpdate);

  const [laserFrozen, setLaserFrozen] = useState(false);
  const [gpsFrozen, setGpsFrozen]     = useState(false);
  const [laserDismissed, setLaserDismissed] = useState(false);
  const [gpsDismissed, setGpsDismissed]     = useState(false);

  // Track the last "good" sampleId to detect stalls
  const lastSampleIdRef     = useRef(sampleId);
  const lastSampleChangeRef = useRef(Date.now());
  const lastAlertTimeRef    = useRef(0);

  // Update last-change timestamp whenever sampleId increments
  useEffect(() => {
    if (sampleId !== lastSampleIdRef.current) {
      lastSampleIdRef.current = sampleId;
      lastSampleChangeRef.current = Date.now();
    }
  }, [sampleId]);

  // Periodic staleness check
  useEffect(() => {
    // Only run the watchdog when there's an active survey — no point alerting
    // when the user is just browsing settings.
    if (!activeSurvey) return;

    const interval = setInterval(() => {
      const now = Date.now();

      // ── Laser check ──────────────────────────────────────────────────────
      const laserStale = laserConnected &&
        (now - lastSampleChangeRef.current) > LASER_STALE_THRESHOLD_S * 1000;
      // Auto-reset dismiss when data resumes then re-freezes
      if (!laserStale && laserFrozen) setLaserDismissed(false);
      setLaserFrozen(laserStale);

      // ── GPS check ────────────────────────────────────────────────────────
      const gpsStale = gpsConnected &&
        gpsLastUpdate > 0 &&
        (now - gpsLastUpdate) > GPS_STALE_THRESHOLD_S * 1000;
      if (!gpsStale && gpsFrozen) setGpsDismissed(false);
      setGpsFrozen(gpsStale);

      // ── Alert sound (skip if user dismissed) ─────────────────────────────
      const laserAlert = laserStale && !laserDismissed;
      const gpsAlert = gpsStale && !gpsDismissed;
      if ((laserAlert || gpsAlert) &&
          now - lastAlertTimeRef.current > ALERT_REPEAT_INTERVAL_S * 1000) {
        lastAlertTimeRef.current = now;
        try {
          soundManager.playCritical?.();
        } catch {
          // Sound playback is best-effort
        }
      }
    }, CHECK_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [activeSurvey, laserConnected, gpsConnected, gpsLastUpdate, laserFrozen, gpsFrozen, laserDismissed, gpsDismissed]);

  const showLaser = laserFrozen && !laserDismissed;
  const showGps = gpsFrozen && !gpsDismissed;

  // Don't render anything if no survey is active or nothing visible
  if (!activeSurvey || (!showLaser && !showGps)) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[99999] pointer-events-none">
      {showLaser && (
        <div className="pointer-events-auto bg-red-600/95 text-white px-4 py-2 flex items-center justify-center gap-3 text-sm font-semibold shadow-lg animate-pulse">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <Crosshair className="w-4 h-4 flex-shrink-0" />
          <span>LASER FROZEN — no new reading for {LASER_STALE_THRESHOLD_S}+ seconds. Check connection.</span>
          <button
            onClick={() => setLaserDismissed(true)}
            className="ml-2 p-1 rounded hover:bg-red-700/80 transition-colors flex-shrink-0"
            title="Dismiss (will reappear if it freezes again)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {showGps && (
        <div className="pointer-events-auto bg-amber-600/95 text-white px-4 py-2 flex items-center justify-center gap-3 text-sm font-semibold shadow-lg animate-pulse">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <Satellite className="w-4 h-4 flex-shrink-0" />
          <span>GPS FROZEN — no position update for {GPS_STALE_THRESHOLD_S}+ seconds. POIs are stacking at the same location!</span>
          <button
            onClick={() => setGpsDismissed(true)}
            className="ml-2 p-1 rounded hover:bg-amber-700/80 transition-colors flex-shrink-0"
            title="Dismiss (will reappear if it freezes again)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
