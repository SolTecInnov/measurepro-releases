import { describe, it, expect } from 'vitest';

import {
  saveSessionState,
  loadSessionState,
  clearSessionState,
  persistSamples,
  loadSessionSamples,
  clearSessionSamples,
  appendSamples,
} from '../gnssSessionPersistence';

describe('gnssSessionPersistence (stub)', () => {
  describe('saveSessionState', () => {
    it('resolves without error', async () => {
      await expect(
        saveSessionState({ sessionId: 's1', isRecording: true, startTime: Date.now() })
      ).resolves.toBeUndefined();
    });
  });

  describe('loadSessionState', () => {
    it('returns null (stub)', () => {
      expect(loadSessionState()).toBeNull();
    });
  });

  describe('clearSessionState', () => {
    it('does not throw', () => {
      expect(() => clearSessionState()).not.toThrow();
    });
  });

  describe('persistSamples', () => {
    it('resolves without error', async () => {
      await expect(persistSamples('s1', [])).resolves.toBeUndefined();
    });
  });

  describe('loadSessionSamples', () => {
    it('returns empty array (stub)', async () => {
      const samples = await loadSessionSamples('s1');
      expect(samples).toEqual([]);
    });
  });

  describe('clearSessionSamples', () => {
    it('resolves without error', async () => {
      await expect(clearSessionSamples('s1')).resolves.toBeUndefined();
    });
  });

  describe('appendSamples', () => {
    it('resolves without error', async () => {
      await expect(appendSamples('s1', [
        { timestamp: 1, latitude: 45.5, longitude: -73.5, altitude: 100 },
      ])).resolves.toBeUndefined();
    });
  });
});
