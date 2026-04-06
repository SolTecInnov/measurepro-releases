import { Shield, Loader2, Eye, EyeOff, WifiOff, Lock } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../lib/auth/AuthContext';
import { EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { getCurrentUser } from '../lib/firebase';

const REAUTH_REQUIRED_DAYS = 14;
const REAUTH_GRACE_DAYS = 2;
const REAUTH_HARD_LOCKOUT_DAYS = REAUTH_REQUIRED_DAYS + REAUTH_GRACE_DAYS; // 16

function getDaysSinceAuthPeriod(authPeriodStart: string | null): number {
  if (!authPeriodStart) return 0;
  const start = new Date(authPeriodStart).getTime();
  if (isNaN(start)) return 0;
  const now = Date.now();
  return Math.floor((now - start) / (1000 * 60 * 60 * 24));
}

export function ReauthModal() {
  const { requiresReauth, completeReauth, logout, cachedUserData, isOnline, isGracePeriod, authPeriodStart } = useAuth();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState('');

  if (!requiresReauth) return null;

  const userEmail = cachedUserData?.email || '';

  // Compute days on the authPeriodStart timeline (server-authoritative 14-day clock)
  const daysSinceAuthPeriod = getDaysSinceAuthPeriod(authPeriodStart);
  const daysUntilLockout = Math.max(0, REAUTH_HARD_LOCKOUT_DAYS - daysSinceAuthPeriod);

  // Grace period (days 14–16): non-dismissible warning banner; app remains navigable
  const isOfflineGracePeriod = isGracePeriod && !isOnline && daysSinceAuthPeriod < REAUTH_HARD_LOCKOUT_DAYS;
  // Hard lockout (day 16+): full blocking modal — sign-out only
  const isHardLockout = !isOnline && daysSinceAuthPeriod >= REAUTH_HARD_LOCKOUT_DAYS;

  if (isOfflineGracePeriod) {
    return (
      <>
        <div
          className="fixed top-0 left-0 right-0 z-[9990] bg-amber-600 text-white px-4 py-3 flex items-center gap-3 shadow-lg"
          data-testid="banner-offline-grace"
        >
          <WifiOff className="w-5 h-5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="font-medium text-sm">Re-authentication required when online. </span>
            <span className="text-sm text-amber-100">
              Day {daysSinceAuthPeriod} since last re-auth — read-only access.{' '}
              {daysUntilLockout > 0
                ? `Connect within ${daysUntilLockout} day(s) to restore full access.`
                : 'Access will be locked on reconnect.'}
            </span>
          </div>
        </div>
        <div
          className="fixed top-[52px] left-0 right-0 z-[9970] flex justify-center pointer-events-none"
          data-testid="label-read-only-grace"
          aria-live="polite"
        >
          <span className="mt-2 px-3 py-1 rounded-full bg-amber-800/80 text-amber-200 text-xs font-medium shadow">
            Read-only mode — reconnect to re-authenticate
          </span>
        </div>
      </>
    );
  }

  if (isHardLockout) {
    return (
      <div
        className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4"
        data-testid="modal-hard-lockout"
      >
        <div className="w-full max-w-md bg-gray-900 border border-red-700 rounded-2xl shadow-2xl p-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-red-500/20 rounded-full mb-4">
            <Lock className="w-8 h-8 text-red-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Access Locked</h2>
          <p className="text-gray-400 text-sm mb-6">
            Re-authentication has been required for {daysSinceAuthPeriod} days (14-day limit + {REAUTH_GRACE_DAYS}-day grace exceeded).
            Connect to the internet and sign in to restore access.
          </p>
          <button
            onClick={logout}
            className="w-full py-3 bg-red-700 hover:bg-red-800 text-white font-semibold rounded-lg transition-colors"
            data-testid="button-lockout-logout"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!password) {
      setError('Please enter your password.');
      return;
    }

    setIsVerifying(true);
    try {
      const firebaseUser = getCurrentUser();
      if (!firebaseUser || !firebaseUser.email) {
        throw new Error('Not authenticated. Please log out and log back in.');
      }

      const credential = EmailAuthProvider.credential(firebaseUser.email, password);
      await reauthenticateWithCredential(firebaseUser, credential);

      await completeReauth();
    } catch (err: any) {
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError('Incorrect password. Please try again.');
      } else if (err.code === 'auth/too-many-requests') {
        setError('Too many failed attempts. Please try again later.');
      } else if (err.code === 'auth/network-request-failed') {
        setError('No internet connection. Please connect and try again.');
      } else {
        setError(err.message || 'Verification failed. Please try again.');
      }
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      data-testid="modal-reauth"
    >
      <div className="w-full max-w-md bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl p-8">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-500/20 rounded-full mb-4">
            <Shield className="w-8 h-8 text-blue-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Re-authentication Required</h2>
          <p className="text-gray-400 text-sm">
            For your security, please confirm your password to continue. This is required every {REAUTH_REQUIRED_DAYS} days.
          </p>
          {userEmail && (
            <p className="text-blue-400 text-sm mt-2 font-medium">{userEmail}</p>
          )}
        </div>

        <form onSubmit={handleVerify} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full pr-11 pl-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={isVerifying}
                autoFocus
                data-testid="input-reauth-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200"
                data-testid="button-toggle-pw-visibility"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-red-400 text-sm" data-testid="text-reauth-error">{error}</p>
          )}

          <button
            type="submit"
            disabled={isVerifying || !password}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
            data-testid="button-confirm-reauth"
          >
            {isVerifying ? (
              <><Loader2 className="w-5 h-5 animate-spin" />Verifying...</>
            ) : 'Confirm Identity'}
          </button>

          <button
            type="button"
            onClick={logout}
            className="w-full py-2 text-sm text-gray-500 hover:text-gray-300 transition-colors"
            data-testid="button-reauth-logout"
          >
            Sign out instead
          </button>
        </form>
      </div>
    </div>
  );
}
