import { describe, it, expect, beforeEach, vi } from 'vitest';

// Provide localStorage stub for Node environment
const localStorageMap = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (key: string) => localStorageMap.get(key) ?? null,
  setItem: (key: string, value: string) => localStorageMap.set(key, value),
  removeItem: (key: string) => localStorageMap.delete(key),
  clear: () => localStorageMap.clear(),
});

// Mock browser APIs and external modules before importing the store
vi.mock('@/lib/sounds', () => ({
  soundManager: { playPOITypeChange: vi.fn() },
}));

vi.mock('@/lib/firebase', () => ({
  getSafeAuth: () => null,
}));

vi.mock('@/lib/auth/masterAdmin', () => ({
  isBetaUser: () => false,
}));

import { useRainModeStore } from '@/lib/stores/rainModeStore';
import { usePOIActionsStore } from '@/lib/poiActions';

describe('getActionForPOI — Rain Mode and GPS-Only overrides', () => {
  beforeEach(() => {
    localStorageMap.clear();
    // Reset rain mode to inactive
    useRainModeStore.setState({
      isActive: false,
      activatedAt: null,
      isSurveyMode: false,
      surveyModeActivatedAt: null,
    });
    // Reset POI actions store to defaults
    usePOIActionsStore.getState().resetToDefaults();
  });

  describe('Normal mode (Rain Mode inactive)', () => {
    it('wire returns auto-capture-and-log', () => {
      const action = usePOIActionsStore.getState().getActionForPOI('wire');
      expect(action).toBe('auto-capture-and-log');
    });

    it('road returns auto-capture-no-measurement', () => {
      const action = usePOIActionsStore.getState().getActionForPOI('road');
      expect(action).toBe('auto-capture-no-measurement');
    });

    it('danger returns open-manual-modal', () => {
      const action = usePOIActionsStore.getState().getActionForPOI('danger');
      expect(action).toBe('open-manual-modal');
    });
  });

  describe('Rain Mode active', () => {
    beforeEach(() => {
      useRainModeStore.setState({ isActive: true, activatedAt: new Date().toISOString() });
    });

    it('wire is downgraded to auto-capture-no-measurement', () => {
      const action = usePOIActionsStore.getState().getActionForPOI('wire');
      expect(action).toBe('auto-capture-no-measurement');
    });

    it('road remains auto-capture-no-measurement (unchanged)', () => {
      const action = usePOIActionsStore.getState().getActionForPOI('road');
      expect(action).toBe('auto-capture-no-measurement');
    });

    it('danger remains open-manual-modal (NOT downgraded)', () => {
      const action = usePOIActionsStore.getState().getActionForPOI('danger');
      expect(action).toBe('open-manual-modal');
    });
  });
});
