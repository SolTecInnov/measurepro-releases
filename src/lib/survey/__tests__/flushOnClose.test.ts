import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Stub globals before any imports
const addEventListenerSpy = vi.fn();
const removeEventListenerSpy = vi.fn();

vi.stubGlobal('window', {
  addEventListener: addEventListenerSpy,
  removeEventListener: removeEventListenerSpy,
});

vi.stubGlobal('document', {
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  visibilityState: 'visible',
});

vi.stubGlobal('localStorage', {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
});

// Mock dependencies
vi.mock('../../utils/logger', () => ({
  logger: {
    log: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('../../workers/MeasurementLoggerClient', () => ({
  getMeasurementLogger: vi.fn(() => ({
    flush: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock('../checkpoints', () => ({
  stopCheckpointTimer: vi.fn(),
  createCheckpoint: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../storageHealth', () => ({
  getStorageHealth: vi.fn(() => ({
    pendingWrites: 0,
    status: 'healthy',
    lastWriteTime: null,
  })),
}));

import { initFlushOnClose, cleanupFlushOnClose } from '../flushOnClose';

describe('flushOnClose', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the isInitialized flag by cleaning up
    cleanupFlushOnClose();
  });

  describe('initFlushOnClose', () => {
    it('registers beforeunload and pagehide event listeners', () => {
      initFlushOnClose();

      expect(addEventListenerSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function));
      expect(addEventListenerSpy).toHaveBeenCalledWith('pagehide', expect.any(Function));
    });

    it('registers visibilitychange listener on document', () => {
      initFlushOnClose();

      expect(document.addEventListener).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
    });

    it('does not register twice on repeated calls', () => {
      initFlushOnClose();
      const callCount = addEventListenerSpy.mock.calls.length;

      initFlushOnClose();

      expect(addEventListenerSpy.mock.calls.length).toBe(callCount);
    });
  });

  describe('cleanupFlushOnClose', () => {
    it('removes event listeners', () => {
      initFlushOnClose();
      cleanupFlushOnClose();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function));
      expect(document.removeEventListener).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
    });

    it('does nothing if not initialized', () => {
      cleanupFlushOnClose();
      expect(removeEventListenerSpy).not.toHaveBeenCalled();
    });

    it('allows re-initialization after cleanup', () => {
      initFlushOnClose();
      cleanupFlushOnClose();

      vi.clearAllMocks();
      initFlushOnClose();

      expect(addEventListenerSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function));
    });
  });
});
