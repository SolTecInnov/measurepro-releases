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
import { Key, Mail, Copy, Check, AlertTriangle, Shield, Clock } from 'lucide-react';

interface LicenseGateProps {
  children: React.ReactNode;
}

interface LicenseStatus {
  valid: boolean;
  needsActivation?: boolean;
  reason?: string;
  expired?: boolean;
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

  const checkLicense = async () => {
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
      setStatus(result);
      setMachineId(mid);
    } catch {
      setStatus({ valid: true }); // Fail open in dev
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

  // Valid license — render the app
  if (status?.valid) {
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

        {/* Expired warning */}
        {status?.expired && (
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
