import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, Database, RefreshCw, Trash2, LogIn, Smartphone } from 'lucide-react';
import { syncManager } from '../lib/sync';
import { syncAllPending, getQueueStats } from '../lib/firebase/autoSync';
import { isOnline, getCurrentUser, initAuthListener } from '../lib/firebase';
import { toast } from 'sonner';

interface OfflineStatusIndicatorProps {
  className?: string;
}

const OfflineStatusIndicator: React.FC<OfflineStatusIndicatorProps> = ({ className = '' }) => {
  const [isOffline, setIsOffline] = useState(!isOnline());
  const [pendingChanges, setPendingChanges] = useState(syncManager.pendingChanges);
  const [currentUser, setCurrentUser] = useState(getCurrentUser());
  const [syncResults, setSyncResults] = useState<{syncedItems: number, totalItems: number} | null>(null);
  const [showControls, setShowControls] = useState(false);
  const [clearConfirm, setClearConfirm] = useState(false);
  const [slaveAppMeasurements, setSlaveAppMeasurements] = useState<any[]>([]);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    
    // Set up auth state listener
    const unsubscribe = initAuthListener((user: any) => {
      setCurrentUser(user);
    });

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check for auth state changes
    const authStateChanged = (_event: CustomEvent) => {
      setCurrentUser(getCurrentUser());
    };
    
    window.addEventListener('auth-state-changed', authStateChanged as EventListener);

    // Listen for sync status changes
    const handleSyncStatusChange = (event: CustomEvent) => {
      const { pendingChanges, syncedItems, totalItems } = event.detail;
      
      // Store sync results if available
      if (syncedItems !== undefined && totalItems !== undefined) {
        setSyncResults({
          syncedItems,
          totalItems
        });
      }
      
      if (pendingChanges !== undefined) {
        setPendingChanges(event.detail.pendingChanges);
      }
    };
    
    // Listen for real-time sync progress (from queue-based sync)
    const handleSyncProgress = (event: CustomEvent) => {
      const { syncedItems, totalItems } = event.detail;
      if (syncedItems !== undefined && totalItems !== undefined) {
        setSyncResults({ syncedItems, totalItems });
      }
    };

    window.addEventListener('sync-status-change', handleSyncStatusChange as EventListener);
    window.addEventListener('sync-progress', handleSyncProgress as EventListener);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubscribe();
      window.removeEventListener('auth-state-changed', authStateChanged as EventListener);
      window.removeEventListener('sync-status-change', handleSyncStatusChange as EventListener);
      window.removeEventListener('sync-progress', handleSyncProgress as EventListener);
    };
  }, []);
  
  // Check for slave app measurements
  useEffect(() => {
    const checkSlaveAppMeasurements = () => {
      const measurementsJson = localStorage.getItem('slaveApp_measurements');
      if (measurementsJson) {
        try {
          const measurements = JSON.parse(measurementsJson);
          setSlaveAppMeasurements(measurements);
        } catch (error) {
          setSlaveAppMeasurements([]);
        }
      } else {
        setSlaveAppMeasurements([]);
      }
    };
    
    // Check on mount
    checkSlaveAppMeasurements();
    
    // Listen for sync events from slave app
    const handleSlaveAppSync = () => {
      checkSlaveAppMeasurements();
    };
    
    window.addEventListener('slaveApp_sync_complete', handleSlaveAppSync);
    
    return () => {
      window.removeEventListener('slaveApp_sync_complete', handleSlaveAppSync);
    };
  }, []);

  const [isSyncing, setIsSyncing] = useState(false);

  const handleSyncNow = async () => {
    if (isOffline) {
      toast.error('Cannot sync while offline', {
        description: 'Please check your internet connection and try again'
      });
      return;
    }

    // Check if user is signed in
    if (!currentUser) {
      // Dispatch auth required event
      window.dispatchEvent(new CustomEvent('auth-required', { 
        detail: { reason: 'sync' }
      }));
      setShowControls(false);
      return;
    }

    // Use the queue-based sync with proper throttling
    setIsSyncing(true);
    toast.loading('Syncing to cloud...', { id: 'manual-sync' });
    
    try {
      const success = await syncAllPending();
      
      if (success) {
        toast.success('Sync completed', { id: 'manual-sync' });
      } else {
        toast.warning('Sync partially completed', { 
          id: 'manual-sync',
          description: 'Some items may still need syncing'
        });
      }
      
      // Refresh pending count
      const stats = await getQueueStats();
      const queuePending = stats.pending + stats.failed;
      
      // Also check legacy pending count
      const legacyCount = await syncManager.checkPendingChanges();
      setPendingChanges(Math.max(queuePending, legacyCount));
      
    } catch (error: any) {
      console.error('[Sync] Manual sync error:', error);
      toast.error('Sync failed', { 
        id: 'manual-sync',
        description: error.message || 'Please try again'
      });
    } finally {
      setIsSyncing(false);
    }
    
    setShowControls(false);
  };

  const handleClearCache = async () => {
    if (!clearConfirm) {
      setClearConfirm(true);
      return;
    }

    try {
      // Clear IndexedDB
      const dbs = await window.indexedDB.databases();
      for (const db of dbs) {
        if (db.name) {
          window.indexedDB.deleteDatabase(db.name);
        }
      }

      // Clear localStorage but preserve user preferences
      const userPreferences = {
        layout_config: localStorage.getItem('layout_config'),
        layout_version: localStorage.getItem('layout_version'),
        poi_action_config: localStorage.getItem('poi_action_config'),
        left_column_width: localStorage.getItem('left_column_width'),
        soundConfigVersion: localStorage.getItem('soundConfigVersion'),
        soundConfig: localStorage.getItem('soundConfig')
      };
      
      localStorage.clear();
      
      // Restore user preferences
      Object.entries(userPreferences).forEach(([key, value]) => {
        if (value !== null) {
          localStorage.setItem(key, value);
        }
      });

      // Clear caches
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
      }

      toast.success('Cache cleared successfully', {
        description: 'All local data has been removed. The page will now reload.'
      });

      // Reload the page after a short delay
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error: any) {
      toast.error('Failed to clear cache', {
        description: error.message
      });
    } finally {
      setClearConfirm(false);
      setShowControls(false);
    }
  };

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setShowControls(!showControls)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm ${
          isOffline 
            ? 'bg-red-500/20 text-red-400' 
            : pendingChanges > 0 
              ? 'bg-yellow-500/20 text-yellow-400' 
              : 'bg-green-500/20 text-green-400'
        }`}
      >
        {isOffline ? (
          <WifiOff className="w-4 h-4" />
        ) : (
          currentUser ? <Wifi className="w-4 h-4" /> : <LogIn className="w-4 h-4" />
        )}
        <span>
          {isOffline 
            ? 'Offline' 
            : !currentUser
              ? 'Sign in to sync'
              : pendingChanges > 0 || slaveAppMeasurements.length > 0
                ? syncResults 
                  ? `${syncResults.syncedItems}/${syncResults.totalItems} synced` 
                  : `${pendingChanges + slaveAppMeasurements.length} pending`
                : 'Synced'}
        </span>
        {slaveAppMeasurements.length > 0 ? (
          <Smartphone className="w-4 h-4 text-purple-400" />
        ) : (
          <Database className="w-4 h-4" />
        )}
      </button>

      {showControls && (
        <div className="absolute right-0 mt-2 w-64 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-50">
          <div className="p-3 border-b border-gray-700">
            <h3 className="font-medium">Offline Status</h3>
            <p className="text-sm text-gray-400 mt-1">
              {!currentUser
                ? 'Sign in to enable cloud synchronization. Your data is still saved locally.'
                : isOffline 
                ? 'You are currently offline. Changes will be saved locally and synced when you reconnect.' 
                : pendingChanges > 0 
                  ? `You have ${pendingChanges} changes that need to be synced to the cloud.` 
                  : slaveAppMeasurements.length > 0
                    ? `You have ${slaveAppMeasurements.length} measurements from the slave app that need to be imported.`
                    : 'All data is synced with the cloud.'}
            </p>
          </div>
          
          {slaveAppMeasurements.length > 0 && (
            <div className="p-3 border-b border-gray-700">
              <div className="flex items-center justify-between">
                <h3 className="font-medium flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-purple-400" />
                  Slave App Data
                </h3>
                <span className="bg-purple-500/20 text-purple-400 text-xs px-2 py-0.5 rounded-full">
                  {slaveAppMeasurements.length} items
                </span>
              </div>
              <button
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('import_slave_app_measurements'));
                  setShowControls(false);
                }}
                className="w-full mt-2 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm bg-purple-600 hover:bg-purple-700 text-white"
              >
                <RefreshCw className="w-4 h-4" />
                Import Slave App Data
              </button>
            </div>
          )}
          
          <div className="p-3 space-y-2">
            <button
              onClick={handleSyncNow}
              disabled={isOffline || pendingChanges === 0 || isSyncing || !currentUser}
              className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm ${
                isOffline || pendingChanges === 0 || isSyncing || !currentUser
                  ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Syncing...' : 'Sync Now'}
            </button>
            <button
              onClick={handleClearCache}
              className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm ${
                clearConfirm
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : 'bg-gray-700 hover:bg-gray-600 text-white'
              }`}
            >
              <Trash2 className="w-4 h-4" />
              {clearConfirm ? 'Confirm Clear Cache' : 'Clear Local Cache'}
            </button>
            {clearConfirm && (
              <p className="text-xs text-red-400 mt-1">
                Warning: This will delete all local data. This action cannot be undone.
              </p>
            )}
          </div>
          <div className="p-3 border-t border-gray-700 text-xs text-gray-400">
            <p>Last sync: {syncManager.lastSyncTime ? syncManager.lastSyncTime.toLocaleString() : 'Never'}</p>
            {!currentUser && (
              <p className="mt-1 text-yellow-400">
                Sign in through the Sync tab to enable cloud synchronization
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default OfflineStatusIndicator;