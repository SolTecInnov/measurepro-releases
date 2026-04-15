import { describe, it, expect, beforeEach } from 'vitest';
import { useRainModeStore } from '../rainModeStore';

describe('useRainModeStore', () => {
  beforeEach(() => {
    // Reset store to defaults between tests
    useRainModeStore.setState({
      isActive: false,
      activatedAt: null,
      isSurveyMode: false,
      surveyModeActivatedAt: null,
    });
  });

  describe('Rain Mode', () => {
    it('has correct defaults', () => {
      const state = useRainModeStore.getState();
      expect(state.isActive).toBe(false);
      expect(state.activatedAt).toBeNull();
    });

    it('activate() sets isActive to true and activatedAt', () => {
      useRainModeStore.getState().activate();
      const state = useRainModeStore.getState();
      expect(state.isActive).toBe(true);
      expect(state.activatedAt).not.toBeNull();
      expect(typeof state.activatedAt).toBe('string');
    });

    it('deactivate() sets isActive to false and clears activatedAt', () => {
      useRainModeStore.getState().activate();
      useRainModeStore.getState().deactivate();
      const state = useRainModeStore.getState();
      expect(state.isActive).toBe(false);
      expect(state.activatedAt).toBeNull();
    });

    it('toggle() flips isActive from false to true', () => {
      useRainModeStore.getState().toggle();
      expect(useRainModeStore.getState().isActive).toBe(true);
    });

    it('toggle() flips isActive from true to false', () => {
      useRainModeStore.getState().activate();
      useRainModeStore.getState().toggle();
      expect(useRainModeStore.getState().isActive).toBe(false);
    });
  });

  describe('GPS-Only Survey Mode', () => {
    it('has correct defaults', () => {
      const state = useRainModeStore.getState();
      expect(state.isSurveyMode).toBe(false);
      expect(state.surveyModeActivatedAt).toBeNull();
    });

    it('activateSurveyMode() sets isSurveyMode and timestamp', () => {
      useRainModeStore.getState().activateSurveyMode();
      const state = useRainModeStore.getState();
      expect(state.isSurveyMode).toBe(true);
      expect(state.surveyModeActivatedAt).not.toBeNull();
      expect(typeof state.surveyModeActivatedAt).toBe('string');
    });

    it('deactivateSurveyMode() clears isSurveyMode and timestamp', () => {
      useRainModeStore.getState().activateSurveyMode();
      useRainModeStore.getState().deactivateSurveyMode();
      const state = useRainModeStore.getState();
      expect(state.isSurveyMode).toBe(false);
      expect(state.surveyModeActivatedAt).toBeNull();
    });

    it('toggleSurveyMode() flips from false to true', () => {
      useRainModeStore.getState().toggleSurveyMode();
      expect(useRainModeStore.getState().isSurveyMode).toBe(true);
    });

    it('toggleSurveyMode() flips from true to false', () => {
      useRainModeStore.getState().activateSurveyMode();
      useRainModeStore.getState().toggleSurveyMode();
      expect(useRainModeStore.getState().isSurveyMode).toBe(false);
    });
  });
});
