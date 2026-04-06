/**
 * Amplitude-Based Signal Filter for LiDAR Measurements
 * 
 * AMPLITUDE & SIGNAL RELIABILITY:
 * Amplitude (measured in dB) represents the strength of the returned laser signal.
 * Higher amplitude indicates a stronger, more reliable reflection from the target.
 * 
 * Low amplitude readings often indicate:
 * - Rain: Water droplets scatter and absorb laser energy (15-50% range reduction)
 * - Fog: Dense moisture particles cause severe scattering
 * - Snow: Ice crystals create false returns and signal attenuation
 * - Dust: Airborne particles block and scatter the beam
 * - Poor reflectivity: Dark or angled surfaces reflect less energy
 * - Edge hits: Partial beam returns from object edges
 * 
 * By rejecting measurements below a configurable amplitude threshold,
 * we can filter out unreliable data caused by adverse conditions.
 */

export interface AmplitudeFilterSettings {
  amplitudeThresholdDb: number;
  hysteresisDb: number;
  windowSize: number;
  autoModeEnabled: boolean;
}

export interface AmplitudeFilterStats {
  accepted: number;
  rejected: number;
  currentThreshold: number;
  suggestedThreshold: number | null;
  averageAmplitude: number | null;
  lastAmplitude: number | null;
  filterState: 'accepting' | 'rejecting';
}

export interface FilteredMeasurement {
  distanceM: number;
  amplitudeDb: number;
  accepted: boolean;
  reason?: string;
}

export class AmplitudeFilter {
  private settings: AmplitudeFilterSettings;
  private amplitudeHistory: number[] = [];
  private stats: AmplitudeFilterStats;
  private currentState: 'accepting' | 'rejecting' = 'accepting';
  private listeners: Set<(stats: AmplitudeFilterStats) => void> = new Set();

  constructor(settings?: Partial<AmplitudeFilterSettings>) {
    this.settings = {
      amplitudeThresholdDb: 1.0,
      hysteresisDb: 0.5,
      windowSize: 10,
      autoModeEnabled: false,
      ...settings
    };

    this.stats = {
      accepted: 0,
      rejected: 0,
      currentThreshold: this.settings.amplitudeThresholdDb,
      suggestedThreshold: null,
      averageAmplitude: null,
      lastAmplitude: null,
      filterState: 'accepting'
    };
  }

  updateSettings(newSettings: Partial<AmplitudeFilterSettings>): void {
    this.settings = { ...this.settings, ...newSettings };
    this.stats.currentThreshold = this.settings.amplitudeThresholdDb;
    console.log('[AmplitudeFilter] Settings updated:', this.settings);
    this.notifyListeners();
  }

  getSettings(): AmplitudeFilterSettings {
    return { ...this.settings };
  }

  getStats(): AmplitudeFilterStats {
    return { ...this.stats };
  }

  addStatsListener(fn: (stats: AmplitudeFilterStats) => void): void {
    this.listeners.add(fn);
  }

  removeStatsListener(fn: (stats: AmplitudeFilterStats) => void): void {
    this.listeners.delete(fn);
  }

  private notifyListeners(): void {
    const stats = this.getStats();
    for (const fn of this.listeners) {
      try {
        fn(stats);
      } catch (err) {
        console.error('[AmplitudeFilter] Listener error:', err);
      }
    }
  }

  filter(distanceM: number, amplitudeDb: number): FilteredMeasurement {
    this.stats.lastAmplitude = amplitudeDb;
    
    this.amplitudeHistory.push(amplitudeDb);
    if (this.amplitudeHistory.length > this.settings.windowSize) {
      this.amplitudeHistory.shift();
    }

    this.stats.averageAmplitude = this.amplitudeHistory.length > 0
      ? this.amplitudeHistory.reduce((a, b) => a + b, 0) / this.amplitudeHistory.length
      : null;

    if (this.settings.autoModeEnabled) {
      this.updateAutoSuggestion();
    }

    const threshold = this.settings.amplitudeThresholdDb;
    const hysteresis = this.settings.hysteresisDb;

    let accepted: boolean;
    let reason: string | undefined;

    if (this.currentState === 'accepting') {
      if (amplitudeDb < threshold - hysteresis) {
        this.currentState = 'rejecting';
        accepted = false;
        reason = `Amplitude ${amplitudeDb.toFixed(1)} dB below threshold ${threshold.toFixed(1)} dB (hysteresis ${hysteresis.toFixed(1)} dB)`;
      } else {
        accepted = true;
      }
    } else {
      if (amplitudeDb >= threshold + hysteresis) {
        this.currentState = 'accepting';
        accepted = true;
        reason = `Amplitude recovered to ${amplitudeDb.toFixed(1)} dB`;
      } else {
        accepted = false;
        reason = `Amplitude ${amplitudeDb.toFixed(1)} dB still below threshold ${threshold.toFixed(1)} dB`;
      }
    }

    if (accepted) {
      this.stats.accepted++;
    } else {
      this.stats.rejected++;
    }
    this.stats.filterState = this.currentState;

    if (this.stats.accepted % 100 === 0 || this.stats.rejected % 50 === 0) {
      this.notifyListeners();
    }

    const result: FilteredMeasurement = {
      distanceM,
      amplitudeDb,
      accepted,
      reason
    };

    if (!accepted && (this.stats.rejected % 10 === 1)) {
      console.log(`[AmplitudeFilter] REJECTED: distance=${distanceM.toFixed(2)}m, amplitude=${amplitudeDb.toFixed(1)}dB, reason=${reason}`);
    }

    return result;
  }

  private updateAutoSuggestion(): void {
    if (this.amplitudeHistory.length < this.settings.windowSize) {
      return;
    }

    const sorted = [...this.amplitudeHistory].sort((a, b) => a - b);
    const p10 = sorted[Math.floor(sorted.length * 0.1)];
    const p90 = sorted[Math.floor(sorted.length * 0.9)];
    const range = p90 - p10;

    if (range < 5) {
      const mean = this.stats.averageAmplitude ?? 0;
      this.stats.suggestedThreshold = Math.max(5, mean - (range * 0.5) - 2);
    } else {
      this.stats.suggestedThreshold = null;
    }
  }

  applySuggestedThreshold(): boolean {
    if (this.stats.suggestedThreshold !== null) {
      this.updateSettings({ amplitudeThresholdDb: this.stats.suggestedThreshold });
      console.log(`[AmplitudeFilter] Applied suggested threshold: ${this.stats.suggestedThreshold.toFixed(1)} dB`);
      return true;
    }
    return false;
  }

  reset(): void {
    this.amplitudeHistory = [];
    this.currentState = 'accepting';
    this.stats = {
      accepted: 0,
      rejected: 0,
      currentThreshold: this.settings.amplitudeThresholdDb,
      suggestedThreshold: null,
      averageAmplitude: null,
      lastAmplitude: null,
      filterState: 'accepting'
    };
    this.notifyListeners();
    console.log('[AmplitudeFilter] Reset');
  }

  getAcceptanceRate(): number {
    const total = this.stats.accepted + this.stats.rejected;
    return total > 0 ? this.stats.accepted / total : 1;
  }

  getDebugInfo(): string {
    const rate = (this.getAcceptanceRate() * 100).toFixed(1);
    return `[AmplitudeFilter] Accepted: ${this.stats.accepted}, Rejected: ${this.stats.rejected}, Rate: ${rate}%, ` +
      `Threshold: ${this.settings.amplitudeThresholdDb.toFixed(1)} dB, Avg: ${this.stats.averageAmplitude?.toFixed(1) ?? 'N/A'} dB`;
  }
}

