/**
 * Live Support — REST client + WebSocket URL builder
 * Uses Firebase auth tokens for all requests.
 */

import { getAuth } from 'firebase/auth';
import type { SessionDTO } from './types';

// Base URL — defaults to RoadScope production, overridable
const API_BASE = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_ROADSCOPE_API_BASE_URL)
  || 'https://roadscope.app';

const LS_PATH = '/api/live-support';

// ── Auth helper ──────────────────────────────────────────────────────────────

async function getIdToken(forceRefresh = false): Promise<string> {
  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) throw new Error('Not signed in — please sign in to use Live Support');
  return user.getIdToken(forceRefresh);
}

async function authFetch(url: string, init: RequestInit = {}): Promise<Response> {
  let token = await getIdToken();
  let res = await fetch(url, {
    ...init,
    headers: { ...init.headers, 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  });

  // Auto-refresh token on 401/403 and retry once
  if (res.status === 401 || res.status === 403) {
    token = await getIdToken(true);
    res = await fetch(url, {
      ...init,
      headers: { ...init.headers, 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    });
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Live Support API error ${res.status}: ${body || res.statusText}`);
  }
  return res;
}

// ── REST endpoints ───────────────────────────────────────────────────────────

export async function createSession(): Promise<SessionDTO> {
  const res = await authFetch(`${API_BASE}${LS_PATH}/sessions`, { method: 'POST' });
  const data = await res.json();
  return data.session;
}

export async function getSession(sessionId: string): Promise<SessionDTO> {
  const res = await authFetch(`${API_BASE}${LS_PATH}/sessions/${sessionId}`);
  const data = await res.json();
  return data.session;
}

export async function approveSession(sessionId: string): Promise<SessionDTO> {
  const res = await authFetch(`${API_BASE}${LS_PATH}/sessions/${sessionId}/approve`, { method: 'POST' });
  const data = await res.json();
  return data.session;
}

export async function denySession(sessionId: string): Promise<SessionDTO> {
  const res = await authFetch(`${API_BASE}${LS_PATH}/sessions/${sessionId}/deny`, { method: 'POST' });
  const data = await res.json();
  return data.session;
}

export async function endSession(sessionId: string): Promise<SessionDTO> {
  const res = await authFetch(`${API_BASE}${LS_PATH}/sessions/${sessionId}/end`, { method: 'POST' });
  const data = await res.json();
  return data.session;
}

export async function swapDirection(sessionId: string): Promise<SessionDTO> {
  const res = await authFetch(`${API_BASE}${LS_PATH}/sessions/${sessionId}/swap`, { method: 'POST' });
  const data = await res.json();
  return data.session;
}

// ── WebSocket URL builder ────────────────────────────────────────────────────

export async function buildWsUrl(sessionId: string): Promise<string> {
  const token = await getIdToken();
  const wsBase = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_ROADSCOPE_WS_BASE_URL)
    || API_BASE.replace(/^http/, 'ws');
  return `${wsBase}${LS_PATH}/ws?session=${sessionId}&role=user&token=${encodeURIComponent(token)}`;
}
