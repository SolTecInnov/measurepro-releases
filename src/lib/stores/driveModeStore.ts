/**
 * Drive Mode store
 *
 * Drive Mode locks the app fullscreen + always-on-top + kiosk so a passenger
 * (or accidental tap) can't bring another window forward, minimize MeasurePRO,
 * or close it. Designed for in-vehicle field use.
 *
 * The actual window-level changes happen in the Electron main process via the
 * IPC bridge (window.electronAPI.setDriveMode). This store mirrors the state
 * for React components that need to react to it (badge, header tint, Tools
 * menu item visibility).
 *
 * Exit gesture: triple-tap on the persistent badge — see DriveModeBadge.tsx.
 */

import { create } from 'zustand';

interface DriveModeState {
  enabled: boolean;
  setEnabled: (next: boolean) => Promise<void>;
  /** Toggle without going through the IPC layer — used by the IPC listener
   *  when main pushes a state change up so React stays in sync. */
  syncFromMain: (next: boolean) => void;
}

export const useDriveModeStore = create<DriveModeState>((set) => ({
  enabled: false,

  setEnabled: async (next: boolean) => {
    const api = (window as any).electronAPI;
    if (api?.setDriveMode) {
      try {
        const result = await api.setDriveMode(next);
        set({ enabled: !!result });
      } catch (err) {
        console.error('[DriveMode] Failed to toggle:', err);
      }
    } else {
      // Non-Electron environments (dev browser, tests): just track state locally
      set({ enabled: next });
    }
  },

  syncFromMain: (next: boolean) => set({ enabled: next }),
}));

/**
 * Initialize Drive Mode wiring on app boot:
 *   - Read the current state from main (in case the app was restarted while locked)
 *   - Subscribe to drive-mode-changed events from main so React stays in sync
 */
export function initDriveModeBridge(): void {
  const api = (window as any).electronAPI;
  if (!api) return;

  api.getDriveMode?.().then((enabled: boolean) => {
    useDriveModeStore.getState().syncFromMain(!!enabled);
  }).catch(() => {});

  api.onDriveModeChanged?.((enabled: boolean) => {
    useDriveModeStore.getState().syncFromMain(!!enabled);
  });
}
