/**
 * Convoy Session Persistence
 * Saves and restores convoy sessions from localStorage
 */

interface PersistedConvoySession {
  sessionId: string;
  qrToken: string;
  sessionName: string;
  isLeader: boolean;
  
  // Leader-specific data
  warningThreshold?: number;
  criticalThreshold?: number;
  groundReference?: number;
  maxMembers?: number;
  qrCodeUrl?: string;
  
  // Follower-specific data
  memberName?: string;
  vehicleRole?: string;
  vehicleId?: string;
  phoneNumber?: string;
  radioChannel?: string;
  company?: string;
  
  // Connection metadata
  joinedAt: number;
  lastActive: number;
}

const STORAGE_KEY = 'convoy_active_session';

/**
 * Save convoy session to localStorage
 */
export const saveConvoySession = (data: Partial<PersistedConvoySession>) => {
  try {
    const existing = getConvoySession();
    const session: PersistedConvoySession = {
      ...existing,
      ...data,
      lastActive: Date.now(),
    } as PersistedConvoySession;
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch (error) {
  }
};

/**
 * Get saved convoy session from localStorage
 */
export const getConvoySession = (): PersistedConvoySession | null => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return null;
    
    const session = JSON.parse(data) as PersistedConvoySession;
    
    // Check if session is expired (24 hours)
    const age = Date.now() - session.lastActive;
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    
    if (age > maxAge) {
      clearConvoySession();
      return null;
    }
    
    return session;
  } catch (error) {
    return null;
  }
};

/**
 * Clear saved convoy session
 */
export const clearConvoySession = () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
  }
};

/**
 * Update last active timestamp
 */
export const updateConvoySessionActivity = () => {
  try {
    const session = getConvoySession();
    if (session) {
      session.lastActive = Date.now();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    }
  } catch (error) {
  }
};

/**
 * Check if there's an active convoy session
 */
export const hasActiveConvoySession = (): boolean => {
  return getConvoySession() !== null;
};
