/**
 * Mock Laser Driver
 * Generates simulated laser measurements for testing
 */

import {
  LaserDriver,
  LaserProfileConfig,
  LaserDriverStats,
  NormalizedLaserMeasurement
} from './types';

export class MockLaserDriver implements LaserDriver {
  public readonly profile: LaserProfileConfig;
  
  private stats: LaserDriverStats = {
    framesReceived: 0,
    framesValid: 0,
    framesInvalid: 0,
    resyncCount: 0,
    lastMeasurement: null,
    bytesProcessed: 0
  };

  private mockInterval: ReturnType<typeof setInterval> | null = null;
  private mockCallback: ((measurement: NormalizedLaserMeasurement) => void) | null = null;

  constructor(profile: LaserProfileConfig) {
    this.profile = profile;
  }

  async onOpen(_port: SerialPort): Promise<void> {
    this.reset();
    console.log('[Mock Driver] Initialized');
  }

  async startStreaming(_port: SerialPort): Promise<void> {
    console.log('[Mock Driver] Mock streaming started');
  }

  async stopStreaming(_port: SerialPort): Promise<void> {
    if (this.mockInterval) {
      clearInterval(this.mockInterval);
      this.mockInterval = null;
    }
    console.log('[Mock Driver] Mock streaming stopped');
  }

  feedBytes(_chunk: Uint8Array): NormalizedLaserMeasurement[] {
    const now = Date.now();
    this.stats.framesReceived++;
    this.stats.framesValid++;

    const baseDistance = 5.0;
    const variation = Math.sin(now / 1000) * 0.5;
    const noise = (Math.random() - 0.5) * 0.02;
    const distanceM = baseDistance + variation + noise;

    const measurement: NormalizedLaserMeasurement = {
      distanceM: Math.round(distanceM * 1000) / 1000,
      intensity: 200 + Math.floor(Math.random() * 100),
      timestamp: now,
      quality: 'good'
    };

    this.stats.lastMeasurement = measurement;
    return [measurement];
  }

  reset(): void {
    if (this.mockInterval) {
      clearInterval(this.mockInterval);
      this.mockInterval = null;
    }
    this.stats = {
      framesReceived: 0,
      framesValid: 0,
      framesInvalid: 0,
      resyncCount: 0,
      lastMeasurement: null,
      bytesProcessed: 0
    };
  }

  getStats(): LaserDriverStats {
    return { ...this.stats };
  }
}
