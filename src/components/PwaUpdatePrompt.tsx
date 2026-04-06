import { useState, useEffect, useRef } from 'react';
import { RefreshCw, ArrowUpCircle } from 'lucide-react';

const STORAGE_KEY = 'pwa_update_pending';
const AUTO_APPLY_DELAY_MS = 30 * 1000;

const PwaUpdatePrompt = () => {
  // Skip entirely in Electron — PWA updates don't apply
  if (window.electronAPI?.isElectron) return null;

  const [visible, setVisible] = useState(false);
  const [countdown, setCountdown] = useState(AUTO_APPLY_DELAY_MS / 1000);
  const autoApplyTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const applyUpdate = () => {
    localStorage.removeItem(STORAGE_KEY);
    setVisible(false);
    stopAutoApplyCountdown();
    const fn = (window as any).__pwa_update_fn;
    if (typeof fn === 'function') {
      fn(true);
    } else {
      window.location.reload();
    }
  };

  const stopAutoApplyCountdown = () => {
    if (autoApplyTimerRef.current) {
      clearInterval(autoApplyTimerRef.current);
      autoApplyTimerRef.current = null;
    }
  };

  const startAutoApplyCountdown = () => {
    stopAutoApplyCountdown();
    const initial = AUTO_APPLY_DELAY_MS / 1000;
    setCountdown(initial);
    let remaining = initial;
    autoApplyTimerRef.current = setInterval(() => {
      remaining -= 1;
      setCountdown(remaining);
      if (remaining <= 0) {
        applyUpdate();
      }
    }, 1000);
  };

  const show = () => {
    setVisible(true);
    startAutoApplyCountdown();
  };

  useEffect(() => {
    const handleUpdateReady = () => {
      localStorage.setItem(STORAGE_KEY, '1');
      show();
    };

    const handleVisibilityChange = () => {
      if (document.hidden && localStorage.getItem(STORAGE_KEY) === '1') {
        setTimeout(() => {
          applyUpdate();
        }, 800);
      }
    };

    window.addEventListener('pwa-update-ready', handleUpdateReady);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    if (localStorage.getItem(STORAGE_KEY) === '1') {
      show();
    }

    return () => {
      window.removeEventListener('pwa-update-ready', handleUpdateReady);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      stopAutoApplyCountdown();
    };
  }, []);

  const fmt = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return m > 0 ? `${m}:${String(s).padStart(2, '0')}` : `${s}s`;
  };

  if (!visible) return null;

  return (
    <div
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] flex items-start gap-3 px-5 py-4 rounded-2xl shadow-2xl border border-blue-500/50 bg-gray-900/98 backdrop-blur-md text-white max-w-sm w-[calc(100vw-2rem)]"
      data-testid="pwa-update-prompt"
      role="alertdialog"
      aria-modal="false"
      aria-label="App update available"
    >
      <ArrowUpCircle className="h-6 w-6 text-blue-400 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="font-bold text-sm leading-tight">Update available</p>
        <p className="text-gray-300 text-xs mt-0.5 leading-snug">
          A new version of MeasurePRO is ready. Updating automatically
          {countdown > 0 && (
            <span className="text-blue-300"> in <span className="font-semibold tabular-nums">{fmt(countdown)}</span></span>
          )}.
        </p>
        <div className="flex items-center gap-2 mt-3">
          <button
            onClick={applyUpdate}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-xs font-bold transition-colors"
            data-testid="button-pwa-update-now"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Update Now
          </button>
        </div>
      </div>
    </div>
  );
};

export default PwaUpdatePrompt;
