import { describe, it, expect, vi } from 'vitest';

// Stub localStorage (some modules may access it on import)
vi.stubGlobal('localStorage', {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
  clear: () => {},
});

import {
  LICENSED_FEATURES,
  FEATURE_CATEGORIES,
  FEATURE_INFO,
  isFreeTierFeature,
  getUnlicensedMessage,
} from '../features';

describe('licensing/features', () => {
  // ── LICENSED_FEATURES constants ────────────────────────────────────
  describe('LICENSED_FEATURES', () => {
    it('contains AI_DETECTION feature key', () => {
      expect(LICENSED_FEATURES.AI_DETECTION).toBe('ai_detection');
    });

    it('contains CONVOY_GUARDIAN feature key', () => {
      expect(LICENSED_FEATURES.CONVOY_GUARDIAN).toBe('convoy_guardian');
    });

    it('contains POINT_CLOUD_SCANNING feature key', () => {
      expect(LICENSED_FEATURES.POINT_CLOUD_SCANNING).toBe('point_cloud_scanning');
    });

    it('has at least 20 feature keys', () => {
      const keys = Object.keys(LICENSED_FEATURES);
      expect(keys.length).toBeGreaterThanOrEqual(20);
    });
  });

  // ── FEATURE_CATEGORIES ─────────────────────────────────────────────
  describe('FEATURE_CATEGORIES', () => {
    it('has core, premium, professional, enterprise', () => {
      expect(FEATURE_CATEGORIES.CORE).toBe('core');
      expect(FEATURE_CATEGORIES.PREMIUM).toBe('premium');
      expect(FEATURE_CATEGORIES.PROFESSIONAL).toBe('professional');
      expect(FEATURE_CATEGORIES.ENTERPRISE).toBe('enterprise');
    });
  });

  // ── FEATURE_INFO ───────────────────────────────────────────────────
  describe('FEATURE_INFO', () => {
    it('has info for AI_DETECTION', () => {
      const info = FEATURE_INFO[LICENSED_FEATURES.AI_DETECTION];
      expect(info).toBeDefined();
      expect(info.name).toBe('AI Object Detection');
      expect(info.category).toBe(FEATURE_CATEGORIES.PREMIUM);
    });

    it('has info for CONVOY_GUARDIAN as enterprise', () => {
      const info = FEATURE_INFO[LICENSED_FEATURES.CONVOY_GUARDIAN];
      expect(info).toBeDefined();
      expect(info.category).toBe(FEATURE_CATEGORIES.ENTERPRISE);
    });

    it('POINT_CLOUD_SCANNING has storageQuota', () => {
      const info = FEATURE_INFO[LICENSED_FEATURES.POINT_CLOUD_SCANNING];
      expect(info.storageQuota).toBeDefined();
      expect(info.storageQuota.basic).toBe(20 * 1024 * 1024);
    });

    it('all FEATURE_INFO entries have name, description, category', () => {
      for (const [key, info] of Object.entries(FEATURE_INFO)) {
        expect(info.name, `${key} missing name`).toBeTruthy();
        expect(info.description, `${key} missing description`).toBeTruthy();
        expect(info.category, `${key} missing category`).toBeTruthy();
      }
    });
  });

  // ── isFreeTierFeature ──────────────────────────────────────────────
  describe('isFreeTierFeature', () => {
    it('returns true for basic_measurement', () => {
      expect(isFreeTierFeature('basic_measurement')).toBe(true);
    });
    it('returns true for offline_mode', () => {
      expect(isFreeTierFeature('offline_mode')).toBe(true);
    });
    it('returns false for ai_detection (premium)', () => {
      expect(isFreeTierFeature('ai_detection')).toBe(false);
    });
    it('returns false for convoy_guardian (enterprise)', () => {
      expect(isFreeTierFeature('convoy_guardian')).toBe(false);
    });
    it('returns false for unknown keys', () => {
      expect(isFreeTierFeature('nonexistent_feature')).toBe(false);
    });
  });

  // ── getUnlicensedMessage ───────────────────────────────────────────
  describe('getUnlicensedMessage', () => {
    it('includes feature name for known feature', () => {
      const msg = getUnlicensedMessage('ai_detection');
      expect(msg).toContain('AI Object Detection');
      expect(msg).toContain('license');
    });

    it('uses generic text for unknown feature', () => {
      const msg = getUnlicensedMessage('unknown_feature');
      expect(msg).toContain('This feature');
      expect(msg).toContain('license');
    });
  });
});
