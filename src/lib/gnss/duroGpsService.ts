/**
 * Duro GPS Service
 * Fetches position data from the Duro local bridge and feeds it into the GPS store
 */

import { useGPSStore } from '@/lib/stores/gpsStore';
import { auditLog } from '@/lib/auditLog';
import { getCurrentUser } from '@/lib/firebase';
import { toast } from 'sonner';

const BACKEND_URL_KEY = 'measurepro_gnss_backend_url';
const POLL_INTERVAL = 500; // 500ms polling interval

interface DuroPosition {
  timestamp: number;
  lat: number;
  lon: number;
  altitude: number;
  fixQuality: number;
  satellites: number;
  hdop?: number;
  raw: string;
}

interface DuroImu {
  timestamp: number;
  heading: number | null;
  roll: number | null;
  pitch: number | null;
  heaveRate: number | null;
  rollAccuracy?: number | null;
  pitchAccuracy?: number | null;
  headingAccuracy?: number | null;
  variant?: string;
}

interface DuroVelocity {
  timestamp: number;
  speedKnots: number | null;
  speedMps: number | null;
  speedKph: number | null;
  heading: number | null;
}

interface DuroDop {
  pdop: number | null;
  hdop: number | null;
  vdop: number | null;
  activePrns: number[];
  gsaMode: number | null;
  constellations: Record<string, { name: string; activePrns: number[] }>;
}

interface DuroSatellitesInView {
  count: number;
  satellites: Array<{
    prn: number;
    elevation: number | undefined;
    azimuth: number | undefined;
    snr: number | undefined;
  }>;
}

interface DuroLiveData {
  success: boolean;
  connection: {
    connected: boolean;
    host: string;
    port: number;
    uptimeSec: number;
    totalSamples: number;
  };
  position: DuroPosition | null;
  dop: DuroDop | null;
  satellitesInView: DuroSatellitesInView | null;
  imu: DuroImu | null;
  velocity: DuroVelocity | null;
  sentences: {
    bufferSize: number;
    counts: Record<string, number>;
    recent: Array<{ timestamp: number; raw: string; type: string }>;
  };
}

const BRIDGE_FAILURE_THRESHOLD = 3; // consecutive failures before warning

class DuroGpsService {
  private pollInterval: NodeJS.Timeout | null = null;
  private isRunning = false;
  private lastPositionTimestamp = 0;
  private wasConnected = false;
  private consecutiveFetchFailures = 0;
  private bridgeUnreachableToastShown = false;
  private _bridgeUnreachable = false;
  private _unreachableListeners: Array<(unreachable: boolean) => void> = [];

  private getBackendUrl(): string {
    try {
      return localStorage.getItem(BACKEND_URL_KEY) || '';
    } catch {
      return '';
    }
  }

  private buildApiUrl(path: string): string {
    const backendUrl = this.getBackendUrl();
    if (backendUrl) {
      const base = backendUrl.replace(/\/$/, '');
      return `${base}${path}`;
    }
    return path;
  }

  /**
   * Compute fix quality label combining GGA quality indicator (primary) and
   * GSA mode2 (secondary cross-check).
   *
   * GGA quality codes:
   *   0 = No fix, 1 = Autonomous GPS, 2 = DGPS, 3 = PPS, 4 = RTK Fixed,
   *   5 = RTK Float, 6 = Dead reckoning
   *
   * GSA mode2:
   *   1 = No fix, 2 = 2D fix, 3 = 3D fix
   *
   * Rules:
   *  - RTK Fixed / RTK Float are authoritative from GGA (codes 4/5) — GSA ignored.
   *  - DGPS is authoritative from GGA code 2/3.
   *  - For basic GPS (code 1, 6): if GSA says 2D fix, label as "GPS Fix (2D)".
   *  - If GGA says "No Fix" (code 0) but GSA says mode 2 or 3, report "No Fix"
   *    (GGA is the authority on fix acquisition).
   */
  private getFixQualityText(
    fix: number,
    gsaMode?: number | null
  ): 'No Fix' | 'GPS Fix' | 'GPS Fix (2D)' | 'DGPS Fix' | 'RTK Float' | 'RTK Fixed' {
    switch (fix) {
      case 0: return 'No Fix';
      case 1:
        // Autonomous GPS — refine with GSA mode if available
        if (gsaMode === 2) return 'GPS Fix (2D)';
        return 'GPS Fix';
      case 2: return 'DGPS Fix';
      case 3: return 'DGPS Fix'; // PPS
      case 4: return 'RTK Fixed';
      case 5: return 'RTK Float';
      case 6:
        // Dead reckoning — refine with GSA mode if available
        if (gsaMode === 2) return 'GPS Fix (2D)';
        return 'GPS Fix';
      default: return 'No Fix';
    }
  }

  async fetchAndUpdate(): Promise<void> {
    try {
      const url = this.buildApiUrl('/api/gnss/live');
      const response = await fetch(url, { 
        signal: AbortSignal.timeout(2000) // 2 second timeout
      });
      
      if (!response.ok) {
        console.warn('[DuroGPS] Failed to fetch:', response.status);
        this.recordFetchFailure();
        return;
      }

      // Bridge responded with a successful HTTP status — it is reachable.
      this.recordFetchSuccess();

      const data: DuroLiveData = await response.json();
      
      if (!data.success || !data.connection.connected) {
        // Detect transition: connected → disconnected
        if (this.wasConnected) {
          this.wasConnected = false;
          try {
            const u = getCurrentUser();
            if (u) auditLog.hardwareConnect(u.uid, u.email || '', 'duro', 'Duro GNSS', false, 'network');
          } catch (_e) {}
        }
        // Not connected to Duro - update store to show disconnected
        useGPSStore.getState().setConnected(false);
        return;
      }

      // Detect transition: disconnected → connected
      if (!this.wasConnected) {
        this.wasConnected = true;
        try {
          const u = getCurrentUser();
          if (u) auditLog.hardwareConnect(u.uid, u.email || '', 'duro', 'Duro GNSS', true, 'network');
        } catch (_e) {}
      }

      // --- Diagnostics update: DOP (GSA) and satellites in view (GSV) ---
      // These are updated unconditionally on every poll so diagnostics reflect
      // the latest NMEA sentences regardless of whether position has advanced.
      const diagnosticsUpdate: Partial<import('@/lib/stores/gpsStore').GPSData> = {};
      if (data.dop) {
        diagnosticsUpdate.pdop = data.dop.pdop;
        diagnosticsUpdate.vdop = data.dop.vdop;
        diagnosticsUpdate.activeSatellitePrns = data.dop.activePrns;
        diagnosticsUpdate.gsaMode = data.dop.gsaMode;
        diagnosticsUpdate.constellations = data.dop.constellations;
        if (data.dop.hdop != null) {
          diagnosticsUpdate.hdop = data.dop.hdop;
        }
      }
      if (data.satellitesInView) {
        diagnosticsUpdate.satellitesInView = data.satellitesInView.count;
        diagnosticsUpdate.satelliteList = data.satellitesInView.satellites;
      }
      if (Object.keys(diagnosticsUpdate).length > 0) {
        useGPSStore.getState().updateData(diagnosticsUpdate);
      }

      // Bridge is connected to Duro - update connection status and source
      // even if we don't have position data yet (allows UI to show "Connected" + "No Fix")
      if (!data.position) {
        // Connected to Duro but no GPS fix yet
        useGPSStore.getState().updateData({
          source: 'duro',
          fixQuality: 'No Fix',
          latitude: 0,
          longitude: 0,
          lastUpdate: Date.now()
        });
        return;
      }

      // --- Position update: only when a new GGA fix has arrived ---
      if (data.position.timestamp > this.lastPositionTimestamp) {
        this.lastPositionTimestamp = data.position.timestamp;
        
        // Format time from timestamp
        const date = new Date(data.position.timestamp);
        const timeStr = date.toLocaleTimeString('en-US', { hour12: false });

        // Build update object with position data
        const updateObj: Partial<import('@/lib/stores/gpsStore').GPSData> = {
          time: timeStr,
          latitude: data.position.lat,
          longitude: data.position.lon,
          altitude: data.position.altitude,
          satellites: data.position.satellites,
          hdop: data.dop?.hdop ?? data.position.hdop ?? 0,
          fixQuality: this.getFixQualityText(data.position.fixQuality, data.dop?.gsaMode),
          source: 'duro',
          lastUpdate: data.position.timestamp
        };

        // Add IMU data if available
        if (data.imu) {
          updateObj.imu = {
            heading: data.imu.heading,
            roll: data.imu.roll,
            pitch: data.imu.pitch,
            heaveRate: data.imu.heaveRate,
            rollAccuracy: data.imu.rollAccuracy,
            pitchAccuracy: data.imu.pitchAccuracy,
            headingAccuracy: data.imu.headingAccuracy
          };
        }

        // Add velocity data if available
        if (data.velocity) {
          updateObj.speed = data.velocity.speedMps ?? 0;
          updateObj.speedKph = data.velocity.speedKph ?? undefined;
          updateObj.heading = data.velocity.heading ?? undefined;
          updateObj.course = data.velocity.heading ?? 0;
        }

        // Update GPS store with position + fix quality data
        useGPSStore.getState().updateData(updateObj);

        // Add raw NMEA sentences directly to rawNMEA buffer without re-parsing
        // (data is already fully applied via updateData above; re-running through
        //  addNMEASentence/parseNMEA would pollute lastSerialDataTime and override source)
        const rawSentences: string[] = [];
        if (data.position.raw) {
          rawSentences.push(data.position.raw);
        }
        if (data.sentences?.recent) {
          for (const sentence of data.sentences.recent.slice(-5)) {
            if (sentence.raw) rawSentences.push(sentence.raw);
          }
        }
        if (rawSentences.length > 0) {
          useGPSStore.setState((state) => ({
            data: {
              ...state.data,
              rawNMEA: [...state.data.rawNMEA.slice(-(20 - rawSentences.length)), ...rawSentences]
            }
          }));
        }
      }
    } catch (error: unknown) {
      // Silently fail - probably no backend URL configured or bridge not running
      const errName = error instanceof Error ? error.name : '';
      const errMsg = error instanceof Error ? error.message : String(error);
      if (errName !== 'TimeoutError' && errName !== 'AbortError') {
        console.warn('[DuroGPS] Fetch error:', errMsg);
      }
      this.recordFetchFailure();
    }
  }

  private setBridgeUnreachable(unreachable: boolean): void {
    if (this._bridgeUnreachable === unreachable) return;
    this._bridgeUnreachable = unreachable;
    for (const cb of this._unreachableListeners) cb(unreachable);
  }

  /** Returns whether the bridge is currently considered unreachable (3+ consecutive failures). */
  get bridgeUnreachable(): boolean {
    return this._bridgeUnreachable;
  }

  /** Subscribe to bridge-unreachable status changes. Returns an unsubscribe function. */
  onBridgeUnreachableChange(cb: (unreachable: boolean) => void): () => void {
    this._unreachableListeners.push(cb);
    return () => {
      this._unreachableListeners = this._unreachableListeners.filter(fn => fn !== cb);
    };
  }

  private recordFetchFailure(): void {
    this.consecutiveFetchFailures++;
    if (this.consecutiveFetchFailures >= BRIDGE_FAILURE_THRESHOLD) {
      this.setBridgeUnreachable(true);
      if (!this.bridgeUnreachableToastShown) {
        this.bridgeUnreachableToastShown = true;
        toast.warning('Bridge unreachable — check Duro bridge is running', {
          id: 'duro-bridge-unreachable',
          duration: Infinity,
          action: {
            label: 'Retry',
            onClick: () => {
              this.consecutiveFetchFailures = 0;
              this.bridgeUnreachableToastShown = false;
              this.setBridgeUnreachable(false);
              this.fetchAndUpdate();
            },
          },
        });
      }
    }
  }

  private recordFetchSuccess(): void {
    if (this.consecutiveFetchFailures > 0) {
      this.consecutiveFetchFailures = 0;
      this.setBridgeUnreachable(false);
      if (this.bridgeUnreachableToastShown) {
        this.bridgeUnreachableToastShown = false;
        toast.dismiss('duro-bridge-unreachable');
      }
    }
  }

  start(electronConfig?: { host: string; port: number }): void {
    if (this.isRunning) return;

    // ── ELECTRON PATH: Direct TCP via IPC ──────────────────────────────────
    const electronAPI = (window as any).electronAPI;
    if (electronAPI?.duro && electronConfig) {
      console.log('[DuroGPS] Electron mode — connecting via IPC TCP to', electronConfig);
      this.isRunning = true;

      // Connect via Electron IPC (main.cjs opens TCP socket to Duro)
      electronAPI.duro.connect(electronConfig).catch((e: any) =>
        console.error('[DuroGPS] IPC connect error:', e)
      );

      // Listen for NMEA data streamed from main process
      electronAPI.duro.onData((parsed: any) => {
        this.handleElectronData(parsed);
      });

      // Listen for connection status
      electronAPI.duro.onStatus((status: any) => {
        if (status.connected) {
          if (!this.wasConnected) {
            this.wasConnected = true;
            useGPSStore.getState().updateData({ source: 'duro' });
            /* toast removed */
          }
        } else {
          if (this.wasConnected) {
            this.wasConnected = false;
            useGPSStore.getState().setConnected(false);
            if (status.error) toast.error('Duro GNSS disconnected', { description: status.error });
          }
        }
      });

      return; // Don't fall through to HTTP polling
    }

    // ── BROWSER/PWA PATH: HTTP polling via bridge ─────────────────────────────
    const backendUrl = this.getBackendUrl();
    if (!backendUrl) {
      console.log('[DuroGPS] No backend URL configured, not starting');
      return;
    }

    console.log('[DuroGPS] Browser mode — polling bridge:', backendUrl);
    this.isRunning = true;
    this.fetchAndUpdate();
    this.pollInterval = setInterval(() => this.fetchAndUpdate(), POLL_INTERVAL);
  }

  // Handle NMEA data from Electron IPC
  private handleElectronData(parsed: any): void {
    if (parsed.type === 'position' && parsed.lat && parsed.lon) {
      if (parsed.timestamp > this.lastPositionTimestamp) {
        this.lastPositionTimestamp = parsed.timestamp;
        const date = new Date(parsed.timestamp);
        const timeStr = date.toLocaleTimeString('en-US', { hour12: false });
        const fixText = this.getFixQualityText(parsed.fixQuality || 0);
        useGPSStore.getState().updateData({
          time: timeStr, latitude: parsed.lat, longitude: parsed.lon,
          altitude: parsed.altitude || 0, satellites: parsed.satellites || 0,
          hdop: parsed.hdop || 0, fixQuality: fixText, source: 'duro',
          lastUpdate: parsed.timestamp, connected: true
        });
      }
    } else if (parsed.type === 'velocity') {
      useGPSStore.getState().updateData({
        speed: parsed.speedMps || 0,
        course: parsed.heading || 0
      });
    } else if (parsed.type === 'imu') {
      useGPSStore.getState().updateData({
        imu: {
          heading: parsed.heading, roll: parsed.roll, pitch: parsed.pitch,
          heaveRate: parsed.heaveRate, rollAccuracy: null, pitchAccuracy: null, headingAccuracy: null
        }
      });
    } else if (parsed.type === 'dop') {
      useGPSStore.getState().updateData({
        pdop: parsed.pdop, hdop: parsed.hdop || 0, vdop: parsed.vdop, gsaMode: parsed.mode
      });
    }
  }

  stop(): void {
    // Electron path
    const electronAPI = (window as any).electronAPI;
    if (electronAPI?.duro) {
      electronAPI.duro.disconnect().catch(() => {});
      electronAPI.duro.removeListeners();
    }
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    this.isRunning = false;
    this.wasConnected = false;
    this.lastPositionTimestamp = 0;
    console.log('[DuroGPS] Stopped');
  }

  isActive(): boolean {
    return this.isRunning;
  }
}

// Singleton instance
export const duroGpsService = new DuroGpsService();

// React hook for using Duro GPS
export function useDuroGps() {
  return {
    start: () => duroGpsService.start(),
    stop: () => duroGpsService.stop(),
    isActive: () => duroGpsService.isActive()
  };
}
