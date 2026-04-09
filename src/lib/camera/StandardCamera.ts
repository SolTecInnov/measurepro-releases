import type {
  ICamera,
  CameraCapabilities,
  CameraSettings,
  RGBFrame,
} from './CameraInterface';
import { auditLog } from '@/lib/auditLog';
import { getCurrentUser } from '@/lib/firebase';

/**
 * Standard Camera Implementation
 * Uses browser MediaStream API for standard webcams
 */
export class StandardCamera implements ICamera {
  readonly type = 'standard' as const;
  private stream: MediaStream | null = null;
  private video: HTMLVideoElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private context: CanvasRenderingContext2D | null = null;
  private settings: CameraSettings;
  private streaming: boolean = false;
  private streamCallback: ((frame: RGBFrame) => void) | null = null;
  private streamAnimationFrame: number | null = null;
  private lastError: Error | null = null;
  private initialized: boolean = false;
  private onDisconnect: (() => void) | null = null;
  private isIntentionalShutdown: boolean = false;
  private deviceId: string | undefined;

  readonly capabilities: CameraCapabilities = {
    hasDepth: false,
    hasRGB: true,
    hasStereo: false,
    maxResolution: { width: 1920, height: 1080 },
    supportsAutoExposure: true,
    supportsAutoFocus: true,
    supportedFormats: ['rgba', 'jpeg', 'png'],
  };

  constructor(options?: { onDisconnect?: () => void; deviceId?: string }) {
    this.settings = {
      resolution: { width: 1280, height: 720 },
      fps: 30,
      autoExposure: true,
      autoFocus: true,
    };
    this.onDisconnect = options?.onDisconnect || null;
    this.deviceId = options?.deviceId;
  }

  async initialize(settings?: Partial<CameraSettings>): Promise<void> {
    try {
      
      if (settings) {
        this.settings = { ...this.settings, ...settings };
      }

      // Create video element
      this.video = document.createElement('video');
      this.video.setAttribute('playsinline', ''); // Important for iOS
      
      // Create canvas for frame capture
      this.canvas = document.createElement('canvas');
      this.context = this.canvas.getContext('2d');
      
      if (!this.context) {
        throw new Error('Failed to get 2D context from canvas');
      }

      // Request camera access with flexible constraints
      // Try with facingMode first (mobile cameras), then fallback without it (GoPro, external cameras)
      let constraints: MediaStreamConstraints = {
        video: {
          deviceId: this.deviceId ? { exact: this.deviceId } : undefined,
          width: { ideal: this.settings.resolution.width },
          height: { ideal: this.settings.resolution.height },
          frameRate: { ideal: this.settings.fps },
          facingMode: this.deviceId ? undefined : 'environment', // Only use facingMode if no specific device selected
        },
      };

      try {
        this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (facingModeError: any) {
        // If facingMode fails (common with GoPro/external cameras), try without it
        constraints = {
          video: {
            deviceId: this.deviceId ? { exact: this.deviceId } : undefined,
            width: { ideal: this.settings.resolution.width },
            height: { ideal: this.settings.resolution.height },
            frameRate: { ideal: this.settings.fps },
          },
        };
        this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      }
      this.video.srcObject = this.stream;

      // Audit: camera connected
      try {
        const u = getCurrentUser();
        if (u) auditLog.hardwareConnect(u.uid, u.email || '', 'camera', 'Camera', true, 'browser');
      } catch (_e) {}
      
      // Monitor all tracks for disconnect
      this.stream.getTracks().forEach(track => {
        track.addEventListener('ended', () => {
          const wasInitialized = this.initialized;
          this.initialized = false;
          
          // Only call disconnect callback if this was unexpected
          if (!this.isIntentionalShutdown && wasInitialized && this.onDisconnect) {
            this.onDisconnect();
          }
        });
      });
      
      // Wait for video to load
      await new Promise((resolve, reject) => {
        if (!this.video) {
          reject(new Error('Video element not initialized'));
          return;
        }
        this.video.onloadedmetadata = () => {
          this.video!.play();
          resolve(null);
        };
        this.video.onerror = () => {
          reject(new Error('Failed to load video metadata'));
        };
      });

      // Update canvas size to match video
      if (this.video) {
        this.canvas.width = this.video.videoWidth;
        this.canvas.height = this.video.videoHeight;
      }

      this.initialized = true;
    } catch (error: any) {
      this.lastError = error;
      this.initialized = false;
      
      // Provide helpful error messages
      let errorMessage = `Failed to initialize camera: ${error.message}`;
      
      if (error.name === 'NotAllowedError') {
        errorMessage = 'Camera access denied. Please allow camera permissions in your browser.';
      } else if (error.name === 'NotFoundError') {
        errorMessage = 'No camera found. Please connect a camera and try again.';
      } else if (error.name === 'NotReadableError') {
        errorMessage = 'Camera is in use by another application. Close other apps using the camera and try again.';
      } else if (error.name === 'OverconstrainedError') {
        errorMessage = 'Camera does not support the requested settings. Try different resolution settings.';
      }
      
      throw new Error(errorMessage);
    }
  }

  async shutdown(): Promise<void> {
    try {
      // Mark this as an intentional shutdown
      this.isIntentionalShutdown = true;

      // Audit: camera disconnected
      try {
        const u = getCurrentUser();
        if (u) auditLog.hardwareConnect(u.uid, u.email || '', 'camera', 'Camera', false, 'browser');
      } catch (_e) {}

      this.stopStream();
      
      if (this.stream) {
        this.stream.getTracks().forEach(track => track.stop());
        this.stream = null;
      }

      if (this.video) {
        this.video.srcObject = null;
        this.video = null;
      }

      this.canvas = null;
      this.context = null;
      this.initialized = false;
      
      // Reset shutdown flag after a delay
      setTimeout(() => {
        this.isIntentionalShutdown = false;
      }, 100);
    } catch (error: any) {
      this.lastError = error;
      throw new Error(`Failed to shutdown camera: ${error.message}`);
    }
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  getSettings(): CameraSettings {
    return { ...this.settings };
  }

  async updateSettings(settings: Partial<CameraSettings>): Promise<void> {
    try {
      this.settings = { ...this.settings, ...settings };
      
      // If resolution changed, need to reinitialize
      if (settings.resolution) {
        const wasStreaming = this.streaming;
        const callback = this.streamCallback;
        
        await this.shutdown();
        await this.initialize(this.settings);
        
        if (wasStreaming && callback) {
          await this.startStream(callback);
        }
      }
    } catch (error: any) {
      this.lastError = error;
      throw new Error(`Failed to update settings: ${error.message}`);
    }
  }

  async captureRGBFrame(): Promise<RGBFrame> {
    if (!this.initialized || !this.video || !this.canvas || !this.context) {
      throw new Error('Camera not initialized');
    }

    try {
      // Draw current video frame to canvas
      this.context.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
      
      // Get image data
      const imageData = this.context.getImageData(0, 0, this.canvas.width, this.canvas.height);
      
      return {
        imageData,
        width: this.canvas.width,
        height: this.canvas.height,
        timestamp: Date.now(),
        format: 'rgba',
      };
    } catch (error: any) {
      this.lastError = error;
      throw new Error(`Failed to capture frame: ${error.message}`);
    }
  }

  async startStream(onFrame: (frame: RGBFrame) => void): Promise<void> {
    if (!this.initialized) {
      throw new Error('Camera not initialized');
    }

    if (this.streaming) {
      throw new Error('Stream already running');
    }

    this.streaming = true;
    this.streamCallback = onFrame;

    const captureLoop = async () => {
      if (!this.streaming) return;

      try {
        const frame = await this.captureRGBFrame();
        if (this.streamCallback) {
          this.streamCallback(frame);
        }
      } catch (error) {
      }

      if (this.streaming) {
        this.streamAnimationFrame = requestAnimationFrame(captureLoop);
      }
    };

    captureLoop();
  }

  async stopStream(): Promise<void> {
    this.streaming = false;
    this.streamCallback = null;
    
    if (this.streamAnimationFrame !== null) {
      cancelAnimationFrame(this.streamAnimationFrame);
      this.streamAnimationFrame = null;
    }
  }

  isStreaming(): boolean {
    return this.streaming;
  }

  getLastError(): Error | null {
    return this.lastError;
  }

  /**
   * Get the underlying MediaStream for direct video element usage
   * This is needed for LiveCamera to display the video feed
   */
  getMediaStream(): MediaStream | null {
    return this.stream;
  }
}
