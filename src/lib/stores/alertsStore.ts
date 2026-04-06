import { create } from 'zustand';

interface AlertsState {
  alertStatus: 'warning' | 'critical' | null;
  triggerValue: number | null;
  setAlertStatus: (status: 'warning' | 'critical' | null) => void;
  setTriggerValue: (value: number | null) => void;
  clearAlert: () => void;
}

export const useAlertsStore = create<AlertsState>((set) => ({
  alertStatus: null,
  triggerValue: null,
  setAlertStatus: (status) => {
    set({ alertStatus: status });
  },
  setTriggerValue: (value) => {
    set({ triggerValue: value });
  },
  clearAlert: () => {
    set({ alertStatus: null, triggerValue: null });
  },
}));
