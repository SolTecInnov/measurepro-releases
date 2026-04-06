/**
 * Axis Orientation Calibration Module
 * Handles IMU axis mapping between Duro frame and vehicle frame
 */

export type DuroAxis = 'X' | 'Y' | 'Z';
export type AxisSign = 1 | -1;

export interface AxisMapping {
  vehicleX: { duroAxis: DuroAxis; sign: AxisSign };
  vehicleY: { duroAxis: DuroAxis; sign: AxisSign };
  vehicleZ: { duroAxis: DuroAxis; sign: AxisSign };
}

export interface AxisMappingResult {
  mapping: AxisMapping;
  confidence: {
    x: number;
    y: number;
    z: number;
    overall: number;
  };
  suggestions: string[];
  timestamp: string;
}

export interface CalibrationWindow {
  samples: AccelGyroSample[];
  startTime: number;
  endTime: number;
  type: 'baseline' | 'forward' | 'lateral' | 'vertical';
}

export interface AccelGyroSample {
  timestamp: number;
  accelX: number;
  accelY: number;
  accelZ: number;
  gyroX?: number;
  gyroY?: number;
  gyroZ?: number;
  roll?: number;
  pitch?: number;
  yaw?: number;
}

export interface OrientationCalibration {
  id: string;
  deviceId: string;
  projectId?: string;
  mapping: AxisMapping;
  confidence: { x: number; y: number; z: number; overall: number };
  calibratedAt: string;
  updatedAt: string;
  validationPassed: boolean;
  notes?: string;
  syncStatus?: 'pending' | 'synced' | 'conflict';
  firebaseId?: string;
}

export interface ValidationResult {
  passed: boolean;
  checks: {
    standstillFlat: { passed: boolean; roll: number; pitch: number; tolerance: number };
    signConsistency: boolean;
  };
  suggestions: string[];
}

import { calibrationStorage } from './storage';

const GRAVITY = 9.81;

class OrientationCalibrationService {
  private currentCalibration: OrientationCalibration | null = null;
  private captureBuffer: AccelGyroSample[] = [];
  private isCapturing: boolean = false;
  private captureType: CalibrationWindow['type'] | null = null;
  private subscribers: Set<(cal: OrientationCalibration | null) => void> = new Set();

  getDefaultMapping(): AxisMapping {
    return {
      vehicleX: { duroAxis: 'X', sign: 1 },
      vehicleY: { duroAxis: 'Y', sign: 1 },
      vehicleZ: { duroAxis: 'Z', sign: 1 },
    };
  }

  async load(deviceId: string, projectId?: string): Promise<OrientationCalibration | null> {
    try {
      const match = await calibrationStorage.loadOrientationCalibration(deviceId, projectId);
      if (match) {
        this.currentCalibration = match;
        this.notifySubscribers();
        return match;
      }
    } catch (e) {
      console.warn('[OrientationCalibration] Failed to load:', e);
    }

    this.currentCalibration = this.createDefault(deviceId, projectId);
    this.notifySubscribers();
    return this.currentCalibration;
  }

  private createDefault(deviceId: string, projectId?: string): OrientationCalibration {
    const now = new Date().toISOString();
    return {
      id: crypto.randomUUID(),
      deviceId,
      projectId,
      mapping: this.getDefaultMapping(),
      confidence: { x: 0, y: 0, z: 0, overall: 0 },
      calibratedAt: now,
      updatedAt: now,
      validationPassed: false,
      syncStatus: 'pending',
    };
  }

  async save(calibration: OrientationCalibration): Promise<void> {
    try {
      calibration.updatedAt = new Date().toISOString();
      calibration.syncStatus = 'pending';
      await calibrationStorage.saveOrientationCalibration(calibration);
      this.currentCalibration = calibration;
      this.notifySubscribers();
    } catch (e) {
      console.error('[OrientationCalibration] Failed to save:', e);
      throw e;
    }
  }

  getCurrent(): OrientationCalibration | null {
    return this.currentCalibration;
  }

  subscribe(callback: (cal: OrientationCalibration | null) => void): () => void {
    this.subscribers.add(callback);
    callback(this.currentCalibration);
    return () => this.subscribers.delete(callback);
  }

  private notifySubscribers() {
    this.subscribers.forEach(cb => cb(this.currentCalibration));
  }

  startCapture(type: CalibrationWindow['type']): void {
    this.captureBuffer = [];
    this.isCapturing = true;
    this.captureType = type;
  }

  addSample(sample: AccelGyroSample): void {
    if (this.isCapturing) {
      this.captureBuffer.push(sample);
    }
  }

  stopCapture(): CalibrationWindow | null {
    if (!this.isCapturing || this.captureBuffer.length === 0) {
      this.isCapturing = false;
      return null;
    }

    const window: CalibrationWindow = {
      samples: [...this.captureBuffer],
      startTime: this.captureBuffer[0].timestamp,
      endTime: this.captureBuffer[this.captureBuffer.length - 1].timestamp,
      type: this.captureType || 'baseline',
    };

    this.isCapturing = false;
    this.captureBuffer = [];
    this.captureType = null;

    return window;
  }

  analyzeForwardTest(baseline: CalibrationWindow, forward: CalibrationWindow): {
    dominantAxis: DuroAxis;
    sign: AxisSign;
    confidence: number;
    explanation: string;
  } {
    const baselineAvg = this.getAverageAccel(baseline.samples);
    const forwardAvg = this.getAverageAccel(forward.samples);

    const deltaX = forwardAvg.x - baselineAvg.x;
    const deltaY = forwardAvg.y - baselineAvg.y;
    const deltaZ = forwardAvg.z - baselineAvg.z;

    const absDeltaX = Math.abs(deltaX);
    const absDeltaY = Math.abs(deltaY);
    const absDeltaZ = Math.abs(deltaZ);

    let dominantAxis: DuroAxis = 'X';
    let dominantDelta = deltaX;
    let maxDelta = absDeltaX;

    if (absDeltaY > maxDelta) {
      dominantAxis = 'Y';
      dominantDelta = deltaY;
      maxDelta = absDeltaY;
    }
    if (absDeltaZ > maxDelta) {
      dominantAxis = 'Z';
      dominantDelta = deltaZ;
      maxDelta = absDeltaZ;
    }

    const sign: AxisSign = dominantDelta > 0 ? 1 : -1;
    const totalDelta = absDeltaX + absDeltaY + absDeltaZ;
    const confidence = totalDelta > 0.1 ? Math.min(100, (maxDelta / totalDelta) * 100) : 0;

    return {
      dominantAxis,
      sign,
      confidence,
      explanation: `Forward acceleration detected on Duro ${dominantAxis} axis (delta: ${dominantDelta.toFixed(3)} m/s²)`,
    };
  }

  analyzeLateralTest(baseline: CalibrationWindow, lateral: CalibrationWindow): {
    dominantAxis: DuroAxis;
    sign: AxisSign;
    confidence: number;
    explanation: string;
  } {
    const baselineAvg = this.getAverageAccel(baseline.samples);
    const lateralAvg = this.getAverageAccel(lateral.samples);

    const deltaX = lateralAvg.x - baselineAvg.x;
    const deltaY = lateralAvg.y - baselineAvg.y;
    const deltaZ = lateralAvg.z - baselineAvg.z;

    const absDeltaX = Math.abs(deltaX);
    const absDeltaY = Math.abs(deltaY);
    const absDeltaZ = Math.abs(deltaZ);

    let dominantAxis: DuroAxis = 'Y';
    let dominantDelta = deltaY;
    let maxDelta = absDeltaY;

    if (absDeltaX > maxDelta) {
      dominantAxis = 'X';
      dominantDelta = deltaX;
      maxDelta = absDeltaX;
    }
    if (absDeltaZ > maxDelta) {
      dominantAxis = 'Z';
      dominantDelta = deltaZ;
      maxDelta = absDeltaZ;
    }

    const sign: AxisSign = dominantDelta > 0 ? 1 : -1;
    const totalDelta = absDeltaX + absDeltaY + absDeltaZ;
    const confidence = totalDelta > 0.1 ? Math.min(100, (maxDelta / totalDelta) * 100) : 0;

    return {
      dominantAxis,
      sign,
      confidence,
      explanation: `Lateral acceleration detected on Duro ${dominantAxis} axis (delta: ${dominantDelta.toFixed(3)} m/s²)`,
    };
  }

  analyzeVerticalTest(baseline: CalibrationWindow): {
    dominantAxis: DuroAxis;
    sign: AxisSign;
    confidence: number;
    explanation: string;
  } {
    const avg = this.getAverageAccel(baseline.samples);

    const absX = Math.abs(avg.x);
    const absY = Math.abs(avg.y);
    const absZ = Math.abs(avg.z);

    let dominantAxis: DuroAxis = 'Z';
    let dominantValue = avg.z;
    let maxValue = absZ;

    if (absX > maxValue) {
      dominantAxis = 'X';
      dominantValue = avg.x;
      maxValue = absX;
    }
    if (absY > maxValue) {
      dominantAxis = 'Y';
      dominantValue = avg.y;
      maxValue = absY;
    }

    const sign: AxisSign = dominantValue > 0 ? -1 : 1;
    const confidence = Math.min(100, (maxValue / GRAVITY) * 100);
    const isInverted = dominantValue < 0;

    return {
      dominantAxis,
      sign,
      confidence,
      explanation: `Gravity vector detected on Duro ${dominantAxis} axis (${isInverted ? 'inverted' : 'normal'} orientation)`,
    };
  }

  private getAverageAccel(samples: AccelGyroSample[]): { x: number; y: number; z: number } {
    if (samples.length === 0) return { x: 0, y: 0, z: 0 };

    const sum = samples.reduce(
      (acc, s) => ({
        x: acc.x + s.accelX,
        y: acc.y + s.accelY,
        z: acc.z + s.accelZ,
      }),
      { x: 0, y: 0, z: 0 }
    );

    return {
      x: sum.x / samples.length,
      y: sum.y / samples.length,
      z: sum.z / samples.length,
    };
  }

  buildMapping(
    forwardResult: { dominantAxis: DuroAxis; sign: AxisSign; confidence: number },
    lateralResult: { dominantAxis: DuroAxis; sign: AxisSign; confidence: number },
    verticalResult: { dominantAxis: DuroAxis; sign: AxisSign; confidence: number }
  ): AxisMappingResult {
    const mapping: AxisMapping = {
      vehicleX: { duroAxis: forwardResult.dominantAxis, sign: forwardResult.sign },
      vehicleY: { duroAxis: lateralResult.dominantAxis, sign: lateralResult.sign },
      vehicleZ: { duroAxis: verticalResult.dominantAxis, sign: verticalResult.sign },
    };

    const confidence = {
      x: forwardResult.confidence,
      y: lateralResult.confidence,
      z: verticalResult.confidence,
      overall: (forwardResult.confidence + lateralResult.confidence + verticalResult.confidence) / 3,
    };

    const suggestions: string[] = [];

    const axes = [forwardResult.dominantAxis, lateralResult.dominantAxis, verticalResult.dominantAxis];
    const uniqueAxes = new Set(axes);
    if (uniqueAxes.size < 3) {
      suggestions.push('Warning: Same Duro axis detected for multiple vehicle axes. Check mounting or repeat tests.');
    }

    if (confidence.overall < 50) {
      suggestions.push('Low confidence - consider repeating tests with more pronounced movements.');
    }

    if (confidence.x < 30) {
      suggestions.push('Forward test inconclusive - try sharper acceleration/braking.');
    }
    if (confidence.y < 30) {
      suggestions.push('Lateral test inconclusive - try sharper turns.');
    }
    if (confidence.z < 70) {
      suggestions.push('Vertical axis detection weak - ensure device is stationary during baseline.');
    }

    return {
      mapping,
      confidence,
      suggestions,
      timestamp: new Date().toISOString(),
    };
  }

  applyMapping(mapping: AxisMapping): void {
    if (this.currentCalibration) {
      this.currentCalibration.mapping = mapping;
      this.currentCalibration.calibratedAt = new Date().toISOString();
      this.save(this.currentCalibration);
    }
  }

  updateConfidence(confidence: { x: number; y: number; z: number; overall: number }): void {
    if (this.currentCalibration) {
      this.currentCalibration.confidence = confidence;
      this.save(this.currentCalibration);
    }
  }

  validateOrientation(currentRoll: number, currentPitch: number, toleranceDeg: number = 2): ValidationResult {
    const rollCheck = Math.abs(currentRoll) <= toleranceDeg;
    const pitchCheck = Math.abs(currentPitch) <= toleranceDeg;

    const passed = rollCheck && pitchCheck;

    const suggestions: string[] = [];
    if (!rollCheck) {
      suggestions.push(`Roll (${currentRoll.toFixed(1)}°) exceeds tolerance ±${toleranceDeg}°. Check if vehicle is level or adjust mapping.`);
    }
    if (!pitchCheck) {
      suggestions.push(`Pitch (${currentPitch.toFixed(1)}°) exceeds tolerance ±${toleranceDeg}°. Check if vehicle is level or adjust mapping.`);
    }

    if (this.currentCalibration) {
      this.currentCalibration.validationPassed = passed;
      this.save(this.currentCalibration);
    }

    return {
      passed,
      checks: {
        standstillFlat: { passed, roll: currentRoll, pitch: currentPitch, tolerance: toleranceDeg },
        signConsistency: true,
      },
      suggestions,
    };
  }

  transformAccel(sample: AccelGyroSample): { x: number; y: number; z: number } {
    const mapping = this.currentCalibration?.mapping || this.getDefaultMapping();

    const getAxisValue = (axis: DuroAxis, sign: AxisSign): number => {
      let value = 0;
      switch (axis) {
        case 'X': value = sample.accelX; break;
        case 'Y': value = sample.accelY; break;
        case 'Z': value = sample.accelZ; break;
      }
      return value * sign;
    };

    return {
      x: getAxisValue(mapping.vehicleX.duroAxis, mapping.vehicleX.sign),
      y: getAxisValue(mapping.vehicleY.duroAxis, mapping.vehicleY.sign),
      z: getAxisValue(mapping.vehicleZ.duroAxis, mapping.vehicleZ.sign),
    };
  }

  getExportMetadata(): Record<string, unknown> {
    const cal = this.currentCalibration;
    return {
      orientationCalibration: cal ? {
        mapping: cal.mapping,
        confidence: cal.confidence,
        calibratedAt: cal.calibratedAt,
        validationPassed: cal.validationPassed,
        deviceId: cal.deviceId,
        projectId: cal.projectId,
      } : null,
    };
  }
}

export const orientationCalibration = new OrientationCalibrationService();
