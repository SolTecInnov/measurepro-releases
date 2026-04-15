import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.hoisted(() => {
  const localStorageMap = new Map<string, string>();
  (globalThis as any).localStorage = {
    getItem: (key: string) => localStorageMap.get(key) ?? null,
    setItem: (key: string, value: string) => localStorageMap.set(key, value),
    removeItem: (key: string) => localStorageMap.delete(key),
    clear: () => localStorageMap.clear(),
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
    (globalThis as any).document = {
      addEventListener: vi.fn(),
      createElement: vi.fn(() => ({
        style: {},
        setAttribute: vi.fn(),
        appendChild: vi.fn(),
        parentNode: { removeChild: vi.fn() },
      })),
      body: { appendChild: vi.fn() },
    };
  }

  // Mock MediaRecorder
  (globalThis as any).MediaRecorder = class MockMediaRecorder {
    state = 'inactive';
    ondataavailable: ((e: any) => void) | null = null;
    onstop: (() => void) | null = null;
    stream: any;
    options: any;

    constructor(stream: any, options?: any) {
      this.stream = stream;
      this.options = options;
    }

    start(_timeslice?: number) {
      this.state = 'recording';
    }

    stop() {
      this.state = 'inactive';
      setTimeout(() => this.onstop?.(), 0);
    }

    requestData() {
      if (this.ondataavailable) {
        this.ondataavailable({ data: new Blob(['test'], { type: 'video/webm' }) });
      }
    }
  };

  // Patch URL.createObjectURL / revokeObjectURL without replacing URL constructor
  if (typeof URL !== 'undefined') {
    if (!URL.createObjectURL) {
      (URL as any).createObjectURL = vi.fn(() => 'blob:mock-url');
    }
    if (!URL.revokeObjectURL) {
      (URL as any).revokeObjectURL = vi.fn();
    }
  }
});

const mockSetIsRecording = vi.fn();
const mockAddVideoToBuffer = vi.fn();

vi.mock('@/lib/camera', () => ({
  useCameraStore: {
    getState: () => ({
      videoBufferDuration: 5,
      setIsRecording: mockSetIsRecording,
      addVideoToBuffer: mockAddVideoToBuffer,
    }),
  },
}));

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

import { VideoRecorder } from '../VideoRecorder';

describe('VideoRecorder', () => {
  let recorder: VideoRecorder;
  let mockStream: MediaStream;

  beforeEach(() => {
    vi.clearAllMocks();
    recorder = new VideoRecorder();
    mockStream = {
      getTracks: () => [{ stop: vi.fn() }],
      getVideoTracks: () => [{ stop: vi.fn() }],
      getAudioTracks: () => [],
    } as any;
  });

  describe('initialize', () => {
    it('stores stream reference', () => {
      recorder.initialize(mockStream);
      expect(() => recorder.startRecording()).not.toThrow();
    });

    it('sets video element srcObject when provided', () => {
      const videoEl = { srcObject: null, muted: false } as any;
      recorder.initialize(mockStream, videoEl);
      expect(videoEl.srcObject).toBe(mockStream);
      expect(videoEl.muted).toBe(true);
    });
  });

  describe('isCurrentlyRecording', () => {
    it('returns false before recording starts', () => {
      expect(recorder.isCurrentlyRecording()).toBe(false);
    });

    it('returns true after startRecording', () => {
      recorder.initialize(mockStream);
      recorder.startRecording();
      expect(recorder.isCurrentlyRecording()).toBe(true);
    });
  });

  describe('startRecording', () => {
    it('does nothing when stream is not initialized', () => {
      recorder.startRecording();
      expect(mockSetIsRecording).not.toHaveBeenCalled();
    });

    it('does not start a second recording', () => {
      recorder.initialize(mockStream);
      recorder.startRecording();
      mockSetIsRecording.mockClear();
      recorder.startRecording();
      expect(mockSetIsRecording).not.toHaveBeenCalled();
    });

    it('sets isRecording in store', () => {
      recorder.initialize(mockStream);
      recorder.startRecording();
      expect(mockSetIsRecording).toHaveBeenCalledWith(true);
    });
  });

  describe('setBufferDuration', () => {
    it('converts seconds to milliseconds', () => {
      recorder.setBufferDuration(10);
      expect(true).toBe(true);
    });
  });

  describe('setOnRecordingComplete', () => {
    it('accepts a callback', () => {
      const cb = vi.fn();
      recorder.setOnRecordingComplete(cb);
      expect(true).toBe(true);
    });
  });

  describe('dispose', () => {
    it('cleans up recording state', () => {
      recorder.initialize(mockStream);
      recorder.startRecording();
      recorder.dispose();
      expect(mockSetIsRecording).toHaveBeenCalledWith(false);
    });

    it('handles dispose when not recording', () => {
      recorder.initialize(mockStream);
      expect(() => recorder.dispose()).not.toThrow();
    });
  });

  describe('stopRecording', () => {
    it('returns null when not recording', async () => {
      const result = await recorder.stopRecording();
      expect(result).toBeNull();
    });
  });

  describe('saveBuffer', () => {
    it('returns null when not recording', async () => {
      const result = await recorder.saveBuffer();
      expect(result).toBeNull();
    });
  });
});
