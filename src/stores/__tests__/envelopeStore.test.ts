import { describe, it, expect, beforeEach, vi } from 'vitest';

// Stub window and CustomEvent before imports
vi.stubGlobal('window', {
  ...globalThis,
  dispatchEvent: vi.fn(),
  CustomEvent: globalThis.CustomEvent ?? class CustomEvent extends Event {
    detail: any;
    constructor(type: string, params?: any) {
      super(type);
      this.detail = params?.detail;
    }
  },
});

if (typeof globalThis.CustomEvent === 'undefined') {
  vi.stubGlobal('CustomEvent', class CustomEvent extends Event {
    detail: any;
    constructor(type: string, params?: any) {
      super(type);
      this.detail = params?.detail;
    }
  });
}

import { useEnvelopeStore } from '../envelopeStore';

describe('useEnvelopeStore', () => {
  beforeEach(() => {
    useEnvelopeStore.getState().resetToDefaults();
  });

  it('has correct defaults', () => {
    const state = useEnvelopeStore.getState();
    expect(state.settings.enabled).toBe(false);
    expect(state.settings.activeProfileId).toBe('standard-flatbed-5axle');
    expect(state.settings.warningThreshold).toBe(0.5);
    expect(state.settings.criticalThreshold).toBe(0.2);
    expect(state.settings.audioEnabled).toBe(true);
    expect(state.settings.visualEnabled).toBe(true);
    expect(state.violations).toEqual([]);
    expect(state.isMonitoring).toBe(false);
    expect(state.profiles.length).toBeGreaterThan(0);
  });

  describe('Profile Management', () => {
    it('addProfile adds a custom profile', () => {
      const initialCount = useEnvelopeStore.getState().profiles.length;
      useEnvelopeStore.getState().addProfile({
        name: 'Custom Truck',
        width: 3.0,
        height: 5.0,
        length: 20.0,
      } as any);
      const state = useEnvelopeStore.getState();
      expect(state.profiles.length).toBe(initialCount + 1);
      const added = state.profiles[state.profiles.length - 1];
      expect(added.name).toBe('Custom Truck');
      expect(added.id).toMatch(/^custom-/);
    });

    it('updateProfile modifies an existing profile', () => {
      const profileId = useEnvelopeStore.getState().profiles[0].id;
      useEnvelopeStore.getState().updateProfile(profileId, { name: 'Renamed' });
      const profile = useEnvelopeStore.getState().profiles.find((p) => p.id === profileId);
      expect(profile!.name).toBe('Renamed');
    });

    it('deleteProfile removes a non-default profile', () => {
      // Add a custom profile first
      useEnvelopeStore.getState().addProfile({
        name: 'Temp',
        width: 2.0,
        height: 4.0,
        length: 10.0,
      } as any);
      const before = useEnvelopeStore.getState().profiles.length;
      const customProfile = useEnvelopeStore.getState().profiles.find((p) => p.name === 'Temp');
      useEnvelopeStore.getState().deleteProfile(customProfile!.id);
      expect(useEnvelopeStore.getState().profiles.length).toBe(before - 1);
    });

    it('getActiveProfile returns the active profile', () => {
      const profile = useEnvelopeStore.getState().getActiveProfile();
      expect(profile).not.toBeNull();
      expect(profile!.id).toBe('standard-flatbed-5axle');
    });

    it('switchProfile changes the active profile', () => {
      const profiles = useEnvelopeStore.getState().profiles;
      const otherId = profiles.find((p) => p.id !== 'standard-flatbed-5axle')!.id;
      useEnvelopeStore.getState().switchProfile(otherId);
      expect(useEnvelopeStore.getState().settings.activeProfileId).toBe(otherId);
      expect(useEnvelopeStore.getState().getActiveProfile()!.id).toBe(otherId);
    });
  });

  describe('Settings Management', () => {
    it('updateSettings merges partial settings', () => {
      useEnvelopeStore.getState().updateSettings({ warningThreshold: 1.0 });
      const settings = useEnvelopeStore.getState().settings;
      expect(settings.warningThreshold).toBe(1.0);
      // Other settings unchanged
      expect(settings.criticalThreshold).toBe(0.2);
    });

    it('toggleEnabled toggles enabled and monitoring', () => {
      useEnvelopeStore.getState().toggleEnabled();
      expect(useEnvelopeStore.getState().settings.enabled).toBe(true);
      expect(useEnvelopeStore.getState().isMonitoring).toBe(true);

      useEnvelopeStore.getState().toggleEnabled();
      expect(useEnvelopeStore.getState().settings.enabled).toBe(false);
      expect(useEnvelopeStore.getState().isMonitoring).toBe(false);
    });

    it('toggleAudio toggles audioEnabled', () => {
      useEnvelopeStore.getState().toggleAudio();
      expect(useEnvelopeStore.getState().settings.audioEnabled).toBe(false);
      useEnvelopeStore.getState().toggleAudio();
      expect(useEnvelopeStore.getState().settings.audioEnabled).toBe(true);
    });

    it('toggleVisual toggles visualEnabled', () => {
      useEnvelopeStore.getState().toggleVisual();
      expect(useEnvelopeStore.getState().settings.visualEnabled).toBe(false);
      useEnvelopeStore.getState().toggleVisual();
      expect(useEnvelopeStore.getState().settings.visualEnabled).toBe(true);
    });
  });

  describe('Violation Logging', () => {
    it('logViolation adds a violation', () => {
      useEnvelopeStore.getState().logViolation({
        profileId: 'standard-flatbed-5axle',
        type: 'height',
        measuredValue: 4.5,
        threshold: 4.15,
        timestamp: Date.now(),
      } as any);
      expect(useEnvelopeStore.getState().violations).toHaveLength(1);
      expect(useEnvelopeStore.getState().violations[0].id).toMatch(/^violation-/);
    });

    it('clearViolations removes all violations', () => {
      useEnvelopeStore.getState().logViolation({
        profileId: 'p1',
        type: 'height',
        measuredValue: 5.0,
        threshold: 4.0,
        timestamp: Date.now(),
      } as any);
      useEnvelopeStore.getState().clearViolations();
      expect(useEnvelopeStore.getState().violations).toEqual([]);
    });

    it('deleteViolation removes a specific violation', () => {
      useEnvelopeStore.getState().logViolation({
        profileId: 'p1',
        type: 'height',
        measuredValue: 5.0,
        threshold: 4.0,
        timestamp: Date.now(),
      } as any);
      const id = useEnvelopeStore.getState().violations[0].id;
      useEnvelopeStore.getState().deleteViolation(id);
      expect(useEnvelopeStore.getState().violations).toHaveLength(0);
    });

    it('getViolationsByProfile filters by profileId', () => {
      useEnvelopeStore.getState().logViolation({
        profileId: 'p1',
        type: 'height',
        measuredValue: 5.0,
        threshold: 4.0,
        timestamp: Date.now(),
      } as any);
      useEnvelopeStore.getState().logViolation({
        profileId: 'p2',
        type: 'width',
        measuredValue: 3.0,
        threshold: 2.6,
        timestamp: Date.now(),
      } as any);
      const p1Violations = useEnvelopeStore.getState().getViolationsByProfile('p1');
      expect(p1Violations).toHaveLength(1);
      expect(p1Violations[0].profileId).toBe('p1');
    });
  });

  describe('Monitoring Control', () => {
    it('startMonitoring sets isMonitoring to true', () => {
      useEnvelopeStore.getState().startMonitoring();
      expect(useEnvelopeStore.getState().isMonitoring).toBe(true);
    });

    it('stopMonitoring sets isMonitoring to false', () => {
      useEnvelopeStore.getState().startMonitoring();
      useEnvelopeStore.getState().stopMonitoring();
      expect(useEnvelopeStore.getState().isMonitoring).toBe(false);
    });
  });

  describe('resetToDefaults', () => {
    it('resets all state to defaults', () => {
      useEnvelopeStore.getState().toggleEnabled();
      useEnvelopeStore.getState().startMonitoring();
      useEnvelopeStore.getState().logViolation({
        profileId: 'p1',
        type: 'height',
        measuredValue: 5.0,
        threshold: 4.0,
        timestamp: Date.now(),
      } as any);

      useEnvelopeStore.getState().resetToDefaults();
      const state = useEnvelopeStore.getState();
      expect(state.settings.enabled).toBe(false);
      expect(state.isMonitoring).toBe(false);
      expect(state.violations).toEqual([]);
    });
  });
});
