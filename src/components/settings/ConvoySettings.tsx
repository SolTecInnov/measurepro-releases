import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, 
  Radio, 
  Camera, 
  AlertTriangle, 
  Zap,
  Sparkles,
  Shield,
  Video,
  FileText,
  MapPin,
  Play,
  QrCode
} from 'lucide-react';
import { useLoadSettings } from '../../lib/hooks';
import { useSettingsStore } from '../../lib/settings';
import { toast } from 'sonner';

const ConvoySettings = () => {
  useLoadSettings();
  const navigate = useNavigate();
  const { convoySettings, setConvoySettings } = useSettingsStore();

  const currentSettings = convoySettings || {
    enabled: false,
    maxConcurrentConvoys: 3,
    defaultWarningThreshold: 4.5,
    defaultCriticalThreshold: 4.2,
    leaderTimeout: 300000,
    videoQuality: '720p' as '720p' | '1080p',
    videoLoopDuration: 60,
    autoUploadVideos: false,
  };

  const handleToggleEnabled = (enabled: boolean) => {
    setConvoySettings({
      ...currentSettings,
      enabled
    });
  };

  const handleSettingChange = (field: string, value: any) => {
    setConvoySettings({
      ...currentSettings,
      [field]: value
    });
  };

  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-blue-600 rounded-lg">
          <Shield className="w-6 h-6" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-semibold">Convoy Guardian</h3>
            <div className="inline-flex items-center gap-1 bg-blue-900/40 border border-blue-500 rounded-full px-2 py-0.5">
              <Sparkles className="w-3 h-3 text-blue-400" />
              <span className="text-blue-300 text-xs font-semibold">PREMIUM</span>
            </div>
          </div>
          <p className="text-sm text-gray-400">World's First Black Box for Oversized Convoy Operations</p>
        </div>
      </div>

      {/* Enable/Disable Toggle */}
      <div className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg border border-gray-700">
        <div className="flex items-center gap-3">
          <Shield className="w-5 h-5 text-blue-400" />
          <div>
            <p className="font-medium">Convoy Guardian Status</p>
            <p className="text-sm text-gray-400">
              {currentSettings.enabled ? 'Active - Ready for convoy operations' : 'Inactive'}
            </p>
          </div>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            className="sr-only peer"
            checked={currentSettings.enabled}
            onChange={(e) => handleToggleEnabled(e.target.checked)}
            data-testid="toggle-convoy-enabled"
          />
          <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
        </label>
      </div>

      {/* Promotional Content (when disabled) */}
      {!currentSettings.enabled && (
        <div className="space-y-4">
          <div className="bg-gradient-to-br from-blue-900/30 to-purple-900/30 border border-blue-500/30 rounded-lg p-6">
            <h4 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Zap className="w-5 h-5 text-blue-400" />
              World's First Black Box for Oversized Convoy Operations
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="flex items-start gap-3">
                <Radio className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium">Real-Time Coordination</p>
                  <p className="text-sm text-gray-400">Live measurement sharing between convoy vehicles</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-yellow-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium">Alert Broadcasts</p>
                  <p className="text-sm text-gray-400">Instant alerts to all convoy members</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <Video className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium">Video Loop Recording</p>
                  <p className="text-sm text-gray-400">Continuous recording with alert-triggered capture</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <FileText className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium">Black Box Logging</p>
                  <p className="text-sm text-gray-400">Complete incident documentation and reporting for oversized loads</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-orange-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium">Multi-Stakeholder Monitoring</p>
                  <p className="text-sm text-gray-400">Police escorts, utility trucks, pilot cars, dispatchers, safety officers, and customers follow convoy status in real-time</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <Shield className="w-5 h-5 text-purple-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium">Leader Failover</p>
                  <p className="text-sm text-gray-400">Automatic emergency alerts on leader disconnect</p>
                </div>
              </div>
            </div>

            <div className="border-t border-blue-500/30 pt-4">
              <p className="text-lg font-semibold text-blue-300 mb-2">
                💰 $650 USD/month
              </p>
              <p className="text-sm text-gray-400">
                Includes up to 3 simultaneous convoys
              </p>
              <p className="text-sm text-gray-400">
                Additional convoys: +$450/month each
              </p>
            </div>
          </div>

          <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-yellow-200">Safety Disclaimer</p>
                <p className="text-sm text-gray-300 mt-1">
                  Convoy Guardian is an ADDITIONAL safety layer. Physical high pole procedures, spotter vehicles, 
                  and all standard safety protocols MUST still be followed at all times.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Configuration Settings (when enabled) */}
      {currentSettings.enabled && (
        <div className="space-y-6">
          {/* Action Buttons */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={() => navigate('/convoy/leader')}
              className="flex items-center justify-center gap-3 p-6 bg-gradient-to-br from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 rounded-xl transition-all shadow-lg hover:shadow-xl"
              data-testid="button-start-convoy"
            >
              <Play className="w-8 h-8" />
              <div className="text-left">
                <div className="text-xl font-bold">Start New Convoy</div>
                <div className="text-sm text-blue-100">Lead a convoy session</div>
              </div>
            </button>
            
            <button
              onClick={() => navigate('/convoy/join')}
              className="flex items-center justify-center gap-3 p-6 bg-gradient-to-br from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 rounded-xl transition-all shadow-lg hover:shadow-xl"
              data-testid="button-join-convoy"
            >
              <QrCode className="w-8 h-8" />
              <div className="text-left">
                <div className="text-xl font-bold">Join Convoy</div>
                <div className="text-sm text-green-100">Scan QR code to join</div>
              </div>
            </button>
          </div>

          {/* Basic Settings */}
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
            <h4 className="text-lg font-semibold mb-4">Convoy Configuration</h4>
            
            <div className="space-y-4">
              {/* Max Concurrent Convoys */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Maximum Concurrent Convoys
                </label>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={currentSettings.maxConcurrentConvoys}
                    onChange={(e) => handleSettingChange('maxConcurrentConvoys', parseInt(e.target.value))}
                    className="flex-1"
                    data-testid="slider-max-convoys"
                  />
                  <span className="text-lg font-semibold w-12 text-center">
                    {currentSettings.maxConcurrentConvoys}
                  </span>
                </div>
                {currentSettings.maxConcurrentConvoys > 3 && (
                  <p className="text-sm text-yellow-400 mt-2">
                    Additional fee: ${(currentSettings.maxConcurrentConvoys - 3) * 450}/month
                  </p>
                )}
              </div>

              {/* Default Warning Threshold */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Default Warning Threshold (meters)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={currentSettings.defaultWarningThreshold}
                  onChange={(e) => handleSettingChange('defaultWarningThreshold', parseFloat(e.target.value))}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                  data-testid="input-warning-threshold"
                />
              </div>

              {/* Default Critical Threshold */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Default Critical Threshold (meters)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={currentSettings.defaultCriticalThreshold}
                  onChange={(e) => handleSettingChange('defaultCriticalThreshold', parseFloat(e.target.value))}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                  data-testid="input-critical-threshold"
                />
              </div>

              {/* Leader Timeout */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Leader Timeout (seconds)
                </label>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min="60"
                    max="600"
                    step="30"
                    value={currentSettings.leaderTimeout / 1000}
                    onChange={(e) => handleSettingChange('leaderTimeout', parseInt(e.target.value) * 1000)}
                    className="flex-1"
                    data-testid="slider-leader-timeout"
                  />
                  <span className="text-lg font-semibold w-16 text-center">
                    {currentSettings.leaderTimeout / 1000}s
                  </span>
                </div>
                <p className="text-sm text-gray-400 mt-1">
                  Time before triggering leader disconnect alert
                </p>
              </div>
            </div>
          </div>

          {/* Video Settings */}
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
            <h4 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Camera className="w-5 h-5" />
              Video Recording Settings
            </h4>
            
            <div className="space-y-4">
              {/* Video Quality */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Video Quality
                </label>
                <div className="flex gap-3">
                  <button
                    onClick={() => handleSettingChange('videoQuality', '720p')}
                    className={`flex-1 px-4 py-2 rounded-lg transition-colors ${
                      currentSettings.videoQuality === '720p'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                    data-testid="button-quality-720p"
                  >
                    720p
                  </button>
                  <button
                    onClick={() => handleSettingChange('videoQuality', '1080p')}
                    className={`flex-1 px-4 py-2 rounded-lg transition-colors ${
                      currentSettings.videoQuality === '1080p'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                    data-testid="button-quality-1080p"
                  >
                    1080p
                  </button>
                </div>
              </div>

              {/* Loop Duration */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Video Loop Duration (seconds)
                </label>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min="30"
                    max="120"
                    step="10"
                    value={currentSettings.videoLoopDuration}
                    onChange={(e) => handleSettingChange('videoLoopDuration', parseInt(e.target.value))}
                    className="flex-1"
                    data-testid="slider-loop-duration"
                  />
                  <span className="text-lg font-semibold w-16 text-center">
                    {currentSettings.videoLoopDuration}s
                  </span>
                </div>
                <p className="text-sm text-gray-400 mt-1">
                  Amount of footage kept in circular buffer
                </p>
              </div>

              {/* Auto Upload */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Auto-Upload Videos</p>
                  <p className="text-sm text-gray-400">
                    Automatically upload alert videos to cloud storage
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={currentSettings.autoUploadVideos}
                    onChange={(e) => handleSettingChange('autoUploadVideos', e.target.checked)}
                    data-testid="toggle-auto-upload"
                  />
                  <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>
          </div>

          {/* Safety Disclaimer (always visible when enabled) */}
          <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-yellow-200">⚠️ Safety Disclaimer</p>
                <p className="text-sm text-gray-300 mt-1">
                  This system is an ADDITIONAL safety layer. Physical high pole procedures MUST still be followed.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConvoySettings;
