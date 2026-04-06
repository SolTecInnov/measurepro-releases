/**
 * Amplitude Filter Store
 * Manages amplitude-based signal filtering settings for LDM71 and future laser devices
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AmplitudeFilterSettings, AmplitudeFilterStats, AmplitudeFilter } from '../hardware/laser/amplitudeFilter';

interface AmplitudeFilterStore {
  settings: AmplitudeFilterSettings;
  stats: AmplitudeFilterStats;
  filterEnabled: boolean;
  
  updateSettings: (newSettings: Partial<AmplitudeFilterSettings>) => void;
  setFilterEnabled: (enabled: boolean) => void;
  updateStats: (stats: AmplitudeFilterStats) => void;
  applySuggestedThreshold: () => boolean;
  reset: () => void;
  getFilter: () => AmplitudeFilter;
}

const defaultSettings: AmplitudeFilterSettings = {
  amplitudeThresholdDb: 1.0,
  hysteresisDb: 0.5,
  windowSize: 10,
  autoModeEnabled: false
};

const defaultStats: AmplitudeFilterStats = {
  accepted: 0,
  rejected: 0,
  currentThreshold: 1.0,
  suggestedThreshold: null,
  averageAmplitude: null,
  lastAmplitude: null,
  filterState: 'accepting'
};

let filterInstance: AmplitudeFilter | null = null;

export const useAmplitudeFilterStore = create<AmplitudeFilterStore>()(
  persist(
    (set, get) => ({
      settings: defaultSettings,
      stats: defaultStats,
      filterEnabled: true,

      updateSettings: (newSettings: Partial<AmplitudeFilterSettings>) => {
        set((state) => {
          const updatedSettings = { ...state.settings, ...newSettings };
          
          const filter = get().getFilter();
          filter.updateSettings(newSettings);
          
          return { 
            settings: updatedSettings,
            stats: filter.getStats()
          };
        });
      },

      setFilterEnabled: (enabled: boolean) => {
        set({ filterEnabled: enabled });
        console.log(`[AmplitudeFilterStore] Filter ${enabled ? 'enabled' : 'disabled'}`);
      },

      updateStats: (stats: AmplitudeFilterStats) => {
        set({ stats });
      },

      applySuggestedThreshold: (): boolean => {
        const filter = get().getFilter();
        const result = filter.applySuggestedThreshold();
        if (result) {
          set({
            settings: filter.getSettings(),
            stats: filter.getStats()
          });
        }
        return result;
      },

      reset: () => {
        const filter = get().getFilter();
        filter.reset();
        set({
          stats: filter.getStats()
        });
      },

      getFilter: (): AmplitudeFilter => {
        if (!filterInstance) {
          filterInstance = new AmplitudeFilter();
          const state = get();
          filterInstance.updateSettings(state.settings);
          
          filterInstance.addStatsListener((stats) => {
            set({ stats });
          });
        }
        return filterInstance;
      }
    }),
    {
      name: 'measurepro-amplitude-filter',
      version: 2,
      migrate: (persistedState: unknown, version: number) => {
        const state = persistedState as Partial<AmplitudeFilterStore>;
        if (version < 2 && state.settings) {
          if (state.settings.amplitudeThresholdDb >= 10.0) {
            state.settings = { ...state.settings, amplitudeThresholdDb: 1.0, hysteresisDb: 0.5 };
          }
        }
        return state;
      },
      partialize: (state) => ({
        settings: state.settings,
        filterEnabled: state.filterEnabled
      })
    }
  )
);

export function getAmplitudeFilter(): AmplitudeFilter {
  return useAmplitudeFilterStore.getState().getFilter();
}
