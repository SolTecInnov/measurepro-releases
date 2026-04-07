/**
 * SlaveAppWithPairing — Firestore-based pairing (no WebSocket server needed)
 */
import { useState, useEffect, useRef } from 'react';
import { SlaveAppCodeEntry } from './SlaveAppCodeEntry';
import SlaveApp from '../SlaveApp';
import { toast } from 'sonner';
import {
  getFirestore, initializeFirestore, memoryLocalCache,
  doc, onSnapshot, setDoc, serverTimestamp, collection,
  addDoc, type Unsubscribe,
} from 'firebase/firestore';
import { getApp } from 'firebase/app';

const SESSION_KEY_STANDALONE = 'field_standalone_state';
const SESSION_KEY_CODE       = 'field_last_pairing_code';

function getDb() {
  try { return initializeFirestore(getApp(), { localCache: memoryLocalCache() }); }
  catch { return getFirestore(getApp()); }
}

interface PairedState {
  code: string;
  surveyData: any | null;
}

interface StandaloneState {
  surveyName: string;
  surveyorName: string;
}

export function SlaveAppWithPairing() {
  const [paired, setPaired]       = useState<PairedState | null>(null);
  const [standalone, setStandalone] = useState<StandaloneState | null>(null);
  const [isDisconnected, setIsDisconnected] = useState(false);
  const ackCallbackRef = useRef<((id: string, failed: boolean) => void) | null>(null);
  const unsubRef = useRef<Unsubscribe[]>([]);

  const cleanup = () => {
    unsubRef.current.forEach(u => u());
    unsubRef.current = [];
  };

  // Auto-resume standalone on mount
  useEffect(() => {
    const saved = sessionStorage.getItem(SESSION_KEY_STANDALONE);
    if (saved) {
      try {
        const { surveyName, surveyorName } = JSON.parse(saved);
        if (surveyName && surveyorName) handleStandalone(surveyName, surveyorName, true);
      } catch {}
    }
    return cleanup;
  }, []);

  // ── Paired via Firestore ─────────────────────────────────────────────────

  const handlePaired = (code: string, initUnsub: Unsubscribe) => {
    cleanup();
    setPaired({ code, surveyData: null });
    setStandalone(null);
    setIsDisconnected(false);
    sessionStorage.setItem(SESSION_KEY_CODE, code);
    sessionStorage.removeItem(SESSION_KEY_STANDALONE);

    const db = getDb();

    // Listen for survey data + master disconnect
    const sessionUnsub = onSnapshot(doc(db, 'pairing', code), snap => {
      if (!snap.exists()) { setIsDisconnected(true); return; }
      const data = snap.data();
      if (!data.masterOnline) { setIsDisconnected(true); toast.error('Tablet disconnected'); }
      if (data.surveyData) {
        setPaired(prev => prev ? { ...prev, surveyData: data.surveyData } : null);
        localStorage.setItem('mainApp_activeSurvey', JSON.stringify(data.surveyData));
      }
    });

    // Listen for messages from master → slave (toSlave subcollection)
    let lastMsgId: string | null = null;
    const msgUnsub = onSnapshot(collection(db, 'pairing', code, 'toSlave'), snap => {
      snap.forEach(msgDoc => {
        if (msgDoc.id === lastMsgId) return;
        lastMsgId = msgDoc.id;
        const msg = msgDoc.data();
        if (msg.type === 'survey_data' && msg.data) {
          setPaired(prev => prev ? { ...prev, surveyData: msg.data } : null);
          localStorage.setItem('mainApp_activeSurvey', JSON.stringify(msg.data));
          // toast suppressed
        }
        if (msg.type === 'slave_measurement_ack') {
          ackCallbackRef.current?.(msg.id, !!msg.failed);
        }
      });
    });

    // Heartbeat to keep slave presence
    const hb = setInterval(() => {
      setDoc(doc(db, 'pairing', code), { slaveLastSeen: serverTimestamp() }, { merge: true }).catch(() => {});
    }, 15000);

    unsubRef.current = [
      initUnsub,
      sessionUnsub,
      msgUnsub,
      () => clearInterval(hb),
    ];
  };

  // Send measurement from slave to master via Firestore
  const sendMeasurement = async (measurement: any) => {
    if (!paired?.code) return;
    const db = getDb();
    await addDoc(collection(db, 'pairing', paired.code, 'toMaster'), {
      type: 'slave_measurement',
      measurement,
      ts: serverTimestamp(),
    });
  };

  // ── Standalone ───────────────────────────────────────────────────────────

  const handleStandalone = (surveyName: string, surveyorName: string, resuming = false) => {
    setStandalone({ surveyName, surveyorName });
    setPaired(null); setIsDisconnected(false);
    sessionStorage.setItem(SESSION_KEY_STANDALONE, JSON.stringify({ surveyName, surveyorName }));
    sessionStorage.removeItem(SESSION_KEY_CODE);
    const localSurvey = { id: `standalone-${Date.now()}`, name: surveyName, surveyor: surveyorName, surveyTitle: surveyName, surveyorName };
    localStorage.setItem('mainApp_activeSurvey', JSON.stringify(localSurvey));
    // if-toast suppressed
  };

  // ── Disconnect ───────────────────────────────────────────────────────────

  const handleDisconnect = async () => {
    if (paired?.code) {
      const db = getDb();
      await setDoc(doc(db, 'pairing', paired.code), { slaveOnline: false }, { merge: true }).catch(() => {});
    }
    cleanup();
    sessionStorage.removeItem(SESSION_KEY_STANDALONE);
    sessionStorage.removeItem(SESSION_KEY_CODE);
    // if-toast suppressed
    // if-toast suppressed
    setPaired(null); setStandalone(null); setIsDisconnected(false);
    localStorage.removeItem('mainApp_activeSurvey');
  };

  // ── Disconnect screen ────────────────────────────────────────────────────

  if (paired && isDisconnected) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
        <div className="bg-gray-900 rounded-2xl p-8 max-w-sm w-full shadow-2xl border border-gray-700 text-center">
          <div className="w-16 h-16 bg-orange-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728M5.636 5.636a9 9 0 000 12.728M8.464 8.464a5 5 0 000 7.072M15.536 8.464a5 5 0 010 7.072" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Connection Lost</h2>
          <p className="text-gray-400 text-sm mb-4">Your captures are saved. Reconnect to sync.</p>
          <div className="space-y-2">
            <button onClick={handleDisconnect}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition-colors">
              Reconnect to Tablet
            </button>
            <button onClick={() => {
              setIsDisconnected(false); setPaired(null);
              const raw = localStorage.getItem('mainApp_activeSurvey');
              const survey = raw ? JSON.parse(raw) : null;
              sessionStorage.setItem(SESSION_KEY_STANDALONE, JSON.stringify({ surveyName: survey?.name || 'Field Survey', surveyorName: survey?.surveyor || 'Field Crew' }));
              setStandalone({ surveyName: survey?.name || 'Field Survey', surveyorName: survey?.surveyor || 'Field Crew' });
            }}
              className="w-full bg-gray-700 hover:bg-gray-600 text-white font-semibold py-3 rounded-xl transition-colors text-sm">
              Continue Offline
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Entry screen ─────────────────────────────────────────────────────────
  if (!paired && !standalone) {
    return <SlaveAppCodeEntry onPaired={handlePaired} onStandalone={handleStandalone} />;
  }

  // ── Main slave app ───────────────────────────────────────────────────────
  return (
    <SlaveApp
      wsConnection={null}  // No WebSocket — Firestore handles messaging
      onDisconnect={handleDisconnect}
      onRegisterAckCallback={cb => { ackCallbackRef.current = cb; }}
      onSendMeasurement={sendMeasurement}
    />
  );
}
