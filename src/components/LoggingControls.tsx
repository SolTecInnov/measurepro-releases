import React, { useRef } from 'react';
import { toast } from 'sonner';
import { Edit, Trash2 } from 'lucide-react';
import { useSerialStore } from '../lib/stores/serialStore';
import { useSurveyStore } from '../lib/survey';
import { useMeasurementLogger } from '../hooks/useMeasurementLogger';
import { soundManager } from '../lib/sounds';
import { useCameraStore } from '../lib/camera';
import { useGPSStore } from '../lib/stores/gpsStore';
import { useLaserStore } from '../lib/laser';
import { usePOIStore, type POIType } from '../lib/poi';
import { useEnabledFeatures } from '../hooks/useLicenseEnforcement';
import { useBluetoothStore } from '../lib/bluetooth/bluetoothStore';

// Import the helper function from laserUtils
import { isInvalidMeasurement } from '../lib/utils/laserUtils';
import ManualLogEntryModal from './ManualLogEntryModal';
import GroundReferenceConfirmModal from './GroundReferenceConfirmModal';

interface LoggingControlsProps {
  loggingMode: 'manual' | 'all' | 'detection' | 'manualDetection' | 'counterDetection';
  setLoggingMode: (mode: 'manual' | 'all' | 'detection' | 'manualDetection' | 'counterDetection') => void;
  isLogging: boolean;
  setIsLogging: (isLogging: boolean) => void;
  startLogging: () => void;
  stopLogging: () => void;
  handleCaptureImage: () => void;
  pendingPhotos: string[];
  setPendingPhotos: (photos: string[]) => void;
  setShowSurveyDialog: (show: boolean) => void;
  setOfflineItems: (items: number | ((prev: number) => number)) => void;
  selectedPOIType: string;
  videoRef?: React.RefObject<HTMLVideoElement>;
  showManualLogModal?: boolean;
  setShowManualLogModal?: (show: boolean) => void;
  preSelectedPOIType?: POIType | null;
  setPreSelectedPOIType?: (type: POIType | null) => void;
  handleDeleteLastEntry?: () => void;
  measurementCount?: number;
}

const LoggingControls: React.FC<LoggingControlsProps> = ({
  loggingMode,
  setLoggingMode,
  isLogging,
  setIsLogging,
  startLogging: externalStartLogging,
  stopLogging,
  handleCaptureImage,
  pendingPhotos,
  setPendingPhotos,
  setShowSurveyDialog,
  setOfflineItems,
  selectedPOIType,
  videoRef,
  showManualLogModal,
  setShowManualLogModal,
  preSelectedPOIType,
  setPreSelectedPOIType,
  handleDeleteLastEntry,
  measurementCount = 0
}) => {
  const { laserPort, gpsPort, lastMeasurement } = useSerialStore();
  const { data: gpsData, connected: gpsStoreConnected } = useGPSStore();
  const { activeSurvey } = useSurveyStore();
  const { groundReferenceHeight } = useLaserStore();
  const { hasFeature } = useEnabledFeatures();
  
  const { laserStatus: btLaserStatus, gpsStatus: btGpsStatus } = useBluetoothStore();
  
  const isWiredLaserConnected = laserPort !== null;
  const isWiredGpsConnected = gpsPort !== null;
  const isBluetoothLaserConnected = btLaserStatus === 'connected';
  const isBluetoothGpsConnected = btGpsStatus === 'connected';
  // Duro/GNSS is connected when gpsStore reports connected AND source is 'duro'
  const isDuroConnected = gpsStoreConnected && gpsData.source === 'duro';
  // Device GPS failsafe is equivalent to hardware GPS for logging purposes
  const isBrowserGpsConnected = gpsStoreConnected && gpsData.source === 'browser';

  const hasLaserConnection = isWiredLaserConnected || isBluetoothLaserConnected;
  // GPS connection can be from USB, Bluetooth, Duro/GNSS, OR browser failsafe
  const hasGpsConnection = isWiredGpsConnected || isBluetoothGpsConnected || isDuroConnected || isBrowserGpsConnected;
  
  // PERFORMANCE FIX: Use worker-based measurement logging
  const { logMeasurement: logMeasurementViaWorker } = useMeasurementLogger();
  
  // Add refs for logging control
  const stopRequested = useRef(false);
  const isDetectingObject = useRef(false);
  const measurementBuffer = useRef<string[]>([]);
  
  // Use external modal state if provided, otherwise fall back to internal state
  const [internalShowModal, setInternalShowModal] = React.useState(false);
  const [internalPreSelectedType, setInternalPreSelectedType] = React.useState<POIType | null>(null);
  
  const showManualEntryModal = showManualLogModal !== undefined ? showManualLogModal : internalShowModal;
  const setShowManualEntryModal = setShowManualLogModal || setInternalShowModal;
  const currentPreSelectedPOIType = preSelectedPOIType !== undefined ? preSelectedPOIType : internalPreSelectedType;
  const setCurrentPreSelectedPOIType = setPreSelectedPOIType || setInternalPreSelectedType;

  // Ground reference confirmation modal
  const [showGroundRefModal, setShowGroundRefModal] = React.useState(false);
  const [pendingLoggingStart, setPendingLoggingStart] = React.useState(false);

  // Listen for voice command to open manual log entry
  React.useEffect(() => {
    const handleVoiceManualLog = () => {
      setShowManualEntryModal(true);
    };

    window.addEventListener('voice-manual-log', handleVoiceManualLog);
    return () => window.removeEventListener('voice-manual-log', handleVoiceManualLog);
  }, []);

  // Capture image and wait for it to be processed
  const captureAndWait = async () => {
    await handleCaptureImage();
    await new Promise(resolve => setTimeout(resolve, 300));
  };

  // Handle logging mode changes
  const handleLoggingModeChange = (mode: 'manual' | 'all' | 'detection' | 'manualDetection' | 'counterDetection') => {
    
    // CRITICAL: Block all non-manual modes if ground reference is zero
    // Ground reference can NEVER be 0 in real-world usage - laser is always mounted above ground
    if (mode !== 'manual' && groundReferenceHeight === 0) {
      toast.error('Ground Reference Required', {
        description: 'Please set the ground reference height before starting. The laser is mounted above ground level.',
        duration: 6000,
        action: {
          label: 'Set Ground Ref',
          onClick: () => {
            // Scroll to the ground reference input in settings
            const groundRefInput = document.querySelector('[data-testid="input-ground-reference"]');
            if (groundRefInput) {
              groundRefInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
              (groundRefInput as HTMLInputElement).focus();
            } else {
              // Try to find by placeholder or label
              const inputs = document.querySelectorAll('input[type="number"]');
              inputs.forEach(input => {
                if (input.getAttribute('placeholder')?.includes('Ground') || 
                    input.closest('label')?.textContent?.includes('Ground')) {
                  input.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  (input as HTMLInputElement).focus();
                }
              });
            }
          }
        }
      });
      return;
    }
    
    // Object Detection mode can work without a survey (detection only, no logging)
    if (!activeSurvey && mode !== 'manual' && mode !== 'counterDetection') {
      toast.error('Please create a survey first', {
        description: 'Automated logging modes require an active survey. Manual mode works independently.',
        action: {
          label: 'Create Survey',
          onClick: () => {
            setShowSurveyDialog(true);
            setTimeout(() => {
              const surveyButton = document.querySelector('.animate-pulse');
              if (surveyButton) {
                surveyButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }
            }, 100);
          }
        }
      });
      return;
    }
    
    if (!activeSurvey && mode === 'manual') {
      // PERFORMANCE: Removed toast notification (user requested)
    }
    
    if (!activeSurvey && mode === 'counterDetection') {
      // toast suppressed
    }
    
    if ((mode === 'all' || mode === 'detection' || mode === 'manualDetection' || mode === 'counterDetection') && (!hasLaserConnection || !hasGpsConnection)) {
      toast.error('Connection required', {
        description: 'Both Laser and GPS must be connected (wired or Bluetooth) for automated logging modes.',
        action: {
          label: 'Connect Devices',
          onClick: () => {
            const connectionSection = document.querySelector('.bg-gray-800');
            if (connectionSection) {
              connectionSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
          }
        }
      });
      return;
    }
    
    setLoggingMode(mode);
    // CRITICAL: Save to localStorage so Detection Manager can respect manual mode
    localStorage.setItem('loggingMode', mode);
    stopRequested.current = false;
    
    if (mode === 'manual') {
      stopLogging();
    } else if (mode === 'all' || mode === 'detection' || mode === 'manualDetection' || mode === 'counterDetection') {
      // Call the external startLogging function from useMeasurementLogging
      // This properly initializes all state and resets stopRequested.current
      externalStartLogging();
    }
  };

  // Log ground reference measurement
  const logGroundReference = async () => {
    if (!activeSurvey || !gpsData) return;
    
    try {
      const groundRefEntry = {
        id: crypto.randomUUID(),
        user_id: activeSurvey.id,
        survey_id: activeSurvey.id,
        rel: groundReferenceHeight,
        altGPS: gpsData.altitude,
        latitude: gpsData.latitude,
        longitude: gpsData.longitude,
        utcDate: new Date().toISOString().split('T')[0],
        utcTime: new Date().toTimeString().split(' ')[0],
        speed: gpsData.speed,
        heading: gpsData.course,
        roadNumber: null,
        poiNumber: null,
        poi_type: 'information',
        note: `GROUND REFERENCE HEIGHT: ${(groundReferenceHeight ?? 0).toFixed(3)}m (${((groundReferenceHeight ?? 0) * 3.28084).toFixed(3)}ft) - Logged at start of survey session`,
        imageUrl: null,
        videoUrl: null,
        createdAt: new Date().toISOString(),
        source: 'manual'
      };
      
      await logMeasurementViaWorker(groundRefEntry);
      
      // PERFORMANCE: Removed toast notification (user requested)
    } catch (error) {
      console.error('Failed to log ground reference:', error);
      toast.error('Failed to log ground reference');
    }
  };

  // Handle ground reference confirmation
  const handleGroundRefConfirm = async () => {
    setShowGroundRefModal(false);
    
    // Log the ground reference measurement
    await logGroundReference();
    
    // Continue with starting logging
    if (pendingLoggingStart) {
      setPendingLoggingStart(false);
      setIsLogging(true);
      // PERFORMANCE: Removed toast notification (user requested)
    }
  };

  const handleGroundRefCancel = () => {
    setShowGroundRefModal(false);
    setPendingLoggingStart(false);
  };

  // Start logging measurements
  const startLogging = () => {
    
    if (!activeSurvey) {
      toast.error('Please create a survey first');
      return;
    }

    // Check device connections for automated modes (wired OR Bluetooth)
    if ((loggingMode === 'all' || loggingMode === 'detection') && (!hasLaserConnection || !hasGpsConnection)) {
      toast.error('Connection required', {
        description: 'Both Laser and GPS must be connected (wired or Bluetooth) for automated logging modes.',
        action: {
          label: 'Connect Devices',
          onClick: () => {
            const connectionSection = document.querySelector('.bg-gray-800');
            if (connectionSection) {
              connectionSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
          }
        }
      });
      return;
    }

    setIsLogging(true);
    stopRequested.current = false;
    
    if (loggingMode === 'manual') {
      logMeasurement();
    } else if (loggingMode === 'all') {
      // For 'all' mode, we'll log measurements as they come in
      // PERFORMANCE: Removed toast notification (user requested)
    } else if (loggingMode === 'detection') {
      // For 'detection' mode, we'll monitor for object detection
      // PERFORMANCE: Removed toast notification (user requested)
      // Reset detection state
      isDetectingObject.current = false;
      measurementBuffer.current = [];
    }
  };


  // Handle manual logging
  const handleManualLog = async () => {
    
    if (!activeSurvey) {
      // Log independent measurement
      window.dispatchEvent(new CustomEvent('log-independent-measurement'));
      return;
    }
    
    if (!activeSurvey) {
      toast.error('Please create a survey first', {
        description: 'Please create a new survey before logging measurements.',
        action: {
          label: 'Create Survey',
          onClick: () => {
            setShowSurveyDialog(true);
          }
        }
      });
      return;
    }

    if (isInvalidMeasurement(lastMeasurement)) {
      toast.error('Invalid measurement', {
        description: 'Please ensure the laser is measuring a valid distance.'
      });
      return;
    }

    // Get the current POI type from the store
    
    if (pendingPhotos.length === 0) {
      await captureAndWait();
    }
    
    // Get the current road number from SurveyManager component
    const surveyManagerElement = document.querySelector('select[value]');
    let currentRoadNumber = 1;
    try {
      if (surveyManagerElement) {
        currentRoadNumber = parseInt((surveyManagerElement as HTMLSelectElement).value);
      }
    } catch (err) {
    }
    
    // Generate POI number (random for now, ideally should be sequential)
    const poiNumber = Math.floor(Math.random() * 10000);
    
    console.log(`[LoggingControls] About to create measurement with POI type: "${selectedPOIType}"`);
    
    const newMeasurement = {
      id: crypto.randomUUID(),
      rel: parseFloat(lastMeasurement) + groundReferenceHeight,  // All values now in meters, just add ground reference
      altGPS: gpsData.altitude,
      latitude: gpsData.latitude,
      longitude: gpsData.longitude,
      utcDate: new Date().toISOString().split('T')[0],
      utcTime: new Date().toTimeString().split(' ')[0],
      speed: gpsData.speed,
      heading: gpsData.course,
      roadNumber: currentRoadNumber,
      poiNumber,
      poi_type: selectedPOIType, 
      imageUrl: pendingPhotos[pendingPhotos.length - 1] || null,
      note: `Manual measurement (${selectedPOIType})`,
      createdAt: new Date().toISOString(),
      user_id: activeSurvey.id
    };
    
    console.log(`[LoggingControls] Created measurement object:`, { id: newMeasurement.id, poi_type: newMeasurement.poi_type });

    try {
      // PERFORMANCE FIX: Use worker-based logging for off-thread, batched writes
      await logMeasurementViaWorker(newMeasurement);
      setOfflineItems(prev => prev + 1);
      // Clear all pending photos
      setPendingPhotos([]);
      soundManager.playLogEntry();
      // Toast notification disabled per user request
      // // toast suppressed
    } catch (error) {
      toast.error('Failed to log measurement');
    }
  };

  return (
    <div className="bg-gray-800 p-4 rounded-xl h-full">
      <h3 className="text-sm font-medium text-gray-400 mb-2">Logging Mode</h3>
      <div className="grid grid-cols-5 gap-2 mb-4">
        <div className="relative">
          <button
            onClick={() => handleLoggingModeChange('manual')}
            title="Manual Mode - Log current measurement when you click the button"
            className={`w-full flex flex-col items-center justify-center p-2 rounded-lg transition-colors text-xs ${
              loggingMode === 'manual' ? 'bg-emerald-600' : 'bg-gray-700 hover:bg-gray-600'
            }`}
            data-testid="button-logging-manual"
          >
            <span className="font-medium">Manual</span>
          </button>
        </div>
        
        <div className="relative">
          <button
            onClick={() => handleLoggingModeChange('all')}
            title="All Data Mode - Automatically log all measurements continuously"
            className={`w-full flex flex-col items-center justify-center p-2 rounded-lg transition-colors text-xs ${
              loggingMode === 'all' ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'
            } ${(!hasLaserConnection || !hasGpsConnection) ? 'opacity-50' : ''}`}
            data-testid="button-logging-all"
          >
            <span className="font-medium">All Data</span>
          </button>
          {(!hasLaserConnection || !hasGpsConnection) && (
            <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs px-1 py-0.5 rounded-full">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            </div>
          )}
        </div>
        
        {/* AI Detection Mode - Coming Soon (disabled) */}
        <div className="relative">
          <button
            disabled
            title="AI Detection — coming soon"
            className="w-full flex flex-col items-center justify-center p-2 rounded-lg transition-colors text-xs bg-gray-800 opacity-40 cursor-not-allowed"
            data-testid="button-logging-detection"
          >
            <span className="font-medium text-gray-500">AI Detec.</span>
          </button>
        </div>
        
        {/* Buffer Detection Mode - Available to ALL users */}
        <div className="relative">
          <button
            onClick={() => handleLoggingModeChange('manualDetection')}
            title="Buffer Detection Mode - Buffers measurements over distance/time to find lowest point"
            className={`w-full flex flex-col items-center justify-center p-2 rounded-lg transition-colors text-xs ${
              loggingMode === 'manualDetection' ? 'bg-teal-600' : 'bg-gray-700 hover:bg-gray-600'
            } ${(!hasLaserConnection || !hasGpsConnection) ? 'opacity-50' : ''}`}
            data-testid="button-logging-buffer-detection"
          >
            <span className="font-medium">Buffer Det</span>
          </button>
          {(!hasLaserConnection || !hasGpsConnection) && (
            <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs px-1 py-0.5 rounded-full">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            </div>
          )}
        </div>
        
        {/* Counter Detection Mode - Available to ALL users including beta */}
        <div className="relative">
          <button
            onClick={() => handleLoggingModeChange('counterDetection')}
            title="Counter Detection Mode - Counter-based debouncing for overhead detection"
            className={`w-full flex flex-col items-center justify-center p-2 rounded-lg transition-colors text-xs ${
              loggingMode === 'counterDetection' ? 'bg-amber-600' : 'bg-gray-700 hover:bg-gray-600'
            } ${(!hasLaserConnection || !hasGpsConnection) ? 'opacity-50' : ''}`}
            data-testid="button-logging-counter-detection"
          >
            <span className="font-medium">Counter Det.</span>
          </button>
          {(!hasLaserConnection || !hasGpsConnection) && (
            <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs px-1 py-0.5 rounded-full">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            </div>
          )}
        </div>
      </div>
      
      <ManualLogEntryModal
        isOpen={showManualEntryModal}
        onClose={() => {
          setShowManualEntryModal(false);
          setCurrentPreSelectedPOIType(null);
        }}
        videoRef={videoRef}
        setOfflineItems={setOfflineItems}
        preSelectedPOIType={currentPreSelectedPOIType}
      />
      
      <GroundReferenceConfirmModal
        isOpen={showGroundRefModal}
        groundReference={groundReferenceHeight}
        onConfirm={handleGroundRefConfirm}
        onCancel={handleGroundRefCancel}
      />
      
      <div className="space-y-2 mt-3 pt-3 border-t border-gray-700">
        <button
          onClick={() => setShowManualEntryModal(true)}
          className="w-full flex items-center justify-center gap-2 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 rounded-lg text-xs font-medium transition-colors"
          data-testid="button-manual-log-entry"
        >
          <Edit className="w-4 h-4" />
          Manual Log Entry
        </button>
        
        {handleDeleteLastEntry && (
          <button
            onClick={handleDeleteLastEntry}
            disabled={measurementCount === 0}
            className="w-full flex items-center justify-center gap-2 px-3 py-1.5 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-xs font-medium transition-colors"
            data-testid="button-delete-last-entry"
            title={measurementCount === 0 ? 'No measurements to delete' : 'Delete most recent POI entry (Ctrl+Backspace)'}
          >
            <Trash2 className="w-4 h-4" />
            Delete Last Entry
          </button>
        )}
        
        {activeSurvey && (
          <div className="flex items-center gap-2">
          <button
            className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg transition-colors text-xs ${
              loggingMode === 'manual' ? 'bg-emerald-600 hover:bg-emerald-700' : 
              isLogging ? 'bg-red-500 hover:bg-red-600 font-bold' : 'bg-green-500 hover:bg-green-600'
            }`} 
            onClick={async () => {
              if (loggingMode === 'manual') {
                handleManualLog();
              } else {
                if (isLogging) {
                  stopLogging();
                } else {
                  // Show ground reference confirmation modal before starting logging
                  setPendingLoggingStart(true);
                  setShowGroundRefModal(true);
                }
              }
            }}
          >
            {loggingMode === 'manual' ? 'Log Measurement' : 
             isLogging ? 'Stop Auto-Log' : `Start ${loggingMode === 'all' ? 'All Data' : loggingMode === 'detection' ? 'Detection' : loggingMode === 'counterDetection' ? 'Counter Det.' : 'Buffer Det'}`}
          </button>
        </div>
        )}
      </div>
    </div>
  );
};

export default LoggingControls;