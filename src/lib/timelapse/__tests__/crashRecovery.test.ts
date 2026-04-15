import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.hoisted(() => {
  (globalThis as any).localStorage = {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  };
  (globalThis as any).Audio = class MockAudio {
    src = ''; preload = 'auto'; volume = 1;
    play = vi.fn(() => Promise.resolve());
    pause = vi.fn(); remove = vi.fn(); addEventListener = vi.fn();
  };
  (globalThis as any).AudioContext = vi.fn(() => ({
    state: 'running', resume: vi.fn(() => Promise.resolve()),
    createBuffer: vi.fn(() => ({})),
    createBufferSource: vi.fn(() => ({ buffer: null, connect: vi.fn(), start: vi.fn() })),
    destination: {},
  }));
  if (typeof globalThis.document === 'undefined') {
    (globalThis as any).document = { addEventListener: vi.fn(), createElement: vi.fn(() => ({})), body: { appendChild: vi.fn() } };
  }
});

const mockGetAll = vi.fn();
const mockDelete = vi.fn();
const mockPut = vi.fn();
const mockObjectStoreNames = { contains: vi.fn(() => true) };
const mockDb = {
  getAll: mockGetAll,
  delete: mockDelete,
  put: mockPut,
  objectStoreNames: mockObjectStoreNames,
};

vi.mock('@/lib/survey/db', () => ({
  openSurveyDB: vi.fn(() => Promise.resolve(mockDb)),
}));

// Mock camera store
const mockClearTimelapseFrames = vi.fn();
const mockAddTimelapseFrame = vi.fn();

vi.mock('@/lib/camera', () => ({
  useCameraStore: {
    getState: () => ({
      clearTimelapseFrames: mockClearTimelapseFrames,
      addTimelapseFrame: mockAddTimelapseFrame,
    }),
  },
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import { checkForOrphanedFrames, clearOrphanedFrames, clearFramesAfterSave } from '../crashRecovery';

describe('crashRecovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAll.mockResolvedValue([]);
    mockDelete.mockResolvedValue(undefined);
    mockPut.mockResolvedValue(undefined);
    mockObjectStoreNames.contains.mockReturnValue(true);
  });

  describe('checkForOrphanedFrames', () => {
    it('does nothing when no frames exist', async () => {
      mockGetAll.mockResolvedValue([]);
      await checkForOrphanedFrames();
      expect(mockClearTimelapseFrames).not.toHaveBeenCalled();
      expect(mockAddTimelapseFrame).not.toHaveBeenCalled();
    });

    it('does nothing when frames store does not exist', async () => {
      mockObjectStoreNames.contains.mockReturnValue(false);
      await checkForOrphanedFrames();
      expect(mockGetAll).not.toHaveBeenCalled();
    });

    it('skips frames with saved status', async () => {
      mockGetAll.mockResolvedValue([
        { id: '1', timestamp: '2024-01-01T00:00:00Z', status: 'saved' },
      ]);
      await checkForOrphanedFrames();
      expect(mockClearTimelapseFrames).not.toHaveBeenCalled();
    });

    it('recovers unsaved frames in chronological order', async () => {
      const frames = [
        { id: '2', timestamp: '2024-01-01T01:00:00Z', status: 'pending' },
        { id: '1', timestamp: '2024-01-01T00:00:00Z', status: 'pending' },
      ];
      mockGetAll.mockResolvedValue(frames);

      await checkForOrphanedFrames();

      expect(mockClearTimelapseFrames).toHaveBeenCalledOnce();
      expect(mockAddTimelapseFrame).toHaveBeenCalledTimes(2);
      // First call should be the earlier timestamp (frame id '1')
      expect(mockAddTimelapseFrame.mock.calls[0][0].id).toBe('1');
      expect(mockAddTimelapseFrame.mock.calls[0][0].frameNumber).toBe(0);
      expect(mockAddTimelapseFrame.mock.calls[1][0].id).toBe('2');
      expect(mockAddTimelapseFrame.mock.calls[1][0].frameNumber).toBe(1);
    });

    it('handles errors gracefully', async () => {
      mockGetAll.mockRejectedValue(new Error('DB error'));
      // Should not throw
      await expect(checkForOrphanedFrames()).resolves.toBeUndefined();
    });
  });

  describe('clearOrphanedFrames', () => {
    it('deletes all frames', async () => {
      mockGetAll.mockResolvedValue([
        { id: 'a' },
        { id: 'b' },
      ]);

      await clearOrphanedFrames();

      expect(mockDelete).toHaveBeenCalledTimes(2);
      expect(mockDelete).toHaveBeenCalledWith('frames', 'a');
      expect(mockDelete).toHaveBeenCalledWith('frames', 'b');
    });

    it('handles errors and shows toast when not silent', async () => {
      mockGetAll.mockRejectedValue(new Error('fail'));
      const { toast } = await import('sonner');

      await clearOrphanedFrames(false);
      expect(toast.error).toHaveBeenCalled();
    });

    it('suppresses toast in silent mode', async () => {
      mockGetAll.mockRejectedValue(new Error('fail'));
      const { toast } = await import('sonner');

      await clearOrphanedFrames(true);
      expect(toast.error).not.toHaveBeenCalled();
    });
  });

  describe('clearFramesAfterSave', () => {
    it('marks frames as saved then deletes them', async () => {
      const frames = [
        { id: 'x', status: 'pending' },
        { id: 'y', status: 'pending' },
      ];
      mockGetAll.mockResolvedValue(frames);

      await clearFramesAfterSave();

      // put called for each frame (marking saved)
      expect(mockPut).toHaveBeenCalledTimes(2);
      expect(mockPut.mock.calls[0][1]).toMatchObject({ id: 'x', status: 'saved' });
      // delete called for each frame
      expect(mockDelete).toHaveBeenCalledTimes(2);
    });

    it('handles empty frames', async () => {
      mockGetAll.mockResolvedValue([]);
      await clearFramesAfterSave();
      expect(mockPut).not.toHaveBeenCalled();
      expect(mockDelete).not.toHaveBeenCalled();
    });

    it('handles errors gracefully', async () => {
      mockGetAll.mockRejectedValue(new Error('fail'));
      await expect(clearFramesAfterSave()).resolves.toBeUndefined();
    });
  });
});
