import { useState, useEffect, useRef } from 'react';
import { Smartphone, QrCode, Hash, Loader2, WifiOff, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

const RELOAD_GUARD_KEY = 'field_reload_guard';
const SESSION_KEY_PAIRING_CODE = 'field_last_pairing_code';

interface SlaveAppCodeEntryProps {
  onPaired: (ws: WebSocket, code: string) => void;
  onStandalone: (surveyName: string, surveyorName: string) => void;
}

function hardReload() {
  // Set the guard BEFORE reloading so the next mount sees it and won't loop
  sessionStorage.setItem(RELOAD_GUARD_KEY, '1');
  // Unregister all service workers and wipe every cache, then reload.
  // This guarantees the phone always fetches fresh JS from the network.
  const doReload = () => window.location.reload();
  if (!('serviceWorker' in navigator)) { doReload(); return; }
  Promise.all([
    navigator.serviceWorker.getRegistrations().then(regs =>
      Promise.all(regs.map(r => r.unregister()))
    ),
    'caches' in window
      ? caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))))
      : Promise.resolve(),
  ]).then(doReload).catch(doReload);
}

export function SlaveAppCodeEntry({ onPaired, onStandalone }: SlaveAppCodeEntryProps) {
  const savedCode = sessionStorage.getItem(SESSION_KEY_PAIRING_CODE) ?? '';
  const [code, setCode] = useState(savedCode);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showStandalone, setShowStandalone] = useState(false);
  const [standaloneSurvey, setStandaloneSurvey] = useState('');
  const [standaloneSurveyor, setStandaloneSurveyor] = useState('');
  const [updateReady, setUpdateReady] = useState(false);
  const swChecked = useRef(false);

  // Check for code in URL params + service worker update detection
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlCode = params.get('code');
    if (urlCode && /^\d{6}$/.test(urlCode)) {
      setCode(urlCode);
      handleConnect(urlCode);
    }
    // Restore saved names
    const saved = localStorage.getItem('slaveApp_standalone_info');
    if (saved) {
      try {
        const { survey, surveyor } = JSON.parse(saved);
        if (survey) setStandaloneSurvey(survey);
        if (surveyor) setStandaloneSurveyor(surveyor);
      } catch {}
    }

    // ── Version check with reload guard ──────────────────────────────────────
    // Check a sessionStorage flag before hard-reloading to prevent loops.
    // If the guard is already set this session, skip the reload and just log.
    // Clear the guard only when versions match (clean mount).
    fetch('/api/version', { cache: 'no-store' })
      .then(r => r.json())
      .then((data: { version?: string }) => {
        const serverTime = parseInt(data.version ?? '0', 10);
        const clientTime = typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : 0;
        if (serverTime > 0 && clientTime > 0 && serverTime > clientTime) {
          if (sessionStorage.getItem(RELOAD_GUARD_KEY)) {
            // Already reloaded once this session — don't loop
            console.warn(`[FieldApp] Stale build still detected after reload (client=${clientTime} server=${serverTime}). Skipping reload to prevent loop.`);
          } else {
            console.log(`[FieldApp] Stale build detected (client=${clientTime} server=${serverTime}). Reloading...`);
            hardReload();
          }
        } else {
          // Versions match — clear the guard so a genuine future mismatch can reload
          sessionStorage.removeItem(RELOAD_GUARD_KEY);
        }
      })
      .catch(() => {});

    // ── SW update detection (secondary mechanism) ─────────────────────────────
    if (!swChecked.current && 'serviceWorker' in navigator) {
      swChecked.current = true;
      navigator.serviceWorker.getRegistration().then(reg => {
        if (!reg) return;
        if (reg.waiting) {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
          setTimeout(() => hardReload(), 300);
          return;
        }
        reg.addEventListener('updatefound', () => {
          const newSW = reg.installing;
          if (!newSW) return;
          newSW.addEventListener('statechange', () => {
            if (newSW.state === 'installed' && navigator.serviceWorker.controller) {
              setUpdateReady(true);
            }
          });
        });
        reg.update().catch(() => {});
      });
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        hardReload();
      });
    }
  }, []);

  const handleConnect = async (codeToUse?: string) => {
    const pairingCode = codeToUse || code;
    if (!/^\d{6}$/.test(pairingCode)) {
      setError('Please enter a valid 6-digit code');
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/api`;

      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'slave_pairing_join', code: pairingCode }));
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === 'pairing_join_result') {
            if (message.success) {
              toast.success('Connected to master device!');
              onPaired(ws, pairingCode);
            } else {
              setError('Invalid or expired code. Please try again.');
              setIsConnecting(false);
              ws.close();
            }
          }
        } catch {}
      };

      ws.onerror = () => {
        setError('Connection failed. Check your internet connection and try again.');
        setIsConnecting(false);
      };

      ws.onclose = () => {
        if (isConnecting) {
          setError('Connection closed. Please try again.');
          setIsConnecting(false);
        }
      };
    } catch {
      setError('Failed to connect. Please try again.');
      setIsConnecting(false);
    }
  };

  const handleStartStandalone = () => {
    const survey = standaloneSurvey.trim() || 'Field Survey';
    const surveyor = standaloneSurveyor.trim() || 'Field Crew';
    // Remember for next time
    localStorage.setItem('slaveApp_standalone_info', JSON.stringify({ survey, surveyor }));
    onStandalone(survey, surveyor);
  };

  const handleCodeChange = (value: string) => {
    const cleaned = value.replace(/\D/g, '').slice(0, 6);
    setCode(cleaned);
    setError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleConnect();
  };

  // Check if there are offline captures pending
  const offlineQueue = (() => {
    try {
      const raw = localStorage.getItem('slaveApp_offlineQueue');
      return raw ? JSON.parse(raw).length : 0;
    } catch { return 0; }
  })();

  const hasSavedCode = /^\d{6}$/.test(savedCode);

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center overflow-y-auto py-8 px-5">
      <div className="w-full max-w-sm space-y-4">

        {/* Update available banner */}
        {updateReady && (
          <button
            onClick={hardReload}
            className="w-full bg-green-700 hover:bg-green-600 active:bg-green-800 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 animate-pulse"
            data-testid="button-update-available"
          >
            <RefreshCw className="w-4 h-4" />
            Update Available — Tap to Reload
          </button>
        )}

        {/* Header */}
        <div className="text-center mb-2">
          <div className="flex justify-center mb-3">
            <div className="bg-blue-600/20 p-4 rounded-2xl">
              <Smartphone className="w-10 h-10 text-blue-400" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-white">MeasurePRO Field App</h1>
          <p className="text-gray-400 text-sm mt-1">Mobile capture for field surveys</p>
        </div>

        {/* Offline queue notice */}
        {offlineQueue > 0 && (
          <div className="bg-orange-900/40 border border-orange-700/50 rounded-xl p-3 flex items-center gap-3">
            <div className="bg-orange-500 text-white text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0">
              {offlineQueue}
            </div>
            <p className="text-sm text-orange-200">
              Offline capture{offlineQueue !== 1 ? 's' : ''} pending — connect to master to sync
            </p>
          </div>
        )}

        {/* Quick reconnect banner (shown when a saved pairing code exists) */}
        {hasSavedCode && (
          <div className="bg-blue-900/30 border border-blue-700/50 rounded-xl p-4 space-y-2">
            <p className="text-sm text-blue-200 font-medium">
              Last session used code <span className="font-mono font-bold">{savedCode}</span>
            </p>
            <button
              onClick={() => handleConnect(savedCode)}
              disabled={isConnecting}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-semibold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm"
              data-testid="button-reconnect"
            >
              {isConnecting ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Reconnecting…</>
              ) : (
                <><RefreshCw className="w-4 h-4" /> Reconnect</>
              )}
            </button>
          </div>
        )}

        {/* Live Connection Card */}
        <div className="bg-gray-900 border border-gray-700 rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            Connect to Tablet (Live Sync)
          </h2>
          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={code}
              onChange={(e) => handleCodeChange(e.target.value)}
              placeholder="6-digit code"
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-center text-2xl font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500"
              maxLength={6}
              autoFocus
              disabled={isConnecting}
              data-testid="input-pairing-code"
            />

            {error && (
              <div className="bg-red-900/30 border border-red-700/50 rounded-lg p-3 text-red-300 text-sm space-y-2">
                <p>{error}</p>
                <button
                  type="button"
                  onClick={hardReload}
                  className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-red-800/50 hover:bg-red-700/60 rounded-lg text-red-200 text-xs font-semibold transition-colors"
                  data-testid="button-reload-on-error"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Reload App (clears cached version)
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={code.length !== 6 || isConnecting}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
              data-testid="button-connect"
            >
              {isConnecting ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Connecting…</>
              ) : (
                <><Hash className="w-4 h-4" /> Connect to Tablet</>
              )}
            </button>
          </form>

          <div className="mt-3 pt-3 border-t border-gray-800">
            <div className="flex items-start gap-2">
              <QrCode className="w-4 h-4 text-gray-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-gray-500">
                Get the code from Settings → Field App on the tablet. Scanning the QR fills it automatically.
              </p>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-gray-800" />
          <span className="text-xs text-gray-600">or work offline</span>
          <div className="flex-1 h-px bg-gray-800" />
        </div>

        {/* Standalone Mode Card */}
        <div className="bg-gray-900 border border-gray-700 rounded-2xl overflow-hidden">
          <button
            className="w-full flex items-center justify-between p-5 text-left"
            onClick={() => setShowStandalone(p => !p)}
            data-testid="button-toggle-standalone"
          >
            <div className="flex items-center gap-3">
              <div className="bg-orange-500/20 p-2 rounded-lg">
                <WifiOff className="w-5 h-5 text-orange-400" />
              </div>
              <div>
                <div className="font-semibold text-white text-sm">Standalone Mode</div>
                <div className="text-xs text-gray-400 mt-0.5">No tablet needed — captures saved offline</div>
              </div>
            </div>
            {showStandalone
              ? <ChevronUp className="w-4 h-4 text-gray-500" />
              : <ChevronDown className="w-4 h-4 text-gray-500" />}
          </button>

          {showStandalone && (
            <div className="px-5 pb-5 border-t border-gray-800 pt-4 space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-400 block mb-1">Project / Survey Name</label>
                <input
                  type="text"
                  value={standaloneSurvey}
                  onChange={(e) => setStandaloneSurvey(e.target.value)}
                  placeholder="e.g. Wind Blade — Montréal Port"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  data-testid="input-standalone-survey"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-400 block mb-1">Your Name</label>
                <input
                  type="text"
                  value={standaloneSurveyor}
                  onChange={(e) => setStandaloneSurveyor(e.target.value)}
                  placeholder="e.g. Jean-François"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  data-testid="input-standalone-surveyor"
                />
              </div>

              <button
                onClick={handleStartStandalone}
                className="w-full bg-orange-600 hover:bg-orange-500 active:bg-orange-700 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
                data-testid="button-start-standalone"
              >
                <WifiOff className="w-4 h-4" />
                Start Offline Capture
              </button>

              <p className="text-xs text-gray-500 text-center">
                All captures are saved on your phone. Connect to the tablet later and they'll sync automatically.
              </p>
            </div>
          )}
        </div>

        {/* Reload link — always visible so users can clear cache manually */}
        <div className="text-center pt-2">
          <button
            onClick={hardReload}
            className="text-xs text-gray-600 hover:text-gray-400 flex items-center gap-1 mx-auto transition-colors"
            data-testid="button-reload-footer"
          >
            <RefreshCw className="w-3 h-3" />
            Reload App
          </button>
        </div>

      </div>
    </div>
  );
}
