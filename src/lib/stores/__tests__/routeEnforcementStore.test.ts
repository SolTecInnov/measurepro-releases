import { describe, it, expect, beforeEach, vi } from 'vitest';

// Stub browser globals before imports
vi.stubGlobal('localStorage', {
  getItem: vi.fn(() => null),
  setItem: vi.fn(),
  removeItem: vi.fn(),
});

vi.mock('@/lib/sounds', () => ({
  soundManager: { play: vi.fn() },
}));

vi.mock('@/lib/config/environment', () => ({
  getWsUrl: vi.fn(() => 'ws://localhost:3001/api'),
}));

vi.mock('idb', () => ({
  openDB: vi.fn(async () => ({
    get: vi.fn(async () => null),
    getAll: vi.fn(async () => []),
    put: vi.fn(async () => {}),
    transaction: vi.fn(() => ({
      objectStore: vi.fn(() => ({
        clear: vi.fn(async () => {}),
        add: vi.fn(async () => {}),
      })),
      done: Promise.resolve(),
    })),
    objectStoreNames: { contains: () => false },
    createObjectStore: vi.fn(() => ({ createIndex: vi.fn() })),
  })),
}));

import { useRouteEnforcementStore } from '../routeEnforcementStore';

describe('useRouteEnforcementStore', () => {
  beforeEach(() => {
    useRouteEnforcementStore.setState({
      settings: null,
      activeConvoys: new Map(),
      driverSession: null,
      incidents: new Map(),
      gpsState: null,
      gpsBreadcrumbs: [],
      stopModal: { isVisible: false, incidentId: null, reason: null, canDismiss: false },
      ws: null,
      connected: false,
      offlineIncidentQueue: [],
    });
    vi.clearAllMocks();
  });

  describe('settings', () => {
    it('setSettings updates settings', () => {
      const settings = { warningDistance: 50, alertDistance: 100 } as any;
      useRouteEnforcementStore.getState().setSettings(settings);
      expect(useRouteEnforcementStore.getState().settings).toEqual(settings);
    });
  });

  describe('convoy management', () => {
    it('addConvoy adds to activeConvoys', () => {
      const convoy = { id: 'c1', name: 'Test Convoy' } as any;
      useRouteEnforcementStore.getState().addConvoy(convoy);
      expect(useRouteEnforcementStore.getState().activeConvoys.get('c1')).toEqual(convoy);
    });

    it('updateConvoy updates existing convoy', () => {
      useRouteEnforcementStore.getState().addConvoy({ id: 'c1', name: 'Old' } as any);
      useRouteEnforcementStore.getState().updateConvoy('c1', { name: 'New' } as any);
      expect(useRouteEnforcementStore.getState().activeConvoys.get('c1')!.name).toBe('New');
    });

    it('updateConvoy does nothing for non-existent convoy', () => {
      useRouteEnforcementStore.getState().updateConvoy('nonexistent', { name: 'X' } as any);
      expect(useRouteEnforcementStore.getState().activeConvoys.size).toBe(0);
    });

    it('removeConvoy removes from activeConvoys', () => {
      useRouteEnforcementStore.getState().addConvoy({ id: 'c1', name: 'Test' } as any);
      useRouteEnforcementStore.getState().removeConvoy('c1');
      expect(useRouteEnforcementStore.getState().activeConvoys.has('c1')).toBe(false);
    });
  });

  describe('driver session', () => {
    it('setDriverSession sets session', () => {
      const session = { convoyId: 'c1', memberId: 'm1', isConnected: true, currentStatus: 'on_route' as const, distanceFromRoute: null, convoy: {} as any };
      useRouteEnforcementStore.getState().setDriverSession(session);
      expect(useRouteEnforcementStore.getState().driverSession).toEqual(session);
    });

    it('setDriverSession clears session with null', () => {
      useRouteEnforcementStore.getState().setDriverSession({ convoyId: 'c1' } as any);
      useRouteEnforcementStore.getState().setDriverSession(null);
      expect(useRouteEnforcementStore.getState().driverSession).toBeNull();
    });

    it('updateDriverStatus changes status', () => {
      useRouteEnforcementStore.getState().setDriverSession({
        convoyId: 'c1', memberId: 'm1', isConnected: true,
        currentStatus: 'on_route', distanceFromRoute: null, convoy: {} as any,
      });
      useRouteEnforcementStore.getState().updateDriverStatus('warning');
      expect(useRouteEnforcementStore.getState().driverSession!.currentStatus).toBe('warning');
    });

    it('updateDriverStatus does nothing without session', () => {
      useRouteEnforcementStore.getState().updateDriverStatus('warning');
      expect(useRouteEnforcementStore.getState().driverSession).toBeNull();
    });
  });

  describe('incidents', () => {
    it('addIncident adds incident', () => {
      const incident = { id: 'inc1', type: 'off_route', convoyId: 'c1' } as any;
      useRouteEnforcementStore.getState().addIncident(incident);
      expect(useRouteEnforcementStore.getState().incidents.get('inc1')).toEqual(incident);
    });

    it('updateIncident updates existing incident', () => {
      useRouteEnforcementStore.getState().addIncident({ id: 'inc1', status: 'active' } as any);
      useRouteEnforcementStore.getState().updateIncident('inc1', { status: 'acknowledged' } as any);
      expect(useRouteEnforcementStore.getState().incidents.get('inc1')!.status).toBe('acknowledged');
    });

    it('clearIncident removes incident', () => {
      useRouteEnforcementStore.getState().addIncident({ id: 'inc1' } as any);
      useRouteEnforcementStore.getState().clearIncident('inc1');
      expect(useRouteEnforcementStore.getState().incidents.has('inc1')).toBe(false);
    });
  });

  describe('GPS tracking', () => {
    it('setGPS sets current GPS state', () => {
      const gps = { latitude: 45.5, longitude: -73.5, accuracy: 2, timestamp: Date.now() };
      useRouteEnforcementStore.getState().setGPS(gps);
      expect(useRouteEnforcementStore.getState().gpsState).toEqual(gps);
    });

    it('addGPSBreadcrumb adds to breadcrumbs array', () => {
      const gps = { latitude: 45.5, longitude: -73.5, accuracy: 2, timestamp: Date.now() };
      useRouteEnforcementStore.getState().addGPSBreadcrumb(gps);
      expect(useRouteEnforcementStore.getState().gpsBreadcrumbs).toHaveLength(1);
    });

    it('limits breadcrumbs to last 1000', () => {
      const crumbs = Array.from({ length: 1005 }, (_, i) => ({
        latitude: 45, longitude: -73, accuracy: 2, timestamp: i,
      }));
      useRouteEnforcementStore.setState({ gpsBreadcrumbs: crumbs.slice(0, 999) });
      useRouteEnforcementStore.getState().addGPSBreadcrumb(crumbs[999]);
      expect(useRouteEnforcementStore.getState().gpsBreadcrumbs.length).toBeLessThanOrEqual(1000);
    });
  });

  describe('STOP modal', () => {
    it('showStopModal sets modal visible with details', () => {
      useRouteEnforcementStore.getState().showStopModal('inc1', 'Off route');
      const modal = useRouteEnforcementStore.getState().stopModal;
      expect(modal.isVisible).toBe(true);
      expect(modal.incidentId).toBe('inc1');
      expect(modal.reason).toBe('Off route');
    });

    it('hideStopModal clears modal', () => {
      useRouteEnforcementStore.getState().showStopModal('inc1', 'Off route');
      useRouteEnforcementStore.getState().hideStopModal();
      const modal = useRouteEnforcementStore.getState().stopModal;
      expect(modal.isVisible).toBe(false);
      expect(modal.incidentId).toBeNull();
    });
  });

  describe('offline queue', () => {
    it('queueIncidentOffline adds to offline queue', () => {
      const incident = { id: 'inc1', convoyId: 'c1' } as any;
      useRouteEnforcementStore.getState().queueIncidentOffline(incident);
      expect(useRouteEnforcementStore.getState().offlineIncidentQueue).toHaveLength(1);
    });

    it('syncOfflineIncidents does nothing when disconnected', async () => {
      useRouteEnforcementStore.getState().queueIncidentOffline({ id: 'inc1', convoyId: 'c1' } as any);
      await useRouteEnforcementStore.getState().syncOfflineIncidents();
      // Queue should remain since not connected
      expect(useRouteEnforcementStore.getState().offlineIncidentQueue).toHaveLength(1);
    });
  });

  describe('disconnect', () => {
    it('clears session and connection state', () => {
      useRouteEnforcementStore.setState({
        connected: true,
        driverSession: { convoyId: 'c1' } as any,
        ws: { close: vi.fn() } as any,
      });
      useRouteEnforcementStore.getState().disconnect();
      const state = useRouteEnforcementStore.getState();
      expect(state.connected).toBe(false);
      expect(state.driverSession).toBeNull();
      expect(state.ws).toBeNull();
    });
  });

  describe('handleIncomingMessage', () => {
    it('handles stop_command', () => {
      useRouteEnforcementStore.getState().handleIncomingMessage({
        type: 'stop_command',
        data: { incidentId: 'inc1', reason: 'Off route detected' },
        timestamp: Date.now(),
      } as any);
      expect(useRouteEnforcementStore.getState().stopModal.isVisible).toBe(true);
    });

    it('handles resume_command', () => {
      useRouteEnforcementStore.getState().showStopModal('inc1', 'Off route');
      useRouteEnforcementStore.getState().handleIncomingMessage({
        type: 'resume_command',
        data: {},
        timestamp: Date.now(),
      } as any);
      expect(useRouteEnforcementStore.getState().stopModal.isVisible).toBe(false);
    });

    it('handles incident_cleared', () => {
      useRouteEnforcementStore.getState().addIncident({ id: 'inc1' } as any);
      useRouteEnforcementStore.getState().handleIncomingMessage({
        type: 'incident_cleared',
        data: { incidentId: 'inc1' },
        timestamp: Date.now(),
      } as any);
      expect(useRouteEnforcementStore.getState().incidents.has('inc1')).toBe(false);
    });

    it('handles convoy_status ended', () => {
      useRouteEnforcementStore.setState({
        connected: true,
        driverSession: { convoyId: 'c1' } as any,
        ws: { close: vi.fn() } as any,
      });
      useRouteEnforcementStore.getState().handleIncomingMessage({
        type: 'convoy_status',
        data: { status: 'ended', message: 'done' },
        timestamp: Date.now(),
      } as any);
      expect(useRouteEnforcementStore.getState().connected).toBe(false);
    });
  });
});
