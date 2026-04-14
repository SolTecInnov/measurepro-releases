/**
 * Rain Mode Store
 *
 * When active, all laser-dependent POI types (auto-capture-and-log)
 * temporarily behave as auto-capture-no-measurement so users can
 * keep documenting road features without laser readings.
 *
 * Survey Mode (GPS-Only):
 * When active, ALL POI types work without laser — no measurement required.
 * Adds "NO VERTICAL CLEARANCE" note to every POI.
 * Works even with laser disconnected.
 */
import { create } from 'zustand';

interface RainModeState {
  isActive: boolean;
  activatedAt: string | null;
  // GPS-Only Survey Mode — all POIs work without laser
  isSurveyMode: boolean;
  surveyModeActivatedAt: string | null;
  toggle: () => void;
  activate: () => void;
  deactivate: () => void;
  toggleSurveyMode: () => void;
  activateSurveyMode: () => void;
  deactivateSurveyMode: () => void;
}

export const useRainModeStore = create<RainModeState>((set, get) => ({
  isActive: false,
  activatedAt: null,
  isSurveyMode: false,
  surveyModeActivatedAt: null,

  toggle: () => {
    const current = get().isActive;
    if (current) {
      get().deactivate();
    } else {
      get().activate();
    }
  },

  activate: () => {
    set({ isActive: true, activatedAt: new Date().toISOString() });
    console.log('[RainMode] Activated — laser-dependent POIs will log without measurement');
  },

  deactivate: () => {
    set({ isActive: false, activatedAt: null });
    console.log('[RainMode] Deactivated — normal measurement logging resumed');
  },

  toggleSurveyMode: () => {
    if (get().isSurveyMode) get().deactivateSurveyMode();
    else get().activateSurveyMode();
  },

  activateSurveyMode: () => {
    set({ isSurveyMode: true, surveyModeActivatedAt: new Date().toISOString() });
    console.log('[SurveyMode] GPS-Only activated — all POIs log without laser, no vertical clearance');
  },

  deactivateSurveyMode: () => {
    set({ isSurveyMode: false, surveyModeActivatedAt: null });
    console.log('[SurveyMode] GPS-Only deactivated — normal laser measurement resumed');
  },
}));
