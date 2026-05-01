import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { API_BASE_URL } from '@/lib/config/environment';
import { User } from 'firebase/auth';
import { 
  getCurrentUser, 
  signInWithEmail, 
  signOutUser, 
  initAuthListener,
  getAccountForUid 
} from '../firebase';
import {
  saveAuthCache,
  getAuthCache,
  clearAuthCache,
  verifyOfflinePassword,
  updateLastOnline,
  setOfflineMode,
  getDaysOffline,
  isWithinGracePeriod,
  updateAuthCacheTokens,
  fetchAuthTimestampsFromFirestore,
  syncTimestampsFromServer,
  isReauthRequired,
  isInReauthGraceWindow,
  clearRequiresPasswordChangeInCache,
  seedCompanyDataOffline,
} from './offlineAuth';
import { isMasterAdmin } from './masterAdmin';
import { toast } from 'sonner';
import { logLogin, logLogout, hasSessionLoginLogged, markSessionLoginLogged } from '../auditLog';
import { logger } from '../utils/logger';
import { initializeSettingsFromDatabase, clearSettingsUserContext } from '../settings';
import {
  registerSession,
  startSessionGuard,
  stopSessionGuard,
  unregisterSession,
} from './sessionManager';

/**
 * Record a server-authoritative online session timestamp via backend endpoint.
 * This uses Firebase Admin SDK FieldValue.serverTimestamp() on the backend,
 * making timestamps tamper-proof (clients cannot influence the written value).
 *
 * Falls back to Firestore client SDK only if the backend is unreachable.
 */
async function recordOnlineViaBackend(
  firebaseUser: { getIdToken: () => Promise<string> },
  options?: { resetAuthPeriod?: boolean }
): Promise<{ lastOnlineAt: string | null; authPeriodStart: string | null } | null> {
  try {
    const idToken = await firebaseUser.getIdToken();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    try {
      const resp = await fetch(`${API_BASE_URL}/api/auth/record-online`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ resetAuthPeriod: options?.resetAuthPeriod || false }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (resp.ok) {
        const data = await resp.json() as { success: boolean; lastOnlineAt: string | null; authPeriodStart: string | null };
        return { lastOnlineAt: data.lastOnlineAt, authPeriodStart: data.authPeriodStart };
      }
      return null;
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return null;
  }
}

interface AuthContextType {
  user: User | null;
  isOnline: boolean;
  isOfflineMode: boolean;
  lastOnlineTimestamp: string | null;
  daysOffline: number;
  cachedUserData: any | null;
  isMasterAdmin: boolean;
  requiresReauth: boolean;
  requiresPasswordChange: boolean;
  /** True when user is in the 14-16 day re-auth grace window (read-only offline access) */
  isGracePeriod: boolean;
  /** The authPeriodStart ISO string (server-authoritative) for accurate re-auth timeline computation */
  authPeriodStart: string | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
  triggerBackgroundSync: () => Promise<void>;
  completeReauth: () => Promise<void>;
  clearPasswordChange: () => Promise<void>;
  isLoading: boolean;
  /** Seconds remaining before this session is signed out due to concurrent login on another device (null = not evicting) */
  evictionSecondsLeft: number | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [isOfflineMode, setIsOfflineModeState] = useState<boolean>(false);
  const [lastOnlineTimestamp, setLastOnlineTimestamp] = useState<string | null>(null);
  const [daysOffline, setDaysOffline] = useState<number>(0);
  const [cachedUserData, setCachedUserData] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [requiresReauth, setRequiresReauth] = useState<boolean>(false);
  const [requiresPasswordChange, setRequiresPasswordChange] = useState<boolean>(false);
  const [isGracePeriod, setIsGracePeriod] = useState<boolean>(false);
  const [authPeriodStart, setAuthPeriodStart] = useState<string | null>(null);
  // Concurrent session eviction: shows a 60-second banner before forcing logout
  const [evictionSecondsLeft, setEvictionSecondsLeft] = useState<number | null>(null);
  const evictionTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Helper: sync timestamps from server AND update React state from confirmed values
  // This replaces the pattern of calling syncTimestampsFromServer then separately updating state
  const syncTimestampsAndUpdateState = async (
    lastOnlineAt: string,
    periodStart: string | null,
    uid?: string
  ) => {
    await syncTimestampsFromServer(lastOnlineAt, periodStart);
    if (periodStart) {
      setAuthPeriodStart(periodStart);
    }
    // Re-evaluate re-auth state from the freshly synced timestamps
    if (uid) {
      const reauth = await isReauthRequired(uid);
      const grace = await isInReauthGraceWindow(uid);
      setRequiresReauth(reauth);
      setIsGracePeriod(grace);
    }
  };

  /**
   * Begin the 60-second countdown before signing this session out.
   * Used when a concurrent login is detected on another device.
   * Idempotent — calling again while already counting down is a no-op.
   */
  const startEvictionCountdown = () => {
    if (evictionTimerRef.current !== null) return; // already counting
    const COUNTDOWN_SECS = 60;
    setEvictionSecondsLeft(COUNTDOWN_SECS);

    let remaining = COUNTDOWN_SECS;
    evictionTimerRef.current = setInterval(() => {
      remaining -= 1;
      setEvictionSecondsLeft(remaining);
      if (remaining <= 0) {
        if (evictionTimerRef.current !== null) {
          clearInterval(evictionTimerRef.current);
          evictionTimerRef.current = null;
        }
        setEvictionSecondsLeft(null);
        logout().catch(() => {});
      }
    }, 1000);
  };

  // Cleanup eviction countdown timer on unmount
  useEffect(() => {
    return () => {
      if (evictionTimerRef.current !== null) {
        clearInterval(evictionTimerRef.current);
        evictionTimerRef.current = null;
      }
    };
  }, []);

  // Initialize auth state from cache on mount
  useEffect(() => {
    logger.debug('[AUTHCTX-1] Initializing AuthContext...');
    const initAuthState = async () => {
      try {
        logger.debug('[AUTHCTX-2] Loading cached auth state...');
        const authCache = await getAuthCache();
        if (authCache) {
          logger.debug('[AUTHCTX-3] Auth cache found:', { email: authCache.email, isOfflineMode: authCache.isOfflineMode });
          setLastOnlineTimestamp(authCache.lastOnlineTimestamp);
          setIsOfflineModeState(authCache.isOfflineMode);
          setCachedUserData({
            email: authCache.email,
            profile: authCache.userProfile,
            license: authCache.licenseData,
          });
          
          // Restore requiresPasswordChange from cache (survives page reloads)
          if (authCache.requiresPasswordChange && !isMasterAdmin(authCache.email)) {
            setRequiresPasswordChange(true);
          }
          
          const days = await getDaysOffline();
          setDaysOffline(days);
          logger.debug('[AUTHCTX-4] Days offline:', days);

          // Expose authPeriodStart for accurate timeline-based grace/lockout computation
          if (authCache.authPeriodStart) {
            setAuthPeriodStart(authCache.authPeriodStart);
          }

          // Compute re-auth / grace state from cached timestamps on startup
          // This ensures the grace warning and lockout trigger even when offline at startup
          if (!isMasterAdmin(authCache.email)) {
            // Use the stored Firebase UID for Firestore fallback queries
            // authCache.id is the IndexedDB key constant, not the Firebase UID
            const uid = authCache.firebaseUid || undefined;
            const grace = await isInReauthGraceWindow(uid);
            const reauth = await isReauthRequired(uid);
            if (reauth) {
              setRequiresReauth(true);
            }
            setIsGracePeriod(grace);
          }
        } else {
          logger.debug('[AUTHCTX-3] No auth cache found');
        }
      } catch (error) {
        console.error('[AUTHCTX-5] Error loading auth cache:', error);
      } finally {
        setIsLoading(false);
        logger.debug('[AUTHCTX-6] Auth state initialization complete');
      }
    };

    initAuthState();
  }, []);

  // Listen to Firebase auth state changes
  useEffect(() => {
    logger.debug('[AUTHCTX-7] Setting up Firebase auth listener...');
    const unsubscribe = initAuthListener((firebaseUser) => {
      logger.debug('[AUTHCTX-8] Firebase auth listener callback:', { hasUser: !!firebaseUser, uid: firebaseUser?.uid });
      setUser(firebaseUser);
      
      if (firebaseUser && isOnline) {
        logger.debug('[AUTHCTX-9] User authenticated and online, updating timestamps');

        // Fire a session-restore login event if no login has been recorded for this browser session yet
        if (!hasSessionLoginLogged()) {
          logLogin({
            userId: firebaseUser.uid,
            userEmail: firebaseUser.email || '',
            loginMethod: 'session_restore',
            success: true,
          });
        }

        // User is authenticated and online - update last online timestamp
        updateLastOnline().catch(() => {});
        setOfflineMode(false).catch(() => {});
        
        // Record online via backend (tamper-proof server timestamps), then sync + evaluate re-auth state
        recordOnlineViaBackend(firebaseUser).then(async (result) => {
          let tsToSync = result;
          if (!tsToSync?.lastOnlineAt) {
            // Fallback: fetch directly from Firestore if backend unavailable
            tsToSync = await fetchAuthTimestampsFromFirestore(firebaseUser.uid);
          }
          if (tsToSync?.lastOnlineAt) {
            await syncTimestampsAndUpdateState(tsToSync.lastOnlineAt, tsToSync.authPeriodStart, firebaseUser.uid);
          }
        }).catch(() => {});

        // Restart session guard if this device has a registered session (e.g. after page refresh).
        // This ensures the concurrent-session eviction listener is always active while logged in.
        const localSessionId = localStorage.getItem('measPro_activeSessionId');
        if (localSessionId) {
          startSessionGuard(firebaseUser.uid, () => {
            startEvictionCountdown();
          });
        }
      }
    });

    logger.debug('[AUTHCTX-10] Firebase auth listener registered');
    return () => {
      logger.debug('[AUTHCTX-11] Unregistering Firebase auth listener');
      unsubscribe();
    };
  }, [isOnline]);

  // Listen to online/offline events
  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true);
      
      try {
        // Update last online timestamp
        await updateLastOnline();
        await setOfflineMode(false);
        setIsOfflineModeState(false);
        
        // Refresh auth cache if user is logged in
        const currentUser = getCurrentUser();
        if (currentUser) {
          // Record online via backend (tamper-proof server timestamps)
          const result = await recordOnlineViaBackend(currentUser);
          const tsToSync = result?.lastOnlineAt ? result : await fetchAuthTimestampsFromFirestore(currentUser.uid);
          if (tsToSync?.lastOnlineAt) {
            await syncTimestampsAndUpdateState(tsToSync.lastOnlineAt, tsToSync.authPeriodStart, currentUser.uid);
          }
          
          const needsReauth = await isReauthRequired(currentUser.uid);
          if (!needsReauth) {
            await refreshAuth();
            /* toast removed */
          }
        }
      } catch (error) {
        // Silent fail
      }
    };

    const handleOffline = async () => {
      setIsOnline(false);
      
      try {
        await setOfflineMode(true);
        setIsOfflineModeState(true);
        
        // Calculate days offline
        const days = await getDaysOffline();
        setDaysOffline(days);
        
        /* toast removed */
      } catch (error) {
        // Silent fail
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Login function - supports both online and offline login
  const login = async (email: string, password: string): Promise<boolean> => {
    logger.debug('[LOGIN-1] login() called, isOnline:', isOnline, 'email:', email);
    
    try {
      if (isOnline) {
        logger.debug('[LOGIN-2] Online login - using Firebase');
        // Online login - use Firebase
        const firebaseUser = await signInWithEmail(email, password);
        // Mark the session guard immediately so the auth listener does not
        // double-log this as a session_restore when it fires asynchronously
        markSessionLoginLogged();
        logger.debug('[LOGIN-3] Firebase sign-in successful, fetching account data...');
        
        // Fetch user account data for caching
        const account = await getAccountForUid(firebaseUser.uid);
        logger.debug('[LOGIN-4] Account data fetched:', { hasAccount: !!account, fullName: account?.fullName });
        
        // Fetch server-side timestamps FIRST (server is authoritative source of truth)
        // This evaluates offline duration and re-auth requirements before updating timestamps
        const serverTimestamps = await fetchAuthTimestampsFromFirestore(firebaseUser.uid);
        
        // Sync server timestamps into local cache + React state BEFORE evaluating re-auth
        if (serverTimestamps?.lastOnlineAt) {
          await syncTimestampsAndUpdateState(serverTimestamps.lastOnlineAt, serverTimestamps.authPeriodStart, firebaseUser.uid);
        }
        
        // Re-check needsReauth (syncTimestampsAndUpdateState already calls setRequiresReauth,
        // but we still need the value to gate the next block)
        const needsReauth = await isReauthRequired(firebaseUser.uid);
        
        // Cache auth data for offline use
        logger.debug('[LOGIN-5] Caching auth data for offline use...');
        await saveAuthCache(email, password, {
          firebaseUid: firebaseUser.uid,
          accessToken: await firebaseUser.getIdToken(),
          refreshToken: firebaseUser.refreshToken || null,
          tokenExpiry: null,
          userProfile: {
            email: firebaseUser.email || email,
            fullName: account?.fullName || null,
            company: account?.company || null,
            subscriptionTier: account?.subscriptionTier || null,
            addOns: account?.enabledAddons || null,
          },
          licenseData: null,
          requiresPasswordChange: account?.requiresPasswordChange || false,
          // Cache revocation status so offline login can hard-lock revoked accounts immediately
          isRevoked: account?.status === 'rejected',
        });
        
        // Seed company membership into IndexedDB for offline use (best-effort, non-blocking)
        seedCompanyDataOffline().catch(() => {});

        // Record this successful online session via backend endpoint (tamper-proof server timestamps).
        // resetAuthPeriod=true implements the sliding 14-day window: every successful online auth
        // resets the clock so the offline grace period starts fresh from this login.
        const recordResult = await recordOnlineViaBackend(firebaseUser, { resetAuthPeriod: true });
        if (recordResult?.lastOnlineAt) {
          await syncTimestampsAndUpdateState(recordResult.lastOnlineAt, recordResult.authPeriodStart, firebaseUser.uid);
        }
        
        // Check if admin has forced a password change
        const needsPwChange = account?.requiresPasswordChange || false;
        setRequiresPasswordChange(needsPwChange);
        
        // Update state
        logger.debug('[LOGIN-6] Updating auth state...');
        setUser(firebaseUser);
        setIsOfflineModeState(false);
        setLastOnlineTimestamp(new Date().toISOString());
        setCachedUserData({
          email: firebaseUser.email || email,
          profile: {
            email: firebaseUser.email || email,
            fullName: account?.fullName || null,
            company: account?.company || null,
          },
        });
        
        logger.debug('[LOGIN-7] ✅ Online login successful');
        
        // Log successful login (fire-and-forget)
        logLogin({
          userId: firebaseUser.uid,
          userEmail: firebaseUser.email || email,
          loginMethod: 'email',
          success: true,
        });
        
        // Initialize settings from database (fire-and-forget for non-blocking login)
        initializeSettingsFromDatabase(firebaseUser.uid).catch((err) => {
          console.error('[LOGIN-7b] Failed to load settings from database:', err);
        });

        // Register this device's session in Firestore and start concurrent-session guard.
        // If the account is logged in on another device, that device will be evicted after a
        // 60-second warning countdown (see SessionEvictionBanner).
        registerSession(firebaseUser.uid)
          .then(() => {
            startSessionGuard(firebaseUser.uid, () => {
              startEvictionCountdown();
            });
          })
          .catch(() => {});
        
        return true;
      } else {
        logger.debug('[LOGIN-8] Offline login - verifying cached credentials');
        // Offline login - verify against cached credentials
        
        // Check if cached data exists
        const authCache = await getAuthCache();
        if (!authCache) {
          console.error('[LOGIN-9] ❌ No cached auth data - offline login not available');
          toast.error('Offline login not available', {
            description: 'You must log in online at least once',
          });
          return false;
        }
        
        logger.debug('[LOGIN-10] Cached auth data found, checking grace period...');
        // Check if within grace period
        const withinGracePeriod = await isWithinGracePeriod();
        if (!withinGracePeriod) {
          const days = await getDaysOffline();
          console.error('[LOGIN-11] ❌ Grace period expired:', days, 'days offline');
          toast.error('Grace period expired', {
            description: `You have been offline for ${days} days. Please connect to the internet to log in.`,
          });
          return false;
        }
        
        logger.debug('[LOGIN-12] Within grace period, verifying password...');
        // Verify credentials (also checks for revocation — hard lock even offline)
        const verifyResult = await verifyOfflinePassword(email, password);
        if (!verifyResult.valid) {
          if (verifyResult.reason === 'revoked') {
            console.error('[LOGIN-13] ❌ Account revoked — offline login blocked');
            toast.error('Account suspended', {
              description: 'Your account has been suspended. Please contact your administrator.',
            });
          } else {
            console.error('[LOGIN-13] ❌ Invalid offline credentials');
            toast.error('Invalid credentials', {
              description: 'Email or password is incorrect',
            });
          }
          return false;
        }
        
        logger.debug('[LOGIN-14] Password verified, setting offline mode...');
        // Set offline mode and update state
        await setOfflineMode(true);
        setIsOfflineModeState(true);
        setCachedUserData({
          email: authCache.email,
          profile: authCache.userProfile,
          license: authCache.licenseData,
        });
        setLastOnlineTimestamp(authCache.lastOnlineTimestamp);
        
        const days = await getDaysOffline();
        setDaysOffline(days);
        
        const remaining = 14 - days;
        logger.debug('[LOGIN-15] ✅ Offline login successful,', days, 'days offline');
        /* toast removed */

        // Log offline login (fire-and-forget — will queue if truly offline)
        logLogin({
          userId: authCache.firebaseUid || email,
          userEmail: authCache.email,
          loginMethod: 'offline',
          success: true,
          metadata: { daysOffline: days },
        });
        
        return true;
      }
    } catch (error: any) {
      console.error('[LOGIN-16] ❌ Login FAILED:', {
        error,
        errorMessage: error?.message,
        stack: error?.stack
      });
      throw error;
    }
  };

  // Logout function
  const logout = async (): Promise<void> => {
    try {
      // Deterministically stop the eviction countdown so a quick sign-out → sign-in cycle
      // does not leave a stale timer decrementing against the new session.
      if (evictionTimerRef.current !== null) {
        clearInterval(evictionTimerRef.current);
        evictionTimerRef.current = null;
      }
      setEvictionSecondsLeft(null);

      // Log logout before clearing user data
      const currentUserId = user?.uid || localStorage.getItem('current_user_id');
      if (currentUserId) {
        logLogout(currentUserId);
      }

      // Stop concurrent session guard first, then clean up session record
      stopSessionGuard();
      if (currentUserId && isOnline) {
        unregisterSession(currentUserId).catch(() => {});
      }
      
      // Clear settings user context
      clearSettingsUserContext();
      
      // Sign out from Firebase if online
      if (isOnline) {
        await signOutUser();
      }
      
      // Clear auth cache
      await clearAuthCache();
      
      // Clear local state
      setUser(null);
      setIsOfflineModeState(false);
      setLastOnlineTimestamp(null);
      setDaysOffline(0);
      setCachedUserData(null);
      setRequiresReauth(false);
      setRequiresPasswordChange(false);
      setIsGracePeriod(false);
      
      // Clear localStorage and sessionStorage flags
      // app_access NOT removed — license/trial controls app access, not Firebase login
      localStorage.removeItem('current_user_id');
      // Clear queued password change intent on logout
      sessionStorage.removeItem('pending_pw_change_flag');
    } catch (error) {
      throw error;
    }
  };

  // Refresh auth data from server
  const refreshAuth = async (): Promise<void> => {
    try {
      if (!isOnline) {
        return;
      }
      
      const currentUser = getCurrentUser();
      if (!currentUser) {
        return;
      }
      
      // Get fresh token
      const token = await currentUser.getIdToken(true);
      
      // Fetch updated account data
      const account = await getAccountForUid(currentUser.uid);
      
      // Update cache with fresh data
      const authCache = await getAuthCache();
      if (authCache) {
        // Use updateAuthCacheTokens to preserve password hash
        await updateAuthCacheTokens(
          authCache.email,
          {
            accessToken: token,
            refreshToken: currentUser.refreshToken || null,
            tokenExpiry: null,
          },
          {
            email: currentUser.email || authCache.email,
            fullName: account?.fullName || authCache.userProfile.fullName,
            company: account?.company || authCache.userProfile.company,
            subscriptionTier: account?.subscriptionTier || authCache.userProfile.subscriptionTier,
            addOns: account?.enabledAddons || authCache.userProfile.addOns,
          },
          authCache.licenseData
        );
      }
      
      // Write server-authoritative timestamps on token refresh too
      // This ensures lastOnlineAt stays current across all active-session paths
      const recordResult = await recordOnlineViaBackend(currentUser).catch(() => null);
      if (recordResult?.lastOnlineAt) {
        await syncTimestampsAndUpdateState(recordResult.lastOnlineAt, recordResult.authPeriodStart, currentUser.uid);
      }

      setLastOnlineTimestamp(new Date().toISOString());
      setDaysOffline(0);
    } catch (error) {
      // Silent fail
    }
  };

  // Complete re-authentication: resets the 14-day auth period
  // Fail-closed: local cache is ONLY updated after confirmed server-side reset.
  // requiresReauth stays true unless backend returns confirmed new timestamps.
  const completeReauth = async (): Promise<void> => {
    const currentUser = getCurrentUser();
    if (!currentUser) {
      throw new Error('No authenticated user — cannot confirm re-auth reset.');
    }

    // Confirm reset with backend FIRST — no optimistic local updates
    const idToken = await currentUser.getIdToken();
    const resp = await fetch(`${API_BASE_URL}/api/auth/record-online`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({ resetAuthPeriod: true }),
    });

    if (!resp.ok) {
      // Server rejected — throw so requiresReauth stays true
      throw new Error(`Server rejected auth period reset: ${resp.status}`);
    }

    const data = await resp.json() as { success: boolean; lastOnlineAt: string | null; authPeriodStart: string | null };
    if (!data.success || !data.lastOnlineAt) {
      throw new Error('Server returned invalid auth period reset response.');
    }

    // Server confirmed — sync timestamps into local cache + React state, then clear gates
    await syncTimestampsAndUpdateState(data.lastOnlineAt, data.authPeriodStart, currentUser.uid);
    setRequiresReauth(false);
    setIsGracePeriod(false);
  };

  // Clear requiresPasswordChange flag after user successfully changes their password
  const clearPasswordChange = async (): Promise<void> => {
    await clearRequiresPasswordChangeInCache();
    setRequiresPasswordChange(false);
  };

  // Trigger background sync manually
  const triggerBackgroundSync = async (): Promise<void> => {
    try {
      if (!isOnline) {
        /* toast removed */
        return;
      }

      const currentUser = getCurrentUser();
      if (!currentUser) {
        /* toast removed */
        return;
      }

      /* toast removed */

      // Import the background sync service dynamically
      const { backgroundSyncService } = await import('../backgroundSync');
      
      // Perform the sync
      const success = await backgroundSyncService.performSync();

      if (success) {
        // Update local state with fresh data
        const authCache = await getAuthCache();
        if (authCache) {
          setLastOnlineTimestamp(authCache.lastOnlineTimestamp);
          setDaysOffline(0);
          setCachedUserData({
            email: authCache.email,
            profile: authCache.userProfile,
            license: authCache.licenseData,
          });
        }

        /* toast removed */
      } else {
        toast.error('Sync failed', {
          description: 'Some data could not be synced. Please try again.',
        });
      }
    } catch (error) {
      toast.error('Sync failed', {
        description: error instanceof Error ? error.message : 'An unknown error occurred',
      });
    }
  };

  const value: AuthContextType = {
    user,
    isOnline,
    isOfflineMode,
    lastOnlineTimestamp,
    daysOffline,
    cachedUserData,
    isMasterAdmin: isMasterAdmin(user?.email || cachedUserData?.email),
    requiresReauth,
    requiresPasswordChange,
    isGracePeriod,
    authPeriodStart,
    login,
    logout,
    refreshAuth,
    triggerBackgroundSync,
    completeReauth,
    clearPasswordChange,
    isLoading,
    evictionSecondsLeft,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
