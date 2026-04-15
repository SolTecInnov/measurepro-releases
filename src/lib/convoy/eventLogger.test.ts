import { describe, it, expect, vi, beforeEach } from 'vitest';

// Stub localStorage and window globals BEFORE imports
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
  };
})();
vi.stubGlobal('localStorage', localStorageMock);
vi.stubGlobal('crypto', { randomUUID: () => 'test-uuid-1234' });

const dispatchEventMock = vi.fn();
vi.stubGlobal('window', {
  dispatchEvent: dispatchEventMock,
  screen: { width: 1920, height: 1080 },
});
vi.stubGlobal('navigator', {
  userAgent: 'test-agent',
  platform: 'test-platform',
  onLine: true,
  connection: { effectiveType: '4g' },
});
vi.stubGlobal('CustomEvent', class CustomEvent {
  type: string;
  constructor(type: string) { this.type = type; }
});

// Mock blackBoxContext
vi.mock('./blackBoxContext', () => ({
  captureBlackBoxContext: () => ({
    gpsSnapshot: null,
    convoyState: null,
    deviceMetadata: {
      userAgent: 'test-agent',
      platform: 'test-platform',
      screenWidth: 1920,
      screenHeight: 1080,
      networkType: '4g',
      online: true,
    },
  }),
  getCurrentSessionId: () => 'test-session-id',
  getCurrentConvoyRole: () => 'leader' as const,
}));

import {
  getBlackBoxEvents,
  clearBlackBoxEvents,
  getUnsyncedEvents,
  updateEventsSyncStatus,
  getConvoyEventLogs,
  clearConvoyEventLogs,
  exportConvoyLogsToCSV,
  logSessionStarted,
  logMemberJoin,
  logMeasurement,
  logLaserAlert,
} from './eventLogger';

describe('eventLogger', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  describe('getBlackBoxEvents', () => {
    it('returns empty array when no events stored', () => {
      expect(getBlackBoxEvents()).toEqual([]);
    });

    it('returns stored events', () => {
      const events = [{ id: '1', timestamp: Date.now() }];
      localStorageMock.setItem('convoy_black_box_events', JSON.stringify(events));
      expect(getBlackBoxEvents()).toEqual(events);
    });

    it('returns empty array on parse error', () => {
      localStorageMock.setItem('convoy_black_box_events', 'invalid json');
      localStorageMock.getItem.mockReturnValueOnce('invalid json');
      // JSON.parse will throw, function should catch and return []
      expect(getBlackBoxEvents()).toEqual([]);
    });
  });

  describe('clearBlackBoxEvents', () => {
    it('removes events from localStorage', () => {
      localStorageMock.setItem('convoy_black_box_events', '[]');
      clearBlackBoxEvents();
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('convoy_black_box_events');
    });

    it('dispatches convoy-event-logged event', () => {
      clearBlackBoxEvents();
      expect(dispatchEventMock).toHaveBeenCalled();
    });
  });

  describe('getUnsyncedEvents', () => {
    it('returns empty array when no events', () => {
      expect(getUnsyncedEvents()).toEqual([]);
    });

    it('filters for local and failed events', () => {
      const events = [
        { id: '1', syncStatus: 'local' },
        { id: '2', syncStatus: 'synced' },
        { id: '3', syncStatus: 'failed' },
      ];
      localStorageMock.setItem('convoy_black_box_events', JSON.stringify(events));
      const result = getUnsyncedEvents();
      expect(result).toHaveLength(2);
      expect(result.map((e: any) => e.id)).toEqual(['1', '3']);
    });
  });

  describe('updateEventsSyncStatus', () => {
    it('updates sync status for specified events', () => {
      const events = [
        { id: '1', syncStatus: 'local', syncRetries: 0 },
        { id: '2', syncStatus: 'local', syncRetries: 0 },
      ];
      localStorageMock.setItem('convoy_black_box_events', JSON.stringify(events));

      updateEventsSyncStatus(['1'], 'synced');

      const stored = JSON.parse(localStorageMock.setItem.mock.calls.at(-1)![1]);
      expect(stored[0].syncStatus).toBe('synced');
      expect(stored[1].syncStatus).toBe('local');
    });

    it('increments retries when specified', () => {
      const events = [
        { id: '1', syncStatus: 'local', syncRetries: 2 },
      ];
      localStorageMock.setItem('convoy_black_box_events', JSON.stringify(events));

      updateEventsSyncStatus(['1'], 'failed', true);

      const stored = JSON.parse(localStorageMock.setItem.mock.calls.at(-1)![1]);
      expect(stored[0].syncRetries).toBe(3);
    });
  });

  describe('logSessionStarted', () => {
    it('creates and stores a session_started event', () => {
      const event = logSessionStarted('John', 'leader', {
        sessionName: 'Test Session',
        warningThreshold: 5,
        criticalThreshold: 3,
        groundReference: 0,
        maxMembers: 10,
      });

      expect(event.eventCategory).toBe('session_lifecycle');
      expect(event.eventType).toBe('session_started');
      expect(event.actor.name).toBe('John');
      expect(event.payload.sessionName).toBe('Test Session');
    });
  });

  describe('logMemberJoin', () => {
    it('creates a member_joined event', () => {
      const event = logMemberJoin('Jane', 'follower', 'AcmeCo', '555-1234', {
        vehicleId: 'V1',
        radioChannel: 'CH5',
      });

      expect(event.eventCategory).toBe('member_activity');
      expect(event.eventType).toBe('member_joined');
      expect(event.actor.name).toBe('Jane');
      expect(event.actor.company).toBe('AcmeCo');
      expect(event.payload.vehicleId).toBe('V1');
    });
  });

  describe('logMeasurement', () => {
    it('creates a measurement_broadcast event', () => {
      const event = logMeasurement(5.5, 'LaserModule', 'automatic', 'John', 'leader');

      expect(event.eventCategory).toBe('measurement');
      expect(event.eventType).toBe('measurement_broadcast');
      expect(event.payload.measurementValue).toBe(5.5);
      expect(event.payload.measurementUnit).toBe('meters');
    });
  });

  describe('logLaserAlert', () => {
    it('creates a laser_alert event', () => {
      const event = logLaserAlert('warning', 4.8, 'LaserModule', 'John', 'leader', 5.0);

      expect(event.eventCategory).toBe('alert');
      expect(event.eventType).toBe('laser_alert');
      expect(event.payload.alertLevel).toBe('warning');
      expect(event.payload.threshold).toBe(5.0);
    });
  });

  describe('Legacy functions', () => {
    describe('getConvoyEventLogs', () => {
      it('returns empty array when nothing stored', () => {
        expect(getConvoyEventLogs()).toEqual([]);
      });

      it('returns stored logs', () => {
        const logs = [{ id: '1' }];
        localStorageMock.setItem('convoy_event_logs', JSON.stringify(logs));
        expect(getConvoyEventLogs()).toEqual(logs);
      });
    });

    describe('clearConvoyEventLogs', () => {
      it('removes convoy_event_logs', () => {
        clearConvoyEventLogs();
        expect(localStorageMock.removeItem).toHaveBeenCalledWith('convoy_event_logs');
      });
    });

    describe('exportConvoyLogsToCSV', () => {
      it('returns CSV with headers for empty logs', () => {
        const csv = exportConvoyLogsToCSV([]);
        expect(csv).toContain('Timestamp');
        expect(csv).toContain('Event Type');
        expect(csv.split('\n')).toHaveLength(1); // just headers
      });

      it('includes log data in CSV', () => {
        const logs = [{
          timestamp: 1704067200000,
          eventType: 'convoy_session',
          severity: 'info',
          sessionId: 'sess-1',
          memberId: 'mem-1',
          measurement: 5.5,
          latitude: 45.5,
          longitude: -73.5,
          altitude: 100,
          speed: 10,
          videoUrl: null,
          imageUrl: null,
          metadata: '{}',
        }];
        const csv = exportConvoyLogsToCSV(logs);
        const lines = csv.split('\n');
        expect(lines).toHaveLength(2);
        expect(lines[1]).toContain('convoy_session');
      });
    });
  });
});
