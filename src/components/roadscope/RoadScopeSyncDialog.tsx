/**
 * RoadScope Sync Dialog
 * Modal dialog for syncing a survey to RoadScope
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../../lib/auth/AuthContext';
import { getRoadScopeClient } from '../../lib/roadscope/client';
import { syncSurveyToRoadScope, SyncProgressCallback, SyncResult, getSyncStatus, clearFileSyncState } from '../../lib/roadscope/syncService';
import type { Survey } from '../../lib/survey/types';
import type { RoadScopeSurvey, SyncProgressEvent } from '../../lib/roadscope/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { 
  Cloud, 
  Check, 
  X, 
  AlertCircle, 
  Loader2, 
  Link2, 
  Plus,
  Upload,
  FileText,
  MapPin,
  Route,
  Image,
  CheckCircle2,
  XCircle,
  RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';

interface RoadScopeSyncDialogProps {
  isOpen: boolean;
  onClose: () => void;
  survey: Survey;
}

export function RoadScopeSyncDialog({ isOpen, onClose, survey }: RoadScopeSyncDialogProps) {
  const { user, cachedUserData } = useAuth();
  const [loading, setLoading] = useState(true);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [roadscopeSurveys, setRoadscopeSurveys] = useState<RoadScopeSurvey[]>([]);
  const [syncMode, setSyncMode] = useState<'new' | 'link'>('new');
  const [selectedSurveyId, setSelectedSurveyId] = useState<string | null>(null);
  const [includeFiles, setIncludeFiles] = useState(true);
  const [forceResyncFiles, setForceResyncFiles] = useState(false);
  const [resettingFiles, setResettingFiles] = useState(false);
  
  // Sync progress
  const [syncing, setSyncing] = useState(false);
  const [progress, setProgress] = useState<SyncProgressEvent | null>(null);
  const [result, setResult] = useState<SyncResult | null>(null);
  
  // Existing sync status
  const [syncStatus, setSyncStatus] = useState<{
    synced: boolean;
    roadscopeSurveyId?: string;
    lastSyncTime?: string;
    syncedPoiCount: number;
  } | null>(null);

  const userId = user?.uid || localStorage.getItem('current_user_id');
  const userEmail = user?.email || cachedUserData?.email || '';

  // Check for API key and load data
  useEffect(() => {
    if (!isOpen || !userId) return;

    const loadData = async () => {
      setLoading(true);
      try {
        // Check for API key
        const keyRes = await fetch(`/api/roadscope/settings/${userId}/key`);
        const keyJson = await keyRes.json();
        
        if (!keyJson.success || !keyJson.apiKey) {
          setHasApiKey(false);
          setLoading(false);
          return;
        }

        setHasApiKey(true);

        // Initialize client
        const client = getRoadScopeClient();
        client.setApiKey(keyJson.apiKey);

        // Get existing sync status
        const status = await getSyncStatus(survey.id);
        setSyncStatus(status);

        // Fetch RoadScope surveys for linking
        const surveysRes = await client.listSurveys();
        if (surveysRes.success && surveysRes.data) {
          setRoadscopeSurveys(surveysRes.data.surveys);
        }
      } catch (error) {
        console.error('[RoadScope] Failed to load data:', error);
        toast.error('Failed to load RoadScope data');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [isOpen, userId, survey.id]);

  // Handle sync
  const handleSync = async () => {
    if (!userId) return;

    setSyncing(true);
    setProgress(null);
    setResult(null);

    try {
      // Get API key
      const keyRes = await fetch(`/api/roadscope/settings/${userId}/key`);
      const keyJson = await keyRes.json();
      
      if (!keyJson.success || !keyJson.apiKey) {
        toast.error('API key not found. Please configure in Settings.');
        setSyncing(false);
        return;
      }

      // Initialize client
      const client = getRoadScopeClient();
      client.setApiKey(keyJson.apiKey);

      // Progress callback
      const onProgress: SyncProgressCallback = (event) => {
        setProgress(event);
      };

      // Perform sync with 2-minute timeout to prevent infinite spinner
      const SYNC_TIMEOUT_MS = 120000; // 2 minutes for larger syncs
      
      const syncPromise = syncSurveyToRoadScope(survey, {
        includeFiles,
        forceResyncFiles,
        onProgress,
        targetSurveyId: syncMode === 'link' ? selectedSurveyId || undefined : undefined
      });
      
      const timeoutPromise = new Promise<SyncResult>((_, reject) => {
        setTimeout(() => reject(new Error('RoadScope sync timed out after 2 minutes')), SYNC_TIMEOUT_MS);
      });
      
      const syncResult = await Promise.race([syncPromise, timeoutPromise]);

      setResult(syncResult);

      // Save mapping to database
      if (syncResult.roadscopeSurveyId) {
        await fetch('/api/roadscope/mappings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            measureproSurveyId: survey.id,
            roadscopeSurveyId: syncResult.roadscopeSurveyId,
            roadscopeSurveyName: survey.surveyTitle,
            linkType: syncMode === 'link' ? 'linked' : 'created',
            syncStatus: syncResult.success ? 'synced' : 'error',
            lastSyncPoiCount: syncResult.poisSynced,
            lastSyncRouteCount: syncResult.routesSynced,
            lastSyncFileCount: syncResult.filesSynced,
            syncError: syncResult.errors.length > 0 ? syncResult.errors.join('; ') : null
          })
        });

        // Update sync status
        const status = await getSyncStatus(survey.id);
        setSyncStatus(status);
      }

      if (syncResult.success) {
        toast.success('Survey synced to RoadScope successfully');
      } else if (syncResult.errors.length > 0) {
        toast.warning(`Sync completed with ${syncResult.errors.length} errors`);
      }
    } catch (error) {
      console.error('[RoadScope] Sync failed:', error);
      toast.error('Sync failed. Please try again.');
      setResult({
        success: false,
        surveyId: survey.id,
        poisSynced: 0,
        routesSynced: 0,
        filesSynced: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error']
      });
    } finally {
      setSyncing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl bg-gray-800 border-gray-700 max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Cloud className="w-6 h-6 text-blue-400" />
              <div>
                <CardTitle className="text-white">Sync to RoadScope</CardTitle>
                <CardDescription className="text-gray-400">
                  {survey.surveyTitle}
                </CardDescription>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white"
              data-testid="button-close-sync-dialog"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
            </div>
          ) : !hasApiKey ? (
            <div className="bg-yellow-900/20 border border-yellow-600/30 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-400 mt-0.5" />
                <div>
                  <h3 className="font-medium text-yellow-400">API Key Required</h3>
                  <p className="text-sm text-gray-300 mt-1">
                    Please configure your RoadScope API key in Settings → Sync to enable synchronization.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3 border-yellow-600/50 text-yellow-400"
                    onClick={onClose}
                    data-testid="button-go-to-settings"
                  >
                    Go to Settings
                  </Button>
                </div>
              </div>
            </div>
          ) : result ? (
            // Show result
            <div className="space-y-4">
              <div className={`p-4 rounded-lg border ${
                result.success
                  ? 'bg-green-900/20 border-green-600/30'
                  : 'bg-red-900/20 border-red-600/30'
              }`}>
                <div className="flex items-center gap-3 mb-3">
                  {result.success ? (
                    <CheckCircle2 className="w-6 h-6 text-green-400" />
                  ) : (
                    <XCircle className="w-6 h-6 text-red-400" />
                  )}
                  <h3 className={`font-medium ${result.success ? 'text-green-400' : 'text-red-400'}`}>
                    {result.success ? 'Sync Complete' : 'Sync Completed with Errors'}
                  </h3>
                </div>

                <div className="grid grid-cols-3 gap-4 mt-4">
                  <div className="text-center">
                    <MapPin className="w-5 h-5 mx-auto text-gray-400 mb-1" />
                    <div className="text-xl font-bold text-white">{result.poisSynced}</div>
                    <div className="text-xs text-gray-500">POIs Synced</div>
                  </div>
                  <div className="text-center">
                    <Route className="w-5 h-5 mx-auto text-gray-400 mb-1" />
                    <div className="text-xl font-bold text-white">{result.routesSynced}</div>
                    <div className="text-xs text-gray-500">Routes Synced</div>
                  </div>
                  <div className="text-center">
                    <Image className="w-5 h-5 mx-auto text-gray-400 mb-1" />
                    <div className="text-xl font-bold text-white">{result.filesSynced}</div>
                    <div className="text-xs text-gray-500">Files Uploaded</div>
                  </div>
                </div>

                {result.errors.length > 0 && (
                  <div className="mt-4 p-3 bg-gray-900 rounded">
                    <h4 className="text-sm font-medium text-red-400 mb-2">Errors:</h4>
                    <ul className="text-xs text-gray-400 space-y-1 max-h-32 overflow-y-auto">
                      {result.errors.map((error, idx) => (
                        <li key={idx}>• {error}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => setResult(null)}
                  className="border-gray-600"
                  data-testid="button-sync-again"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Sync Again
                </Button>
                <Button onClick={onClose} data-testid="button-close-result">
                  Done
                </Button>
              </div>
            </div>
          ) : syncing ? (
            // Show progress
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
                <div>
                  <h3 className="font-medium text-white">{progress?.message || 'Starting sync...'}</h3>
                  {progress?.details && (
                    <p className="text-sm text-gray-400">{progress.details}</p>
                  )}
                </div>
              </div>

              {progress && progress.total > 0 && (
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full transition-all"
                    style={{ width: `${(progress.current / progress.total) * 100}%` }}
                  />
                </div>
              )}

              <div className="grid grid-cols-4 gap-2 text-center text-xs">
                <div className={`p-2 rounded ${progress?.phase === 'validating' ? 'bg-blue-600/20 text-blue-400' : 'text-gray-500'}`}>
                  Validating
                </div>
                <div className={`p-2 rounded ${progress?.phase === 'surveys' ? 'bg-blue-600/20 text-blue-400' : progress?.phase && ['pois', 'routes', 'files', 'complete'].includes(progress.phase) ? 'text-green-400' : 'text-gray-500'}`}>
                  Survey
                </div>
                <div className={`p-2 rounded ${progress?.phase === 'pois' ? 'bg-blue-600/20 text-blue-400' : progress?.phase && ['routes', 'files', 'complete'].includes(progress.phase) ? 'text-green-400' : 'text-gray-500'}`}>
                  POIs
                </div>
                <div className={`p-2 rounded ${progress?.phase === 'routes' || progress?.phase === 'files' ? 'bg-blue-600/20 text-blue-400' : progress?.phase === 'complete' ? 'text-green-400' : 'text-gray-500'}`}>
                  Routes/Files
                </div>
              </div>
            </div>
          ) : (
            // Show sync options
            <div className="space-y-6">
              {/* Existing sync status */}
              {syncStatus?.synced && (
                <div className="bg-green-900/20 border border-green-600/30 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-green-400 mb-2">
                    <Check className="w-4 h-4" />
                    <span className="font-medium">Previously Synced</span>
                  </div>
                  <p className="text-sm text-gray-300">
                    Last synced: {syncStatus.lastSyncTime ? new Date(syncStatus.lastSyncTime).toLocaleString() : 'Unknown'}
                  </p>
                  <p className="text-sm text-gray-400">
                    {syncStatus.syncedPoiCount} POIs synced
                  </p>
                </div>
              )}

              {/* Sync mode selection */}
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-white">Sync Mode</h3>
                
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setSyncMode('new')}
                    className={`p-4 rounded-lg border text-left transition-colors ${
                      syncMode === 'new'
                        ? 'border-blue-500 bg-blue-600/20'
                        : 'border-gray-700 hover:border-gray-600'
                    }`}
                    data-testid="button-sync-mode-new"
                  >
                    <Plus className="w-5 h-5 text-blue-400 mb-2" />
                    <h4 className="font-medium text-white">Create New Survey</h4>
                    <p className="text-xs text-gray-400 mt-1">
                      Create a new survey in RoadScope
                    </p>
                  </button>

                  <button
                    onClick={() => setSyncMode('link')}
                    className={`p-4 rounded-lg border text-left transition-colors ${
                      syncMode === 'link'
                        ? 'border-blue-500 bg-blue-600/20'
                        : 'border-gray-700 hover:border-gray-600'
                    }`}
                    data-testid="button-sync-mode-link"
                  >
                    <Link2 className="w-5 h-5 text-purple-400 mb-2" />
                    <h4 className="font-medium text-white">Link to Existing</h4>
                    <p className="text-xs text-gray-400 mt-1">
                      Add data to an existing RoadScope survey
                    </p>
                  </button>
                </div>
              </div>

              {/* Survey selection for linking */}
              {syncMode === 'link' && (
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-white">Select RoadScope Survey</h3>
                  
                  {roadscopeSurveys.length === 0 ? (
                    <p className="text-sm text-gray-400">
                      No surveys found in your RoadScope account.
                    </p>
                  ) : (
                    <div className="max-h-48 overflow-y-auto space-y-2">
                      {roadscopeSurveys.map((s) => (
                        <button
                          key={s.id}
                          onClick={() => setSelectedSurveyId(s.id)}
                          className={`w-full p-3 rounded-lg border text-left transition-colors ${
                            selectedSurveyId === s.id
                              ? 'border-blue-500 bg-blue-600/20'
                              : 'border-gray-700 hover:border-gray-600'
                          }`}
                          data-testid={`button-select-survey-${s.id}`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-medium text-white">{s.name}</h4>
                              <p className="text-xs text-gray-400">
                                {s.poiCount} POIs • {s.client || 'No client'}
                              </p>
                            </div>
                            {selectedSurveyId === s.id && (
                              <Check className="w-4 h-4 text-blue-400" />
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Options */}
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-white">Options</h3>
                
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeFiles}
                    onChange={(e) => setIncludeFiles(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-blue-600"
                    data-testid="checkbox-include-files"
                  />
                  <div>
                    <span className="text-sm text-white">Include photos and files</span>
                    <p className="text-xs text-gray-500">Upload images, drawings, and videos</p>
                  </div>
                </label>

                {/* Force Re-sync Files option - only show if previously synced */}
                {syncStatus?.synced && includeFiles && (
                  <div className="mt-3 p-3 bg-orange-900/20 border border-orange-600/30 rounded-lg">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h4 className="text-sm font-medium text-orange-400 flex items-center gap-2">
                          <RefreshCw className="w-4 h-4" />
                          File Sync Issues?
                        </h4>
                        <p className="text-xs text-gray-400 mt-1">
                          If photos aren't appearing in RoadScope, force re-sync all files.
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          setResettingFiles(true);
                          try {
                            const cleared = await clearFileSyncState(survey.id);
                            setForceResyncFiles(true);
                            toast.success(`Reset sync state for ${cleared} files. Click "Start Sync" to re-upload.`);
                          } catch (err) {
                            toast.error('Failed to reset file sync state');
                          } finally {
                            setResettingFiles(false);
                          }
                        }}
                        disabled={resettingFiles || forceResyncFiles}
                        className="border-orange-600/50 text-orange-400 hover:bg-orange-900/30 shrink-0"
                        data-testid="button-force-resync-files"
                      >
                        {resettingFiles ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : forceResyncFiles ? (
                          <>
                            <Check className="w-4 h-4 mr-1" />
                            Ready
                          </>
                        ) : (
                          'Reset & Re-sync'
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Survey info */}
              <div className="bg-gray-900 rounded-lg p-4">
                <h3 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-gray-400" />
                  Survey Data
                </h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Title:</span>
                    <span className="text-white ml-2">{survey.surveyTitle}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Client:</span>
                    <span className="text-white ml-2">{survey.clientName || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Project:</span>
                    <span className="text-white ml-2">{survey.projectNumber || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">POIs:</span>
                    <span className="text-white ml-2">{survey.poiCount || 0}</span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={onClose}
                  className="border-gray-600"
                  data-testid="button-cancel-sync"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSync}
                  disabled={syncMode === 'link' && !selectedSurveyId}
                  data-testid="button-start-sync"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Start Sync
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default RoadScopeSyncDialog;
