/**
 * Laser Hardware Abstraction Types
 * Provides a modular driver architecture for different laser protocols
 */

export type LaserProtocolType =
  | 'ldm71_ascii';

export interface LaserProfileConfig {
  id: string;
  name: string;
  baudRate: number;
  dataBits: 7 | 8;
  parity: 'none' | 'even' | 'odd';
  stopBits: 1 | 2;
  flowControl: 'none' | 'hardware';
  protocol: LaserProtocolType;
  startCommand?: string;
  stopCommand?: string;
  options?: {
    maxRangeM?: number;
    minRangeM?: number;
    intensityThreshold?: number;
    resyncOnError?: boolean;
    [key: string]: any;
  };
}

export interface NormalizedLaserMeasurement {
  distanceM: number | null;
  intensity?: number;
  timestamp: number;
  quality?: 'good' | 'weak' | 'invalid' | 'sky' | 'weather_degraded';
  raw?: Uint8Array;
  error?: string;
  isSky?: boolean;
  weatherQuality?: 'good' | 'acceptable' | 'poor';  // For rain/snow filtering
}

export interface LaserDriver {
  readonly profile: LaserProfileConfig;
  onOpen?(port: SerialPort): Promise<void> | void;
  startStreaming(port: SerialPort): Promise<void> | void;
  stopStreaming(port: SerialPort): Promise<void> | void;
  feedBytes(chunk: Uint8Array): NormalizedLaserMeasurement[];
  reset(): void;
  getStats(): LaserDriverStats;
}

export interface LaserDriverStats {
  framesReceived: number;
  framesValid: number;
  framesInvalid: number;
  resyncCount: number;
  lastMeasurement: NormalizedLaserMeasurement | null;
  bytesProcessed: number;
}

export type MeasurementListener = (measurement: NormalizedLaserMeasurement) => void;

export interface LaserServiceState {
  isConnected: boolean;
  isStreaming: boolean;
  lastMeasurement: NormalizedLaserMeasurement | null;
  error: string | null;
  stats: LaserDriverStats;
}
