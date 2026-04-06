/**
 * Point Cloud Types for MeasurePRO 3D Scanning Add-on
 * 
 * STORAGE LIMITS:
 * - Basic Premium: 20MB
 * - Mid Premium: 50MB
 * - High Premium: 100MB
 * 
 * EXPORT FORMATS:
 * - PLY (ASCII/Binary)
 * - LAS 1.2 (Binary)
 * - PCD (Point Cloud Data)
 * - E57 (ASTM standard)
 */

export interface PointCloudPoint {
  x: number;
  y: number;
  z: number;
  r?: number;
  g?: number;
  b?: number;
  intensity?: number;
}

export interface PointCloudFrame {
  id: string;
  scanId: string;
  timestamp: number;
  points: Float32Array; // XYZ interleaved [x1,y1,z1, x2,y2,z2, ...]
  colors?: Uint8Array; // RGB interleaved [r1,g1,b1, r2,g2,b2, ...]
  gpsPosition: { lat: number; lon: number; alt: number };
  frameNumber: number;
  pointCount: number;
}

export interface PointCloudScan {
  id: string;
  name: string;
  surveyId?: string;
  startTime: number;
  endTime?: number;
  totalFrames: number;
  totalPoints: number;
  bounds: {
    min: { x: number; y: number; z: number };
    max: { x: number; y: number; z: number };
  };
  gpsCenter: { lat: number; lon: number; alt: number };
  status: 'recording' | 'completed' | 'processing' | 'error';
  storageSizeBytes: number;
}

export interface ExportJob {
  id: string;
  scanId: string;
  format: 'ply' | 'las' | 'pcd' | 'e57';
  status: 'queued' | 'processing' | 'completed' | 'error';
  progress: number;
  fileSizeBytes?: number;
  error?: string;
}

export interface CameraIntrinsics {
  fx: number;
  fy: number;
  cx: number;
  cy: number;
  width: number;
  height: number;
}

export interface CameraOrientation {
  roll: number;
  pitch: number;
  yaw: number;
}

export interface GPSPosition {
  lat: number;
  lon: number;
  alt: number;
  accuracy?: number;
  timestamp?: number;
}

export const DEFAULT_ZED2I_INTRINSICS: CameraIntrinsics = {
  fx: 700.0,
  fy: 700.0,
  cx: 640.0,
  cy: 360.0,
  width: 1280,
  height: 720,
};
