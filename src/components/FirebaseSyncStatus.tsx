/**
 * Firebase Sync Status Component
 * 
 * Shows current sync status and provides manual sync control.
 */

import { useState, useEffect } from 'react';
import { Cloud, CloudOff, RefreshCw, Check, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
  getConnectivityState, 
  getQueueStats, 
  syncAllPending
} from '@/lib/firebase/autoSync';
import type { ConnectivityState } from '@/lib/firebase/connectivityMonitor';

interface SyncStatusProps {
  compact?: boolean;
}

export function FirebaseSyncStatus({ compact = false }: SyncStatusProps) {
  const [connectivity, setConnectivity] = useState<ConnectivityState | null>(null);
  const [queueStats, setQueueStats] = useState<{ pending: number; failed: number } | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const updateStatus = async () => {
      try {
        setConnectivity(getConnectivityState());
        const stats = await getQueueStats();
        setQueueStats({ pending: stats.pending, failed: stats.failed });
      } catch (error) {
        console.error('[SyncStatus] Failed to get status:', error);
      }
    };

    updateStatus();

    const handleQueueUpdate = () => updateStatus();
    window.addEventListener('firebase-sync-queue-updated', handleQueueUpdate);
    window.addEventListener('connectivity-restored', handleQueueUpdate);

    return () => {
      window.removeEventListener('firebase-sync-queue-updated', handleQueueUpdate);
      window.removeEventListener('connectivity-restored', handleQueueUpdate);
    };
  }, []);

  const handleSyncNow = async () => {
    setIsSyncing(true);
    try {
      await syncAllPending();
    } finally {
      setIsSyncing(false);
      const stats = await getQueueStats();
      setQueueStats({ pending: stats.pending, failed: stats.failed });
    }
  };

  if (!connectivity) {
    return null;
  }

  const pendingCount = (queueStats?.pending || 0) + (queueStats?.failed || 0);
  const isOnline = connectivity.isOnline && connectivity.isFirebaseConnected;
  const isAuthenticated = connectivity.isAuthenticated;

  if (compact) {
    return (
      <div 
        className="flex items-center gap-1 text-xs"
        data-testid="sync-status-compact"
      >
        {isOnline ? (
          <Cloud className="w-3 h-3 text-green-500" />
        ) : (
          <CloudOff className="w-3 h-3 text-gray-400" />
        )}
        {pendingCount > 0 && (
          <span className="text-amber-500">{pendingCount}</span>
        )}
      </div>
    );
  }

  return (
    <div 
      className="flex items-center gap-2 p-2 rounded-lg bg-muted/50"
      data-testid="sync-status"
    >
      <div className="flex items-center gap-1.5">
        {isOnline ? (
          <>
            <Cloud className="w-4 h-4 text-green-500" />
            <span className="text-xs text-green-600">Connected</span>
          </>
        ) : (
          <>
            <CloudOff className="w-4 h-4 text-gray-400" />
            <span className="text-xs text-gray-500">Offline</span>
          </>
        )}
      </div>

      {pendingCount > 0 && (
        <div className="flex items-center gap-1 text-xs text-amber-600">
          <AlertTriangle className="w-3 h-3" />
          <span>{pendingCount} pending</span>
        </div>
      )}

      {pendingCount === 0 && isAuthenticated && (
        <div className="flex items-center gap-1 text-xs text-green-600">
          <Check className="w-3 h-3" />
          <span>Synced</span>
        </div>
      )}

      {isOnline && isAuthenticated && pendingCount > 0 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSyncNow}
          disabled={isSyncing}
          className="h-6 px-2 text-xs"
          data-testid="button-sync-now"
        >
          <RefreshCw className={`w-3 h-3 mr-1 ${isSyncing ? 'animate-spin' : ''}`} />
          {isSyncing ? 'Syncing...' : 'Sync Now'}
        </Button>
      )}
    </div>
  );
}

export default FirebaseSyncStatus;
