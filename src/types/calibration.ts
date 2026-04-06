export interface CalibrationSettings {
  patternSize: {
    width: number;
    height: number;
  };
  squareSize: number;
  minCaptures: number;
}

export interface CapturedCalibrationImage {
  id: string;
  imageData: string;
  corners: number[][];
  timestamp: number;
}

export interface CalibrationData {
  cameraMatrix: number[][] | null;
  distortionCoeffs: number[] | null;
  focalLength: { x: number; y: number } | null;
  principalPoint: { x: number; y: number } | null;
  reprojectionError: number | null;
  quality: 'EXCELLENT' | 'GOOD' | 'NEEDS_IMPROVEMENT' | 'POOR';
  calibrationDate: number;
  imageWidth: number;
  imageHeight: number;
}
