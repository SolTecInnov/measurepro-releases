import { create } from 'zustand';
import type {
  RouteEnforcementConvoy,
  RouteEnforcementMember,
  RouteEnforcementMessage,
  RouteIncident,
  RouteEnforcementSettings,
} from '@shared/schema';
import { soundManager } from '../sounds';
import { openDB, IDBPDatabase } from 'idb';

interface GPSState {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
}

interface DriverSession {
  convoyId: string;
  memberId: string;
  convoy: RouteEnforcementConvoy;
  isConnected: boolean;
  currentStatus: 'on_route' | 'warning' | 'off_route_alert';
  distanceFromRoute: number | null;
}

interface StopModalState {
  isVisible: boolean;
  incidentId: string | null;
  reason: string | null;
  canDismiss: boolean; // Only dispatch can clear
}

interface RouteEnforcementStore {
  // Settings
  settings: RouteEnforcementSettings | null;
  setSettings: (settings: RouteEnforcementSettings) => void;

  // Active convoys (for dispatch view)
  activeConvoys: Map<string, RouteEnforcementConvoy>;
  addConvoy: (convoy: RouteEnforcementConvoy) => void;
  updateConvoy: (convoyId: string, updates: Partial<RouteEnforcementConvoy>) => void;
  removeConvoy: (convoyId: string) => void;

  // Driver session
  driverSession: DriverSession | null;
  setDriverSession: (session: DriverSession | null) => void;
  updateDriverStatus: (status: 'on_route' | 'warning' | 'off_route_alert') => void;

  // Incidents
  incidents: Map<string, RouteIncident>;
  addIncident: (incident: RouteIncident) => void;
  updateIncident: (incidentId: string, updates: Partial<RouteIncident>) => void;
  clearIncident: (incidentId: string) => void;

  // GPS tracking
  gpsState: GPSState | null;
  setGPS: (gps: GPSState) => void;
  gpsBreadcrumbs: GPSState[];
  addGPSBreadcrumb: (gps: GPSState) => void;

  // STOP modal
  stopModal: StopModalState;
  showStopModal: (incidentId: string, reason: string) => void;
  hideStopModal: () => void;

  // WebSocket connection
  ws: WebSocket | null;
  connected: boolean;
  connectToConvoy: (convoyId: string, qrToken: string, memberData: any) => void;
  disconnect: () => void;
  sendMessage: (message: RouteEnforcementMessage) => void;
  handleIncomingMessage: (message: RouteEnforcementMessage) => void;

  // Offline queue
  offlineIncidentQueue: RouteIncident[];
  queueIncidentOffline: (incident: RouteIncident) => void;
  syncOfflineIncidents: () => Promise<void>;

  // Persistence
  loadFromIndexedDB: () => Promise<void>;
  saveToIndexedDB: () => Promise<void>;
}

// IndexedDB setup
const DB_NAME = 'routeEnforcementDB';
const DB_VERSION = 1;

async function initDB(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('incidents')) {
        db.createObjectStore('incidents', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('gpsBreadcrumbs')) {
        const store = db.createObjectStore('gpsBreadcrumbs', { keyPath: 'timestamp' });
        store.createIndex('by-timestamp', 'timestamp');
      }
      if (!db.objectStoreNames.contains('offlineQueue')) {
        db.createObjectStore('offlineQueue', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings');
      }
    },
  });
}

export const useRouteEnforcementStore = create<RouteEnforcementStore>((set, get) => ({
  // Settings
  settings: null,
  setSettings: (settings) => {
    set({ settings });
    get().saveToIndexedDB();
  },

  // Active convoys
  activeConvoys: new Map(),
  addConvoy: (convoy) => {
    set((state) => {
      const newConvoys = new Map(state.activeConvoys);
      newConvoys.set(convoy.id, convoy);
      return { activeConvoys: newConvoys };
    });
  },
  updateConvoy: (convoyId, updates) => {
    set((state) => {
      const newConvoys = new Map(state.activeConvoys);
      const existing = newConvoys.get(convoyId);
      if (existing) {
        newConvoys.set(convoyId, { ...existing, ...updates });
      }
      return { activeConvoys: newConvoys };
    });
  },
  removeConvoy: (convoyId) => {
    set((state) => {
      const newConvoys = new Map(state.activeConvoys);
      newConvoys.delete(convoyId);
      return { activeConvoys: newConvoys };
    });
  },

  // Driver session
  driverSession: null,
  setDriverSession: (session) => {
    set({ driverSession: session });
    if (session) {
      get().saveToIndexedDB();
    }
  },
  updateDriverStatus: (status) => {
    set((state) => {
      if (!state.driverSession) return state;
      return {
        driverSession: {
          ...state.driverSession,
          currentStatus: status,
        },
      };
    });
  },

  // Incidents
  incidents: new Map(),
  addIncident: (incident) => {
    set((state) => {
      const newIncidents = new Map(state.incidents);
      newIncidents.set(incident.id, incident);
      return { incidents: newIncidents };
    });
    get().saveToIndexedDB();
  },
  updateIncident: (incidentId, updates) => {
    set((state) => {
      const newIncidents = new Map(state.incidents);
      const existing = newIncidents.get(incidentId);
      if (existing) {
        newIncidents.set(incidentId, { ...existing, ...updates });
      }
      return { incidents: newIncidents };
    });
    get().saveToIndexedDB();
  },
  clearIncident: (incidentId) => {
    set((state) => {
      const newIncidents = new Map(state.incidents);
      newIncidents.delete(incidentId);
      return { incidents: newIncidents };
    });
    get().saveToIndexedDB();
  },

  // GPS tracking
  gpsState: null,
  setGPS: (gps) => {
    set({ gpsState: gps });
  },
  gpsBreadcrumbs: [],
  addGPSBreadcrumb: (gps) => {
    set((state) => ({
      gpsBreadcrumbs: [...state.gpsBreadcrumbs, gps].slice(-1000), // Keep last 1000
    }));
    get().saveToIndexedDB();
  },

  // STOP modal
  stopModal: {
    isVisible: false,
    incidentId: null,
    reason: null,
    canDismiss: false,
  },
  showStopModal: (incidentId, reason) => {
    // Play warning sound
    soundManager.play('critical');

    set({
      stopModal: {
        isVisible: true,
        incidentId,
        reason,
        canDismiss: false,
      },
    });
  },
  hideStopModal: () => {
    set({
      stopModal: {
        isVisible: false,
        incidentId: null,
        reason: null,
        canDismiss: false,
      },
    });
  },

  // WebSocket connection
  ws: null,
  connected: false,
  connectToConvoy: (convoyId, qrToken, memberData) => {
    const { ws: existingWs } = get();
    if (existingWs && existingWs.readyState !== WebSocket.CLOSED) {
      existingWs.close();
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    const newWs = new WebSocket(wsUrl);

    newWs.onopen = () => {
      set({ connected: true });

      // Send join request
      get().sendMessage({
        type: 'route_join_request',
        convoyId,
        data: { qrToken, memberData },
        timestamp: Date.now(),
      });
    };

    newWs.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as RouteEnforcementMessage;
        get().handleIncomingMessage(message);
      } catch (error) {
      }
    };

    newWs.onclose = () => {
      set({ connected: false, ws: null });
    };

    newWs.onerror = (error) => {
    };

    set({ ws: newWs });
  },

  disconnect: () => {
    const { ws } = get();
    if (ws) {
      ws.close();
    }
    set({ ws: null, connected: false, driverSession: null });
  },

  sendMessage: (message) => {
    const { ws, connected } = get();
    if (ws && connected && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    } else {
    }
  },

  handleIncomingMessage: (message) => {

    switch (message.type) {
      case 'route_join_approved':
        {
          const { memberId, convoy, members } = message.data;
          set({
            driverSession: {
              convoyId: convoy.id,
              memberId,
              convoy,
              isConnected: true,
              currentStatus: 'on_route',
              distanceFromRoute: null,
            },
          });
        }
        break;

      case 'route_join_denied':
        {
          get().disconnect();
        }
        break;

      case 'stop_command':
        {
          const { incidentId, reason } = message.data;
          get().showStopModal(incidentId, reason);
        }
        break;

      case 'resume_command':
        {
          get().hideStopModal();
          get().updateDriverStatus('on_route');
        }
        break;

      case 'incident_acknowledged':
        {
          const { incidentId } = message.data;
          get().updateIncident(incidentId, { status: 'acknowledged' });
        }
        break;

      case 'incident_cleared':
        {
          const { incidentId } = message.data;
          get().clearIncident(incidentId);
        }
        break;

      case 'convoy_status':
        {
          const { status, message: statusMsg } = message.data;
          if (status === 'ended') {
            get().disconnect();
          }
        }
        break;

      default:
    }
  },

  // Offline queue
  offlineIncidentQueue: [],
  queueIncidentOffline: (incident) => {
    set((state) => ({
      offlineIncidentQueue: [...state.offlineIncidentQueue, incident],
    }));
    get().saveToIndexedDB();
  },

  syncOfflineIncidents: async () => {
    const { offlineIncidentQueue, connected, sendMessage } = get();
    if (!connected || offlineIncidentQueue.length === 0) return;

    for (const incident of offlineIncidentQueue) {
      sendMessage({
        type: 'off_route_alert',
        convoyId: incident.convoyId,
        data: { incident },
        timestamp: Date.now(),
      });
    }

    set({ offlineIncidentQueue: [] });
    get().saveToIndexedDB();
  },

  // Persistence
  loadFromIndexedDB: async () => {
    try {
      const db = await initDB();

      // Load settings
      const settings = await db.get('settings', 'current');
      if (settings) {
        set({ settings });
      }

      // Load incidents
      const incidents = await db.getAll('incidents');
      const incidentsMap = new Map(incidents.map((i: RouteIncident) => [i.id, i]));
      set({ incidents: incidentsMap });

      // Load GPS breadcrumbs
      const breadcrumbs = await db.getAll('gpsBreadcrumbs');
      set({ gpsBreadcrumbs: breadcrumbs });

      // Load offline queue
      const offlineQueue = await db.getAll('offlineQueue');
      set({ offlineIncidentQueue: offlineQueue });

    } catch (error) {
    }
  },

  saveToIndexedDB: async () => {
    try {
      const db = await initDB();
      const state = get();

      // Save settings
      if (state.settings) {
        await db.put('settings', state.settings, 'current');
      }

      // Save incidents
      const tx1 = db.transaction('incidents', 'readwrite');
      await tx1.objectStore('incidents').clear();
      for (const incident of state.incidents.values()) {
        await tx1.objectStore('incidents').add(incident);
      }
      await tx1.done;

      // Save GPS breadcrumbs (keep last 1000)
      const tx2 = db.transaction('gpsBreadcrumbs', 'readwrite');
      await tx2.objectStore('gpsBreadcrumbs').clear();
      for (const breadcrumb of state.gpsBreadcrumbs.slice(-1000)) {
        await tx2.objectStore('gpsBreadcrumbs').add(breadcrumb);
      }
      await tx2.done;

      // Save offline queue
      const tx3 = db.transaction('offlineQueue', 'readwrite');
      await tx3.objectStore('offlineQueue').clear();
      for (const incident of state.offlineIncidentQueue) {
        await tx3.objectStore('offlineQueue').add(incident);
      }
      await tx3.done;
    } catch (error) {
    }
  },
}));

// Initialize store on app load
if (typeof window !== 'undefined') {
  useRouteEnforcementStore.getState().loadFromIndexedDB();
}
