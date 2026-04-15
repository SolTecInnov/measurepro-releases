import { describe, it, expect, vi, beforeEach } from 'vitest';

// Stub browser globals before imports
vi.stubGlobal('window', {
  ...globalThis,
  requestIdleCallback: (cb: () => void) => { setTimeout(cb, 0); return 0; },
  localStorage: {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
  setTimeout: globalThis.setTimeout,
  clearTimeout: globalThis.clearTimeout,
});

vi.stubGlobal('localStorage', {
  getItem: vi.fn(() => null),
  setItem: vi.fn(),
  removeItem: vi.fn(),
});

vi.stubGlobal('crypto', {
  randomUUID: vi.fn(() => 'test-uuid-' + Math.random().toString(36).slice(2, 8)),
});

vi.stubGlobal('performance', {
  now: vi.fn(() => Date.now()),
});

vi.stubGlobal('requestIdleCallback', (cb: () => void) => {
  setTimeout(cb, 0);
  return 0;
});

// Mock the capture module
vi.mock('../capture', () => ({
  captureFrameWithOverlay: vi.fn(async () => ({
    dataUrl: 'data:image/jpeg;base64,test',
    blob: new Blob(['test'], { type: 'image/jpeg' }),
  })),
  captureBufferedFrameWithOverlay: vi.fn(async () => ({
    dataUrl: 'data:image/jpeg;base64,buffered',
    blob: new Blob(['buffered'], { type: 'image/jpeg' }),
  })),
}));

// Mock the logger
vi.mock('@/lib/utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// We need to import the class, not the singleton, so let's test via a fresh module
// Actually, the module exports a singleton. We'll work with it.
// To get fresh instances, we re-import per test.

import { captureFrameWithOverlay, captureBufferedFrameWithOverlay } from '../capture';

// Manually create a CaptureQueue class to test without the singleton issue.
// Since the module only exports the singleton, we'll test through it after clearing.

describe('CaptureQueue', () => {
  // We dynamically import to get the singleton each time
  let captureQueue: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    // Reset module to get a fresh singleton
    vi.resetModules();
    // Re-apply stubs after reset
    vi.stubGlobal('window', {
      ...globalThis,
      requestIdleCallback: (cb: () => void) => { setTimeout(cb, 0); return 0; },
      localStorage: {
        getItem: vi.fn(() => null),
        setItem: vi.fn(),
        removeItem: vi.fn(),
      },
      setTimeout: globalThis.setTimeout,
      clearTimeout: globalThis.clearTimeout,
    });
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    });
    vi.stubGlobal('crypto', {
      randomUUID: vi.fn(() => 'test-uuid-' + Math.random().toString(36).slice(2, 8)),
    });
    vi.stubGlobal('performance', {
      now: vi.fn(() => Date.now()),
    });
    vi.stubGlobal('requestIdleCallback', (cb: () => void) => {
      setTimeout(cb, 0);
      return 0;
    });
    const mod = await import('../captureQueue');
    captureQueue = mod.captureQueue;
  });

  describe('queueCapture', () => {
    it('processes a single capture and resolves', async () => {
      const mockVideo = {} as HTMLVideoElement;
      const overlayData = {};
      const overlayOptions = {};

      const result = await captureQueue.queueCapture(
        mockVideo,
        overlayData,
        overlayOptions,
        'image/jpeg'
      );

      expect(result).toBeDefined();
      expect(result.dataUrl).toContain('data:image/jpeg');
    });

    it('processes multiple queued captures sequentially', async () => {
      const mockVideo = {} as HTMLVideoElement;
      const overlayData = {};
      const overlayOptions = {};

      const p1 = captureQueue.queueCapture(mockVideo, overlayData, overlayOptions);
      const p2 = captureQueue.queueCapture(mockVideo, overlayData, overlayOptions);

      const [r1, r2] = await Promise.all([p1, p2]);
      expect(r1.dataUrl).toBeDefined();
      expect(r2.dataUrl).toBeDefined();
    });
  });

  describe('queue size limit', () => {
    it('reports max queue size in stats', () => {
      const stats = captureQueue.getStats();
      expect(stats.maxQueueSize).toBe(50);
    });
  });

  describe('getStats', () => {
    it('returns queue stats', () => {
      const stats = captureQueue.getStats();
      expect(stats).toHaveProperty('queueSize');
      expect(stats).toHaveProperty('isProcessing');
      expect(stats).toHaveProperty('droppedCount');
      expect(stats).toHaveProperty('maxQueueSize', 50);
      expect(stats).toHaveProperty('utilizationPercent');
    });
  });

  describe('getQueueSize / isProcessing', () => {
    it('returns 0 when empty', () => {
      expect(captureQueue.getQueueSize()).toBe(0);
      expect(captureQueue.isProcessing()).toBe(false);
    });
  });

  describe('clearQueue', () => {
    it('rejects all pending items and empties the queue', async () => {
      const { captureFrameWithOverlay: mockCapture } = await import('../capture');
      vi.mocked(mockCapture).mockImplementation(
        () => new Promise(() => {}) // never resolves
      );

      const mockVideo = {} as HTMLVideoElement;
      const p1 = captureQueue.queueCapture(mockVideo, {}, {});
      const p2 = captureQueue.queueCapture(mockVideo, {}, {});

      // Give the queue time to start processing
      await new Promise((r) => setTimeout(r, 20));

      captureQueue.clearQueue();
      expect(captureQueue.getQueueSize()).toBe(0);

      // The promises should reject
      await expect(p2).rejects.toThrow('Queue cleared');
    });
  });

  describe('queueBufferedCapture', () => {
    it('processes buffered capture with delay', async () => {
      const result = await captureQueue.queueBufferedCapture(
        0.5,
        {},
        {},
        'image/jpeg'
      );
      expect(result).toBeDefined();
    });
  });
});
