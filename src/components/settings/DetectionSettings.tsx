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
          {/* Counter Detection Mode Settings */}
          <div className="border border-green-500/30 rounded-lg overflow-hidden bg-green-900/10">
            <button
              onClick={() => toggleSection('counterDetection')}
              className="w-full p-4 bg-green-800/30 hover:bg-green-800/50 flex items-center justify-between"
              data-testid="button-toggle-counter-detection"
            >
              <div>
                <span className="font-semibold text-green-300 block">Counter Detection Mode</span>
                <span className="text-xs text-green-400/70">Speed-independent detection (0-120+ km/h) using counter-based debouncing</span>
              </div>
              <span className="text-green-400">{expandedSections.counterDetection ? '▼' : '▶'}</span>
            </button>
            {expandedSections.counterDetection && (
              <div className="p-4 space-y-4">
                <div className="p-3 bg-green-900/20 border border-green-500/20 rounded-lg mb-4">
                  <p className="text-sm text-green-300">
                    <strong>Counter Detection Mode:</strong> Counter starts at threshold (default 10), resets to 0 when objects detected,
                    increments on clear/sky readings. When counter reaches threshold again, logs minimum height + GPS.
                    Works reliably at ALL speeds (0-120+ km/h).
                  </p>
                </div>
                {renderSettingControl(
                  config.global.counterThreshold,
                  (val) => updateGlobalConfig('counterThreshold', val),
                  SETTING_EXPLANATIONS.counterThreshold,
                  5, 20, 1
                )}
                
                {/* Buffer Settings for Counter Detection */}
                <div className="p-3 bg-cyan-900/20 border border-cyan-500/20 rounded-lg">
                  <p className="text-sm font-semibold text-cyan-300 mb-2">Object Detection Buffer Settings</p>
                  <p className="text-xs text-cyan-300/70 mb-3">
                    After first object detected, buffer measurements for X meters OR X seconds before creating POI.
                  </p>
                  
                  <div className="flex items-center justify-between mb-3 p-2 bg-gray-800/50 rounded">
                    <Label className="text-sm text-cyan-300">Buffer Mode:</Label>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => updateGlobalConfig('bufferUseDistance', false)}
                        variant={!config.global.bufferUseDistance ? 'default' : 'outline'}
                        size="sm"
                        className={!config.global.bufferUseDistance ? 'bg-cyan-600 hover:bg-cyan-700' : ''}
                        data-testid="button-buffer-time"
                      >
                        Time (s)
                      </Button>
                      <Button
                        onClick={() => updateGlobalConfig('bufferUseDistance', true)}
                        variant={config.global.bufferUseDistance ? 'default' : 'outline'}
                        size="sm"
                        className={config.global.bufferUseDistance ? 'bg-cyan-600 hover:bg-cyan-700' : ''}
                        data-testid="button-buffer-distance"
                      >
                        Distance (m)
                      </Button>
                    </div>
                  </div>
                  
                  {config.global.bufferUseDistance ? (
                    renderSettingControl(
                      config.global.bufferDistanceM,
                      (val) => updateGlobalConfig('bufferDistanceM', val),
                      SETTING_EXPLANATIONS.bufferDistanceM,
                      5, 500, 5
                    )
                  ) : (
                    renderSettingControl(
                      config.global.bufferTimeSeconds,
                      (val) => updateGlobalConfig('bufferTimeSeconds', val),
                      SETTING_EXPLANATIONS.bufferTimeSeconds,
                      1, 30, 1
                    )
                  )}
                </div>
                
                <div className="p-3 bg-blue-900/20 border border-blue-500/20 rounded-lg">
                  <p className="text-sm text-blue-300">
                    <strong>Note:</strong> Counter Detection also uses "Ignore Below" and "Ignore Above" thresholds from Alert Settings.
                    Measurements outside this range are treated as "clear" readings and increment the counter.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Buffer Detection Settings */}
          <div className="border border-cyan-500/30 rounded-lg overflow-hidden bg-cyan-900/10">
            <button
              onClick={() => toggleSection('bufferDetection')}
              className="w-full p-4 bg-cyan-800/30 hover:bg-cyan-800/50 flex items-center justify-between"
              data-testid="button-toggle-buffer-detection"
            >
              <div className="flex items-center gap-2">
                <Timer className="w-5 h-5 text-cyan-400" />
                <span className="font-semibold text-cyan-300">Buffer Detection</span>
              </div>
              <span className="text-cyan-400">{expandedSections.bufferDetection ? '▼' : '▶'}</span>
            </button>
            {expandedSections.bufferDetection && (
              <div className="p-4 space-y-4">
                <div className="p-3 bg-cyan-900/20 border border-cyan-500/20 rounded-lg text-sm text-cyan-200">
                  <p>
                    Collects measurements over distance or time, then logs the <strong>lowest value</strong> as a POI.
                  </p>
                </div>
                
                {BUFFER_ENABLED_POI_TYPES.map((poiType) => {
                  const bufferConfig = bufferConfigs[poiType];
                  const poiTypeConfig = POI_TYPES.find(p => p.type === poiType);
                  const label = poiTypeConfig?.label || poiType;
                  const colorClass = poiTypeConfig?.color || 'text-gray-400';
                  
                  if (!bufferConfig) return null;
                  
                  return (
                    <div 
                      key={poiType}
                      className="p-4 bg-gray-800/50 rounded-lg border border-gray-700 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`font-medium ${colorClass}`}>{label}</span>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={bufferConfig.enabled}
                            onChange={(e) => {
                              setBufferConfig(poiType, { ...bufferConfig, enabled: e.target.checked });
                            }}
                            className="sr-only peer"
                            data-testid={`checkbox-buffer-enable-${poiType}`}
                          />
                          <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-cyan-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-600"></div>
                          <span className="ml-2 text-xs text-gray-400">Buffer</span>
                        </label>
                      </div>
                      
                      {bufferConfig.enabled && (
                        <div className="space-y-3 pt-2 border-t border-gray-600">
                          <div className="flex items-center gap-4">
                            <Label className="text-xs text-gray-400 w-16">Mode:</Label>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => setBufferConfig(poiType, { ...bufferConfig, mode: 'distance' })}
                                className={`flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                                  bufferConfig.mode === 'distance' 
                                    ? 'bg-cyan-600 text-white' 
                                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                }`}
                                data-testid={`button-buffer-mode-distance-${poiType}`}
                              >
                                <Ruler className="w-3 h-3" />
                                Distance
                              </button>
                              <button
                                onClick={() => setBufferConfig(poiType, { ...bufferConfig, mode: 'time' })}
                                className={`flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                                  bufferConfig.mode === 'time' 
                                    ? 'bg-cyan-600 text-white' 
                                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                }`}
                                data-testid={`button-buffer-mode-time-${poiType}`}
                              >
                                <Timer className="w-3 h-3" />
                                Time
                              </button>
                            </div>
                          </div>
                          
                          {bufferConfig.mode === 'distance' ? (
                            <div className="flex items-center gap-4">
                              <Label className="text-xs text-gray-400 w-16">Distance:</Label>
                              <div className="flex items-center gap-2 flex-1">
                                <Input
                                  type="number"
                                  min={10}
                                  max={1000}
                                  step={10}
                                  value={bufferConfig.distanceMeters}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value) || 100;
                                    setBufferConfig(poiType, { ...bufferConfig, distanceMeters: val });
                                  }}
                                  className="w-24 h-8 bg-gray-900 border-gray-600 text-white"
                                  data-testid={`input-buffer-distance-${poiType}`}
                                />
                                <span className="text-xs text-gray-400">meters</span>
                              </div>
                              <input
                                type="range"
                                min={10}
                                max={500}
                                step={10}
                                value={bufferConfig.distanceMeters}
                                onChange={(e) => {
                                  setBufferConfig(poiType, { ...bufferConfig, distanceMeters: parseInt(e.target.value) });
                                }}
                                className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                                data-testid={`slider-buffer-distance-${poiType}`}
                              />
                            </div>
                          ) : (
                            <div className="flex items-center gap-4">
                              <Label className="text-xs text-gray-400 w-16">Time:</Label>
                              <div className="flex items-center gap-2 flex-1">
                                <Input
                                  type="number"
                                  min={1}
                                  max={120}
                                  step={1}
                                  value={bufferConfig.timeSeconds}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value) || 10;
                                    setBufferConfig(poiType, { ...bufferConfig, timeSeconds: val });
                                  }}
                                  className="w-24 h-8 bg-gray-900 border-gray-600 text-white"
                                  data-testid={`input-buffer-time-${poiType}`}
                                />
                                <span className="text-xs text-gray-400">seconds</span>
                              </div>
                              <input
                                type="range"
                                min={1}
                                max={60}
                                step={1}
                                value={bufferConfig.timeSeconds}
                                onChange={(e) => {
                                  setBufferConfig(poiType, { ...bufferConfig, timeSeconds: parseInt(e.target.value) });
                                }}
                                className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                                data-testid={`slider-buffer-time-${poiType}`}
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
                
                <div className="flex justify-end pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      useBufferConfigStore.getState().resetToDefaults();
                    }}
                    className="text-xs"
                    data-testid="button-reset-buffer-defaults"
                  >
                    <RotateCcw className="w-3 h-3 mr-1" />
                    Reset Buffer Settings
                  </Button>
                </div>
              </div>
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
