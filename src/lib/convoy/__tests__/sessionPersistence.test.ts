import { describe, it, expect, beforeEach, vi } from 'vitest';

// Stub localStorage before imports
const storage: Record<string, string> = {};
vi.stubGlobal('localStorage', {
  getItem: vi.fn((key: string) => storage[key] ?? null),
  setItem: vi.fn((key: string, value: string) => { storage[key] = value; }),
  removeItem: vi.fn((key: string) => { delete storage[key]; }),
});

import {
  saveConvoySession,
  getConvoySession,
  clearConvoySession,
  updateConvoySessionActivity,
  hasActiveConvoySession,
} from '../sessionPersistence';

describe('sessionPersistence', () => {
  beforeEach(() => {
    // Clear storage
    Object.keys(storage).forEach(k => delete storage[k]);
    vi.clearAllMocks();
  });

  describe('saveConvoySession', () => {
    it('saves session data to localStorage', () => {
      saveConvoySession({ sessionId: 's1', memberName: 'Driver' });
      const stored = JSON.parse(storage['convoy_session']);
      expect(stored.sessionId).toBe('s1');
      expect(stored.memberName).toBe('Driver');
      expect(stored.lastActivity).toBeGreaterThan(0);
    });

    it('merges with existing session data', () => {
      saveConvoySession({ sessionId: 's1', memberName: 'Driver' });
      saveConvoySession({ isLeader: true });
      const stored = JSON.parse(storage['convoy_session']);
      expect(stored.sessionId).toBe('s1');
      expect(stored.isLeader).toBe(true);
    });
  });

  describe('getConvoySession', () => {
    it('returns null when no session stored', () => {
      expect(getConvoySession()).toBeNull();
    });

    it('returns parsed session data', () => {
      storage['convoy_session'] = JSON.stringify({ sessionId: 's1', lastActivity: Date.now() });
      const session = getConvoySession();
      expect(session).not.toBeNull();
      expect(session!.sessionId).toBe('s1');
    });

    it('returns null on corrupt JSON', () => {
      storage['convoy_session'] = '{broken json';
      expect(getConvoySession()).toBeNull();
    });
  });

  describe('clearConvoySession', () => {
    it('removes session from localStorage', () => {
      saveConvoySession({ sessionId: 's1' });
      clearConvoySession();
      expect(getConvoySession()).toBeNull();
    });
  });

  describe('updateConvoySessionActivity', () => {
    it('updates lastActivity timestamp on existing session', () => {
      saveConvoySession({ sessionId: 's1', lastActivity: 1000 });
      updateConvoySessionActivity();
      const session = getConvoySession();
      expect(session!.lastActivity).toBeGreaterThan(1000);
    });

    it('does nothing when no session exists', () => {
      updateConvoySessionActivity();
      expect(getConvoySession()).toBeNull();
    });
  });

  describe('hasActiveConvoySession', () => {
    it('returns false when no session exists', () => {
      expect(hasActiveConvoySession()).toBe(false);
    });

    it('returns true for recent session', () => {
      saveConvoySession({ sessionId: 's1' });
      expect(hasActiveConvoySession()).toBe(true);
    });

    it('returns false for stale session (> 1 hour)', () => {
      storage['convoy_session'] = JSON.stringify({
        sessionId: 's1',
        lastActivity: Date.now() - 3700000, // > 1 hour ago
      });
      expect(hasActiveConvoySession()).toBe(false);
    });
  });
});
