/**
 * Laser Profile — single configuration for all SolTec lasers
 * Protocol: ASCII "D xxxx.xxx" or "D xxxx.xxx xx.x" (with amplitude)
 * Error codes: DE02, E### = sky/no return
 */

import { LaserProfileConfig } from './types';

export const SOLTEC_30M_PROFILE: LaserProfileConfig = {
  id: 'standard',
  name: 'SolTec Laser',
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

// Backward compat aliases — all point to the same config
export const SOLTEC_70M_PROFILE = SOLTEC_30M_PROFILE;
export const LDM71_LIDAR2D_V2_PROFILE = SOLTEC_30M_PROFILE;
export const MOCK_LASER_PROFILE = SOLTEC_30M_PROFILE;

export function getLaserProfile(_id: string): LaserProfileConfig {
  return SOLTEC_30M_PROFILE;
}

export function getAllLaserProfiles(): LaserProfileConfig[] {
  return [SOLTEC_30M_PROFILE];
}
