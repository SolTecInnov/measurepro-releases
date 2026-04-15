import { describe, it, expect, vi } from 'vitest';

// Stub browser globals
vi.stubGlobal('localStorage', {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
  clear: () => {},
});
vi.stubGlobal('navigator', { onLine: true, userAgent: 'test' });

// Mock firebase
vi.mock('firebase/functions', () => ({
  getFunctions: vi.fn(() => 'mock-functions'),
  httpsCallable: vi.fn(() => vi.fn(() => Promise.resolve({ data: {} }))),
}));
vi.mock('@/lib/firebase', () => ({
  default: {},
}));
vi.mock('@/lib/config/environment', () => ({
  API_BASE_URL: 'https://test.example.com',
}));

// Must define import.meta.env before import
const originalEnv = (import.meta as any).env;

import { isCloudFunctionsEnabled } from '../cloudFunctionsAPI';

describe('licensing/cloudFunctionsAPI', () => {
  describe('isCloudFunctionsEnabled', () => {
    it('returns false when env var not set to true', () => {
      // Default - not set
      expect(isCloudFunctionsEnabled()).toBe(false);
    });
  });
});
