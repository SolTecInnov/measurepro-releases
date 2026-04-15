import { describe, it, expect, beforeEach, vi } from 'vitest';

// Stub localStorage before imports
vi.stubGlobal('localStorage', {
  getItem: vi.fn((key: string) => {
    if (key === 'voice_synthesizer_volume') return '0.8';
    return null;
  }),
  setItem: vi.fn(),
  removeItem: vi.fn(),
});

// Mock dependencies
vi.mock('@/lib/stores/gpsStore', () => ({
  useGPSStore: {
    getState: vi.fn(() => ({
      connected: true,
      data: { latitude: 45.5, longitude: -73.5, fixQuality: 'RTK', satellites: 12, speed: 50 },
    })),
  },
}));

vi.mock('@/lib/laser', () => ({
  useLaserStore: {
    getState: vi.fn(() => ({ connected: true })),
  },
}));

vi.mock('@/lib/settings', () => ({
  useSettingsStore: {
    getState: vi.fn(() => ({
      displaySettings: { units: 'metric' },
    })),
  },
}));

vi.mock('@/lib/stores/serialStore', () => ({
  useSerialStore: {
    getState: vi.fn(() => ({
      lastMeasurement: '4.25m',
    })),
  },
}));

vi.mock('../triggerKeyboardShortcut', () => ({
  triggerShortcutByKeys: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

vi.mock('@/lib/sounds', () => ({
  soundManager: { play: vi.fn() },
}));

import { CommandRegistry } from '../CommandRegistry';

describe('CommandRegistry', () => {
  let registry: CommandRegistry;

  beforeEach(() => {
    registry = new CommandRegistry();
    vi.clearAllMocks();
  });

  describe('register', () => {
    it('registers a custom handler', async () => {
      const handler = vi.fn(async () => 'custom response');
      registry.register('unknown', handler);
      const response = await registry.execute('unknown', 'en-US');
      expect(response).toBe('custom response');
      expect(handler).toHaveBeenCalledWith('en-US');
    });

    it('overrides a default handler', async () => {
      registry.register('last_measurement', async () => 'overridden');
      const response = await registry.execute('last_measurement', 'en-US');
      expect(response).toBe('overridden');
    });
  });

  describe('execute', () => {
    it('executes last_measurement handler', async () => {
      const response = await registry.execute('last_measurement', 'en-US');
      expect(response).toContain('4.25m');
    });

    it('executes gps_location handler', async () => {
      const response = await registry.execute('gps_location', 'en-US');
      expect(response).toContain('45.5');
      expect(response).toContain('-73.5');
    });

    it('executes laser_status handler', async () => {
      const response = await registry.execute('laser_status', 'en-US');
      expect(response).toContain('connected');
    });

    it('executes current_time handler', async () => {
      const response = await registry.execute('current_time', 'en-US');
      expect(response).toContain('Current time');
    });

    it('executes identity handler', async () => {
      const response = await registry.execute('identity', 'en-US');
      expect(response).toContain('Max Load');
    });

    it('returns unknown response for unregistered intent', async () => {
      // Clear all handlers by creating a new registry and removing them
      const emptyRegistry = new CommandRegistry();
      // The default handler for 'unknown' should return the unknown response
      const response = await emptyRegistry.execute('unknown', 'en-US');
      expect(response).toContain("didn't understand");
    });

    it('returns command_failed on handler error', async () => {
      registry.register('last_measurement', async () => {
        throw new Error('test error');
      });
      const response = await registry.execute('last_measurement', 'en-US');
      expect(response).toContain('failed');
    });

    it('supports French language', async () => {
      const response = await registry.execute('identity', 'fr-FR');
      expect(response).toContain('Max Load');
    });

    it('supports Spanish language', async () => {
      const response = await registry.execute('identity', 'es-ES');
      expect(response).toContain('Max Load');
    });
  });

  describe('callback setters', () => {
    it('onVolumeChange sets callback', async () => {
      const cb = vi.fn();
      registry.onVolumeChange(cb);
      await registry.execute('volume_up', 'en-US');
      expect(cb).toHaveBeenCalled();
    });

    it('onManualLog sets callback', async () => {
      const cb = vi.fn();
      registry.onManualLog(cb);
      await registry.execute('manual_log', 'en-US');
      expect(cb).toHaveBeenCalled();
    });

    it('onRecordNote sets callback', async () => {
      const cb = vi.fn();
      registry.onRecordNote(cb);
      await registry.execute('record_note', 'en-US');
      expect(cb).toHaveBeenCalled();
    });

    it('onClearWarnings sets callback', async () => {
      const cb = vi.fn();
      registry.onClearWarnings(cb);
      await registry.execute('clear_warnings', 'en-US');
      expect(cb).toHaveBeenCalled();
    });

    it('onClearCritical sets callback', async () => {
      const cb = vi.fn();
      registry.onClearCritical(cb);
      await registry.execute('clear_critical', 'en-US');
      expect(cb).toHaveBeenCalled();
    });
  });

  describe('POI command execution', () => {
    it('executes poi_bridge and returns response', async () => {
      const response = await registry.execute('poi_bridge', 'en-US');
      expect(response).toContain('Bridge');
    });

    it('executes poi_tunnel and returns response', async () => {
      const response = await registry.execute('poi_tunnel', 'en-US');
      expect(response).toContain('Tunnel');
    });
  });
});
