/**
 * Laser Profile Definitions
 * Internal configurations — no brand/model names exposed to user
 */

import { LaserProfileConfig } from './types';

export const SOLTEC_30M_PROFILE: LaserProfileConfig = {
  id: 'standard_ascii',
  name: 'Standard ASCII',
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
    amplitudeFilterEnabled: false,
    amplitudeFilterSettings: {
      amplitudeThresholdDb: 1.0,
      hysteresisDb: 0.5,
      windowSize: 10,
      autoModeEnabled: false
    }
  }
};

// Keep aliases for backward compatibility with stored settings
export const SOLTEC_70M_PROFILE = SOLTEC_30M_PROFILE;
export const LDM71_LIDAR2D_V2_PROFILE = { ...SOLTEC_30M_PROFILE, id: 'standard_ascii_amp', name: 'Standard ASCII + Amplitude', options: { ...SOLTEC_30M_PROFILE.options, amplitudeFilterEnabled: true } };
export const JENOPTIK_LDS30_PROFILE = SOLTEC_30M_PROFILE;

export const RSA_VERTICAL_CLEARANCE_PROFILE: LaserProfileConfig = {
  id: 'binary_3byte',
  name: 'Binary 3-byte',
  baudRate: 460800,
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
    intensityThreshold: 0,
    resyncOnError: true,
    weatherFilter: {
      enabled: false,
      minIntensityGood: 100,
      minIntensityAcceptable: 40,
    }
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

export const LASER_PROFILES: Record<string, LaserProfileConfig> = {
  'standard_ascii': SOLTEC_30M_PROFILE,
  'binary_3byte': RSA_VERTICAL_CLEARANCE_PROFILE,
  'mock_laser': MOCK_LASER_PROFILE,
  // Backward compat keys
  'rsa_vclear': RSA_VERTICAL_CLEARANCE_PROFILE,
  'jenoptik_lds30': SOLTEC_30M_PROFILE,
  'soltec_30m': SOLTEC_30M_PROFILE,
  'soltec_70m': SOLTEC_30M_PROFILE,
  'ldm71_lidar2d_v2': LDM71_LIDAR2D_V2_PROFILE,
};

export function getLaserProfile(id: string): LaserProfileConfig | undefined {
  return LASER_PROFILES[id];
}

export function getAllLaserProfiles(): LaserProfileConfig[] {
  return [SOLTEC_30M_PROFILE, RSA_VERTICAL_CLEARANCE_PROFILE];
}
