import type {
  ICamera,
  CameraCapabilities,
  CameraSettings,
  RGBFrame,
  DepthData,
  StereoFrame,
  ClearanceMeasurement,
} from './CameraInterface';

/**
 * ZED 2i Camera Implementation
 * 
 * INTEGRATION REQUIREMENTS:
 * =======================
 * The ZED 2i stereo camera requires the ZED SDK (C++ library) which cannot run directly
 * in the browser. This implementation connects to a local WebSocket server that has the
 * ZED SDK installed and provides camera data.
 * 
 * SETUP INSTRUCTIONS:
 * ==================
 * 1. Install ZED SDK on the system (https://www.stereolabs.com/developers/release/)
 * 2. Create a WebSocket server (Node.js/Python/C++) that:
 *    - Initializes ZED camera using SDK
 *    - Captures RGB frames, depth maps, and stereo pairs
 *    - Serves data over WebSocket at ws://localhost:8765
 * 3. Configure environment variable: VITE_ZED2I_SERVER_URL=ws://localhost:8765
 * 
 * WEBSOCKET PROTOCOL:
 * ==================
 * Commands (Client → Server):
 * - { "cmd": "initialize", "settings": {...} }
 * - { "cmd": "capture_rgb" }
 * - { "cmd": "capture_depth" }
 * - { "cmd": "capture_stereo" }
 * - { "cmd": "measure_clearance", "vehicleProfile": {...} }
 * - { "cmd": "start_stream" }
 * - { "cmd": "stop_stream" }
 * - { "cmd": "shutdown" }
 * 
 * Responses (Server → Client):
 * - { "type": "initialized", "capabilities": {...} }
 * - { "type": "rgb_frame", "data": {...} }
 * - { "type": "depth_frame", "data": {...} }
 * - { "type": "stereo_frame", "data": {...} }
 * - { "type": "clearance", "data": {...} }
 * - { "type": "stream_frame", "data": {...} }
 * - { "type": "error", "message": "..." }
 * 
 * CAMERA MOUNTING:
 * ===============
 * - Mount ZED 2i camera FORWARD-POINTING on vehicle
 * - Angle camera 15-30° UPWARD from horizontal
 * - This provides advance detection of overhead obstacles
 * - Clearance measurements are calculated from camera to detected objects
 * 
 * SDK REFERENCE:
 * =============
 * - ZED SDK Documentation: https://www.stereolabs.com/docs/
 * - API Reference: https://www.stereolabs.com/docs/api/
 * - Depth Sensing: https://www.stereolabs.com/docs/depth-sensing/
 */

const ZED2I_SERVER_URL = import.meta.env.VITE_ZED2I_SERVER_URL || 'ws://localhost:8765';

/**
 * ZED 2i Operating Modes
 */
type ZED2iMode = 'premium' | 'usb';

export class ZED2iCamera implements ICamera {
  readonly type = 'zed2i' as const;
  
  // Premium mode (WebSocket + ZED SDK)
  private ws: WebSocket | null = null;
  
  // USB fallback mode (standard camera)
  private stream: MediaStream | null = null;
  private mode: ZED2iMode = 'usb'; // Default to USB mode
  private selectedCamera: 'left' | 'right' = 'left'; // Left or right camera
  
  // Common properties
  private settings: CameraSettings;
  private streaming: boolean = false;
  private streamCallback: ((frame: RGBFrame) => void) | null = null;
  private lastError: Error | null = null;
  private initialized: boolean = false;
  private pendingRequests: Map<string, {
    resolve: (value: any) => void;
    reject: (error: Error) => void;
  }> = new Map();
  private onDisconnect: (() => void) | null = null;
  private isIntentionalShutdown: boolean = false;

  // Capabilities change based on mode
  capabilities: CameraCapabilities = {
    hasDepth: false, // Only in premium mode
    hasRGB: true,
    hasStereo: false, // Only in premium mode
    maxResolution: { width: 2208, height: 1242 }, // ZED 2i max resolution
    supportsAutoExposure: true,
    supportsAutoFocus: false, // ZED 2i has fixed focus
    supportedFormats: ['rgba', 'jpeg'],
  };

  constructor(options?: { onDisconnect?: () => void }) {
    this.settings = {
      resolution: { width: 1280, height: 720 },
      fps: 30,
      autoExposure: true,
      autoFocus: false,
      depthMode: 'quality', // ZED 2i specific
      depthRange: { min: 0.3, max: 20.0 }, // ZED 2i range: 0.3m - 20m
    };
    this.onDisconnect = options?.onDisconnect || null;
  }

  async initialize(settings?: Partial<CameraSettings>): Promise<void> {
    try {
      if (settings) {
        this.settings = { ...this.settings, ...settings };
      }

      // STEP 1: Try to connect to WebSocket server (Premium Mode)
      const premiumSuccess = await this.tryPremiumMode();
      
      if (premiumSuccess) {
        // Premium mode successful
        this.mode = 'premium';
        this.capabilities = {
          hasDepth: true,
          hasRGB: true,
          hasStereo: true,
          maxResolution: { width: 2208, height: 1242 },
          supportsAutoExposure: true,
          supportsAutoFocus: false,
          supportedFormats: ['rgba', 'jpeg', 'depth16', 'depth32f'],
        };
        
        this.initialized = true;
        return;
      }

      // STEP 2: Fall back to USB mode (Standard Camera)
      await this.tryUSBMode();
      
      this.mode = 'usb';
      this.capabilities = {
        hasDepth: false,
        hasRGB: true,
        hasStereo: false,
        maxResolution: { width: 2208, height: 1242 },
        supportsAutoExposure: true,
        supportsAutoFocus: false,
        supportedFormats: ['rgba', 'jpeg'],
      };
      
      this.initialized = true;
      
    } catch (error: any) {
      this.lastError = error;
      this.initialized = false;
      throw new Error(`Failed to initialize ZED 2i camera: ${error.message}`);
    }
  }

  /**
   * Try to initialize in Premium mode (WebSocket + ZED SDK)
   */
  private async tryPremiumMode(): Promise<boolean> {
    try {
      // Connect to ZED SDK server
      this.ws = new WebSocket(ZED2I_SERVER_URL);

      await new Promise((resolve, reject) => {
        if (!this.ws) {
          reject(new Error('WebSocket not created'));
          return;
        }

        this.ws.onopen = () => resolve(null);
        this.ws.onerror = () => reject(new Error('Failed to connect to ZED 2i server'));
        
        setTimeout(() => {
          reject(new Error('Connection timeout'));
        }, 2000); // Shorter timeout for fallback
      });

      // Set up message handler
      this.ws!.onmessage = this.handleMessage.bind(this);
      this.ws!.onerror = (error) => {
        this.lastError = new Error('ZED 2i connection error');
      };
      this.ws!.onclose = () => {
        const wasInitialized = this.initialized;
        this.initialized = false;
        
        // Only call disconnect callback if this was an unexpected disconnect
        if (!this.isIntentionalShutdown && wasInitialized && this.onDisconnect) {
          this.onDisconnect();
        }
        
        // Reset shutdown flag
        this.isIntentionalShutdown = false;
      };

      // Initialize camera on server
      const response = await this.sendCommand('initialize', {
        settings: this.settings,
      });

      if (response.success) {
        return true;
      } else {
        throw new Error(response.error || 'Initialization failed');
      }
    } catch (error: any) {
      // Clean up failed WebSocket connection
      if (this.ws) {
        this.ws.close();
        this.ws = null;
      }
      return false;
    }
  }

  /**
   * Try to initialize in USB mode (standard camera via MediaStream API)
   */
  private async tryUSBMode(): Promise<void> {
    try {
      // Enumerate cameras to find ZED 2i
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(d => d.kind === 'videoinput');
      
      // ZED 2i appears as 2 separate cameras: "ZED 2i Left" and "ZED 2i Right"
      const zedCameras = videoDevices.filter(d => 
        d.label.toLowerCase().includes('zed') ||
        d.label.toLowerCase().includes('stereo')
      );

      // Select left or right camera
      let selectedDevice: MediaDeviceInfo | undefined;
      
      if (this.selectedCamera === 'left') {
        // Try to find left camera
        selectedDevice = zedCameras.find(d => 
          d.label.toLowerCase().includes('left') ||
          d.label.toLowerCase().includes('0')
        ) || zedCameras[0];
      } else {
        // Try to find right camera
        selectedDevice = zedCameras.find(d => 
          d.label.toLowerCase().includes('right') ||
          d.label.toLowerCase().includes('1')
        ) || zedCameras[1] || zedCameras[0];
      }

      // If no ZED cameras found, use first available camera
      if (!selectedDevice) {
        selectedDevice = videoDevices[0];
      }

      if (!selectedDevice) {
        throw new Error('No cameras found');
      }

      // Open camera stream
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: { exact: selectedDevice.deviceId },
          width: { ideal: this.settings.resolution.width },
          height: { ideal: this.settings.resolution.height },
        }
      });

    } catch (error: any) {
      throw new Error(`Failed to open USB camera: ${error.message}`);
    }
  }

  async shutdown(): Promise<void> {
    try {
      // Mark this as an intentional shutdown
      this.isIntentionalShutdown = true;
      
      await this.stopStream();
      
      // Shutdown based on mode
      if (this.mode === 'premium' && this.ws) {
        await this.sendCommand('shutdown', {});
        this.ws.close();
        this.ws = null;
      } else if (this.mode === 'usb' && this.stream) {
        // Stop USB camera stream
        this.stream.getTracks().forEach(track => track.stop());
        this.stream = null;
      }

      this.initialized = false;
    } catch (error: any) {
      this.lastError = error;
      throw new Error(`Failed to shutdown ZED 2i: ${error.message}`);
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
      
      // Only send to server in premium mode
      if (this.mode === 'premium') {
        await this.sendCommand('update_settings', { settings: this.settings });
      }
      // In USB mode, settings are applied on next initialization
    } catch (error: any) {
      this.lastError = error;
      throw new Error(`Failed to update settings: ${error.message}`);
    }
  }

  /**
   * Get MediaStream for USB mode (for LiveCamera component)
   */
  getMediaStream(): MediaStream | null {
    if (this.mode === 'usb') {
      return this.stream;
    }
    return null;
  }

  /**
   * Set camera selection (left or right)
   * Only applies in USB mode. Call before initialize().
   */
  setCameraSelection(camera: 'left' | 'right'): void {
    this.selectedCamera = camera;
  }

  /**
   * Get current operating mode
   */
  getMode(): ZED2iMode {
    return this.mode;
  }

  /**
   * Check if premium features are available
   */
  hasPremiumFeatures(): boolean {
    return this.mode === 'premium';
  }

  getSelectedCamera(): 'left' | 'right' {
    return this.selectedCamera;
  }

  async captureRGBFrame(): Promise<RGBFrame> {
    if (!this.initialized) {
      throw new Error('ZED 2i not initialized');
    }

    try {
      if (this.mode === 'premium') {
        // Use WebSocket server for premium mode
        const response = await this.sendCommand('capture_rgb', {});
        return response.frame;
      } else {
        // Use MediaStream for USB mode
        if (!this.stream) {
          throw new Error('No active camera stream');
        }

        // Capture frame from video stream
        const videoTrack = this.stream.getVideoTracks()[0];
        if (!videoTrack) {
          throw new Error('No video track available');
        }

        // Create ImageCapture API to get frame
        const imageCapture = new (window as any).ImageCapture(videoTrack);
        const bitmap = await imageCapture.grabFrame();

        // Convert to canvas and get Blob
        const canvas = document.createElement('canvas');
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          throw new Error('Failed to get canvas context');
        }
        ctx.drawImage(bitmap, 0, 0);

        // Convert to Blob
        const blob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob((blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Failed to create blob'));
            }
          }, 'image/jpeg', 0.85);
        });

        return {
          imageData: blob,
          width: bitmap.width,
          height: bitmap.height,
          timestamp: Date.now(),
          format: 'jpeg',
        };
      }
    } catch (error: any) {
      this.lastError = error;
      throw new Error(`Failed to capture RGB frame: ${error.message}`);
    }
  }

  async captureDepthFrame(): Promise<DepthData> {
    if (!this.initialized) {
      throw new Error('ZED 2i not initialized');
    }

    if (this.mode === 'usb') {
      throw new Error('Depth sensing not available in USB mode. Start ZED WebSocket server for premium features.');
    }

    try {
      const response = await this.sendCommand('capture_depth', {});
      return response.depth;
    } catch (error: any) {
      this.lastError = error;
      throw new Error(`Failed to capture depth frame: ${error.message}`);
    }
  }

  async captureStereoFrame(): Promise<StereoFrame> {
    if (!this.initialized) {
      throw new Error('ZED 2i not initialized');
    }

    if (this.mode === 'usb') {
      throw new Error('Stereo capture not available in USB mode. Start ZED WebSocket server for premium features.');
    }

    try {
      const response = await this.sendCommand('capture_stereo', {});
      return response.stereo;
    } catch (error: any) {
      this.lastError = error;
      throw new Error(`Failed to capture stereo frame: ${error.message}`);
    }
  }

  async measureClearance(vehicleProfile: {
    width: number;
    height: number;
    length: number;
  }): Promise<ClearanceMeasurement> {
    if (!this.initialized) {
      throw new Error('ZED 2i not initialized');
    }

    if (this.mode === 'usb') {
      throw new Error('Clearance measurement requires depth sensing. Start ZED WebSocket server for premium features.');
    }

    try {
      const response = await this.sendCommand('measure_clearance', { vehicleProfile });
      return response.clearance;
    } catch (error: any) {
      this.lastError = error;
      throw new Error(`Failed to measure clearance: ${error.message}`);
    }
  }

  async startStream(onFrame: (frame: RGBFrame) => void): Promise<void> {
    if (!this.initialized) {
      throw new Error('ZED 2i not initialized');
    }

    if (this.streaming) {
      throw new Error('Stream already running');
    }

    this.streaming = true;
    this.streamCallback = onFrame;
    await this.sendCommand('start_stream', {});
  }

  async stopStream(): Promise<void> {
    if (!this.streaming) return;

    this.streaming = false;
    this.streamCallback = null;
    await this.sendCommand('stop_stream', {});
  }

  isStreaming(): boolean {
    return this.streaming;
  }

  getLastError(): Error | null {
    return this.lastError;
  }

  // Private methods

  private handleMessage(event: MessageEvent): void {
    try {
      const message = JSON.parse(event.data);

      if (message.type === 'stream_frame' && this.streamCallback) {
        this.streamCallback(message.frame);
        return;
      }

      if (message.type === 'response' && message.requestId) {
        const pending = this.pendingRequests.get(message.requestId);
        if (pending) {
          if (message.success) {
            pending.resolve(message.data);
          } else {
            pending.reject(new Error(message.error || 'Request failed'));
          }
          this.pendingRequests.delete(message.requestId);
        }
      }

      if (message.type === 'error') {
        this.lastError = new Error(message.message);
      }
    } catch (error) {
    }
  }

  private sendCommand(cmd: string, params: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket not connected'));
        return;
      }

      const requestId = `${cmd}_${Date.now()}_${Math.random()}`;
      this.pendingRequests.set(requestId, { resolve, reject });

      this.ws.send(JSON.stringify({
        requestId,
        cmd,
        ...params,
      }));

      // Timeout after 10 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId);
          reject(new Error(`Command timeout: ${cmd}`));
        }
      }, 10000);
    });
  }
}

/**
 * Check if ZED 2i is available
 */
export async function isZED2iAvailable(): Promise<boolean> {
  try {
    const ws = new WebSocket(ZED2I_SERVER_URL);
    
    const isAvailable = await new Promise<boolean>((resolve) => {
      ws.onopen = () => {
        ws.close();
        resolve(true);
      };
      ws.onerror = () => {
        resolve(false);
      };
      setTimeout(() => {
        ws.close();
        resolve(false);
      }, 2000);
    });

    return isAvailable;
  } catch (error) {
    return false;
  }
}
