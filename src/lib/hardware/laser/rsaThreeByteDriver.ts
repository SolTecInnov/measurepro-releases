/**
 * RSA Vertical Clearance Laser Driver
 * Implements the 3-byte binary protocol used by RSA lasers
 * 
 * Protocol specification (per RSA documentation):
 * - Baud: 460800, 8N1, no flow control
 * - Start streaming: ASCII "DT\r"
 * - Stop streaming: ESC (0x1B)
 * - Frame format: 3 bytes [b0, b1, b2]
 * - Valid frame: b0 & 0x80 != 0, b1 & 0x80 == 0, b2 & 0x80 == 0
 * - Distance: ((b0 & 0x7F) << 7) | b1) / 100.0 meters (resolution 0.01m, range 0-30m)
 * - Intensity: b2 * 2 (0-510) - used as signal quality proxy
 * - No-return (sky): raw14bit == 0x3FFF (16383 = 163.83m, beyond 30m max range)
 * 
 * Important notes:
 * - Laser transmits only distance and intensity (no temp/status/quality flags)
 * - All filtering (range, intensity, rain/snow) must be done in software
 * - Intensity can be used to filter poor quality readings from rain/snow/fog
 * - raw14bit == 0 is a valid close-range surface return (0.00m distance)
 */

import {
  LaserDriver,
  LaserProfileConfig,
  LaserDriverStats,
  NormalizedLaserMeasurement
} from './types';

export class RsaThreeByteLaserDriver implements LaserDriver {
  public readonly profile: LaserProfileConfig;
  
  // Use Uint8Array for faster buffer operations
  private buffer: Uint8Array = new Uint8Array(4096);
  private bufferLen: number = 0;
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
    console.log('[RSA Driver] Port opened, driver initialized');
  }

  async startStreaming(port: SerialPort): Promise<void> {
    const cmd = this.profile.startCommand ?? 'DT\r';
    await this.writeAscii(port, cmd);
    console.log('[RSA Driver] Started streaming with command:', JSON.stringify(cmd));
  }

  async stopStreaming(port: SerialPort): Promise<void> {
    const cmd = this.profile.stopCommand ?? '\x1B';
    await this.writeAscii(port, cmd);
    console.log('[RSA Driver] Stopped streaming with ESC');
  }

  feedBytes(chunk: Uint8Array): NormalizedLaserMeasurement[] {
    const results: NormalizedLaserMeasurement[] = [];
    const now = Date.now();

    this.stats.bytesProcessed += chunk.length;

    // DEBUG: Log raw bytes received (first 10 chunks, then every 100th)
    if (this.stats.framesReceived < 10 || this.stats.framesReceived % 100 === 0) {
      const hexBytes = Array.from(chunk.slice(0, Math.min(30, chunk.length)))
        .map(b => b.toString(16).padStart(2, '0'))
        .join(' ');
      console.log(`[RSA RAW] ${chunk.length} bytes: ${hexBytes}${chunk.length > 30 ? '...' : ''}`);
    }

    // Append chunk to buffer efficiently
    if (this.bufferLen + chunk.length > this.buffer.length) {
      // Grow buffer if needed
      const newBuffer = new Uint8Array(Math.max(this.buffer.length * 2, this.bufferLen + chunk.length));
      newBuffer.set(this.buffer.subarray(0, this.bufferLen));
      this.buffer = newBuffer;
    }
    this.buffer.set(chunk, this.bufferLen);
    this.bufferLen += chunk.length;

    const maxRange = this.profile.options?.maxRangeM ?? 30;
    const minRange = this.profile.options?.minRangeM ?? 0;
    const intensityThreshold = this.profile.options?.intensityThreshold ?? 6;
    
    // Weather filtering options (rain/snow/fog detection based on intensity)
    const weatherFilter = this.profile.options?.weatherFilter ?? { enabled: false };
    const weatherEnabled = weatherFilter.enabled ?? false;
    const minIntensityGood = weatherFilter.minIntensityGood ?? 100;
    const minIntensityAcceptable = weatherFilter.minIntensityAcceptable ?? 40;

    let readPos = 0;
    while (readPos + 3 <= this.bufferLen) {
      const b0 = this.buffer[readPos];
      const b1 = this.buffer[readPos + 1];
      const b2 = this.buffer[readPos + 2];

      const validFrame =
        (b0 & 0x80) !== 0 &&
        (b1 & 0x80) === 0 &&
        (b2 & 0x80) === 0;

      if (validFrame) {
        this.stats.framesReceived++;
        this.stats.framesValid++;

        const raw14bit = ((b0 & 0x7F) << 7) | b1;
        const distanceM = raw14bit / 100.0;
        const intensity = b2 * 2;

        // SKY DETECTION: raw14bit == 0x3FFF (16383) = no return signal (sky)
        // The protocol uses the maximum 14-bit value (163.83m, far beyond the 30m
        // max range) as the "no return" sentinel when the laser gets no reflection.
        // raw14bit == 0 is a valid zero-distance surface hit and must NOT be treated as sky.
        const RSA_NO_RETURN_RAW14 = 0x3FFF; // 16383
        const isSky = raw14bit === RSA_NO_RETURN_RAW14;

        const inRange = distanceM >= minRange && 
                       (maxRange <= 0 || distanceM <= maxRange);
        const signalGood = intensity >= intensityThreshold;

        // Determine weather quality based on intensity (rain/snow/fog filtering)
        let weatherQuality: 'good' | 'acceptable' | 'poor' = 'good';
        if (weatherEnabled) {
          if (intensity >= minIntensityGood) {
            weatherQuality = 'good';       // Clear conditions
          } else if (intensity >= minIntensityAcceptable) {
            weatherQuality = 'acceptable'; // Light rain/snow
          } else {
            weatherQuality = 'poor';       // Heavy rain/snow/fog
          }
        }

        let quality: 'good' | 'weak' | 'invalid' | 'sky' | 'weather_degraded' = 'good';
        let finalDistance: number | null = distanceM;

        if (isSky) {
          // Sky reading - no return signal
          quality = 'sky';
          finalDistance = null;
        } else if (!inRange) {
          quality = 'invalid';
          finalDistance = null;
        } else if (weatherEnabled && weatherQuality === 'poor') {
          // Weather filtering enabled and signal is poor quality
          quality = 'weather_degraded';
          // Keep distance but mark as degraded - let caller decide whether to use it
        } else if (!signalGood) {
          quality = 'weak';
        }

        const measurement: NormalizedLaserMeasurement = {
          distanceM: finalDistance,
          intensity,
          timestamp: now,
          quality,
          raw: new Uint8Array([b0, b1, b2]),
          isSky,
          weatherQuality: weatherEnabled ? weatherQuality : undefined
        };

        results.push(measurement);
        this.stats.lastMeasurement = measurement;
        readPos += 3;
      } else {
        this.stats.framesInvalid++;
        this.stats.resyncCount++;
        readPos += 1; // Skip one byte and try to resync
      }
    }

    // Compact buffer by removing processed bytes
    if (readPos > 0) {
      const remaining = this.bufferLen - readPos;
      if (remaining > 0) {
        this.buffer.copyWithin(0, readPos, this.bufferLen);
      }
      this.bufferLen = remaining;
    }

    // DEBUG: Log frame stats periodically to diagnose data reception issues
    const totalFrames = this.stats.framesValid + this.stats.framesInvalid;
    if (totalFrames > 0 && totalFrames % 500 === 0) {
      const validPct = ((this.stats.framesValid / totalFrames) * 100).toFixed(1);
      console.log(`[RSA STATS] Valid: ${this.stats.framesValid}/${totalFrames} (${validPct}%), Resyncs: ${this.stats.resyncCount}, Bytes: ${this.stats.bytesProcessed}`);
    }

    return results;
  }

  reset(): void {
    this.bufferLen = 0;
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
    if (!writer) {
      console.warn('[RSA Driver] Cannot write - port not writable');
      return;
    }
    
    try {
      const encoder = new TextEncoder();
      await writer.write(encoder.encode(text));
    } finally {
      writer.releaseLock();
    }
  }
}
