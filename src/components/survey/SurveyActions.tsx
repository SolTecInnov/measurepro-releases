import React from 'react';
import { Download, Loader as Road, Flag, PlayCircle, ChevronDown, Mail, XCircle, CheckCircle2, RefreshCw, Moon } from 'lucide-react';
import { Survey } from '../../lib/survey/types';
import { useMeasurementLogger } from '../../hooks/useMeasurementLogger';
import { useGPSStore } from '../../lib/stores/gpsStore';
import { useSerialStore } from '../../lib/stores/serialStore';
import { soundManager } from '../../lib/sounds';
import { exportSurveyWithMedia, exportSurveyWithImages } from '../../lib/utils/exportUtils';
import { sendSurveyCompletionEmail } from '../../lib/utils/emailUtils';
import { getSurveyEmailRecipients } from '../../lib/utils/emailConfig';
import { exportSurveyData } from '../../lib/survey';
import { toast } from 'sonner';
import { useSurveyStore } from '../../lib/survey';
import { openSurveyDB } from '../../lib/survey/db';
import SaveNowButton from './SaveNowButton';
import SurveyCloseOptionsDialog from './SurveyCloseOptionsDialog';

interface SurveyActionsProps {
  activeSurvey: Survey;
  currentRoadNumber: number;
  setCurrentRoadNumber: (roadNumber: number) => void;
  captureImage: () => string | null;
  setOfflineItems: (items: number | ((prev: number) => number)) => void;
  setPendingPhotos: (photos: string[]) => void;
  clearSurvey: () => Promise<void>;
  handleExport: (format: 'csv' | 'json' | 'geojson', silent?: boolean) => Promise<void>;
  isBeta?: boolean;
  showCloseDialog?: boolean;
  setShowCloseDialog?: (show: boolean) => void;
}

const SurveyActions: React.FC<SurveyActionsProps> = ({
  activeSurvey,
  currentRoadNumber,
  setCurrentRoadNumber,
  captureImage,
  setOfflineItems,
  setPendingPhotos,
  clearSurvey,
  handleExport,
  isBeta = false,
  showCloseDialog: externalShowCloseDialog,
  setShowCloseDialog: externalSetShowCloseDialog
}) => {
  // PERFORMANCE FIX: Use worker-based measurement logging
  const { logMeasurement: logMeasurementViaWorker } = useMeasurementLogger();
  
  const [showExportMenu, setShowExportMenu] = React.useState(false);
  const [showEmailDialog, setShowEmailDialog] = React.useState(false);
  const [internalShowCloseDialog, internalSetShowCloseDialog] = React.useState(false);
  
  // Use external or internal state for close dialog
  const showCloseDialog = externalShowCloseDialog !== undefined ? externalShowCloseDialog : internalShowCloseDialog;
  const setShowCloseDialog = externalSetShowCloseDialog || internalSetShowCloseDialog;
  const [sendingEmail, setSendingEmail] = React.useState(false);
  const [additionalEmail, setAdditionalEmail] = React.useState('');
  
  // New state for close options dialog
  const [closeMode, setCloseMode] = React.useState<'complete' | 'continue' | 'end_of_day' | null>(null);
  const { data: gpsData } = useGPSStore();
  const { lastMeasurement } = useSerialStore();
  const { setActiveSurvey } = useSurveyStore();

  const handleSetRoadBegin = async () => {
    if (!activeSurvey) return;

    // Capture image first
    const imageUrl = captureImage();
    
    // Wait briefly for image capture
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Convert laser measurement from mm to meters
    const measurementInMeters = lastMeasurement !== '--' ? parseFloat(lastMeasurement) : 0;
    
    const beginPOI = {
      id: crypto.randomUUID(),
      rel: measurementInMeters,
      altGPS: gpsData?.altitude || 0,
      latitude: gpsData?.latitude || 0,
      longitude: gpsData?.longitude || 0,
      utcDate: new Date().toISOString().split('T')[0],
      utcTime: new Date().toTimeString().split(' ')[0],
      speed: gpsData?.speed || 0,
      heading: gpsData?.course || 0,
      roadNumber: currentRoadNumber,
      poiNumber: null,
      imageUrl: imageUrl,
      poi_type: 'road',
      note: `Road ${currentRoadNumber} Start Point - KM 0`,
      createdAt: new Date().toISOString(),
      user_id: activeSurvey.id
    };
    
    // PERFORMANCE FIX: Use worker-based logging for off-thread, batched writes
    await logMeasurementViaWorker(beginPOI);
    
    // Clear pending photos after successful save
    if (imageUrl) {
      setPendingPhotos([]);
    }
    
    // Update offline items count
    setOfflineItems(prev => prev + 1);
    
    // Play confirmation sound
    soundManager.playLogEntry();
  };

  const handleSetRoadEnd = async () => {
    if (!activeSurvey) return;
    
    // Capture image first
    const imageUrl = captureImage();
    
    // Wait briefly for image capture
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Convert laser measurement from mm to meters
    const measurementInMeters = lastMeasurement !== '--' ? parseFloat(lastMeasurement) : 0;
    
    const endPOI = {
      id: crypto.randomUUID(),
      rel: 0,
      altGPS: gpsData.altitude,
      latitude: gpsData.latitude,
      longitude: gpsData.longitude,
      utcDate: new Date().toISOString().split('T')[0],
      utcTime: new Date().toTimeString().split(' ')[0],
      speed: gpsData.speed,
      heading: gpsData.course,
      roadNumber: currentRoadNumber,
      poiNumber: null,
      imageUrl: imageUrl,
      poi_type: 'road',
      note: `Road ${currentRoadNumber} End Point`,
      createdAt: new Date().toISOString(),
      user_id: activeSurvey.id
    };

    // PERFORMANCE FIX: Use worker-based logging for off-thread, batched writes
    await logMeasurementViaWorker(endPOI);
    
    // Clear pending photos after successful save
    if (imageUrl) {
      setPendingPhotos([]);
    }
    
    // Update offline items count
    setOfflineItems(prev => prev + 1);
    
    // Play confirmation sound
    soundManager.playLogEntry();
    
    // Increment road number for next road
    setCurrentRoadNumber(prev => prev + 1);
  };

  const handleEmailSurvey = async () => {
    if (!activeSurvey) return;

    setSendingEmail(true);
    try {
      // Get survey email recipients with admin BCC
      const { to, bcc } = getSurveyEmailRecipients();
      
      // Add additional email if provided
      const recipients = additionalEmail.trim() ? [...to, additionalEmail.trim()] : to;

      // Export data in all formats silently
      const csvData = await exportSurveyData(activeSurvey.id, 'csv');
      const jsonData = await exportSurveyData(activeSurvey.id, 'json');
      const geojsonData = await exportSurveyData(activeSurvey.id, 'geojson');

      // Get measurement count
      const { openSurveyDB } = await import('../../lib/survey/db');
      const db = await openSurveyDB();
      const measurements = await db.getAllFromIndex('measurements', 'by-date');
      const surveyMeasurements = measurements.filter(m => m.user_id === activeSurvey.id);

      await sendSurveyCompletionEmail(
        {
          to: recipients,
          bcc, // Always includes admin@soltec.ca
          surveyTitle: activeSurvey.surveyTitle || activeSurvey.name || 'Untitled Survey',
          surveyorName: activeSurvey.surveyorName || activeSurvey.surveyor || 'Unknown',
          clientName: activeSurvey.clientName || activeSurvey.customerName || 'Unknown',
          projectNumber: activeSurvey.projectNumber || activeSurvey.description,
          measurementCount: surveyMeasurements.length,
          notes: activeSurvey.notes,
        },
        {
          csv: csvData,
          json: jsonData,
          geojson: geojsonData,
        }
      );

      setShowEmailDialog(false);
      setAdditionalEmail('');
    } catch (error: any) {
      toast.error('Failed to email survey', {
        description: error.message || 'Please try again',
      });
    } finally {
      setSendingEmail(false);
    }
  };

  return (
    <div className="flex flex-wrap gap-2 mt-6">
      {/* Route Selector - hidden for beta users */}
      {!isBeta && (
        <div className="flex items-center gap-4 mr-auto">
          <div className="flex items-center gap-2">
            <Road className="w-4 h-4 text-blue-400" />
            <select
              value={currentRoadNumber}
              onChange={(e) => setCurrentRoadNumber(parseInt(e.target.value))}
              className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs"
            >
              {Array.from({ length: 10 }, (_, i) => i + 1).map(num => (
                <option key={num} value={num}>Road {String(num).padStart(3, '0')}</option>
              ))}
            </select>
          </div>
          <button
            onClick={handleSetRoadBegin}
            className="flex items-center gap-2 px-3 py-1.5 bg-green-600 hover:bg-green-700 rounded text-xs font-medium"
            data-testid="button-road-begin"
          >
            <PlayCircle className="w-4 h-4" />
            Set Road Begin
          </button>
          <button
            onClick={handleSetRoadEnd}
            className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-xs font-medium"
            data-testid="button-road-end"
          >
            <Flag className="w-4 h-4" />
            Set Road End
          </button>
        </div>
      )}
      
      {/* Close Survey Button - hidden for beta (shown in header) */}
      {!isBeta && (
        <button
          onClick={() => setShowCloseDialog(true)}
          className="flex items-center gap-1 px-3 py-1.5 bg-red-600 hover:bg-red-700 rounded text-xs font-medium"
          data-testid="button-close-survey"
        >
          <XCircle className="w-4 h-4" />
          Close Survey
        </button>
      )}

      {/* Export Menu - hidden for beta */}
      {!isBeta && (
        <div className="relative">
          <button
            onClick={() => setShowExportMenu(!showExportMenu)}
            className="flex items-center gap-1 px-2 py-1 bg-gray-600 hover:bg-gray-500 rounded text-xs font-medium"
          >
            <Download className="w-3 h-3" />
            Export
            <ChevronDown className="w-3 h-3" />
          </button>

          {showExportMenu && (
            <div className="absolute right-0 mt-1 w-48 bg-gray-700 border border-gray-600 rounded-lg shadow-lg z-50">
              <div className="py-1">
                <button
                  onClick={() => {
                    handleExport('csv');
                    setShowExportMenu(false);
                  }}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-gray-600 flex items-center gap-2"
                >
                  <Download className="w-3 h-3" />
                  Export CSV
                </button>
                <button
                  onClick={() => {
                    handleExport('json');
                    setShowExportMenu(false);
                  }}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-gray-600 flex items-center gap-2"
                >
                  <Download className="w-3 h-3" />
                  Export JSON
                </button>
                <button
                  onClick={() => {
                    exportSurveyWithImages(activeSurvey);
                    setShowExportMenu(false);
                  }}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-gray-600 flex items-center gap-2"
                >
                  <Download className="w-3 h-3" />
                  Export with Images
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Export Complete Package — standalone small button */}
      {!isBeta && (
        <button
          onClick={() => exportSurveyWithMedia(activeSurvey)}
          className="flex items-center gap-1 px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-[10px] font-medium text-gray-300"
          data-testid="button-export-complete-package"
        >
          <Download className="w-3 h-3" />
          Complete Package
        </button>
      )}

      {/* Close Survey Dialog - Step 1: Choose Complete or Continue */}
      {showCloseDialog && !closeMode && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowCloseDialog(false)}>
          <div className="bg-gray-800 rounded-lg p-6 max-w-lg w-full m-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
              <XCircle className="w-6 h-6 text-red-500" />
              Close Survey
            </h3>
            
            <p className="text-gray-300 mb-4">
              How would you like to close this survey?
            </p>

            {/* Part indicator */}
            {(activeSurvey.partOrdinal && activeSurvey.partOrdinal > 1) && (
              <div className="mb-4 p-2 bg-blue-900/30 border border-blue-500/30 rounded-lg">
                <p className="text-sm text-blue-300">
                  Currently: Part {activeSurvey.partOrdinal} of {activeSurvey.surveyTitle}
                </p>
              </div>
            )}

            <div className="space-y-3 mb-4">
              {/* Option 1: Complete Survey */}
              <button
                onClick={() => {
                  setShowCloseDialog(false);
                  setCloseMode('complete');
                }}
                className="w-full p-4 bg-gray-700/50 border border-gray-600 rounded-lg hover:border-green-500/50 transition-colors text-left"
                data-testid="button-select-complete"
              >
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-6 h-6 text-green-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="font-semibold text-green-400">Complete Survey</h4>
                    <p className="text-sm text-gray-400 mt-1">
                      Survey is finished. Save, export, and mark as completed.
                    </p>
                  </div>
                </div>
              </button>

              {/* Option 2: End Day (Pause) */}
              <button
                onClick={() => {
                  setShowCloseDialog(false);
                  setCloseMode('end_of_day');
                }}
                className="w-full p-4 bg-gray-700/50 border border-gray-600 rounded-lg hover:border-amber-500/50 transition-colors text-left"
                data-testid="button-select-end-day"
              >
                <div className="flex items-start gap-3">
                  <Moon className="w-6 h-6 text-amber-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="font-semibold text-amber-400">End Day (Pause Survey)</h4>
                    <p className="text-sm text-gray-400 mt-1">
                      Save and pause overnight. Resume tomorrow — logs a day-boundary marker on resume.
                    </p>
                  </div>
                </div>
              </button>

              {/* Option 3: Continue Later (Part N) */}
              <button
                onClick={() => {
                  setShowCloseDialog(false);
                  setCloseMode('continue');
                }}
                className="w-full p-4 bg-gray-700/50 border border-gray-600 rounded-lg hover:border-blue-500/50 transition-colors text-left"
                data-testid="button-select-continue"
              >
                <div className="flex items-start gap-3">
                  <RefreshCw className="w-6 h-6 text-blue-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="font-semibold text-blue-400">
                      Continue Later (Part {(activeSurvey.partOrdinal || 1) + 1})
                    </h4>
                    <p className="text-sm text-gray-400 mt-1">
                      Close this part and create a new survey to continue.
                    </p>
                  </div>
                </div>
              </button>
            </div>

            <button
              onClick={() => setShowCloseDialog(false)}
              className="w-full px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium transition-colors"
              data-testid="button-cancel-close-survey"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Close Survey Options Dialog - Step 2: Choose what actions to perform */}
      <SurveyCloseOptionsDialog
        isOpen={closeMode !== null}
        onClose={() => setCloseMode(null)}
        survey={activeSurvey}
        mode={closeMode || 'complete'}
      />

      {/* Email Dialog */}
      {showEmailDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowEmailDialog(false)}>
          <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full m-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-bold mb-4">Email Survey Report</h3>
            <p className="text-gray-300 mb-4">
              Send survey completion report with CSV, JSON, and GeoJSON attachments
            </p>
            {getSurveyEmailRecipients().to.length > 0 && (
              <div className="mb-4 p-3 bg-blue-900/30 border border-blue-500/30 rounded-lg">
                <p className="text-sm text-blue-300">
                  Configured recipients: {getSurveyEmailRecipients().to.join(', ')}
                </p>
              </div>
            )}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Additional Recipient (optional)</label>
              <input
                type="email"
                value={additionalEmail}
                onChange={(e) => setAdditionalEmail(e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="optional@email.com"
                data-testid="input-survey-email"
              />
              <p className="text-xs text-gray-400 mt-1">
                Leave empty to send only to configured recipients
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleEmailSurvey}
                disabled={sendingEmail}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-4 py-2 rounded-lg font-medium transition-colors"
                data-testid="button-send-survey-email"
              >
                {sendingEmail ? 'Sending...' : 'Send Email'}
              </button>
              <button
                onClick={() => setShowEmailDialog(false)}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium transition-colors"
                data-testid="button-cancel-survey-email"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SurveyActions;