/**
 * MeasurePRO — Slave App Pairing Store v3 (Firestore-based relay)
 *
 * Architecture: Uses Firestore as the relay — no custom server needed.
 * Master creates a session document, slave joins by code.
 * Real-time bidirectional messaging via Firestore subcollections.
 * Works everywhere Firebase works — fully serverless, always online.
 *
 * /pairing/{code}/            — session doc
 * /pairing/{code}/toSlave/    — messages from master to slave
 * /pairing/{code}/toMaster/   — messages from slave to master
 */

import { create } from 'zustand';
import {
  getFirestore,
  doc, setDoc, getDoc, onSnapshot, deleteDoc,
  collection, addDoc, serverTimestamp, query, orderBy, limit,
  type Unsubscribe,
} from 'firebase/firestore';
import { initializeFirestore, memoryLocalCache } from 'firebase/firestore';
import { getApp } from 'firebase/app';

// ── Helpers ────────────────────────────────────────────────────────────────

function getDb() {
  try {
    const app = getApp();
    console.log('[SlavePairing] Firebase app found:', app.options.projectId);
    try { return initializeFirestore(app, { localCache: memoryLocalCache() }); }
    catch { return getFirestore(app); }
  } catch (e) {
    console.error('[SlavePairing] getDb FAILED:', e);
    return null;
  }
}

function randomCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// ── Store ──────────────────────────────────────────────────────────────────

interface SlavePairingState {
  pairingCode: string | null;
  isServerConnected: boolean;  // true = Firestore session doc created
  isSlaveConnected: boolean;
  _unsubSlave: Unsubscribe | null;
  _unsubMessages: Unsubscribe | null;

  connect: () => void;
  disconnect: () => void;
  sendSurveyUpdate: (survey: any) => void;
  refreshCode: () => void;
}

async function createSession(code: string, surveyData: any) {
  const db = getDb();
  if (!db) throw new Error('Firebase not ready');
  await setDoc(doc(db, 'pairing', code), {
    createdAt: serverTimestamp(),
    expiresAt: Date.now() + 10 * 60 * 1000,
    masterOnline: true,
    slaveOnline: false,
    surveyData: surveyData ?? null,
  });
}

async function sendToSlave(code: string, msg: object) {
  const db = getDb();
  if (!db) return;
  await addDoc(collection(db, 'pairing', code, 'toSlave'), {
    ...msg,
    ts: serverTimestamp(),
  });
}

async function cleanupSession(code: string) {
  try {
    const db = getDb();
    if (!db) return;
    await setDoc(doc(db, 'pairing', code), { masterOnline: false }, { merge: true });
  } catch {}
}

export const useSlavePairingStore = create<SlavePairingState>((set, get) => {

  let _unsubSlave: Unsubscribe | null = null;
  let _unsubMessages: Unsubscribe | null = null;

  async function setupSession(code: string) {
    console.log('[SlavePairing] setupSession called with code:', code);
    const db = getDb();
    if (!db) { console.error('[SlavePairing] DB is null — cannot create session'); return; }

    // Create session doc
    console.log('[SlavePairing] Creating Firestore session...');
    await createSession(code, null);
    console.log('[SlavePairing] Session created successfully');

    // Session is ready — show QR immediately (don't wait for snapshot listeners)
    set({ isServerConnected: true });

    // Watch for slave joining (slaveOnline: true)
    _unsubSlave = onSnapshot(doc(db, 'pairing', code), (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      if (data.slaveOnline && !get().isSlaveConnected) {
        set({ isSlaveConnected: true });
        window.dispatchEvent(new CustomEvent('slavePairing:slaveConnected'));
        // Push current survey to slave immediately
        const { sendSurveyUpdate } = get();
        // Re-send survey after slave connects
        import('../survey/store').then(({ useSurveyStore }) => {
          const survey = useSurveyStore.getState().activeSurvey;
          if (survey) sendSurveyUpdate(survey);
        });
      }
      if (!data.slaveOnline && get().isSlaveConnected) {
        set({ isSlaveConnected: false });
      }
    });

    // Watch for messages from slave → master
    const q = query(
      collection(db, 'pairing', code, 'toMaster'),
      orderBy('ts', 'desc'),
      limit(1)
    );
    let lastMsgId: string | null = null;
    _unsubMessages = onSnapshot(q, (snap) => {
      snap.forEach((msgDoc) => {
        if (msgDoc.id === lastMsgId) return;
        lastMsgId = msgDoc.id;
        const msg = msgDoc.data();
        // Dispatch to app
        window.dispatchEvent(new CustomEvent('slavePairing:message', { detail: msg }));
        // ACK back to slave
        if (msg.type === 'slave_measurement' || msg.type === 'slave_pairing_measurement') {
          const measurement = msg.measurement ?? msg.data;
          sendToSlave(code, {
            type: 'slave_measurement_ack',
            id: measurement?.id ?? msg.id,
            failed: false,
          });
          // Forward to master app
          window.dispatchEvent(new CustomEvent('slavePairing:measurement', { detail: measurement }));
        }
      });
    });
  }

  return {
    pairingCode: null,
    isServerConnected: false,
    isSlaveConnected: false,
    _unsubSlave: null,
    _unsubMessages: null,

    connect() {
      const code = randomCode();
      console.log('[SlavePairing] connect() — new code:', code);
      set({ pairingCode: code, isServerConnected: false, isSlaveConnected: false });
      setupSession(code).catch(err => console.error('[SlavePairing] setupSession FAILED:', err));
    },

    disconnect() {
      const { pairingCode } = get();
      if (_unsubSlave)   { _unsubSlave();   _unsubSlave = null;   }
      if (_unsubMessages){ _unsubMessages(); _unsubMessages = null; }
      if (pairingCode) cleanupSession(pairingCode);
      set({ pairingCode: null, isServerConnected: false, isSlaveConnected: false });
    },

    sendSurveyUpdate(survey: any) {
      const { pairingCode } = get();
      if (!pairingCode) return;
      const db = getDb();
      if (!db) return;
      setDoc(doc(db, 'pairing', pairingCode), { surveyData: survey }, { merge: true }).catch(console.error);
      sendToSlave(pairingCode, { type: 'survey_data', data: survey }).catch(console.error);
    },

    refreshCode() {
      get().disconnect();
      setTimeout(() => get().connect(), 300);
    },
  };
});

// Auto-connect after Firebase is ready (delay to let auth initialize)
setTimeout(() => {
  try {
    getApp();
    useSlavePairingStore.getState().connect();
  } catch {
    // Firebase not initialized yet — will connect when user opens QR dialog
  }
}, 5000);
