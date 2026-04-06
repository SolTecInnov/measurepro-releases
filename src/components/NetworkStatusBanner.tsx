import React, { useState, useEffect } from 'react';
import { WifiOff, Wifi, RefreshCw, LogIn } from 'lucide-react';
import { syncManager } from '../lib/sync';
import { isOnline, getCurrentUser } from '../lib/firebase';

const NetworkStatusBanner: React.FC = () => {
  const [isOffline, setIsOffline] = useState(!isOnline());
  const [showBanner, setShowBanner] = useState(false);
  const [pendingChanges, setPendingChanges] = useState(syncManager.pendingChanges);
  const [currentUser, setCurrentUser] = useState(getCurrentUser());

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      setShowBanner(true);
      // Auto-hide the online banner after 5 seconds
      setTimeout(() => {
        setShowBanner(false);
      }, 5000);
    };

    const handleOffline = () => {
      setIsOffline(true);
      setShowBanner(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check for auth state changes
    const authStateChanged = (event: CustomEvent) => {
      setCurrentUser(getCurrentUser());
    };
    
    window.addEventListener('auth-state-changed', authStateChanged as EventListener);

    // Check pending changes when network status changes
    const checkPendingChanges = () => {
      syncManager.checkPendingChanges().then(count => {
        setPendingChanges(count);
      });
    };

    window.addEventListener('online', checkPendingChanges);

    // Listen for sync status changes
    const handleSyncStatusChange = (event: CustomEvent) => {
      if (event.detail.pendingChanges !== undefined) {
        setPendingChanges(event.detail.pendingChanges);
      }
    };

    window.addEventListener('sync-status-change', handleSyncStatusChange as EventListener);

    // Initial check
    checkPendingChanges();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('auth-state-changed', authStateChanged as EventListener);
      window.removeEventListener('online', checkPendingChanges);
      window.removeEventListener('sync-status-change', handleSyncStatusChange as EventListener);
    };
  }, []);

  if (!showBanner) return null;

  return (
    <div className={`fixed top-0 left-0 right-0 z-50 p-2 ${
      isOffline ? 'bg-red-500/90' : 'bg-green-500/90'
    } text-white text-center transition-all duration-300`}>
      <div className="flex items-center justify-center gap-2">
        {isOffline ? (
          <>
            <WifiOff className="w-4 h-4" />
            <span>You are currently offline. Changes will be saved locally and synced when you reconnect.</span>
          </>
        ) : (
          <>
            <Wifi className="w-4 h-4" />
            <span>
              {!currentUser
                ? "You're back online! Sign in to sync your data."
                : pendingChanges > 0 
                ? `You're back online! ${pendingChanges} changes will be synced to the cloud.` 
                : "You're back online!"}
            </span>
            {pendingChanges > 0 && currentUser && (
              <button
                onClick={() => {
                  syncManager.startSync();
                  setShowBanner(false);
                }}
                className="ml-2 px-2 py-0.5 bg-white text-green-600 rounded text-xs font-medium"
              >
                <RefreshCw className="w-3 h-3 inline mr-1" />
                Sync Now
              </button>
            )}
            {!currentUser && (
              <button
                onClick={() => {
                  // Dispatch auth required event
                  window.dispatchEvent(new CustomEvent('auth-required', { 
                    detail: { reason: 'sync' }
                  }));
                  setShowBanner(false);
                }}
                className="ml-2 px-2 py-0.5 bg-white text-green-600 rounded text-xs font-medium"
              >
                <LogIn className="w-3 h-3 inline mr-1" />
                Sign In
              </button>
            )}
          </>
        )}
        <button
          onClick={() => setShowBanner(false)}
          className="ml-2 text-white/80 hover:text-white"
        >
          ✕
        </button>
      </div>
    </div>
  );
};

export default NetworkStatusBanner;