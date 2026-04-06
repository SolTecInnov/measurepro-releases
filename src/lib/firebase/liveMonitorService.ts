/**
 * Live Monitor Service
 * 
 * Handles real-time sharing of measurement data for remote monitoring.
 * Uses Firestore for data persistence with configurable polling intervals.
 * 
 * Performance considerations:
 * - Only syncs last 50 measurements to minimize data transfer
 * - Debounced updates (default 30 seconds) to avoid overwhelming Firebase
 * - Opt-in broadcasting to respect privacy and battery
 * - Background processing via requestIdleCallback when available
 */

import { getFirestore, collection, doc, setDoc, getDoc, getDocs, query, where, onSnapshot, Timestamp } from 'firebase/firestore';
import { getCurrentUser, isOnline } from '../firebase';
import type { Measurement } from '../survey/types';
import { logger } from '../utils/logger';

const COLLECTION_LIVE_FEEDS = 'liveMonitorFeeds';
const COLLECTION_USER_MAPPING = 'userEmailMapping';
const MAX_MEASUREMENTS_SYNC = 50;
const DEFAULT_DEBOUNCE_MS = 30000; // 30 seconds between updates
const HEARTBEAT_INTERVAL_MS = 60000; // 1 minute heartbeat

let currentDebounceMs = DEFAULT_DEBOUNCE_MS;

interface LiveFeedData {
  userId: string;
  email: string;
  displayName: string;
  activeSurveyId: string | null;
  activeSurveyTitle: string | null;
  lastSeen: Timestamp;
  isOnline: boolean;
  measurementCount: number;
  lastLocation: {
    latitude: number;
    longitude: number;
  } | null;
}

interface LiveMeasurement {
  id: string;
  rel: number | null;
  latitude: number;
  longitude: number;
  utcDate: string;
  utcTime: string;
  speed: number | null;
  heading: number | null;
  poi_type?: string;
  note: string | null;
  createdAt: string;
}

let db: ReturnType<typeof getFirestore> | null = null;
let broadcastEnabled = false;
let currentSurveyId: string | null = null;
let currentSurveyTitle: string | null = null;
let pendingMeasurements: Measurement[] = [];
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let unsubscribeRemote: (() => void) | null = null;

const initFirestore = (): boolean => {
  if (db) return true;
  
  try {
    const app = (window as any).__firebaseApp__;
    if (app) {
      db = getFirestore(app);
      return true;
    }
  } catch (error) {
    logger.error('[LiveMonitor] Failed to init Firestore:', error);
  }
  return false;
};

/**
 * Enable live broadcasting of measurements
 */
export const enableLiveBroadcast = async (surveyId: string, surveyTitle: string): Promise<boolean> => {
  if (!initFirestore() || !isOnline()) {
    logger.warn('[LiveMonitor] Cannot enable broadcast: Firestore not ready or offline');
    return false;
  }

  const user = getCurrentUser();
  if (!user?.email) {
    logger.warn('[LiveMonitor] Cannot enable broadcast: No authenticated user');
    return false;
  }

  broadcastEnabled = true;
  currentSurveyId = surveyId;
  currentSurveyTitle = surveyTitle;

  // Store email mapping for lookup
  try {
    await setDoc(doc(db!, COLLECTION_USER_MAPPING, user.uid), {
      email: user.email.toLowerCase(),
      displayName: user.displayName || user.email.split('@')[0],
      userId: user.uid,
      updatedAt: Timestamp.now()
    });
  } catch (error) {
    logger.error('[LiveMonitor] Failed to store email mapping:', error);
  }

  // Start heartbeat
  startHeartbeat();
  
  // Initial broadcast
  await broadcastHeartbeat();

  logger.log(`[LiveMonitor] Live broadcast enabled for survey: ${surveyTitle}`);
  return true;
};

/**
 * Disable live broadcasting
 */
export const disableLiveBroadcast = async (): Promise<void> => {
  broadcastEnabled = false;
  currentSurveyId = null;
  currentSurveyTitle = null;
  pendingMeasurements = [];

  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }

  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }

  // Mark as offline in feed
  const user = getCurrentUser();
  if (user && db) {
    try {
      await setDoc(doc(db, COLLECTION_LIVE_FEEDS, user.uid), {
        userId: user.uid,
        email: user.email || '',
        displayName: user.displayName || '',
        activeSurveyId: null,
        activeSurveyTitle: null,
        lastSeen: Timestamp.now(),
        isOnline: false,
        measurementCount: 0,
        lastLocation: null
      }, { merge: true });
    } catch (error) {
      logger.error('[LiveMonitor] Failed to update offline status:', error);
    }
  }

  logger.log('[LiveMonitor] Live broadcast disabled');
};

/**
 * Queue measurements for broadcasting (debounced)
 */
export const queueMeasurementsForBroadcast = (measurements: Measurement[]): void => {
  if (!broadcastEnabled) return;

  // Keep only the latest MAX_MEASUREMENTS_SYNC
  pendingMeasurements = measurements.slice(0, MAX_MEASUREMENTS_SYNC);

  // Debounce the actual broadcast
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }

  // Use requestIdleCallback if available for non-blocking operation
  const scheduleUpload = () => {
    if ('requestIdleCallback' in window) {
      (window as any).requestIdleCallback(() => broadcastMeasurements(), { timeout: 5000 });
    } else {
      broadcastMeasurements();
    }
  };

  debounceTimer = setTimeout(scheduleUpload, currentDebounceMs);
};

/**
 * Set the sync interval for broadcasting
 */
export const setSyncInterval = (seconds: number): void => {
  currentDebounceMs = seconds * 1000;
  logger.debug(`[LiveMonitor] Sync interval set to ${seconds} seconds`);
};

/**
 * Actually broadcast measurements to Firestore
 */
const broadcastMeasurements = async (): Promise<void> => {
  if (!broadcastEnabled || !db || !isOnline()) return;

  const user = getCurrentUser();
  if (!user) return;

  try {
    // Slim down measurements for transfer
    const slimMeasurements: LiveMeasurement[] = pendingMeasurements.map(m => ({
      id: m.id,
      rel: m.rel,
      latitude: m.latitude,
      longitude: m.longitude,
      utcDate: m.utcDate,
      utcTime: m.utcTime,
      speed: m.speed,
      heading: m.heading,
      poi_type: m.poi_type,
      note: m.note,
      createdAt: m.createdAt
    }));

    const lastMeasurement = slimMeasurements[0];
    
    await setDoc(doc(db, COLLECTION_LIVE_FEEDS, user.uid), {
      userId: user.uid,
      email: (user.email || '').toLowerCase(),
      displayName: user.displayName || user.email?.split('@')[0] || 'Unknown',
      activeSurveyId: currentSurveyId,
      activeSurveyTitle: currentSurveyTitle,
      lastSeen: Timestamp.now(),
      isOnline: true,
      measurementCount: slimMeasurements.length,
      lastLocation: lastMeasurement ? {
        latitude: lastMeasurement.latitude,
        longitude: lastMeasurement.longitude
      } : null,
      measurements: slimMeasurements
    });

    logger.debug(`[LiveMonitor] Broadcast ${slimMeasurements.length} measurements`);
  } catch (error) {
    logger.error('[LiveMonitor] Failed to broadcast measurements:', error);
  }
};

/**
 * Start heartbeat to keep presence updated
 */
const startHeartbeat = (): void => {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
  }

  heartbeatTimer = setInterval(() => {
    if (broadcastEnabled) {
      broadcastHeartbeat();
    }
  }, HEARTBEAT_INTERVAL_MS);
};

/**
 * Send heartbeat to update presence
 */
const broadcastHeartbeat = async (): Promise<void> => {
  if (!db || !isOnline()) return;

  const user = getCurrentUser();
  if (!user) return;

  try {
    await setDoc(doc(db, COLLECTION_LIVE_FEEDS, user.uid), {
      lastSeen: Timestamp.now(),
      isOnline: true
    }, { merge: true });
  } catch (error) {
    // Heartbeat failures are non-critical
  }
};

/**
 * Look up a user by email address
 */
export const lookupUserByEmail = async (email: string): Promise<{ userId: string; displayName: string } | null> => {
  if (!initFirestore() || !isOnline()) {
    return null;
  }

  try {
    const q = query(
      collection(db!, COLLECTION_USER_MAPPING),
      where('email', '==', email.toLowerCase())
    );
    
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      return null;
    }

    const data = snapshot.docs[0].data();
    return {
      userId: data.userId,
      displayName: data.displayName
    };
  } catch (error) {
    logger.error('[LiveMonitor] Failed to lookup user:', error);
    return null;
  }
};

/**
 * Subscribe to a remote user's live feed
 */
export const subscribeToRemoteUser = (
  userId: string,
  onUpdate: (data: LiveFeedData & { measurements: LiveMeasurement[] }) => void,
  onError: (error: Error) => void
): (() => void) => {
  if (!initFirestore()) {
    onError(new Error('Firestore not initialized'));
    return () => {};
  }

  // Unsubscribe from previous subscription
  if (unsubscribeRemote) {
    unsubscribeRemote();
  }

  try {
    unsubscribeRemote = onSnapshot(
      doc(db!, COLLECTION_LIVE_FEEDS, userId),
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data() as LiveFeedData & { measurements: LiveMeasurement[] };
          onUpdate(data);
        } else {
          onError(new Error('User not found or not sharing'));
        }
      },
      (error) => {
        logger.error('[LiveMonitor] Subscription error:', error);
        onError(error);
      }
    );

    return () => {
      if (unsubscribeRemote) {
        unsubscribeRemote();
        unsubscribeRemote = null;
      }
    };
  } catch (error) {
    onError(error as Error);
    return () => {};
  }
};

/**
 * Manually fetch remote user's data (for snapshot mode)
 */
export const fetchRemoteUserSnapshot = async (userId: string): Promise<(LiveFeedData & { measurements: LiveMeasurement[] }) | null> => {
  if (!initFirestore() || !isOnline()) {
    return null;
  }

  try {
    const snapshot = await getDoc(doc(db!, COLLECTION_LIVE_FEEDS, userId));
    
    if (snapshot.exists()) {
      return snapshot.data() as LiveFeedData & { measurements: LiveMeasurement[] };
    }
    
    return null;
  } catch (error) {
    logger.error('[LiveMonitor] Failed to fetch snapshot:', error);
    return null;
  }
};

/**
 * Check if broadcasting is currently enabled
 */
export const isBroadcastEnabled = (): boolean => broadcastEnabled;

/**
 * Get current broadcast status
 */
export const getBroadcastStatus = (): { enabled: boolean; surveyId: string | null; surveyTitle: string | null } => ({
  enabled: broadcastEnabled,
  surveyId: currentSurveyId,
  surveyTitle: currentSurveyTitle
});
