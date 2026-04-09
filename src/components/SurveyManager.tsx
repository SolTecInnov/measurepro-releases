import React, { useEffect, useState } from 'react';
import { FileText, Plus, Pencil, XCircle } from 'lucide-react';
import { useSurveyStore, exportSurvey } from '../lib/survey/index';
import { exportSurveyWithMedia } from '../lib/utils/exportUtils';
import { useSerialStore } from '../lib/stores/serialStore';
import { getSafeAuth } from '../lib/firebase';
import { isBetaUser } from '../lib/auth/masterAdmin';
import { useEnabledFeatures } from '../hooks/useLicenseEnforcement';
import SaveNowButton from './survey/SaveNowButton';
import { auditLog } from '../lib/auditLog';

// Import refactored components
import SurveyDetails from './survey/SurveyDetails';
import SurveyStatistics from './survey/SurveyStatistics';
import SurveyActions from './survey/SurveyActions';
import SurveyForm from './survey/SurveyForm';
import SurveyList from './survey/SurveyList';
import NoActiveSurvey from './survey/NoActiveSurvey';

interface SurveyManagerProps {
  showSurveyDialog: boolean;
  setShowSurveyDialog: (show: boolean) => void;
  setOfflineItems: (items: number | ((prev: number) => number)) => void;
  videoRef?: React.RefObject<HTMLVideoElement>;
}

const SurveyManager: React.FC<SurveyManagerProps> = ({ showSurveyDialog: _showSurveyDialog, setShowSurveyDialog: _setShowSurveyDialog, setOfflineItems, videoRef }) => {
  const [showNewSurveyDialog, setShowNewSurveyDialog] = React.useState(false);
  const [showEditSurveyDialog, setShowEditSurveyDialog] = React.useState(false);
  const [currentRoadNumber, setCurrentRoadNumber] = React.useState(1);
  const { activeSurvey, loadSurveys, surveys, setActiveSurvey } = useSurveyStore();
  const { lastMeasurement: _lastMeasurement } = useSerialStore();
  const [_pendingPhotos, setPendingPhotos] = useState<string[]>([]);
  const [showSurveyList, setShowSurveyList] = useState(false);
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  
  const [autoSaveIntervalId, setAutoSaveIntervalId] = useState<number | null>(null);
  const [autoSaveInterval, setAutoSaveInterval] = useState<number>(() =>
    parseInt(localStorage.getItem('autoSaveInterval') || '60')
  );

  // Keep autoSaveInterval state in sync when the user changes it in settings
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'autoSaveInterval' && e.newValue) {
        setAutoSaveInterval(parseInt(e.newValue));
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);
  
  // Beta user detection for UI simplification
  const { features } = useEnabledFeatures();
  const auth = getSafeAuth();
  const isBeta = isBetaUser(auth?.currentUser, features);

  useEffect(() => {
    loadSurveys();
  }, [loadSurveys]);

  // Handle CSV export triggered from the CSV backup failure toast
  useEffect(() => {
    const handleTriggerCsvExport = (event: Event) => {
      const detail = (event as CustomEvent).detail as { surveyId?: string } | undefined;
      const targetSurveyId = detail?.surveyId;
      const survey = targetSurveyId
        ? useSurveyStore.getState().surveys.find(s => s.id === targetSurveyId)
        : useSurveyStore.getState().activeSurvey;
      if (survey) {
        exportSurvey(survey, 'csv');
      }
    };
    window.addEventListener('trigger-csv-export', handleTriggerCsvExport);
    return () => window.removeEventListener('trigger-csv-export', handleTriggerCsvExport);
  }, []);

  // Set up auto-save when survey is active
  // Using surveyId and autoSaveInterval as dependencies so the timer restarts when the interval changes
  const surveyId = activeSurvey?.id;
  useEffect(() => {
    if (!surveyId) {
      // No active survey - clear any existing interval
      if (autoSaveIntervalId) {
        clearInterval(autoSaveIntervalId);
        setAutoSaveIntervalId(null);
      }
      return;
    }
    
    // Check if auto-save is enabled
    const autoSaveEnabled = localStorage.getItem('autoSaveEnabled') !== 'false';
    
    if (!autoSaveEnabled) {
      return;
    }
    
    // Convert minutes to milliseconds
    const intervalMs = autoSaveInterval * 60 * 1000;
    
    // Set up interval for auto-save
    const intervalId = window.setInterval(() => {
      const currentSurvey = useSurveyStore.getState().activeSurvey;
      if (currentSurvey) {
        exportSurvey(currentSurvey, 'csv');
      }
    }, intervalMs);
    
    setAutoSaveIntervalId(intervalId);
    
    return () => {
      clearInterval(intervalId);
    };
  }, [surveyId, autoSaveInterval]); // Restart timer when survey changes or interval setting changes

  // Load all surveys for the survey list
  useEffect(() => {
    const loadAllSurveys = async () => {
      await loadSurveys();
    };
    
    loadAllSurveys();
  }, [loadSurveys]);

  // Function to handle export with optional silent mode
  const handleExport = async (format: 'csv' | 'json' | 'geojson', silent: boolean = false) => {
    if (!activeSurvey) return;
    
    if (format === 'geojson' && !silent) {
      // For GeoJSON, use the full export with media
      await exportSurveyWithMedia(activeSurvey);
      const currentUser = auth?.currentUser;
      const uid = currentUser?.uid || localStorage.getItem('current_user_id') || '';
      const email = currentUser?.email || '';
      if (uid && email) {
        auditLog.surveyExport(uid, email, activeSurvey.id, activeSurvey.surveyTitle || activeSurvey.name || 'Untitled Survey', 'geojson');
      }
      return;
    }
    
    try {
      // Use the exportSurvey function from the store
      await exportSurvey(activeSurvey, format);
      
      // Audit log: survey export
      const currentUser = auth?.currentUser;
      const uid = currentUser?.uid || localStorage.getItem('current_user_id') || '';
      const email = currentUser?.email || '';
      if (uid && email && !silent) {
        auditLog.surveyExport(uid, email, activeSurvey.id, activeSurvey.surveyTitle || activeSurvey.name || 'Untitled Survey', format);
      }
      
      // Dispatch autosave event if silent mode is on (autosave)
      if (silent) {
        const autosaveEvent = new CustomEvent('autosave-complete', {
          detail: {
            timestamp: new Date().toISOString(),
            format
          }
        });
        window.dispatchEvent(autosaveEvent);
      }
    } catch (error) {
    }
  };

  const captureImage = () => {
    if (videoRef?.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0);
        return canvas.toDataURL('image/jpeg');
      }
    }
    return null;
  };

  const { clearSurvey } = useSurveyStore();

  return (
    <div className="bg-gray-800 rounded-xl p-6" data-testid="survey-manager">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <FileText className="w-6 h-6 text-blue-400" />
          Survey Management
        </h2>
        {!activeSurvey && (
          <>
            <button
              onClick={() => setShowNewSurveyDialog(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors animate-pulse"
            >
              <Plus className="w-5 h-5" />
              New Survey
            </button>
          
            <button
              onClick={() => {
                // Reload surveys before showing the list
                loadSurveys().then(() => {
                  setShowSurveyList(true);
                });
              }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
            >
              <FileText className="w-5 h-5" />
              Load Survey
            </button>
          </>
        )}
        {activeSurvey && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowEditSurveyDialog(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              title="Edit survey details"
              data-testid="button-edit-survey"
            >
              <Pencil className="w-5 h-5" />
              Edit Survey
            </button>
            <SaveNowButton activeSurveyId={activeSurvey.id} />
            {isBeta ? (
              <button
                onClick={() => setShowCloseDialog(true)}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors font-semibold"
                title="Close survey and export data"
                data-testid="button-close-survey-header"
              >
                <XCircle className="w-5 h-5" />
                Close Survey
              </button>
            ) : (
              <button
                onClick={() => exportSurveyWithMedia(activeSurvey)}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors font-semibold"
                title="Export complete survey package with all data, images, videos, road profiles, and GNSS data"
                data-testid="button-export-complete-package"
              >
                <FileText className="w-5 h-5" />
                Export Complete Package
              </button>
            )}
          </div>
        )}
      </div>

      {activeSurvey ? (
        <div className="space-y-6">
          <div className="bg-green-500/20 border border-green-500/30 text-green-400 rounded-lg px-6 py-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse" />
              <h3 className="text-base font-medium">Active Survey</h3>
            </div>
            
            {/* Survey Details */}
            <SurveyDetails activeSurvey={activeSurvey} />

            {/* Survey Statistics */}
            <SurveyStatistics activeSurvey={activeSurvey} />
            
            {/* Road Profile Recording - hidden for beta users */}
            {!isBeta && (
              <div className="mt-4 pt-4 border-t border-green-500/30">
              </div>
            )}
            
            {/* Survey Actions */}
            <SurveyActions 
              activeSurvey={activeSurvey}
              currentRoadNumber={currentRoadNumber}
              setCurrentRoadNumber={setCurrentRoadNumber}
              captureImage={captureImage}
              setOfflineItems={setOfflineItems}
              setPendingPhotos={setPendingPhotos}
              clearSurvey={clearSurvey}
              handleExport={handleExport}
              isBeta={isBeta}
              showCloseDialog={showCloseDialog}
              setShowCloseDialog={setShowCloseDialog}
            />
          </div>
        </div>
      ) : (
        <NoActiveSurvey />
      )}

      {/* New Survey Form Dialog */}
      <SurveyForm 
        isOpen={showNewSurveyDialog}
        onClose={() => setShowNewSurveyDialog(false)}
        editMode={false}
      />
      
      {/* Edit Survey Form Dialog */}
      <SurveyForm 
        isOpen={showEditSurveyDialog}
        onClose={() => setShowEditSurveyDialog(false)}
        editMode={true}
      />
      
      {/* Survey List Dialog */}
      <SurveyList
        isOpen={showSurveyList}
        onClose={() => setShowSurveyList(false)}
        surveys={surveys}
        activeSurvey={activeSurvey}
        setActiveSurvey={setActiveSurvey}
      />
    </div>
  );
};

export default SurveyManager;