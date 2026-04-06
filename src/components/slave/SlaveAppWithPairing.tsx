import { useState, useEffect, useRef } from 'react';
import { SlaveAppCodeEntry } from './SlaveAppCodeEntry';
import SlaveApp from '../SlaveApp';
import { toast } from 'sonner';

const SESSION_KEY_STANDALONE = 'field_standalone_state';
const SESSION_KEY_PAIRING_CODE = 'field_last_pairing_code';

interface PairedState {
  ws: WebSocket;
  code: string;
  surveyData: any | null;
}

interface StandaloneState {
  surveyName: string;
  surveyorName: string;
}

export function SlaveAppWithPairing() {
  const [paired, setPaired] = useState<PairedState | null>(null);
  const [standalone, setStandalone] = useState<StandaloneState | null>(null);
  const [isDisconnected, setIsDisconnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const ackCallbackRef = useRef<((id: string, failed: boolean) => void) | null>(null);

  // On mount, check if we were in standalone mode and auto-resume
  useEffect(() => {
    const saved = sessionStorage.getItem(SESSION_KEY_STANDALONE);
    if (saved) {
      try {
        const { surveyName, surveyorName } = JSON.parse(saved);
        if (surveyName && surveyorName) {
          handleStandalone(surveyName, surveyorName, true);
        }
      } catch {}
    }
  }, []);

  const handlePaired = (ws: WebSocket, code: string) => {
    setPaired({ ws, code, surveyData: null });
    setStandalone(null);
    wsRef.current = ws;
    setIsDisconnected(false);

    // Persist the pairing code so it can be pre-filled on reload
    sessionStorage.setItem(SESSION_KEY_PAIRING_CODE, code);
    // Clear any standalone state since we're now in paired mode
    sessionStorage.removeItem(SESSION_KEY_STANDALONE);

    // Keep the connection alive through reverse-proxy idle timeouts
    const heartbeat = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 10_000);

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        switch (message.type) {
          case 'survey_data':
            setPaired(prev => prev ? { ...prev, surveyData: message.data } : null);
            localStorage.setItem('mainApp_activeSurvey', JSON.stringify(message.data));
            toast.success('Survey synchronized from master tablet');
            break;
          case 'master_disconnected':
            toast.error('Master device disconnected');
            clearInterval(heartbeat);
            setIsDisconnected(true);
            break;
          case 'slave_measurement_ack':
            if (ackCallbackRef.current) {
              ackCallbackRef.current(message.id, !!message.failed);
            }
            break;
        }
      } catch {}
    };

    ws.onclose = () => { clearInterval(heartbeat); setIsDisconnected(true); };
    ws.onerror = () => { clearInterval(heartbeat); setIsDisconnected(true); };
  };

  // resuming = true when auto-resuming from sessionStorage (skip toast)
  const handleStandalone = (surveyName: string, surveyorName: string, resuming = false) => {
    setStandalone({ surveyName, surveyorName });
    setPaired(null);
    setIsDisconnected(false);

    // Persist standalone state so it survives page reloads
    sessionStorage.setItem(SESSION_KEY_STANDALONE, JSON.stringify({ surveyName, surveyorName }));
    // Clear pairing code since we're in standalone
    sessionStorage.removeItem(SESSION_KEY_PAIRING_CODE);

    // Create a local survey context so SlaveApp shows the banner correctly
    const localSurvey = {
      id: `standalone-${Date.now()}`,
      name: surveyName,
      surveyor: surveyorName,
      surveyTitle: surveyName,
      surveyorName,
    };
    localStorage.setItem('mainApp_activeSurvey', JSON.stringify(localSurvey));
    if (!resuming) {
      toast.info('Standalone mode — captures saved offline');
    }
  };

  const handleDisconnect = () => {
    wsRef.current?.close();
    wsRef.current = null;

    // Clear persisted state so auto-resume doesn't kick in on next visit
    sessionStorage.removeItem(SESSION_KEY_STANDALONE);
    sessionStorage.removeItem(SESSION_KEY_PAIRING_CODE);

    if (paired) toast.info('Disconnected from master device');
    if (standalone) toast.info('Exited standalone mode');

    setPaired(null);
    setStandalone(null);
    setIsDisconnected(false);
    localStorage.removeItem('mainApp_activeSurvey');
  };

  useEffect(() => {
    return () => { wsRef.current?.close(); };
  }, []);

  // Disconnection screen (only for live pairing loss)
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
          <p className="text-gray-400 text-sm mb-4">
            Your captures are saved offline and will sync automatically when reconnected.
          </p>
          <div className="space-y-2">
            <button
              onClick={handleDisconnect}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition-colors"
            >
              Reconnect to Tablet
            </button>
            <button
              onClick={() => {
                setIsDisconnected(false);
                setPaired(null);
                // Keep in standalone mode with existing survey
                const raw = localStorage.getItem('mainApp_activeSurvey');
                const survey = raw ? JSON.parse(raw) : null;
                const surveyName = survey?.name || 'Field Survey';
                const surveyorName = survey?.surveyor || 'Field Crew';
                // Persist the transition to standalone
                sessionStorage.setItem(SESSION_KEY_STANDALONE, JSON.stringify({ surveyName, surveyorName }));
                sessionStorage.removeItem(SESSION_KEY_PAIRING_CODE);
                setStandalone({ surveyName, surveyorName });
              }}
              className="w-full bg-gray-700 hover:bg-gray-600 text-white font-semibold py-3 rounded-xl transition-colors text-sm"
            >
              Continue Offline
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Pairing / standalone entry screen
  if (!paired && !standalone) {
    return (
      <SlaveAppCodeEntry
        onPaired={handlePaired}
        onStandalone={handleStandalone}
      />
    );
  }

  // Main slave app (paired or standalone)
  return (
    <SlaveApp
      wsConnection={paired?.ws}
      onDisconnect={handleDisconnect}
      onRegisterAckCallback={(cb) => { ackCallbackRef.current = cb; }}
    />
  );
}
