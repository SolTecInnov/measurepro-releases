/**
 * useHardwareAutoReconnect
 *
 * A hook that:
 * 1. Waits for auth to be confirmed (user object available) AND serial store initialized.
 * 2. Calls navigator.serial.getPorts() and compares against the saved hardware profile.
 * 3. Returns the reconnect status so the UI can show the appropriate prompt or silently connect.
 *
 * Fires once per user ID per page load, and again whenever the page returns to the foreground
 * (visibilitychange), subject to a 30-second cooldown to avoid rapid re-triggers.
 *
 * Hardware connection persistence across navigation:
 * - Serial port readers and the Duro GPS service are owned by `useSerialStore` and
 *   `duroGpsService` — app-level singletons that outlive any individual page/view.
 * - Navigating away from the survey view does NOT tear down connections.
 * - On return (visibilitychange → visible), the hook fires again. If the port reader is
 *   still alive (port.readable.locked === true), no action is taken — the session is intact.
 * - If the reader died while the user was away, a silent reconnect is attempted automatically.
 */

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth/AuthContext';
import { useSerialStore } from '@/lib/stores/serialStore';
import { checkAutoReconnect, loadHardwareProfile, getDuroUrl, AutoReconnectResult } from '@/lib/hardwareProfileService';
import { duroGpsService } from '@/lib/gnss/duroGpsService';

const RECONNECT_COOLDOWN_MS = 30_000;

export type ReconnectPhase =
  | 'idle'
  | 'checking'
  | 'reconnecting'
  | 'prompt-no-devices'
  | 'prompt-config-changed'
  | 'prompt-keep-previous'
  | 'gnd-ref-check'
  | 'done';

export interface AutoReconnectState {
  phase: ReconnectPhase;
  checkResult: AutoReconnectResult | null;
  dismiss: () => void;
  keepPrevious: () => void;
  startFresh: () => void;
  confirmKeepPrevious: (duroUrl: string) => void;
  confirmGndRef: () => void;
}

export function useHardwareAutoReconnect(): AutoReconnectState {
  const { user, isLoading } = useAuth();
  const [phase, setPhase] = useState<ReconnectPhase>('idle');
  const [checkResult, setCheckResult] = useState<AutoReconnectResult | null>(null);
  const lastRunUserId = useRef<string | null>(null);
  const lastRunTimestamp = useRef<number>(0);
  const isRunning = useRef(false);

  const runCheck = (currentUser: typeof user) => {
    if (!currentUser) return;
    if (isRunning.current) {
      console.log('[AutoReconnect] Check already in progress, skipping');
      return;
    }

    const now = Date.now();
    const sinceLastRun = now - lastRunTimestamp.current;
    if (lastRunUserId.current === currentUser.uid && sinceLastRun < RECONNECT_COOLDOWN_MS) {
      console.log(`[AutoReconnect] Skipping — cooldown active (${Math.round(sinceLastRun / 1000)}s < 30s)`);
      return;
    }

    // --- Always start Duro GPS first, regardless of Web Serial availability ---
    // A saved duroUrl in the profile (or localStorage) should always be honoured.
    const savedProfile = loadHardwareProfile(currentUser.uid);
    const duroUrlToStart = savedProfile?.duroUrl || getDuroUrl();
    if (duroUrlToStart) {
      console.log('[AutoReconnect] Starting Duro GPS service early (before Web Serial check):', duroUrlToStart);
      startDuroSilently(duroUrlToStart);
    }

    if (!('serial' in navigator)) {
      console.log('[AutoReconnect] Web Serial API not available — Duro-only mode');
      lastRunUserId.current = currentUser.uid;
      lastRunTimestamp.current = now;
      setPhase('done');
      return;
    }

    console.log('[AutoReconnect] Starting check for user:', currentUser.uid);
    lastRunUserId.current = currentUser.uid;
    lastRunTimestamp.current = now;
    isRunning.current = true;
    setPhase('checking');

    checkAutoReconnect(currentUser.uid).then((result) => {
      console.log('[AutoReconnect] Check result:', result.status);
      setCheckResult(result);

      if (result.status === 'match') {
        console.log('[AutoReconnect] Match found — auto-connecting laser and GPS');
        setPhase('reconnecting');
        performAutoConnect(result.laserPort, result.gpsPort, result.profile, result.profile.duroUrl || getDuroUrl())
          .then(({ laserConnected, gpsConnected }) => {
            if (laserConnected && gpsConnected) {
              toast.success('Hardware reconnected — Laser + GPS ready');
            } else if (laserConnected) {
              toast.success('Hardware reconnected — Laser ready');
            } else {
              console.log('[AutoReconnect] No devices actually connected after match');
            }
          })
          .finally(() => {
            console.log('[AutoReconnect] Reconnect attempt complete — checking GND REF');
            isRunning.current = false;
            setPhase('gnd-ref-check');
          });
      } else if (result.status === 'duro-only') {
        console.log('[AutoReconnect] Duro-only — connecting silently');
        startDuroSilently(result.duroUrl)
          .then(() => {
            toast.success('Hardware reconnected — GPS ready');
          })
          .finally(() => {
            console.log('[AutoReconnect] Duro-only connect complete — checking GND REF');
            isRunning.current = false;
            setPhase('gnd-ref-check');
          });
      } else if (result.status === 'no-devices') {
        const profile = loadHardwareProfile(currentUser.uid);
        // Even with no serial devices, if there's a Duro URL, it was already started above.
        if (!profile) {
          console.log('[AutoReconnect] No devices and no saved profile — suppressing modal');
          isRunning.current = false;
          setPhase('done');
        } else {
          // If only duroUrl was saved and Duro was started, skip the prompt
          if (duroUrlToStart && !profile.laserFingerprint && !profile.gpsFingerprint) {
            console.log('[AutoReconnect] No serial devices but Duro already started — skipping modal');
            isRunning.current = false;
            setPhase('gnd-ref-check');
          } else {
            console.log('[AutoReconnect] No devices found but profile exists — showing prompt');
            isRunning.current = false;
            setPhase('prompt-no-devices');
          }
        }
      } else if (result.status === 'config-changed' || result.status === 'partial-match') {
        const profile = loadHardwareProfile(currentUser.uid);
        if (profile) {
          console.log('[AutoReconnect] Config changed/partial — showing prompt');
          isRunning.current = false;
          setPhase('prompt-config-changed');
        } else {
          console.log('[AutoReconnect] Config changed but no profile — skipping');
          isRunning.current = false;
          setPhase('done');
        }
      }
    }).catch((err) => {
      console.warn('[AutoReconnect] checkAutoReconnect failed:', err);
      isRunning.current = false;
      setPhase('done');
    });
  };

  useEffect(() => {
    if (!isLoading && !user) {
      lastRunUserId.current = null;
      lastRunTimestamp.current = 0;
    }
  }, [isLoading, user]);

  useEffect(() => {
    if (isLoading) return;
    if (!user) return;
    runCheck(user);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, user]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return;
      if (isLoading || !user) return;
      console.log('[AutoReconnect] Page became visible — resetting userId guard and checking');
      lastRunUserId.current = null;
      runCheck(user);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, user]);

  const dismiss = () => {
    setPhase('done');
  };

  const keepPrevious = () => {
    setPhase('prompt-keep-previous');
  };

  const startFresh = () => {
    setPhase('done');
  };

  const confirmGndRef = () => {
    setPhase('done');
  };

  const confirmKeepPrevious = (duroUrl: string) => {
    if (!user || !checkResult) return;
    const profile = loadHardwareProfile(user.uid);
    if (!profile) {
      dismiss();
      return;
    }

    const laserPort =
      checkResult.status === 'match' || checkResult.status === 'partial-match'
        ? checkResult.laserPort
        : null;
    const gpsPort =
      checkResult.status === 'match' || checkResult.status === 'partial-match'
        ? checkResult.gpsPort
        : null;

    if (!laserPort) {
      dismiss();
      return;
    }

    setPhase('reconnecting');
    performAutoConnect(laserPort, gpsPort, profile, duroUrl)
      .then(({ laserConnected, gpsConnected }) => {
        if (laserConnected && gpsConnected) {
          toast.success('Hardware reconnected — Laser + GPS ready');
        } else if (laserConnected) {
          toast.success('Hardware reconnected — Laser ready');
        }
      })
      .finally(() => {
        setPhase('gnd-ref-check');
      });
  };

  return { phase, checkResult, dismiss, keepPrevious, startFresh, confirmKeepPrevious, confirmGndRef };
}

async function startDuroSilently(duroUrl: string): Promise<void> {
  try {
    localStorage.setItem('measurepro_gnss_backend_url', duroUrl);
    if (duroGpsService.isActive()) duroGpsService.stop();

    // Electron: use direct TCP connection with saved config
    if ((window as any).electronAPI?.duro) {
      let host = '192.168.0.222', port = 2101;
      try {
        const gnssConfig = JSON.parse(localStorage.getItem('gnss_config') || '{}');
        if (gnssConfig.host) host = gnssConfig.host;
        if (gnssConfig.nmeaPort) port = gnssConfig.nmeaPort;
      } catch(e) {}
      duroGpsService.start({ host, port });
      console.log('[AutoReconnect] Duro started via Electron TCP:', host + ':' + port);
    } else {
      // Browser: use HTTP bridge
      duroGpsService.start();
      console.log('[AutoReconnect] Duro started via bridge:', duroUrl);
    }
  } catch (e) {
    console.warn('[AutoReconnect] Failed to start Duro silently:', e);
  }
}

async function performAutoConnect(
  laserPort: SerialPort,
  gpsPort: SerialPort | null,
  profile: { laserType: import('@/lib/serial').LaserType; laserBaudRate: number; duroUrl: string | null },
  duroUrl: string
): Promise<{ laserConnected: boolean; gpsConnected: boolean }> {
  const { connectToLaser, connectToGPS, setLaserType } = useSerialStore.getState();

  let laserConnected = false;
  let gpsConnected = false;

  // Use port.readable?.locked to distinguish two scenarios:
  //   - Page load:        port.readable is non-null but NOT locked (no reader running) → must connect
  //   - Visibility change: port.readable is non-null AND locked (reader alive)          → skip, reader OK
  // Never use "port.readable !== null" alone — that skips the reader setup on page load.

  const laserLocked = laserPort.readable?.locked ?? false;
  if (laserLocked) {
    console.log('[AutoReconnect] Laser stream already has an active reader, skipping connectToLaser');
    laserConnected = true;
  } else {
    try {
      console.log('[AutoReconnect] Connecting laser...');
      setLaserType(profile.laserType);
      await connectToLaser(laserPort);
      laserConnected = true;
      console.log('[AutoReconnect] Laser connected successfully');
    } catch (e) {
      console.warn('[AutoReconnect] Failed to connect laser:', e);
    }
  }

  if (gpsPort) {
    const gpsLocked = gpsPort.readable?.locked ?? false;
    if (gpsLocked) {
      console.log('[AutoReconnect] GPS stream already has an active reader, skipping connectToGPS');
      gpsConnected = true;
    } else {
      try {
        console.log('[AutoReconnect] Connecting GPS...');
        await connectToGPS(gpsPort);
        gpsConnected = true;
        console.log('[AutoReconnect] GPS connected successfully');
      } catch (e) {
        console.warn('[AutoReconnect] Failed to connect GPS:', e);
      }
    }
  }

  if (duroUrl) {
    try {
      localStorage.setItem('measurepro_gnss_backend_url', duroUrl);
      // Always stop-then-start: guarantees a fresh connection even if the service
      // was already running with a stale/incorrect URL from a prior session.
      if (duroGpsService.isActive()) {
        duroGpsService.stop();
      }
      duroGpsService.start();
      console.log('[AutoReconnect] Duro GPS service (re)started with URL:', duroUrl);
    } catch (e) {
      console.warn('[AutoReconnect] Failed to start Duro GPS service:', e);
    }
  }

  return { laserConnected, gpsConnected };
}
