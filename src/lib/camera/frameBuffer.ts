interface BufferedFrame {
  videoElement: HTMLVideoElement;
  timestamp: number;
  canvas: HTMLCanvasElement;
}

export class FrameBuffer {
  private buffer: BufferedFrame[] = [];
  private maxBufferSeconds: number = 10;
  private captureIntervalMs: number = 100;
  private intervalId: number | null = null;
  private isRunning: boolean = false;

  constructor(maxBufferSeconds: number = 10, captureIntervalMs: number = 333) {
    // PERF FIX: 333ms = ~3fps = 30 frames in 10s buffer
    // Was 100ms (10fps = 100 frames) — excessive for a rollback buffer
    this.maxBufferSeconds = maxBufferSeconds;
    this.captureIntervalMs = captureIntervalMs;
  }

  start(videoElement: HTMLVideoElement) {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    this.buffer = [];

    this.intervalId = window.setInterval(() => {
      this.captureFrame(videoElement);
    }, this.captureIntervalMs);
  }

  stop() {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    this.clearBuffer();
  }

  private captureFrame(videoElement: HTMLVideoElement) {
    if (!videoElement || videoElement.readyState < 2) {
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = videoElement.videoWidth || 1280;
    canvas.height = videoElement.videoHeight || 720;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      return;
    }

    ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

    const now = Date.now();
    this.buffer.push({
      videoElement,
      timestamp: now,
      canvas
    });

    const cutoffTime = now - (this.maxBufferSeconds * 1000);
    this.buffer = this.buffer.filter(frame => frame.timestamp >= cutoffTime);
  }

  getFrameAtOffset(offsetSeconds: number): HTMLCanvasElement | null {
    if (this.buffer.length === 0) {
      return null;
    }

    const targetTimestamp = Date.now() - (offsetSeconds * 1000);
    
    let closestFrame: BufferedFrame | null = null;
    let smallestDiff = Infinity;

    for (const frame of this.buffer) {
      const diff = Math.abs(frame.timestamp - targetTimestamp);
      if (diff < smallestDiff) {
        smallestDiff = diff;
        closestFrame = frame;
      }
    }

    return closestFrame ? closestFrame.canvas : null;
  }

  getCurrentFrame(): HTMLCanvasElement | null {
    if (this.buffer.length === 0) {
      return null;
    }
    return this.buffer[this.buffer.length - 1].canvas;
  }

  private clearBuffer() {
    this.buffer = [];
  }

  getBufferStats() {
    return {
      frameCount: this.buffer.length,
      oldestFrameAge: this.buffer.length > 0 
        ? (Date.now() - this.buffer[0].timestamp) / 1000 
        : 0,
      isRunning: this.isRunning
    };
  }
}

export const frameBuffer = new FrameBuffer();
