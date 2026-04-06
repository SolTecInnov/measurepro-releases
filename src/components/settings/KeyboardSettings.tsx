import React from 'react';
import { Download } from 'lucide-react';
import { useKeyboardStore, type KeyboardShortcut } from '../../lib/keyboard';
import streamDeckProfileUrl from '@assets/MeasurePRO_1765686421968.streamDeckProfile?url';

const KeyboardSettings: React.FC = () => {
  const { mapping } = useKeyboardStore();

  const formatShortcut = (shortcut: KeyboardShortcut) => {
    const parts = [];
    if (shortcut.ctrl) parts.push('Ctrl');
    if (shortcut.alt) parts.push('Alt');
    if (shortcut.shift) parts.push('Shift');
    if (shortcut.key) parts.push(shortcut.key.toUpperCase());
    return parts.join(' + ');
  };

  return (
    <div className="bg-gray-800 rounded-xl p-6">
      <h2 className="text-xl font-semibold mb-4">Keyboard Shortcuts</h2>
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-6">
          <div>
            <h3 className="text-lg font-medium mb-4">General Actions</h3>
            <div className="space-y-4">
              {Object.entries(mapping || {}).map(([action, shortcut]) => {
                if (action === 'poiTypes' || action === 'loggingControls' || action === 'aiDetection' || action === 'videoRecording' || action === 'envelopeMonitoring' || action === 'detectionControls') return null;
                return (
                  <div key={action} className="flex items-center justify-between">
                    <span>{shortcut.description}</span>
                    <span className="px-3 py-1.5 bg-gray-700 rounded-lg text-sm min-w-[120px] text-center">
                      {formatShortcut(shortcut)}
                    </span>
                  </div>
                );
              })}
            </div>

            <h3 className="text-lg font-medium mb-4 mt-6">Logging Controls</h3>
            <div className="space-y-4">
              {Object.entries(mapping?.loggingControls || {}).map(([action, shortcut]) => (
                <div key={action} className="flex items-center justify-between">
                  <span>{shortcut.description}</span>
                  <span className="px-3 py-1.5 bg-gray-700 rounded-lg text-sm min-w-[120px] text-center">
                    {formatShortcut(shortcut)}
                  </span>
                </div>
              ))}
            </div>

            <h3 className="text-lg font-medium mb-4 mt-6">Detection Controls</h3>
            <div className="space-y-4">
              {Object.entries(mapping?.detectionControls || {}).map(([action, shortcut]) => (
                <div key={action} className="flex items-center justify-between">
                  <span>{shortcut.description}</span>
                  <span className="px-3 py-1.5 bg-gray-700 rounded-lg text-sm min-w-[120px] text-center">
                    {formatShortcut(shortcut)}
                  </span>
                </div>
              ))}
            </div>

            <h3 className="text-lg font-medium mb-4 mt-6">Video Recording</h3>
            <div className="space-y-4">
              {Object.entries(mapping?.videoRecording || {}).map(([action, shortcut]) => (
                <div key={action} className="flex items-center justify-between">
                  <span>{shortcut.description}</span>
                  <span className="px-3 py-1.5 bg-gray-700 rounded-lg text-sm min-w-[120px] text-center">
                    {formatShortcut(shortcut)}
                  </span>
                </div>
              ))}
            </div>
          </div>
          
          <div>
            <h3 className="text-lg font-medium mb-4">AI Detection (MeasurePRO+)</h3>
            <div className="space-y-4">
              {Object.entries(mapping?.aiDetection || {}).map(([action, shortcut]) => (
                <div key={action} className="flex items-center justify-between">
                  <span>{shortcut.description}</span>
                  <span className="px-3 py-1.5 bg-purple-700 rounded-lg text-sm min-w-[120px] text-center">
                    {formatShortcut(shortcut)}
                  </span>
                </div>
              ))}
            </div>

            <h3 className="text-lg font-medium mb-4 mt-6">Envelope Clearance (Premium)</h3>
            <div className="space-y-4">
              {Object.entries(mapping?.envelopeMonitoring || {}).map(([action, shortcut]) => (
                <div key={action} className="flex items-center justify-between">
                  <span>{shortcut.description}</span>
                  <span className="px-3 py-1.5 bg-green-700 rounded-lg text-sm min-w-[120px] text-center">
                    {formatShortcut(shortcut)}
                  </span>
                </div>
              ))}
            </div>

            <h3 className="text-lg font-medium mb-4 mt-6">POI Types</h3>
            <div className="space-y-4">
              {Object.entries(mapping?.poiTypes || {}).map(([type, shortcut]) => (
                <div key={type} className="flex items-center justify-between">
                  <span>{shortcut.description}</span>
                  <span className="px-3 py-1.5 bg-gray-700 rounded-lg text-sm min-w-[120px] text-center">
                    {formatShortcut(shortcut)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 p-4 bg-gray-900 rounded-lg">
          <h4 className="text-sm font-medium text-gray-400 mb-2">Tips</h4>
          <ul className="space-y-2 text-sm text-gray-300">
            <li>• Keyboard shortcuts are pre-configured for optimal use</li>
            <li>• Shortcuts use Ctrl+Alt, Ctrl+Shift, and Alt+Shift combinations</li>
            <li>• These combinations minimize conflicts with browser and system shortcuts</li>
            <li>• Contact system administrator to request shortcut changes</li>
          </ul>
        </div>

        <div className="mt-6 p-4 bg-gradient-to-r from-purple-900/40 to-blue-900/40 border border-purple-700/50 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-lg font-medium text-white mb-1">Stream Deck Profile</h4>
              <p className="text-sm text-gray-300">
                Download the MeasurePRO profile for Elgato Stream Deck. Import it in the Stream Deck software for one-touch control of all MeasurePRO functions.
              </p>
            </div>
            <a
              href={streamDeckProfileUrl}
              download="MeasurePRO.streamDeckProfile"
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors font-medium whitespace-nowrap"
              data-testid="button-download-streamdeck-profile"
            >
              <Download className="w-4 h-4" />
              Download Profile
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default KeyboardSettings;