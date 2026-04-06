/**
 * Jenoptik ASCII Laser Driver
 * Handles ASCII-based laser protocols (Jenoptik LDS-30, etc.)
 * 
 * Protocol:
 * - Measurements come as ASCII text: "D 0001.759"
 * - Infinity codes: "De02" or "DE02"
 * - Error codes: "E203", "E210", etc.
 */

import {
  LaserDriver,
  LaserProfileConfig,
  LaserDriverStats,
  NormalizedLaserMeasurement
} from './types';

export class JenoptikAsciiDriver implements LaserDriver {
  public readonly profile: LaserProfileConfig;
  
  private buffer: string = '';
  private stats: LaserDriverStats = {
    framesReceived: 0,
    framesValid: 0,
    framesInvalid: 0,
    resyncCount: 0,
    lastMeasurement: null,
    bytesProcessed: 0
  };

  constructor(profile: LaserProfileConfig) {
    this.profile = profile;
  }

  async onOpen(_port: SerialPort): Promise<void> {
    this.reset();
    console.log('[Jenoptik Driver] Port opened, driver initialized');
  }

  async startStreaming(port: SerialPort): Promise<void> {
    const cmd = this.profile.startCommand ?? 'DT\r';
    await this.writeAscii(port, cmd);
    console.log('[Jenoptik Driver] Started streaming');
  }

  async stopStreaming(port: SerialPort): Promise<void> {
    const cmd = this.profile.stopCommand ?? '\x1B';
    await this.writeAscii(port, cmd);
    console.log('[Jenoptik Driver] Stopped streaming');
  }

  feedBytes(chunk: Uint8Array): NormalizedLaserMeasurement[] {
    const results: NormalizedLaserMeasurement[] = [];
    const now = Date.now();

    this.stats.bytesProcessed += chunk.length;

    const decoder = new TextDecoder('ascii');
    const text = decoder.decode(chunk, { stream: true });
    this.buffer += text;

    if (this.buffer.length > 8192) {
      this.buffer = this.buffer.slice(-6144);
    }

    const lines = this.buffer.split(/\r\n|\r|\n/);
    this.buffer = lines.pop() || '';

    const maxRange = this.profile.options?.maxRangeM ?? 30;
    const minRange = this.profile.options?.minRangeM ?? 0;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      this.stats.framesReceived++;

      const measurement = this.parseMeasurement(trimmed, now, minRange, maxRange);
      if (measurement) {
        this.stats.framesValid++;
        results.push(measurement);
        this.stats.lastMeasurement = measurement;
      } else {
        this.stats.framesInvalid++;
      }
    }

    return results;
  }

  private parseMeasurement(
    data: string, 
    timestamp: number,
    minRange: number,
    maxRange: number
  ): NormalizedLaserMeasurement | null {
    if (data === 'De02' || data === 'DE02') {
      return {
        distanceM: null,
        timestamp,
        quality: 'invalid',
        error: 'infinity'
      };
    }

    const measurementMatch = data.match(/^D\s+(\d+\.\d+)$/);
    if (measurementMatch) {
      const distanceM = parseFloat(measurementMatch[1]);
      
      if (isNaN(distanceM)) {
        return null;
      }

      const inRange = distanceM >= minRange && 
                     (maxRange <= 0 || distanceM <= maxRange);

      return {
        distanceM: inRange ? distanceM : null,
        timestamp,
        quality: inRange ? 'good' : 'invalid'
      };
    }

    if (data.startsWith('E')) {
      return {
        distanceM: null,
        timestamp,
        quality: 'invalid',
        error: `error_${data}`
      };
    }

    return null;
  }

  reset(): void {
    this.buffer = '';
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

  private async writeAscii(port: SerialPort, text: string): Promise<void> {
    const writer = port.writable?.getWriter();
    if (!writer) return;
    
    try {
      const encoder = new TextEncoder();
      await writer.write(encoder.encode(text));
    } finally {
      writer.releaseLock();
    }
  }
}
