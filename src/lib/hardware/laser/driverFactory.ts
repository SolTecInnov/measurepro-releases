/**
 * Laser Driver Factory
 * Creates the appropriate driver instance based on protocol type
 */

import { LaserDriver, LaserProfileConfig } from './types';
import { RsaThreeByteLaserDriver } from './rsaThreeByteDriver';
import { JenoptikAsciiDriver } from './jenoptikAsciiDriver';
import { LDM71AsciiDriver } from './ldm71AsciiDriver';
import { MockLaserDriver } from './mockLaserDriver';
import { AmplitudeFilter } from './amplitudeFilter';
import { useAmplitudeFilterStore } from '../../stores/amplitudeFilterStore';

function createFreshAmplitudeFilter(): AmplitudeFilter {
  const storeState = useAmplitudeFilterStore.getState();
  const filter = new AmplitudeFilter();
  filter.updateSettings(storeState.settings);
  return filter;
}

export function createLaserDriver(profile: LaserProfileConfig): LaserDriver {
  switch (profile.protocol) {
    case 'rsa_3byte':
      return new RsaThreeByteLaserDriver(profile);
    
    case 'jenoptik_ascii':
    case 'ascii':
      return new JenoptikAsciiDriver(profile);
    
    case 'ldm71_ascii':
      return new LDM71AsciiDriver(profile, createFreshAmplitudeFilter());
    
    case 'mock':
      return new MockLaserDriver(profile);
    
    default:
      throw new Error(`Unsupported laser protocol: ${profile.protocol}`);
  }
}
