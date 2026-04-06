/**
 * Camera Interface - Unified abstraction for standard and ZED 2i cameras
 * 
 * This provides a consistent API for camera operations regardless of hardware type.
 * Implementations:
 * - StandardCamera: Browser MediaStream API for standard webcams
 * - ZED2iCamera: ZED SDK integration for stereo depth sensing
 */

export interface CameraCapabilities {
  hasDepth: boolean;
  hasRGB: boolean;
  hasStereo: boolean;
  maxResolution: { width: number; height: number };
  supportsAutoExposure: boolean;
  supportsAutoFocus: boolean;
  supportedFormats: string[];
}

export interface DepthData {
  data: Float32Array | Uint16Array; // Depth values in meters or millimeters
  width: number;
  height: number;
  timestamp: number;
  unit: 'meters' | 'millimeters';
  minRange: number; // Minimum reliable depth (m)
  maxRange: number; // Maximum reliable depth (m)
  confidence?: Uint8Array; // Optional confidence map (0-100 for each pixel)
}

export interface RGBFrame {
  imageData: ImageData | Blob;
  width: number;
  height: number;
  timestamp: number;
  format: 'rgba' | 'rgb' | 'jpeg' | 'png';
}

export interface StereoFrame {
  left: RGBFrame;
  right: RGBFrame;
  baseline: number; // Distance between cameras (mm)
  timestamp: number;
}

export interface CameraSettings {
  resolution: { width: number; height: number };
  fps: number;
  autoExposure: boolean;
  autoFocus: boolean;
  depthMode?: 'performance' | 'quality' | 'ultra'; // For ZED 2i
  depthRange?: { min: number; max: number }; // Depth sensing range (meters)
}

export interface ClearanceMeasurement {
  minClearance: number; // Minimum clearance detected (meters)
  clearanceZones: Array<{
    region: 'left' | 'center' | 'right' | 'overhead';
    clearance: number; // meters
    confidence: number; // 0-100
    position: { x: number; y: number; z: number }; // 3D position
  }>;
  vehicleEnvelope: {
    width: number; // meters
    height: number; // meters
    length: number; // meters
  };
  timestamp: number;
}

/**
 * Base camera interface that all camera implementations must follow
 */
export interface ICamera {
  // Camera identification
  readonly type: 'standard' | 'zed2i';
  readonly capabilities: CameraCapabilities;
  
  // Lifecycle
  initialize(settings?: Partial<CameraSettings>): Promise<void>;
  shutdown(): Promise<void>;
  isInitialized(): boolean;
  
  // Settings management
  getSettings(): CameraSettings;
  updateSettings(settings: Partial<CameraSettings>): Promise<void>;
  
  // Frame capture - All cameras must support RGB
  captureRGBFrame(): Promise<RGBFrame>;
  
  // Depth sensing - Only for depth-capable cameras (ZED 2i)
  captureDepthFrame?(): Promise<DepthData>;
  
  // Stereo capture - Only for stereo cameras (ZED 2i)
  captureStereoFrame?(): Promise<StereoFrame>;
  
  // Clearance measurement - High-level API for vehicle clearance
  measureClearance?(vehicleProfile: {
    width: number;
    height: number;
    length: number;
  }): Promise<ClearanceMeasurement>;
  
  // Stream support
  startStream(onFrame: (frame: RGBFrame) => void): Promise<void>;
  stopStream(): Promise<void>;
  isStreaming(): boolean;
  
  // Error handling
  getLastError(): Error | null;
}

/**
 * Factory function to create the appropriate camera instance
 */
export async function createCamera(
  preferredType?: 'standard' | 'zed2i',
  options?: {
    zedCameraSelection?: 'left' | 'right';
  }
): Promise<ICamera> {
  // Auto-detect available camera hardware
  if (preferredType === 'zed2i') {
    try {
      const { ZED2iCamera } = await import('./ZED2iCamera');
      const camera = new ZED2iCamera();
      
      // Set camera selection before initializing
      if (options?.zedCameraSelection) {
        (camera as any).setCameraSelection?.(options.zedCameraSelection);
      }
      
      await camera.initialize();
      return camera;
    } catch (error) {
    }
  }
  
  // Fallback to standard camera
  const { StandardCamera } = await import('./StandardCamera');
  const camera = new StandardCamera();
  await camera.initialize();
  return camera;
}

/**
 * Camera detector - Check what cameras are available
 */
export async function detectAvailableCameras(): Promise<{
  hasStandardCamera: boolean;
  hasZED2i: boolean;
  recommendedCamera: 'standard' | 'zed2i';
}> {
  let hasStandardCamera = false;
  let hasZED2i = false;
  
  // Check standard camera (MediaStream)
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    hasStandardCamera = devices.some(device => device.kind === 'videoinput');
  } catch (error) {
  }
  
  // Check ZED 2i (SDK presence)
  try {
    const { isZED2iAvailable } = await import('./ZED2iCamera');
    hasZED2i = await isZED2iAvailable();
  } catch (error) {
    hasZED2i = false;
  }
  
  return {
    hasStandardCamera,
    hasZED2i,
    recommendedCamera: hasZED2i ? 'zed2i' : 'standard',
  };
}

/**
 * Clearance alert thresholds
 */
export interface ClearanceThresholds {
  critical: number; // meters - immediate danger
  warning: number;  // meters - caution needed
  safe: number;     // meters - normal operation
}

export const DEFAULT_CLEARANCE_THRESHOLDS: ClearanceThresholds = {
  critical: 0.3,  // 30cm or less - STOP
  warning: 0.6,   // 60cm - slow down
  safe: 1.0,      // 1m+ - normal
};
