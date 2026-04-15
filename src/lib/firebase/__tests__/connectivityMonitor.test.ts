import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Stub browser globals before any imports
vi.stubGlobal('localStorage', {
  getItem: vi.fn(() => null),
  setItem: vi.fn(),
  removeItem: vi.fn(),
});

const windowListeners: Record<string, Function[]> = {};
vi.stubGlobal('window', {
  addEventListener: vi.fn((event: string, handler: Function) => {
    if (!windowListeners[event]) windowListeners[event] = [];
    windowListeners[event].push(handler);
  }),
  removeEventListener: vi.fn((event: string, handler: Function) => {
    if (windowListeners[event]) {
      windowListeners[event] = windowListeners[event].filter(h => h !== handler);
    }
  }),
  dispatchEvent: vi.fn(),
});

// Mock firebase modules
vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(),
  onAuthStateChanged: vi.fn((_auth: any, cb: any) => {
    // Don't call cb immediately, let tests control it
    return vi.fn(); // unsubscribe
  }),
}));

vi.mock('firebase/app', () => ({
  getApps: vi.fn(() => [{ name: 'test-app' }]),
}));

// Mock fetch for connectivity checks
vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true })));

describe('ConnectivityMonitor', () => {
  let connectivityMonitor: any;
  let initConnectivityMonitor: any;
  let isReadyForFirebaseSync: any;
  let getConnectivityState: any;

  beforeEach(async () => {
    vi.resetModules();
    // Reset navigator.onLine
    Object.defineProperty(navigator, 'onLine', { value: true, writable: true, configurable: true });

    const mod = await import('../connectivityMonitor');
    connectivityMonitor = mod.connectivityMonitor;
    initConnectivityMonitor = mod.initConnectivityMonitor;
    isReadyForFirebaseSync = mod.isReadyForFirebaseSync;
    getConnectivityState = mod.getConnectivityState;
  });

  afterEach(() => {
    connectivityMonitor.destroy();
  });

  describe('getState', () => {
    it('returns initial state based on navigator.onLine', () => {
      const state = connectivityMonitor.getState();
      expect(state.isOnline).toBe(true);
      expect(state.isFirebaseConnected).toBe(false);
      expect(state.isAuthenticated).toBe(false);
    });

    it('returns a copy of state (not the reference)', () => {
      const state1 = connectivityMonitor.getState();
      const state2 = connectivityMonitor.getState();
      expect(state1).not.toBe(state2);
      expect(state1).toEqual(state2);
    });
  });

  describe('isReadyForSync', () => {
    it('returns false when not authenticated', () => {
      expect(connectivityMonitor.isReadyForSync()).toBe(false);
    });

    it('isReadyForFirebaseSync returns false by default', () => {
      expect(isReadyForFirebaseSync()).toBe(false);
    });
  });

  describe('subscribe', () => {
    it('calls listener immediately with current state', () => {
      const listener = vi.fn();
      connectivityMonitor.subscribe(listener);
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(expect.objectContaining({ isOnline: true }));
    });

    it('returns an unsubscribe function', () => {
      const listener = vi.fn();
      const unsub = connectivityMonitor.subscribe(listener);
      expect(typeof unsub).toBe('function');
      unsub();
      // After unsubscribing, listener should not be called on state changes
    });
  });

  describe('initialize', () => {
    it('only initializes once', () => {
      const addEventSpy = vi.spyOn(window, 'addEventListener');
      initConnectivityMonitor();
      const callCount1 = addEventSpy.mock.calls.length;
      initConnectivityMonitor(); // second call should be no-op
      expect(addEventSpy.mock.calls.length).toBe(callCount1);
      addEventSpy.mockRestore();
    });
  });

  describe('forceCheck', () => {
    it('returns state after checking', async () => {
      const state = await connectivityMonitor.forceCheck();
      expect(state.isOnline).toBe(true);
    });

    it('sets isOnline to false when navigator is offline', async () => {
      Object.defineProperty(navigator, 'onLine', { value: false, writable: true, configurable: true });
      const state = await connectivityMonitor.forceCheck();
      expect(state.isOnline).toBe(false);
    });
  });

  describe('destroy', () => {
    it('clears all listeners', () => {
      const listener = vi.fn();
      connectivityMonitor.subscribe(listener);
      connectivityMonitor.destroy();
      // After destroy, re-initialization should work
      expect(() => connectivityMonitor.initialize()).not.toThrow();
    });
  });

  describe('getConnectivityState', () => {
    it('returns state via exported helper', () => {
      const state = getConnectivityState();
      expect(state).toHaveProperty('isOnline');
      expect(state).toHaveProperty('isFirebaseConnected');
      expect(state).toHaveProperty('isAuthenticated');
    });
  });
});
