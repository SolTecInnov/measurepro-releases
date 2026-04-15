import { describe, it, expect, vi } from 'vitest';

// Mock modules that touch browser/network APIs
vi.mock('./authedFetch', () => ({
  getAuthHeader: vi.fn().mockResolvedValue({}),
}));
vi.mock('./config/environment', () => ({
  API_BASE_URL: 'http://localhost:3001',
}));

import { sanitizeTimestamps, safeRender } from './queryClient';

describe('queryClient utilities', () => {
  describe('sanitizeTimestamps', () => {
    it('returns null for null', () => {
      expect(sanitizeTimestamps(null)).toBeNull();
    });

    it('returns undefined for undefined', () => {
      expect(sanitizeTimestamps(undefined)).toBeUndefined();
    });

    it('returns primitive values unchanged', () => {
      expect(sanitizeTimestamps('hello')).toBe('hello');
      expect(sanitizeTimestamps(42)).toBe(42);
      expect(sanitizeTimestamps(true)).toBe(true);
    });

    it('converts Firestore Timestamp with _seconds/_nanoseconds', () => {
      const ts = { _seconds: 1704067200, _nanoseconds: 0 };
      const result = sanitizeTimestamps(ts);
      expect(typeof result).toBe('string');
      expect(result).toContain('2024-01-01');
    });

    it('converts Firestore Timestamp with nanoseconds', () => {
      const ts = { _seconds: 1704067200, _nanoseconds: 500000000 };
      const result = sanitizeTimestamps(ts);
      expect(typeof result).toBe('string');
    });

    it('converts Firestore client SDK Timestamp (toDate)', () => {
      const ts = {
        toDate: () => new Date('2024-01-01T00:00:00Z'),
      };
      const result = sanitizeTimestamps(ts);
      expect(result).toBe('2024-01-01T00:00:00.000Z');
    });

    it('handles toDate() that throws', () => {
      const ts = {
        toDate: () => { throw new Error('fail'); },
      };
      const result = sanitizeTimestamps(ts);
      expect(typeof result).toBe('string');
    });

    it('recursively sanitizes nested objects', () => {
      const obj = {
        name: 'test',
        createdAt: { _seconds: 1704067200, _nanoseconds: 0 },
        nested: {
          updatedAt: { _seconds: 1704153600, _nanoseconds: 0 },
        },
      };
      const result = sanitizeTimestamps(obj);
      expect(result.name).toBe('test');
      expect(typeof result.createdAt).toBe('string');
      expect(typeof result.nested.updatedAt).toBe('string');
    });

    it('sanitizes arrays', () => {
      const arr = [
        { _seconds: 1704067200, _nanoseconds: 0 },
        'regular string',
        42,
      ];
      const result = sanitizeTimestamps(arr);
      expect(Array.isArray(result)).toBe(true);
      expect(typeof result[0]).toBe('string');
      expect(result[1]).toBe('regular string');
      expect(result[2]).toBe(42);
    });

    it('returns null for empty objects', () => {
      expect(sanitizeTimestamps({})).toBeNull();
    });
  });

  describe('safeRender', () => {
    it('passes null through', () => {
      expect(safeRender(null)).toBeNull();
    });

    it('passes undefined through', () => {
      expect(safeRender(undefined)).toBeUndefined();
    });

    it('passes string through', () => {
      expect(safeRender('hello')).toBe('hello');
    });

    it('passes number through', () => {
      expect(safeRender(42)).toBe(42);
    });

    it('passes boolean through', () => {
      expect(safeRender(true)).toBe(true);
    });

    it('converts Firestore Timestamp with _seconds', () => {
      const result = safeRender({ _seconds: 1704067200 });
      expect(typeof result).toBe('string');
      expect(result).toContain('2024');
    });

    it('converts Firestore client Timestamp (toDate)', () => {
      const ts = { toDate: () => new Date('2024-01-01T00:00:00Z') };
      const result = safeRender(ts);
      expect(result).toBe('2024-01-01T00:00:00.000Z');
    });

    it('handles toDate() that throws', () => {
      const ts = { toDate: () => { throw new Error('fail'); } };
      const result = safeRender(ts);
      expect(typeof result).toBe('string');
    });

    it('JSON.stringifies plain objects', () => {
      const result = safeRender({ key: 'value' });
      expect(result).toBe('{"key":"value"}');
    });

    it('JSON.stringifies arrays', () => {
      const result = safeRender([1, 2, 3]);
      expect(result).toBe('[1,2,3]');
    });

    it('converts other types to string', () => {
      const sym = Symbol('test');
      const result = safeRender(sym);
      expect(typeof result).toBe('string');
    });
  });
});
