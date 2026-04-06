import { CalibrationData } from '@/types/calibration';
import { extractBoundingBoxCoordinates, calculateVerticalDistance, calculateHorizontalDistance, MeasurementResult } from './measurements';

export interface BridgeClearanceMeasurement {
  minimumClearance: {
    camera: MeasurementResult;
    laser?: MeasurementResult;
    validated?: {
      value: number;
      status: string;
      confidence: number;
    };
  };
  minimumLocation: { x: number; y: number };
  complianceLevel: 'COMPLIANT' | 'RESTRICTED';
  detectionConfidence: number;
}

export interface LaneWidthMeasurement {
  lanes: Array<{
    laneNumber: number;
    width: number;
    confidence: number;
  }>;
  totalWidth: number;
  narrowestLane: number;
}

export interface TrafficSignalMeasurement {
  signalClearances: number[];
  signalSpacing: number[];
  minimumClearance: number;
  clearSpanWidth: number;
}

export interface ValidationResult {
  camera: number;
  laser: number;
  discrepancy: number;
  withinTolerance: boolean;
  recommendedValue: number;
  status: 'VALIDATED' | 'NEEDS_REVIEW';
  confidence: number;
}

function isCalibrated(calibrationData: CalibrationData): boolean {
  return !!(
    calibrationData.focalLength &&
    calibrationData.principalPoint &&
    calibrationData.cameraMatrix
  );
}

export async function measureBridgeMinimumClearance(
  predictions: any[],
  calibrationData: CalibrationData,
  videoFrame: HTMLVideoElement | HTMLCanvasElement,
  cameraHeight: number
): Promise<BridgeClearanceMeasurement | { error: string }> {
  if (!isCalibrated(calibrationData)) {
    return { error: 'Camera not calibrated. Please calibrate first.' };
  }

  const bridgeDetection = predictions.find(
    p => p.class === 'bridge' || p.class === 'structure' || p.class === 'truck' || p.class === 'bus'
  );

  if (!bridgeDetection) {
    return { error: 'No bridge or structure detected in frame' };
  }

  const bbox = extractBoundingBoxCoordinates(
    bridgeDetection,
    videoFrame.width,
    videoFrame.height
  );

  const bottomPoints: Array<{ x: number; y: number }> = [];
  for (let x = bbox.xmin; x <= bbox.xmax; x += 5) {
    bottomPoints.push({ x, y: bbox.ymax });
  }

  const lowestPoint = bottomPoints.reduce((prev, curr) => 
    curr.y > prev.y ? curr : prev
  );

  const roadSurfaceY = videoFrame.height;
  
  // Estimate distance to bridge (typically 10-20m, using 15m as reasonable default)
  const estimatedDistanceToBridge = 15;
  
  const clearance = calculateVerticalDistance(
    lowestPoint.y,
    roadSurfaceY,
    calibrationData,
    cameraHeight,
    estimatedDistanceToBridge
  );

  const complianceLevel = clearance.value >= 5.3 ? 'COMPLIANT' : 'RESTRICTED';

  return {
    minimumClearance: {
      camera: clearance
    },
    minimumLocation: lowestPoint,
    complianceLevel,
    detectionConfidence: bridgeDetection.score || 0.85
  };
}

export async function measureLaneWidth(
  predictions: any[],
  calibrationData: CalibrationData,
  videoFrame: HTMLVideoElement | HTMLCanvasElement,
  _cameraHeight: number
): Promise<LaneWidthMeasurement | { error: string }> {
  if (!isCalibrated(calibrationData)) {
    return { error: 'Camera not calibrated. Please calibrate first.' };
  }

  const laneMarkings = predictions
    .filter(p => p.class === 'lane_marking' || p.class === 'line' || p.class === 'person')
    .sort((a, b) => a.bbox[0] - b.bbox[0]);

  if (laneMarkings.length < 2) {
    return { error: 'Need at least 2 lane markings detected' };
  }

  const laneWidths: Array<{ laneNumber: number; width: number; confidence: number }> = [];
  const distanceToRoad = 10;

  for (let i = 0; i < laneMarkings.length - 1; i++) {
    const left = extractBoundingBoxCoordinates(laneMarkings[i], videoFrame.width, videoFrame.height);
    const right = extractBoundingBoxCoordinates(laneMarkings[i + 1], videoFrame.width, videoFrame.height);

    const measurement = calculateHorizontalDistance(
      left.centerX,
      right.centerX,
      calibrationData,
      distanceToRoad
    );

    laneWidths.push({
      laneNumber: i + 1,
      width: measurement.value,
      confidence: measurement.confidence
    });
  }

  const totalWidth = laneWidths.reduce((sum, lane) => sum + lane.width, 0);
  const narrowestLane = Math.min(...laneWidths.map(lane => lane.width));

  return {
    lanes: laneWidths,
    totalWidth,
    narrowestLane
  };
}

export async function measureTrafficSignalSpacing(
  predictions: any[],
  calibrationData: CalibrationData,
  videoFrame: HTMLVideoElement | HTMLCanvasElement,
  cameraHeight: number
): Promise<TrafficSignalMeasurement | { error: string }> {
  if (!isCalibrated(calibrationData)) {
    return { error: 'Camera not calibrated. Please calibrate first.' };
  }

  const signals = predictions.filter(p => p.class === 'traffic light');

  if (signals.length < 2) {
    return { error: 'Need at least 2 traffic lights detected' };
  }

  signals.sort((a, b) => a.bbox[0] - b.bbox[0]);

  const measurements: TrafficSignalMeasurement = {
    signalClearances: [],
    signalSpacing: [],
    minimumClearance: 0,
    clearSpanWidth: 0
  };

  const roadSurfaceY = videoFrame.height;
  const distanceToSignals = 15;

  for (const signal of signals) {
    const bbox = extractBoundingBoxCoordinates(signal, videoFrame.width, videoFrame.height);
    const clearance = calculateVerticalDistance(
      bbox.ymax,
      roadSurfaceY,
      calibrationData,
      cameraHeight,
      distanceToSignals
    );
    measurements.signalClearances.push(clearance.value);
  }
  for (let i = 0; i < signals.length - 1; i++) {
    const left = extractBoundingBoxCoordinates(signals[i], videoFrame.width, videoFrame.height);
    const right = extractBoundingBoxCoordinates(signals[i + 1], videoFrame.width, videoFrame.height);

    const spacing = calculateHorizontalDistance(
      left.centerX,
      right.centerX,
      calibrationData,
      distanceToSignals
    );
    measurements.signalSpacing.push(spacing.value);
  }

  measurements.minimumClearance = Math.min(...measurements.signalClearances);
  measurements.clearSpanWidth = Math.min(...measurements.signalSpacing);

  return measurements;
}

export async function getLaserMeasurement(lastMeasurement: string): Promise<MeasurementResult | null> {
  if (!lastMeasurement || lastMeasurement === '--' || lastMeasurement === 'infinity') {
    return null;
  }

  const distance = parseFloat(lastMeasurement);
  if (isNaN(distance)) {
    return null;
  }

  return {
    value: distance,
    method: 'laser_rangefinder',
    confidence: 0.98,
    unit: 'meters'
  };
}

export function validateCameraMeasurement(
  cameraMeasurement: number,
  laserMeasurement: number
): ValidationResult {
  const discrepancy = Math.abs(cameraMeasurement - laserMeasurement);
  const toleranceMeters = 0.10;

  const withinTolerance = discrepancy <= toleranceMeters;
  const recommendedValue = withinTolerance 
    ? (cameraMeasurement + laserMeasurement) / 2 
    : laserMeasurement;

  let confidence: number;
  if (discrepancy <= 0.05) {
    confidence = 0.95;
  } else if (discrepancy <= 0.10) {
    confidence = 0.85;
  } else {
    confidence = 0.50;
  }

  return {
    camera: cameraMeasurement,
    laser: laserMeasurement,
    discrepancy,
    withinTolerance,
    recommendedValue,
    status: withinTolerance ? 'VALIDATED' : 'NEEDS_REVIEW',
    confidence
  };
}

export interface ComplianceCheck {
  compliant: boolean;
  deficit: number;
  warningLevel: 'COMPLIANT' | 'RESTRICTED';
  standard: {
    minClearance: number;
    preferred: number;
  };
}

export function checkClearanceCompliance(
  clearance: number,
  location: 'Quebec' | 'Ontario' = 'Quebec'
): ComplianceCheck {
  const standards = {
    Quebec: {
      minClearance: 5.3,
      preferred: 5.5
    },
    Ontario: {
      minClearance: 5.1,
      preferred: 5.3
    }
  };

  const standard = standards[location];
  const compliant = clearance >= standard.minClearance;
  const deficit = Math.max(0, standard.minClearance - clearance);
  const warningLevel = compliant ? 'COMPLIANT' : 'RESTRICTED';

  return {
    compliant,
    deficit,
    warningLevel,
    standard
  };
}
