/**
 * Sync Status Indicator
 * Shows calibration sync status with manual controls
 */

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Cloud, CloudOff, RefreshCw, Download, Upload, 
  CheckCircle, AlertTriangle, Loader2, Wifi, WifiOff
} from 'lucide-react';
import { toast } from 'sonner';
import { saveAs } from 'file-saver';
import { calibrationSync, type SyncState, type ConflictItem } from '@/lib/calibration/sync';

interface SyncStatusIndicatorProps {
  userId?: string;
  compact?: boolean;
}

export function SyncStatusIndicator({ userId, compact = false }: SyncStatusIndicatorProps) {
  const [syncState, setSyncState] = useState<SyncState>(calibrationSync.getState());
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [conflicts, setConflicts] = useState<ConflictItem[]>([]);
  const [showConflictDialog, setShowConflictDialog] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (userId) {
      calibrationSync.initialize(userId).catch(console.warn);
    }

    const unsubscribe = calibrationSync.subscribe(setSyncState);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
    }

    return () => {
      unsubscribe();
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      }
    };
  }, [userId]);

  useEffect(() => {
    if (syncState.conflictCount > 0 && isOnline) {
      calibrationSync.getConflicts().then(setConflicts).catch(console.warn);
    }
  }, [syncState.conflictCount, isOnline]);

  const handleSyncNow = async () => {
    if (!isOnline) {
      toast.error('Cannot sync while offline');
      return;
    }

    const result = await calibrationSync.syncNow();
    if (result.success) {
      /* toast removed */
      if (result.conflicts.length > 0) {
        setConflicts(result.conflicts);
        setShowConflictDialog(true);
      }
    } else {
      toast.error('Sync failed - will retry when online');
    }
  };

  const handleExport = async () => {
    try {
      const json = await calibrationSync.exportAllCalibrationsAsync();
      const blob = new Blob([json], { type: 'application/json' });
      saveAs(blob, `calibrations-export-${Date.now()}.json`);
      // toast suppressed
    } catch (e) {
      toast.error('Export failed');
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const result = await calibrationSync.importCalibrations(text);
      
      if (result.errors.length > 0) {
        toast.error(`Imported with ${result.errors.length} error(s)`);
      } else {
        /* toast removed */
      }
    } catch (e) {
      toast.error('Import failed - invalid file');
    }

    e.target.value = '';
  };

  const handleResolveConflict = async (conflict: ConflictItem, resolution: 'keep_local' | 'keep_remote') => {
    await calibrationSync.resolveConflict(conflict.type, conflict.local.id, resolution);
    setConflicts(prev => prev.filter(c => c.local.id !== conflict.local.id));
    // toast suppressed
    
    if (conflicts.length <= 1) {
      setShowConflictDialog(false);
    }
  };

  const getStatusIcon = () => {
    if (!isOnline) return <WifiOff className="w-4 h-4 text-gray-400" />;
    
    switch (syncState.status) {
      case 'syncing':
        return <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />;
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'error':
        return <AlertTriangle className="w-4 h-4 text-yellow-400" />;
      case 'offline':
        return <CloudOff className="w-4 h-4 text-gray-400" />;
      default:
        return <Cloud className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusBadge = () => {
    if (!isOnline) {
      return <Badge variant="outline" className="text-xs"><WifiOff className="w-3 h-3 mr-1" />Offline</Badge>;
    }
    
    if (syncState.pendingCount > 0) {
      return (
        <Badge className="bg-yellow-600 text-white text-xs">
          {syncState.pendingCount} pending
        </Badge>
      );
    }
    
    if (syncState.conflictCount > 0) {
      return (
        <Badge className="bg-red-600 text-white text-xs">
          {syncState.conflictCount} conflict(s)
        </Badge>
      );
    }
    
    if (syncState.status === 'success') {
      return <Badge className="bg-green-600 text-white text-xs">Synced</Badge>;
    }
    
    return <Badge variant="outline" className="text-xs">Ready</Badge>;
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2" data-testid="indicator-sync-status-compact">
        {getStatusIcon()}
        {getStatusBadge()}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSyncNow}
          disabled={!isOnline || syncState.status === 'syncing'}
          className="h-6 px-2"
          data-testid="button-sync-compact"
        >
          <RefreshCw className={`w-3 h-3 ${syncState.status === 'syncing' ? 'animate-spin' : ''}`} />
        </Button>
      </div>
    );
  }

  return (
    <>
      <Card className="bg-gray-800/50 border-gray-700" data-testid="card-sync-status">
        <CardHeader className="py-3">
          <CardTitle className="text-sm flex items-center justify-between">
            <div className="flex items-center gap-2">
              {getStatusIcon()}
              <span>Calibration Sync</span>
              {getStatusBadge()}
            </div>
            <div className="flex items-center gap-1">
              {isOnline ? (
                <Wifi className="w-4 h-4 text-green-400" />
              ) : (
                <WifiOff className="w-4 h-4 text-gray-400" />
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="py-2 space-y-3">
          <div className="text-sm text-gray-400 space-y-1">
            {syncState.lastSync && (
              <div>Last sync: {new Date(syncState.lastSync).toLocaleString()}</div>
            )}
            {syncState.errorMessage && (
              <div className="text-yellow-400">{syncState.errorMessage}</div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSyncNow}
              disabled={!isOnline || syncState.status === 'syncing'}
              data-testid="button-sync-now"
            >
              <RefreshCw className={`w-4 h-4 mr-1 ${syncState.status === 'syncing' ? 'animate-spin' : ''}`} />
              Sync Now
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              data-testid="button-export-calibrations-json"
            >
              <Download className="w-4 h-4 mr-1" />
              Export JSON
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={handleImportClick}
              data-testid="button-import-calibrations-json"
            >
              <Upload className="w-4 h-4 mr-1" />
              Import JSON
            </Button>
            
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleImportFile}
              className="hidden"
              data-testid="input-import-file"
            />
          </div>

          {!isOnline && (
            <div className="text-xs text-gray-500 bg-gray-900/50 p-2 rounded">
              Working offline. Changes saved locally and will sync when online.
            </div>
          )}
        </CardContent>
      </Card>

      {showConflictDialog && conflicts.length > 0 && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" data-testid="dialog-conflict-resolution">
          <Card className="w-full max-w-lg bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-yellow-400" />
                Resolve Sync Conflicts
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {conflicts.map((conflict, i) => (
                <div key={i} className="p-3 bg-gray-900 rounded border border-gray-700 space-y-2">
                  <div className="font-medium capitalize">{conflict.type} Calibration</div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <div className="text-gray-400 mb-1">Local (this device)</div>
                      <div>Updated: {new Date(conflict.local.updatedAt || '').toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-gray-400 mb-1">Remote (cloud)</div>
                      <div>Updated: {new Date(conflict.remote.updatedAt || '').toLocaleString()}</div>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleResolveConflict(conflict, 'keep_local')}
                      data-testid={`button-keep-local-${i}`}
                    >
                      Keep Local
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleResolveConflict(conflict, 'keep_remote')}
                      data-testid={`button-keep-remote-${i}`}
                    >
                      Keep Remote
                    </Button>
                  </div>
                </div>
              ))}
              
              <Button
                variant="ghost"
                className="w-full"
                onClick={() => setShowConflictDialog(false)}
                data-testid="button-close-conflicts"
              >
                Close
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
