import { describe, it, expect, beforeEach } from 'vitest';
import { LDM71AsciiDriver } from '../ldm71AsciiDriver';
import { AmplitudeFilter } from '../amplitudeFilter';
import { SOLTEC_30M_PROFILE } from '../profiles';
import type { LaserProfileConfig } from '../types';

function encode(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

describe('LDM71AsciiDriver', () => {
  let driver: LDM71AsciiDriver;

  beforeEach(() => {
    driver = new LDM71AsciiDriver(SOLTEC_30M_PROFILE);
  });

  describe('feedBytes — valid frames', () => {
    it('parses standard distance+amplitude frame "D 0001.724 012.9"', () => {
      const results = driver.feedBytes(encode('D 0001.724 012.9\r\n'));
      expect(results).toHaveLength(1);
      expect(results[0].distanceM).toBe(1.72);
      expect(results[0].amplitudeDb).toBe(12.9);
      expect(results[0].quality).toBe('good');
      expect(results[0].filtered).toBe(false);
    });

    it('parses distance-only frame "D 0005.500"', () => {
      const results = driver.feedBytes(encode('D 0005.500\r\n'));
      expect(results).toHaveLength(1);
      expect(results[0].distanceM).toBe(5.5);
      expect(results[0].amplitudeDb).toBeUndefined();
      expect(results[0].quality).toBe('good');
    });

    it('parses multiple frames in a single chunk', () => {
      const results = driver.feedBytes(encode('D 0001.000 010.0\r\nD 0002.000 020.0\r\n'));
      expect(results).toHaveLength(2);
      expect(results[0].distanceM).toBe(1);
      expect(results[1].distanceM).toBe(2);
    });

    it('handles split frames across two feedBytes calls', () => {
      const r1 = driver.feedBytes(encode('D 0003.'));
      expect(r1).toHaveLength(0);

      const r2 = driver.feedBytes(encode('456 015.0\r\n'));
      expect(r2).toHaveLength(1);
      expect(r2[0].distanceM).toBe(3.46);
      expect(r2[0].amplitudeDb).toBe(15.0);
    });

    it('rounds distance to 2 decimal places', () => {
      const results = driver.feedBytes(encode('D 0010.999 005.0\r\n'));
      expect(results).toHaveLength(1);
      expect(results[0].distanceM).toBe(11);
    });

    it('stores rawLine on valid measurements', () => {
      const results = driver.feedBytes(encode('D 0001.724 012.9\r\n'));
      expect(results[0].rawLine).toBe('D 0001.724 012.9');
    });
  });

  describe('feedBytes — error codes', () => {
    it('parses DE02 error code as invalid distance=null', () => {
      const results = driver.feedBytes(encode('DE02\r\n'));
      expect(results).toHaveLength(1);
      expect(results[0].distanceM).toBeNull();
      expect(results[0].quality).toBe('invalid');
      expect(results[0].error).toContain('No target');
    });

    it('parses De02 error code (mixed case)', () => {
      const results = driver.feedBytes(encode('De02\r\n'));
      expect(results).toHaveLength(1);
      expect(results[0].distanceM).toBeNull();
    });

    it('parses E### error code', () => {
      const results = driver.feedBytes(encode('E123\r\n'));
      expect(results).toHaveLength(1);
      expect(results[0].distanceM).toBeNull();
      expect(results[0].quality).toBe('invalid');
    });
  });

  describe('feedBytes — command lines', () => {
    it('ignores DM command (returns empty)', () => {
      const results = driver.feedBytes(encode('DM\r\n'));
      expect(results).toHaveLength(0);
    });

    it('ignores DT command', () => {
      const results = driver.feedBytes(encode('DT\r\n'));
      expect(results).toHaveLength(0);
    });
  });

  describe('feedBytes — invalid data', () => {
    it('rejects garbage lines', () => {
      const results = driver.feedBytes(encode('GARBAGE DATA\r\n'));
      expect(results).toHaveLength(0);
    });

    it('rejects empty lines', () => {
      const results = driver.feedBytes(encode('\r\n'));
      expect(results).toHaveLength(0);
    });

    it('rejects lines missing D prefix', () => {
      const results = driver.feedBytes(encode('0001.724 012.9\r\n'));
      expect(results).toHaveLength(0);
    });
  });

  describe('feedBytes — range filtering', () => {
    it('rejects distance exceeding maxRangeM', () => {
      const profile: LaserProfileConfig = {
        ...SOLTEC_30M_PROFILE,
        options: { maxRangeM: 30, minRangeM: 0 },
      };
      const d = new LDM71AsciiDriver(profile);
      const results = d.feedBytes(encode('D 0050.000 010.0\r\n'));
      expect(results).toHaveLength(1);
      expect(results[0].distanceM).toBeNull();
      expect(results[0].quality).toBe('invalid');
      expect(results[0].error).toContain('out of range');
    });

    it('rejects distance below minRangeM', () => {
      const profile: LaserProfileConfig = {
        ...SOLTEC_30M_PROFILE,
        options: { maxRangeM: 100, minRangeM: 1 },
      };
      const d = new LDM71AsciiDriver(profile);
      const results = d.feedBytes(encode('D 0000.500\r\n'));
      expect(results).toHaveLength(1);
      expect(results[0].distanceM).toBeNull();
      expect(results[0].quality).toBe('invalid');
    });
  });

  describe('feedBytes — amplitude filtering', () => {
    it('filters low amplitude when filter is enabled', () => {
      const profile: LaserProfileConfig = {
        ...SOLTEC_30M_PROFILE,
        options: { ...SOLTEC_30M_PROFILE.options, amplitudeFilterEnabled: true },
      };
      const filter = new AmplitudeFilter({ amplitudeThresholdDb: 10, hysteresisDb: 0.5 });
      const d = new LDM71AsciiDriver(profile, filter);

      const results = d.feedBytes(encode('D 0005.000 002.0\r\n'));
      expect(results).toHaveLength(1);
      // Amplitude 2 is below threshold 10 - hysteresis 0.5 = 9.5, so rejected
      expect(results[0].distanceM).toBeNull();
      expect(results[0].filtered).toBe(true);
      expect(results[0].quality).toBe('weak');
    });

    it('passes high amplitude when filter is enabled', () => {
      const profile: LaserProfileConfig = {
        ...SOLTEC_30M_PROFILE,
        options: { ...SOLTEC_30M_PROFILE.options, amplitudeFilterEnabled: true },
      };
      const filter = new AmplitudeFilter({ amplitudeThresholdDb: 5, hysteresisDb: 0.5 });
      const d = new LDM71AsciiDriver(profile, filter);

      const results = d.feedBytes(encode('D 0005.000 020.0\r\n'));
      expect(results).toHaveLength(1);
      expect(results[0].distanceM).toBe(5);
      expect(results[0].filtered).toBe(false);
      expect(results[0].quality).toBe('good');
    });

    it('skips amplitude filter when disabled (default profile)', () => {
      // Default profile has amplitudeFilterEnabled: false
      const results = driver.feedBytes(encode('D 0005.000 000.1\r\n'));
      expect(results).toHaveLength(1);
      expect(results[0].distanceM).toBe(5);
      expect(results[0].quality).toBe('good');
    });
  });

  describe('buffer overflow protection', () => {
    it('clears buffer when it exceeds 1024 chars', () => {
      // Feed a long string without newline — exceeds 1024 chars
      const longLine = 'X'.repeat(1100);
      driver.feedBytes(encode(longLine));
      const stats = driver.getStats();
      expect(stats.resyncCount).toBe(1);
    });
  });

  describe('stats tracking', () => {
    it('tracks frames received, valid, invalid, and bytes processed', () => {
      driver.feedBytes(encode('D 0001.000 010.0\r\nGARBAGE\r\nDE02\r\n'));
      const stats = driver.getStats();
      expect(stats.framesReceived).toBe(3);
      expect(stats.framesValid).toBe(2); // distance + error code
      expect(stats.framesInvalid).toBe(1); // GARBAGE
      expect(stats.bytesProcessed).toBeGreaterThan(0);
    });

    it('reset clears all stats', () => {
      driver.feedBytes(encode('D 0001.000 010.0\r\n'));
      driver.reset();
      const stats = driver.getStats();
      expect(stats.framesReceived).toBe(0);
      expect(stats.framesValid).toBe(0);
      expect(stats.bytesProcessed).toBe(0);
    });
  });

  describe('rawLineCallback', () => {
    it('invokes callback for each received line', () => {
      const lines: string[] = [];
      driver.setRawLineCallback((line) => lines.push(line));
      driver.feedBytes(encode('D 0001.000 010.0\r\nDE02\r\n'));
      expect(lines).toEqual(['D 0001.000 010.0', 'DE02']);
    });
  });

  describe('setFilterEnabled / isFilterEnabled', () => {
    it('toggles filter enabled state', () => {
      expect(driver.isFilterEnabled()).toBe(false); // default from profile
      driver.setFilterEnabled(true);
      expect(driver.isFilterEnabled()).toBe(true);
      driver.setFilterEnabled(false);
      expect(driver.isFilterEnabled()).toBe(false);
    });
  });
});
