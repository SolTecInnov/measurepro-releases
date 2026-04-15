import { describe, it, expect, vi } from 'vitest';

// Mock modules that access browser APIs at import time
vi.mock('@/lib/stores/gpsStore', () => ({
  useGPSStore: { getState: () => ({ data: {} }) },
}));
vi.mock('@/lib/laser', () => ({
  useLaserStore: vi.fn(() => ({ groundReferenceHeight: 0 })),
}));
vi.mock('@/lib/survey', () => ({
  useSurveyStore: vi.fn(() => ({ activeSurvey: null })),
}));
vi.mock('@/lib/poiActions', () => ({
  usePOIActionsStore: { getState: () => ({}) },
}));
vi.mock('@/lib/sounds', () => ({
  soundManager: { playLogEntry: vi.fn(), playPOITypeChange: vi.fn() },
}));
vi.mock('@/lib/survey/db', () => ({
  openSurveyDB: vi.fn(),
}));
vi.mock('@/lib/survey/MeasurementFeed', () => ({
  getMeasurementFeed: vi.fn(),
}));
vi.mock('@/lib/workers/MeasurementLoggerClient', () => ({
  getMeasurementLogger: vi.fn(),
}));

import { isInvalidReading, parseMeters } from '../useLoggingCore';

describe('isInvalidReading', () => {
  it('returns true for null', () => {
    expect(isInvalidReading(null)).toBe(true);
  });

  it('returns true for undefined', () => {
    expect(isInvalidReading(undefined)).toBe(true);
  });

  it('returns true for empty string', () => {
    expect(isInvalidReading('')).toBe(true);
  });

  it('returns true for "--"', () => {
    expect(isInvalidReading('--')).toBe(true);
  });

  it('returns true for "infinity"', () => {
    expect(isInvalidReading('infinity')).toBe(true);
  });

  it('returns true for "DE02"', () => {
    expect(isInvalidReading('DE02')).toBe(true);
  });

  it('returns true for "de02"', () => {
    expect(isInvalidReading('de02')).toBe(true);
  });

  it('returns true for "De01"', () => {
    expect(isInvalidReading('De01')).toBe(true);
  });

  it('returns true for "E001"', () => {
    expect(isInvalidReading('E001')).toBe(true);
  });

  it('returns true for "[ERR]"', () => {
    expect(isInvalidReading('[ERR]')).toBe(true);
  });

  it('returns true for "0" (noise/ground reflection <= 0.1)', () => {
    expect(isInvalidReading('0')).toBe(true);
  });

  it('returns true for "0.05" (noise/ground reflection <= 0.1)', () => {
    expect(isInvalidReading('0.05')).toBe(true);
  });

  it('returns true for "0.1" (noise/ground reflection <= 0.1)', () => {
    expect(isInvalidReading('0.1')).toBe(true);
  });

  it('returns false for "0.2" (valid reading)', () => {
    expect(isInvalidReading('0.2')).toBe(false);
  });

  it('returns false for "5.234" (valid reading)', () => {
    expect(isInvalidReading('5.234')).toBe(false);
  });

  it('returns false for "25.0" (valid reading)', () => {
    expect(isInvalidReading('25.0')).toBe(false);
  });
});

describe('parseMeters', () => {
  it('returns invalid/sky result for an invalid reading', () => {
    const result = parseMeters('DE02');
    expect(result).toEqual({
      raw: 'DE02',
      meters: 0,
      isValid: false,
      isSky: true,
    });
  });

  it('parses valid reading with groundRef 0', () => {
    const result = parseMeters('5.234', 0);
    expect(result).toEqual({
      raw: '5.234',
      meters: 5.234,
      isValid: true,
      isSky: false,
    });
  });

  it('adds groundRef to the reading', () => {
    const result = parseMeters('5.234', 2.0);
    expect(result).toEqual({
      raw: '5.234',
      meters: 7.234,
      isValid: true,
      isSky: false,
    });
  });

  it('rounds to 3 decimal places', () => {
    const result = parseMeters('1.1111', 2.2222);
    expect(result.meters).toBe(3.333);
  });

  it('defaults groundRef to 0 when omitted', () => {
    const result = parseMeters('3.500');
    expect(result.meters).toBe(3.5);
    expect(result.isValid).toBe(true);
  });
});
