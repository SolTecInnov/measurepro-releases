/**
 * SyncControls — Firebase / cloud sync status panel
 *
 * Streamlined for the 10" tablet form factor:
 *   - ONE Sync Now button (was 3)
 *   - Single status row (online/offline + pending + last sync)
 *   - Import from Cloud + Clear Local Data as primary actions
 *   - No auth surface — sign-in happens at app launch and Log Out lives in
 *     the Tools menu (AppHeader)
 *   - No "Test Offline Mode" developer toggle
 *   - No marketing "Offline Capabilities" card
 *   - No 15-second polling — purely event-driven via 'sync-status-change'
 */

import React, { useState, useEffect } from 'react';
import { Cloud, RefreshCw, Trash2, Wifi, WifiOff, Check, AlertTriangle, Download } from 'lucide-react';
import { syncManager } from '../lib/sync';
import { isOnline, getCurrentUser, importSurveysFromFirebase } from '../lib/firebase';
import { toast } from 'sonner';

const SyncControls: React.FC = () => {
  const [networkStatus, setNetworkStatus] = useState<'online' | 'offline'>(isOnline() ? 'online' : 'offline');
  const [pendingChanges, setPendingChanges] = useState(syncManager.pendingChanges);
  const [syncStatus, setSyncStatus] = useState(syncManager.status);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(syncManager.lastSyncTime);
  const [clearConfirm, setClearConfirm] = useState(false);
  const [importing, setImporting] = useState(false);

  const currentUser = getCurrentUser();

  useEffect(() => {
    const handleOnline = () => setNetworkStatus('online');
    const handleOffline = () => setNetworkStatus('offline');
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Event-driven only — no setInterval polling.
    const handleSyncStatusChange = (event: Event) => {
      const e = event as CustomEvent;
      const { status, pendingChanges: pending, lastSyncTime: ts } = e.detail || {};
      if (status) setSyncStatus(status);
      if (pending !== undefined) setPendingChanges(pending);
      if (ts) setLastSyncTime(new Date(ts));
    };
    window.addEventListener('sync-status-change', handleSyncStatusChange as EventListener);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('sync-status-change', handleSyncStatusChange as EventListener);
    };
  }, []);

  const handleSyncNow = () => {
    if (networkStatus === 'offline') {
      toast.error('Cannot sync while offline', {
        description: 'Please check your internet connection and try again.'
      });
      return;
    }
    if (!currentUser) {
      toast.error('Please sign in to sync', {
        description: 'Use the Log Out item in the Tools menu and sign back in.'
      });
      return;
    }
    syncManager.startSync();
  };

  const handleImportFromCloud = async () => {
    setImporting(true);
    try {
      const surveys = await importSurveysFromFirebase();
      console.log('[SyncControls] Import complete, surveys:', surveys.length);
      window.dispatchEvent(new CustomEvent('surveys-imported'));
    } catch (error) {
      console.error('[SyncControls] Import error:', error);
      toast.error('Failed to import surveys from cloud');
    } finally {
      setImporting(false);
    }
  };

  const handleClearCache = async () => {
    if (!clearConfirm) {
      setClearConfirm(true);
      return;
    }
    try {
      const dbs = await window.indexedDB.databases();
      for (const db of dbs) {
        if (db.name) {
          window.indexedDB.deleteDatabase(db.name);
        }
      }

      // Preserve user preferences across the wipe
      const userPreferences = {
        layout_config: localStorage.getItem('layout_config'),
        layout_version: localStorage.getItem('layout_version'),
        poi_action_config: localStorage.getItem('poi_action_config'),
        left_column_width: localStorage.getItem('left_column_width'),
        soundConfigVersion: localStorage.getItem('soundConfigVersion'),
        soundConfig: localStorage.getItem('soundConfig')
      };
      localStorage.clear();
      Object.entries(userPreferences).forEach(([key, value]) => {
        if (value !== null) localStorage.setItem(key, value);
      });

      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
      }

      setTimeout(() => window.location.reload(), 1500);
    } catch (error: any) {
      toast.error('Failed to clear cache', { description: error.message });
    } finally {
      setClearConfirm(false);
    }
  };

  const isSyncing = syncStatus === 'syncing';
  const canSync = networkStatus === 'online' && !isSyncing && !!currentUser;

  return (
    <div className="bg-gray-800 rounded-xl p-4">
      <h2 className="text-lg font-semibold flex items-center gap-2 mb-3">
        <Cloud className="w-5 h-5 text-blue-400" />
        Cloud Sync
      </h2>

      {/* Compact status row: connection · pending · last sync · sync now */}
      <div className="bg-gray-900 rounded-lg p-3 mb-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <div className="flex items-center gap-1.5">
            {networkStatus === 'online' ? (
              <>
                <Wifi className="w-4 h-4 text-green-400" />
                <span className="text-green-400">Online</span>
              </>
            ) : (
              <>
                <WifiOff className="w-4 h-4 text-red-400" />
                <span className="text-red-400">Offline</span>
              </>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {pendingChanges > 0 ? (
              <>
                <AlertTriangle className="w-4 h-4 text-yellow-400" />
                <span className="text-yellow-400">{pendingChanges} pending</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4 text-green-400" />
                <span className="text-green-400">All synced</span>
              </>
            )}
          </div>

          <div className="text-gray-400 text-xs">
            Last sync: <span className="font-mono">{lastSyncTime ? lastSyncTime.toLocaleString() : 'Never'}</span>
          </div>

          <button
            onClick={handleSyncNow}
            disabled={!canSync || pendingChanges === 0}
            className={`ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded text-sm ${
              canSync && pendingChanges > 0
                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                : 'bg-gray-700 text-gray-500 cursor-not-allowed'
            }`}
            data-testid="button-sync-now"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Syncing…' : 'Sync now'}
          </button>
        </div>
      </div>

      {/* Secondary actions: Import from cloud · Clear local data */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <button
          onClick={handleImportFromCloud}
          disabled={importing || networkStatus === 'offline' || !currentUser}
          className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm bg-gray-700 hover:bg-gray-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
          data-testid="button-import-from-cloud"
        >
          <Download className={`w-4 h-4 ${importing ? 'animate-pulse' : ''}`} />
          {importing ? 'Importing…' : 'Import from cloud'}
        </button>

        <button
          onClick={handleClearCache}
          className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm ${
            clearConfirm
              ? 'bg-red-600 hover:bg-red-700 text-white'
              : 'bg-gray-700 hover:bg-gray-600 text-white'
          }`}
          data-testid="button-clear-cache"
        >
          <Trash2 className="w-4 h-4" />
          {clearConfirm ? 'Tap again to confirm' : 'Clear local data'}
        </button>
      </div>

      {clearConfirm && (
        <p className="text-xs text-red-400 mt-2">
          Warning: this deletes all locally stored surveys. Cannot be undone.
        </p>
      )}
    </div>
  );
};

export default SyncControls;
