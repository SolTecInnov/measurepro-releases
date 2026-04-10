/**
 * Rain Mode Store
 *
 * When active, all laser-dependent POI types (auto-capture-and-log)
 * temporarily behave as auto-capture-no-measurement so users can
 * keep documenting road features without laser readings.
 */
import { create } from 'zustand';

interface RainModeState {
  isActive: boolean;
  activatedAt: string | null;
  toggle: () => void;
  activate: () => void;
  deactivate: () => void;
}

export const useRainModeStore = create<RainModeState>((set, get) => ({
  isActive: false,
  activatedAt: null,

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
}));
