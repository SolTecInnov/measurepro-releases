const STORAGE_KEY = 'convoy_session';

export interface PersistedConvoySession {
  role: string;
  memberName: string;
  sessionId: string;
  lastActivity: number;
  isLeader: boolean;
  qrToken: string;
  vehicleRole: string;
  vehicleId: string;
  company: string;
  phoneNumber: string;
  radioChannel: string;
  sessionName: string;
  warningThreshold: number;
  criticalThreshold: number;
  groundReference: number;
  maxMembers: number;
  qrCodeUrl: string | null;
}

export function saveConvoySession(data: Partial<PersistedConvoySession>): void {
  try {
    const existing = getConvoySession();
    const merged = { ...existing, ...data, lastActivity: Date.now() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  } catch {}
}

export function getConvoySession(): PersistedConvoySession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PersistedConvoySession;
  } catch {
    return null;
  }
}

export function clearConvoySession(): void {
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
}

export function updateConvoySessionActivity(): void {
  const session = getConvoySession();
  if (session) {
    saveConvoySession({ lastActivity: Date.now() });
  }
}

export function hasActiveConvoySession(): boolean {
  const session = getConvoySession();
  if (!session) return false;
  // Consider session stale after 1 hour
  return (Date.now() - session.lastActivity) < 3600000;
}
