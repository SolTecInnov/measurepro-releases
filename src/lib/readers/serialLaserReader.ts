import { useSerialStore } from '../stores/serialStore';
import { appendToLaserOutput } from '../laserLog';
import { SOLTEC_30M_PROFILE } from '../hardware/laser/profiles';
import { useMeasurementFilterStore } from '../stores/measurementFilterStore';
import { LDM71AsciiDriver, LDM71MeasurementWithAmplitude } from '../hardware/laser/ldm71AsciiDriver';
import { useAmplitudeFilterStore } from '../stores/amplitudeFilterStore';
import { AmplitudeFilter } from '../hardware/laser/amplitudeFilter';

// Fix 5: Module-level DE02 deduplication
let lastErrorCode = "";
let lastErrorCount = 0;
let errorFlushTimeout: ReturnType<typeof setTimeout> | null = null;

function logLaserError(code: string) {
  if (code === lastErrorCode) {
    lastErrorCount++;
    if (errorFlushTimeout) clearTimeout(errorFlushTimeout);
    errorFlushTimeout = setTimeout(() => {
      if (lastErrorCount > 1) {
        appendToLaserOutput(`[ERR] ${lastErrorCode} ×${lastErrorCount}`);
      }
      lastErrorCount = 0;
      lastErrorCode = "";
    }, 500);
  } else {
    if (lastErrorCount > 0) {
      appendToLaserOutput(`[ERR] ${lastErrorCode} ×${lastErrorCount}`);
    }
    lastErrorCode = code;
    lastErrorCount = 1;
    appendToLaserOutput(`[ERR] ${code}`);
    if (errorFlushTimeout) clearTimeout(errorFlushTimeout);
    errorFlushTimeout = setTimeout(() => {
      lastErrorCount = 0;
      lastErrorCode = "";
    }, 500);
  }
}

export class LaserReader {
  private buffer: string = '';
  private callbacks: Set<(data: string) => void> = new Set();
  private readonly MAX_BUFFER_SIZE = 8192;
  private laserType: string = 'soltec-standard';
  private lastValidMeasurement: string = '--';
  private ldm71Driver: LDM71AsciiDriver | null = null;

  constructor() {
    // Always initialize with the standard driver — it handles both D xxxx.xxx and D xxxx.xxx xx.x
    // Falls back to generic ASCII parsing for any other format automatically
    const amplitudeFilter = this.createFreshAmplitudeFilter();
    this.ldm71Driver = new LDM71AsciiDriver(SOLTEC_30M_PROFILE, amplitudeFilter);
    this.ldm71Driver.setRawLineCallback((line) => appendToLaserOutput(line));
  }

  setLaserType(_type: string) {
    // Auto-detection: always use the standard driver which handles all known ASCII formats.
    // The processData pipeline tries LDM71 first, then falls back to generic ASCII.
    const amplitudeFilter = this.createFreshAmplitudeFilter();
    this.ldm71Driver = new LDM71AsciiDriver(SOLTEC_30M_PROFILE, amplitudeFilter);
    this.ldm71Driver.setRawLineCallback((line) => appendToLaserOutput(line));
    this.reset();
  }

  setAmplitudeFilterEnabled(enabled: boolean): void {
    if (this.ldm71Driver) {
      this.ldm71Driver.setFilterEnabled(enabled);
    }
  }

  private createFreshAmplitudeFilter(): AmplitudeFilter {
    const storeState = useAmplitudeFilterStore.getState();
    const filter = new AmplitudeFilter();
    filter.updateSettings(storeState.settings);
    return filter;
  }

  /**
   * Emit measurement — called from processAsciiData / processLdm71Data.
   *
   * Pipeline:
   *   1. Reject sky/error codes (→ store '--')
   *   2. Run MeasurementFilter (quality tracking only — filter NEVER blocks display)
   *   3. setLastLaserData(displayMeasurement) → updates Zustand store once
   *
   * ABSOLUTE RULE: setLastLaserData is called immediately and synchronously on every
   * valid measurement — no throttle, no buffer, no delay.
   */
  private emitMeasurement(measurement: string): void {
    if (measurement === 'Sky' || measurement === '--' || measurement === 'DE02' || measurement === 'De02') {
      useSerialStore.getState().setLastLaserData('--');
      return;
    }

    const filterStore = useMeasurementFilterStore.getState();
    const filterResult = filterStore.filterMeasurement(measurement);
    
    if (!filterResult.accepted && filterStore.enabled) {
      window.dispatchEvent(new CustomEvent('measurement-filtered', { 
        detail: { raw: measurement, result: filterResult }
      }));
    }
    
    const displayMeasurement = (filterResult.accepted && filterResult.value !== null)
      ? filterResult.value.toFixed(3) 
      : measurement;
    
    this.lastValidMeasurement = displayMeasurement;

    this.notifyCallbacks(displayMeasurement);
    useSerialStore.getState().setLastLaserData(displayMeasurement);
  }

  processData(chunk: Uint8Array): void {
    // Always try the standard driver first (handles D xxxx.xxx with/without amplitude)
    // Falls back to generic ASCII for other formats
    if (this.ldm71Driver) {
      this.processLdm71Data(chunk);
      return;
    }
    this.processAsciiData(chunk);
  }

  private processLdm71Data(chunk: Uint8Array): void {
    // Raw output is handled by the driver's rawLineCallback (set in setLaserType).
    // Every serial line is logged verbatim once before parsing — no synthetic messages here.
    const measurements: LDM71MeasurementWithAmplitude[] = this.ldm71Driver!.feedBytes(chunk);

    for (const m of measurements) {
      if (m.distanceM !== null) {
        this.emitMeasurement(m.distanceM.toFixed(3));
      } else {
        this.emitMeasurement('--');
      }

      if (m.amplitudeDb !== undefined) {
        try {
          const driverFilter = this.ldm71Driver!.getAmplitudeFilter();
          useAmplitudeFilterStore.getState().updateStats(driverFilter.getStats());
        } catch (_e) {}
      }
    }
  }

  private processAsciiData(chunk: Uint8Array): void {
    if (chunk.length > this.MAX_BUFFER_SIZE) {
      chunk = chunk.slice(-this.MAX_BUFFER_SIZE);
    }
    
    const decoder = new TextDecoder('ascii');
    const text = decoder.decode(chunk, { stream: true });
    
    this.buffer += text;

    if (this.buffer.length > this.MAX_BUFFER_SIZE) {
      const keepSize = Math.floor(this.MAX_BUFFER_SIZE * 0.75);
      this.buffer = this.buffer.slice(-keepSize);
    }

    const lines = this.buffer.split(/\r\n|\r|\n/);
    this.buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      
      if (!trimmed) continue;
      
      if (this.isGPSData(trimmed)) {
        appendToLaserOutput(`[FILTERED GPS] ${trimmed}`);
        continue;
      }
      
      if (this.isStandardLaserData(trimmed)) {
        // Fix 5: deduplicate DE02 errors
        if (trimmed === 'De02' || trimmed === 'DE02') {
          logLaserError(trimmed);
          this.emitMeasurement('--');
          continue;
        }

        const measurement = this.parseJenoptikMeasurement(trimmed);
        if (measurement !== null) {
          appendToLaserOutput(`[LASER] ${trimmed} -> ${measurement}m`);
          this.emitMeasurement(measurement);
        } else {
          appendToLaserOutput(`[COMMAND] ${trimmed}`);
        }
      } else {
        const genericMeasurement = this.parseGenericMeasurement(trimmed);
        if (genericMeasurement !== null) {
          appendToLaserOutput(`[LASER] ${trimmed} -> ${genericMeasurement}m`);
          this.emitMeasurement(genericMeasurement);
        } else {
          appendToLaserOutput(`[UNKNOWN] ${trimmed}`);
        }
      }
    }
  }

  private isGPSData(data: string): boolean {
    const gpsPatterns = [
      /^\$GP/,
      /^\$GN/,
      /^\$GL/,
      /^\$GA/,
      /^\$BD/,
      /^\$P/,
      /,\d+\.\d+,[NS],\d+\.\d+,[EW],/,
      /\d{6}\.\d+,A,/,
      /,\*[0-9A-F]{2}$/,
    ];
    
    return gpsPatterns.some(pattern => pattern.test(data));
  }

  private isStandardLaserData(data: string): boolean {
    const jenoptikPatterns = [
      /^D\s+\d+\.\d+/,
      /^De02$/,
      /^DE02$/,
      /^E\d+$/,
      /^DM$/,
      /^DT$/,
      /^LE$/,
      /^LD$/,
      /^TP\s+\d+/,
      /^TP$/,
    ];
    
    return jenoptikPatterns.some(pattern => pattern.test(data));
  }

  private parseJenoptikMeasurement(data: string): string | null {
    const trimmed = data.trim();
    
    if (trimmed === 'De02' || trimmed === 'DE02') {
      return '--';
    }
    
    const measurementMatch = trimmed.match(/^D\s+(\d+\.\d+)(?:\s+\d+\.?\d*)?$/);
    if (measurementMatch) {
      const rawValue = measurementMatch[1];
      const meters = parseFloat(rawValue);
      
      if (!isNaN(meters)) {
        return meters.toString();
      }
    }
    
    if (trimmed.startsWith('E')) {
      return '--';
    }
    
    if (/^(DM|DT|LE|LD|TP)$/.test(trimmed)) {
      return null;
    }
    
    if (trimmed.startsWith('TP ')) {
      return null;
    }
    
    return null;
  }

  /**
   * Parse generic ASCII measurement format (SolTec legacy and other lasers)
   */
  private parseGenericMeasurement(data: string): string | null {
    const trimmed = data.trim();
    
    if (/^(ERR|ERROR|E\d{2}|INVALID|--)/i.test(trimmed)) {
      return '--';
    }
    
    if (/^(OK|READY|s0[a-z])/i.test(trimmed)) {
      return null;
    }
    
    const numericMatch = trimmed.match(/^[A-Z]?([+-]?\d+\.?\d*)$/);
    if (numericMatch) {
      let value = parseFloat(numericMatch[1]);
      if (!isNaN(value) && value >= 0) {
        if (value > 100 && value < 100000 && !trimmed.includes('.')) {
          value = value / 1000;
        }
        
        if (value >= 0 && value <= 100) {
          return value.toFixed(3);
        }
      }
    }
    
    return null;
  }

  private notifyCallbacks(data: string): void {
    this.callbacks.forEach(cb => {
      try {
        cb(data);
      } catch (err) {
      }
    });
  }

  registerCallback(callback: (data: string) => void): void {
    this.callbacks.add(callback);
  }

  unregisterCallback(callback: (data: string) => void): void {
    this.callbacks.delete(callback);
  }

  clearCallbacks(): void {
    this.callbacks.clear();
  }

  reset(): void {
    this.buffer = '';
    this.lastValidMeasurement = '--';
    if (this.ldm71Driver) {
      this.ldm71Driver.reset();
    }
  }

  getLastValidMeasurement(): string {
    return this.lastValidMeasurement;
  }

  getStats(): { framesValid: number; framesInvalid: number; resyncCount: number } | null {
    if (this.ldm71Driver) {
      const stats = this.ldm71Driver.getStats();
      return {
        framesValid: stats.framesValid,
        framesInvalid: stats.framesInvalid,
        resyncCount: stats.resyncCount
      };
    }
    return null;
  }
}
