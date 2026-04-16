/**
 * LicenseInfoModal — displays current license details and allows entering a new key.
 * Listens for 'open-license-info' event dispatched by AppHeader's License Info button.
 */
import React, { useState, useEffect } from 'react';
import { X, Key, Shield, Clock, Copy, Check, AlertTriangle, User, Mail } from 'lucide-react';
import { useElectronLicenseStore } from '../lib/stores/electronLicenseStore';

const LicenseInfoModal: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [showNewKey, setShowNewKey] = useState(false);
  const [keyInput, setKeyInput] = useState('');
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [machineId, setMachineId] = useState('');

  const payload = useElectronLicenseStore((s) => s.payload);
  const daysLeft = useElectronLicenseStore((s) => s.daysLeft);

  useEffect(() => {
    const handler = () => {
      setOpen(true);
      setShowNewKey(false);
      setKeyInput('');
      setError('');
      // Fetch machine ID
      if (window.electronAPI?.license) {
        window.electronAPI.license.getMachineId().then(setMachineId).catch(() => {});
      }
    };
    window.addEventListener('open-license-info', handler);
    return () => window.removeEventListener('open-license-info', handler);
  }, []);

  const handleActivateNewKey = async () => {
    if (!keyInput.trim()) {
      setError('Please paste your license key');
      return;
    }
    setActivating(true);
    setError('');
    try {
      const result = await window.electronAPI.license.activate(keyInput.trim());
      if (result.valid) {
        if (result.payload) {
          useElectronLicenseStore.getState().setLicense(result.payload, result.daysLeft ?? null);
        }
        setShowNewKey(false);
        setKeyInput('');
      } else {
        setError(result.reason || 'Invalid license key');
      }
    } catch {
      setError('Activation failed');
    }
    setActivating(false);
  };

  const handleCopyMachineId = () => {
    navigator.clipboard.writeText(machineId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!open) return null;

  const typeLabel = payload?.type
    ? payload.type.charAt(0).toUpperCase() + payload.type.slice(1)
    : 'Unknown';

  const expiryLabel = payload?.expiresAt === 'NEVER'
    ? 'Never (Permanent)'
    : payload?.expiresAt
      ? new Date(payload.expiresAt).toLocaleDateString()
      : 'Unknown';

  return (
    <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4" onClick={() => setOpen(false)}>
      <div className="bg-gray-900 border border-gray-700 rounded-2xl max-w-md w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-orange-500" />
            <h2 className="text-lg font-bold text-white">License Info</h2>
          </div>
          <button onClick={() => setOpen(false)} className="p-1 hover:bg-gray-800 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {payload ? (
            <>
              {/* License details */}
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <User className="w-4 h-4 text-gray-500 shrink-0" />
                  <div>
                    <div className="text-xs text-gray-500 uppercase">Customer</div>
                    <div className="text-sm text-white">{payload.customer}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Mail className="w-4 h-4 text-gray-500 shrink-0" />
                  <div>
                    <div className="text-xs text-gray-500 uppercase">Email</div>
                    <div className="text-sm text-white">{payload.email}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Key className="w-4 h-4 text-gray-500 shrink-0" />
                  <div>
                    <div className="text-xs text-gray-500 uppercase">License Type</div>
                    <div className="text-sm text-white">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                        payload.type === 'admin' || payload.type === 'enterprise' ? 'bg-purple-500/20 text-purple-300' :
                        payload.type === 'pro' ? 'bg-green-500/20 text-green-300' :
                        'bg-amber-500/20 text-amber-300'
                      }`}>
                        {typeLabel}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Clock className="w-4 h-4 text-gray-500 shrink-0" />
                  <div>
                    <div className="text-xs text-gray-500 uppercase">Expires</div>
                    <div className="text-sm text-white">
                      {expiryLabel}
                      {daysLeft !== null && daysLeft > 0 && (
                        <span className={`ml-2 text-xs ${daysLeft <= 30 ? 'text-amber-400' : 'text-gray-500'}`}>
                          ({daysLeft} days left)
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Addons */}
              {payload.addons && payload.addons.length > 0 && (
                <div className="bg-gray-800 rounded-lg p-3">
                  <div className="text-xs text-gray-500 uppercase mb-2">Add-ons</div>
                  <div className="flex flex-wrap gap-1.5">
                    {payload.addons.map((addon) => (
                      <span key={addon} className="px-2 py-0.5 bg-blue-500/20 text-blue-300 rounded text-xs">
                        {addon.replace(/_/g, ' ')}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Machine ID */}
              {machineId && (
                <div className="bg-gray-800 rounded-lg p-3">
                  <div className="text-xs text-gray-500 uppercase mb-1">Machine ID</div>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs text-orange-400 font-mono break-all select-all">{machineId}</code>
                    <button onClick={handleCopyMachineId} className="p-1 hover:bg-gray-700 rounded transition-colors shrink-0">
                      {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5 text-gray-400" />}
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center text-gray-500 py-4">
              <Shield className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No license information available</p>
            </div>
          )}

          {/* Enter New Key section */}
          {showNewKey ? (
            <div className="border-t border-gray-700 pt-4">
              <label className="text-xs text-gray-400 uppercase tracking-wider block mb-2">New License Key</label>
              <textarea
                value={keyInput}
                onChange={(e) => { setKeyInput(e.target.value); setError(''); }}
                placeholder="Paste your new license key here..."
                rows={3}
                className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-xs text-green-400 font-mono resize-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
              {error && (
                <div className="flex items-center gap-2 mt-2 text-sm text-red-400">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  {error}
                </div>
              )}
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => { setShowNewKey(false); setKeyInput(''); setError(''); }}
                  className="flex-1 px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-gray-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleActivateNewKey}
                  disabled={activating || !keyInput.trim()}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg text-sm font-bold transition-colors"
                >
                  <Key className="w-4 h-4" />
                  {activating ? 'Activating...' : 'Activate'}
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowNewKey(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded-lg text-sm text-gray-300 transition-colors"
            >
              <Key className="w-4 h-4" />
              Enter New License Key
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default LicenseInfoModal;
