import { useState, useEffect } from 'react';
import { useCameraStore } from '../../lib/camera';
import { timelapseRecorder } from '../../lib/timelapse/TimelapseRecorder';
import { Film, Square, Settings2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface TimelapseControlsProps {
  videoRef: React.RefObject<HTMLVideoElement>;
}

export const TimelapseControls = ({ videoRef }: TimelapseControlsProps) => {
  const { 
    isTimelapseActive, 
    timelapseSettings, 
    timelapseFrames,
    setTimelapseSettings 
  } = useCameraStore();
  
  const [showSettings, setShowSettings] = useState(false);
  const [localSettings, setLocalSettings] = useState(timelapseSettings);

  // Sync local settings with store
  useEffect(() => {
    setLocalSettings(timelapseSettings);
  }, [timelapseSettings]);

  const handleStart = () => {
    if (!videoRef.current || !videoRef.current.srcObject) {
      toast.error('Camera not available', {
        description: 'Please start the camera first'
      });
      return;
    }

    timelapseRecorder.initialize(videoRef.current);
    timelapseRecorder.start();
  };

  const handleStop = () => {
    timelapseRecorder.stop();
  };

  const handleSettingsChange = (key: keyof typeof timelapseSettings, value: any) => {
    setLocalSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSaveSettings = () => {
    setTimelapseSettings(localSettings);
    setShowSettings(false);
    // toast suppressed
  };

  const frameCountWithPOIs = timelapseFrames.filter(f => f.hasPOI).length;

  return (
    <div className="space-y-2">
      {/* Main Controls */}
      <div className="flex items-center gap-2">
        {!isTimelapseActive ? (
          <button
            onClick={handleStart}
            data-testid="button-start-timelapse"
            className="flex items-center gap-2 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 rounded-lg text-white text-sm font-medium transition-colors"
          >
            <Film className="w-4 h-4" />
            Start Timelapse
          </button>
        ) : (
          <button
            onClick={handleStop}
            data-testid="button-stop-timelapse"
            className="flex items-center gap-2 px-3 py-1.5 bg-red-600 hover:bg-red-700 rounded-lg text-white text-sm font-medium transition-colors animate-pulse"
          >
            <Square className="w-4 h-4" />
            Stop Timelapse
          </button>
        )}
        
        <button
          onClick={() => setShowSettings(!showSettings)}
          data-testid="button-timelapse-settings"
          className="p-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
          title="Timelapse Settings"
        >
          <Settings2 className="w-4 h-4" />
        </button>
      </div>

      {/* Status Display */}
      {isTimelapseActive && (
        <div className="flex items-center gap-4 p-3 bg-purple-900/30 border border-purple-500/30 rounded-lg text-sm">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            <span className="text-purple-200">Recording</span>
          </div>
          <div className="text-purple-200">
            Interval: <span className="font-semibold text-white">{timelapseSettings.interval}s</span>
          </div>
          <div className="text-purple-200">
            Frames: <span className="font-semibold text-white">{timelapseFrames.length}</span>
          </div>
          {frameCountWithPOIs > 0 && (
            <div className="flex items-center gap-1 text-yellow-400">
              <AlertCircle className="w-4 h-4" />
              <span className="font-semibold">{frameCountWithPOIs} with POIs</span>
            </div>
          )}
        </div>
      )}

      {/* Frame Count Display (when not recording) */}
      {!isTimelapseActive && timelapseFrames.length > 0 && (
        <div className="p-3 bg-gray-800 border border-gray-700 rounded-lg text-sm">
          <div className="flex items-center justify-between">
            <span className="text-gray-300">
              Last session: <span className="font-semibold text-white">{timelapseFrames.length} frames</span>
            </span>
            {frameCountWithPOIs > 0 && (
              <span className="flex items-center gap-1 text-yellow-400">
                <AlertCircle className="w-4 h-4" />
                <span className="font-semibold">{frameCountWithPOIs} with POIs</span>
              </span>
            )}
          </div>
        </div>
      )}

      {/* Settings Panel */}
      {showSettings && (
        <div className="p-4 bg-gray-800 border border-gray-700 rounded-lg space-y-4">
          <h3 className="text-sm font-semibold text-white">Timelapse Settings</h3>
          
          {/* Interval */}
          <div className="space-y-2">
            <label className="text-sm text-gray-300 flex items-center justify-between">
              <span>Capture Interval (seconds)</span>
              <span className="font-semibold text-white">{localSettings.interval}s</span>
            </label>
            <input
              type="range"
              min="1"
              max="60"
              step="1"
              value={localSettings.interval}
              onChange={(e) => handleSettingsChange('interval', parseInt(e.target.value))}
              data-testid="input-timelapse-interval"
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-600"
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>1s (Fast)</span>
              <span>60s (Slow)</span>
            </div>
          </div>

          {/* Quality */}
          <div className="space-y-2">
            <label className="text-sm text-gray-300 flex items-center justify-between">
              <span>Image Quality</span>
              <span className="font-semibold text-white">{Math.round(localSettings.quality * 100)}%</span>
            </label>
            <input
              type="range"
              min="0.5"
              max="1"
              step="0.1"
              value={localSettings.quality}
              onChange={(e) => handleSettingsChange('quality', parseFloat(e.target.value))}
              data-testid="input-timelapse-quality"
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-600"
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>Low (smaller files)</span>
              <span>High (better quality)</span>
            </div>
          </div>

          {/* Include Overlay */}
          <div className="flex items-center justify-between">
            <label className="text-sm text-gray-300">Include Survey Overlay</label>
            <input
              type="checkbox"
              checked={localSettings.includeOverlay}
              onChange={(e) => handleSettingsChange('includeOverlay', e.target.checked)}
              data-testid="input-timelapse-overlay"
              className="w-4 h-4 text-purple-600 bg-gray-700 border-gray-600 rounded focus:ring-purple-500 focus:ring-2"
            />
          </div>

          {/* Auto Save */}
          <div className="flex items-center justify-between">
            <label className="text-sm text-gray-300">Auto-Save Frames</label>
            <input
              type="checkbox"
              checked={localSettings.autoSave}
              onChange={(e) => handleSettingsChange('autoSave', e.target.checked)}
              data-testid="input-timelapse-autosave"
              className="w-4 h-4 text-purple-600 bg-gray-700 border-gray-600 rounded focus:ring-purple-500 focus:ring-2"
            />
          </div>

          {/* Save Button */}
          <button
            onClick={handleSaveSettings}
            data-testid="button-save-timelapse-settings"
            className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-white font-medium transition-colors"
          >
            Save Settings
          </button>
        </div>
      )}
    </div>
  );
};
