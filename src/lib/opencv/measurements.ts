import { CalibrationData } from '@/types/calibration';

export interface BoundingBox {
  xmin: number;
  ymin: number;
  xmax: number;
  ymax: number;
  centerX: number;
  centerY: number;
  pixelWidth: number;
  pixelHeight: number;
}

export interface MeasurementResult {
  value: number;
  method: string;
  confidence: number;
  unit: string;
}

export function extractBoundingBoxCoordinates(
  prediction: any,
  _imageWidth: number,
  _imageHeight: number
): BoundingBox {
  const [x, y, width, height] = prediction.bbox;
  
  return {
    xmin: x,
    ymin: y,
    xmax: x + width,
    ymax: y + height,
    centerX: x + width / 2,
    centerY: y + height / 2,
    pixelWidth: width,
    pixelHeight: height
  };
}

export function calculateVerticalDistance(
  topPixelY: number,
  bottomPixelY: number,
  calibration: CalibrationData,
  cameraHeight: number,
  distanceToObject?: number
): MeasurementResult {
  if (!calibration.focalLength || !calibration.principalPoint) {
    throw new Error('Calibration data incomplete');
  }

  const fy = calibration.focalLength.y;
  const cy = calibration.principalPoint.y;
  
  // Calculate pixel height of structure
  const pixelHeight = Math.abs(bottomPixelY - topPixelY);
  
  // If we have distance to object, use similar triangles:
  // realHeight / distance = pixelHeight / focalLength
  if (distanceToObject && distanceToObject > 0) {
    const realWorldHeight = (pixelHeight * distanceToObject) / fy;
    
    return {
      value: realWorldHeight,
      method: 'perspective_projection_with_distance',
      confidence: 0.90,
      unit: 'meters'
    };
  }
  
  // FALLBACK: Infer distance using camera height and ground assumption
  // Assume bottom point is at ground level (y=0 in world coordinates)
  const bottomOffset = bottomPixelY - cy;
  
  // Calculate angle to bottom point
  const angleBottom = Math.atan(bottomOffset / fy);
  
  // Infer horizontal distance to object using camera height and ground ray
  // distance = cameraHeight / tan(angleBottom)
  // If angleBottom ≈ 0 (looking straight ahead), distance is very large
  const inferredDistance = Math.abs(angleBottom) > 0.01 
    ? cameraHeight / Math.tan(Math.abs(angleBottom))
    : cameraHeight * 50; // Default to 50x camera height if nearly horizontal
  
  // Now use the inferred distance with similar triangles
  const realWorldHeight = (pixelHeight * inferredDistance) / fy;
  
  return {
    value: realWorldHeight,
    method: 'perspective_projection_inferred_distance',
    confidence: 0.70,  // Lower confidence due to ground assumption
    unit: 'meters'
  };
}

export function calculateHorizontalDistance(
  leftPixelX: number,
  rightPixelX: number,
  calibration: CalibrationData,
  distanceToObject: number
): MeasurementResult {
  if (!calibration.focalLength) {
    throw new Error('Calibration data incomplete');
  }

  const pixelWidth = Math.abs(rightPixelX - leftPixelX);
  const fx = calibration.focalLength.x;
  
  const realWidth = (pixelWidth * distanceToObject) / fx;
  
  return {
    value: realWidth,
    method: 'distance_based',
    confidence: 0.85,
    unit: 'meters'
  };
}

export function calculateDistanceToObject(
  objectPixelSize: number,
  objectRealSize: number,
  calibration: CalibrationData
): MeasurementResult {
  if (!calibration.focalLength) {
    throw new Error('Calibration data incomplete');
  }

  const fx = calibration.focalLength.x;
  const distance = (objectRealSize * fx) / objectPixelSize;
  
  return {
    value: distance,
    method: 'focal_length_based',
    confidence: 0.85,
    unit: 'meters'
  };
}
