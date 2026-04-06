/**
 * Unified GNSS Data Hook
 * Provides real-time GNSS data from either:
 * 1. Local Duro bridge (via HTTP polling + GPS store)
 * 2. Cloud server WebSocket
 * 
 * Automatically selects source based on configured backend URL
 */

import { useState, useEffect } from 'react';
import { useGPSStore, type GPSData } from '@/lib/stores/gpsStore';
import { useGnssWebSocket } from './useGnssWebSocket';
import type { GnssSample, AttitudeData } from '../../server/gnss/types';

const BACKEND_URL_KEY = 'measurepro_gnss_backend_url';

interface UseGnssDataReturn {
  latestSample: GnssSample | null;
  isConnected: boolean;
  error: string | null;
  source: 'local-bridge' | 'websocket' | 'none';
  hasImu: boolean;
  fixQuality: 'rtk_fixed' | 'rtk_float' | 'dgps' | 'gps' | 'none';
  dataSource: 'duro' | 'usb' | 'browser' | null;
  diagnosticSats: number | null;
  diagnosticHdop: number | null;
}

function convertGpsStoreToGnssSample(gpsData: GPSData): GnssSample | null {
  // Only create sample if we have valid position data
  if (!gpsData || gpsData.latitude === 0 || gpsData.longitude === 0) {
    return null;
  }

  const sample: GnssSample = {
    timestamp: new Date(gpsData.lastUpdate).toISOString(),
    latitude: gpsData.latitude,
    longitude: gpsData.longitude,
    altitude: gpsData.altitude || null,
    speed: gpsData.speed || null,
    heading: gpsData.heading ?? gpsData.course ?? null,
    quality: gpsData.fixQuality === 'RTK Fixed' ? 'rtk_fixed' :
             gpsData.fixQuality === 'RTK Float' ? 'rtk_float' :
             gpsData.fixQuality === 'DGPS Fix' ? 'dgps' : 
             (gpsData.fixQuality === 'GPS Fix' || gpsData.fixQuality === 'GPS Fix (2D)') ? 'gps' : 'none',
    hdop: gpsData.hdop || null,
    num_sats: gpsData.satellites || null,
    source: gpsData.source === 'duro' ? 'duro' : gpsData.source === 'browser' ? 'browser' : 'usb',
    surveyId: '',
    sessionId: '',
  };

  // Add attitude data if available from IMU
  if (gpsData.imu) {
    const attitude: AttitudeData = {
      roll: gpsData.imu.roll ?? 0,
      pitch: gpsData.imu.pitch ?? 0,
      yaw: gpsData.imu.heading ?? 0,
    };
    sample.attitude = attitude;
  }

  return sample;
}

export function useGnssData(): UseGnssDataReturn {
  const [localSample, setLocalSample] = useState<GnssSample | null>(null);
  
  // GPS store (for local bridge mode)
  const gpsData = useGPSStore((s) => s.data);
  const gpsConnected = useGPSStore((s) => s.connected);
  
  // WebSocket (for cloud server mode)
  const { latestSample: wsSample, isConnected: wsConnected, error: wsError } = useGnssWebSocket();

  // Check if backend URL is configured - this determines if we use local bridge mode
  const hasBackendUrl = (() => {
    try {
      return !!localStorage.getItem(BACKEND_URL_KEY);
    } catch {
      return false;
    }
  })();

  // Also treat the GPS store as a valid local source when the store has active 'duro' data —
  // this covers training simulation mode where no backend URL is configured but the
  // gnssSimulator is injecting data directly into gpsStore.
  const hasDuroStoreData =
    gpsConnected &&
    gpsData.source === 'duro' &&
    gpsData.lastUpdate > 0 &&
    Date.now() - gpsData.lastUpdate < 5000;

  // Determine source mode: if backend URL is configured, always use local-bridge mode so the
  // service can start polling immediately on fresh page loads without waiting for the first
  // successful updateData() to flip gpsConnected. hasDuroStoreData covers simulation mode
  // where no backend URL is set but data is being injected directly into gpsStore.
  const source: 'local-bridge' | 'websocket' | 'none' = 
    (hasBackendUrl || hasDuroStoreData) ? 'local-bridge' : 
    wsConnected ? 'websocket' : 'none';

  const isLocalBridge = source === 'local-bridge';

  // Convert GPS store data to GNSS sample format when using local bridge
  useEffect(() => {
    if (isLocalBridge) {
      const sample = convertGpsStoreToGnssSample(gpsData);
      setLocalSample(sample);
    }
  }, [isLocalBridge, gpsData]);

  // Get fix quality - works even without valid position data
  const getFixQuality = (): 'rtk_fixed' | 'rtk_float' | 'dgps' | 'gps' | 'none' => {
    if (isLocalBridge) {
      // Read directly from GPS store - works even when no position
      if (gpsData.fixQuality === 'RTK Fixed') return 'rtk_fixed';
      if (gpsData.fixQuality === 'RTK Float') return 'rtk_float';
      if (gpsData.fixQuality === 'DGPS Fix') return 'dgps';
      if (gpsData.fixQuality === 'GPS Fix' || gpsData.fixQuality === 'GPS Fix (2D)') return 'gps';
      return 'none';
    }
    if (wsSample && wsSample.quality) {
      // Map to our supported types
      const q = wsSample.quality;
      if (q === 'rtk_fixed' || q === 'rtk_float' || q === 'dgps' || q === 'gps' || q === 'none') {
        return q;
      }
      // Map other types to closest equivalent
      return 'none';
    }
    return 'none';
  };
  
  // Get data source - works even without valid position data
  const getDataSource = (): 'duro' | 'usb' | 'browser' | null => {
    if (isLocalBridge) {
      // Read directly from GPS store - if source is 'duro', return it
      if (gpsData.source === 'duro') return 'duro';
      if (gpsData.source === 'browser') return 'browser';
      if (gpsData.source === 'serial') return 'usb';
      // If we're in local-bridge mode but no data yet, still show 'duro' as expected source
      return 'duro';
    }
    return wsSample?.source ?? null;
  };
  
  // Diagnostic values from GPS store — available even before a position fix
  const diagnosticSats = isLocalBridge
    ? (gpsData.satellitesInView ?? gpsData.satellites ?? null)
    : null;
  const diagnosticHdop = isLocalBridge
    ? (gpsData.hdop ?? null)
    : null;

  return {
    latestSample: isLocalBridge ? localSample : wsSample,
    isConnected: isLocalBridge ? gpsConnected : wsConnected,
    error: isLocalBridge ? null : wsError,
    source,
    hasImu: isLocalBridge && !!gpsData.imu,
    fixQuality: getFixQuality(),
    dataSource: getDataSource(),
    diagnosticSats,
    diagnosticHdop,
  };
}
