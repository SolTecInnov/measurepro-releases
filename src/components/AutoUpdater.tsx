/**
 * AutoUpdater — detects, downloads, and installs updates from GitHub Releases
 * Shows progress bar while downloading, offers "Install Now" or "Later"
 */
import React, { useEffect, useState } from 'react';
import { Download, RefreshCw, CheckCircle } from 'lucide-react';

interface UpdateInfo {
  version: string;
  releaseNotes?: string;
}

interface DownloadProgress {
  percent: number;
  bytesPerSecond: number;
  transferred: number;
  total: number;
}

export function AutoUpdater() {
  const api = (window as any).electronAPI;
  const [updateAvailable, setUpdateAvailable] = useState<UpdateInfo | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [downloaded, setDownloaded] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!api?.onUpdateAvailable) return;

    api.onUpdateAvailable((info: UpdateInfo) => {
      setUpdateAvailable(info);
      setDownloading(true); // auto-download is on
    });

    api.onDownloadProgress((p: DownloadProgress) => {
      setProgress(p);
    });

    api.onUpdateDownloaded((info: UpdateInfo) => {
      setDownloading(false);
      setDownloaded(true);
      setUpdateAvailable(info);
    });

    return () => api.removeUpdaterListeners?.();
  }, []);

  if (!updateAvailable || dismissed) return null;

  const fmt = (bytes: number) => bytes > 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${(bytes / 1024).toFixed(0)} KB`;

  return (
    <div style={{
      position: 'fixed', bottom: 16, right: 16, zIndex: 9999,
      background: '#0F1923', border: '1px solid #2a3a4a',
      borderRadius: 12, padding: '14px 16px', width: 320,
      boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
      fontFamily: 'DM Sans, sans-serif',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        {downloaded
          ? <CheckCircle size={16} color="#2ECC71" />
          : <RefreshCw size={16} color="#FF6B2B" style={{ animation: downloading ? 'spin 1s linear infinite' : 'none' }} />
        }
        <span style={{ color: '#E8ECF1', fontWeight: 700, fontSize: 14 }}>
          {downloaded ? 'Update ready' : `Update v${updateAvailable.version} available`}
        </span>
      </div>

      {downloading && progress && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ background: '#162130', borderRadius: 4, height: 6, overflow: 'hidden', marginBottom: 4 }}>
            <div style={{ background: '#FF6B2B', height: '100%', width: `${progress.percent}%`, transition: 'width 0.3s' }} />
          </div>
          <div style={{ color: '#8899AA', fontSize: 11, display: 'flex', justifyContent: 'space-between' }}>
            <span>Downloading… {progress.percent.toFixed(0)}%</span>
            <span>{fmt(progress.transferred)} / {fmt(progress.total)}</span>
          </div>
        </div>
      )}

      {downloading && !progress && (
        <div style={{ color: '#8899AA', fontSize: 12, marginBottom: 8 }}>Downloading update…</div>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        {downloaded && (
          <button
            onClick={() => api.updaterInstallNow?.()}
            style={{ flex: 1, background: '#FF6B2B', border: 'none', color: 'white', borderRadius: 8, padding: '8px 0', cursor: 'pointer', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <Download size={13} /> Install Now
          </button>
        )}
        <button
          onClick={() => setDismissed(true)}
          style={{ flex: downloaded ? 'none' : 1, background: 'none', border: '1px solid #2a3a4a', color: '#8899AA', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', fontSize: 12 }}>
          {downloaded ? 'Later' : 'Dismiss'}
        </button>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

/**
 * UpdateChecker — manual "Check for Updates" button for Settings page
 */
export function UpdateChecker() {
  const api = (window as any).electronAPI;
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [version, setVersion] = useState<string>('');

  useEffect(() => {
    api?.updaterGetVersion?.().then((v: string) => setVersion(v)).catch(() => {});
  }, []);

  const handleCheck = async () => {
    setChecking(true);
    setResult(null);
    try {
      const res = await api?.updaterCheck?.();
      if (res?.updateInfo?.version) {
        setResult(`v${res.updateInfo.version} available — downloading...`);
      } else {
        setResult('You are on the latest version');
      }
    } catch {
      setResult('Could not check for updates');
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
      <div>
        <p className="text-sm font-medium text-gray-200">Software Updates</p>
        <p className="text-xs text-gray-400">
          {version ? `Current: v${version}` : 'MeasurePRO'}
          {result && ` — ${result}`}
        </p>
      </div>
      <button
        onClick={handleCheck}
        disabled={checking}
        className="px-3 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg text-white flex items-center gap-1.5"
      >
        <RefreshCw size={12} className={checking ? 'animate-spin' : ''} />
        {checking ? 'Checking…' : 'Check for Updates'}
      </button>
    </div>
  );
}
