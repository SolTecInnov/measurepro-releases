// Audit Logging Client — fire-and-forget with IndexedDB offline queue
import { openDB, IDBPDatabase } from 'idb';

const QUEUE_DB_NAME = 'audit-queue-db';
const QUEUE_STORE = 'pending';

interface QueuedEvent {
  id?: number;
  endpoint: string;
  data: any;
  ts: number;
}

const SESSION_LOGIN_LOGGED_KEY = 'audit_session_login_logged';

export function hasSessionLoginLogged(): boolean {
  return sessionStorage.getItem(SESSION_LOGIN_LOGGED_KEY) === 'true';
}

export function markSessionLoginLogged(): void {
  sessionStorage.setItem(SESSION_LOGIN_LOGGED_KEY, 'true');
}

interface LoginLogData {
  userId: string;
  userEmail: string;
  loginMethod?: 'email' | 'google' | 'firebase' | 'offline' | 'session_restore';
  success?: boolean;
  failureReason?: string;
  sessionId?: string;
  metadata?: Record<string, any>;
}

interface ActivityLogData {
  userId: string;
  userEmail: string;
  actionType: string;
  actionDetails?: string;
  resourceType?: string;
  resourceId?: string;
  resourceName?: string;
  metadata?: Record<string, any>;
}

// ── IndexedDB queue ────────────────────────────────────────────────────────────

let _queueDb: IDBPDatabase | null = null;

async function getQueueDB(): Promise<IDBPDatabase> {
  if (!_queueDb) {
    _queueDb = await openDB(QUEUE_DB_NAME, 1, {
      upgrade(db) {
        db.createObjectStore(QUEUE_STORE, { keyPath: 'id', autoIncrement: true });
      },
    });
  }
  return _queueDb;
}

async function enqueue(endpoint: string, data: any): Promise<void> {
  try {
    const db = await getQueueDB();
    await db.add(QUEUE_STORE, { endpoint, data, ts: Date.now() } as QueuedEvent);
  } catch (e) {
    console.debug('[Audit] Queue enqueue failed:', e);
  }
}

export async function flushAuditQueue(): Promise<void> {
  try {
    const db = await getQueueDB();
    const all: QueuedEvent[] = await db.getAll(QUEUE_STORE);
    if (all.length === 0) return;
    let flushed = 0;
    let failed = 0;
    for (const item of all) {
      try {
        const resp = await fetch(`/api/audit${item.endpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item.data),
        });
        if (resp.ok && item.id != null) {
          await db.delete(QUEUE_STORE, item.id);
          flushed++;
        } else {
          failed++;
        }
      } catch (_e) {
        // Network still unavailable — leave in queue
        failed++;
      }
    }
    if (flushed > 0) console.debug(`[Audit] Flushed ${flushed} queued event(s).`);
    if (failed > 0) console.warn(`[Audit] ${failed} event(s) remain queued after flush — server unreachable or rejected.`);
  } catch (e) {
    console.warn('[Audit] Queue flush error (IndexedDB unavailable?):', e);
  }
}

// Flush automatically when connectivity is restored
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    flushAuditQueue().catch(() => {});
  });
}

// ── Device / session helpers ──────────────────────────────────────────────────

function getDeviceInfo() {
  return {
    screenResolution: `${window.screen.width}x${window.screen.height}`,
    language: navigator.language,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    referrerUrl: document.referrer || undefined,
  };
}

function getSessionId(): string {
  let sessionId = sessionStorage.getItem('audit_session_id');
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    sessionStorage.setItem('audit_session_id', sessionId);
  }
  return sessionId;
}

// ── Core send (queue if offline or if server is unreachable) ──────────────────

async function sendLog(endpoint: string, data: any): Promise<void> {
  if (!navigator.onLine) {
    await enqueue(endpoint, data);
    return;
  }
  try {
    const resp = await fetch(`/api/audit${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  } catch (error) {
    console.debug('[Audit] Log failed — queuing for retry:', error);
    await enqueue(endpoint, data);
  }
}

// ── Public helpers ────────────────────────────────────────────────────────────

export function logLogin(data: LoginLogData): void {
  const deviceInfo = getDeviceInfo();
  const sessionId = getSessionId();
  markSessionLoginLogged();
  sendLog('/login', { ...data, ...deviceInfo, sessionId });
}

export function logLogout(userId?: string): void {
  const sessionId = sessionStorage.getItem('audit_session_id');
  sendLog('/logout', { sessionId, userId });
  sessionStorage.removeItem('audit_session_id');
}

export function logActivity(data: ActivityLogData): void {
  sendLog('/activity', data);
}

// ── Pre-built activity helpers ────────────────────────────────────────────────

export const auditLog = {
  // Survey actions
  surveyCreate: (userId: string, userEmail: string, surveyId: string, surveyName: string) => {
    logActivity({ userId, userEmail, actionType: 'survey_create', actionDetails: `Created survey: ${surveyName}`, resourceType: 'survey', resourceId: surveyId, resourceName: surveyName });
  },

  surveyClose: (userId: string, userEmail: string, surveyId: string, surveyName: string, poiCount: number) => {
    logActivity({ userId, userEmail, actionType: 'survey_close', actionDetails: `Closed survey with ${poiCount} POIs`, resourceType: 'survey', resourceId: surveyId, resourceName: surveyName, metadata: { poiCount } });
  },

  surveyExport: (userId: string, userEmail: string, surveyId: string, surveyName: string, format: string, fileSize?: number) => {
    logActivity({ userId, userEmail, actionType: 'survey_export', actionDetails: `Exported survey as ${format.toUpperCase()}`, resourceType: 'survey', resourceId: surveyId, resourceName: surveyName, metadata: { format, fileSize } });
  },

  surveyEmail: (userId: string, userEmail: string, surveyId: string, surveyName: string, recipients: string[]) => {
    logActivity({ userId, userEmail, actionType: 'survey_email', actionDetails: `Emailed survey to ${recipients.length} recipient(s)`, resourceType: 'survey', resourceId: surveyId, resourceName: surveyName, metadata: { recipientCount: recipients.length } });
  },

  // Feature access
  featureAccess: (userId: string, userEmail: string, featureName: string) => {
    logActivity({ userId, userEmail, actionType: 'feature_access', actionDetails: `Accessed ${featureName}`, resourceType: 'feature', resourceName: featureName });
  },

  // Settings change
  settingsChange: (userId: string, userEmail: string, settingName: string, oldValue?: any, newValue?: any) => {
    logActivity({ userId, userEmail, actionType: 'settings_change', actionDetails: `Changed ${settingName}`, resourceType: 'settings', resourceName: settingName, metadata: { oldValue, newValue } });
  },

  // Hardware connection event
  hardwareConnect: (userId: string, userEmail: string, deviceType: string, deviceName: string, connected: boolean, connectionMethod?: string) => {
    logActivity({ userId, userEmail, actionType: 'hardware_connect', actionDetails: `${connected ? 'Connected' : 'Disconnected'} ${deviceType}: ${deviceName}`, resourceType: 'hardware', resourceName: deviceName, metadata: { deviceType, connected, connectionMethod: connectionMethod || 'unknown' } });
  },

  // GPS session start/stop
  gpsSession: (userId: string, userEmail: string, sessionType: string, started: boolean) => {
    logActivity({ userId, userEmail, actionType: 'gps_session', actionDetails: `${started ? 'Started' : 'Stopped'} GPS session: ${sessionType}`, resourceType: 'gps', resourceName: sessionType, metadata: { sessionType, started } });
  },

  // Measurement logged (POI capture)
  poiCapture: (userId: string, userEmail: string, poiId: string, poiType: string, surveyId: string) => {
    logActivity({ userId, userEmail, actionType: 'poi_capture', actionDetails: `Captured ${poiType} POI`, resourceType: 'poi', resourceId: poiId, resourceName: poiType, metadata: { surveyId } });
  },
};

export default auditLog;
