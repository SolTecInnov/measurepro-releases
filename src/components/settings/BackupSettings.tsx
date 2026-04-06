import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { Download, Database, Clock, HardDrive, AlertCircle, Upload, Info, Shield, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { createCompleteBackup, BackupProgress } from '@/lib/backup/BackupManager';
import { restoreBackup, RestoreProgress } from '@/lib/backup/RestoreManager';
import { checkStorageHealth } from '@/lib/utils/storageManager';
import { APP_VERSION } from '@/lib/version';
import { 
  exportFullDatabaseBackup, 
  restoreFullDatabaseBackup, 
  getIndexedDBStats 
} from '@/lib/utils/exportUtils';
import { getMigrationStatus, runMigrationWithUI } from '@/lib/storage/assetMigration';

interface BackupHistoryEntry {
  timestamp: string;
  size: number;
  dataCounts: {
    surveys: number;
    measurements: number;
    videos: number;
    timelapses: number;
    pointClouds: number;
    voiceNotes: number;
  };
}

export default function BackupSettings() {
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState<BackupProgress | null>(null);
  const [lastBackup, setLastBackup] = useState<string | null>(null);
  const [backupHistory, setBackupHistory] = useState<BackupHistoryEntry[]>([]);
  const [storageHealth, setStorageHealth] = useState<any>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreProgress, setRestoreProgress] = useState<RestoreProgress | null>(null);
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fullBackupInputRef = useRef<HTMLInputElement>(null);
  const [isFullBackupRunning, setIsFullBackupRunning] = useState(false);
  const [isFullRestoreRunning, setIsFullRestoreRunning] = useState(false);
  const [dbStats, setDbStats] = useState<{
    origin: string;
    hostname: string;
    surveys: number;
    measurements: number;
    traces: number;
    alerts: number;
    profiles: number;
    estimatedSizeMB: number;
  } | null>(null);
  const [migrationStatus, setMigrationStatus] = useState<{
    needsMigration: boolean;
    measurementsWithBase64: number;
    estimatedSavings: number;
  } | null>(null);
  const [isMigrating, setIsMigrating] = useState(false);

  useEffect(() => {
    // Load last backup timestamp from localStorage
    const last = localStorage.getItem('measurepro_last_backup');
    setLastBackup(last);

    // Load backup history
    const history = localStorage.getItem('measurepro_backup_history');
    if (history) {
      try {
        setBackupHistory(JSON.parse(history));
      } catch (e) {
      }
    }

    // Check storage health
    checkStorageHealth().then(health => {
      setStorageHealth(health);
    });

    // Load auto-backup preference
    const autoBackupPref = localStorage.getItem('measurepro_auto_backup_enabled') === 'true';
    setAutoBackupEnabled(autoBackupPref);

    // Check for version change and prompt backup
    checkVersionChange();

    // Check for auto-backup timer
    checkAutoBackupTimer();
    
    // Check migration status
    getMigrationStatus().then(status => {
      setMigrationStatus(status);
    });
  }, []);

  const checkVersionChange = () => {
    const storedVersion = localStorage.getItem('measurepro_app_version');
    
    if (storedVersion && storedVersion !== APP_VERSION) {
      toast.info('App Version Updated', {
        description: `Updated from v${storedVersion} to v${APP_VERSION}. Consider creating a backup before using new features.`,
        duration: 10000,
        action: {
          label: 'Backup Now',
          onClick: () => handleExport()
        }
      });
    }
    
    localStorage.setItem('measurepro_app_version', APP_VERSION);
  };

  const checkAutoBackupTimer = () => {
    const autoBackupPref = localStorage.getItem('measurepro_auto_backup_enabled') === 'true';
    if (!autoBackupPref) return;
    
    const lastBackupTimestamp = localStorage.getItem('measurepro_last_backup_timestamp');
    const lastBackupTime = lastBackupTimestamp ? parseInt(lastBackupTimestamp) : 0;
    const hoursSinceBackup = (Date.now() - lastBackupTime) / (1000 * 60 * 60);
    
    if (hoursSinceBackup >= 24) {
      toast.info('Daily Backup Reminder', {
        description: "It's been 24 hours since your last backup. Create one now?",
        duration: 15000,
        action: {
          label: 'Backup Now',
          onClick: () => handleExport()
        }
      });
    }
  };

  const toggleAutoBackup = () => {
    const newValue = !autoBackupEnabled;
    setAutoBackupEnabled(newValue);
    localStorage.setItem('measurepro_auto_backup_enabled', newValue.toString());
    
    toast.success(newValue ? 'Auto-backup enabled' : 'Auto-backup disabled', {
      description: newValue 
        ? 'You will be reminded to backup every 24 hours.' 
        : 'Auto-backup reminders are now disabled.',
      duration: 3000
    });
  };

  const handleShowDbStats = async () => {
    try {
      const stats = await getIndexedDBStats();
      setDbStats(stats);
      toast.info(`IndexedDB: ${stats.hostname}`, {
        description: `${stats.surveys} surveys, ${stats.measurements} measurements, ~${stats.estimatedSizeMB}MB`,
        duration: 8000
      });
    } catch (error) {
      toast.error('Failed to get database stats');
    }
  };

  const handleOptimizeStorage = async () => {
    setIsMigrating(true);
    try {
      await runMigrationWithUI();
      // Refresh status after migration
      const status = await getMigrationStatus();
      setMigrationStatus(status);
    } finally {
      setIsMigrating(false);
    }
  };

  const handleFullBackup = async () => {
    setIsFullBackupRunning(true);
    try {
      const result = await exportFullDatabaseBackup();
      if (result.success) {
        localStorage.setItem('measurepro_last_full_backup', new Date().toISOString());
      }
    } finally {
      setIsFullBackupRunning(false);
    }
  };

  const handleFullRestore = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsFullRestoreRunning(true);
    try {
      const result = await restoreFullDatabaseBackup(file);
      if (result.success) {
        setTimeout(() => window.location.reload(), 2000);
      }
    } finally {
      setIsFullRestoreRunning(false);
      if (fullBackupInputRef.current) {
        fullBackupInputRef.current.value = '';
      }
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    setProgress(null);

    try {
      await createCompleteBackup((p) => {
        setProgress(p);
      });

      // Update last backup timestamp
      const now = new Date().toISOString();
      localStorage.setItem('measurepro_last_backup', now);
      setLastBackup(now);

      toast.success('Backup created successfully!', {
        description: 'Your data has been exported to a ZIP file.',
        duration: 5000
      });
    } catch (error) {
      toast.error('Backup failed', {
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        duration: 5000
      });
    } finally {
      setIsExporting(false);
      setProgress(null);
    }
  };

  const handleRestore = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsRestoring(true);
    setRestoreProgress(null);

    try {
      await restoreBackup(file, (progress) => {
        setRestoreProgress(progress);
      });

      toast.success('Restore completed successfully!', {
        description: 'Your data has been restored from the backup.',
        duration: 5000
      });

      // Reload page to show restored data
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error) {
      toast.error('Restore failed', {
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        duration: 5000
      });
    } finally {
      setIsRestoring(false);
      setRestoreProgress(null);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const getProgressPercent = () => {
    if (!progress) return 0;
    if (progress.total === 0) return 0;
    return (progress.current / progress.total) * 100;
  };

  const getRestoreProgressPercent = () => {
    if (!restoreProgress) return 0;
    if (restoreProgress.total === 0) return 0;
    return (restoreProgress.current / restoreProgress.total) * 100;
  };

  return (
    <div className="space-y-6" data-testid="backup-settings">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Data Backup & Restore
          </CardTitle>
          <CardDescription>
            Export all your data to a ZIP file for safekeeping. Includes surveys, measurements, 
            videos, timelapses, point clouds, voice notes, and all settings.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Storage Health Warning */}
          {storageHealth && !storageHealth.healthy && (
            <div className="flex items-center gap-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
              <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
              <div className="text-sm text-yellow-800 dark:text-yellow-200">
                {storageHealth.warning}
              </div>
            </div>
          )}

          {/* Export Button */}
          <div className="space-y-2">
            <Button 
              onClick={handleExport}
              disabled={isExporting}
              className="w-full"
              size="lg"
              data-testid="button-export-backup"
            >
              <Download className="h-5 w-5 mr-2" />
              {isExporting ? 'Exporting...' : 'Export Complete Backup'}
            </Button>

            {/* Progress Bar */}
            {isExporting && progress && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>{progress.message}</span>
                  <span>{Math.round(getProgressPercent())}%</span>
                </div>
                <Progress value={getProgressPercent()} />
              </div>
            )}
          </div>

          {/* Last Backup Info */}
          {lastBackup && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>Last backup: {formatTimestamp(lastBackup)}</span>
            </div>
          )}

          {/* Storage Info */}
          {storageHealth && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <HardDrive className="h-4 w-4" />
              <span>Storage used: {storageHealth.percentUsed.toFixed(1)}%</span>
            </div>
          )}

          {/* Auto-Backup Toggle */}
          <div className="flex items-center justify-between p-3 bg-muted rounded-md">
            <div className="text-sm">
              <div className="font-medium">Daily Backup Reminders</div>
              <div className="text-muted-foreground">Get notified every 24 hours to create a backup</div>
            </div>
            <Button
              variant={autoBackupEnabled ? "default" : "outline"}
              size="sm"
              onClick={toggleAutoBackup}
              data-testid="button-toggle-auto-backup"
            >
              {autoBackupEnabled ? 'Enabled' : 'Disabled'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Restore from Backup */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Restore from Backup
          </CardTitle>
          <CardDescription>
            Import data from a previously exported backup ZIP file.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <input
            ref={fileInputRef}
            type="file"
            accept=".zip"
            onChange={handleRestore}
            className="hidden"
          />
          
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={isRestoring}
            variant="outline"
            className="w-full"
            size="lg"
            data-testid="button-import-backup"
          >
            <Upload className="h-5 w-5 mr-2" />
            {isRestoring ? 'Restoring...' : 'Import Backup'}
          </Button>

          {isRestoring && restoreProgress && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>{restoreProgress.message}</span>
                <span>{Math.round(getRestoreProgressPercent())}%</span>
              </div>
              <Progress value={getRestoreProgressPercent()} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Backup History */}
      {backupHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Backup History
            </CardTitle>
            <CardDescription>
              Recent backup exports (last 5)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {backupHistory.slice(0, 5).map((entry, index) => (
                <div 
                  key={index}
                  className="flex justify-between items-center p-2 rounded-md bg-muted/50"
                >
                  <div className="text-sm">
                    <div className="font-medium">{formatTimestamp(entry.timestamp)}</div>
                    <div className="text-muted-foreground text-xs">
                      {entry.dataCounts.measurements} measurements, 
                      {entry.dataCounts.videos} videos
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {formatSize(entry.size)}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Full Database Backup - Streaming (OOM-safe) */}
      <Card className="border-blue-200 dark:border-blue-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-blue-600" />
            Full Database Backup (Safe Mode)
          </CardTitle>
          <CardDescription>
            Export ALL data from IndexedDB using streaming to prevent out-of-memory errors.
            Use this before clearing browser cache to ensure no data is lost.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Current Origin Info */}
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
            <div className="flex items-center gap-2 text-sm">
              <Info className="h-4 w-4 text-blue-600" />
              <span className="font-medium">Current Origin:</span>
              <code className="text-xs bg-blue-100 dark:bg-blue-800 px-2 py-0.5 rounded">
                {typeof window !== 'undefined' ? window.location.hostname : 'loading...'}
              </code>
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              Each browser tab with a different URL has its own separate database.
              Run backup from each origin to capture all data.
            </div>
          </div>

          {/* DB Stats */}
          {dbStats && (
            <div className="p-3 bg-muted rounded-md text-sm">
              <div className="font-medium mb-1">Database Contents:</div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-muted-foreground">
                <span>Surveys: {dbStats.surveys}</span>
                <span>Measurements: {dbStats.measurements}</span>
                <span>Traces: {dbStats.traces}</span>
                <span>Alerts: {dbStats.alerts}</span>
                <span>Profiles: {dbStats.profiles}</span>
                <span>Est. Size: ~{dbStats.estimatedSizeMB}MB</span>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col gap-2">
            <Button
              onClick={handleShowDbStats}
              variant="outline"
              size="sm"
              data-testid="button-show-db-stats"
            >
              <Info className="h-4 w-4 mr-2" />
              Show Database Stats
            </Button>

            <Button
              onClick={handleFullBackup}
              disabled={isFullBackupRunning}
              className="w-full bg-blue-600 hover:bg-blue-700"
              size="lg"
              data-testid="button-full-backup"
            >
              <Download className="h-5 w-5 mr-2" />
              {isFullBackupRunning ? 'Backing up (streaming)...' : 'Full Database Backup'}
            </Button>

            <input
              ref={fullBackupInputRef}
              type="file"
              accept=".zip"
              onChange={handleFullRestore}
              className="hidden"
            />

            <Button
              onClick={() => fullBackupInputRef.current?.click()}
              disabled={isFullRestoreRunning}
              variant="outline"
              className="w-full"
              data-testid="button-full-restore"
            >
              <Upload className="h-4 w-4 mr-2" />
              {isFullRestoreRunning ? 'Restoring...' : 'Restore from Full Backup'}
            </Button>
          </div>

          <div className="text-xs text-muted-foreground">
            Backup filename includes the origin so you can identify which backup came from which version.
          </div>
        </CardContent>
      </Card>

      {/* Storage Optimization */}
      <Card className="border-green-200 dark:border-green-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-green-600" />
            Storage Optimization
          </CardTitle>
          <CardDescription>
            Convert inline base64 images to efficient blob storage to reduce database size
            and improve sync performance. This can save 60-80% of storage space.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {migrationStatus && (
            <div className={`p-3 rounded-md text-sm ${
              migrationStatus.needsMigration 
                ? 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800' 
                : 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
            }`}>
              {migrationStatus.needsMigration ? (
                <>
                  <div className="flex items-center gap-2 font-medium text-yellow-800 dark:text-yellow-200">
                    <AlertCircle className="h-4 w-4" />
                    {migrationStatus.measurementsWithBase64} images can be optimized
                  </div>
                  <div className="mt-1 text-yellow-700 dark:text-yellow-300">
                    Estimated savings: ~{Math.round(migrationStatus.estimatedSavings / 1024 / 1024)}MB
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-2 text-green-800 dark:text-green-200">
                  <Zap className="h-4 w-4" />
                  All images are already optimized!
                </div>
              )}
            </div>
          )}

          <Button
            onClick={handleOptimizeStorage}
            disabled={isMigrating || !migrationStatus?.needsMigration}
            className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50"
            size="lg"
            data-testid="button-optimize-storage"
          >
            <Zap className="h-5 w-5 mr-2" />
            {isMigrating ? 'Optimizing...' : 'Optimize Storage'}
          </Button>

          <div className="text-xs text-muted-foreground">
            This operation is safe and non-destructive. It converts images from base64
            strings to efficient binary blobs, reducing storage size and upload times.
          </div>
        </CardContent>
      </Card>

      {/* Info Box */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">What's included in backups?</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="text-sm space-y-1 text-muted-foreground">
            <li>✓ All surveys and measurements (POIs)</li>
            <li>✓ Geo-referenced videos and timelapses</li>
            <li>✓ Point cloud scans (3D data)</li>
            <li>✓ Voice notes and AI detection logs</li>
            <li>✓ Map routes and vehicle traces</li>
            <li>✓ All app settings and calibrations</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
