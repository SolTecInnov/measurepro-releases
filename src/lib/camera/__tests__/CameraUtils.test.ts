import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.stubGlobal('navigator', {
  permissions: {
    query: vi.fn(),
  },
  mediaDevices: {
    getUserMedia: vi.fn(),
  },
});

import {
  safelyStopStream,
  checkCameraPermission,
  getWebcamErrorMessage,
  forceRequestCameraPermission,
} from '../CameraUtils';

describe('CameraUtils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('safelyStopStream', () => {
    it('stops all tracks in a stream', () => {
      const stopFn1 = vi.fn();
      const stopFn2 = vi.fn();
      const stream = {
        getTracks: () => [{ stop: stopFn1 }, { stop: stopFn2 }],
      } as any;

      safelyStopStream(stream);

      expect(stopFn1).toHaveBeenCalled();
      expect(stopFn2).toHaveBeenCalled();
    });

    it('handles null stream gracefully', () => {
      expect(() => safelyStopStream(null)).not.toThrow();
    });

    it('handles track.stop() throwing', () => {
      const stream = {
        getTracks: () => [
          { stop: () => { throw new Error('fail'); } },
          { stop: vi.fn() },
        ],
      } as any;

      expect(() => safelyStopStream(stream)).not.toThrow();
    });

    it('handles getTracks() throwing', () => {
      const stream = {
        getTracks: () => { throw new Error('fail'); },
      } as any;

      expect(() => safelyStopStream(stream)).not.toThrow();
    });
  });

  describe('checkCameraPermission', () => {
    it('returns granted when permissions API reports granted', async () => {
      vi.mocked(navigator.permissions.query).mockResolvedValue({ state: 'granted' } as any);

      const result = await checkCameraPermission();
      expect(result).toBe('granted');
    });

    it('returns denied when permissions API reports denied', async () => {
      vi.mocked(navigator.permissions.query).mockResolvedValue({ state: 'denied' } as any);

      const result = await checkCameraPermission();
      expect(result).toBe('denied');
    });

    it('returns prompt when permissions API reports prompt', async () => {
      vi.mocked(navigator.permissions.query).mockResolvedValue({ state: 'prompt' } as any);

      const result = await checkCameraPermission();
      expect(result).toBe('prompt');
    });

    it('returns unknown when permissions.query throws', async () => {
      vi.mocked(navigator.permissions.query).mockRejectedValue(new Error('not supported'));

      const result = await checkCameraPermission();
      expect(result).toBe('unknown');
    });

    it('returns unknown when permissions API is unavailable', async () => {
      const origPerms = navigator.permissions;
      Object.defineProperty(navigator, 'permissions', { value: undefined, configurable: true });

      const result = await checkCameraPermission();
      expect(result).toBe('unknown');

      Object.defineProperty(navigator, 'permissions', { value: origPerms, configurable: true });
    });
  });

  describe('getWebcamErrorMessage', () => {
    it('returns generic message for null error', () => {
      expect(getWebcamErrorMessage(null)).toContain('Unknown camera error');
    });

    it('returns specific message for video source error', () => {
      const msg = getWebcamErrorMessage({ message: 'Could not start video source' });
      expect(msg).toContain('no other applications');
    });

    it('returns specific message for Permission denied', () => {
      const msg = getWebcamErrorMessage({ message: 'Permission denied' });
      expect(msg).toContain('denied or dismissed');
    });

    it('returns specific message for NotFoundError', () => {
      const msg = getWebcamErrorMessage({ message: 'NotFoundError' });
      expect(msg).toContain('No camera detected');
    });

    it('returns specific message for NotReadableError', () => {
      const msg = getWebcamErrorMessage({ message: 'NotReadableError' });
      expect(msg).toContain('in use by another application');
    });

    it('returns specific message for OverconstrainedError', () => {
      const msg = getWebcamErrorMessage({ message: 'OverconstrainedError' });
      expect(msg).toContain('resolution');
    });

    it('returns specific message for AbortError', () => {
      const msg = getWebcamErrorMessage({ message: 'AbortError' });
      expect(msg).toContain('aborted');
    });

    it('returns specific message for SecurityError', () => {
      const msg = getWebcamErrorMessage({ message: 'SecurityError' });
      expect(msg).toContain('security restrictions');
    });

    it('returns specific message for TypeError', () => {
      const msg = getWebcamErrorMessage({ message: 'TypeError' });
      expect(msg).toContain('Invalid camera configuration');
    });

    it('returns default message for unknown error', () => {
      const msg = getWebcamErrorMessage({ message: 'some weird error' });
      expect(msg).toContain('Camera error:');
      expect(msg).toContain('some weird error');
    });

    it('uses error.name when message is missing', () => {
      const msg = getWebcamErrorMessage({ name: 'NotFoundError' });
      expect(msg).toContain('No camera detected');
    });
  });

  describe('forceRequestCameraPermission', () => {
    it('returns true when getUserMedia succeeds', async () => {
      const stopFn = vi.fn();
      vi.mocked(navigator.mediaDevices.getUserMedia).mockResolvedValue({
        getTracks: () => [{ stop: stopFn }],
      } as any);

      const result = await forceRequestCameraPermission();
      expect(result).toBe(true);
      expect(stopFn).toHaveBeenCalled();
    });

    it('returns false when getUserMedia fails', async () => {
      vi.mocked(navigator.mediaDevices.getUserMedia).mockRejectedValue(new Error('denied'));

      const result = await forceRequestCameraPermission();
      expect(result).toBe(false);
    });
  });
});
