/**
 * Laser Profile Definitions
 * Pre-configured profiles for different laser models
 */

import { LaserProfileConfig } from './types';

export const RSA_VERTICAL_CLEARANCE_PROFILE: LaserProfileConfig = {
  id: 'rsa_vclear',
  name: 'RSA Vertical Clearance Laser',
  baudRate: 460800,  // Correct baud rate per RSA specification
  dataBits: 8,
  parity: 'none',
  stopBits: 1,
  flowControl: 'none',
  protocol: 'rsa_3byte',
  startCommand: 'DT\r',
  stopCommand: '\x1B',
  options: {
    maxRangeM: 30,
    minRangeM: 0,
    intensityThreshold: 0,      // Accept all signals including weak (wires have low reflectivity)
    resyncOnError: true,
    // Rain/snow quality filtering thresholds (intensity-based)
    weatherFilter: {
      enabled: false,           // Enable for adverse weather conditions
      minIntensityGood: 100,    // Intensity >= 100: good quality (clear conditions)
      minIntensityAcceptable: 40, // Intensity 40-99: acceptable (light rain/snow)
      // Intensity < 40: poor quality (heavy rain/snow/fog) - marked as 'weather_degraded'
    }
  }
};

export const JENOPTIK_LDS30_PROFILE: LaserProfileConfig = {
  id: 'jenoptik_lds30',
  name: 'Jenoptik LDS-30 (High Pole)',
  baudRate: 115200,
  dataBits: 8,
  parity: 'none',
  stopBits: 1,
  flowControl: 'none',
  protocol: 'jenoptik_ascii',
  startCommand: 'DT\r',
  stopCommand: '\x1B',
  options: {
    maxRangeM: 30,
    minRangeM: 0
  }
};

export const MOCK_LASER_PROFILE: LaserProfileConfig = {
  id: 'mock_laser',
  name: 'Mock Laser (Testing)',
  baudRate: 9600,
  dataBits: 8,
  parity: 'none',
  stopBits: 1,
  flowControl: 'none',
  protocol: 'mock',
  options: {
    maxRangeM: 30,
    minRangeM: 0
  }
};

/**
 * SolTec-30m
 * Outputs ASCII "D XXXX.XXX" (distance only) or "D XXXX.XXX XX.X" (distance + amplitude)
 * Amplitude filtering disabled by default — enable if weather filtering is needed.
 */
export const SOLTEC_30M_PROFILE: LaserProfileConfig = {
  id: 'soltec_30m',
  name: 'SolTec-30m',
  baudRate: 115200,
  dataBits: 8,
  parity: 'none',
  stopBits: 1,
  flowControl: 'none',
  protocol: 'ldm71_ascii',
  startCommand: 'DT\r',
  stopCommand: '\x1B',
  options: {
    maxRangeM: 30,
    minRangeM: 0,
    amplitudeFilterEnabled: false,
    amplitudeFilterSettings: {
      amplitudeThresholdDb: 1.0,
      hysteresisDb: 0.5,
      windowSize: 10,
      autoModeEnabled: false
    }
  }
};

/**
 * SolTec-70m
 * Outputs ASCII "D XXXX.XXX" (distance only) or "D XXXX.XXX XX.X" (distance + amplitude)
 * Amplitude filtering disabled by default — enable if weather filtering is needed.
 */
export const SOLTEC_70M_PROFILE: LaserProfileConfig = {
  id: 'soltec_70m',
  name: 'SolTec-70m',
  baudRate: 115200,
  dataBits: 8,
  parity: 'none',
  stopBits: 1,
  flowControl: 'none',
  protocol: 'ldm71_ascii',
  startCommand: 'DT\r',
  stopCommand: '\x1B',
  options: {
    maxRangeM: 70,
    minRangeM: 0,
    amplitudeFilterEnabled: false,
    amplitudeFilterSettings: {
      amplitudeThresholdDb: 1.0,
      hysteresisDb: 0.5,
      windowSize: 10,
      autoModeEnabled: false
    }
  }
};

/**
 * Jenoptik LDM71 - MeasurePRO Lidar2D V2 / SolTec-2700
 * High-precision distance sensor with amplitude (dB) output for signal quality filtering
 * Output format: "D 0001.724 012.9" (distance in meters, amplitude in dB)
 */
export const LDM71_LIDAR2D_V2_PROFILE: LaserProfileConfig = {
  id: 'ldm71_lidar2d_v2',
  name: 'MeasurePRO Lidar2D V2',
  baudRate: 115200,
  dataBits: 8,
  parity: 'none',
  stopBits: 1,
  flowControl: 'none',
  protocol: 'ldm71_ascii',
  startCommand: 'DT\r',
  stopCommand: '\x1B',
  options: {
    maxRangeM: 100,
    minRangeM: 0,
    amplitudeFilterEnabled: true,
    amplitudeFilterSettings: {
      amplitudeThresholdDb: 1.0,
      hysteresisDb: 0.5,
      windowSize: 10,
      autoModeEnabled: false
    }
  }
};

export const LASER_PROFILES: Record<string, LaserProfileConfig> = {
  'rsa_vclear': RSA_VERTICAL_CLEARANCE_PROFILE,
  'jenoptik_lds30': JENOPTIK_LDS30_PROFILE,
  'soltec_30m': SOLTEC_30M_PROFILE,
  'soltec_70m': SOLTEC_70M_PROFILE,
  'ldm71_lidar2d_v2': LDM71_LIDAR2D_V2_PROFILE,
  'mock_laser': MOCK_LASER_PROFILE
};

export function getLaserProfile(id: string): LaserProfileConfig | undefined {
  return LASER_PROFILES[id];
}

export function getAllLaserProfiles(): LaserProfileConfig[] {
  return Object.values(LASER_PROFILES);
}
