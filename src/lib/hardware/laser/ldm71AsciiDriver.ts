/**
 * Jenoptik LDM71 (MeasurePRO Lidar2D V2) ASCII Driver
 * 
 * Protocol specification:
 * - Output format: "D 0001.724 012.9\r\n"
 *   - 'D' = Distance marker
 *   - 0001.724 = Distance in meters
 *   - 012.9 = Amplitude in dB (signal strength)
 * 
 * The amplitude value indicates signal reliability:
 * - Higher dB = stronger return signal = more reliable measurement
 * - Low dB often indicates rain, fog, snow, dust, or poor reflectivity
 * 
 * This driver integrates with AmplitudeFilter for weather-resilient measurements.
 */

import {
  LaserDriver,
  LaserProfileConfig,
  LaserDriverStats,
  NormalizedLaserMeasurement
} from './types';
import { AmplitudeFilter, AmplitudeFilterSettings, FilteredMeasurement } from './amplitudeFilter';

export interface LDM71MeasurementWithAmplitude extends NormalizedLaserMeasurement {
  amplitudeDb?: number;
  filtered?: boolean;
  filterReason?: string;
  rawLine?: string;
}

export class LDM71AsciiDriver implements LaserDriver {
  public readonly profile: LaserProfileConfig;
  
  private buffer: string = '';
  private amplitudeFilter: AmplitudeFilter;
  private filterEnabled: boolean;
  private rawLineCallback: ((line: string) => void) | null = null;
  private stats: LaserDriverStats = {
    framesReceived: 0,
    framesValid: 0,
    framesInvalid: 0,
    resyncCount: 0,
    lastMeasurement: null,
    bytesProcessed: 0
  };

  private textDecoder = new TextDecoder('utf-8');
  private textEncoder = new TextEncoder();

  private static readonly LINE_REGEX = /^D\s+(\d+\.\d+)(?:\s+(\d+\.?\d*))?\s*$/;
  private static readonly ERROR_REGEX = /^([Dd][Ee]\d+|E\d+)$/;
  private static readonly COMMAND_REGEX = /^(DM|DT|LE|LD|TP)$/;

  constructor(profile: LaserProfileConfig, amplitudeFilter?: AmplitudeFilter) {
    this.profile = profile;
    this.amplitudeFilter = amplitudeFilter ?? new AmplitudeFilter();
    this.filterEnabled = profile.options?.amplitudeFilterEnabled ?? true;
    
    console.log('[LDM71 Driver] Using isolated amplitude filter instance');
  }

  setRawLineCallback(fn: ((line: string) => void) | null): void {
    this.rawLineCallback = fn;
  }

  getAmplitudeFilter(): AmplitudeFilter {
    return this.amplitudeFilter;
  }

  setFilterEnabled(enabled: boolean): void {
    this.filterEnabled = enabled;
    console.log(`[LDM71 Driver] Amplitude filter ${enabled ? 'enabled' : 'disabled'}`);
  }

  isFilterEnabled(): boolean {
    return this.filterEnabled;
  }

  async onOpen(_port: SerialPort): Promise<void> {
    this.reset();
    console.log('[LDM71 Driver] Port opened, driver initialized');
  }

  async startStreaming(port: SerialPort): Promise<void> {
    const cmd = this.profile.startCommand ?? 'DT\r';
    await this.writeAscii(port, cmd);
    console.log('[LDM71 Driver] Started streaming with command:', JSON.stringify(cmd));
  }

  async stopStreaming(port: SerialPort): Promise<void> {
    const cmd = this.profile.stopCommand ?? '\x1B';
    await this.writeAscii(port, cmd);
    console.log('[LDM71 Driver] Stopped streaming');
  }

  private async writeAscii(port: SerialPort, text: string): Promise<void> {
    if (!port.writable) {
      console.warn('[LDM71 Driver] Port not writable');
      return;
    }
    const writer = port.writable.getWriter();
    try {
      await writer.write(this.textEncoder.encode(text));
    } finally {
      writer.releaseLock();
    }
  }

  feedBytes(chunk: Uint8Array): LDM71MeasurementWithAmplitude[] {
    const results: LDM71MeasurementWithAmplitude[] = [];
    const now = Date.now();

    this.stats.bytesProcessed += chunk.length;

    const text = this.textDecoder.decode(chunk, { stream: true });
    this.buffer += text;

    if (this.stats.framesReceived < 5) {
      console.log(`[LDM71 RAW] ${chunk.length} bytes: "${text.replace(/\r/g, '\\r').replace(/\n/g, '\\n')}"`);
    }

    let lineEndIndex: number;
    while ((lineEndIndex = this.buffer.indexOf('\n')) !== -1) {
      let line = this.buffer.substring(0, lineEndIndex);
      this.buffer = this.buffer.substring(lineEndIndex + 1);

      line = line.replace(/\r$/, '').trim();
      
      if (line.length === 0) continue;

      this.stats.framesReceived++;

      // Emit every received line verbatim to the raw output callback before any processing
      this.rawLineCallback?.(line);

      const measurement = this.parseLine(line, now);
      if (measurement) {
        this.stats.framesValid++;
        this.stats.lastMeasurement = measurement;
        measurement.rawLine = line;
        results.push(measurement);
      } else {
        this.stats.framesInvalid++;
        if (this.stats.framesInvalid <= 10 || this.stats.framesInvalid % 100 === 0) {
          console.warn(`[LDM71 Driver] Invalid line #${this.stats.framesInvalid}: "${line}"`);
        }
      }
    }

    if (this.buffer.length > 1024) {
      console.warn('[LDM71 Driver] Buffer overflow, clearing');
      this.buffer = '';
      this.stats.resyncCount++;
    }

    return results;
  }

  private parseLine(line: string, timestamp: number): LDM71MeasurementWithAmplitude | null {
    if (LDM71AsciiDriver.ERROR_REGEX.test(line)) {
      return {
        distanceM: null,
        intensity: 0,
        timestamp,
        quality: 'invalid',
        error: `No target (${line})`,
        filtered: false
      };
    }

    if (LDM71AsciiDriver.COMMAND_REGEX.test(line)) {
      return null;
    }

    const match = line.match(LDM71AsciiDriver.LINE_REGEX);
    
    if (!match) {
      return null;
    }

    const rawDistanceM = parseFloat(match[1]);
    if (isNaN(rawDistanceM)) {
      return null;
    }

    // Amplitude is optional — some SolTec models (30m, 70m) may send distance only
    const amplitudeDb: number | undefined = match[2] !== undefined ? parseFloat(match[2]) : undefined;
    const hasAmplitude = amplitudeDb !== undefined && !isNaN(amplitudeDb);

    const distanceM = Math.round(rawDistanceM * 100) / 100;

    const maxRange = this.profile.options?.maxRangeM ?? 100;
    const minRange = this.profile.options?.minRangeM ?? 0;

    if (distanceM < minRange || distanceM > maxRange) {
      return {
        distanceM: null,
        amplitudeDb: hasAmplitude ? amplitudeDb : undefined,
        intensity: hasAmplitude ? Math.round(amplitudeDb! * 10) : 0,
        timestamp,
        quality: 'invalid',
        error: `Distance ${distanceM}m out of range [${minRange}, ${maxRange}]`,
        filtered: false
      };
    }

    // Only apply amplitude filter when enabled AND amplitude data is available
    if (this.filterEnabled && hasAmplitude) {
      const filterResult: FilteredMeasurement = this.amplitudeFilter.filter(distanceM, amplitudeDb!);
      
      if (!filterResult.accepted) {
        return {
          distanceM: null,
          amplitudeDb,
          intensity: Math.round(amplitudeDb! * 10),
          timestamp,
          quality: 'weak',
          error: filterResult.reason,
          filtered: true,
          filterReason: filterResult.reason
        };
      }
    }

    // Measurement has passed all active filters (or filters were skipped).
    // Always mark as 'good' — never penalise based on filter being disabled or amplitude being absent.
    const quality: 'good' = 'good';

    return {
      distanceM,
      amplitudeDb: hasAmplitude ? amplitudeDb : undefined,
      intensity: hasAmplitude ? Math.round(amplitudeDb! * 10) : 0,
      timestamp,
      quality,
      filtered: false
    };
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
    this.amplitudeFilter.reset();
    console.log('[LDM71 Driver] Reset');
  }

  getStats(): LaserDriverStats {
    return { ...this.stats };
  }

  getAmplitudeStats() {
    return this.amplitudeFilter.getStats();
  }

  getDebugInfo(): string {
    const filterInfo = this.amplitudeFilter.getDebugInfo();
    return `[LDM71 Driver] Frames: ${this.stats.framesValid}/${this.stats.framesReceived}, ` +
      `Invalid: ${this.stats.framesInvalid}, Resyncs: ${this.stats.resyncCount}\n${filterInfo}`;
  }
}
