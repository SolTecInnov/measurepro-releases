import { useEffect, useState } from 'react';
import { XCircle, RefreshCw, Wifi } from 'lucide-react';
import { useAuth } from '@/lib/auth/AuthContext';

export const GracePeriodLockout = () => {
  const { daysOffline, isOfflineMode, isOnline, refreshAuth, isMasterAdmin, lastOnlineTimestamp } = useAuth();
  const [isChecking, setIsChecking] = useState(false);

  // Hard lockout threshold: 16 days offline (days 14-16 are grace/re-auth prompt period)
  const HARD_LOCKOUT_DAYS = 16;

  // Automatically unlock when internet is detected — no full reload.
  // refreshAuth() updates the AuthContext state in-place so the lockout screen
  // disappears without disrupting any in-progress surveys or unsaved data.
  useEffect(() => {
    if (isOnline && isOfflineMode && daysOffline >= HARD_LOCKOUT_DAYS) {
      refreshAuth();
    }
  }, [isOnline, isOfflineMode, daysOffline, refreshAuth]);

  // Master admin bypasses grace period lockout (AFTER all hooks)
  if (isMasterAdmin) {
    return null;
  }

  // Only show hard lockout if offline mode AND days >= 16 (days 14-16 show re-auth prompt, not lockout)
  if (!isOfflineMode || daysOffline < HARD_LOCKOUT_DAYS) {
    return null;
  }

  const handleRetry = async () => {
    setIsChecking(true);
    // Verify connectivity with a lightweight ping — no full page reload so
    // in-progress surveys and unsaved data are preserved.
    try {
      await fetch('/ping', { method: 'HEAD', cache: 'no-cache' });
      // Ping succeeded — refresh auth state in-place (no reload)
      await refreshAuth();
      // refreshAuth triggers AuthContext state update; if daysOffline drops below
      // HARD_LOCKOUT_DAYS the lockout UI will unmount automatically.
    } catch {
      // Still offline — nothing to do, user can try again
    } finally {
      setTimeout(() => setIsChecking(false), 1500);
    }
  };

  return (
    <div
      data-testid="modal-grace-lockout"
      className="fixed inset-0 z-[9999] bg-gray-900 dark:bg-black flex items-center justify-center p-4"
    >
      <div className="max-w-md w-full">
        {/* Red Banner */}
        <div
          data-testid="banner-grace-red"
          className="bg-red-600 dark:bg-red-700 text-white px-6 py-4 rounded-t-lg shadow-2xl"
        >
          <div className="flex items-center gap-3">
            <XCircle 
              className="w-6 h-6 flex-shrink-0" 
              data-testid="icon-x-circle"
            />
            <h2 className="text-lg font-bold" data-testid="text-lockout-title">
              🔴 Offline Access Expired
            </h2>
          </div>
        </div>

        {/* Content Card */}
        <div className="bg-white dark:bg-gray-800 px-6 py-8 rounded-b-lg shadow-2xl">
          <div className="text-center space-y-6">
            {/* Icon */}
            <div className="flex justify-center">
              <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
                <Wifi className="w-8 h-8 text-red-600 dark:text-red-400" />
              </div>
            </div>

            {/* Message */}
            <div className="space-y-2">
              <p 
                className="text-gray-900 dark:text-white font-medium"
                data-testid="text-lockout-message"
              >
                You must connect to the internet to continue.
              </p>
              <p 
                className="text-sm text-gray-600 dark:text-gray-400"
                data-testid="text-lockout-details"
              >
                You have been offline for {daysOffline} days. Please reconnect to restore access to the application.
              </p>
              {lastOnlineTimestamp && (
                <p
                  className="text-sm text-gray-500 dark:text-gray-500"
                  data-testid="text-last-online-date"
                >
                  Last verified online:{' '}
                  <span className="text-gray-700 dark:text-gray-300 font-medium">
                    {new Date(lastOnlineTimestamp).toLocaleString(undefined, {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </span>
                </p>
              )}
            </div>

            {/* Retry Button */}
            <button
              onClick={handleRetry}
              disabled={isChecking}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 dark:bg-blue-700 dark:hover:bg-blue-600 dark:disabled:bg-gray-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2"
              data-testid="button-retry-connection"
            >
              <RefreshCw className={`w-5 h-5 ${isChecking ? 'animate-spin' : ''}`} />
              {isChecking ? 'Checking connection...' : 'Try connecting now'}
            </button>

            {/* Help Text */}
            <p 
              className="text-xs text-gray-500 dark:text-gray-500"
              data-testid="text-lockout-help"
            >
              Once you're connected to the internet, click "Retry Connection" to unlock the app.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
