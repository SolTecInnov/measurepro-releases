import { describe, it, expect, beforeEach, vi } from 'vitest';

// Stub localStorage before any module loads
const localStorageMap = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (key: string) => localStorageMap.get(key) ?? null,
  setItem: (key: string, value: string) => localStorageMap.set(key, value),
  removeItem: (key: string) => localStorageMap.delete(key),
  clear: () => localStorageMap.clear(),
});

vi.stubGlobal('navigator', { onLine: true, userAgent: 'test' });

// Mock Firebase modules
vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(),
  doc: vi.fn(),
  getDoc: vi.fn(() => Promise.resolve({ exists: () => false, data: () => null })),
  setDoc: vi.fn(() => Promise.resolve()),
}));
vi.mock('firebase/app', () => ({
  getApps: vi.fn(() => []),
}));
vi.mock('../masterAdmin', () => ({
  isMasterAdmin: (email: string) => email?.toLowerCase() === 'jfprince@soltec.ca',
  isBetaTestAccount: () => false,
  MASTER_ADMIN_EMAIL: 'jfprince@soltec.ca',
}));

import {
  isPermanentBetaUser,
  getTrialStartDate,
  getBetaTrialDisplayText,
  getBetaTrialColorClass,
  type BetaTrialStatus,
} from '../betaTrial';

/**
 * NOTE: isTrialUser, getBetaTrialStatus, canBetaUserAccess use `require('./masterAdmin')`
 * internally (CJS require), which vitest cannot intercept in ESM mode.
 * Those functions are tested indirectly via integration tests.
 * Here we test the pure helper functions that don't call require.
 */

describe('betaTrial', () => {
  beforeEach(() => {
    localStorageMap.clear();
  });

  // ── isPermanentBetaUser ─────────────────────────────────────────────
  describe('isPermanentBetaUser', () => {
    it('returns true for permanent beta email (case-insensitive)', () => {
      expect(isPermanentBetaUser('Chris@NovaPERMITS.com')).toBe(true);
      expect(isPermanentBetaUser('chris@novapermits.com')).toBe(true);
    });
    it('returns false for non-beta email', () => {
      expect(isPermanentBetaUser('random@example.com')).toBe(false);
    });
    it('returns false for null/undefined', () => {
      expect(isPermanentBetaUser(null)).toBe(false);
      expect(isPermanentBetaUser(undefined)).toBe(false);
    });
    it('returns false for empty string', () => {
      expect(isPermanentBetaUser('')).toBe(false);
    });
  });

  // ── getTrialStartDate ──────────────────────────────────────────────
  describe('getTrialStartDate', () => {
    it('returns null when no stored date', () => {
      expect(getTrialStartDate('user@example.com')).toBeNull();
    });
    it('reads from localStorage', () => {
      const date = new Date('2025-01-01T00:00:00Z');
      localStorageMap.set('beta_trial_start_user@example.com', date.toISOString());
      const result = getTrialStartDate('user@example.com');
      expect(result).toEqual(date);
    });
    it('is case-insensitive on email', () => {
      const date = new Date('2025-06-15T00:00:00Z');
      localStorageMap.set('beta_trial_start_user@example.com', date.toISOString());
      const result = getTrialStartDate('User@Example.COM');
      expect(result).toEqual(date);
    });
    it('returns null for invalid stored date', () => {
      localStorageMap.set('beta_trial_start_bad@example.com', 'not-a-date');
      expect(getTrialStartDate('bad@example.com')).toBeNull();
    });
    it('returns null for empty email', () => {
      expect(getTrialStartDate('')).toBeNull();
    });
  });

  // ── getBetaTrialDisplayText ────────────────────────────────────────
  describe('getBetaTrialDisplayText', () => {
    it('returns "Syncing..." when awaiting server sync', () => {
      const status: BetaTrialStatus = {
        isInTrial: false, isInGracePeriod: false, isExpired: false,
        daysRemaining: 0, totalDays: 7, startDate: null,
        expirationDate: null, graceEndDate: null,
        showReminder: false, reminderMessage: '',
        awaitingServerSync: true,
      };
      expect(getBetaTrialDisplayText(status)).toBe('Syncing...');
    });

    it('returns "Trial Expired" when expired', () => {
      const status: BetaTrialStatus = {
        isInTrial: false, isInGracePeriod: false, isExpired: true,
        daysRemaining: 0, totalDays: 7, startDate: null,
        expirationDate: null, graceEndDate: null,
        showReminder: false, reminderMessage: '',
      };
      expect(getBetaTrialDisplayText(status)).toBe('Trial Expired');
    });

    it('returns grace period text with days remaining', () => {
      const graceEnd = new Date();
      graceEnd.setDate(graceEnd.getDate() + 1);
      const status: BetaTrialStatus = {
        isInTrial: false, isInGracePeriod: true, isExpired: false,
        daysRemaining: 0, totalDays: 7, startDate: null,
        expirationDate: null, graceEndDate: graceEnd,
        showReminder: false, reminderMessage: '',
      };
      const text = getBetaTrialDisplayText(status);
      expect(text).toContain('Grace:');
      expect(text).toContain('d');
    });

    it('returns "BETA" for permanent beta users (999 days)', () => {
      const status: BetaTrialStatus = {
        isInTrial: true, isInGracePeriod: false, isExpired: false,
        daysRemaining: 999, totalDays: 999, startDate: null,
        expirationDate: null, graceEndDate: null,
        showReminder: false, reminderMessage: '',
      };
      expect(getBetaTrialDisplayText(status)).toBe('BETA');
    });

    it('returns "Xd left" for active trial', () => {
      const status: BetaTrialStatus = {
        isInTrial: true, isInGracePeriod: false, isExpired: false,
        daysRemaining: 5, totalDays: 7, startDate: null,
        expirationDate: null, graceEndDate: null,
        showReminder: false, reminderMessage: '',
      };
      expect(getBetaTrialDisplayText(status)).toBe('5d left');
    });

    it('returns empty string when not in any state', () => {
      const status: BetaTrialStatus = {
        isInTrial: false, isInGracePeriod: false, isExpired: false,
        daysRemaining: 0, totalDays: 7, startDate: null,
        expirationDate: null, graceEndDate: null,
        showReminder: false, reminderMessage: '',
      };
      expect(getBetaTrialDisplayText(status)).toBe('');
    });
  });

  // ── getBetaTrialColorClass ─────────────────────────────────────────
  describe('getBetaTrialColorClass', () => {
    it('returns red classes for expired', () => {
      const status: BetaTrialStatus = {
        isInTrial: false, isInGracePeriod: false, isExpired: true,
        daysRemaining: 0, totalDays: 7, startDate: null,
        expirationDate: null, graceEndDate: null,
        showReminder: false, reminderMessage: '',
      };
      const cls = getBetaTrialColorClass(status);
      expect(cls).toContain('text-red-500');
      expect(cls).toContain('bg-red-500/20');
      expect(cls).toContain('border-red-500');
    });

    it('returns orange classes for grace period', () => {
      const status: BetaTrialStatus = {
        isInTrial: false, isInGracePeriod: true, isExpired: false,
        daysRemaining: 0, totalDays: 7, startDate: null,
        expirationDate: null, graceEndDate: null,
        showReminder: false, reminderMessage: '',
      };
      const cls = getBetaTrialColorClass(status);
      expect(cls).toContain('orange');
    });

    it('returns yellow classes when reminder shown', () => {
      const status: BetaTrialStatus = {
        isInTrial: true, isInGracePeriod: false, isExpired: false,
        daysRemaining: 1, totalDays: 7, startDate: null,
        expirationDate: null, graceEndDate: null,
        showReminder: true, reminderMessage: '',
      };
      const cls = getBetaTrialColorClass(status);
      expect(cls).toContain('yellow');
    });

    it('returns blue classes for normal trial', () => {
      const status: BetaTrialStatus = {
        isInTrial: true, isInGracePeriod: false, isExpired: false,
        daysRemaining: 5, totalDays: 7, startDate: null,
        expirationDate: null, graceEndDate: null,
        showReminder: false, reminderMessage: '',
      };
      const cls = getBetaTrialColorClass(status);
      expect(cls).toContain('blue');
    });
  });
});
