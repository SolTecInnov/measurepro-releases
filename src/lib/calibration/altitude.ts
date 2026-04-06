/**
 * Altitude Calibration Module
 * Handles altitude source selection, offset calibration, and persistence
 */

export type AltitudeSourceStrategy = 'prefer_msl' | 'derive_msl' | 'raw_ambiguous';

export interface AltitudeCalibration {
  id: string;
  deviceId: string;
  projectId?: string;
  sourceStrategy: AltitudeSourceStrategy;
  offsetM: number;
  calibratedAt: string;
  updatedAt: string;
  calibrationMethod: 'benchmark' | 'phone' | 'manual' | 'none';
  referenceAltitude?: number;
  rawAltitudeAtCalibration?: number;
  notes?: string;
  syncStatus?: 'pending' | 'synced' | 'conflict';
  firebaseId?: string;
}

export interface AltitudeData {
  raw: number | null;
  mslExplicit: number | null;
  ellipsoidHeight: number | null;
  geoidSeparation: number | null;
  selected: number | null;
  corrected: number | null;
  strategy: AltitudeSourceStrategy;
  offset: number;
}

import { calibrationStorage } from './storage';

class AltitudeCalibrationService {
  private currentCalibration: AltitudeCalibration | null = null;
  private subscribers: Set<(cal: AltitudeCalibration | null) => void> = new Set();

  async load(deviceId: string, projectId?: string): Promise<AltitudeCalibration | null> {
    try {
      const match = await calibrationStorage.loadAltitudeCalibration(deviceId, projectId);
      if (match) {
        this.currentCalibration = match;
        this.notifySubscribers();
        return match;
      }
    } catch (e) {
      console.warn('[AltitudeCalibration] Failed to load:', e);
    }

    this.currentCalibration = this.createDefault(deviceId, projectId);
    this.notifySubscribers();
    return this.currentCalibration;
  }

  private createDefault(deviceId: string, projectId?: string): AltitudeCalibration {
    const now = new Date().toISOString();
    return {
      id: crypto.randomUUID(),
      deviceId,
      projectId,
      sourceStrategy: 'prefer_msl',
      offsetM: 0,
      calibratedAt: now,
      updatedAt: now,
      calibrationMethod: 'none',
      syncStatus: 'pending',
    };
  }

  async save(calibration: AltitudeCalibration): Promise<void> {
    try {
      calibration.updatedAt = new Date().toISOString();
      calibration.syncStatus = 'pending';
      await calibrationStorage.saveAltitudeCalibration(calibration);
      this.currentCalibration = calibration;
      this.notifySubscribers();
    } catch (e) {
      console.error('[AltitudeCalibration] Failed to save:', e);
      throw e;
    }
  }

  getCurrent(): AltitudeCalibration | null {
    return this.currentCalibration;
  }

  subscribe(callback: (cal: AltitudeCalibration | null) => void): () => void {
    this.subscribers.add(callback);
    callback(this.currentCalibration);
    return () => this.subscribers.delete(callback);
  }

  private notifySubscribers() {
    this.subscribers.forEach(cb => cb(this.currentCalibration));
  }

  setStrategy(strategy: AltitudeSourceStrategy): void {
    if (this.currentCalibration) {
      this.currentCalibration.sourceStrategy = strategy;
      this.save(this.currentCalibration);
    }
  }

  setOffset(offsetM: number): void {
    if (this.currentCalibration) {
      this.currentCalibration.offsetM = offsetM;
      this.save(this.currentCalibration);
    }
  }

  calibrateWithReference(
    referenceAltitude: number,
    currentRawAltitude: number,
    method: 'benchmark' | 'phone' | 'manual'
  ): number {
    const offset = referenceAltitude - currentRawAltitude;
    
    if (this.currentCalibration) {
      this.currentCalibration.offsetM = offset;
      this.currentCalibration.calibrationMethod = method;
      this.currentCalibration.referenceAltitude = referenceAltitude;
      this.currentCalibration.rawAltitudeAtCalibration = currentRawAltitude;
      this.currentCalibration.calibratedAt = new Date().toISOString();
      this.save(this.currentCalibration);
    }

    return offset;
  }

  resetOffset(): void {
    if (this.currentCalibration) {
      this.currentCalibration.offsetM = 0;
      this.currentCalibration.calibrationMethod = 'none';
      this.currentCalibration.referenceAltitude = undefined;
      this.currentCalibration.rawAltitudeAtCalibration = undefined;
      this.save(this.currentCalibration);
    }
  }

  applyCalibration(rawAltitude: number | null): AltitudeData {
    const cal = this.currentCalibration;
    const offset = cal?.offsetM ?? 0;
    const strategy = cal?.sourceStrategy ?? 'prefer_msl';

    const selected = rawAltitude;
    const corrected = selected !== null ? selected + offset : null;

    return {
      raw: rawAltitude,
      mslExplicit: null,
      ellipsoidHeight: null,
      geoidSeparation: null,
      selected,
      corrected,
      strategy,
      offset,
    };
  }

  applyCalibrationFull(
    raw: number | null,
    mslExplicit: number | null,
    ellipsoidHeight: number | null,
    geoidSeparation: number | null
  ): AltitudeData {
    const cal = this.currentCalibration;
    const offset = cal?.offsetM ?? 0;
    const strategy = cal?.sourceStrategy ?? 'prefer_msl';

    let selected: number | null = null;

    switch (strategy) {
      case 'prefer_msl':
        if (mslExplicit !== null) {
          selected = mslExplicit;
        } else if (ellipsoidHeight !== null && geoidSeparation !== null) {
          selected = ellipsoidHeight - geoidSeparation;
        } else {
          selected = raw;
        }
        break;
      case 'derive_msl':
        if (ellipsoidHeight !== null && geoidSeparation !== null) {
          selected = ellipsoidHeight - geoidSeparation;
        } else if (mslExplicit !== null) {
          selected = mslExplicit;
        } else {
          selected = raw;
        }
        break;
      case 'raw_ambiguous':
      default:
        selected = raw;
        break;
    }

    const corrected = selected !== null ? selected + offset : null;

    return {
      raw,
      mslExplicit,
      ellipsoidHeight,
      geoidSeparation,
      selected,
      corrected,
      strategy,
      offset,
    };
  }

  getExportMetadata(): Record<string, unknown> {
    const cal = this.currentCalibration;
    return {
      altitudeCalibration: cal ? {
        strategy: cal.sourceStrategy,
        offset: cal.offsetM,
        calibrationMethod: cal.calibrationMethod,
        calibratedAt: cal.calibratedAt,
        referenceAltitude: cal.referenceAltitude,
        rawAltitudeAtCalibration: cal.rawAltitudeAtCalibration,
        deviceId: cal.deviceId,
        projectId: cal.projectId,
      } : null,
    };
  }
}

export const altitudeCalibration = new AltitudeCalibrationService();
