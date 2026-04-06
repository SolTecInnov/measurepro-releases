import { useAuth } from '@/lib/auth/AuthContext';
import { AlertTriangle, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Non-blocking banner shown when a concurrent login is detected on another device.
 * The user has 60 seconds before they are automatically signed out.
 * During the countdown they can keep working or sign out immediately.
 */
export function SessionEvictionBanner() {
  const { evictionSecondsLeft, logout } = useAuth();

  if (evictionSecondsLeft === null) return null;

  return (
    <div
      data-testid="session-eviction-banner"
      className="fixed bottom-0 left-0 right-0 z-[9999] bg-yellow-600 dark:bg-yellow-700 text-white px-4 py-3 shadow-lg"
    >
      <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <AlertTriangle className="h-5 w-5 flex-shrink-0" />
          <p className="text-sm font-medium">
            Your account was signed in on another device. You will be signed out in{' '}
            <span
              data-testid="eviction-countdown"
              className={`font-bold tabular-nums ${evictionSecondsLeft <= 10 ? 'text-red-200' : ''}`}
            >
              {evictionSecondsLeft}s
            </span>
            . Save your work now.
          </p>
        </div>

        <Button
          data-testid="eviction-logout-now"
          variant="outline"
          size="sm"
          className="flex-shrink-0 bg-white/10 border-white/30 text-white hover:bg-white/20 hover:text-white"
          onClick={() => logout()}
        >
          <LogOut className="h-4 w-4 mr-1.5" />
          Sign out now
        </Button>
      </div>
    </div>
  );
}
