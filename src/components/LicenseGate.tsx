/**
 * LicenseGate — blocks access to the app until a valid license key is entered.
 * Replaces the web login flow with offline license verification.
 *
 * Flow:
 * 1. On mount, validates stored license via Electron IPC
 * 2. If valid → renders children (the app)
 * 3. If invalid/missing → shows activation screen
 * 4. User pastes key → validates → stores → unlocks
 * 5. "Send Machine ID" button emails the ID to admin for key generation
 */

import React, { useState, useEffect } from 'react';
import { Key, Mail, Copy, Check, AlertTriangle, Shield, Clock, ChevronDown, ChevronUp, X } from 'lucide-react';
import { useElectronLicenseStore } from '../lib/stores/electronLicenseStore';

interface LicenseGateProps {
  children: React.ReactNode;
}

interface LicenseStatus {
  valid: boolean;
  needsActivation?: boolean;
  reason?: string;
  expired?: boolean;
  isTrial?: boolean;
  inGrace?: boolean;
  trialExpired?: boolean;
  daysLeft?: number | null;
  payload?: {
    customer: string;
    email: string;
    expiresAt: string;
    type: string;
    addons: string[];
  };
}

const ADMIN_EMAIL = 'jfprince@soltec.ca';

// ── Trial Banner (expandable with machine ID, email, and activation) ──────
interface TrialBannerProps {
  daysLeft: number;
  inGrace: boolean;
  machineId: string;
  keyInput: string;
  setKeyInput: (v: string) => void;
  onActivate: () => void;
  activating: boolean;
  error: string;
  onCopyMachineId: () => void;
  copied: boolean;
  onSendMachineId: () => void;
  emailSent: boolean;
}

const TrialBanner: React.FC<TrialBannerProps> = ({
  daysLeft, inGrace, machineId, keyInput, setKeyInput,
  onActivate, activating, error, onCopyMachineId, copied,
  onSendMachineId, emailSent,
}) => {
  const [expanded, setExpanded] = useState(false);
  const isGrace = inGrace;
  const bannerColor = isGrace ? 'bg-red-600' : 'bg-amber-500';
  const textColor = isGrace ? 'text-white' : 'text-black';
  const panelBg = isGrace ? 'bg-red-950' : 'bg-amber-950';

  return (
    <div className={`fixed top-0 left-0 right-0 z-[9999] ${bannerColor} shadow-lg`}>
      {/* Main banner row */}
      <div className={`flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium ${textColor}`}>
        <span>
          {isGrace ? (
            <>Grace period: {daysLeft} day{daysLeft !== 1 ? 's' : ''} remaining</>
          ) : (
            <>Free trial: {daysLeft} day{daysLeft !== 1 ? 's' : ''} remaining</>
          )}
        </span>
        <span className="mx-1">—</span>
        <button
          onClick={() => setExpanded(!expanded)}
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-bold underline hover:no-underline ${textColor}`}
        >
          {expanded ? 'Hide' : 'Activate License'}
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Expandable activation panel */}
      {expanded && (
        <div className={`${panelBg} border-t border-white/10 px-4 py-4`}>
          <div className="max-w-lg mx-auto space-y-3">
            {/* Close button */}
            <div className="flex justify-end -mt-2 -mr-1">
              <button onClick={() => setExpanded(false)} className="text-white/50 hover:text-white/80">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Machine ID */}
            <div>
              <label className="text-xs text-white/60 uppercase tracking-wider block mb-1">Your Machine ID</label>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-black/30 rounded-lg px-3 py-2 text-xs text-orange-400 font-mono break-all select-all">
                  {machineId}
                </code>
                <button
                  onClick={onCopyMachineId}
                  className="p-2 bg-black/30 hover:bg-black/50 rounded-lg transition-colors shrink-0"
                  title="Copy Machine ID"
                >
                  {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4 text-white/60" />}
                </button>
              </div>
              <button
                onClick={onSendMachineId}
                className="w-full mt-2 flex items-center justify-center gap-2 px-3 py-1.5 bg-blue-600/30 hover:bg-blue-600/50 border border-blue-500/30 rounded-lg text-xs text-blue-300 transition-colors"
              >
                <Mail className="w-3.5 h-3.5" />
                {emailSent ? 'Email client opened!' : `Send Machine ID to ${ADMIN_EMAIL}`}
              </button>
            </div>

            {/* License key input */}
            <div>
              <label className="text-xs text-white/60 uppercase tracking-wider block mb-1">Paste License Key</label>
              <textarea
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                placeholder="Paste your license key here..."
                rows={3}
                className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-xs text-green-400 font-mono resize-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
              {error && (
                <div className="flex items-center gap-2 mt-1 text-xs text-red-400">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  {error}
                </div>
              )}
              <button
                onClick={onActivate}
                disabled={activating || !keyInput.trim()}
                className="w-full mt-2 flex items-center justify-center gap-2 px-3 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg text-sm font-bold transition-colors text-white"
              >
                <Key className="w-4 h-4" />
                {activating ? 'Activating...' : 'Activate License'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const LicenseGate: React.FC<LicenseGateProps> = ({ children }) => {
  const [status, setStatus] = useState<LicenseStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [machineId, setMachineId] = useState('');
  const [keyInput, setKeyInput] = useState('');
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  useEffect(() => {
    checkLicense();
  }, []);

  const checkLicense = async (retryCount = 0) => {
    setLoading(true);
    try {
      if (!window.electronAPI?.license) {
        // Not in Electron — skip license check (dev mode)
        setStatus({ valid: true });
        setLoading(false);
        return;
      }
      const [result, mid] = await Promise.all([
        window.electronAPI.license.validate(),
        window.electronAPI.license.getMachineId(),
      ]);
      console.log('[LicenseGate] Validation result:', result.valid, result.reason || 'OK', 'machineId:', mid?.slice(0, 9));

      // If IPC returned needsActivation but we haven't retried yet,
      // wait and retry — the main process IPC handlers may not be ready
      if (!result.valid && result.needsActivation && retryCount < 3) {
        console.log(`[LicenseGate] Retrying validation (${retryCount + 1}/3)...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        return checkLicense(retryCount + 1);
      }

      setStatus(result);
      setMachineId(mid);
      // Populate global store so the rest of the app can read license type/addons
      if (result.valid && result.payload) {
        useElectronLicenseStore.getState().setLicense(result.payload, result.daysLeft ?? null, result.isTrial ?? false, result.inGrace ?? false);
      }
    } catch (err) {
      console.error('[LicenseGate] Validation error:', err);
      // Retry on error — IPC might not be ready yet
      if (retryCount < 3) {
        console.log(`[LicenseGate] Retrying after error (${retryCount + 1}/3)...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        return checkLicense(retryCount + 1);
      }
      setStatus({ valid: true }); // Fail open after all retries
    }
    setLoading(false);
  };

  const handleActivate = async () => {
    if (!keyInput.trim()) {
      setError('Please paste your license key');
      return;
    }
    setActivating(true);
    setError('');
    try {
      const result = await window.electronAPI.license.activate(keyInput.trim());
      if (result.valid) {
        setStatus(result);
        if (result.payload) {
          useElectronLicenseStore.getState().setLicense(result.payload, result.daysLeft ?? null, result.isTrial ?? false, result.inGrace ?? false);
        }
      } else {
        setError(result.reason || 'Invalid license key');
      }
    } catch (err) {
      setError('Activation failed');
    }
    setActivating(false);
  };

  const handleCopyMachineId = () => {
    navigator.clipboard.writeText(machineId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendMachineId = async () => {
    const subject = encodeURIComponent('MeasurePRO License Request');
    const body = encodeURIComponent(
      `Machine ID: ${machineId}\n\nPlease generate a MeasurePRO license key for this computer.`
    );
    window.open(`mailto:${ADMIN_EMAIL}?subject=${subject}&body=${body}`);
    setEmailSent(true);
    setTimeout(() => setEmailSent(false), 3000);
  };

  // Loading
  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-950">
        <div className="text-gray-500 text-sm">Validating license...</div>
      </div>
    );
  }

  // Valid license — render the app (with trial banner if applicable)
  if (status?.valid) {
    if (status.isTrial) {
      return (
        <>
          <TrialBanner
            daysLeft={status.daysLeft ?? 0}
            inGrace={status.inGrace ?? false}
            machineId={machineId}
            keyInput={keyInput}
            setKeyInput={(v) => { setKeyInput(v); setError(''); }}
            onActivate={handleActivate}
            activating={activating}
            error={error}
            onCopyMachineId={handleCopyMachineId}
            copied={copied}
            onSendMachineId={handleSendMachineId}
            emailSent={emailSent}
          />
          <div className="pt-8">{children}</div>
        </>
      );
    }
    return <>{children}</>;
  }

  // License screen
  return (
    <div className="h-screen flex items-center justify-center bg-gray-950 p-4">
      <div className="max-w-md w-full">
        {/* Logo / Title */}
        <div className="text-center mb-8">
          <Shield className="w-12 h-12 text-orange-500 mx-auto mb-3" />
          <h1 className="text-2xl font-bold text-white">MeasurePRO</h1>
          <p className="text-gray-500 text-sm mt-1">License activation required</p>
        </div>

        {/* Trial expired warning */}
        {status?.trialExpired && (
          <div className="flex items-start gap-2 p-3 bg-amber-900/20 border border-amber-500/30 rounded-lg mb-4">
            <Clock className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
            <div className="text-sm text-amber-200">
              Your <strong>7-day free trial</strong> has expired.
              Contact your administrator for a license key to continue using MeasurePRO.
            </div>
          </div>
        )}

        {/* Expired warning */}
        {status?.expired && !status?.trialExpired && (
          <div className="flex items-start gap-2 p-3 bg-red-900/20 border border-red-500/30 rounded-lg mb-4">
            <Clock className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
            <div className="text-sm text-red-200">
              Your license expired on <strong>{status.payload?.expiresAt}</strong>.
              Contact your administrator for a renewal.
            </div>
          </div>
        )}

        {/* Machine ID */}
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 mb-4">
          <label className="text-xs text-gray-400 uppercase tracking-wider block mb-2">Your Machine ID</label>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-gray-800 rounded-lg px-3 py-2 text-xs text-orange-400 font-mono break-all select-all">
              {machineId}
            </code>
            <button
              onClick={handleCopyMachineId}
              className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors shrink-0"
              title="Copy Machine ID"
            >
              {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4 text-gray-400" />}
            </button>
          </div>
          <button
            onClick={handleSendMachineId}
            className="w-full mt-3 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 rounded-lg text-sm text-blue-300 transition-colors"
          >
            <Mail className="w-4 h-4" />
            {emailSent ? 'Email client opened!' : 'Send Machine ID to Administrator'}
          </button>
        </div>

        {/* License key input */}
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-4">
          <label className="text-xs text-gray-400 uppercase tracking-wider block mb-2">License Key</label>
          <textarea
            value={keyInput}
            onChange={(e) => { setKeyInput(e.target.value); setError(''); }}
            placeholder="Paste your license key here..."
            rows={4}
            className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-xs text-green-400 font-mono resize-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
          />

          {error && (
            <div className="flex items-center gap-2 mt-2 text-sm text-red-400">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <button
            onClick={handleActivate}
            disabled={activating || !keyInput.trim()}
            className="w-full mt-3 flex items-center justify-center gap-2 px-4 py-2.5 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg text-sm font-bold transition-colors"
          >
            <Key className="w-4 h-4" />
            {activating ? 'Activating...' : 'Activate License'}
          </button>
        </div>

        <p className="text-center text-xs text-gray-600 mt-4">
          Contact <a href={`mailto:${ADMIN_EMAIL}`} className="text-blue-500 hover:underline">{ADMIN_EMAIL}</a> for license support
        </p>
      </div>
    </div>
  );
};

export default LicenseGate;
