import { create } from 'zustand';
import { useSurveyStore } from '@/lib/survey';

// Module-level singletons — survive component mount/unmount
let _ws: WebSocket | null = null;
let _reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
let _heartbeatInterval: ReturnType<typeof setInterval> | null = null;
let _intentionalClose = false;

interface SlavePairingState {
  pairingCode: string | null;
  isServerConnected: boolean;
  isSlaveConnected: boolean;

  connect: () => void;
  disconnect: () => void;
  sendSurveyUpdate: (survey: any) => void;
  refreshCode: () => void;
}

function clearHeartbeat() {
  if (_heartbeatInterval) {
    clearInterval(_heartbeatInterval);
    _heartbeatInterval = null;
  }
}

function startHeartbeat() {
  clearHeartbeat();
  _heartbeatInterval = setInterval(() => {
    if (_ws && _ws.readyState === WebSocket.OPEN) {
      _ws.send(JSON.stringify({ type: 'ping' }));
    }
  }, 10_000);
}

export const useSlavePairingStore = create<SlavePairingState>((set) => {
  function connectWs() {
    if (_ws && (_ws.readyState === WebSocket.OPEN || _ws.readyState === WebSocket.CONNECTING)) return;
    _intentionalClose = false;

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${protocol}//${window.location.host}/api`);
      _ws = ws;

      ws.onopen = () => {
        set({ isServerConnected: true });
        ws.send(JSON.stringify({ type: 'slave_pairing_request_code' }));
        startHeartbeat();
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string);
          switch (msg.type) {
            case 'pairing_code': {
              set({ pairingCode: msg.code });
              // Push existing active survey immediately so slave gets it on connect
              const survey = useSurveyStore.getState().activeSurvey;
              if (survey && _ws?.readyState === WebSocket.OPEN) {
                _ws.send(JSON.stringify({ type: 'slave_pairing_update_survey', surveyData: survey }));
              }
              break;
            }
            case 'slave_connected': {
              set({ isSlaveConnected: true });
              // Push survey immediately when slave joins
              const survey = useSurveyStore.getState().activeSurvey;
              if (survey && _ws?.readyState === WebSocket.OPEN) {
                _ws.send(JSON.stringify({ type: 'slave_pairing_update_survey', surveyData: survey }));
              }
              window.dispatchEvent(new CustomEvent('slavePairing:slaveConnected'));
              break;
            }
            case 'slave_disconnected':
              set({ isSlaveConnected: false });
              window.dispatchEvent(new CustomEvent('slavePairing:slaveDisconnected'));
              break;
            case 'slave_measurement':
              window.dispatchEvent(new CustomEvent('slavePairing:measurement', { detail: msg.data }));
              break;
            case 'pong':
              break;
            default:
              break;
          }
        } catch (e) {
          console.error('[SlavePairing] Error parsing WS message:', e);
        }
      };

      ws.onerror = () => {
        console.error('[SlavePairing] WebSocket error');
      };

      ws.onclose = () => {
        clearHeartbeat();
        set({ isServerConnected: false, pairingCode: null, isSlaveConnected: false });
        _ws = null;

        if (!_intentionalClose) {
          if (_reconnectTimeout) clearTimeout(_reconnectTimeout);
          _reconnectTimeout = setTimeout(() => {
            console.log('[SlavePairing] Reconnecting…');
            connectWs();
          }, 5_000);
        }
      };
    } catch (e) {
      console.error('[SlavePairing] Failed to open WebSocket:', e);
    }
  }

  return {
    pairingCode: null,
    isServerConnected: false,
    isSlaveConnected: false,

    connect: connectWs,

    disconnect: () => {
      _intentionalClose = true;
      clearHeartbeat();
      if (_reconnectTimeout) { clearTimeout(_reconnectTimeout); _reconnectTimeout = null; }
      if (_ws) { _ws.close(); _ws = null; }
      set({ pairingCode: null, isServerConnected: false, isSlaveConnected: false });
    },

    sendSurveyUpdate: (survey: any) => {
      if (_ws && _ws.readyState === WebSocket.OPEN) {
        _ws.send(JSON.stringify({ type: 'slave_pairing_update_survey', surveyData: survey }));
      }
    },

    refreshCode: () => {
      _intentionalClose = false;
      set({ pairingCode: null, isSlaveConnected: false });
      if (_ws) { _ws.close(); _ws = null; }
      connectWs();
    },
  };
});
