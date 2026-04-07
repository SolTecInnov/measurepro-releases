import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  MapPin, 
  Route as RouteIcon, 
  AlertTriangle, 
  Zap,
  Sparkles,
  Shield,
  TrendingUp,
  Navigation,
  Eye
} from 'lucide-react';
import { useLoadSettings } from '../../lib/hooks';
import { useSettingsStore } from '../../lib/settings';
import { useRouteEnforcementStore } from '../../lib/stores/routeEnforcementStore';
import { toast } from 'sonner';

const PermittedRouteSettings = () => {
  useLoadSettings();
  const navigate = useNavigate();
  const { settings, setSettings } = useRouteEnforcementStore();

  const currentSettings = settings || {
    enabled: false,
    maxActiveConvoys: 3,
    additionalConvoySlots: 0,
    defaultRuralDeviation: 30,
    defaultUrbanDeviation: 15,
    defaultPersistence: 7,
    defaultMaxAccuracy: 15,
    enableStopModal: true,
    enableAudioAlerts: true,
    autoVideoOnIncident: true,
    offlineDetectionEnabled: true,
    queueIncidentsOffline: true,
  };

  const handleToggleEnabled = (enabled: boolean) => {
    // Password validation disabled - directly enable/disable
    setSettings({
      ...currentSettings,
      enabled
    });
    
    if (enabled && !currentSettings.enabled) {
      // toast suppressed
    }
  };

  const handleSettingChange = (field: string, value: any) => {
    setSettings({
      ...currentSettings,
      [field]: value
    });
  };

  const totalConvoySlots = currentSettings.maxActiveConvoys + currentSettings.additionalConvoySlots;

  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-green-600 rounded-lg">
          <RouteIcon className="w-6 h-6" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-semibold">Permitted Route Enforcement</h3>
            <div className="inline-flex items-center gap-1 bg-purple-900/40 border border-purple-500 rounded-full px-2 py-0.5">
              <Sparkles className="w-3 h-3 text-purple-400" />
              <span className="text-purple-300 text-xs font-semibold">BETA</span>
            </div>
          </div>
          <p className="text-sm text-gray-400">GPS-Enforced Route Compliance for Permitted Loads</p>
        </div>
      </div>

      {/* Enable/Disable Toggle */}
      <div className="bg-gray-700 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className={`w-5 h-5 ${currentSettings.enabled ? 'text-green-500' : 'text-gray-400'}`} />
            <div>
              <h4 className="font-medium">Route Enforcement Status</h4>
              <p className="text-sm text-gray-400">
                {currentSettings.enabled ? 'Active - monitoring permitted routes' : 'Disabled - feature inactive'}
              </p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={currentSettings.enabled}
              onChange={(e) => handleToggleEnabled(e.target.checked)}
              className="sr-only peer"
              data-testid="toggle-enabled"
            />
            <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
          </label>
        </div>
      </div>

      {currentSettings.enabled && (
        <>
          {/* Billing & Convoy Limits */}
          <div className="bg-gradient-to-br from-green-900/30 to-purple-900/30 border border-green-800/50 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <TrendingUp className="w-5 h-5 text-green-400 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-medium mb-2">Active Convoy Slots</h4>
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="text-3xl font-bold text-green-400">{totalConvoySlots}</span>
                  <span className="text-gray-400">slots available</span>
                </div>
                <div className="text-sm text-gray-300 space-y-1">
                  <p>Base Plan: {currentSettings.maxActiveConvoys} convoys included ($350/month)</p>
                  {currentSettings.additionalConvoySlots > 0 && (
                    <p>Additional Slots: {currentSettings.additionalConvoySlots} × $55/month = ${currentSettings.additionalConvoySlots * 55}/month</p>
                  )}
                  <p className="text-gray-400 text-xs mt-2">
                    Contact sales to purchase additional convoy slots
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Route Detection Settings */}
          <div className="bg-gray-700 rounded-lg p-4 space-y-4">
            <h4 className="font-medium flex items-center gap-2">
              <Navigation className="w-5 h-5 text-green-500" />
              Route Detection Settings
            </h4>
            
            {/* Rural Deviation */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Rural Allowed Deviation: {currentSettings.defaultRuralDeviation}m
              </label>
              <input
                type="range"
                min="10"
                max="100"
                step="5"
                value={currentSettings.defaultRuralDeviation}
                onChange={(e) => handleSettingChange('defaultRuralDeviation', Number(e.target.value))}
                className="w-full"
                data-testid="slider-rural-deviation"
              />
              <p className="text-xs text-gray-400 mt-1">
                Buffer distance for rural areas (typically 30-50m)
              </p>
            </div>

            {/* Urban Deviation */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Urban Allowed Deviation: {currentSettings.defaultUrbanDeviation}m
              </label>
              <input
                type="range"
                min="5"
                max="50"
                step="5"
                value={currentSettings.defaultUrbanDeviation}
                onChange={(e) => handleSettingChange('defaultUrbanDeviation', Number(e.target.value))}
                className="w-full"
                data-testid="slider-urban-deviation"
              />
              <p className="text-xs text-gray-400 mt-1">
                Buffer distance for urban areas (typically 10-20m)
              </p>
            </div>

            {/* Persistence Time */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Off-Route Persistence: {currentSettings.defaultPersistence}s
              </label>
              <input
                type="range"
                min="1"
                max="30"
                step="1"
                value={currentSettings.defaultPersistence}
                onChange={(e) => handleSettingChange('defaultPersistence', Number(e.target.value))}
                className="w-full"
                data-testid="slider-persistence"
              />
              <p className="text-xs text-gray-400 mt-1">
                How long driver must be off-route before triggering alert
              </p>
            </div>

            {/* Max GPS Accuracy */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Maximum GPS Accuracy: {currentSettings.defaultMaxAccuracy}m
              </label>
              <input
                type="range"
                min="5"
                max="50"
                step="5"
                value={currentSettings.defaultMaxAccuracy}
                onChange={(e) => handleSettingChange('defaultMaxAccuracy', Number(e.target.value))}
                className="w-full"
                data-testid="slider-max-accuracy"
              />
              <p className="text-xs text-gray-400 mt-1">
                GPS fixes with worse accuracy will be rejected
              </p>
            </div>
          </div>

          {/* Alert Settings */}
          <div className="bg-gray-700 rounded-lg p-4 space-y-3">
            <h4 className="font-medium flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-500" />
              Alert Settings
            </h4>
            
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-sm">Enable Full-Screen STOP Modal</span>
              <input
                type="checkbox"
                checked={currentSettings.enableStopModal}
                onChange={(e) => handleSettingChange('enableStopModal', e.target.checked)}
                className="toggle"
                data-testid="toggle-stop-modal"
              />
            </label>

            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-sm">Enable Audio Alerts</span>
              <input
                type="checkbox"
                checked={currentSettings.enableAudioAlerts}
                onChange={(e) => handleSettingChange('enableAudioAlerts', e.target.checked)}
                className="toggle"
                data-testid="toggle-audio-alerts"
              />
            </label>

            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-sm">Auto-Record Video on Incident</span>
              <input
                type="checkbox"
                checked={currentSettings.autoVideoOnIncident}
                onChange={(e) => handleSettingChange('autoVideoOnIncident', e.target.checked)}
                className="toggle"
                data-testid="toggle-auto-video"
              />
            </label>
          </div>

          {/* Offline Settings */}
          <div className="bg-gray-700 rounded-lg p-4 space-y-3">
            <h4 className="font-medium flex items-center gap-2">
              <Zap className="w-5 h-5 text-blue-500" />
              Offline Behavior
            </h4>
            
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-sm">Continue Detection Offline</span>
              <input
                type="checkbox"
                checked={currentSettings.offlineDetectionEnabled}
                onChange={(e) => handleSettingChange('offlineDetectionEnabled', e.target.checked)}
                className="toggle"
                data-testid="toggle-offline-detection"
              />
            </label>

            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-sm">Queue Incidents for Sync</span>
              <input
                type="checkbox"
                checked={currentSettings.queueIncidentsOffline}
                onChange={(e) => handleSettingChange('queueIncidentsOffline', e.target.checked)}
                className="toggle"
                data-testid="toggle-queue-incidents"
              />
            </label>
          </div>

          {/* Quick Actions */}
          <div className="bg-gray-700 rounded-lg p-4">
            <h4 className="font-medium mb-3">Quick Actions</h4>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => navigate('/route-enforcement/dispatch')}
                className="px-4 py-3 bg-green-600 hover:bg-green-700 rounded-lg font-medium flex items-center justify-center gap-2"
                data-testid="button-open-dispatch"
              >
                <Eye className="w-4 h-4" />
                Dispatch Console
              </button>
              <button
                onClick={() => navigate('/route-enforcement/driver')}
                className="px-4 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium flex items-center justify-center gap-2"
                data-testid="button-open-driver"
              >
                <MapPin className="w-4 h-4" />
                Driver Interface
              </button>
            </div>
          </div>
        </>
      )}

      {!currentSettings.enabled && (
        <div className="bg-gray-700 rounded-lg p-6 text-center">
          <RouteIcon className="w-12 h-12 text-gray-500 mx-auto mb-3" />
          <h4 className="font-medium mb-2">Route Enforcement Disabled</h4>
          <p className="text-sm text-gray-400 mb-4">
            Enable Permitted Route Enforcement to access dispatch console and driver interface.
          </p>
          <p className="text-xs text-gray-500">
            $350/month • 3 convoys included • $55/convoy additional
          </p>
        </div>
      )}
    </div>
  );
};

export default PermittedRouteSettings;