/**
 * GNSS Session Persistence
 * Persists active recording session to IndexedDB to survive navigation
 * 
 * Architecture:
 * - Session metadata stored in localStorage (small, fast access)
 * - Accumulated samples stored in IndexedDB (large, durable)
 * - Auto-restores session when page loads
 */

import { openSurveyDB } from '@/lib/survey/db';
import type { GnssSample } from '../../../server/gnss/types';

const SESSION_STATE_KEY = 'gnss_active_session';
const SAMPLES_STORE = 'roadProfileSamples';

export interface ActiveSessionState {
  sessionId: string;
  isRecording: boolean;
  startTime: string; // ISO string
  sampleCount: number;
  lastUpdated: string;
}

export async function saveSessionState(state: ActiveSessionState): Promise<void> {
  try {
    localStorage.setItem(SESSION_STATE_KEY, JSON.stringify(state));
  } catch (error) {
    console.warn('[GNSSSession] Failed to save session state:', error);
  }
}

export function loadSessionState(): ActiveSessionState | null {
  try {
    const stored = localStorage.getItem(SESSION_STATE_KEY);
    if (!stored) return null;
    return JSON.parse(stored) as ActiveSessionState;
  } catch (error) {
    console.warn('[GNSSSession] Failed to load session state:', error);
    return null;
  }
}

export function clearSessionState(): void {
  try {
    localStorage.removeItem(SESSION_STATE_KEY);
  } catch (error) {
    console.warn('[GNSSSession] Failed to clear session state:', error);
  }
}

export async function persistSamples(sessionId: string, samples: GnssSample[]): Promise<void> {
  if (samples.length === 0) return;
  
  try {
    const db = await openSurveyDB();
    const tx = db.transaction(SAMPLES_STORE, 'readwrite');
    const store = tx.objectStore(SAMPLES_STORE);
    
    for (const sample of samples) {
      const record = {
        surveyId: sample.surveyId || sessionId,
        profileId: sample.profileId || sessionId,
        sessionId: sample.sessionId || sessionId,
        timestamp: sample.timestamp || new Date().toISOString(),
        latitude: sample.latitude,
        longitude: sample.longitude,
        altitude_raw_m: sample.altitude ?? null,
        altitude_selected_m: sample.altitude ?? null,
        altitude_corrected_m: sample.altitude ?? null,
        grade_pct: sample.grade ?? null,
        roll_deg: sample.attitude?.roll ?? null,
        pitch_deg: sample.attitude?.pitch ?? null,
        yaw_deg: sample.attitude?.yaw ?? null,
        heading_deg: sample.heading ?? null,
        speed_mps: sample.speed ?? null,
        fix_quality: sample.quality ?? null,
        num_satellites: sample.num_sats ?? null,
        hdop: sample.hdop ?? null,
      };
      await store.add(record);
    }
    
    await tx.done;
    console.log(`[GNSSSession] Persisted ${samples.length} samples for session ${sessionId.substring(0, 8)}`);
  } catch (error) {
    console.warn('[GNSSSession] Failed to persist samples:', error);
  }
}

export async function loadSessionSamples(sessionId: string): Promise<GnssSample[]> {
  try {
    const db = await openSurveyDB();
    const index = db.transaction(SAMPLES_STORE, 'readonly').objectStore(SAMPLES_STORE).index('by-session');
    const records = await index.getAll(sessionId);
    
    const samples: GnssSample[] = records.map((r: any) => ({
      timestamp: r.timestamp,
      latitude: r.latitude,
      longitude: r.longitude,
      altitude: r.altitude_raw_m ?? null,
      grade: r.grade_pct ?? undefined,
      attitude: r.roll_deg != null ? {
        roll: r.roll_deg,
        pitch: r.pitch_deg ?? 0,
        yaw: r.yaw_deg ?? 0,
      } : undefined,
      heading: r.heading_deg ?? null,
      speed: r.speed_mps ?? null,
      quality: r.fix_quality ?? undefined,
      num_sats: r.num_satellites ?? null,
      hdop: r.hdop ?? null,
      sessionId: r.sessionId || sessionId,
      surveyId: r.surveyId || sessionId,
      profileId: r.profileId,
      source: 'duro-tcp',
    }));
    
    console.log(`[GNSSSession] Loaded ${samples.length} samples for session ${sessionId.substring(0, 8)}`);
    return samples;
  } catch (error) {
    console.warn('[GNSSSession] Failed to load session samples:', error);
    return [];
  }
}

export async function clearSessionSamples(sessionId: string): Promise<void> {
  try {
    const db = await openSurveyDB();
    const tx = db.transaction(SAMPLES_STORE, 'readwrite');
    const store = tx.objectStore(SAMPLES_STORE);
    const index = store.index('by-session');
    
    let cursor = await index.openCursor(sessionId);
    let deletedCount = 0;
    while (cursor) {
      await cursor.delete();
      deletedCount++;
      cursor = await cursor.continue();
    }
    
    await tx.done;
    console.log(`[GNSSSession] Cleared ${deletedCount} samples for session ${sessionId.substring(0, 8)}`);
  } catch (error) {
    console.warn('[GNSSSession] Failed to clear session samples:', error);
  }
}

/**
 * Batch persist new samples (for incremental saves)
 */
export async function appendSamples(sessionId: string, newSamples: GnssSample[]): Promise<void> {
  await persistSamples(sessionId, newSamples);
}
