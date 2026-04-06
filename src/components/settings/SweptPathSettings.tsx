import React, { useState } from 'react';
import { Route, Sparkles, Truck } from 'lucide-react';
import { useSweptPathStore } from '../../stores/sweptPathStore';
import { useEnvelopeStore } from '../../stores/envelopeStore';
import { toast } from 'sonner';

const SweptPathSettings = () => {
  const { settings, setSettings } = useSweptPathStore();
  const { getActiveProfile, switchProfile, profiles, settings: envelopeSettings } = useEnvelopeStore();

  const isEnvelopeEnabled = envelopeSettings.enabled;

  const handleToggleEnabled = (enabled: boolean) => {
    if (enabled && !isEnvelopeEnabled) {
      toast.error('Envelope Clearance add-on is required for Swept Path Analysis');
      return;
    }
    
    // Password validation disabled - directly enable/disable
    setSettings({ enabled });
    
    if (enabled && !settings.enabled) {
      toast.success('Swept Path Analysis enabled successfully');
    }
  };

  return (
    <div className="space-y-6">
      {/* Feature Header */}
      <div className="bg-gradient-to-r from-purple-500 to-indigo-600 p-6 rounded-lg text-white">
        <div className="flex items-center gap-3 mb-2">
          <Route className="w-8 h-8" />
          <h2 className="text-2xl font-bold">Swept Path Analysis & Turn Prediction</h2>
        </div>
        <p className="text-white/90">
          Premium add-on: $450/month - Simulate vehicle turns and predict swept path envelopes
        </p>
        <p className="text-white/80 text-sm mt-2 flex items-center gap-2">
          <Truck className="w-4 h-4" />
          <span>Requires: Envelope Clearance add-on</span>
        </p>
      </div>

      {/* Dependency Warning */}
      {!isEnvelopeEnabled && (
        <div className="border border-orange-500 bg-orange-500/10 rounded-lg p-4">
          <p className="text-orange-400 font-medium flex items-center gap-2">
            <Truck className="w-5 h-5" />
            <span>Envelope Clearance Required</span>
          </p>
          <p className="text-sm text-gray-300 mt-2">
            Swept Path Analysis requires the Envelope Clearance add-on to access vehicle profiles. 
            Please enable Envelope Clearance first.
          </p>
        </div>
      )}

      {/* Activation Toggle */}
      <div className="border border-border rounded-lg p-4">
        <label className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            <span className="font-medium">Enable Swept Path Analysis</span>
          </div>
          <input
            type="checkbox"
            checked={settings.enabled}
            onChange={(e) => handleToggleEnabled(e.target.checked)}
            disabled={!isEnvelopeEnabled}
            className="toggle"
            data-testid="toggle-swept-path-enabled"
          />
        </label>
        {!isEnvelopeEnabled && (
          <p className="text-sm text-gray-400 mt-2">
            Enable Envelope Clearance to activate this feature
          </p>
        )}
      </div>

      {/* Settings (only visible when enabled) */}
      {settings.enabled && (
        <div className="space-y-4">
          {/* Vehicle Selection */}
          <div className="border border-border rounded-lg p-4 bg-gray-700/50">
            <label className="block mb-2">
              <div className="flex items-center gap-2 mb-2">
                <Truck className="w-5 h-5 text-purple-400" />
                <span className="font-medium">Vehicle Profile</span>
              </div>
              <select
                value={getActiveProfile()?.id || ''}
                onChange={(e) => switchProfile(e.target.value)}
                className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white"
                data-testid="select-vehicle-profile"
              >
                <option value="">Select a vehicle...</option>
                {profiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.name}
                  </option>
                ))}
              </select>
            </label>
            {getActiveProfile() && (
              <p className="text-sm text-gray-400 mt-2">
                {getActiveProfile()?.description}
              </p>
            )}
          </div>

          {/* Auto-detect turns */}
          <label className="flex items-center justify-between">
            <span>Auto-detect turns</span>
            <input
              type="checkbox"
              checked={settings.autoDetect}
              onChange={(e) => setSettings({ autoDetect: e.target.checked })}
              data-testid="toggle-auto-detect"
            />
          </label>

          {/* Visualization toggles */}
          <label className="flex items-center justify-between">
            <span>Show road boundaries</span>
            <input
              type="checkbox"
              checked={settings.showRoadBoundaries}
              onChange={(e) => setSettings({ showRoadBoundaries: e.target.checked })}
              data-testid="toggle-road-boundaries"
            />
          </label>

          <label className="flex items-center justify-between">
            <span>Show vehicle envelope</span>
            <input
              type="checkbox"
              checked={settings.showVehicleEnvelope}
              onChange={(e) => setSettings({ showVehicleEnvelope: e.target.checked })}
              data-testid="toggle-vehicle-envelope"
            />
          </label>

          <label className="flex items-center justify-between">
            <span>Show collision markers</span>
            <input
              type="checkbox"
              checked={settings.showCollisionMarkers}
              onChange={(e) => setSettings({ showCollisionMarkers: e.target.checked })}
              data-testid="toggle-collision-markers"
            />
          </label>

          <label className="flex items-center justify-between">
            <span>Show clearance zones</span>
            <input
              type="checkbox"
              checked={settings.showClearanceZones}
              onChange={(e) => setSettings({ showClearanceZones: e.target.checked })}
              data-testid="toggle-clearance-zones"
            />
          </label>

          {/* Animation speed slider */}
          <div>
            <label className="block mb-2">
              Animation Speed: {settings.animationSpeed}x
            </label>
            <input
              type="range"
              min="0.5"
              max="2.0"
              step="0.1"
              value={settings.animationSpeed}
              onChange={(e) => setSettings({ animationSpeed: parseFloat(e.target.value) })}
              className="w-full"
              data-testid="slider-animation-speed"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default SweptPathSettings;
