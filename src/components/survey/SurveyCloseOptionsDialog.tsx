import { useState, useEffect } from 'react';
import { API_BASE_URL } from '@/lib/config/environment';
import { 
  HardDrive, 
  Mail, 
  Cloud, 
  RefreshCw, 
  CheckCircle2,
  Wifi,
  WifiOff,
  AlertTriangle,
  Loader2,
  Moon
} from 'lucide-react';
import { Survey } from '../../lib/survey/types';
import { toast } from 'sonner';
import { openSurveyDB, purgeCompletedSurveyFromDB } from '../../lib/survey/db';
import { useSurveyStore } from '../../lib/survey';
import { getBaseTitle, getDisplayTitle } from '../../lib/survey/autoSplit';
import { getMeasurementFeed } from '../../lib/survey/MeasurementFeed';
import { useAuth } from '../../lib/auth/AuthContext';
import { getEmailConfig } from '../../lib/utils/emailConfig';
import { DEFAULT_AUTO_PART_THRESHOLD } from '../../lib/survey/constants';
import { auditLog } from '../../lib/auditLog';
import { useCameraControl } from '../../hooks/useCameraControl';
import CameraDownloadBanner from '../CameraDownloadBanner';

export interface CloseOptions {
  saveToHardDrive: boolean; // Always true (mandatory)
  sendEmail: boolean;
  uploadToFirebase: boolean;
  syncToRoadScope: boolean;
}

interface SurveyCloseOptionsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  survey: Survey;
  mode: 'complete' | 'continue' | 'end_of_day';
}

export const SurveyCloseOptionsDialog: React.FC<SurveyCloseOptionsDialogProps> = ({
  isOpen,
  onClose,
  survey,
  mode
}) => {
  const { setActiveSurvey } = useSurveyStore();
  const { user, cachedUserData } = useAuth();
  const { stopForSurvey } = useCameraControl();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStep, setCurrentStep] = useState<string>('');
  const [roadScopeAvailable, setRoadScopeAvailable] = useState(false);
  const [hasEmailRecipients, setHasEmailRecipients] = useState(false);
  
  // Get userId from auth hook with localStorage fallback (same pattern as RoadScopeSyncDialog)
  const userId = user?.uid || localStorage.getItem('current_user_id');
  
  // Options state
  const [options, setOptions] = useState<CloseOptions>({
    saveToHardDrive: true, // Always mandatory
    sendEmail: true,
    uploadToFirebase: true,
    syncToRoadScope: true
  });

  // Check online status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Check if RoadScope is configured (uses userId from useAuth with localStorage fallback)
  useEffect(() => {
    const checkRoadScope = async () => {
      try {
        if (userId) {
          const res = await fetch(`${API_BASE_URL}/api/roadscope/settings/${userId}`, {
            signal: AbortSignal.timeout(5000) // 5s timeout
          });
          const json = await res.json();
          console.log('[SurveyClose] RoadScope settings check:', { userId, json });
          // Check both apiKeyValidated and hasApiKey (hasApiKey is set when apiKey exists)
          const isConfigured = json.success && json.data && (json.data.apiKeyValidated === true || json.data.hasApiKey === true);
          setRoadScopeAvailable(isConfigured);
        } else {
          console.log('[SurveyClose] No userId for RoadScope check');
          setRoadScopeAvailable(false);
        }
      } catch (err) {
        console.error('[SurveyClose] RoadScope check error:', err);
        setRoadScopeAvailable(false);
      }
    };
    
    if (isOpen) {
      checkRoadScope();
    }
  }, [isOpen, userId]);

  // Check if email recipients are configured — combines survey-level and emailConfig recipients
  useEffect(() => {
    if (isOpen) {
      const emailConfig = getEmailConfig();
      const combined = [
        ...(survey.ownerEmail ? [survey.ownerEmail] : []),
        ...(survey.completionEmailList || []),
        ...emailConfig.surveyRecipients
      ];
      setHasEmailRecipients(combined.length > 0);
    }
  }, [isOpen, survey]);

  if (!isOpen) return null;

  const handleClose = async () => {
    setIsProcessing(true);
    
    try {
      void stopForSurvey(survey.id);

      const db = await openSurveyDB();
      const surveyIdToPurge = survey.id;
      
      // Step 1: Mark survey as inactive
      setCurrentStep('Marking survey as inactive...');
      const now = new Date().toISOString();
      const updatedSurvey: Survey = {
        ...survey,
        closureReason: mode === 'complete' ? 'completed' : mode === 'end_of_day' ? 'end_of_day' : 'continuation',
        closedAt: now,
        pausedAt: mode === 'end_of_day' ? now : undefined,
        active: false
      };
      await db.put('surveys', updatedSurvey);

      // Audit log: survey close
      const auditUid = userId || '';
      const auditEmail = user?.email || cachedUserData?.email || '';
      const poiCount = survey.poiCount || 0;
      if (auditUid && auditEmail) {
        auditLog.surveyClose(
          auditUid,
          auditEmail,
          survey.id,
          survey.surveyTitle || survey.name || 'Untitled Survey',
          poiCount
        );
      }
      
      // Step 2: Generate and save package (MANDATORY — must succeed before any purge)
      setCurrentStep('Generating survey package...');
      let saveValidated = false;
      const { generateSurveyPackageBlob } = await import('../../lib/utils/exportUtils');
      const packageData = await generateSurveyPackageBlob(updatedSurvey);

      // Step 3: Save to hard drive (MANDATORY)
      setCurrentStep('Saving to your computer...');
      const { saveAs } = await import('file-saver');
      saveAs(packageData.blob, packageData.filename);
      saveValidated = true;
      console.log(`[SurveyClose] Save validated — ${packageData.filename} (${packageData.measurementCount} POIs)`);
      
      let downloadUrl: string | undefined;
      
      // Step 4: Upload to Firebase (optional)
      if (options.uploadToFirebase && isOnline) {
        setCurrentStep('Uploading to cloud storage...');
        try {
          const { uploadSurveyPackage, canUploadToCloud } = await import('../../lib/firebase/storageUpload');
          
          if (canUploadToCloud()) {
            const uploadResult = await uploadSurveyPackage(
              survey.id,
              packageData.blob,
              packageData.filename,
              (progress) => {
                setCurrentStep(`Uploading to cloud... ${progress.percentage}%`);
              }
            );
            
            if (uploadResult.success && uploadResult.downloadUrl) {
              downloadUrl = uploadResult.downloadUrl;
              // toast suppressed
            }
          }
        } catch (err) {
          console.error('[SurveyClose] Firebase upload failed:', err);
          // toast suppressed
        }
      }
      
      // Step 5: Send email (optional)
      if (options.sendEmail && isOnline && hasEmailRecipients) {
        setCurrentStep('Sending email notification...');
        try {
          const emailConfig = getEmailConfig();
          const recipients: string[] = [];
          if (survey.ownerEmail) recipients.push(survey.ownerEmail);
          if (survey.completionEmailList) recipients.push(...survey.completionEmailList);
          for (const r of emailConfig.surveyRecipients) {
            if (!recipients.includes(r)) recipients.push(r);
          }

          const { sendSurveyCompletionEmail } = await import('../../lib/utils/emailUtils');
          await sendSurveyCompletionEmail({
            to: recipients,
            bcc: ['admin@soltec.ca'],
            surveyTitle: updatedSurvey.surveyTitle || updatedSurvey.name || 'Untitled Survey',
            surveyorName: updatedSurvey.surveyorName || updatedSurvey.surveyor || 'Unknown',
            clientName: updatedSurvey.clientName || updatedSurvey.customerName || 'Unknown',
            projectNumber: updatedSurvey.projectNumber || updatedSurvey.description,
            measurementCount: packageData.measurementCount,
            notes: updatedSurvey.notes || '',
            downloadUrl,
            packageSize: formatBytes(packageData.blob.size)
          });
          // toast suppressed
        } catch (err) {
          console.error('[SurveyClose] Email failed:', err);
          // toast suppressed
        }
      }
      
      // Step 6: Sync to RoadScope (optional) - with 60 second timeout
      if (options.syncToRoadScope && isOnline && roadScopeAvailable) {
        setCurrentStep('Syncing to RoadScope...');
        try {
          // Use userId from useAuth (already defined at component level with localStorage fallback)
          if (userId) {
            // Fetch and set the API key first (same pattern as RoadScopeSyncDialog)
            const keyRes = await fetch(`${API_BASE_URL}/api/roadscope/settings/${userId}/key`, {
              signal: AbortSignal.timeout(10000) // 10s timeout for key fetch
            });
            const keyJson = await keyRes.json();
            
            if (!keyJson.success || !keyJson.apiKey) {
              throw new Error('RoadScope API key not found');
            }
            
            const { getRoadScopeClient } = await import('../../lib/roadscope/client');
            const client = getRoadScopeClient();
            client.setApiKey(keyJson.apiKey);
            
            const { syncSurveyToRoadScope, getSyncStatus } = await import('../../lib/roadscope/syncService');
            const status = await getSyncStatus(survey.id);
            
            // Wrap sync in a timeout to prevent infinite spinner
            const SYNC_TIMEOUT_MS = 60000; // 60 seconds
            const syncPromise = syncSurveyToRoadScope(updatedSurvey, {
              includeFiles: true,
              targetSurveyId: status?.roadscopeSurveyId,
              onProgress: (progress: { phase: string; current: number; total: number }) => {
                if (progress.phase === 'files') {
                  setCurrentStep(`Uploading files ${progress.current}/${progress.total}...`);
                } else if (progress.phase === 'pois') {
                  setCurrentStep(`Syncing POIs ${progress.current}/${progress.total}...`);
                } else if (progress.phase === 'surveys') {
                  setCurrentStep('Creating survey in RoadScope...');
                } else if (progress.phase === 'validating') {
                  setCurrentStep('Validating RoadScope API key...');
                }
              }
            });
            
            const timeoutPromise = new Promise<never>((_, reject) => {
              setTimeout(() => reject(new Error('RoadScope sync timed out after 60 seconds')), SYNC_TIMEOUT_MS);
            });
            
            const result = await Promise.race([syncPromise, timeoutPromise]);
            
            if (result.success) {
              // toast suppressed
            } else {
              console.warn('[SurveyClose] RoadScope sync errors:', result.errors);
              // toast suppressed
            }
          } else {
            console.warn('[SurveyClose] No userId for RoadScope sync');
            // toast suppressed
          }
        } catch (err) {
          console.error('[SurveyClose] RoadScope sync failed:', err);
          // toast suppressed
        }
      }
      
      // Step 7: Memory cleanup — for end_of_day, only reset in-memory cache (keep IndexedDB data!)
      setCurrentStep('Cleaning up memory...');
      
      // Clear the in-memory measurement cache
      getMeasurementFeed().resetCache();
      
      // If end of day, do NOT purge from IndexedDB — data must stay for resume
      if (mode === 'end_of_day') {
        setActiveSurvey(null);
        // toast suppressed
        onClose();
        return;
      }
      
      // Survey data stays in IndexedDB — user owns their data.
      // Cleanup is done via the Storage Cleanup modal in Settings, not automatically.
      console.log(`[SurveyClose] Survey ${surveyIdToPurge} closed and saved to disk. Data preserved in IndexedDB until user cleans up.`);
      
      // If continuing to next part, create the new survey
      if (mode === 'continue') {
        setCurrentStep('Creating next part...');
        
        const currentPart = survey.partOrdinal || 1;
        const nextPart = currentPart + 1;
        const rootId = survey.rootSurveyId || survey.id;
        const baseTitle = getBaseTitle(survey.surveyTitle || survey.name || 'Survey');
        const newTitle = getDisplayTitle(baseTitle, nextPart);
        
        const continuationSurvey: Survey = {
          id: crypto.randomUUID(),
          surveyTitle: newTitle,
          name: newTitle,
          surveyorName: survey.surveyorName,
          surveyor: survey.surveyor,
          clientName: survey.clientName,
          customerName: survey.customerName,
          projectNumber: survey.projectNumber,
          originAddress: survey.originAddress,
          destinationAddress: survey.destinationAddress,
          description: survey.description,
          notes: `Continuation of survey (Part ${nextPart})`,
          ownerEmail: survey.ownerEmail,
          completionEmailList: survey.completionEmailList,
          enableVehicleTrace: survey.enableVehicleTrace,
          enableAlertLog: survey.enableAlertLog,
          createdAt: new Date().toISOString(),
          active: true,
          outputFiles: survey.outputFiles,
          cloudUploadStatus: null,
          syncId: null,
          exportTarget: null,
          convoyId: survey.convoyId,
          fleetUnitRole: survey.fleetUnitRole,
          plannedRouteId: survey.plannedRouteId,
          routeAnalysis: null,
          aiUserModelId: survey.aiUserModelId,
          aiHistoryScore: null,
          interventionType: survey.interventionType,
          checklistCompleted: false,
          rootSurveyId: rootId,
          partOrdinal: nextPart,
          partLabel: `Part ${nextPart}`,
          maxPoiPerPart: survey.maxPoiPerPart || DEFAULT_AUTO_PART_THRESHOLD,
          poiCount: 0,
          closureReason: null
        };
        
        await db.put('surveys', continuationSurvey);
        setActiveSurvey(continuationSurvey);
        
        // toast suppressed
      } else {
        setActiveSurvey(null);
        // toast suppressed
      }
      
      onClose();
    } catch (error) {
      console.error('[SurveyClose] Failed:', error);
      toast.error('Failed to close survey', {
        description: (error as Error).message
      });
    } finally {
      setIsProcessing(false);
      setCurrentStep('');
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div 
        className="bg-gray-800 rounded-lg p-6 max-w-lg w-full m-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
          {mode === 'complete' ? (
            <>
              <CheckCircle2 className="w-6 h-6 text-green-500" />
              Complete Survey
            </>
          ) : mode === 'end_of_day' ? (
            <>
              <Moon className="w-6 h-6 text-amber-500" />
              End Day — Pause Survey
            </>
          ) : (
            <>
              <RefreshCw className="w-6 h-6 text-blue-500" />
              Continue to Part {(survey.partOrdinal || 1) + 1}
            </>
          )}
        </h3>

        {/* Online status indicator */}
        <div className={`flex items-center gap-2 mb-4 p-2 rounded-lg ${
          isOnline ? 'bg-green-900/30 border border-green-500/30' : 'bg-yellow-900/30 border border-yellow-500/30'
        }`}>
          {isOnline ? (
            <>
              <Wifi className="w-4 h-4 text-green-400" />
              <span className="text-sm text-green-300">Online - all options available</span>
            </>
          ) : (
            <>
              <WifiOff className="w-4 h-4 text-yellow-400" />
              <span className="text-sm text-yellow-300">Offline - only local save available</span>
            </>
          )}
        </div>

        {/* Options */}
        <div className="space-y-3 mb-6">
          {/* Save to HD - Always enabled, mandatory */}
          <label className="flex items-start gap-3 p-3 bg-gray-700/50 border border-green-500/50 rounded-lg cursor-not-allowed">
            <input
              type="checkbox"
              checked={true}
              disabled={true}
              className="mt-1 w-4 h-4 accent-green-500"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-green-400" />
                <span className="font-medium text-green-400">Save to Computer</span>
                <span className="text-xs bg-green-600 px-2 py-0.5 rounded">Required</span>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Downloads complete survey package (ZIP) to your computer
              </p>
            </div>
          </label>

          {/* Upload to Firebase */}
          <label className={`flex items-start gap-3 p-3 bg-gray-700/50 border rounded-lg ${
            isOnline ? 'border-gray-600 hover:border-blue-500/50 cursor-pointer' : 'border-gray-700 opacity-50 cursor-not-allowed'
          }`}>
            <input
              type="checkbox"
              checked={options.uploadToFirebase}
              disabled={!isOnline}
              onChange={(e) => setOptions(prev => ({ ...prev, uploadToFirebase: e.target.checked }))}
              className="mt-1 w-4 h-4 accent-blue-500"
              data-testid="checkbox-upload-firebase"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Cloud className="w-4 h-4 text-blue-400" />
                <span className="font-medium">Upload to MeasurePRO Cloud</span>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Backup to cloud storage for access from any device
              </p>
              {!isOnline && (
                <p className="text-xs text-yellow-400 mt-1 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  Requires internet connection
                </p>
              )}
            </div>
          </label>

          {/* Send Email */}
          <label className={`flex items-start gap-3 p-3 bg-gray-700/50 border rounded-lg ${
            isOnline && hasEmailRecipients ? 'border-gray-600 hover:border-purple-500/50 cursor-pointer' : 'border-gray-700 opacity-50 cursor-not-allowed'
          }`}>
            <input
              type="checkbox"
              checked={options.sendEmail}
              disabled={!isOnline || !hasEmailRecipients}
              onChange={(e) => setOptions(prev => ({ ...prev, sendEmail: e.target.checked }))}
              className="mt-1 w-4 h-4 accent-purple-500"
              data-testid="checkbox-send-email"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-purple-400" />
                <span className="font-medium">Send Email Notification</span>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Email completion report to configured recipients
              </p>
              {!hasEmailRecipients && (
                <p className="text-xs text-yellow-400 mt-1 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  No email recipients configured
                </p>
              )}
              {!isOnline && hasEmailRecipients && (
                <p className="text-xs text-yellow-400 mt-1 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  Requires internet connection
                </p>
              )}
            </div>
          </label>

          {/* Sync to RoadScope */}
          <label className={`flex items-start gap-3 p-3 bg-gray-700/50 border rounded-lg ${
            isOnline && roadScopeAvailable ? 'border-gray-600 hover:border-orange-500/50 cursor-pointer' : 'border-gray-700 opacity-50 cursor-not-allowed'
          }`}>
            <input
              type="checkbox"
              checked={options.syncToRoadScope}
              disabled={!isOnline || !roadScopeAvailable}
              onChange={(e) => setOptions(prev => ({ ...prev, syncToRoadScope: e.target.checked }))}
              className="mt-1 w-4 h-4 accent-orange-500"
              data-testid="checkbox-sync-roadscope"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-orange-400" />
                <span className="font-medium">Sync to RoadScope</span>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Upload POIs and photos to RoadScope platform
              </p>
              {!roadScopeAvailable && (
                <p className="text-xs text-yellow-400 mt-1 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  RoadScope not configured
                </p>
              )}
              {!isOnline && roadScopeAvailable && (
                <p className="text-xs text-yellow-400 mt-1 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  Requires internet connection
                </p>
              )}
            </div>
          </label>
        </div>

        {/* Warning about slow connection */}
        {isOnline && (options.uploadToFirebase || options.sendEmail || options.syncToRoadScope) && (
          <div className="mb-4 p-2 bg-blue-900/30 border border-blue-500/30 rounded-lg">
            <p className="text-xs text-blue-300 flex items-center gap-2">
              <AlertTriangle className="w-3 h-3" />
              Selected options require internet and may be slow on poor connections
            </p>
          </div>
        )}

        {/* Processing status */}
        {isProcessing && currentStep && (
          <div className="mb-4 p-3 bg-blue-900/50 border border-blue-500/30 rounded-lg">
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
              <span className="text-sm text-blue-300">{currentStep}</span>
            </div>
          </div>
        )}

        {/* 360° download progress (fire-and-forget after survey close) */}
        <CameraDownloadBanner />

        {/* Action buttons */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 rounded-lg font-medium transition-colors"
            data-testid="button-cancel-close"
          >
            Cancel
          </button>
          <button
            onClick={handleClose}
            disabled={isProcessing}
            className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 ${
              mode === 'complete' 
                ? 'bg-green-600 hover:bg-green-700' 
                : mode === 'end_of_day'
                ? 'bg-amber-600 hover:bg-amber-700'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
            data-testid="button-confirm-close"
          >
            {isProcessing ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Processing...
              </span>
            ) : mode === 'complete' ? (
              'Complete Survey'
            ) : mode === 'end_of_day' ? (
              'End Day & Pause'
            ) : (
              `Continue as Part ${(survey.partOrdinal || 1) + 1}`
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default SurveyCloseOptionsDialog;
