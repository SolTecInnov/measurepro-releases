/**
 * Unit tests for JenoptikAsciiDriver
 *
 * Covers:
 * - Valid distance frames across the full integer-digit range (1–4 digits)
 * - framesInvalid does NOT increment for valid short-range readings
 * - Infinity / error codes are handled correctly
 * - Invalid frames are counted correctly
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { JenoptikAsciiDriver } from '../jenoptikAsciiDriver';
import type { LaserProfileConfig } from '../types';

const defaultProfile: LaserProfileConfig = {
  id: 'jenoptik-lds30',
  name: 'SolTec laser',
  baudRate: 19200,
  dataBits: 8,
  parity: 'none',
  stopBits: 1,
  flowControl: 'none',
  protocol: 'jenoptik_ascii',
  options: {
    minRangeM: 0,
    maxRangeM: 9999,
  },
};

function makeDriver(profile: LaserProfileConfig = defaultProfile): JenoptikAsciiDriver {
  return new JenoptikAsciiDriver(profile);
}

function encodeLines(...lines: string[]): Uint8Array {
  return new TextEncoder().encode(lines.map(l => l + '\r\n').join(''));
}

describe('JenoptikAsciiDriver — regex fix for short-range readings', () => {
  let driver: JenoptikAsciiDriver;

  beforeEach(() => {
    driver = makeDriver();
  });

  it('parses 1-integer-digit reading D 1.234', () => {
    const results = driver.feedBytes(encodeLines('D 1.234'));
    expect(results).toHaveLength(1);
    expect(results[0].distanceM).toBeCloseTo(1.234, 3);
    expect(results[0].quality).toBe('good');
    expect(driver.getStats().framesInvalid).toBe(0);
  });

  it('parses 2-integer-digit reading D 12.345', () => {
    const results = driver.feedBytes(encodeLines('D 12.345'));
    expect(results).toHaveLength(1);
    expect(results[0].distanceM).toBeCloseTo(12.345, 3);
    expect(results[0].quality).toBe('good');
    expect(driver.getStats().framesInvalid).toBe(0);
  });

  it('parses 3-integer-digit reading D 123.456', () => {
    const results = driver.feedBytes(encodeLines('D 123.456'));
    expect(results).toHaveLength(1);
    expect(results[0].distanceM).toBeCloseTo(123.456, 3);
    expect(results[0].quality).toBe('good');
    expect(driver.getStats().framesInvalid).toBe(0);
  });

  it('parses 4-integer-digit reading D 1234.567 (legacy full-width format)', () => {
    const results = driver.feedBytes(encodeLines('D 1234.567'));
    expect(results).toHaveLength(1);
    expect(results[0].distanceM).toBeCloseTo(1234.567, 3);
    expect(results[0].quality).toBe('good');
    expect(driver.getStats().framesInvalid).toBe(0);
  });

  it('parses zero-padded 4-digit reading D 0001.724', () => {
    const results = driver.feedBytes(encodeLines('D 0001.724'));
    expect(results).toHaveLength(1);
    expect(results[0].distanceM).toBeCloseTo(1.724, 3);
    expect(driver.getStats().framesInvalid).toBe(0);
  });

  it('returns distanceM null and quality invalid for infinity code De02', () => {
    const results = driver.feedBytes(encodeLines('De02'));
    expect(results).toHaveLength(1);
    expect(results[0].distanceM).toBeNull();
    expect(results[0].quality).toBe('invalid');
    expect(results[0].error).toBe('infinity');
    expect(driver.getStats().framesValid).toBe(1);
    expect(driver.getStats().framesInvalid).toBe(0);
  });

  it('returns distanceM null and quality invalid for uppercase infinity code DE02', () => {
    const results = driver.feedBytes(encodeLines('DE02'));
    expect(results).toHaveLength(1);
    expect(results[0].distanceM).toBeNull();
    expect(results[0].quality).toBe('invalid');
    expect(driver.getStats().framesInvalid).toBe(0);
  });

  it('increments framesInvalid for truly invalid frames', () => {
    driver.feedBytes(encodeLines('GARBAGE', 'not a reading'));
    expect(driver.getStats().framesInvalid).toBe(2);
    expect(driver.getStats().framesValid).toBe(0);
  });

  it('does NOT increment framesInvalid for a valid short-range reading', () => {
    driver.feedBytes(encodeLines('D 5.123'));
    expect(driver.getStats().framesInvalid).toBe(0);
    expect(driver.getStats().framesValid).toBe(1);
  });
});
