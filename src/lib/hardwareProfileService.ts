/**
 * Hardware Profile Service
 *
 * Saves and loads a hardware profile per user ID in localStorage.
 * The profile stores USB VID/PID + port position index for laser and GPS,
 * plus laser type, baud rate, and Duro bridge URL.
 *
 * Fingerprint matching uses VID/PID as the primary key; portIndex is used
 * only as a tiebreaker when two ports share the same VID and PID.
 */

import { LaserType } from './serial';

const PROFILE_KEY_PREFIX = 'hw_profile_v1_';
const DURO_URL_KEY = 'measurepro_gnss_backend_url';

export interface PortFingerprint {
  usbVendorId: number | undefined;
  usbProductId: number | undefined;
  portIndex: number;
}

export interface HardwareProfile {
  laserFingerprint: PortFingerprint | null;
  gpsFingerprint: PortFingerprint | null;
  laserType: LaserType;
  laserBaudRate: number;
  duroUrl: string | null;
  savedAt: number;
}

export function getPortFingerprint(port: SerialPort, allPorts: SerialPort[]): PortFingerprint {
  const info = port.getInfo();
  const portIndex = allPorts.indexOf(port);
  return {
    usbVendorId: info.usbVendorId,
    usbProductId: info.usbProductId,
    portIndex: portIndex >= 0 ? portIndex : 0,
  };
}

function profileKey(userId: string): string {
  return `${PROFILE_KEY_PREFIX}${userId}`;
}

export function saveHardwareProfile(userId: string, profile: HardwareProfile): void {
  try {
    localStorage.setItem(profileKey(userId), JSON.stringify(profile));
  } catch (e) {
    console.warn('[HWProfile] Failed to save profile:', e);
  }
}

export function loadHardwareProfile(userId: string): HardwareProfile | null {
  try {
    const raw = localStorage.getItem(profileKey(userId));
    if (!raw) return null;
    return JSON.parse(raw) as HardwareProfile;
  } catch (e) {
    console.warn('[HWProfile] Failed to load profile:', e);
    return null;
  }
}

export function clearHardwareProfile(userId: string): void {
  try {
    localStorage.removeItem(profileKey(userId));
  } catch (e) {
    console.warn('[HWProfile] Failed to clear profile:', e);
  }
}

/**
 * Match fingerprints using VID/PID first.
 * portIndex is used only as a tiebreaker when both ports share identical VID and PID.
 */
function fingerprintsMatch(
  saved: PortFingerprint | null,
  current: PortFingerprint,
  currentFingerprints: PortFingerprint[]
): boolean {
  if (!saved) return false;

  const vidPidMatch =
    saved.usbVendorId === current.usbVendorId &&
    saved.usbProductId === current.usbProductId;

  if (!vidPidMatch) return false;

  const duplicates = currentFingerprints.filter(
    (f) => f.usbVendorId === current.usbVendorId && f.usbProductId === current.usbProductId
  );

  if (duplicates.length <= 1) {
    return true;
  }

  return saved.portIndex === current.portIndex;
}

export type AutoReconnectResult =
  | { status: 'no-devices' }
  | { status: 'duro-only'; duroUrl: string }
  | { status: 'config-changed'; grantedPorts: SerialPort[] }
  | { status: 'match'; laserPort: SerialPort; gpsPort: SerialPort | null; profile: HardwareProfile }
  | { status: 'partial-match'; laserPort: SerialPort | null; gpsPort: SerialPort | null; profile: HardwareProfile };

/**
 * Compare granted serial ports against a saved hardware profile.
 * Returns a status describing what the auto-reconnect flow should do.
 */
export async function checkAutoReconnect(
  userId: string
): Promise<AutoReconnectResult> {
  const profile = loadHardwareProfile(userId);

  let grantedPorts: SerialPort[] = [];
  try {
    grantedPorts = await navigator.serial.getPorts();
  } catch {
    grantedPorts = [];
  }

  if (grantedPorts.length === 0) {
    if (
      profile &&
      !profile.laserFingerprint &&
      !profile.gpsFingerprint &&
      profile.duroUrl
    ) {
      return { status: 'duro-only', duroUrl: profile.duroUrl };
    }
    return { status: 'no-devices' };
  }

  if (!profile) {
    return { status: 'config-changed', grantedPorts };
  }

  const currentFingerprints: PortFingerprint[] = grantedPorts.map((p, idx) => {
    const info = p.getInfo();
    return { usbVendorId: info.usbVendorId, usbProductId: info.usbProductId, portIndex: idx };
  });

  const findMatchingPort = (fp: PortFingerprint | null): SerialPort | null => {
    if (!fp) return null;
    const idx = currentFingerprints.findIndex((c) => fingerprintsMatch(fp, c, currentFingerprints));
    return idx >= 0 ? grantedPorts[idx] : null;
  };

  const laserPort = findMatchingPort(profile.laserFingerprint);
  const gpsPort = findMatchingPort(profile.gpsFingerprint);

  const laserMatches = profile.laserFingerprint ? laserPort !== null : true;
  const gpsMatches = profile.gpsFingerprint ? gpsPort !== null : true;

  if (laserMatches && gpsMatches && laserPort) {
    return { status: 'match', laserPort, gpsPort, profile };
  }

  if (laserPort || gpsPort) {
    return { status: 'partial-match', laserPort, gpsPort, profile };
  }

  return { status: 'config-changed', grantedPorts };
}

export function getDuroUrl(): string {
  try {
    return localStorage.getItem(DURO_URL_KEY) || '';
  } catch {
    return '';
  }
}

export function setDuroUrl(url: string): void {
  try {
    if (url) {
      localStorage.setItem(DURO_URL_KEY, url);
    } else {
      localStorage.removeItem(DURO_URL_KEY);
    }
  } catch (e) {
    console.warn('[HWProfile] Failed to set Duro URL:', e);
  }
}
