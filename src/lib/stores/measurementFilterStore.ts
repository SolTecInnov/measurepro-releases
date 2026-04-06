import { create } from 'zustand';
import { MeasurementFilter, FilterSensitivity, FilterResult } from '../filters/measurementFilter';
import { useSettingsStore } from '../settings';

interface MeasurementFilterState {
  filter: MeasurementFilter;
  sensitivity: FilterSensitivity;
  enabled: boolean;
  lastResult: FilterResult | null;
  filteredCount: number;
  acceptedCount: number;
  
  setSensitivity: (sensitivity: FilterSensitivity) => void;
  setEnabled: (enabled: boolean) => void;
  filterMeasurement: (rawValue: string) => FilterResult;
  reset: () => void;
  getStats: () => { filtered: number; accepted: number; ratio: number };
}

export const useMeasurementFilterStore = create<MeasurementFilterState>((set, get) => {
  const filter = new MeasurementFilter('medium');
  
  return {
    filter,
    sensitivity: 'medium',
    enabled: true,
    lastResult: null,
    filteredCount: 0,
    acceptedCount: 0,
    
    setSensitivity: (sensitivity: FilterSensitivity) => {
      const { filter } = get();
      filter.setSensitivity(sensitivity);
      set({ 
        sensitivity,
        enabled: sensitivity !== 'off',
      });
      
      useSettingsStore.getState().setUISettings({ measurementFilterSensitivity: sensitivity });
    },
    
    setEnabled: (enabled: boolean) => {
      const { filter } = get();
      if (!enabled) {
        filter.setSensitivity('off');
        set({ enabled: false, sensitivity: 'off' });
      } else {
        const savedSensitivity = (useSettingsStore.getState().uiSettings.measurementFilterSensitivity || localStorage.getItem('measurementFilterSensitivity')) as FilterSensitivity || 'medium';
        const newSensitivity = savedSensitivity === 'off' ? 'medium' : savedSensitivity;
        filter.setSensitivity(newSensitivity);
        set({ enabled: true, sensitivity: newSensitivity });
      }
    },
    
    filterMeasurement: (rawValue: string): FilterResult => {
      const { filter, filteredCount, acceptedCount } = get();
      const result = filter.filter(rawValue);
      
      set({
        lastResult: result,
        filteredCount: result.accepted ? filteredCount : filteredCount + 1,
        acceptedCount: result.accepted ? acceptedCount + 1 : acceptedCount,
      });
      
      return result;
    },
    
    reset: () => {
      const { filter } = get();
      filter.reset();
      set({
        lastResult: null,
        filteredCount: 0,
        acceptedCount: 0,
      });
    },
    
    getStats: () => {
      const { filteredCount, acceptedCount } = get();
      const total = filteredCount + acceptedCount;
      return {
        filtered: filteredCount,
        accepted: acceptedCount,
        ratio: total > 0 ? acceptedCount / total : 0,
      };
    },
  };
});

const VALID_SENSITIVITIES: FilterSensitivity[] = ['off', 'low', 'medium', 'high'];

const savedSensitivity = typeof localStorage !== 'undefined' 
  ? localStorage.getItem('measurementFilterSensitivity') as FilterSensitivity 
  : null;

if (savedSensitivity && VALID_SENSITIVITIES.includes(savedSensitivity)) {
  useMeasurementFilterStore.getState().setSensitivity(savedSensitivity);
}

// Listen for DB restore events to rehydrate active filter without circular imports
if (typeof window !== 'undefined') {
  window.addEventListener('settings:filter-sensitivity-restored', (e: Event) => {
    const sensitivity = (e as CustomEvent<{ sensitivity: string }>).detail?.sensitivity as FilterSensitivity;
    if (sensitivity && VALID_SENSITIVITIES.includes(sensitivity)) {
      const store = useMeasurementFilterStore.getState();
      store.filter.setSensitivity(sensitivity);
      useMeasurementFilterStore.setState({
        sensitivity,
        enabled: sensitivity !== 'off',
      });
    }
  });
}
