/**
 * SlaveAppCodeEntry — Mobile field app pairing screen
 * Uses Firestore relay (no custom WebSocket server needed)
 */
import { useState, useEffect, useRef } from 'react';
import { Smartphone, QrCode, Hash, Loader2, WifiOff, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import {
  getFirestore, initializeFirestore, memoryLocalCache,
  doc, onSnapshot, setDoc, serverTimestamp,
  collection, addDoc, getDoc,
} from 'firebase/firestore';
import { getApp } from 'firebase/app';

const RELOAD_GUARD_KEY   = 'field_reload_guard';
const SESSION_KEY_CODE   = 'field_last_pairing_code';

function hardReload() {
  sessionStorage.setItem(RELOAD_GUARD_KEY, '1');
  const doReload = () => window.location.reload();
  if (!('serviceWorker' in navigator)) { doReload(); return; }
  Promise.all([
    navigator.serviceWorker.getRegistrations().then(r => Promise.all(r.map(x => x.unregister()))),
    'caches' in window ? caches.keys().then(ks => Promise.all(ks.map(k => caches.delete(k)))) : Promise.resolve(),
  ]).then(doReload).catch(doReload);
}

function getDb() {
  try { return initializeFirestore(getApp(), { localCache: memoryLocalCache() }); }
  catch { return getFirestore(getApp()); }
}

interface SlaveAppCodeEntryProps {
  onPaired: (code: string, unsubFn: () => void) => void;
  onStandalone: (surveyName: string, surveyorName: string) => void;
}

export function SlaveAppCodeEntry({ onPaired, onStandalone }: SlaveAppCodeEntryProps) {
  const savedCode = sessionStorage.getItem(SESSION_KEY_CODE) ?? '';
  const [code, setCode]                 = useState(savedCode);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [showStandalone, setShowStandalone] = useState(false);
  const [standaloneSurvey, setStandaloneSurvey]   = useState('');
  const [standaloneSurveyor, setStandaloneSurveyor] = useState('');
  const [updateReady, setUpdateReady]   = useState(false);
  const swChecked = useRef(false);

  useEffect(() => {
    // Check URL params for auto-connect
    const params = new URLSearchParams(window.location.search);
    const urlCode = params.get('code');
    if (urlCode && /^\d{6}$/.test(urlCode)) { setCode(urlCode); handleConnect(urlCode); }

    // Restore saved names
    const saved = localStorage.getItem('slaveApp_standalone_info');
    if (saved) {
      try { const { survey, surveyor } = JSON.parse(saved); if (survey) setStandaloneSurvey(survey); if (surveyor) setStandaloneSurveyor(surveyor); } catch {}
    }

    // SW update detection
    if (!swChecked.current && 'serviceWorker' in navigator) {
      swChecked.current = true;
      navigator.serviceWorker.getRegistration().then(reg => {
        if (!reg) return;
        if (reg.waiting) { reg.waiting.postMessage({ type: 'SKIP_WAITING' }); setTimeout(hardReload, 300); return; }
        reg.addEventListener('updatefound', () => {
          const sw = reg.installing;
          if (!sw) return;
          sw.addEventListener('statechange', () => {
            if (sw.state === 'installed' && navigator.serviceWorker.controller) setUpdateReady(true);
          });
        });
        reg.update().catch(() => {});
      });
      navigator.serviceWorker.addEventListener('controllerchange', hardReload);
    }
  }, []);

  const handleConnect = async (codeToUse?: string) => {
    const pairingCode = (codeToUse ?? code).trim();
    if (!/^\d{6}$/.test(pairingCode)) { setError('Please enter a valid 6-digit code'); return; }
    setIsConnecting(true); setError(null);

    try {
      const db = getDb();
      const sessionRef = doc(db, 'pairing', pairingCode);
      const snap = await getDoc(sessionRef);

      if (!snap.exists()) {
        setError('Code not found or expired. Ask the tablet for a new code.');
        setIsConnecting(false); return;
      }

      const data = snap.data();
      if (data.expiresAt && data.expiresAt < Date.now()) {
        setError('Code expired. Ask the tablet for a new code.');
        setIsConnecting(false); return;
      }

      // Mark slave as online
      await setDoc(sessionRef, { slaveOnline: true, slaveJoinedAt: serverTimestamp() }, { merge: true });

      // Get initial survey data
      if (data.surveyData) {
        localStorage.setItem('mainApp_activeSurvey', JSON.stringify(data.surveyData));
      }

      sessionStorage.setItem(SESSION_KEY_CODE, pairingCode);
      // toast suppressed

      // Subscribe to toSlave messages
      const unsubMessages = onSnapshot(
        collection(db, 'pairing', pairingCode, 'toSlave'),
        () => {} // handled in SlaveAppWithPairing
      );

      onPaired(pairingCode, unsubMessages);
    } catch (e: any) {
      setError('Connection failed: ' + (e.message ?? 'Unknown error'));
      setIsConnecting(false);
    }
  };

  const handleStartStandalone = () => {
    const survey   = standaloneSurvey.trim()   || 'Field Survey';
    const surveyor = standaloneSurveyor.trim() || 'Field Crew';
    localStorage.setItem('slaveApp_standalone_info', JSON.stringify({ survey, surveyor }));
    onStandalone(survey, surveyor);
  };

  const handleCodeChange = (v: string) => { setCode(v.replace(/\D/g,'').slice(0,6)); setError(null); };
  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); handleConnect(); };

  const offlineQueue = (() => { try { const r = localStorage.getItem('slaveApp_offlineQueue'); return r ? JSON.parse(r).length : 0; } catch { return 0; } })();
  const hasSavedCode = /^\d{6}$/.test(savedCode);

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center overflow-y-auto py-8 px-5">
      <div className="w-full max-w-sm space-y-4">

        {updateReady && (
          <button onClick={hardReload} className="w-full bg-green-700 hover:bg-green-600 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 animate-pulse">
            <RefreshCw className="w-4 h-4" /> Update Available — Tap to Reload
          </button>
        )}

        <div className="text-center mb-2">
          <div className="flex justify-center mb-3"><div className="bg-blue-600/20 p-4 rounded-2xl"><Smartphone className="w-10 h-10 text-blue-400" /></div></div>
          <h1 className="text-2xl font-bold text-white">MeasurePRO Field App</h1>
          <p className="text-gray-400 text-sm mt-1">Mobile capture for field surveys</p>
        </div>

        {offlineQueue > 0 && (
          <div className="bg-orange-900/40 border border-orange-700/50 rounded-xl p-3 flex items-center gap-3">
            <div className="bg-orange-500 text-white text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0">{offlineQueue}</div>
            <p className="text-sm text-orange-200">Offline capture{offlineQueue !== 1 ? 's' : ''} pending</p>
          </div>
        )}

        {hasSavedCode && (
          <div className="bg-blue-900/30 border border-blue-700/50 rounded-xl p-4 space-y-2">
            <p className="text-sm text-blue-200 font-medium">Last session: <span className="font-mono font-bold">{savedCode}</span></p>
            <button onClick={() => handleConnect(savedCode)} disabled={isConnecting}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-semibold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm">
              {isConnecting ? <><Loader2 className="w-4 h-4 animate-spin" /> Reconnecting…</> : <><RefreshCw className="w-4 h-4" /> Reconnect</>}
            </button>
          </div>
        )}

        <div className="bg-gray-900 border border-gray-700 rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" /> Connect to Tablet (Live Sync)
          </h2>
          <form onSubmit={handleSubmit} className="space-y-3">
            <input type="text" inputMode="numeric" pattern="[0-9]*" value={code} onChange={e => handleCodeChange(e.target.value)}
              placeholder="6-digit code" maxLength={6} autoFocus disabled={isConnecting}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-center text-2xl font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500" />
            {error && (
              <div className="bg-red-900/30 border border-red-700/50 rounded-lg p-3 text-red-300 text-sm space-y-2">
                <p>{error}</p>
                <button type="button" onClick={hardReload} className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-red-800/50 rounded-lg text-red-200 text-xs font-semibold">
                  <RefreshCw className="w-3.5 h-3.5" /> Reload App
                </button>
              </div>
            )}
            <button type="submit" disabled={code.length !== 6 || isConnecting}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2">
              {isConnecting ? <><Loader2 className="w-4 h-4 animate-spin" /> Connecting…</> : <><Hash className="w-4 h-4" /> Connect to Tablet</>}
            </button>
          </form>
          <div className="mt-3 pt-3 border-t border-gray-800 flex items-start gap-2">
            <QrCode className="w-4 h-4 text-gray-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-gray-500">Get the code from Settings → Field App on the tablet, or scan the QR code.</p>
          </div>
        </div>

        <div className="flex items-center gap-3"><div className="flex-1 h-px bg-gray-800" /><span className="text-xs text-gray-600">or work offline</span><div className="flex-1 h-px bg-gray-800" /></div>

        <div className="bg-gray-900 border border-gray-700 rounded-2xl overflow-hidden">
          <button className="w-full flex items-center justify-between p-5 text-left" onClick={() => setShowStandalone(p => !p)}>
            <div className="flex items-center gap-3">
              <div className="bg-orange-500/20 p-2 rounded-lg"><WifiOff className="w-5 h-5 text-orange-400" /></div>
              <div>
                <div className="font-semibold text-white text-sm">Standalone Mode</div>
                <div className="text-xs text-gray-400 mt-0.5">No tablet needed — captures saved offline</div>
              </div>
            </div>
            {showStandalone ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
          </button>
          {showStandalone && (
            <div className="px-5 pb-5 border-t border-gray-800 pt-4 space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-400 block mb-1">Project / Survey Name</label>
                <input type="text" value={standaloneSurvey} onChange={e => setStandaloneSurvey(e.target.value)}
                  placeholder="e.g. Wind Blade — Montréal Port"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-400 block mb-1">Your Name</label>
                <input type="text" value={standaloneSurveyor} onChange={e => setStandaloneSurveyor(e.target.value)}
                  placeholder="e.g. Jean-François"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
              </div>
              <button onClick={handleStartStandalone}
                className="w-full bg-orange-600 hover:bg-orange-500 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2">
                <WifiOff className="w-4 h-4" /> Start Offline Capture
              </button>
            </div>
          )}
        </div>

        <div className="text-center pt-2">
          <button onClick={hardReload} className="text-xs text-gray-600 hover:text-gray-400 flex items-center gap-1 mx-auto transition-colors">
            <RefreshCw className="w-3 h-3" /> Reload App
          </button>
        </div>
      </div>
    </div>
  );
}
