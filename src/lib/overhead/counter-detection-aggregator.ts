import type { Sample, POI } from './types';

export interface CounterDetectionConfig {
  counterThreshold: number;      // Number of clear readings to emit POI (5-20, default 10)
  ignoreBelow: number;           // Minimum valid height (from alert settings)
  ignoreAbove: number;           // Maximum valid height (from alert settings)
  groundReference: number;       // Ground reference height to add to measurements
}

interface CounterDetectionState {
  counter: number;
  minHeight: number | null;
  minSample: Sample | null;
}

const DEFAULT_CONFIG: CounterDetectionConfig = {
  counterThreshold: 5,
  ignoreBelow: 3,
  ignoreAbove: 25,
  groundReference: 0
};

const STORAGE_KEY = 'overhead_detection_config';

export class CounterDetectionAggregator {
  private config: CounterDetectionConfig;
  private state: CounterDetectionState;
  private eventsEmittedTotal: number = 0;

  constructor(config?: Partial<CounterDetectionConfig>) {
    // Load config from localStorage or use defaults
    this.config = this.loadConfig();
    
    // Merge with provided config
    if (config) {
      this.config = { ...this.config, ...config };
      this.saveConfig();
    }

    // Initialize state
    this.state = {
      counter: 0,
      minHeight: null,
      minSample: null
    };
  }

  private loadConfig(): CounterDetectionConfig {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return { ...DEFAULT_CONFIG, ...parsed };
      }
    } catch (err) {
    }
    return { ...DEFAULT_CONFIG };
  }

  private saveConfig(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.config));
    } catch (err) {
    }
  }

  /**
   * Feed a new sample to the aggregator
   * Returns array of POIs if counter threshold is reached
   */
  feed(sample: Sample): POI[] {
    const { rawDistM } = sample;
    const { ignoreBelow, ignoreAbove, counterThreshold } = this.config;

    // Determine if this is a clear reading (sky or invalid)
    const isClear = 
      rawDistM === null || 
      rawDistM === undefined || 
      rawDistM <= ignoreBelow || 
      rawDistM >= ignoreAbove;

    if (isClear) {
      // Clear reading: increment counter
      this.state.counter++;

      // Check if counter reached threshold
      if (this.state.counter >= counterThreshold) {
        // Emit POI if we have a minimum sample
        if (this.state.minSample !== null && this.state.minHeight !== null) {
          const poi = this.emitPOI();
          this.reset();
          return poi ? [poi] : [];
        } else {
          // No minimum detected, just reset
          this.reset();
        }
      }
    } else {
      // Valid object reading
      
      // Reset counter on first valid reading
      this.state.counter = 0;

      // Update minimum if this is lower
      if (this.state.minHeight === null || rawDistM < this.state.minHeight) {
        this.state.minHeight = rawDistM;
        this.state.minSample = sample;
      }
    }

    return [];
  }

  private emitPOI(): POI | null {
    if (this.state.minSample === null || this.state.minHeight === null) {
      return null;
    }

    const { minHeight, minSample } = this.state;

    // NOTE: Ground reference is now already included in minHeight (applied during sample creation)
    // No need to add it again here - samples come in with ground reference already applied

    // CRITICAL FIX: Use crypto.randomUUID() for truly globally unique IDs
    // This survives component remounts and browser refreshes
    const id = typeof crypto !== 'undefined' && crypto.randomUUID 
      ? crypto.randomUUID() 
      : `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const poi: POI = {
      id,
      kind: 'overhead',
      distance_m: Math.round(minHeight * 100) / 100, // Round to 2 decimals
      lat: minSample.lat,
      lon: minSample.lon,
      s_from_start_m: 0, // Not tracking distance in this mode
      t: minSample.t,
      source: 'laser',
      tags: ['counter_detection']
    };

    this.eventsEmittedTotal++;

    return poi;
  }

  /**
   * Reset state (counter and minimum tracking)
   */
  reset(): void {
    this.state = {
      counter: 0,
      minHeight: null,
      minSample: null
    };
  }

  /**
   * Update configuration
   */
  setConfig(config: Partial<CounterDetectionConfig>): void {
    this.config = { ...this.config, ...config };
    this.saveConfig();
  }

  /**
   * Get current configuration
   */
  getConfig(): CounterDetectionConfig {
    return { ...this.config };
  }

  /**
   * Get current state for debugging
   */
  getState(): CounterDetectionState & { eventsEmittedTotal: number } {
    return {
      ...this.state,
      eventsEmittedTotal: this.eventsEmittedTotal
    };
  }

  /**
   * Get diagnostics string
   */
  getDiagnostics(): string {
    const { counter, minHeight, minSample } = this.state;
    return `Counter: ${counter}/${this.config.counterThreshold}, MinHeight: ${minHeight?.toFixed(2) || 'null'}m, HasGPS: ${!!minSample}, TotalEvents: ${this.eventsEmittedTotal}`;
  }
}
