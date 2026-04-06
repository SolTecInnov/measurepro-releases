import React from 'react';
import { Volume2, Info, Zap, RefreshCw } from 'lucide-react';
import { AmplitudeFilterSettings, AmplitudeFilterStats } from '../../lib/hardware/laser/amplitudeFilter';

interface AmplitudeFilterControlProps {
  settings: AmplitudeFilterSettings;
  stats: AmplitudeFilterStats;
  onSettingsChange: (settings: Partial<AmplitudeFilterSettings>) => void;
  onApplySuggested?: () => void;
  onReset?: () => void;
}

const AmplitudeFilterControl: React.FC<AmplitudeFilterControlProps> = ({
  settings,
  stats,
  onSettingsChange,
  onApplySuggested,
  onReset
}) => {
  const [showInfo, setShowInfo] = React.useState(false);
  const acceptanceRate = stats.accepted + stats.rejected > 0
    ? ((stats.accepted / (stats.accepted + stats.rejected)) * 100).toFixed(1)
    : '100.0';

  return (
    <div className="bg-gray-900 p-4 rounded-lg" data-testid="amplitude-filter-control">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium text-gray-300 flex items-center gap-2">
          <Volume2 className="w-4 h-4 text-purple-400" />
          Signal Amplitude Filter (dB)
        </h4>
        <button
          onClick={() => setShowInfo(!showInfo)}
          className="text-gray-400 hover:text-gray-200 transition-colors"
          data-testid="amplitude-info-toggle"
        >
          <Info className="w-4 h-4" />
        </button>
      </div>

      {showInfo && (
        <div className="mb-4 p-3 bg-gray-800 rounded text-xs text-gray-400">
          <p className="mb-2">
            <strong>Signal Amplitude (dB)</strong> measures the strength of the returned laser signal.
            Higher values indicate stronger, more reliable reflections.
          </p>
          <p className="mb-2">
            <strong>Low amplitude</strong> often indicates: rain, fog, snow, dust, or poor target reflectivity.
            By setting a minimum threshold, unreliable measurements are filtered out.
          </p>
          <p className="mb-2">
            <strong>Hysteresis</strong> prevents rapid on/off flickering when amplitude hovers near the threshold.
            The signal must recover above threshold + hysteresis to resume accepting measurements.
          </p>
          <p>
            <strong>Auto Mode</strong> analyzes recent stable readings to suggest an optimal threshold.
          </p>
        </div>
      )}

      <div className="space-y-4">
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs text-gray-400">Threshold</label>
            <span className="text-xs font-mono text-purple-400">{settings.amplitudeThresholdDb.toFixed(1)} dB</span>
          </div>
          <input
            type="range"
            min="0"
            max="50"
            step="0.5"
            value={settings.amplitudeThresholdDb}
            onChange={(e) => onSettingsChange({ amplitudeThresholdDb: parseFloat(e.target.value) })}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
            data-testid="amplitude-threshold-slider"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>0 dB (no filter)</span>
            <span>50 dB (strict)</span>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs text-gray-400">Hysteresis</label>
            <span className="text-xs font-mono text-purple-400">{settings.hysteresisDb.toFixed(1)} dB</span>
          </div>
          <input
            type="range"
            min="0.5"
            max="10"
            step="0.5"
            value={settings.hysteresisDb}
            onChange={(e) => onSettingsChange({ hysteresisDb: parseFloat(e.target.value) })}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
            data-testid="amplitude-hysteresis-slider"
          />
        </div>

        <div className="flex items-center justify-between">
          <label className="text-xs text-gray-400">Auto-Suggest Mode</label>
          <button
            onClick={() => onSettingsChange({ autoModeEnabled: !settings.autoModeEnabled })}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
              settings.autoModeEnabled ? 'bg-purple-600' : 'bg-gray-600'
            }`}
            data-testid="amplitude-auto-mode-toggle"
          >
            <span
              className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                settings.autoModeEnabled ? 'translate-x-5' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {settings.autoModeEnabled && stats.suggestedThreshold !== null && (
          <div className="flex items-center justify-between p-2 bg-purple-900/30 rounded">
            <span className="text-xs text-purple-300">
              Suggested: {stats.suggestedThreshold.toFixed(1)} dB
            </span>
            <button
              onClick={onApplySuggested}
              className="px-2 py-1 text-xs bg-purple-600 hover:bg-purple-700 text-white rounded flex items-center gap-1"
              data-testid="amplitude-apply-suggested"
            >
              <Zap className="w-3 h-3" />
              Apply
            </button>
          </div>
        )}
      </div>

      <div className="mt-4 grid grid-cols-4 gap-2 text-center">
        <div className="bg-gray-800 p-2 rounded">
          <div className="text-green-400 font-mono text-lg">{stats.accepted}</div>
          <div className="text-xs text-gray-500">Accepted</div>
        </div>
        <div className="bg-gray-800 p-2 rounded">
          <div className="text-red-400 font-mono text-lg">{stats.rejected}</div>
          <div className="text-xs text-gray-500">Rejected</div>
        </div>
        <div className="bg-gray-800 p-2 rounded">
          <div className={`font-mono text-lg ${
            parseFloat(acceptanceRate) >= 80 ? 'text-green-400' :
            parseFloat(acceptanceRate) >= 50 ? 'text-yellow-400' :
            'text-red-400'
          }`}>
            {acceptanceRate}%
          </div>
          <div className="text-xs text-gray-500">Rate</div>
        </div>
        <div className="bg-gray-800 p-2 rounded">
          <div className="text-purple-400 font-mono text-lg">
            {stats.lastAmplitude?.toFixed(1) ?? '--'}
          </div>
          <div className="text-xs text-gray-500">Last dB</div>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <div className={`text-xs flex items-center gap-1 ${
          stats.filterState === 'accepting' ? 'text-green-400' : 'text-red-400'
        }`}>
          <span className={`w-2 h-2 rounded-full ${
            stats.filterState === 'accepting' ? 'bg-green-400' : 'bg-red-400'
          }`} />
          {stats.filterState === 'accepting' ? 'Accepting Signals' : 'Rejecting (Low Signal)'}
        </div>
        {onReset && (
          <button
            onClick={onReset}
            className="text-xs text-gray-400 hover:text-gray-200 flex items-center gap-1"
            data-testid="amplitude-reset-stats"
          >
            <RefreshCw className="w-3 h-3" />
            Reset Stats
          </button>
        )}
      </div>

      {stats.averageAmplitude !== null && (
        <div className="mt-2 text-xs text-gray-500">
          Average amplitude (last {settings.windowSize}): {stats.averageAmplitude.toFixed(1)} dB
        </div>
      )}
    </div>
  );
};

export default AmplitudeFilterControl;
