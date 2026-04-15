import { describe, it, expect, beforeEach, vi } from 'vitest';

// Stub window global before imports
vi.stubGlobal('window', {
  ...globalThis,
});

import { useDriveModeStore, initDriveModeBridge } from '../driveModeStore';

describe('useDriveModeStore', () => {
  beforeEach(() => {
    useDriveModeStore.setState({ enabled: false });
    delete (window as any).electronAPI;
  });

  it('has correct defaults', () => {
    const state = useDriveModeStore.getState();
    expect(state.enabled).toBe(false);
  });

  describe('syncFromMain', () => {
    it('sets enabled to true', () => {
      useDriveModeStore.getState().syncFromMain(true);
      expect(useDriveModeStore.getState().enabled).toBe(true);
    });

    it('sets enabled to false', () => {
      useDriveModeStore.setState({ enabled: true });
      useDriveModeStore.getState().syncFromMain(false);
      expect(useDriveModeStore.getState().enabled).toBe(false);
    });
  });

  describe('setEnabled', () => {
    it('sets enabled directly when no electronAPI present', async () => {
      await useDriveModeStore.getState().setEnabled(true);
      expect(useDriveModeStore.getState().enabled).toBe(true);
    });

    it('sets enabled to false when no electronAPI present', async () => {
      useDriveModeStore.setState({ enabled: true });
      await useDriveModeStore.getState().setEnabled(false);
      expect(useDriveModeStore.getState().enabled).toBe(false);
    });

    it('calls electronAPI.setDriveMode when available', async () => {
      const mockSetDriveMode = vi.fn().mockResolvedValue(true);
      (window as any).electronAPI = { setDriveMode: mockSetDriveMode };

      await useDriveModeStore.getState().setEnabled(true);
      expect(mockSetDriveMode).toHaveBeenCalledWith(true);
      expect(useDriveModeStore.getState().enabled).toBe(true);
    });

    it('handles electronAPI.setDriveMode returning false', async () => {
      const mockSetDriveMode = vi.fn().mockResolvedValue(false);
      (window as any).electronAPI = { setDriveMode: mockSetDriveMode };

      await useDriveModeStore.getState().setEnabled(true);
      expect(useDriveModeStore.getState().enabled).toBe(false);
    });

    it('handles electronAPI.setDriveMode rejection gracefully', async () => {
      const mockSetDriveMode = vi.fn().mockRejectedValue(new Error('fail'));
      (window as any).electronAPI = { setDriveMode: mockSetDriveMode };

      await useDriveModeStore.getState().setEnabled(true);
      // State should not change on error
      expect(useDriveModeStore.getState().enabled).toBe(false);
    });
  });

  describe('initDriveModeBridge', () => {
    it('does nothing when no electronAPI', () => {
      // Should not throw
      initDriveModeBridge();
    });

    it('reads initial state from main', async () => {
      const mockGetDriveMode = vi.fn().mockResolvedValue(true);
      const mockOnDriveModeChanged = vi.fn();
      (window as any).electronAPI = {
        getDriveMode: mockGetDriveMode,
        onDriveModeChanged: mockOnDriveModeChanged,
      };

      initDriveModeBridge();

      // Wait for the getDriveMode promise
      await vi.waitFor(() => {
        expect(useDriveModeStore.getState().enabled).toBe(true);
      });
    });

    it('subscribes to drive mode changes from main', () => {
      let callback: ((enabled: boolean) => void) | undefined;
      (window as any).electronAPI = {
        getDriveMode: vi.fn().mockResolvedValue(false),
        onDriveModeChanged: vi.fn((cb: (enabled: boolean) => void) => {
          callback = cb;
        }),
      };

      initDriveModeBridge();
      expect(callback).toBeDefined();

      // Simulate main process pushing a change
      callback!(true);
      expect(useDriveModeStore.getState().enabled).toBe(true);
    });
  });
});
