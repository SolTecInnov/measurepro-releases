import React from 'react';
import { useLoadSettings } from '../../lib/hooks';
import { useSettingsStore } from '../../lib/settings';
import { useCameraStore } from '../../lib/camera';
import { Brain, Camera, Database, AlertTriangle, CheckCircle, Info, Zap, Download, Trash2, FileArchive, Loader, Sparkles, Maximize2, Filter } from 'lucide-react';
import { 
  getAllTrainingFrames, 
  exportTrainingDataYOLO, 
  deleteAllTrainingFrames, 
  getTrainingDataSize 
} from '../../lib/training';
import { toast } from 'sonner';
import DetectionLogViewer from '../ai/DetectionLogViewer';
import DetectionZoneOverlay from '../camera/DetectionZoneOverlay';

const AISettings = () => {
  useLoadSettings();
  const { aiSettings, setAISettings } = useSettingsStore();
  const { selectedCamera, activeStream } = useCameraStore();
  
  // Training data state
  const [trainingDataInfo, setTrainingDataInfo] = React.useState<{
    frameCount: number;
    sizeInMB: number;
    firstFrame?: number;
    lastFrame?: number;
  } | null>(null);
  const [isExporting, setIsExporting] = React.useState(false);
  const [showClearConfirmation, setShowClearConfirmation] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<'settings' | 'detections'>('settings');
  
  // Camera preview state
  const videoPreviewRef = React.useRef<HTMLVideoElement>(null);
  const [previewDimensions, setPreviewDimensions] = React.useState({ width: 0, height: 0 });

  const defaultAISettings = {
    enabled: true,
    trainingMode: false,
    mockDetectionMode: false,
    detectionConfidence: 0.5,
    enabledClasses: ['bridge', 'overpass', 'walkway_overhead', 'tree_branch', 'tree_full', 'power_line_high_voltage', 'power_line_medium_voltage', 'power_line_low_voltage', 'electrical_wire', 'utility_pole', 'transformer'],
    detectionOverlay: true,
    autoLogging: true,
    clearanceAlerts: true,
    trainingFrameRate: 2,
    classes: [],
    detectionZone: {
      enabled: false,
      x: 0.1,
      y: 0.0,
      width: 0.8,
      height: 0.6,
      showOverlay: true,
      overlayColor: '#00FF00'
    },
    classFilters: {
      enabledCategories: ['overhead', 'electrical', 'vegetation'],
      ignoreClasses: ['pedestrian', 'vehicle', 'animal', 'infrastructure'],
      minConfidenceByClass: {
        'bridge': 0.4,
        'tree_branch': 0.5,
        'power_line_high_voltage': 0.6
      }
    }
  };

  const currentSettings = aiSettings || defaultAISettings;

  // Load training data info
  React.useEffect(() => {
    const loadTrainingDataInfo = async () => {
      try {
        const dataSize = await getTrainingDataSize();
        const frames = await getAllTrainingFrames();
        
        if (frames.length > 0) {
          const timestamps = frames.map(f => f.timestamp).sort((a, b) => a - b);
          setTrainingDataInfo({
            frameCount: dataSize.frameCount,
            sizeInMB: dataSize.sizeInMB,
            firstFrame: timestamps[0],
            lastFrame: timestamps[timestamps.length - 1],
          });
        } else {
          setTrainingDataInfo(null);
        }
      } catch (error) {
      }
    };

    // Always check for training data when AI+ is enabled, regardless of training mode
    // This allows users to export existing data even when training is OFF
    if (currentSettings.enabled) {
      loadTrainingDataInfo();
    }
  }, [currentSettings.enabled, currentSettings.trainingMode]);

  // Use shared camera stream from LiveCamera
  React.useEffect(() => {
    // Only use stream when on settings tab, video element exists, and stream is available
    if (!activeStream || !videoPreviewRef.current || activeTab !== 'settings') {
      return;
    }
    
    const videoElement = videoPreviewRef.current;
    
    // Assign the shared stream to the preview video element
    videoElement.srcObject = activeStream;
    
    // Try to play the video with better error handling
    (async () => {
      try {
        await videoElement.play();
      } catch (err) {
      }
    })();
    
    // Cleanup: just remove the stream reference, don't stop it (LiveCamera owns it)
    return () => {
      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = null;
      }
    };
  }, [activeStream, activeTab]);

  // Track preview dimensions
  React.useEffect(() => {
    const video = videoPreviewRef.current;
    if (!video) return;
    
    const updateDimensions = () => {
      if (video.clientWidth && video.clientHeight) {
        setPreviewDimensions({
          width: video.clientWidth,
          height: video.clientHeight
        });
      }
    };
    
    const resizeObserver = new ResizeObserver(updateDimensions);
    resizeObserver.observe(video);
    
    video.addEventListener('loadedmetadata', updateDimensions);
    updateDimensions();
    
    return () => {
      resizeObserver.disconnect();
      video.removeEventListener('loadedmetadata', updateDimensions);
    };
  }, []);

  // Handle export training data
  const handleExportTrainingData = async () => {
    try {
      setIsExporting(true);
      toast.info('Preparing training data export...');
      
      const frames = await getAllTrainingFrames();
      if (frames.length === 0) {
        toast.error('No training data to export');
        return;
      }

      // Create class mapping for enabled classes
      const classMapping = new Map<string, number>();
      (currentSettings.enabledClasses || []).forEach((className, index) => {
        classMapping.set(className, index);
      });

      toast.info(`Exporting ${frames.length} frames...`);
      const blob = await exportTrainingDataYOLO(frames, classMapping);
      
      // Download the ZIP file
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `measurepro-training-data-${new Date().toISOString().split('T')[0]}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      const sizeInMB = (blob.size / (1024 * 1024)).toFixed(2);
      toast.success(`Training data exported successfully (${sizeInMB} MB)`);
    } catch (error) {
      toast.error('Failed to export training data');
    } finally {
      setIsExporting(false);
    }
  };

  // Handle clear training data
  const handleClearTrainingData = async () => {
    try {
      await deleteAllTrainingFrames();
      setTrainingDataInfo(null);
      setShowClearConfirmation(false);
      toast.success('Training data cleared successfully');
    } catch (error) {
      toast.error('Failed to clear training data');
    }
  };

  const handleToggleEnabled = async (enabled: boolean) => {
    // Password validation disabled - directly enable/disable
    await setAISettings({
      ...currentSettings,
      enabled
    });
    
    if (enabled) {
      toast.success('AI Detection enabled successfully');
    }
  };

  const handleToggleTrainingMode = async (trainingMode: boolean) => {
    await setAISettings({
      ...currentSettings,
      trainingMode,
      mockDetectionMode: false // Disable mock when training is enabled
    });
  };

  const handleToggleMockDetection = async (mockDetectionMode: boolean) => {
    await setAISettings({
      ...currentSettings,
      mockDetectionMode,
      trainingMode: false // Disable training when mock is enabled
    });
  };

  const handleToggleDetectionOverlay = async (detectionOverlay: boolean) => {
    await setAISettings({
      ...currentSettings,
      detectionOverlay
    });
  };

  const handleToggleAutoLogging = async (autoLogging: boolean) => {
    await setAISettings({
      ...currentSettings,
      autoLogging
    });
  };

  const handleToggleClearanceAlerts = async (clearanceAlerts: boolean) => {
    await setAISettings({
      ...currentSettings,
      clearanceAlerts
    });
  };

  const handleConfidenceChange = async (value: number) => {
    await setAISettings({
      ...currentSettings,
      detectionConfidence: value
    });
  };

  const handleFrameRateChange = async (value: number) => {
    await setAISettings({
      ...currentSettings,
      trainingFrameRate: value
    });
  };

  const handleToggleClass = async (className: string) => {
    const enabledClasses = currentSettings.enabledClasses || [];
    const newEnabledClasses = enabledClasses.includes(className)
      ? enabledClasses.filter(c => c !== className)
      : [...enabledClasses, className];
    
    await setAISettings({
      ...currentSettings,
      enabledClasses: newEnabledClasses
    });
  };

  const handleTogglePriority = async (priority: number) => {
    const enabledClasses = currentSettings.enabledClasses || [];
    const priorityClasses = (currentSettings.classes || [])
      .filter(c => c.priority === priority)
      .map(c => c.name);
    
    const allPriorityEnabled = priorityClasses.every(c => enabledClasses.includes(c));
    
    let newEnabledClasses;
    if (allPriorityEnabled) {
      // Disable all classes in this priority
      newEnabledClasses = enabledClasses.filter(c => !priorityClasses.includes(c));
    } else {
      // Enable all classes in this priority
      newEnabledClasses = [...new Set([...enabledClasses, ...priorityClasses])];
    }
    
    await setAISettings({
      ...currentSettings,
      enabledClasses: newEnabledClasses
    });
  };

  // Update detection zone settings
  const updateDetectionZone = async (updates: Partial<typeof currentSettings.detectionZone>) => {
    const updatedSettings = {
      ...currentSettings,
      detectionZone: {
        ...currentSettings.detectionZone,
        ...updates
      }
    };
    await setAISettings(updatedSettings);
  };

  // Toggle ignore class
  const toggleIgnoreClass = async (className: string, shouldIgnore: boolean) => {
    const currentIgnored = currentSettings?.classFilters?.ignoreClasses || [];
    const updated = shouldIgnore
      ? [...currentIgnored, className]
      : currentIgnored.filter(c => c !== className);
    
    const updatedSettings = {
      ...currentSettings,
      classFilters: {
        ...currentSettings.classFilters,
        ignoreClasses: updated
      }
    };
    await setAISettings(updatedSettings);
  };

  // Preset configurations
  const setPreset = async (preset: 'overhead' | 'all') => {
    const presets = {
      overhead: ['pedestrian', 'vehicle', 'animal', 'infrastructure'],
      all: []
    };
    
    const updatedSettings = {
      ...currentSettings,
      classFilters: {
        ...currentSettings.classFilters,
        ignoreClasses: presets[preset]
      }
    };
    await setAISettings(updatedSettings);
  };

  const groupedClasses = React.useMemo(() => {
    const classes = currentSettings.classes || [];
    return classes.reduce((acc, cls) => {
      if (!acc[cls.category]) {
        acc[cls.category] = [];
      }
      acc[cls.category].push(cls);
      return acc;
    }, {} as Record<string, typeof classes>);
  }, [currentSettings.classes]);

  const priorityGroups = React.useMemo(() => {
    const classes = currentSettings.classes || [];
    return classes.reduce((acc, cls) => {
      if (!acc[cls.priority]) {
        acc[cls.priority] = [];
      }
      acc[cls.priority].push(cls);
      return acc;
    }, {} as Record<number, typeof classes>);
  }, [currentSettings.classes]);

  const enabledCount = (currentSettings.enabledClasses || []).length;
  const totalCount = (currentSettings.classes || []).length;

  return (
    <div className="p-4 space-y-6">
      {/* Header with Tabs */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-purple-600 rounded-lg">
            <Brain className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xl font-semibold">MeasurePRO+ AI Settings</h3>
            <p className="text-sm text-gray-400">Configure AI object detection and training features</p>
          </div>
        </div>

        {/* Tabs */}
        {currentSettings.enabled && (
          <div className="flex gap-2 border-b border-gray-700">
            <button
              onClick={() => setActiveTab('settings')}
              className={`px-4 py-2 font-medium transition-colors ${
                activeTab === 'settings'
                  ? 'text-purple-400 border-b-2 border-purple-400'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
              data-testid="tab-settings"
            >
              Settings
            </button>
            <button
              onClick={() => setActiveTab('detections')}
              className={`px-4 py-2 font-medium transition-colors ${
                activeTab === 'detections'
                  ? 'text-purple-400 border-b-2 border-purple-400'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
              data-testid="tab-detections"
            >
              Detection Log
            </button>
          </div>
        )}
      </div>

      {/* Detection Log Tab */}
      {currentSettings.enabled && activeTab === 'detections' && (
        <DetectionLogViewer />
      )}

      {/* Settings Tab */}
      {activeTab === 'settings' && (
        <div className="space-y-6">

      {/* Master Enable/Disable Toggle */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Zap className="w-5 h-5 text-purple-400" />
            <div>
              <h4 className="font-semibold">Enable MeasurePRO+</h4>
              <p className="text-sm text-gray-400">Activate AI object detection features</p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={currentSettings.enabled}
              onChange={(e) => handleToggleEnabled(e.target.checked)}
              className="sr-only peer"
              data-testid="toggle-ai-enabled"
            />
            <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
          </label>
        </div>
        
        {/* Pricing info when disabled */}
        {!currentSettings.enabled && (
          <div className="mt-4 pt-4 border-t border-gray-700">
            <div className="bg-purple-900/30 border border-purple-700 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-3">
                    <h5 className="font-semibold text-purple-300">MeasurePRO+ Premium Features</h5>
                    <div className="inline-flex items-center gap-1 bg-amber-900/40 border border-amber-500 rounded-full px-2 py-0.5">
                      <Sparkles className="w-3 h-3 text-amber-400" />
                      <span className="text-amber-300 text-xs font-semibold">BETA</span>
                    </div>
                  </div>
                  
                  {/* Two-Tier Pricing */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                    <div className="bg-purple-800/30 border border-purple-400 rounded p-3">
                      <div className="flex items-center gap-1 mb-1">
                        <CheckCircle className="w-4 h-4 text-green-400" />
                        <span className="text-xs font-semibold text-purple-300">RECOMMENDED</span>
                      </div>
                      <div className="text-2xl font-bold text-purple-400">
                        $255<span className="text-sm text-gray-400">/mo USD</span>
                      </div>
                      <p className="text-xs font-medium text-white mt-1">LiDAR from SolTec</p>
                      <p className="text-xs text-gray-400">Full support & warranty</p>
                    </div>
                    <div className="bg-gray-800/50 border border-gray-600 rounded p-3">
                      <div className="text-xs text-gray-500 mb-1">Alternative</div>
                      <div className="text-2xl font-bold text-gray-300">
                        $355<span className="text-sm text-gray-400">/mo USD</span>
                      </div>
                      <p className="text-xs font-medium text-white mt-1">BYOD</p>
                      <p className="text-xs text-gray-400">Bring your own device</p>
                    </div>
                  </div>
                  
                  <ul className="text-sm text-gray-300 space-y-1 mb-4">
                    <li>• AI-powered object detection (26 classes)</li>
                    <li>• Automatic clearance alerts</li>
                    <li>• Training data collection & export</li>
                    <li>• Advanced detection logging</li>
                  </ul>
                  
                  <div className="bg-amber-900/30 border border-amber-700 rounded p-3">
                    <p className="text-sm font-medium text-amber-300 mb-1">Beta Feature - Early Access Available</p>
                    <p className="text-xs text-gray-400">
                      Contact us at <a href="mailto:sales@soltecinnovation.com" className="text-amber-400 hover:text-amber-300 underline">sales@soltecinnovation.com</a> to join our beta program and help shape the future of AI-powered surveying.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {currentSettings.enabled && (
        <>
          {/* Mode Selection */}
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 space-y-4">
            <h4 className="font-semibold flex items-center gap-2">
              <Camera className="w-5 h-5 text-blue-400" />
              Operation Mode
            </h4>
            
            {/* Training Mode */}
            <div className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg">
              <div className="flex items-center gap-3">
                <Database className="w-5 h-5 text-green-400" />
                <div>
                  <h5 className="font-medium">Training Data Collection</h5>
                  <p className="text-sm text-gray-400">
                    Capture frames at {currentSettings.trainingFrameRate} FPS for AI model training
                  </p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={currentSettings.trainingMode}
                  onChange={(e) => handleToggleTrainingMode(e.target.checked)}
                  className="sr-only peer"
                  data-testid="toggle-training-mode"
                />
                <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
              </label>
            </div>

            {/* Training Frame Rate Slider */}
            {currentSettings.trainingMode && (
              <div className="p-3 bg-gray-900/50 rounded-lg space-y-2">
                <label className="block text-sm font-medium">
                  Training Frame Rate: {currentSettings.trainingFrameRate} FPS
                </label>
                <input
                  type="range"
                  min="0.5"
                  max="10"
                  step="0.5"
                  value={currentSettings.trainingFrameRate}
                  onChange={(e) => handleFrameRateChange(parseFloat(e.target.value))}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-green-600"
                  data-testid="slider-training-framerate"
                />
                <p className="text-xs text-gray-500">Higher frame rates collect more data but use more storage</p>
              </div>
            )}

            {/* Real AI Detection Mode */}
            <div className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg">
              <div className="flex items-center gap-3">
                <Brain className="w-5 h-5 text-blue-400" />
                <div>
                  <h5 className="font-medium">Real AI Detection</h5>
                  <p className="text-sm text-gray-400">
                    Use TensorFlow.js COCO-SSD model for real-time object detection
                  </p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={!currentSettings.mockDetectionMode && !currentSettings.trainingMode}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setAISettings({
                        ...currentSettings,
                        mockDetectionMode: false,
                        trainingMode: false,
                      });
                    }
                  }}
                  className="sr-only peer"
                  data-testid="toggle-real-ai-detection"
                />
                <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            {/* Mock Detection Mode */}
            <div className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-yellow-400" />
                <div>
                  <h5 className="font-medium">Mock Detection Mode</h5>
                  <p className="text-sm text-gray-400">
                    Generate random detections for testing UI (no real AI inference)
                  </p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={currentSettings.mockDetectionMode}
                  onChange={(e) => handleToggleMockDetection(e.target.checked)}
                  className="sr-only peer"
                  data-testid="toggle-mock-detection"
                />
                <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-yellow-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-yellow-600"></div>
              </label>
            </div>
          </div>

          {/* Detection Settings */}
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 space-y-4">
            <h4 className="font-semibold flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-400" />
              Detection Settings
            </h4>

            {/* Confidence Threshold */}
            <div className="space-y-2">
              <label className="block text-sm font-medium">
                Confidence Threshold: {(currentSettings.detectionConfidence * 100).toFixed(0)}%
              </label>
              <input
                type="range"
                min="0.1"
                max="0.95"
                step="0.05"
                value={currentSettings.detectionConfidence}
                onChange={(e) => handleConfidenceChange(parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                data-testid="slider-confidence"
              />
              <p className="text-xs text-gray-500">Minimum confidence required to display a detection</p>
            </div>

            {/* Detection Overlay */}
            <div className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg">
              <div>
                <h5 className="font-medium">Show Detection Overlay</h5>
                <p className="text-sm text-gray-400">Display bounding boxes and labels on camera feed</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={currentSettings.detectionOverlay}
                  onChange={(e) => handleToggleDetectionOverlay(e.target.checked)}
                  className="sr-only peer"
                  data-testid="toggle-detection-overlay"
                />
                <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            {/* Auto Logging */}
            <div className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg">
              <div>
                <h5 className="font-medium">Auto-Log Detections</h5>
                <p className="text-sm text-gray-400">Automatically create log entries for detected objects</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={currentSettings.autoLogging}
                  onChange={(e) => handleToggleAutoLogging(e.target.checked)}
                  className="sr-only peer"
                  data-testid="toggle-auto-logging"
                />
                <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            {/* Clearance Alerts */}
            <div className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg">
              <div>
                <h5 className="font-medium">Clearance Alerts</h5>
                <p className="text-sm text-gray-400">Alert when detected overhead objects are below threshold</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={currentSettings.clearanceAlerts}
                  onChange={(e) => handleToggleClearanceAlerts(e.target.checked)}
                  className="sr-only peer"
                  data-testid="toggle-clearance-alerts"
                />
                <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-600"></div>
              </label>
            </div>
          </div>

          {/* Detection Zone (ROI) Configuration */}
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
            <h4 className="font-semibold flex items-center gap-2 mb-4">
              <Maximize2 className="w-5 h-5 text-cyan-400" />
              Detection Zone (ROI)
            </h4>
            <p className="text-sm text-gray-400 mb-4">
              Define where AI detection happens. Focus on overhead areas and exclude foreground objects like pedestrians.
            </p>
            
            {/* Enable ROI */}
            <div className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg mb-4">
              <div>
                <h5 className="font-medium">Enable Detection Zone</h5>
                <p className="text-sm text-gray-400">Restrict AI detection to a specific region</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={currentSettings?.detectionZone?.enabled ?? true}
                  onChange={(e) => updateDetectionZone({ enabled: e.target.checked })}
                  className="sr-only peer"
                  data-testid="toggle-detection-zone-enabled"
                />
                <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-cyan-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-600"></div>
              </label>
            </div>
            
            {currentSettings?.detectionZone?.enabled && (
              <>
                {/* Live Camera Preview with ROI Overlay */}
                <div className="mb-6">
                  <h4 className="text-sm font-medium mb-2">Live Preview</h4>
                  <div className="relative aspect-[4/3] bg-black rounded-lg overflow-hidden w-full max-w-full max-h-[400px]">
                    <video
                      ref={videoPreviewRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-contain"
                      data-testid="video-roi-preview"
                    />
                    {previewDimensions.width > 0 && (
                      <DetectionZoneOverlay
                        videoWidth={previewDimensions.width}
                        videoHeight={previewDimensions.height}
                      />
                    )}
                    {!selectedCamera && (
                      <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm">
                        Start camera to see preview
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-2">
                    Adjust the sliders below to see the detection zone update in real-time
                  </p>
                </div>

                {/* Zone Position and Size Sliders */}
                <div className="space-y-4">
                  {/* X Position */}
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      X Position: {((currentSettings?.detectionZone?.x ?? 0.1) * 100).toFixed(0)}%
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="0.5"
                      step="0.01"
                      value={currentSettings?.detectionZone?.x ?? 0.1}
                      onChange={(e) => updateDetectionZone({ x: parseFloat(e.target.value) })}
                      className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-600"
                      data-testid="slider-detection-zone-x"
                    />
                    <p className="text-xs text-gray-500 mt-1">Horizontal offset from left edge</p>
                  </div>
                  
                  {/* Y Position */}
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Y Position: {((currentSettings?.detectionZone?.y ?? 0) * 100).toFixed(0)}%
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="0.5"
                      step="0.01"
                      value={currentSettings?.detectionZone?.y ?? 0}
                      onChange={(e) => updateDetectionZone({ y: parseFloat(e.target.value) })}
                      className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-600"
                      data-testid="slider-detection-zone-y"
                    />
                    <p className="text-xs text-gray-500 mt-1">Vertical offset from top edge</p>
                  </div>
                  
                  {/* Width */}
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Width: {((currentSettings?.detectionZone?.width ?? 0.8) * 100).toFixed(0)}%
                    </label>
                    <input
                      type="range"
                      min="0.2"
                      max="1.0"
                      step="0.01"
                      value={currentSettings?.detectionZone?.width ?? 0.8}
                      onChange={(e) => updateDetectionZone({ width: parseFloat(e.target.value) })}
                      className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-600"
                      data-testid="slider-detection-zone-width"
                    />
                    <p className="text-xs text-gray-500 mt-1">Zone width as percentage of frame</p>
                  </div>
                  
                  {/* Height */}
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Height: {((currentSettings?.detectionZone?.height ?? 0.6) * 100).toFixed(0)}%
                    </label>
                    <input
                      type="range"
                      min="0.2"
                      max="1.0"
                      step="0.01"
                      value={currentSettings?.detectionZone?.height ?? 0.6}
                      onChange={(e) => updateDetectionZone({ height: parseFloat(e.target.value) })}
                      className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-600"
                      data-testid="slider-detection-zone-height"
                    />
                    <p className="text-xs text-gray-500 mt-1">Zone height as percentage of frame</p>
                  </div>
                </div>
                
                {/* Show Overlay Toggle */}
                <div className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg mt-4">
                  <div>
                    <h5 className="font-medium">Show Zone Overlay</h5>
                    <p className="text-sm text-gray-400">Display zone border on camera feed</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={currentSettings?.detectionZone?.showOverlay ?? true}
                      onChange={(e) => updateDetectionZone({ showOverlay: e.target.checked })}
                      className="sr-only peer"
                      data-testid="toggle-detection-zone-overlay"
                    />
                    <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-cyan-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-600"></div>
                  </label>
                </div>
                
                {/* Overlay Color */}
                <div className="mt-4">
                  <label className="block text-sm font-medium mb-2">Overlay Color</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={currentSettings?.detectionZone?.overlayColor ?? '#00FF00'}
                      onChange={(e) => updateDetectionZone({ overlayColor: e.target.value })}
                      className="h-10 w-20 rounded cursor-pointer"
                      data-testid="input-detection-zone-color"
                    />
                    <span className="text-sm text-gray-400">
                      {currentSettings?.detectionZone?.overlayColor ?? '#00FF00'}
                    </span>
                  </div>
                </div>

                {/* Visual Preview */}
                <div className="mt-4 bg-gray-900 rounded-lg p-4">
                  <div className="text-xs text-gray-400 mb-2">Zone Preview:</div>
                  <div className="w-full h-32 bg-black rounded relative overflow-hidden">
                    <div
                      className="absolute border-2 border-dashed rounded"
                      style={{
                        left: `${(currentSettings?.detectionZone?.x ?? 0.1) * 100}%`,
                        top: `${(currentSettings?.detectionZone?.y ?? 0) * 100}%`,
                        width: `${(currentSettings?.detectionZone?.width ?? 0.8) * 100}%`,
                        height: `${(currentSettings?.detectionZone?.height ?? 0.6) * 100}%`,
                        borderColor: currentSettings?.detectionZone?.overlayColor ?? '#00FF00'
                      }}
                      data-testid="preview-detection-zone"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    This preview shows where AI detection will occur on the camera feed
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Class Filters */}
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
            <h4 className="font-semibold flex items-center gap-2 mb-4">
              <Filter className="w-5 h-5 text-amber-400" />
              Object Class Filters
            </h4>
            <p className="text-sm text-gray-400 mb-4">
              Choose which types of objects to detect and which to ignore.
            </p>
            
            {/* Ignored Classes */}
            <div>
              <h5 className="font-medium mb-3">Ignore These Objects:</h5>
              <div className="grid grid-cols-2 gap-2">
                {['pedestrian', 'vehicle', 'animal', 'infrastructure'].map(className => (
                  <label 
                    key={className} 
                    className="flex items-center gap-2 p-2 bg-gray-900/50 rounded-lg hover:bg-gray-900 transition-colors cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={currentSettings?.classFilters?.ignoreClasses?.includes(className) ?? false}
                      onChange={(e) => toggleIgnoreClass(className, e.target.checked)}
                      className="rounded accent-amber-600"
                      data-testid={`checkbox-ignore-${className}`}
                    />
                    <span className="text-sm capitalize">{className.replace('_', ' ')}</span>
                  </label>
                ))}
              </div>
            </div>
            
            {/* Preset Buttons */}
            <div className="mt-4 pt-4 border-t border-gray-700">
              <h5 className="font-medium mb-3">Quick Presets:</h5>
              <div className="flex gap-2">
                <button
                  onClick={() => setPreset('overhead')}
                  className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors"
                  data-testid="button-preset-overhead"
                >
                  Overhead Only
                </button>
                <button
                  onClick={() => setPreset('all')}
                  className="flex-1 px-3 py-2 bg-gray-600 hover:bg-gray-700 rounded-lg text-sm font-medium transition-colors"
                  data-testid="button-preset-all"
                >
                  Detect All
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                <strong>Overhead Only:</strong> Ignores ground-level objects (pedestrians, vehicles, etc.)<br />
                <strong>Detect All:</strong> Removes all filters
              </p>
            </div>

            {/* Current Filter Status */}
            {currentSettings?.classFilters?.ignoreClasses && currentSettings.classFilters.ignoreClasses.length > 0 && (
              <div className="mt-4 p-3 bg-amber-900/30 border border-amber-700 rounded-lg">
                <p className="text-sm text-amber-300">
                  <strong>Active Filters:</strong> Ignoring {currentSettings.classFilters.ignoreClasses.length} object type(s)
                </p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {currentSettings.classFilters.ignoreClasses.map(cls => (
                    <span 
                      key={cls} 
                      className="inline-flex items-center gap-1 px-2 py-1 bg-amber-800/50 rounded text-xs text-amber-200"
                      data-testid={`badge-ignored-${cls}`}
                    >
                      {cls.replace('_', ' ')}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Object Classes */}
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold flex items-center gap-2">
                <Info className="w-5 h-5 text-blue-400" />
                Object Classes ({enabledCount}/{totalCount} enabled)
              </h4>
            </div>

            {/* Priority Groups */}
            {[1, 2, 3].map(priority => {
              const priorityClasses = priorityGroups[priority] || [];
              if (priorityClasses.length === 0) return null;

              const enabledClasses = currentSettings.enabledClasses || [];
              const allEnabled = priorityClasses.every(c => enabledClasses.includes(c.name));
              const someEnabled = priorityClasses.some(c => enabledClasses.includes(c.name));

              const priorityNames = {
                1: 'Priority 1: Core Infrastructure',
                2: 'Priority 2: Traffic & Railroad',
                3: 'Priority 3: Additional Features'
              };

              return (
                <div key={priority} className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-gray-900/70 rounded-lg border border-gray-700">
                    <h5 className="font-medium text-sm">{priorityNames[priority as keyof typeof priorityNames]}</h5>
                    <button
                      onClick={() => handleTogglePriority(priority)}
                      className={`px-3 py-1 rounded text-sm transition-colors ${
                        allEnabled
                          ? 'bg-green-600 hover:bg-green-700'
                          : someEnabled
                          ? 'bg-yellow-600 hover:bg-yellow-700'
                          : 'bg-gray-600 hover:bg-gray-700'
                      }`}
                      data-testid={`toggle-priority-${priority}`}
                    >
                      {allEnabled ? 'All Enabled' : someEnabled ? 'Some Enabled' : 'All Disabled'}
                    </button>
                  </div>

                  {/* Classes by Category */}
                  {Object.entries(groupedClasses || {})
                    .filter(([, classes]) => classes.some(c => c.priority === priority))
                    .map(([category, classes]) => {
                      const priorityClassesInCategory = classes.filter(c => c.priority === priority);
                      if (priorityClassesInCategory.length === 0) return null;

                      return (
                        <div key={category} className="pl-4 space-y-2">
                          <h6 className="text-sm font-medium text-gray-400 capitalize">{category}</h6>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                            {priorityClassesInCategory.map(cls => {
                              const isEnabled = (currentSettings.enabledClasses || []).includes(cls.name);
                              return (
                                <button
                                  key={cls.id}
                                  onClick={() => handleToggleClass(cls.name)}
                                  className={`flex items-center gap-2 p-2 rounded-lg border transition-all ${
                                    isEnabled
                                      ? 'bg-gray-800 border-gray-600 hover:bg-gray-750'
                                      : 'bg-gray-900/50 border-gray-800 hover:bg-gray-900'
                                  }`}
                                  data-testid={`toggle-class-${cls.name}`}
                                >
                                  <div
                                    className="w-4 h-4 rounded"
                                    style={{ backgroundColor: cls.color }}
                                  />
                                  <span className="text-sm capitalize flex-1 text-left">
                                    {cls.name.replace(/_/g, ' ')}
                                  </span>
                                  {isEnabled && <CheckCircle className="w-4 h-4 text-green-400" />}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                </div>
              );
            })}
          </div>

          {/* Training Data Management */}
          {(currentSettings.trainingMode || trainingDataInfo) && (
            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold flex items-center gap-2">
                  <FileArchive className="w-5 h-5 text-purple-400" />
                  Training Data Management
                </h4>
              </div>

              {trainingDataInfo ? (
                <>
                  {/* Data Statistics */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-gray-900/50 rounded-lg p-3">
                      <div className="text-xs text-gray-400 mb-1">Frames Captured</div>
                      <div className="text-xl font-bold text-purple-400">{trainingDataInfo.frameCount}</div>
                    </div>
                    <div className="bg-gray-900/50 rounded-lg p-3">
                      <div className="text-xs text-gray-400 mb-1">Storage Used</div>
                      <div className="text-xl font-bold text-blue-400">{trainingDataInfo.sizeInMB.toFixed(2)} MB</div>
                    </div>
                    <div className="bg-gray-900/50 rounded-lg p-3">
                      <div className="text-xs text-gray-400 mb-1">First Frame</div>
                      <div className="text-sm font-mono">
                        {trainingDataInfo.firstFrame 
                          ? new Date(trainingDataInfo.firstFrame).toLocaleDateString() 
                          : '--'}
                      </div>
                    </div>
                    <div className="bg-gray-900/50 rounded-lg p-3">
                      <div className="text-xs text-gray-400 mb-1">Last Frame</div>
                      <div className="text-sm font-mono">
                        {trainingDataInfo.lastFrame 
                          ? new Date(trainingDataInfo.lastFrame).toLocaleDateString() 
                          : '--'}
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-3">
                    <button
                      onClick={handleExportTrainingData}
                      disabled={isExporting}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
                      data-testid="button-export-training-data"
                    >
                      {isExporting ? (
                        <>
                          <Loader className="w-5 h-5 animate-spin" />
                          Exporting...
                        </>
                      ) : (
                        <>
                          <Download className="w-5 h-5" />
                          Export Training Data (YOLO Format)
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => setShowClearConfirmation(true)}
                      className="px-4 py-3 bg-red-600 hover:bg-red-700 rounded-lg font-medium flex items-center gap-2 transition-colors"
                      data-testid="button-clear-training-data"
                    >
                      <Trash2 className="w-5 h-5" />
                      Clear
                    </button>
                  </div>

                  {/* Export Info */}
                  <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-3">
                    <p className="text-sm text-blue-300">
                      <strong>Export Format:</strong> YOLO v5/v8 compatible with images/, labels/, metadata.json, and classes.txt
                    </p>
                  </div>
                </>
              ) : (
                <div className="text-center py-8 text-gray-400">
                  <Database className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No training data collected yet</p>
                  <p className="text-sm mt-1">Enable Training Mode to start capturing frames</p>
                </div>
              )}
            </div>
          )}

          {/* Info Banner */}
          <div className="bg-purple-900/30 border border-purple-700 rounded-lg p-4 flex items-start gap-3">
            <Info className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium mb-1">MeasurePRO+ AI Features</p>
              <ul className="text-gray-400 space-y-1 list-disc list-inside">
                <li><strong>Training Mode:</strong> Collect labeled frames for AI model training</li>
                <li><strong>Mock Detection:</strong> Test the UI with simulated detections</li>
                <li><strong>Auto-Logging:</strong> Automatically create survey entries for detections</li>
                <li><strong>Clearance Alerts:</strong> Get warned about low-clearance overhead objects</li>
              </ul>
            </div>
          </div>
        </>
      )}
      </div>
      )}

      {/* Clear Training Data Confirmation Dialog */}
      {showClearConfirmation && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 border border-red-700 rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="w-6 h-6 text-red-400" />
              <h3 className="text-xl font-semibold">Clear Training Data?</h3>
            </div>
            
            <p className="text-gray-300 mb-4">
              Are you sure you want to delete all {trainingDataInfo?.frameCount || 0} training frames? 
              This action cannot be undone.
            </p>
            
            <div className="flex gap-3">
              <button
                onClick={() => setShowClearConfirmation(false)}
                className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                data-testid="button-cancel-clear"
              >
                Cancel
              </button>
              <button
                onClick={handleClearTrainingData}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                data-testid="button-confirm-clear"
              >
                Delete All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AISettings;
