/**
 * GNSS API Client for MeasurePRO RoadScope
 * Handles all backend communication for GPS/GNSS data and road profiles
 * 
 * When a local Duro bridge URL is configured, GNSS-related calls go to the local bridge.
 * Otherwise, calls go to the Replit server (fallback).
 */

import type { 
  GnssSample, 
  RoadProfile, 
  GradeEvent, 
  KFactorEvent, 
  RailCrossingEvent,
  ProfileSection,
  CorrectionStatus,
  DuroStatus 
} from '../../server/gnss/types';

const BACKEND_URL_KEY = 'measurepro_gnss_backend_url';

/**
 * Get the API base URL. Uses configured local bridge URL if available.
 */
function getApiBase(): string {
  try {
    const backendUrl = localStorage.getItem(BACKEND_URL_KEY);
    if (backendUrl) {
      return backendUrl.replace(/\/$/, '') + '/api';
    }
  } catch {
    // localStorage not available
  }
  return '/api';
}

// Legacy constant for backward compatibility - use getApiBase() instead
const API_BASE = '/api';

/**
 * Fetch latest GNSS samples
 */
export async function getLatestGNSS(limit = 100, sessionId?: string): Promise<GnssSample[]> {
  const params = new URLSearchParams();
  params.set('limit', limit.toString());
  if (sessionId) {
    params.set('sessionId', sessionId);
  }

  const response = await fetch(`${API_BASE}/gnss/latest?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch GNSS data: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Ingest GNSS sample(s) to backend
 */
export async function ingestGNSS(data: { sample?: GnssSample; samples?: GnssSample[] }): Promise<void> {
  const response = await fetch(`${API_BASE}/gnss/ingest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    throw new Error(`Failed to ingest GNSS data: ${response.statusText}`);
  }
}

/**
 * Log manual rail crossing event
 */
export async function logRailCrossing(lat: number, lon: number, notes?: string): Promise<void> {
  const response = await fetch(`${API_BASE}/gnss/rail-crossing/manual`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lat, lon, notes }),
  });
  
  if (!response.ok) {
    throw new Error(`Failed to log rail crossing: ${response.statusText}`);
  }
}

/**
 * Get recent road profile data
 */
export async function getRecentProfile(duration_sec = 300): Promise<RoadProfile | null> {
  const response = await fetch(`${API_BASE}/road-profile/recent?duration_sec=${duration_sec}`);
  if (!response.ok) {
    if (response.status === 404) {
      return null;
    }
    throw new Error(`Failed to fetch recent profile: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Save road profile by time range
 */
export async function saveProfile(params: {
  sessionId?: string;
  startTime: string;
  endTime: string;
  step_m?: number;
  grade_trigger_pct?: number;
  k_factor_convex_min?: number;
  k_factor_concave_min?: number;
}): Promise<RoadProfile> {
  const response = await fetch(`${API_BASE}/road-profile/save-by-time`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  
  if (!response.ok) {
    throw new Error(`Failed to save profile: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Save a section of an existing profile
 */
export async function saveProfileSection(
  profileId: string,
  fromDistance: number,
  toDistance: number,
  label?: string
): Promise<ProfileSection> {
  const response = await fetch(`${API_BASE}/road-profile/save-section`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ profileId, fromDistance, toDistance, label }),
  });
  
  if (!response.ok) {
    throw new Error(`Failed to save profile section: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Get grade events for a session or profile
 * Uses configured backend URL if available (local bridge mode)
 */
export async function getGradeEvents(sessionId?: string, profileId?: string): Promise<GradeEvent[]> {
  const params = new URLSearchParams();
  if (sessionId) params.set('sessionId', sessionId);
  if (profileId) params.set('profileId', profileId);

  const response = await fetch(`${getApiBase()}/road-profile/grade-events?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch grade events: ${response.statusText}`);
  }
  const result = await response.json();
  return result.data;
}

/**
 * Get K-factor events for a session or profile
 * Uses configured backend URL if available (local bridge mode)
 */
export async function getKFactorEvents(sessionId?: string, profileId?: string): Promise<KFactorEvent[]> {
  const params = new URLSearchParams();
  if (sessionId) params.set('sessionId', sessionId);
  if (profileId) params.set('profileId', profileId);

  const response = await fetch(`${getApiBase()}/road-profile/k-factor-events?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch K-factor events: ${response.statusText}`);
  }
  const result = await response.json();
  return result.data;
}

/**
 * Get rail crossing events for a session or profile
 * Uses configured backend URL if available (local bridge mode)
 */
export async function getRailCrossingEvents(sessionId?: string, profileId?: string): Promise<RailCrossingEvent[]> {
  const params = new URLSearchParams();
  if (sessionId) params.set('sessionId', sessionId);
  if (profileId) params.set('profileId', profileId);

  const response = await fetch(`${getApiBase()}/road-profile/rail-crossing-events?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch rail crossing events: ${response.statusText}`);
  }
  const result = await response.json();
  return result.data;
}

/**
 * Get correction service status
 * Uses configured backend URL if available (local bridge mode)
 */
export async function getCorrectionStatus(): Promise<CorrectionStatus> {
  const response = await fetch(`${getApiBase()}/gnss/correction/status`);
  if (!response.ok) {
    throw new Error(`Failed to fetch correction status: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Update correction service settings
 */
export async function updateCorrectionSettings(settings: {
  type: 'none' | 'rtk' | 'ppp' | 'ppk' | 'sbas';
  enabled: boolean;
  ntrip?: {
    host: string;
    port: number;
    mountpoint: string;
    username?: string;
    password?: string;
  };
}): Promise<void> {
  const response = await fetch(`${API_BASE}/gnss/correction/settings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  });
  
  if (!response.ok) {
    throw new Error(`Failed to update correction settings: ${response.statusText}`);
  }
}

/**
 * Get Duro connection status
 * Uses configured backend URL if available (local bridge mode)
 */
export async function getDuroStatus(): Promise<DuroStatus> {
  const response = await fetch(`${getApiBase()}/gnss/duro/status`);
  if (!response.ok) {
    throw new Error(`Failed to fetch Duro status: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Get all saved profiles
 */
export async function getSavedProfiles(): Promise<RoadProfile[]> {
  const response = await fetch(`${API_BASE}/road-profile/list`);
  if (!response.ok) {
    throw new Error(`Failed to fetch saved profiles: ${response.statusText}`);
  }
  const result = await response.json();
  return result.data;
}

/**
 * Get specific profile by ID
 */
export async function getProfileById(profileId: string): Promise<RoadProfile> {
  const response = await fetch(`${API_BASE}/road-profile/${profileId}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch profile: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Delete a saved profile
 */
export async function deleteProfile(profileId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/road-profile/${profileId}`, {
    method: 'DELETE',
  });
  
  if (!response.ok) {
    throw new Error(`Failed to delete profile: ${response.statusText}`);
  }
}
