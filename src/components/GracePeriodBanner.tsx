import { useState, useEffect } from 'react';
import { CheckCircle, AlertTriangle, X, Wifi } from 'lucide-react';
import { useAuth } from '@/lib/auth/AuthContext';

const GRACE_PERIOD_DAYS = 14;
const HARD_LOCKOUT_DAYS = 16;
const PRE_EXPIRY_WARNING_DAYS = 12; // show warning when 2 days remain before 14-day expiry

export const GracePeriodBanner = () => {
  const { daysOffline, isOfflineMode, isOnline } = useAuth();
  const [isDismissed, setIsDismissed] = useState(false);

  // Reset dismissed state when coming back online
  useEffect(() => {
    if (isOnline) {
      setIsDismissed(false);
    }
  }, [isOnline]);

  // Don't show if online or not in offline mode
  if (isOnline || !isOfflineMode) {
    return null;
  }

  // Days past hard lockout — nothing to show (handled by lockout screen)
  if (daysOffline >= HARD_LOCKOUT_DAYS) {
    return null;
  }

  const daysRemaining = Math.max(0, GRACE_PERIOD_DAYS - daysOffline);
  const isPreExpiryWarning = daysOffline >= PRE_EXPIRY_WARNING_DAYS && daysOffline < GRACE_PERIOD_DAYS;
  const isGraceWindow = daysOffline >= GRACE_PERIOD_DAYS && daysOffline < HARD_LOCKOUT_DAYS;
  const isEarlyOffline = daysOffline < PRE_EXPIRY_WARNING_DAYS;

  // Don't show banner in early offline stage if dismissed
  if (isDismissed && isEarlyOffline) {
    return null;
  }

  // Early offline (days 0-11): subtle green info banner
  if (isEarlyOffline) {
    return (
      <div
        data-testid="banner-grace-green"
        className="fixed top-0 left-0 right-0 z-50 bg-green-600 dark:bg-green-700 text-white px-4 py-3 shadow-lg"
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-5 h-5 flex-shrink-0" data-testid="icon-check-circle" />
            <p className="text-sm font-medium" data-testid="text-grace-message">
              Offline mode — {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'} remaining before reconnection required
            </p>
          </div>
          <button
            onClick={() => setIsDismissed(true)}
            className="p-1 hover:bg-green-700 dark:hover:bg-green-800 rounded transition-colors"
            aria-label="Dismiss banner"
            data-testid="button-dismiss-green"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
    );
  }

  // Pre-expiry warning (days 12-13): strong warning — 2 days before the 14-day limit
  if (isPreExpiryWarning) {
    return (
      <div
        data-testid="banner-grace-yellow"
        className="fixed top-0 left-0 right-0 z-50 bg-amber-500 dark:bg-amber-600 text-black dark:text-white px-4 py-3 shadow-lg"
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" data-testid="icon-alert-triangle" />
            <p className="text-sm font-semibold" data-testid="text-grace-warning">
              Reconnect soon — only {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'} remaining before offline access expires.
              Connect to the internet to reset your 14-day offline window.
            </p>
          </div>
          <Wifi className="w-5 h-5 shrink-0 ml-2" />
        </div>
      </div>
    );
  }

  // Grace window (days 14-15): red warning — in the 2-day lockout buffer
  if (isGraceWindow) {
    const graceDaysRemaining = Math.max(0, HARD_LOCKOUT_DAYS - daysOffline);
    return (
      <div
        data-testid="banner-grace-red"
        className="fixed top-0 left-0 right-0 z-50 bg-red-600 dark:bg-red-700 text-white px-4 py-3 shadow-lg"
      >
        <div className="max-w-7xl mx-auto flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" data-testid="icon-alert-triangle-red" />
          <p className="text-sm font-semibold" data-testid="text-grace-expired">
            ⚠️ Session expiring — you must reconnect within {graceDaysRemaining} {graceDaysRemaining === 1 ? 'day' : 'days'}.
            Your account remains active; this device needs to sync online.
          </p>
        </div>
      </div>
    );
  }

  return null;
};
