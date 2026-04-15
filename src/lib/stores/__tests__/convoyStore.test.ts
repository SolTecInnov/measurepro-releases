import { describe, it, expect, beforeEach, vi } from 'vitest';

// Stub browser globals before imports
vi.stubGlobal('localStorage', {
  getItem: vi.fn(() => null),
  setItem: vi.fn(),
  removeItem: vi.fn(),
});

// Mock modules that access browser APIs at import time
vi.mock('../../sounds', () => ({
  soundManager: {
    playEmergency: vi.fn().mockResolvedValue(undefined),
    stopSound: vi.fn(),
  },
}));

vi.mock('@/lib/convoy/logSyncService', () => ({
  processSyncAcknowledgment: vi.fn(),
}));

vi.mock('@/lib/config/environment', () => ({
  getWsUrl: vi.fn(() => 'ws://localhost:3001/api'),
}));

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));

import { useConvoyStore } from '../convoyStore';

describe('useConvoyStore', () => {
  beforeEach(() => {
    useConvoyStore.setState({
      currentSession: null,
      isLeader: false,
      myMemberId: null,
      members: [],
      ws: null,
      connected: false,
      leaderConnected: false,
      leaderLastSeen: 0,
      sessionConnectedAt: null,
      currentMeasurement: '--',
      lastAlert: null,
      leaderGPS: null,
      emergencyActive: false,
      emergencyReason: null,
      emergencyTriggeredBy: null,
      emergencyTimestamp: null,
    });
  });

  it('has correct defaults', () => {
    const state = useConvoyStore.getState();
    expect(state.currentSession).toBeNull();
    expect(state.isLeader).toBe(false);
    expect(state.myMemberId).toBeNull();
    expect(state.members).toEqual([]);
    expect(state.ws).toBeNull();
    expect(state.connected).toBe(false);
    expect(state.leaderConnected).toBe(false);
    expect(state.leaderLastSeen).toBe(0);
    expect(state.sessionConnectedAt).toBeNull();
    expect(state.currentMeasurement).toBe('--');
    expect(state.lastAlert).toBeNull();
    expect(state.leaderGPS).toBeNull();
    expect(state.emergencyActive).toBe(false);
    expect(state.emergencyReason).toBeNull();
    expect(state.emergencyTriggeredBy).toBeNull();
    expect(state.emergencyTimestamp).toBeNull();
  });

  describe('setCurrentMeasurement', () => {
    it('updates the current measurement', () => {
      useConvoyStore.getState().setCurrentMeasurement('3.45m');
      expect(useConvoyStore.getState().currentMeasurement).toBe('3.45m');
    });
  });

  describe('setAlert', () => {
    it('sets an alert with timestamp', () => {
      useConvoyStore.getState().setAlert({ level: 'warning', message: 'Low clearance' });
      const alert = useConvoyStore.getState().lastAlert;
      expect(alert).not.toBeNull();
      expect(alert!.level).toBe('warning');
      expect(alert!.message).toBe('Low clearance');
      expect(alert!.timestamp).toBeGreaterThan(0);
    });

    it('clears alert when set to null', () => {
      useConvoyStore.getState().setAlert({ level: 'critical', message: 'test' });
      useConvoyStore.getState().setAlert(null);
      expect(useConvoyStore.getState().lastAlert).toBeNull();
    });
  });

  describe('setEmergency', () => {
    it('activates emergency with reason', () => {
      useConvoyStore.getState().setEmergency(true, 'Bridge too low');
      const state = useConvoyStore.getState();
      expect(state.emergencyActive).toBe(true);
      expect(state.emergencyReason).toBe('Bridge too low');
      expect(state.emergencyTimestamp).toBeGreaterThan(0);
    });

    it('deactivates emergency', () => {
      useConvoyStore.getState().setEmergency(true, 'test');
      useConvoyStore.getState().setEmergency(false);
      const state = useConvoyStore.getState();
      expect(state.emergencyActive).toBe(false);
      expect(state.emergencyReason).toBeNull();
      expect(state.emergencyTimestamp).toBeNull();
    });
  });

  describe('updateMembers', () => {
    it('sets members array', () => {
      const members = [
        { id: 'm1', name: 'Truck 1', role: 'lead', isConnected: true } as any,
        { id: 'm2', name: 'Pilot', role: 'pilot_car', isConnected: true } as any,
      ];
      useConvoyStore.getState().updateMembers(members);
      expect(useConvoyStore.getState().members).toHaveLength(2);
    });
  });

  describe('handleIncomingMessage', () => {
    it('handles join_approved', () => {
      const session = { id: 'session-1' };
      useConvoyStore.getState().handleIncomingMessage({
        type: 'join_approved',
        sessionId: 'session-1',
        data: {
          session,
          memberId: 'member-1',
          members: [{ id: 'member-1', name: 'Me' }],
        },
        timestamp: Date.now(),
      } as any);

      const state = useConvoyStore.getState();
      expect(state.connected).toBe(true);
      expect(state.currentSession).toEqual(session);
      expect(state.myMemberId).toBe('member-1');
      expect(state.members).toHaveLength(1);
    });

    it('handles measurement', () => {
      useConvoyStore.getState().handleIncomingMessage({
        type: 'measurement',
        sessionId: 's1',
        data: { measurement: '5.67m' },
        timestamp: Date.now(),
      } as any);

      expect(useConvoyStore.getState().currentMeasurement).toBe('5.67m');
    });

    it('handles alert', () => {
      const ts = Date.now();
      useConvoyStore.getState().handleIncomingMessage({
        type: 'alert',
        sessionId: 's1',
        data: { level: 'critical', message: 'Danger!' },
        timestamp: ts,
      } as any);

      const alert = useConvoyStore.getState().lastAlert;
      expect(alert!.level).toBe('critical');
      expect(alert!.message).toBe('Danger!');
      expect(alert!.timestamp).toBe(ts);
    });

    it('handles gps', () => {
      useConvoyStore.getState().handleIncomingMessage({
        type: 'gps',
        sessionId: 's1',
        data: { latitude: 45.5, longitude: -73.5, altitude: 100 },
        timestamp: Date.now(),
      } as any);

      const gps = useConvoyStore.getState().leaderGPS;
      expect(gps).toEqual({ latitude: 45.5, longitude: -73.5, altitude: 100 });
    });

    it('handles member_status joined', () => {
      useConvoyStore.setState({ members: [] });
      useConvoyStore.getState().handleIncomingMessage({
        type: 'member_status',
        sessionId: 's1',
        data: { action: 'joined', member: { id: 'new1', name: 'New' } },
        timestamp: Date.now(),
      } as any);

      expect(useConvoyStore.getState().members).toHaveLength(1);
    });

    it('handles member_status disconnected', () => {
      useConvoyStore.setState({
        members: [{ id: 'm1', name: 'A', isConnected: true } as any],
      });
      useConvoyStore.getState().handleIncomingMessage({
        type: 'member_status',
        sessionId: 's1',
        data: { action: 'disconnected', member: { id: 'm1' } },
        timestamp: Date.now(),
      } as any);

      expect(useConvoyStore.getState().members[0].isConnected).toBe(false);
    });

    it('handles emergency_acknowledged', () => {
      useConvoyStore.setState({
        emergencyActive: true,
        emergencyReason: 'test',
        emergencyTriggeredBy: 'Leader',
        emergencyTimestamp: Date.now(),
      });

      useConvoyStore.getState().handleIncomingMessage({
        type: 'emergency_acknowledged',
        sessionId: 's1',
        data: {},
        timestamp: Date.now(),
      } as any);

      const state = useConvoyStore.getState();
      expect(state.emergencyActive).toBe(false);
      expect(state.emergencyReason).toBeNull();
    });

    it('handles session_ended', () => {
      useConvoyStore.setState({
        currentSession: { id: 'session-1' } as any,
        members: [{ id: 'm1' } as any],
        connected: true,
        emergencyActive: true,
      });

      useConvoyStore.getState().handleIncomingMessage({
        type: 'session_ended',
        sessionId: 'session-1',
        data: {},
        timestamp: Date.now(),
      } as any);

      const state = useConvoyStore.getState();
      expect(state.currentSession).toBeNull();
      expect(state.members).toEqual([]);
      expect(state.connected).toBe(false);
      expect(state.emergencyActive).toBe(false);
    });

    it('handles config_change updates session', () => {
      useConvoyStore.setState({
        currentSession: { id: 's1', name: 'Old' } as any,
      });

      useConvoyStore.getState().handleIncomingMessage({
        type: 'config_change',
        sessionId: 's1',
        data: { name: 'New Name' },
        timestamp: Date.now(),
      } as any);

      expect((useConvoyStore.getState().currentSession as any).name).toBe('New Name');
    });
  });

  describe('disconnect', () => {
    it('clears session state', () => {
      useConvoyStore.setState({
        currentSession: { id: 's1' } as any,
        connected: true,
        members: [{ id: 'm1' } as any],
        isLeader: true,
        myMemberId: 'm1',
        sessionConnectedAt: Date.now(),
        ws: { close: vi.fn() } as any,
      });

      useConvoyStore.getState().disconnect();
      const state = useConvoyStore.getState();
      expect(state.ws).toBeNull();
      expect(state.connected).toBe(false);
      expect(state.currentSession).toBeNull();
      expect(state.members).toEqual([]);
      expect(state.isLeader).toBe(false);
      expect(state.myMemberId).toBeNull();
      expect(state.sessionConnectedAt).toBeNull();
    });
  });

  describe('acknowledgeEmergency', () => {
    it('clears emergency state and stops sounds', async () => {
      const { soundManager } = await import('../../sounds');

      useConvoyStore.setState({
        emergencyActive: true,
        emergencyReason: 'Bridge clearance',
        emergencyTriggeredBy: 'Leader',
        emergencyTimestamp: Date.now(),
        currentSession: { id: 'session-1' } as any,
        connected: true,
        ws: { send: vi.fn() } as any,
      });

      useConvoyStore.getState().acknowledgeEmergency();

      const state = useConvoyStore.getState();
      expect(state.emergencyActive).toBe(false);
      expect(state.emergencyReason).toBeNull();
      expect(state.emergencyTriggeredBy).toBeNull();
      expect(state.emergencyTimestamp).toBeNull();
      expect(soundManager.stopSound).toHaveBeenCalledWith('emergency');
      expect(soundManager.stopSound).toHaveBeenCalledWith('critical');
    });
  });

  describe('sendHeartbeat', () => {
    it('sends heartbeat when session exists', () => {
      const mockSend = vi.fn();
      useConvoyStore.setState({
        currentSession: { id: 'session-1' } as any,
        connected: true,
        ws: { send: mockSend } as any,
      });

      useConvoyStore.getState().sendHeartbeat();
      expect(mockSend).toHaveBeenCalled();
      const sent = JSON.parse(mockSend.mock.calls[0][0]);
      expect(sent.type).toBe('member_status');
      expect(sent.data.action).toBe('heartbeat');
    });

    it('does nothing when no session', () => {
      useConvoyStore.getState().sendHeartbeat();
      // Should not throw
    });
  });
});
