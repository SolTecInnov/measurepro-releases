import { QRCodeCanvas } from 'qrcode.react';
import { Smartphone, RefreshCw, Copy, CheckCircle, Link as LinkIcon } from 'lucide-react';
import { toast } from 'sonner';
import { useState } from 'react';
import { useSlavePairingStore } from '@/lib/stores/slavePairingStore';

interface SlaveAppPairingDisplayProps {
  className?: string;
}

export function SlaveAppPairingDisplay({ className }: SlaveAppPairingDisplayProps) {
  const { pairingCode, isServerConnected, isSlaveConnected, refreshCode } = useSlavePairingStore();
  const [copied, setCopied] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const getPairingUrl = () => {
    if (!pairingCode) return '';
    // Always use production URL — window.location.origin returns file:// in Electron
    const base = import.meta.env.VITE_API_URL || 'https://measure-pro.app';
    return `${base}/slave-app?code=${pairingCode}`;
  };

  const copyCode = () => {
    if (!pairingCode) return;
    navigator.clipboard.writeText(pairingCode);
    setCopied(true);
    // toast suppressed
    setTimeout(() => setCopied(false), 2000);
  };

  const copyLink = () => {
    const url = getPairingUrl();
    if (!url) return;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    // toast suppressed
    setTimeout(() => setCopiedLink(false), 2000);
  };

  if (!isServerConnected || !pairingCode) {
    return (
      <div className={`flex flex-col items-center justify-center p-8 bg-gray-800 rounded-lg ${className}`}>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4" />
        <p className="text-gray-400">Generating pairing code…</p>
      </div>
    );
  }

  return (
    <div className={`bg-gray-800 rounded-lg p-6 ${className}`} data-testid="pairing-display">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Smartphone className="w-6 h-6 text-blue-500" />
          <h3 className="text-xl font-semibold text-white">Field App Pairing</h3>
        </div>
        <button
          onClick={refreshCode}
          className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
          title="Refresh code"
          data-testid="button-refresh-code"
        >
          <RefreshCw className="w-5 h-5 text-gray-400" />
        </button>
      </div>

      {/* Connection status */}
      <div className="mb-6">
        <div className={`flex items-center gap-2 p-3 rounded-lg ${
          isSlaveConnected
            ? 'bg-green-900/30 border border-green-600'
            : 'bg-gray-700/50'
        }`}>
          <div className={`w-3 h-3 rounded-full ${
            isSlaveConnected ? 'bg-green-500 animate-pulse' : 'bg-gray-500'
          }`} />
          <span className={`text-sm ${isSlaveConnected ? 'text-green-400' : 'text-gray-400'}`}>
            {isSlaveConnected ? 'Mobile device connected' : 'Waiting for mobile device…'}
          </span>
        </div>
      </div>

      {/* QR Code */}
      <div className="bg-white p-4 rounded-lg mb-6 flex justify-center">
        <QRCodeCanvas value={getPairingUrl()} size={200} level="H" data-testid="qr-code" />
      </div>

      {/* Numerical code */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-400 mb-2">
          Or enter this code on your mobile device:
        </label>
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-gray-700 rounded-lg p-4 font-mono text-3xl text-center text-white tracking-widest">
            {pairingCode}
          </div>
          <button
            onClick={copyCode}
            className="p-4 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            title="Copy code"
            data-testid="button-copy-code"
          >
            {copied ? <CheckCircle className="w-6 h-6 text-white" /> : <Copy className="w-6 h-6 text-white" />}
          </button>
        </div>
      </div>

      {/* Copy link */}
      <div className="mb-4">
        <button
          onClick={copyLink}
          className="w-full flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-600 rounded-lg px-4 py-3 transition-colors"
          data-testid="button-copy-link"
        >
          {copiedLink
            ? <CheckCircle className="w-4 h-4 text-green-400" />
            : <LinkIcon className="w-4 h-4 text-gray-300" />}
          <span className="text-sm text-gray-300 font-mono truncate">
            {copiedLink ? 'Copied!' : getPairingUrl()}
          </span>
        </button>
      </div>

      {/* Instructions */}
      <div className="bg-gray-700/50 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-white mb-2">Instructions:</h4>
        <ol className="text-sm text-gray-400 space-y-1 list-decimal list-inside">
          <li>Open the Field App on your mobile device</li>
          <li>Scan the QR code or enter the 6-digit code</li>
          <li>Captures sync automatically to the active survey</li>
        </ol>
      </div>

      <div className="mt-4 text-xs text-gray-500 text-center">
        This code expires in 10 minutes — connection persists even if you close this panel
      </div>
    </div>
  );
}
