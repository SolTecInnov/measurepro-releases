import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Settings, RotateCcw, Zap, Timer, Ruler, Info } from 'lucide-react';
import type { TAppCfg } from '../../lib/overhead/config.schema';
import { DefaultConfig } from '../../lib/overhead/config.schema';
import { POI_TYPES } from '../../lib/poi';
import { useSettingsStore } from '../../lib/settings';
import {
  useBufferConfigStore,
  BUFFER_ENABLED_POI_TYPES
} from '../../lib/detection/BufferDetectionService';
import { getAutoCaptureConfig, saveAutoCaptureConfig } from '@/hooks/logging/useCounterMode';
import { scheduleDatabaseSync } from '@/lib/settings';

/** Auto-Capture Settings — user-adjustable parameters for sky→object→sky detection */
function AutoCaptureSettings() {
  const [cfg, setCfg] = useState(getAutoCaptureConfig);

  const update = (key: string, value: number) => {
    const next = { ...cfg, [key]: value };
    setCfg(next);
    saveAutoCaptureConfig(next);
    scheduleDatabaseSync(); // Sync to cloud per-user
  };

  return (
    <div className="p-4 space-y-4">
      <div className="p-3 bg-green-900/20 border border-green-500/20 rounded-lg mb-4">
        <p className="text-sm text-green-300">
          <strong>Auto-Capture</strong> detects overhead objects using sky→object→sky transitions.
          All buffered readings are saved in the POI notes. The lowest reading becomes the POI height.
        </p>
      </div>

      {/* Sky Timeout */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <Label className="text-sm text-gray-300">Sky Timeout</Label>
          <span className="text-sm font-mono text-green-400">{(cfg.skyTimeoutMs / 1000).toFixed(1)}s</span>
        </div>
        <input
          type="range" min={100} max={3000} step={100} value={cfg.skyTimeoutMs}
          onChange={(e) => update('skyTimeoutMs', parseInt(e.target.value))}
          className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-green-500"
          data-testid="slider-sky-timeout"
        />
        <p className="text-xs text-gray-400">How long sky must be detected before logging the POI (min: 0.1s)</p>
      </div>

      {/* Max Object Duration */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <Label className="text-sm text-gray-300">Max Object Duration</Label>
          <span className="text-sm font-mono text-green-400">{(cfg.maxObjectMs / 1000).toFixed(1)}s</span>
        </div>
        <input
          type="range" min={100} max={30000} step={100} value={cfg.maxObjectMs}
          onChange={(e) => update('maxObjectMs', parseInt(e.target.value))}
          className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-green-500"
          data-testid="slider-max-object-duration"
        />
        <p className="text-xs text-gray-400">Force-log after this duration even if sky hasn't returned (min: 0.1s)</p>
      </div>

      {/* Max Object Distance */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <Label className="text-sm text-gray-300">Max Object Distance</Label>
          <span className="text-sm font-mono text-green-400">{cfg.maxObjectDistM}m</span>
        </div>
        <input
          type="range" min={1} max={1000} step={1} value={cfg.maxObjectDistM}
          onChange={(e) => update('maxObjectDistM', parseInt(e.target.value))}
          className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-green-500"
          data-testid="slider-max-object-distance"
        />
        <p className="text-xs text-gray-400">Force-log after traveling this distance under an object (min: 1m)</p>
      </div>

      {/* Reset */}
      <div className="flex justify-end pt-2">
        <Button
          variant="outline" size="sm" className="text-xs"
          onClick={() => { localStorage.removeItem('auto_capture_config'); setCfg(getAutoCaptureConfig()); }}
          data-testid="button-reset-auto-capture"
        >
          <RotateCcw className="w-3 h-3 mr-1" /> Reset to Defaults
        </Button>
      </div>

      <div className="p-3 bg-blue-900/20 border border-blue-500/20 rounded-lg">
        <p className="text-sm text-blue-300">
          Auto-Capture also respects <strong>Ignore Below</strong> and <strong>Ignore Above</strong> thresholds from Alert Settings.
        </p>
      </div>
    </div>
  );
}

const STORAGE_KEY = 'overhead_detection_config';

interface SettingInfo {
  label: string;
  description: string;
  standard: string;
  increase: string;
  decrease: string;
  unit?: string;
}

const SETTING_EXPLANATIONS: Record<string, SettingInfo> = {
  counterThreshold: {
    label: 'Counter Threshold',
    description: 'Number of consecutive clear readings needed to end detection and log POI.',
    standard: '10 readings - Good balance of speed and stability',
    increase: 'Higher = More stable, waits longer before logging',
    decrease: 'Lower = Faster logging, may be less stable',
    unit: ''
  },
  bufferDistanceM: {
    label: 'Buffer Distance',
    description: 'Distance to buffer measurements before creating POI.',
    standard: '50m - Good for most objects',
    increase: 'Higher = Captures longer objects',
    decrease: 'Lower = Faster POI creation',
    unit: 'm'
  },
  bufferTimeSeconds: {
    label: 'Buffer Time',
    description: 'Time to buffer measurements before creating POI.',
    standard: '5s - Good balance',
    increase: 'Higher = Captures more data',
    decrease: 'Lower = Faster POI creation',
    unit: 's'
  }
};

export function DetectionSettings() {
  const { loggingSettings, setLoggingSettings } = useSettingsStore();
  const [config, setConfig] = useState<TAppCfg>(DefaultConfig);
  
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    bufferDetection: false,
    counterDetection: false
  });
  
  const bufferConfigs = useBufferConfigStore((state) => state.configs);
  const setBufferConfig = useBufferConfigStore((state) => state.setConfig);

  useEffect(() => {
    // Use dedicated store field as authoritative source
    const storeConfig = useSettingsStore.getState().overheadDetectionConfig;
    if (storeConfig) {
      setConfig(storeConfig);
      return;
    }
    // Fall back to localStorage cache (populated on first load from legacy data)
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.global && parsed.events) {
          setConfig(parsed as TAppCfg);
          useSettingsStore.getState().setOverheadDetectionConfig(parsed as TAppCfg);
        } else {
          setConfig(DefaultConfig);
          useSettingsStore.getState().setOverheadDetectionConfig(DefaultConfig);
        }
      } catch {
        setConfig(DefaultConfig);
        useSettingsStore.getState().setOverheadDetectionConfig(DefaultConfig);
      }
    } else {
      setConfig(DefaultConfig);
      useSettingsStore.getState().setOverheadDetectionConfig(DefaultConfig);
    }
  }, []);

  useEffect(() => {
    const handleConfigUpdate = () => {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed && parsed.global && parsed.events) {
            setConfig(parsed);
          }
        } catch (err) {
          // Ignore parse errors
        }
      }
    };

    window.addEventListener('overhead-config-updated', handleConfigUpdate);
    return () => window.removeEventListener('overhead-config-updated', handleConfigUpdate);
  }, []);

  const saveConfig = (newConfig: TAppCfg) => {
    setConfig(newConfig);
    // setOverheadDetectionConfig mirrors to localStorage, fires 'overhead-config-updated', and triggers cloud sync
    useSettingsStore.getState().setOverheadDetectionConfig(newConfig);
  };

  const resetToDefaults = () => {
    saveConfig(DefaultConfig);
    useBufferConfigStore.getState().resetToDefaults();
  };

  const updateGlobalConfig = (field: string, value: number | boolean | string) => {
    const newConfig = {
      ...config,
      global: {
        ...config.global,
        [field]: value
      }
    };
    saveConfig(newConfig);
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const renderSettingControl = (
    value: number,
    onChange: (val: number) => void,
    info: SettingInfo,
    min: number,
    max: number,
    step: number
  ) => (
    <div className="space-y-2 p-4 bg-gray-800/50 rounded-lg border border-gray-700">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-semibold text-emerald-400">{info.label}</Label>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            value={value}
            onChange={(e) => onChange(parseFloat(e.target.value))}
            min={min}
            max={max}
            step={step}
            className="w-24 h-8 bg-gray-900 border-gray-600 text-white"
            data-testid={`input-${info.label.toLowerCase().replace(/\s+/g, '-')}`}
          />
          <span className="text-xs text-gray-400 w-8">{info.unit}</span>
        </div>
      </div>
      
      <input
        type="range"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        min={min}
        max={max}
        step={step}
        className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
        data-testid={`slider-${info.label.toLowerCase().replace(/\s+/g, '-')}`}
      />
      
      <div className="space-y-1 text-xs">
        <p className="text-gray-300">{info.description}</p>
        <div className="grid grid-cols-1 gap-1 text-gray-400">
          <div className="flex items-start gap-1">
            <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
            <span><strong>Standard:</strong> {info.standard}</span>
          </div>
          <div className="flex items-start gap-1 pl-4">
            <span>↑ {info.increase}</span>
          </div>
          <div className="flex items-start gap-1 pl-4">
            <span>↓ {info.decrease}</span>
          </div>
        </div>
      </div>
    </div>
  );

  if (!config || !config.global) {
    return (
      <div className="space-y-6">
        <Card className="p-6 bg-gray-800 border-gray-700">
          <div className="flex items-center gap-3">
            <Settings className="w-6 h-6 text-emerald-400" />
            <h2 className="text-2xl font-bold text-white">Detection Settings</h2>
          </div>
          <p className="text-gray-400 mt-4">Loading configuration...</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="p-6 bg-gray-800 border-gray-700">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Settings className="w-6 h-6 text-emerald-400" />
            <h2 className="text-2xl font-bold text-white">Detection Settings</h2>
          </div>
          <Button
            onClick={resetToDefaults}
            variant="outline"
            className="flex items-center gap-2"
            data-testid="button-reset-defaults"
          >
            <RotateCcw className="w-4 h-4" />
            Reset to Defaults
          </Button>
        </div>

        <div className="space-y-4">
          {/* Auto-Capture Settings */}
          <div className="border border-green-500/30 rounded-lg overflow-hidden bg-green-900/10">
            <button
              onClick={() => toggleSection('counterDetection')}
              className="w-full p-4 bg-green-800/30 hover:bg-green-800/50 flex items-center justify-between"
              data-testid="button-toggle-auto-capture"
            >
              <div>
                <span className="font-semibold text-green-300 block">Auto-Capture Settings</span>
                <span className="text-xs text-green-400/70">Sky→Object→Sky detection — logs lowest reading automatically</span>
              </div>
              <span className="text-green-400">{expandedSections.counterDetection ? '▼' : '▶'}</span>
            </button>
            {expandedSections.counterDetection && (
              <AutoCaptureSettings />
            )}
          </div>

          {/* Auto-Capture Lookback Delay */}
          <div className="space-y-4">
            <div className="p-4 bg-blue-900/20 border border-blue-500/30 rounded-lg space-y-3">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-5 h-5 text-blue-400" />
                <h3 className="text-sm font-semibold text-blue-300">Auto-Capture Lookback Delay</h3>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium text-blue-200">
                    Delay: {(loggingSettings?.captureDelay ?? 1.0).toFixed(1)}s
                  </Label>
                </div>
                
                <input
                  type="range"
                  min="0.1"
                  max="5.0"
                  step="0.1"
                  value={loggingSettings?.captureDelay ?? 1.0}
                  onChange={(e) => setLoggingSettings({ 
                    captureDelay: parseFloat(e.target.value) 
                  })}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  data-testid="slider-capture-delay"
                />
                
                <p className="text-xs text-gray-300">
                  Uses a frame from <span className="text-blue-400 font-semibold">{(loggingSettings?.captureDelay ?? 1.0).toFixed(1)}s ago</span> when auto-capturing photos. Useful when camera and laser are mounted in different positions on your vehicle.
                </p>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
