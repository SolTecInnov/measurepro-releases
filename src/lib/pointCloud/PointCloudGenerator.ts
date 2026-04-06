/**
 * Point Cloud Generator - Convert ZED 2i depth data to 3D point clouds
 * 
 * PROCESS:
 * 1. Take depth map (Float32Array) from ZED 2i camera
 * 2. Take RGB frame from ZED 2i camera
 * 3. Use camera intrinsics to project 2D pixels → 3D points
 * 4. Generate XYZ point cloud with RGB colors
 * 
 * CAMERA INTRINSICS:
 * - fx, fy: Focal lengths in pixels
 * - cx, cy: Principal point (optical center)
 * - These convert pixel coordinates to 3D rays
 * 
 * DEPTH PROJECTION FORMULA:
 * X = (u - cx) * depth / fx
 * Y = (v - cy) * depth / fy
 * Z = depth
 * 
 * where (u,v) is pixel coordinate and depth is from depth map
 */

import type { DepthData, RGBFrame } from '../camera/CameraInterface';
import type { 
  PointCloudFrame, 
  CameraIntrinsics
} from './types';
import { DEFAULT_ZED2I_INTRINSICS } from './types';

export interface GeneratePointCloudOptions {
  skipInvalidDepth?: boolean;
  maxDepth?: number;
  minDepth?: number;
  downsampleFactor?: number;
}

export function generatePointCloud(
  depthData: DepthData,
  rgbFrame: RGBFrame,
  cameraIntrinsics: CameraIntrinsics = DEFAULT_ZED2I_INTRINSICS,
  scanId: string,
  frameNumber: number,
  gpsPosition: { lat: number; lon: number; alt: number },
  options: GeneratePointCloudOptions = {}
): PointCloudFrame {
  const {
    skipInvalidDepth = true,
    maxDepth = 20.0,
    minDepth = 0.3,
    downsampleFactor = 1,
  } = options;

  if (depthData.width !== rgbFrame.width || depthData.height !== rgbFrame.height) {
    throw new Error('Depth and RGB frame dimensions must match');
  }

  const width = depthData.width;
  const height = depthData.height;
  const { fx, fy, cx, cy } = cameraIntrinsics;

  const depthArray = depthData.data;

  let rgbData: Uint8ClampedArray;
  if (rgbFrame.imageData instanceof ImageData) {
    rgbData = rgbFrame.imageData.data;
  } else {
    throw new Error('Blob RGB data not supported - convert to ImageData first');
  }

  const points: number[] = [];
  const colors: number[] = [];

  for (let v = 0; v < height; v += downsampleFactor) {
    for (let u = 0; u < width; u += downsampleFactor) {
      const idx = v * width + u;
      let depth = depthArray[idx];

      if (depthData.unit === 'millimeters') {
        depth *= 0.001;
      }

      if (skipInvalidDepth && (depth <= 0 || depth < minDepth || depth > maxDepth)) {
        continue;
      }

      if (depthData.confidence && depthData.confidence[idx] < 50) {
        continue;
      }

      const x = ((u - cx) * depth) / fx;
      const y = ((v - cy) * depth) / fy;
      const z = depth;

      points.push(x, y, z);

      const rgbIdx = idx * 4;
      const r = rgbData[rgbIdx];
      const g = rgbData[rgbIdx + 1];
      const b = rgbData[rgbIdx + 2];
      colors.push(r, g, b);
    }
  }

  const pointCount = points.length / 3;

  const frame: PointCloudFrame = {
    id: `frame_${scanId}_${frameNumber}_${Date.now()}`,
    scanId,
    timestamp: depthData.timestamp,
    points: new Float32Array(points),
    colors: new Uint8Array(colors),
    gpsPosition,
    frameNumber,
    pointCount,
  };

  return frame;
}

export function mergePointCloudFrames(frames: PointCloudFrame[]): {
  points: Float32Array;
  colors: Uint8Array;
  totalPoints: number;
} {
  if (frames.length === 0) {
    return {
      points: new Float32Array(0),
      colors: new Uint8Array(0),
      totalPoints: 0,
    };
  }

  const totalPoints = frames.reduce((sum, frame) => sum + frame.pointCount, 0);
  const mergedPoints = new Float32Array(totalPoints * 3);
  const mergedColors = new Uint8Array(totalPoints * 3);

  let offset = 0;
  for (const frame of frames) {
    mergedPoints.set(frame.points, offset * 3);
    if (frame.colors) {
      mergedColors.set(frame.colors, offset * 3);
    }
    offset += frame.pointCount;
  }

  return {
    points: mergedPoints,
    colors: mergedColors,
    totalPoints,
  };
}

export function calculateBounds(points: Float32Array): {
  min: { x: number; y: number; z: number };
  max: { x: number; y: number; z: number };
} {
  if (points.length === 0) {
    return {
      min: { x: 0, y: 0, z: 0 },
      max: { x: 0, y: 0, z: 0 },
    };
  }

  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

  for (let i = 0; i < points.length; i += 3) {
    const x = points[i];
    const y = points[i + 1];
    const z = points[i + 2];

    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (z < minZ) minZ = z;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
    if (z > maxZ) maxZ = z;
  }

  return {
    min: { x: minX, y: minY, z: minZ },
    max: { x: maxX, y: maxY, z: maxZ },
  };
}

export function estimateStorageSize(frames: PointCloudFrame[]): number {
  let totalBytes = 0;

  for (const frame of frames) {
    totalBytes += frame.points.byteLength;
    if (frame.colors) {
      totalBytes += frame.colors.byteLength;
    }
    totalBytes += 200;
  }

  return totalBytes;
}
