import React from 'react';
import { useLoadSettings } from '../../lib/hooks';
import { useSettingsStore } from '../../lib/settings';
import { soundManager,
  // New clean sounds
  notifySoftSound, notifyCleanSound, poiLogSound, warningSoftSound,
  criticalAlertSound, poiConfirmSound, cameraClickSound, modeChangeSound,
  successChimeSound, alertToneSound,
  // Legacy sounds
  alertAlarmSound, classicAlarmSound, confirmationSound, criticalMp3Sound,
  doubleBeepSound, elevatorToneSound, elevatorSound, facilityAlarmSound,
  interfaceHintSound, interfaceSound, logEntryMp3Sound, longPopSound,
  messagePopSound, retroConfirmationSound, sciFiAlarmSound, securityBreachSound,
  slotMachineSound, warningMp3Sound, soundPath
} from '../../lib/sounds';
import { metersToFeetInches, feetInchesToMeters } from '../../lib/utils/unitConversion';

// All available sounds for dropdowns — new clean tones first, legacy at bottom
const availableSounds = {
  logEntry: [
    { value: poiLogSound,          label: '✨ POI Logged (clean)' },
    { value: notifySoftSound,      label: '✨ Soft Notification' },
    { value: notifyCleanSound,     label: '✨ Clean Double Beep' },
    { value: poiConfirmSound,      label: '✨ POI Confirm' },
    { value: successChimeSound,    label: '✨ Success Chime' },
    { value: cameraClickSound,     label: '✨ Camera Click' },
    { value: modeChangeSound,      label: '✨ Mode Change' },
    // Legacy
    { value: interfaceSound,       label: 'Interface Click' },
    { value: confirmationSound,    label: 'Confirmation' },
    { value: longPopSound,         label: 'Long Pop' },
    { value: doubleBeepSound,      label: 'Double Beep' },
    { value: retroConfirmationSound, label: 'Retro Confirmation' },
  ],
  warning: [
    { value: warningSoftSound,     label: '✨ Soft Warning (clean)' },
    { value: alertToneSound,       label: '✨ Alert Tone' },
    { value: notifyCleanSound,     label: '✨ Double Beep' },
    // Legacy
    { value: alertAlarmSound,      label: 'Alert Alarm' },
    { value: classicAlarmSound,    label: 'Classic Alarm' },
    { value: doubleBeepSound,      label: 'Double Beep Alert' },
    { value: sciFiAlarmSound,      label: 'Sci-Fi Alarm' },
    { value: warningMp3Sound,      label: 'Warning Sound' },
  ],
  critical: [
    { value: criticalAlertSound,   label: '✨ Critical Alert (clean)' },
    { value: alertToneSound,       label: '✨ Alert Tone' },
    // Legacy
    { value: facilityAlarmSound,   label: 'Facility Alarm' },
    { value: securityBreachSound,  label: 'Security Breach' },
    { value: sciFiAlarmSound,      label: 'Sci-Fi Critical' },
    { value: classicAlarmSound,    label: 'Classic Critical' },
  ],
  notification: [
    { value: confirmationSound, label: 'Confirmation' },
    { value: longPopSound, label: 'Long Pop (Default POI Change)' },
    { value: elevatorToneSound, label: 'Elevator Tone (Default Image)' },
    { value: messagePopSound, label: 'Message Pop (Default Measure)' },
    { value: interfaceHintSound, label: 'Interface Hint' },
    { value: retroConfirmationSound, label: 'Retro Confirmation' },
    { value: doubleBeepSound, label: 'Double Beep' },
    { value: interfaceSound, label: 'Interface' }
  ]
};

const AlertSettings = () => {
  useLoadSettings();
  const { alertSettings, setAlertSettings, displaySettings } = useSettingsStore();
  const [, forceUpdate] = React.useState({});
  const [soundSystemReady, setSoundSystemReady] = React.useState(false);
  const [audioTestResult, setAudioTestResult] = React.useState<{status: 'idle'|'testing'|'ok'|'error', message: string}>({status: 'idle', message: ''});
  const displayUnits = displaySettings?.units || 'metric';

  // Subscribe to sound config changes
  React.useEffect(() => {
    const unsubscribe = soundManager.subscribe(() => {
      forceUpdate({});
    });
    return unsubscribe;
  }, []);

  // Initialize sound system on first user interaction
  React.useEffect(() => {
    const handleFirstInteraction = async () => {
      await soundManager.initialize();
      setSoundSystemReady(true);
    };
    
    document.addEventListener('click', handleFirstInteraction, { once: true });
    document.addEventListener('touchstart', handleFirstInteraction, { once: true });
    
    return () => {
      document.removeEventListener('click', handleFirstInteraction);
      document.removeEventListener('touchstart', handleFirstInteraction);
    };
  }, []);

  // Direct audio test — bypasses SoundManager to isolate browser audio capability
  const runAudioDiagnostic = async () => {
    setAudioTestResult({ status: 'testing', message: 'Testing browser audio...' });
    try {
      const { soundPath } = await import('@/lib/sounds');
      const audio = new Audio(soundPath('confirmation.wav'));
      audio.volume = 0.8;
      await audio.play();
      audio.addEventListener('ended', () => audio.remove());
      setAudioTestResult({ status: 'ok', message: '✅ Audio is working! If you still cannot hear anything, check your device volume.' });
    } catch (err: any) {
      const msg = err?.message || String(err);
      if (msg.includes('interact') || msg.includes('gesture') || msg.includes('policy') || msg.includes('NotAllowedError')) {
        setAudioTestResult({ status: 'error', message: '❌ Audio playback initializing, then try again. This is a browser autoplay rule.' });
      } else if (msg.includes('NotSupportedError') || msg.includes('decode')) {
        setAudioTestResult({ status: 'error', message: '❌ Audio format not supported.' });
      } else {
        setAudioTestResult({ status: 'error', message: `❌ Audio error: ${msg}` });
      }
    }
  };

  const commonInputClasses = "w-full px-3 py-2 bg-gray-700 border border-gray-600 text-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500";

  // Use store settings directly (no local override)
  const settings = alertSettings;
  const thresholds = settings?.thresholds || { minHeight: 4, maxHeight: 25, warningThreshold: 0, criticalThreshold: 0 };
  
  // Helper functions for unit conversion
  const getDisplayValue = (metersValue: number) => {
    if (displayUnits === 'imperial') {
      const { totalInches } = metersToFeetInches(metersValue);
      return totalInches / 12; // Return total feet (with decimal)
    }
    return metersValue;
  };
  
  const getStorageValue = (displayValue: number) => {
    if (displayUnits === 'imperial') {
      // displayValue is in feet, convert to meters
      return feetInchesToMeters(displayValue, 0);
    }
    return displayValue;
  };
  
  const unitLabel = displayUnits === 'imperial' ? 'ft' : 'm';

  return (
    <div className="bg-gray-800 rounded-xl p-6">
      <h2 className="text-xl font-semibold mb-4">Alert Settings</h2>
      
      {/* Audio Diagnostic Panel */}
      <div className="mb-6 p-4 bg-gray-700/50 border border-gray-600 rounded-lg">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-gray-300">🔊 Audio Diagnostic</span>
          <button
            onClick={runAudioDiagnostic}
            disabled={audioTestResult.status === 'testing'}
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg text-sm font-medium"
            data-testid="button-audio-diagnostic"
          >
            {audioTestResult.status === 'testing' ? 'Testing...' : 'Test Audio Now'}
          </button>
        </div>
        {audioTestResult.status !== 'idle' && (
          <div className={`mt-2 text-sm p-2 rounded ${audioTestResult.status === 'ok' ? 'bg-green-900/30 text-green-300' : audioTestResult.status === 'error' ? 'bg-red-900/30 text-red-300' : 'bg-blue-900/30 text-blue-300'}`}>
            {audioTestResult.message}
          </div>
        )}
        {audioTestResult.status === 'idle' && (
          <p className="text-xs text-gray-500 mt-1">Click the button above to verify your browser can play audio</p>
        )}
      </div>
      
      {/* Global Alert Sound Toggle */}
      <div className="mb-6 p-4 bg-gradient-to-r from-blue-900/30 to-purple-900/30 border border-blue-500/30 rounded-lg">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-blue-300 mb-1">Master Alert Sound Control</h3>
            <p className="text-sm text-gray-400">Enable or disable all warning and critical alert sounds globally</p>
          </div>
          <label className="flex items-center gap-3">
            <span className={`text-sm font-medium ${soundManager.getConfig().alertSoundsEnabled ? 'text-green-400' : 'text-red-400'}`}>
              {soundManager.getConfig().alertSoundsEnabled ? 'ENABLED' : 'DISABLED'}
            </span>
            <input
              type="checkbox"
              checked={soundManager.getConfig().alertSoundsEnabled}
              onChange={(e) => {
                soundManager.setAlertSoundsEnabled(e.target.checked);
                forceUpdate({});
              }}
              className="w-6 h-6 rounded border-gray-600"
              data-testid="checkbox-alert-sounds-enabled"
            />
          </label>
        </div>
      </div>
      
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-medium mb-4">Sound Notifications</h3>
          <div className="grid gap-4">
            {/* Log Entry Sound */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Log Entry Sound</label>
              <div className="flex gap-2">
                <select
                  className={commonInputClasses}
                  value={soundManager.getConfig().logEntry}
                  onChange={(e) => {
                    soundManager.setSound('logEntry', e.target.value);
                    forceUpdate({});
                  }}
                >
                  {availableSounds.logEntry.map(sound => (
                    <option key={sound.value} value={sound.value}>{sound.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2 mt-2">
                <button
                  onClick={async () => {
                    await soundManager.initialize();
                    setSoundSystemReady(true);
                    await soundManager.playLogEntry();
                  }}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm"
                  data-testid="button-test-log-sound"
                >
                  Test Sound
                </button>
                {(window as any).electronAPI?.pickSoundFile && (
                  <button
                    onClick={async () => {
                      const path = await (window as any).electronAPI.pickSoundFile();
                      if (path) {
                        const url = `file:///${path.replace(/\\/g, '/')}`;
                        soundManager.setSound('logEntry', url);
                        forceUpdate({});
                      }
                    }}
                    className="px-3 py-1.5 bg-gray-600 hover:bg-gray-500 rounded-lg text-sm"
                  >
                    📂 Browse
                  </button>
                )}
              </div>
            </div>
            
            {/* Warning Sound */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Warning Sound</label>
              <div className="flex gap-2">
                <select
                  className={commonInputClasses}
                  value={soundManager.getConfig().warning}
                  onChange={(e) => {
                    soundManager.setSound('warning', e.target.value);
                    forceUpdate({});
                  }}
                >
                  {availableSounds.warning.map(sound => (
                    <option key={sound.value} value={sound.value}>{sound.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-4 mt-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={soundManager.getConfig().warningLoop}
                    onChange={(e) => soundManager.setLooping('warning', e.target.checked)}
                    className="rounded border-gray-600"
                  />
                  <span className="text-sm text-gray-300">Play until cleared</span>
                </label>
                <button
                  onClick={async () => {
                    await soundManager.initialize();
                    setSoundSystemReady(true);
                    await soundManager.playWarning();
                  }}
                  className="px-3 py-1.5 bg-yellow-600 hover:bg-yellow-700 rounded-lg text-sm"
                  data-testid="button-test-warning-sound"
                >
                  Test Sound
                </button>
                {soundManager.getConfig().warningLoop && (
                  <button
                    onClick={() => soundManager.stopSound('warning')}
                    className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm"
                    data-testid="button-stop-warning-sound"
                  >
                    Stop Sound
                  </button>
                )}
              </div>
            </div>
            
            {/* Critical Alert Sound */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Critical Alert Sound</label>
              <div className="flex gap-2">
                <select
                  className={commonInputClasses}
                  value={soundManager.getConfig().critical}
                  onChange={(e) => {
                    soundManager.setSound('critical', e.target.value);
                    forceUpdate({});
                  }}
                >
                  {availableSounds.critical.map(sound => (
                    <option key={sound.value} value={sound.value}>{sound.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-4 mt-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={soundManager.getConfig().criticalLoop}
                    onChange={(e) => soundManager.setLooping('critical', e.target.checked)}
                    className="rounded border-gray-600"
                  />
                  <span className="text-sm text-gray-300">Play until cleared</span>
                </label>
                <button
                  onClick={async () => {
                    await soundManager.initialize();
                    setSoundSystemReady(true);
                    await soundManager.playCritical();
                  }}
                  className="px-3 py-1.5 bg-red-600 hover:bg-red-700 rounded-lg text-sm"
                  data-testid="button-test-critical-sound"
                >
                  Test Sound
                </button>
                {soundManager.getConfig().criticalLoop && (
                  <button
                    onClick={() => soundManager.stopSound('critical')}
                    className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm"
                    data-testid="button-stop-critical-sound"
                  >
                    Stop Sound
                  </button>
                )}
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-gray-700 my-4"></div>

            {/* Notification Sounds Section */}
            <div className="space-y-4">
              <h4 className="text-md font-medium text-gray-200">Notification Sounds</h4>
              
              {/* POI Type Change Sound */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-300">POI Type Change</label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={soundManager.getConfig().poiTypeChangeEnabled}
                      onChange={(e) => {
                        soundManager.setNotificationEnabled('poiTypeChange', e.target.checked);
                        forceUpdate({});
                      }}
                      className="rounded border-gray-600"
                      data-testid="checkbox-poi-sound-enabled"
                    />
                    <span className="text-sm text-gray-300">Enabled</span>
                  </label>
                </div>
                <div className="flex gap-2">
                  <select
                    className={commonInputClasses}
                    value={soundManager.getConfig().poiTypeChange}
                    onChange={(e) => {
                      soundManager.setSound('poiTypeChange', e.target.value);
                      forceUpdate({});
                    }}
                    disabled={!soundManager.getConfig().poiTypeChangeEnabled}
                  >
                    {availableSounds.notification.map(sound => (
                      <option key={sound.value} value={sound.value}>{sound.label}</option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={async () => {
                    await soundManager.initialize();
                    setSoundSystemReady(true);
                    await soundManager.playPOITypeChange();
                  }}
                  disabled={!soundManager.getConfig().poiTypeChangeEnabled}
                  className="mt-2 px-3 py-1.5 bg-green-600 hover:bg-green-700 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  data-testid="button-test-poi-sound"
                >
                  Test Sound
                </button>
              </div>

              {/* Image Captured Sound */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-300">Image Captured</label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={soundManager.getConfig().imageCapturedEnabled}
                      onChange={(e) => {
                        soundManager.setNotificationEnabled('imageCaptured', e.target.checked);
                        forceUpdate({});
                      }}
                      className="rounded border-gray-600"
                      data-testid="checkbox-image-sound-enabled"
                    />
                    <span className="text-sm text-gray-300">Enabled</span>
                  </label>
                </div>
                <div className="flex gap-2">
                  <select
                    className={commonInputClasses}
                    value={soundManager.getConfig().imageCaptured}
                    onChange={(e) => {
                      soundManager.setSound('imageCaptured', e.target.value);
                      forceUpdate({});
                    }}
                    disabled={!soundManager.getConfig().imageCapturedEnabled}
                  >
                    {availableSounds.notification.map(sound => (
                      <option key={sound.value} value={sound.value}>{sound.label}</option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={async () => {
                    await soundManager.initialize();
                    setSoundSystemReady(true);
                    await soundManager.playImageCaptured();
                  }}
                  disabled={!soundManager.getConfig().imageCapturedEnabled}
                  className="mt-2 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  data-testid="button-test-image-sound"
                >
                  Test Sound
                </button>
              </div>

              {/* Measure Detected Sound */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-300">New Measurement</label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={soundManager.getConfig().measureDetectedEnabled}
                      onChange={(e) => {
                        soundManager.setNotificationEnabled('measureDetected', e.target.checked);
                        forceUpdate({});
                      }}
                      className="rounded border-gray-600"
                      data-testid="checkbox-measure-sound-enabled"
                    />
                    <span className="text-sm text-gray-300">Enabled</span>
                  </label>
                </div>
                <div className="flex gap-2">
                  <select
                    className={commonInputClasses}
                    value={soundManager.getConfig().measureDetected}
                    onChange={(e) => {
                      soundManager.setSound('measureDetected', e.target.value);
                      forceUpdate({});
                    }}
                    disabled={!soundManager.getConfig().measureDetectedEnabled}
                  >
                    {availableSounds.notification.map(sound => (
                      <option key={sound.value} value={sound.value}>{sound.label}</option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={async () => {
                    await soundManager.initialize();
                    setSoundSystemReady(true);
                    await soundManager.playMeasureDetected();
                  }}
                  disabled={!soundManager.getConfig().measureDetectedEnabled}
                  className="mt-2 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  data-testid="button-test-measure-sound"
                >
                  Test Sound
                </button>
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-gray-700 my-4"></div>
            
            {/* Volume Control */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Volume
                <span className="text-gray-500 text-xs ml-2">
                  {Math.round(soundManager.getConfig().volume * 100)}%
                </span>
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={soundManager.getConfig().volume}
                onChange={(e) => soundManager.setVolume(parseFloat(e.target.value))}
                className="w-full"
              />
            </div>

            {/* Test All Sounds Button */}
            <div className="mt-4 p-4 bg-gray-900 rounded-lg">
              <h4 className="text-sm font-medium text-blue-400 mb-2">Sound System Test</h4>
              <p className="text-sm text-gray-400 mb-3">Test all configured sounds in sequence</p>
              <button
                onClick={async () => {
                  await soundManager.initialize();
                  setSoundSystemReady(true);
                  await soundManager.testAllSounds();
                }}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-sm font-medium"
                data-testid="button-test-all-sounds"
              >
                Test All Sounds
              </button>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-medium mb-4">Height Thresholds</h3>
          <div className="mb-6 space-y-4">
            <div className="p-4 bg-gray-900 rounded-lg">
              <h4 className="text-sm font-medium text-blue-400 mb-2">Height Filtering Rules</h4>
              <ul className="space-y-2 text-sm text-gray-300">
                <li>• Minimum Height: All measurements below this height will be ignored</li>
                <li>• Maximum Height: All measurements above this height will be ignored</li>
                <li>• These filters help reduce noise and focus on relevant measurements</li>
              </ul>
            </div>
            <div className="p-4 bg-gray-900 rounded-lg">
              <h4 className="text-sm font-medium text-blue-400 mb-2">Alert Threshold Guidelines</h4>
              <ul className="space-y-2 text-sm text-gray-300">
                <li>• Critical threshold should be at least 0.1m higher than your load height</li>
                <li>• Warning threshold should be at least 0.2m higher than your load height</li>
                <li>• Warning alerts help you anticipate potential issues</li>
                <li>• Critical alerts indicate when to proceed with extra caution</li>
              </ul>
            </div>
          </div>
          <div className="grid gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Minimum Height ({unitLabel})</label>
              <input
                type="number"
                value={getDisplayValue(thresholds.minHeight).toFixed(1)}
                onChange={(e) => {
                  const displayValue = Number(e.target.value);
                  const metersValue = getStorageValue(displayValue);
                  setAlertSettings({
                    ...settings,
                    thresholds: {
                      ...thresholds,
                      minHeight: metersValue
                    }
                  });
                }}
                className={commonInputClasses}
                min="0"
                step={displayUnits === 'imperial' ? '1' : '0.1'}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Maximum Height ({unitLabel})</label>
              <input
                type="number"
                value={getDisplayValue(thresholds.maxHeight).toFixed(1)}
                onChange={(e) => {
                  const displayValue = Number(e.target.value);
                  const metersValue = getStorageValue(displayValue);
                  setAlertSettings({
                    ...settings,
                    thresholds: {
                      ...thresholds,
                      maxHeight: metersValue
                    }
                  });
                }}
                className={commonInputClasses}
                min={getDisplayValue(thresholds.minHeight)}
                step={displayUnits === 'imperial' ? '1' : '0.1'}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Warning Threshold ({unitLabel})</label>
              <input
                type="number"
                value={getDisplayValue(thresholds.warningThreshold || 0).toFixed(1)}
                onChange={(e) => {
                  const displayValue = Number(e.target.value);
                  const metersValue = getStorageValue(displayValue);
                  setAlertSettings({
                    ...settings,
                    thresholds: {
                      ...thresholds,
                      warningThreshold: metersValue
                    }
                  });
                }}
                className={commonInputClasses}
                min={getDisplayValue(thresholds.minHeight)}
                max={getDisplayValue(thresholds.maxHeight || 30)}
                step={displayUnits === 'imperial' ? '1' : '0.1'}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Critical Threshold ({unitLabel})</label>
              <input
                type="number"
                value={getDisplayValue(thresholds.criticalThreshold || 0).toFixed(1)}
                onChange={(e) => {
                  const displayValue = Number(e.target.value);
                  const metersValue = getStorageValue(displayValue);
                  setAlertSettings({
                    ...settings,
                    thresholds: {
                      ...thresholds,
                      criticalThreshold: metersValue
                    }
                  });
                }}
                className={commonInputClasses}
                min={getDisplayValue(thresholds.minHeight)}
                max={getDisplayValue(thresholds.maxHeight || 30)}
                step={displayUnits === 'imperial' ? '1' : '0.1'}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AlertSettings;