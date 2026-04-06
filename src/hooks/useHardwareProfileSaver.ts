/**
 * useHardwareProfileSaver
 *
 * Watches the serial store for confirmed streaming (at least one real data packet
 * from laser and/or GPS). Once streaming is confirmed, saves the hardware profile
 * to localStorage keyed by user ID.
 *
 * Called once per session — tracks saving status so it doesn't save repeatedly.
 */

import { useEffect, useRef } from 'react';
import { useSerialStore } from '@/lib/stores/serialStore';
import { useAuth } from '@/lib/auth/AuthContext';
import {
  saveHardwareProfile,
  getPortFingerprint,
  getDuroUrl,
  HardwareProfile,
} from '@/lib/hardwareProfileService';
import { duroGpsService } from '@/lib/gnss/duroGpsService';

const SESSION_SAVED_FLAG = 'hw_profile_saved_this_session';

export function useHardwareProfileSaver() {
  const { user } = useAuth();
  const laserPort = useSerialStore((s) => s.laserPort);
  const gpsPort = useSerialStore((s) => s.gpsPort);
  const lastMeasurement = useSerialStore((s) => s.lastMeasurement);
  const laserType = useSerialStore((s) => s.laserType);
  const laserConfig = useSerialStore((s) => s.laserConfig);
  const savedRef = useRef(false);

  useEffect(() => {
    if (!user) return;
    if (savedRef.current) return;
    if (sessionStorage.getItem(SESSION_SAVED_FLAG)) return;

    const hasLaserData = lastMeasurement && lastMeasurement !== '--';
    const hasLaserPort = laserPort !== null;

    if (!hasLaserPort || !hasLaserData) return;

    (async () => {
      try {
        const allPorts = await navigator.serial.getPorts();

        const laserFp = laserPort ? getPortFingerprint(laserPort, allPorts) : null;
        const gpsFp = gpsPort ? getPortFingerprint(gpsPort, allPorts) : null;

        const duroUrl = duroGpsService.isActive() ? getDuroUrl() : null;

        const profile: HardwareProfile = {
          laserFingerprint: laserFp,
          gpsFingerprint: gpsFp,
          laserType,
          laserBaudRate: laserConfig.baudRate,
          duroUrl: duroUrl || null,
          savedAt: Date.now(),
        };

        saveHardwareProfile(user.uid, profile);
        sessionStorage.setItem(SESSION_SAVED_FLAG, '1');
        savedRef.current = true;
        console.log('[HWProfile] Profile saved after confirmed streaming', profile);
      } catch (e) {
        console.warn('[HWProfile] Failed to save profile after streaming confirmed:', e);
      }
    })();
  }, [user, laserPort, gpsPort, lastMeasurement, laserType, laserConfig]);
}
