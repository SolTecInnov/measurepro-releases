import { describe, it, expect, beforeEach, vi } from 'vitest';

// Stub localStorage
const localStorageMap = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (key: string) => localStorageMap.get(key) ?? null,
  setItem: (key: string, value: string) => localStorageMap.set(key, value),
  removeItem: (key: string) => localStorageMap.delete(key),
  clear: () => localStorageMap.clear(),
});

// Mock sounds module (accessed by some imports transitively)
vi.mock('@/lib/sounds', () => ({
  soundManager: {
    playLogEntry: vi.fn(),
    playWarning: vi.fn(),
    playCritical: vi.fn(),
    stopSound: vi.fn(),
    getConfig: () => ({}),
    setVolume: vi.fn(),
    subscribe: vi.fn(() => vi.fn()),
  },
  logEntrySound: '/sounds/test.wav',
  warningSound: '/sounds/test.wav',
  criticalSound: '/sounds/test.wav',
  soundPath: (f: string) => `/sounds/${f}`,
}));

import {
  RESERVED_SHORTCUTS,
  useKeyboardStore,
  type KeyboardShortcut,
  type KeyboardMapping,
} from '../keyboard';

describe('keyboard', () => {
  beforeEach(() => {
    localStorageMap.clear();
    // Reset store to defaults
    useKeyboardStore.setState({ mapping: useKeyboardStore.getState().mapping });
  });

  // ── RESERVED_SHORTCUTS ─────────────────────────────────────────────
  describe('RESERVED_SHORTCUTS', () => {
    it('includes Ctrl+Alt+Delete', () => {
      const found = RESERVED_SHORTCUTS.find(
        s => s.keys.includes('Control') && s.keys.includes('Alt') && s.keys.includes('Delete')
      );
      expect(found).toBeDefined();
    });

    it('includes Alt+F4', () => {
      const found = RESERVED_SHORTCUTS.find(
        s => s.keys.includes('Alt') && s.keys.includes('F4')
      );
      expect(found).toBeDefined();
    });

    it('includes F1', () => {
      const found = RESERVED_SHORTCUTS.find(s => s.keys.includes('F1'));
      expect(found).toBeDefined();
    });

    it('has at least 5 reserved shortcuts', () => {
      expect(RESERVED_SHORTCUTS.length).toBeGreaterThanOrEqual(5);
    });
  });

  // ── Default mapping ────────────────────────────────────────────────
  describe('default mapping', () => {
    it('has capture shortcut with Alt+1', () => {
      const { mapping } = useKeyboardStore.getState();
      expect(mapping.capture.key).toBe('1');
      expect(mapping.capture.alt).toBe(true);
    });

    it('has clearAlert shortcut', () => {
      const { mapping } = useKeyboardStore.getState();
      expect(mapping.clearAlert.key).toBe('2');
      expect(mapping.clearAlert.alt).toBe(true);
    });

    it('has logMeasurement shortcut with Alt+G', () => {
      const { mapping } = useKeyboardStore.getState();
      expect(mapping.logMeasurement.key).toBe('G');
      expect(mapping.logMeasurement.alt).toBe(true);
    });

    it('has deleteLastEntry shortcut with Ctrl+Backspace', () => {
      const { mapping } = useKeyboardStore.getState();
      expect(mapping.deleteLastEntry.key).toBe('Backspace');
      expect(mapping.deleteLastEntry.ctrl).toBe(true);
    });

    it('has POI type shortcuts', () => {
      const { mapping } = useKeyboardStore.getState();
      expect(mapping.poiTypes.bridge.key).toBe('b');
      expect(mapping.poiTypes.bridge.alt).toBe(true);
      expect(mapping.poiTypes.tree.key).toBe('t');
    });

    it('has logging control shortcuts', () => {
      const { mapping } = useKeyboardStore.getState();
      expect(mapping.loggingControls.startLog.key).toBe('3');
      expect(mapping.loggingControls.stopLog.key).toBe('4');
    });

    it('has AI detection shortcuts', () => {
      const { mapping } = useKeyboardStore.getState();
      expect(mapping.aiDetection.acceptDetection.key).toBe('7');
      expect(mapping.aiDetection.rejectDetection.key).toBe('8');
    });

    it('has video recording toggle shortcut', () => {
      const { mapping } = useKeyboardStore.getState();
      expect(mapping.videoRecording.toggleRecording.key).toBe('V');
      expect(mapping.videoRecording.toggleRecording.alt).toBe(true);
    });
  });

  // ── isShortcutReserved ─────────────────────────────────────────────
  describe('isShortcutReserved', () => {
    it('detects Ctrl+W as reserved', () => {
      const { isShortcutReserved } = useKeyboardStore.getState();
      expect(isShortcutReserved({ key: 'W', ctrl: true, description: '' })).toBe(true);
    });

    it('detects Alt+F4 as reserved', () => {
      const { isShortcutReserved } = useKeyboardStore.getState();
      expect(isShortcutReserved({ key: 'F4', alt: true, description: '' })).toBe(true);
    });

    it('does not flag Alt+G as reserved', () => {
      const { isShortcutReserved } = useKeyboardStore.getState();
      expect(isShortcutReserved({ key: 'G', alt: true, description: '' })).toBe(false);
    });
  });

  // ── validateShortcut ───────────────────────────────────────────────
  describe('validateShortcut', () => {
    it('rejects reserved shortcuts', () => {
      const { validateShortcut } = useKeyboardStore.getState();
      const result = validateShortcut({ key: 'W', ctrl: true, description: '' });
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('reserved');
    });

    it('detects conflicts with existing shortcuts', () => {
      const { validateShortcut } = useKeyboardStore.getState();
      // Alt+1 is "capture" in defaults
      const result = validateShortcut({ key: '1', alt: true, description: '' });
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('Conflicts');
    });
  });

  // ── getConflictingShortcut ─────────────────────────────────────────
  describe('getConflictingShortcut', () => {
    it('returns description of conflicting shortcut', () => {
      const { getConflictingShortcut } = useKeyboardStore.getState();
      const conflict = getConflictingShortcut({ key: '1', alt: true, description: '' });
      expect(conflict).toBe('Capture Image');
    });

    it('returns null for non-conflicting shortcut', () => {
      const { getConflictingShortcut } = useKeyboardStore.getState();
      // Use a key combo not in default mapping
      const conflict = getConflictingShortcut({
        key: 'F12', ctrl: true, alt: true, shift: true, description: '',
      });
      expect(conflict).toBeNull();
    });
  });

  // ── setMapping ─────────────────────────────────────────────────────
  describe('setMapping', () => {
    it('replaces the current mapping', () => {
      const { mapping } = useKeyboardStore.getState();
      const modified = { ...mapping, capture: { ...mapping.capture, key: 'Z' } };
      useKeyboardStore.getState().setMapping(modified);
      expect(useKeyboardStore.getState().mapping.capture.key).toBe('Z');
    });
  });
});
