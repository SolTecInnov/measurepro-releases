import { describe, it, expect, beforeEach, vi } from 'vitest';

// Stub localStorage
const localStorageMap = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (key: string) => localStorageMap.get(key) ?? null,
  setItem: (key: string, value: string) => localStorageMap.set(key, value),
  removeItem: (key: string) => localStorageMap.delete(key),
  clear: () => localStorageMap.clear(),
});

vi.stubGlobal('navigator', { userAgent: 'test-agent' });
vi.stubGlobal('crypto', { randomUUID: () => 'test-uuid-1234' });

// Mock firebase
const mockSetDoc = vi.fn(() => Promise.resolve());
const mockDeleteDoc = vi.fn(() => Promise.resolve());
const mockOnSnapshot = vi.fn(() => vi.fn()); // returns unsubscribe fn

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(() => 'mock-doc-ref'),
  setDoc: (...args: any[]) => mockSetDoc(...args),
  deleteDoc: (...args: any[]) => mockDeleteDoc(...args),
  onSnapshot: (...args: any[]) => mockOnSnapshot(...args),
  serverTimestamp: () => 'mock-server-timestamp',
  getDoc: vi.fn(() => Promise.resolve({ data: () => ({ activeSessionId: 'test-uuid-1234' }) })),
}));
vi.mock('../../firebase', () => ({
  db: 'mock-db',
}));

import {
  registerSession,
  startSessionGuard,
  stopSessionGuard,
  clearLocalSessionOnly,
  unregisterSession,
} from '../sessionManager';

describe('sessionManager', () => {
  beforeEach(() => {
    localStorageMap.clear();
    mockSetDoc.mockClear();
    mockDeleteDoc.mockClear();
    mockOnSnapshot.mockClear();
  });

  describe('registerSession', () => {
    it('generates a session ID and stores it locally', async () => {
      const sessionId = await registerSession('user-123');
      expect(sessionId).toBe('test-uuid-1234');
      expect(localStorageMap.get('measPro_activeSessionId')).toBe('test-uuid-1234');
    });

    it('calls setDoc on Firestore with session data', async () => {
      await registerSession('user-123');
      expect(mockSetDoc).toHaveBeenCalledTimes(1);
    });
  });

  describe('startSessionGuard / stopSessionGuard', () => {
    it('starts a Firestore snapshot listener', () => {
      const onEvicted = vi.fn();
      startSessionGuard('user-123', onEvicted);
      expect(mockOnSnapshot).toHaveBeenCalledTimes(1);
    });

    it('stops previous listener before starting new one', () => {
      const unsub = vi.fn();
      mockOnSnapshot.mockReturnValue(unsub);

      startSessionGuard('user-123', vi.fn());
      startSessionGuard('user-456', vi.fn());

      // First listener should have been unsubscribed
      expect(unsub).toHaveBeenCalledTimes(1);
    });

    it('stopSessionGuard unsubscribes listener', () => {
      const unsub = vi.fn();
      mockOnSnapshot.mockReturnValue(unsub);

      startSessionGuard('user-123', vi.fn());
      stopSessionGuard();

      expect(unsub).toHaveBeenCalledTimes(1);
    });

    it('stopSessionGuard is safe to call when no listener exists', () => {
      expect(() => stopSessionGuard()).not.toThrow();
    });
  });

  describe('clearLocalSessionOnly', () => {
    it('removes the session ID from localStorage', () => {
      localStorageMap.set('measPro_activeSessionId', 'some-id');
      clearLocalSessionOnly();
      expect(localStorageMap.has('measPro_activeSessionId')).toBe(false);
    });
  });

  describe('unregisterSession', () => {
    it('clears local session ID', async () => {
      localStorageMap.set('measPro_activeSessionId', 'test-uuid-1234');
      await unregisterSession('user-123');
      expect(localStorageMap.has('measPro_activeSessionId')).toBe(false);
    });

    it('does nothing if no local session ID', async () => {
      await unregisterSession('user-123');
      expect(mockDeleteDoc).not.toHaveBeenCalled();
    });
  });
});
