export type FilterSensitivity = 'off' | 'low' | 'medium' | 'high';

export interface FilterConfig {
  sensitivity: FilterSensitivity;
  windowSize: number;
  consistencyThreshold: number;
  minConsistentReadings: number;
}

export interface FilterResult {
  accepted: boolean;
  value: number | null;
  confidence: number;
  reason: 'valid' | 'noise' | 'pending' | 'error' | 'disabled';
  rawValue: string;
}

const SENSITIVITY_CONFIGS: Record<FilterSensitivity, Omit<FilterConfig, 'sensitivity'>> = {
  off: {
    windowSize: 1,
    consistencyThreshold: Infinity,
    minConsistentReadings: 1,
  },
  low: {
    windowSize: 3,
    consistencyThreshold: 5.0,
    minConsistentReadings: 2,
  },
  medium: {
    windowSize: 5,
    consistencyThreshold: 3.0,
    minConsistentReadings: 3,
  },
  high: {
    windowSize: 7,
    consistencyThreshold: 1.5,
    minConsistentReadings: 4,
  },
};

export class MeasurementFilter {
  private recentMeasurements: number[] = [];
  private sensitivity: FilterSensitivity = 'medium';
  private config: FilterConfig;
  private lastAcceptedValue: number | null = null;
  private pendingCluster: number[] = [];

  constructor(sensitivity: FilterSensitivity = 'medium') {
    this.sensitivity = sensitivity;
    this.config = {
      sensitivity,
      ...SENSITIVITY_CONFIGS[sensitivity],
    };
  }

  setSensitivity(sensitivity: FilterSensitivity): void {
    this.sensitivity = sensitivity;
    this.config = {
      sensitivity,
      ...SENSITIVITY_CONFIGS[sensitivity],
    };
    this.reset();
  }

  getSensitivity(): FilterSensitivity {
    return this.sensitivity;
  }

  reset(): void {
    this.recentMeasurements = [];
    this.lastAcceptedValue = null;
    this.pendingCluster = [];
  }

  filter(rawValue: string): FilterResult {
    if (this.sensitivity === 'off') {
      const numValue = this.parseValue(rawValue);
      return {
        accepted: numValue !== null,
        value: numValue,
        confidence: numValue !== null ? 100 : 0,
        reason: 'disabled',
        rawValue,
      };
    }

    if (rawValue === '--' || rawValue === 'Sky' || rawValue.toLowerCase().includes('error')) {
      return {
        accepted: false,
        value: null,
        confidence: 0,
        reason: 'error',
        rawValue,
      };
    }

    const numValue = this.parseValue(rawValue);
    if (numValue === null || numValue < 0 || numValue > 500) {
      return {
        accepted: false,
        value: null,
        confidence: 0,
        reason: 'error',
        rawValue,
      };
    }

    this.recentMeasurements.push(numValue);
    if (this.recentMeasurements.length > this.config.windowSize) {
      this.recentMeasurements.shift();
    }

    if (this.lastAcceptedValue === null) {
      this.lastAcceptedValue = numValue;
      return {
        accepted: true,
        value: numValue,
        confidence: 50,
        reason: 'valid',
        rawValue,
      };
    }

    const deviation = Math.abs(numValue - this.lastAcceptedValue);

    if (deviation <= this.config.consistencyThreshold) {
      this.lastAcceptedValue = numValue;
      this.pendingCluster = [];
      
      return {
        accepted: true,
        value: numValue,
        confidence: this.calculateConfidence(),
        reason: 'valid',
        rawValue,
      };
    }

    if (this.pendingCluster.length > 0) {
      const clusterMean = this.pendingCluster.reduce((a, b) => a + b, 0) / this.pendingCluster.length;
      const clusterDeviation = Math.abs(numValue - clusterMean);
      
      if (clusterDeviation <= this.config.consistencyThreshold) {
        this.pendingCluster.push(numValue);
        
        if (this.pendingCluster.length >= this.config.minConsistentReadings) {
          const clusterMin = Math.min(...this.pendingCluster);
          this.lastAcceptedValue = clusterMin;
          const result: FilterResult = {
            accepted: true,
            value: clusterMin,
            confidence: 90,
            reason: 'valid',
            rawValue,
          };
          this.pendingCluster = [];
          return result;
        }
        
        return {
          accepted: false,
          value: numValue,
          confidence: (this.pendingCluster.length / this.config.minConsistentReadings) * 100,
          reason: 'pending',
          rawValue,
        };
      }
    }

    this.pendingCluster = [numValue];
    
    return {
      accepted: false,
      value: numValue,
      confidence: (1 / this.config.minConsistentReadings) * 100,
      reason: 'pending',
      rawValue,
    };
  }

  private parseValue(raw: string): number | null {
    const cleaned = raw.trim().replace(/[^\d.-]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
  }

  private calculateConfidence(): number {
    if (this.recentMeasurements.length < 2) {
      return 50;
    }

    const mean = this.recentMeasurements.reduce((a, b) => a + b, 0) / this.recentMeasurements.length;
    const variance = this.recentMeasurements.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / this.recentMeasurements.length;
    const stdDev = Math.sqrt(variance);

    const maxStdDev = this.config.consistencyThreshold;
    const normalizedStdDev = Math.min(stdDev / maxStdDev, 1);
    return Math.round((1 - normalizedStdDev) * 100);
  }

  getLastAcceptedValue(): number | null {
    return this.lastAcceptedValue;
  }

  getPendingCluster(): number[] {
    return [...this.pendingCluster];
  }

  getRecentMeasurements(): number[] {
    return [...this.recentMeasurements];
  }

  getStats(): { windowSize: number; filled: number; lastAccepted: number | null; pendingCount: number } {
    return {
      windowSize: this.config.windowSize,
      filled: this.recentMeasurements.length,
      lastAccepted: this.lastAcceptedValue,
      pendingCount: this.pendingCluster.length,
    };
  }
}

export const defaultMeasurementFilter = new MeasurementFilter('medium');
