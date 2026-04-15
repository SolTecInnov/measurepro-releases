import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock firebase modules before importing the store
vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(),
  initializeFirestore: vi.fn(),
  memoryLocalCache: vi.fn(),
  doc: vi.fn(),
  setDoc: vi.fn().mockResolvedValue(undefined),
  getDoc: vi.fn(),
  onSnapshot: vi.fn(() => vi.fn()), // returns unsubscribe
  deleteDoc: vi.fn(),
  collection: vi.fn(),
  addDoc: vi.fn().mockResolvedValue(undefined),
  serverTimestamp: vi.fn(() => null),
  query: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
}));

vi.mock('firebase/app', () => ({
  getApp: vi.fn(() => ({ options: { projectId: 'test' } })),
}));

import { useSlavePairingStore } from '../slavePairingStore';

describe('useSlavePairingStore', () => {
  beforeEach(() => {
    useSlavePairingStore.setState({
      pairingCode: null,
      isServerConnected: false,
      isSlaveConnected: false,
    });
  });

  it('has correct defaults', () => {
    const state = useSlavePairingStore.getState();
    expect(state.pairingCode).toBeNull();
    expect(state.isServerConnected).toBe(false);
    expect(state.isSlaveConnected).toBe(false);
  });

  describe('connect', () => {
    it('generates a 6-digit pairing code', () => {
      useSlavePairingStore.getState().connect();
      const code = useSlavePairingStore.getState().pairingCode;
      expect(code).not.toBeNull();
      expect(code!.length).toBe(6);
      expect(Number(code)).toBeGreaterThanOrEqual(100000);
      expect(Number(code)).toBeLessThan(1000000);
    });

    it('resets connection states on connect', () => {
      useSlavePairingStore.setState({ isServerConnected: true, isSlaveConnected: true });
      useSlavePairingStore.getState().connect();
      expect(useSlavePairingStore.getState().isServerConnected).toBe(false);
      expect(useSlavePairingStore.getState().isSlaveConnected).toBe(false);
    });
  });

  describe('disconnect', () => {
    it('clears pairing code and connection states', () => {
      useSlavePairingStore.setState({
        pairingCode: '123456',
        isServerConnected: true,
        isSlaveConnected: true,
      });
      useSlavePairingStore.getState().disconnect();
      const state = useSlavePairingStore.getState();
      expect(state.pairingCode).toBeNull();
      expect(state.isServerConnected).toBe(false);
      expect(state.isSlaveConnected).toBe(false);
    });
  });

  describe('refreshCode', () => {
    it('disconnects and generates a new code after timeout', () => {
      vi.useFakeTimers();
      useSlavePairingStore.setState({
        pairingCode: '111111',
        isServerConnected: true,
      });
      useSlavePairingStore.getState().refreshCode();
      // After disconnect, code should be null
      expect(useSlavePairingStore.getState().pairingCode).toBeNull();

      // After 300ms, connect is called with a new code
      vi.advanceTimersByTime(300);
      expect(useSlavePairingStore.getState().pairingCode).not.toBeNull();
      vi.useRealTimers();
    });
  });

  describe('sendSurveyUpdate', () => {
    it('does nothing when no pairing code', () => {
      // Should not throw
      useSlavePairingStore.getState().sendSurveyUpdate({ id: 'survey-1' });
    });
  });
});
