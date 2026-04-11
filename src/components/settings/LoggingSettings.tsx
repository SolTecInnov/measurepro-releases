import React from 'react';
import { FileText, Plus, Save, Clock, FolderInput, CheckCircle, Calendar, AlertTriangle, RefreshCw } from 'lucide-react';
import { useSettingsStore } from '../../lib/settings';
import { useSurveyStore } from '../../lib/survey';
import { autoSaveSurvey } from '../../lib/utils/autoSaveUtils';
import SurveyCreationDialog from '../SurveyCreationDialog';
import { getSafeAuth } from '../../lib/firebase';
import { isBetaUser } from '../../lib/auth/masterAdmin';
import { useEnabledFeatures } from '../../hooks/useLicenseEnforcement';
import { getAutoPartManager } from '../../lib/survey/AutoPartManager';

const LoggingSettings = () => {
  const [showSurveyDialog, setShowSurveyDialog] = React.useState(false);
  const { activeSurvey } = useSurveyStore();
  
  // Beta user detection for UI simplification
  const { features } = useEnabledFeatures();
  const auth = getSafeAuth();
  const isBeta = isBetaUser(auth?.currentUser, features);
  const [autoSaveInterval, setAutoSaveInterval] = React.useState<number>(60);
  const [autoSaveEnabled, setAutoSaveEnabled] = React.useState<boolean>(true);
  const [autoSaveFilename, setAutoSaveFilename] = React.useState<string>('');
  const [autoSaveWithImages, setAutoSaveWithImages] = React.useState<boolean>(true);
  const [autoSavePartNumber, setAutoSavePartNumber] = React.useState<number>(0);
  const [lastSaveTime, setLastSaveTime] = React.useState<string | null>(null);
  const [lastSaveStatus, setLastSaveStatus] = React.useState<'success' | 'error' | null>(null);
  const [autoCloseEnabled, setAutoCloseEnabled] = React.useState<boolean>(true);
  const [autoCloseThreshold, setAutoCloseThreshold] = React.useState<number>(200);
  const { loggingSettings, setLoggingSettings } = useSettingsStore();

  const commonInputClasses = "w-full px-3 py-2 bg-gray-700 border border-gray-600 text-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500";

  // Save auto-save settings to localStorage
  React.useEffect(() => {
    localStorage.setItem('autoSaveEnabled', autoSaveEnabled.toString());
    localStorage.setItem('autoSaveInterval', autoSaveInterval.toString());
    localStorage.setItem('autoSaveFilename', autoSaveFilename);
    localStorage.setItem('autoSaveWithImages', autoSaveWithImages.toString());
  }, [autoSaveEnabled, autoSaveInterval, autoSaveFilename]);

  // Load auto-save settings from localStorage
  React.useEffect(() => {
    const savedAutoSaveEnabled = localStorage.getItem('autoSaveEnabled');
    const savedAutoSaveInterval = localStorage.getItem('autoSaveInterval');
    const savedAutoSaveFilename = localStorage.getItem('autoSaveFilename');
    const savedAutoSaveWithImages = localStorage.getItem('autoSaveWithImages');
    const savedLastSaveTime = localStorage.getItem('lastSaveTime');
    const savedLastSaveStatus = localStorage.getItem('lastSaveStatus');
    
    // Default to true if not set
    if (savedAutoSaveEnabled === null) {
      setAutoSaveEnabled(true);
      localStorage.setItem('autoSaveEnabled', 'true');
    } else {
      setAutoSaveEnabled(savedAutoSaveEnabled === 'true');
    }
    
    // Default to true if not set
    if (savedAutoSaveWithImages === null) {
      setAutoSaveWithImages(true);
      localStorage.setItem('autoSaveWithImages', 'true');
    } else {
      setAutoSaveWithImages(savedAutoSaveWithImages === 'true');
    }
    
    // Default to 60 minutes (1 hour) if not set
    if (savedAutoSaveInterval === null) {
      setAutoSaveInterval(60);
      localStorage.setItem('autoSaveInterval', '60');
    } else {
      setAutoSaveInterval(parseInt(savedAutoSaveInterval) || 60);
    }
    
    // Load part number from localStorage
    if (activeSurvey) {
      const partKey = `autoSave_partNumber_${activeSurvey.id}`;
      const savedPartNumber = localStorage.getItem(partKey);
      setAutoSavePartNumber(savedPartNumber ? parseInt(savedPartNumber) : 0);
    }
    
    // Filename is now auto-generated based on survey title
    if (savedAutoSaveFilename) {
      setAutoSaveFilename(savedAutoSaveFilename);
    }
    
    // Load last save time and status if available
    if (savedLastSaveTime) {
      setLastSaveTime(savedLastSaveTime);
    }
    
    if (savedLastSaveStatus) {
      setLastSaveStatus(savedLastSaveStatus as 'success' | 'error');
    }
  }, []);
  
  // Set up a listener for autosave events
  React.useEffect(() => {
    const handleAutoSave = (_event: CustomEvent) => {
      setLastSaveTime(new Date().toLocaleString());
      setLastSaveStatus('success');
      
      // Store in localStorage
      localStorage.setItem('lastSaveTime', new Date().toLocaleString());
      localStorage.setItem('lastSaveStatus', 'success');
    };
    
    // Listen for custom autosave event
    window.addEventListener('autosave-complete' as any, handleAutoSave);
    
    return () => {
      window.removeEventListener('autosave-complete' as any, handleAutoSave);
    };
  }, []);

  // Load auto-close settings from AutoPartManager
  React.useEffect(() => {
    const manager = getAutoPartManager();
    setAutoCloseEnabled(manager.isEnabled());
    setAutoCloseThreshold(manager.getThreshold());
  }, []);

  // Sync auto-close settings to AutoPartManager
  React.useEffect(() => {
    const manager = getAutoPartManager();
    manager.setEnabled(autoCloseEnabled);
    manager.setThreshold(autoCloseThreshold);
  }, [autoCloseEnabled, autoCloseThreshold]);

  return (
    <div className="bg-gray-800 rounded-xl p-6">
      <h2 className="text-xl font-semibold mb-4">Logging Settings</h2>
      <div className="space-y-6">
        {/* Edit Survey button - hidden for beta users (available in Home tab) */}
        {!isBeta && (
          <button
            onClick={() => setShowSurveyDialog(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
          >
            <Plus className="w-5 h-5" />
            {activeSurvey ? 'Edit Current Survey' : 'New Survey'}
          </button>
        )}

        {/* Current Survey info - hidden for beta users (available in Home tab) */}
        {!isBeta && activeSurvey && (
          <div className="bg-gray-700 rounded-lg p-4">
            <h3 className="text-lg font-medium mb-4">Current Survey</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-gray-400">Survey Name</label>
                <div className="font-medium">{activeSurvey.name || activeSurvey.surveyTitle}</div>
              </div>
              <div>
                <label className="text-sm text-gray-400">Surveyor</label>
                <div className="font-medium">{activeSurvey.surveyor || activeSurvey.surveyorName}</div>
              </div>
              <div>
                <label className="text-sm text-gray-400">Origin Address</label>
                <div className="font-medium">{activeSurvey.originAddress}</div>
              </div>
              <div>
                <label className="text-sm text-gray-400">Destination Address</label>
                <div className="font-medium">{activeSurvey.destinationAddress}</div>
              </div>
              <div className="col-span-2">
                <label className="text-sm text-gray-400">Description</label>
                <div className="font-medium">{activeSurvey.description}</div>
              </div>
              <div className="col-span-2">
                <label className="text-sm text-gray-400">Output Files</label>
                <div className="font-medium">
                  {activeSurvey.outputFiles && activeSurvey.outputFiles.length > 0 
                    ? activeSurvey.outputFiles.join(', ') 
                    : 'CSV, JSON, GeoJSON'}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Auto-save Settings */}
        <div className="bg-blue-900/20 border border-blue-800/30 rounded-lg p-4 mt-6">
          <div className="flex items-center gap-3 mb-4">
            <Save className="w-5 h-5 text-blue-400" />
            <h3 className="text-lg font-semibold">Auto-save Settings</h3>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={autoSaveEnabled}
                  onChange={(e) => {
                    setAutoSaveEnabled(e.target.checked);
                    localStorage.setItem('autoSaveEnabled', e.target.checked.toString());
                    
                    // If enabling auto-save, trigger an immediate save
                    if (e.target.checked && activeSurvey) {
                      autoSaveSurvey(activeSurvey);
                    }
                  }}
                  className="rounded border-gray-600"
                />
                <span className="text-sm text-gray-300">Enable automatic saving</span>
              </label>
              
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-400" />
                <span className="text-sm text-gray-300">Every</span>
                <select
                  value={autoSaveInterval}
                  onChange={(e) => {
                    const interval = parseInt(e.target.value);
                    setAutoSaveInterval(interval);
                    localStorage.setItem('autoSaveInterval', interval.toString());
                    window.dispatchEvent(new StorageEvent('storage', { key: 'autoSaveInterval', newValue: interval.toString() }));
                  }}
                  className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm"
                  disabled={!autoSaveEnabled}
                >
                  <option value="15">15 minutes</option>
                  <option value="30">30 minutes</option>
                  <option value="60">1 hour</option>
                  <option value="120">2 hours</option>
                </select>
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={autoSaveWithImages}
                  onChange={(e) => {
                    setAutoSaveWithImages(e.target.checked);
                    localStorage.setItem('autoSaveWithImages', e.target.checked.toString());
                  }}
                  className="rounded border-gray-600"
                  disabled={!autoSaveEnabled}
                />
                <span className="text-sm text-gray-300">Include images in auto-save</span>
              </label>
              <div className="text-xs text-gray-400">
                {autoSaveWithImages ? 'ZIP with images' : 'CSV only (faster)'}
              </div>
            </div>
            
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                <FolderInput className="w-4 h-4 text-blue-400" />
                Auto-save Filename Format
              </label>
              <div className="bg-gray-700/50 border border-gray-600 rounded-lg p-3">
                <p className="text-sm text-gray-300 font-mono">
                  {(activeSurvey?.surveyTitle || activeSurvey?.name || 'Survey_Name').replace(/[^a-zA-Z0-9\s-]/g, '').replace(/\s+/g, '_').substring(0, 30)}_{new Date().toISOString().split('T')[0]}_{new Date().toTimeString().split(' ')[0].replace(/:/g, '-')}_part{autoSavePartNumber}.zip
                </p>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                Format: {'{SurveyTitle}_{Date}_{Time}_part{N}.zip'}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Each auto-save creates a new part number. ZIP includes: POIs, images, videos, and drawings.
              </p>
              
              {/* Last Save Information */}
              {lastSaveTime && (
                <div className={`mt-4 p-3 rounded-lg ${
                  lastSaveStatus === 'success' ? 'bg-green-500/20 border border-green-500/30' : 
                  lastSaveStatus === 'error' ? 'bg-red-500/20 border border-red-500/30' : 
                  'bg-gray-700/50'
                }`}>
                  <div className="flex items-center gap-2 mb-1">
                    {lastSaveStatus === 'success' ? (
                      <CheckCircle className="w-4 h-4 text-green-400" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-red-400" />
                    )}
                    <h4 className="font-medium text-sm">
                      {lastSaveStatus === 'success' ? 'Last Autosave Successful' : 'Autosave Failed'}
                    </h4>
                  </div>
                  
                  <div className="flex items-center gap-2 text-xs text-gray-300 mt-1">
                    <Calendar className="w-3 h-3 text-gray-400" />
                    <span>{lastSaveTime}</span>
                  </div>
                  
                  <div className="text-xs text-gray-400 mt-2">
                    Last saved file includes all POIs, images, videos, and drawings
                  </div>
                </div>
              )}
            </div>
            
            <div className="text-sm text-gray-400">
              <p>Auto-save ensures your measurements are regularly saved {autoSaveWithImages ? 'with images in a ZIP package' : 'to a CSV file'}, even if the app crashes or the page is accidentally closed.</p>
            </div>
            
            <div className="bg-gray-700/50 p-3 rounded text-sm">
              <h4 className="font-medium text-blue-400 mb-2">Data Preservation Strategy</h4>
              <ul className="space-y-1 text-gray-300">
                <li>• All measurements are saved to IndexedDB</li>
                <li>• Enhanced CSV files include image/video filename mapping</li>
                <li>• Auto-save exports {autoSaveWithImages ? 'complete ZIP packages with images' : 'CSV files with image references'}</li>
                <li>• Images are named by POI: image_[Road]_POI[Number]_[Type]_[ID].jpg</li>
                <li>• Manual export is available at any time</li>
                <li>• Surveys can be closed and reopened with all data intact</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Auto-Close Settings */}
        <div className="bg-green-900/20 border border-green-800/30 rounded-lg p-4 mt-6">
          <div className="flex items-center gap-3 mb-4">
            <RefreshCw className="w-5 h-5 text-green-400" />
            <h3 className="text-lg font-semibold">Auto-Close Settings</h3>
          </div>
          
          <p className="text-sm text-gray-400 mb-4">
            Automatically save and start a new survey part after a set number of POIs to prevent data loss and manage memory.
          </p>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={autoCloseEnabled}
                  onChange={(e) => setAutoCloseEnabled(e.target.checked)}
                  className="rounded border-gray-600"
                  data-testid="checkbox-auto-close-enabled"
                />
                <span className="text-sm text-gray-300">Enable auto-close</span>
              </label>
            </div>
            
            <div>
              <label className="block text-sm text-gray-400 mb-1">
                Auto-save after this many POIs
              </label>
              <input
                type="number"
                min={100}
                max={1000}
                step={50}
                value={autoCloseThreshold}
                onChange={(e) => setAutoCloseThreshold(Math.max(100, Math.min(1000, parseInt(e.target.value) || 200)))}
                disabled={!autoCloseEnabled}
                className={commonInputClasses}
                data-testid="input-auto-close-threshold"
              />
              <p className="text-xs text-gray-500 mt-1">
                Range: 100-1000 POIs. Lower values save more frequently.
              </p>
            </div>
            
            <div className="bg-gray-700/50 p-3 rounded text-sm">
              <h4 className="font-medium text-green-400 mb-2">How it works</h4>
              <ul className="space-y-1 text-gray-300">
                <li>• When POI count reaches threshold, survey is automatically saved</li>
                <li>• A new part is created seamlessly without interrupting laser/GPS</li>
                <li>• Data is uploaded to cloud if configured</li>
                <li>• Email notification sent if enabled</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Export Format</label>
            <select
              value={loggingSettings.exportFormat}
              onChange={(e) => setLoggingSettings({
                ...loggingSettings,
                exportFormat: e.target.value
              })}
              className={commonInputClasses}
            >
              <option value="csv">CSV</option>
              <option value="json">JSON</option>
              <option value="xlsx">Excel (XLSX)</option>
            </select>
          </div>

          <div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={loggingSettings.autoExport}
                onChange={(e) => setLoggingSettings({
                  autoExport: e.target.checked
                })}
                className="rounded border-gray-600"
                data-testid="checkbox-auto-export"
              />
              <span className="text-sm text-gray-300">Auto-export on survey completion</span>
            </label>
            <p className="text-xs text-gray-400 mt-1 ml-6">
              Automatically exports survey data when closing a survey to prevent data loss
            </p>
          </div>

          <div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={loggingSettings?.emailNotifications !== false}
                onChange={(e) => setLoggingSettings({
                  emailNotifications: e.target.checked
                })}
                className="rounded border-gray-600"
                data-testid="checkbox-email-notifications"
              />
              <span className="text-sm text-gray-300">Cloud sync email notifications</span>
            </label>
            <p className="text-xs text-gray-400 mt-1 ml-6">
              Receive email notifications when cloud sync completes or fails (max 5 emails per 24 hours)
            </p>
          </div>
        </div>

        {/* Timelapse POI Filter - MeasurePRO+ only */}
        {!isBeta && (
          <div className="bg-purple-900/20 border border-purple-800/30 rounded-lg p-4 mt-6">
            <div className="flex items-center gap-3 mb-4">
              <FileText className="w-5 h-5 text-purple-400" />
              <h4 className="font-medium text-purple-300">Timelapse POI Filter</h4>
            </div>

            <p className="text-sm text-gray-400 mb-4">
              Highlight selected POI types in timelapse recordings. Leave empty to include all types.
            </p>
            
            <div className="grid grid-cols-2 gap-4">
              {[
                { value: 'Bridge', label: 'Bridge/Overpass' },
                { value: 'Power Lines', label: 'Power Lines' },
                { value: 'Trees', label: 'Trees/Vegetation' },
                { value: 'Traffic Sign', label: 'Traffic Signs' },
                { value: 'Utility Pole', label: 'Utility Poles' },
                { value: 'Wire', label: 'Wire/Cable' },
                { value: 'Other', label: 'Other' }
              ].map((poiType) => (
                <div key={poiType.value}>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={(loggingSettings.timelapseEnabledPOITypes || []).includes(poiType.value)}
                      onChange={(e) => {
                        const currentTypes = loggingSettings.timelapseEnabledPOITypes || [];
                        const newTypes = e.target.checked
                          ? [...currentTypes, poiType.value]
                          : currentTypes.filter(t => t !== poiType.value);
                        setLoggingSettings({
                          ...loggingSettings,
                          timelapseEnabledPOITypes: newTypes
                        });
                      }}
                      className="rounded border-gray-600"
                      data-testid={`checkbox-poi-${poiType.value.toLowerCase().replace(/\s+/g, '-')}`}
                    />
                    <span className="text-sm text-gray-300">{poiType.label}</span>
                  </label>
                </div>
              ))}
            </div>
            
            <div className="mt-4 text-xs text-gray-400">
              {loggingSettings.timelapseEnabledPOITypes && loggingSettings.timelapseEnabledPOITypes.length > 0 
                ? `${loggingSettings.timelapseEnabledPOITypes.length} POI type(s) selected`
                : 'All POI types enabled (backward compatible)'}
            </div>
          </div>
        )}

        <SurveyCreationDialog
          isOpen={showSurveyDialog}
          onClose={() => setShowSurveyDialog(false)}
          editMode={!!activeSurvey}
        />
      </div>
    </div>
  );
};

export default LoggingSettings;