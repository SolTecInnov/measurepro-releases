/**
 * HardwareAutoReconnectModal
 *
 * A single modal that renders one of several states based on the auto-reconnect check:
 * (a) "No devices found" — different tablet or no USB granted
 * (b) "Configuration changed" — same tablet but fingerprint mismatch
 * (c) "Keep Previous Settings" — editable Duro URL confirmation before reconnecting
 * (d) "Ground Reference Check" — mandatory GND REF verification after every reconnect
 */

import React, { useState } from 'react';
import { Wifi, WifiOff, RefreshCw, Settings2, AlertTriangle, CheckCircle2, Ruler } from 'lucide-react';
import { ReconnectPhase, AutoReconnectState } from '@/hooks/useHardwareAutoReconnect';
import { loadHardwareProfile, getDuroUrl } from '@/lib/hardwareProfileService';
import { useAuth } from '@/lib/auth/AuthContext';
import { useLaserStore } from '@/lib/laser';

interface Props {
  state: AutoReconnectState;
}

const HardwareAutoReconnectModal: React.FC<Props> = ({ state }) => {
  const { user } = useAuth();
  const { phase, dismiss, keepPrevious, startFresh, confirmKeepPrevious, confirmGndRef } = state;
  const { groundReferenceHeight, setGroundReferenceHeight } = useLaserStore();

  const [duroUrl, setDuroUrl] = useState<string>(() => {
    if (!user) return '';
    const profile = loadHardwareProfile(user.uid);
    return profile?.duroUrl || getDuroUrl() || '';
  });

  // Local GND REF input state — pre-filled with current value if > 0
  const [gndRefInput, setGndRefInput] = useState<string>(() =>
    groundReferenceHeight > 0 ? groundReferenceHeight.toFixed(3) : ''
  );
  const [gndRefMode, setGndRefMode] = useState<'confirm' | 'update'>('confirm');

  const parsedGndRef = parseFloat(gndRefInput);
  const gndRefValid = !isNaN(parsedGndRef) && parsedGndRef > 0;
  const hasExistingGndRef = groundReferenceHeight > 0;

  const handleGndRefConfirm = () => {
    if (gndRefMode === 'update' || !hasExistingGndRef) {
      if (!gndRefValid) return;
      setGroundReferenceHeight(parsedGndRef);
    }
    confirmGndRef();
  };

  const isVisible =
    phase === 'prompt-no-devices' ||
    phase === 'prompt-config-changed' ||
    phase === 'prompt-keep-previous' ||
    phase === 'reconnecting' ||
    phase === 'gnd-ref-check';

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 border border-gray-700 rounded-xl shadow-2xl max-w-md w-full p-6">

        {/* ── Reconnecting indicator ── */}
        {phase === 'reconnecting' && (
          <>
            <div className="flex items-center gap-3 mb-4">
              <RefreshCw className="w-6 h-6 text-blue-400 animate-spin" />
              <h2 className="text-lg font-semibold text-white">Reconnecting Hardware…</h2>
            </div>
            <p className="text-sm text-gray-400">
              Connecting to your saved laser, GPS, and Duro bridge. Please wait.
            </p>
          </>
        )}

        {/* ── No devices found ── */}
        {phase === 'prompt-no-devices' && (
          <>
            <div className="flex items-center gap-3 mb-4">
              <WifiOff className="w-6 h-6 text-red-400" />
              <h2 className="text-lg font-semibold text-white">No Devices Found</h2>
            </div>
            <p className="text-sm text-gray-300 mb-6">
              No previously connected devices were found on this device. Please set up your hardware manually.
            </p>
            <div className="flex justify-end">
              <button
                onClick={dismiss}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
                data-testid="btn-hwmodal-manual-setup"
              >
                Set Up Manually
              </button>
            </div>
          </>
        )}

        {/* ── Configuration changed ── */}
        {phase === 'prompt-config-changed' && (
          <>
            <div className="flex items-center gap-3 mb-4">
              <Settings2 className="w-6 h-6 text-amber-400" />
              <h2 className="text-lg font-semibold text-white">Hardware Setup Changed</h2>
            </div>
            <p className="text-sm text-gray-300 mb-6">
              Your hardware setup has changed since your last session. Would you like to use your previous settings
              or start fresh with manual setup?
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={startFresh}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors"
                data-testid="btn-hwmodal-start-fresh"
              >
                Start Fresh
              </button>
              <button
                onClick={keepPrevious}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
                data-testid="btn-hwmodal-keep-previous"
              >
                Keep Previous Settings
              </button>
            </div>
          </>
        )}

        {/* ── Keep previous settings — confirm + editable Duro URL ── */}
        {phase === 'prompt-keep-previous' && (
          <>
            <div className="flex items-center gap-3 mb-4">
              <Wifi className="w-6 h-6 text-blue-400" />
              <h2 className="text-lg font-semibold text-white">Confirm Previous Settings</h2>
            </div>
            <p className="text-sm text-gray-300 mb-4">
              Review and confirm your Duro bridge URL before reconnecting. Leave the field empty if you are not
              using the Duro bridge.
            </p>
            <div className="mb-6">
              <label className="block text-xs font-medium text-gray-400 mb-1">
                Duro Bridge URL (optional)
              </label>
              <input
                type="text"
                value={duroUrl}
                onChange={(e) => setDuroUrl(e.target.value)}
                placeholder="http://192.168.1.xxx:8765"
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                data-testid="input-hwmodal-duro-url"
              />
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={startFresh}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors"
                data-testid="btn-hwmodal-cancel-keep"
              >
                Cancel
              </button>
              <button
                onClick={() => confirmKeepPrevious(duroUrl)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
                data-testid="btn-hwmodal-confirm-reconnect"
              >
                Reconnect
              </button>
            </div>
          </>
        )}

        {/* ── Ground Reference Check ── */}
        {phase === 'gnd-ref-check' && (
          <>
            <div className="flex items-center gap-3 mb-4">
              <Ruler className="w-6 h-6 text-amber-400" />
              <h2 className="text-lg font-semibold text-white">Confirm Ground Reference</h2>
            </div>

            {/* GND REF is zero — mandatory entry */}
            {!hasExistingGndRef && (
              <>
                <div className="flex items-start gap-3 bg-red-900/30 border border-red-700/50 rounded-lg p-3 mb-4">
                  <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-red-300">Ground Reference Not Set</p>
                    <p className="text-xs text-red-400/80 mt-0.5">
                      Logging controls are locked until a valid ground reference is entered. This is the height of
                      the laser above ground level (vehicle roof height).
                    </p>
                  </div>
                </div>
                <div className="mb-5">
                  <label className="block text-xs font-medium text-gray-400 mb-1">
                    Ground Reference Height <span className="text-red-400">*</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0.001"
                      step="0.001"
                      value={gndRefInput}
                      onChange={(e) => setGndRefInput(e.target.value)}
                      placeholder="e.g. 4.200"
                      className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 text-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                      data-testid="input-hwmodal-gnd-ref"
                    />
                    <span className="text-sm text-gray-400 w-6">m</span>
                  </div>
                  {gndRefInput && !gndRefValid && (
                    <p className="text-xs text-red-400 mt-1">Value must be greater than 0</p>
                  )}
                  {gndRefValid && (
                    <p className="text-xs text-gray-400 mt-1">
                      ≈ {(parsedGndRef * 3.28084).toFixed(3)} ft
                    </p>
                  )}
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={handleGndRefConfirm}
                    disabled={!gndRefValid}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
                    data-testid="btn-hwmodal-gnd-ref-set"
                  >
                    Set GND REF &amp; Continue
                  </button>
                </div>
              </>
            )}

            {/* GND REF has a value — confirm or update */}
            {hasExistingGndRef && (
              <>
                <p className="text-sm text-gray-300 mb-4">
                  The laser ground reference from your last session is shown below. Confirm it is still accurate
                  for the current vehicle and road conditions before logging.
                </p>

                {/* Current value display */}
                <div className="bg-gray-700/50 border border-gray-600 rounded-lg p-3 mb-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">Current GND REF</span>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-400" />
                      <span className="text-base font-semibold text-green-300">
                        {groundReferenceHeight.toFixed(3)} m
                      </span>
                      <span className="text-xs text-gray-500">
                        ({(groundReferenceHeight * 3.28084).toFixed(3)} ft)
                      </span>
                    </div>
                  </div>
                </div>

                {/* Toggle: update mode */}
                {gndRefMode === 'confirm' && (
                  <>
                    <p className="text-xs text-gray-400 mb-5">
                      If the vehicle or mounting height has changed, update the value before continuing.
                    </p>
                    <div className="flex justify-end gap-3">
                      <button
                        onClick={() => setGndRefMode('update')}
                        className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors"
                        data-testid="btn-hwmodal-gnd-ref-update"
                      >
                        Update Value
                      </button>
                      <button
                        onClick={handleGndRefConfirm}
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors"
                        data-testid="btn-hwmodal-gnd-ref-confirm"
                      >
                        Still Valid — Continue
                      </button>
                    </div>
                  </>
                )}

                {gndRefMode === 'update' && (
                  <>
                    <div className="mb-4">
                      <label className="block text-xs font-medium text-gray-400 mb-1">
                        New Ground Reference Height
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0.001"
                          step="0.001"
                          value={gndRefInput}
                          onChange={(e) => setGndRefInput(e.target.value)}
                          placeholder={groundReferenceHeight.toFixed(3)}
                          className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 text-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                          data-testid="input-hwmodal-gnd-ref-update"
                        />
                        <span className="text-sm text-gray-400 w-6">m</span>
                      </div>
                      {gndRefInput && !gndRefValid && (
                        <p className="text-xs text-red-400 mt-1">Value must be greater than 0</p>
                      )}
                      {gndRefValid && (
                        <p className="text-xs text-gray-400 mt-1">
                          ≈ {(parsedGndRef * 3.28084).toFixed(3)} ft
                        </p>
                      )}
                    </div>
                    <div className="flex justify-end gap-3">
                      <button
                        onClick={() => { setGndRefMode('confirm'); setGndRefInput(groundReferenceHeight.toFixed(3)); }}
                        className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors"
                        data-testid="btn-hwmodal-gnd-ref-cancel-update"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleGndRefConfirm}
                        disabled={!gndRefValid}
                        className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
                        data-testid="btn-hwmodal-gnd-ref-save"
                      >
                        Save &amp; Continue
                      </button>
                    </div>
                  </>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default HardwareAutoReconnectModal;
