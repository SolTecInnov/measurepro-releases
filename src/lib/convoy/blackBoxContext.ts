import { useGPSStore } from '../stores/gpsStore';
import { useConvoyStore } from '../stores/convoyStore';
import type { GPSSnapshot, ConvoyStateSnapshot, DeviceMetadata } from '@shared/schema';

/**
 * Captures comprehensive black box context for forensic logging
 * Gathers GPS data, convoy state, and device information
 * Falls back gracefully when sensors are offline
 */
export function captureBlackBoxContext(): {
  gpsSnapshot: GPSSnapshot | null;
  convoyState: ConvoyStateSnapshot | null;
  deviceMetadata: DeviceMetadata;
} {
  // Capture GPS data
  let gpsSnapshot: GPSSnapshot | null = null;
  try {
    const gpsState = useGPSStore.getState();
    if (gpsState.data && gpsState.data.source !== 'none') {
      gpsSnapshot = {
        latitude: gpsState.data.latitude || 0,
        longitude: gpsState.data.longitude || 0,
        altitude: gpsState.data.altitude || 0,
        speed: gpsState.data.speed || 0,
        course: gpsState.data.course || 0,
        fixQuality: gpsState.data.fixQuality || 'No Fix',
        satellites: gpsState.data.satellites || 0,
        hdop: gpsState.data.hdop || 0,
        source: gpsState.data.source || 'none',
        timestamp: gpsState.data.lastUpdate || Date.now(),
      };
    }
  } catch (error) {
  }

  // Capture convoy state
  let convoyState: ConvoyStateSnapshot | null = null;
  try {
    const convoy = useConvoyStore.getState();
    if (convoy.currentSession) {
      const connectedMembers = convoy.members.filter(m => m.isConnected).length;
      convoyState = {
        totalMembers: convoy.members.length,
        connectedMembers,
        warningThreshold: convoy.currentSession.warningThreshold || 0,
        criticalThreshold: convoy.currentSession.criticalThreshold || 0,
        groundReference: convoy.currentSession.groundReference || 0,
        sessionStatus: convoy.currentSession.status,
      };
    }
  } catch (error) {
  }

  // Capture device metadata
  const deviceMetadata: DeviceMetadata = {
    userAgent: navigator.userAgent || 'Unknown',
    platform: navigator.platform || 'Unknown',
    screenWidth: window.screen.width || 0,
    screenHeight: window.screen.height || 0,
    networkType: (navigator as any).connection?.effectiveType || 'unknown',
    online: navigator.onLine,
  };

  return {
    gpsSnapshot,
    convoyState,
    deviceMetadata,
  };
}

/**
 * Gets current session ID from convoy store
 * Falls back to 'no-session' if not in a convoy
 */
export function getCurrentSessionId(): string {
  try {
    const convoy = useConvoyStore.getState();
    return convoy.currentSession?.id || 'no-session';
  } catch {
    return 'no-session';
  }
}

/**
 * Gets current convoy role (leader or follower)
 */
export function getCurrentConvoyRole(): 'leader' | 'follower' {
  try {
    const convoy = useConvoyStore.getState();
    return convoy.isLeader ? 'leader' : 'follower';
  } catch {
    return 'follower';
  }
}
