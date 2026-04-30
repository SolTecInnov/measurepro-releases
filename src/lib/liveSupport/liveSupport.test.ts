/**
 * Live Support — Unit Tests
 * Tests types, store, and client logic.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useLiveSupportStore } from './liveSupportStore';
import type { SessionDTO, AnnotationMsg } from './types';
import { ANNOTATION_TTL_MS, ICE_SERVERS, CURSOR_THROTTLE_MS, SESSION_END_DISPLAY_MS } from './types';

// ── Constants ─────────────────────────────────────────────────────────────────

describe('Live Support Constants', () => {
  it('should have correct annotation TTL', () => {
    expect(ANNOTATION_TTL_MS).toBe(5000);
  });

  it('should have correct cursor throttle', () => {
    expect(CURSOR_THROTTLE_MS).toBe(30);
  });

  it('should have correct session end display time', () => {
    expect(SESSION_END_DISPLAY_MS).toBe(4000);
  });

  it('should have STUN servers configured', () => {
    expect(ICE_SERVERS).toHaveLength(2);
    expect(ICE_SERVERS[0].urls).toBe('stun:stun.l.google.com:19302');
    expect(ICE_SERVERS[1].urls).toBe('stun:stun1.l.google.com:19302');
  });
});

// ── Store ─────────────────────────────────────────────────────────────────────

describe('LiveSupportStore', () => {
  beforeEach(() => {
    useLiveSupportStore.getState().reset();
  });

  it('should start with default state', () => {
    const state = useLiveSupportStore.getState();
    expect(state.sessionId).toBeNull();
    expect(state.session).toBeNull();
    expect(state.peerConnected).toBe(false);
    expect(state.wsConnected).toBe(false);
    expect(state.localStream).toBeNull();
    expect(state.remoteStream).toBeNull();
    expect(state.annotations).toEqual([]);
    expect(state.remoteCursor).toBeNull();
    expect(state.modalOpen).toBe(false);
    expect(state.endedMessage).toBeNull();
  });

  it('should set and clear session', () => {
    const session: SessionDTO = {
      id: 'test-123',
      state: 'pending',
      userId: 'user-1',
      userEmail: 'test@example.com',
      createdAt: new Date().toISOString(),
      direction: 'user-to-admin',
      directionsUsed: [],
    };

    useLiveSupportStore.getState().setSession(session);
    expect(useLiveSupportStore.getState().session).toEqual(session);

    useLiveSupportStore.getState().setSession(null);
    expect(useLiveSupportStore.getState().session).toBeNull();
  });

  it('should set sessionId', () => {
    useLiveSupportStore.getState().setSessionId('abc-123');
    expect(useLiveSupportStore.getState().sessionId).toBe('abc-123');
  });

  it('should track peer connection state', () => {
    useLiveSupportStore.getState().setPeerConnected(true);
    expect(useLiveSupportStore.getState().peerConnected).toBe(true);

    useLiveSupportStore.getState().setPeerConnected(false);
    expect(useLiveSupportStore.getState().peerConnected).toBe(false);
  });

  it('should track WebSocket connection state', () => {
    useLiveSupportStore.getState().setWsConnected(true);
    expect(useLiveSupportStore.getState().wsConnected).toBe(true);
  });

  it('should manage annotations', () => {
    const annotation: AnnotationMsg = {
      type: 'annotation',
      tool: 'freehand',
      color: '#ff0000',
      points: [{ x: 0.1, y: 0.2 }, { x: 0.3, y: 0.4 }],
      id: 'ann-1',
    };

    useLiveSupportStore.getState().addAnnotation(annotation);
    const annotations = useLiveSupportStore.getState().annotations;
    expect(annotations).toHaveLength(1);
    expect(annotations[0].id).toBe('ann-1');
    expect(annotations[0].tool).toBe('freehand');
    expect(annotations[0].receivedAt).toBeGreaterThan(0);
  });

  it('should clear annotations', () => {
    const annotation: AnnotationMsg = {
      type: 'annotation',
      tool: 'arrow',
      color: '#00ff00',
      points: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
      id: 'ann-2',
    };

    useLiveSupportStore.getState().addAnnotation(annotation);
    expect(useLiveSupportStore.getState().annotations).toHaveLength(1);

    useLiveSupportStore.getState().clearAnnotations();
    expect(useLiveSupportStore.getState().annotations).toHaveLength(0);
    expect(useLiveSupportStore.getState().remoteCursor).toBeNull();
  });

  it('should prune expired annotations', () => {
    const store = useLiveSupportStore.getState();

    // Add an annotation with a fake old receivedAt
    store.addAnnotation({
      type: 'annotation',
      tool: 'freehand',
      color: '#ff0000',
      points: [{ x: 0, y: 0 }],
      id: 'old-ann',
    });

    // Manually set receivedAt to 10 seconds ago
    useLiveSupportStore.setState((s) => ({
      annotations: s.annotations.map((a) => ({
        ...a,
        receivedAt: Date.now() - 10000,
      })),
    }));

    // Add a fresh annotation
    useLiveSupportStore.getState().addAnnotation({
      type: 'annotation',
      tool: 'arrow',
      color: '#00ff00',
      points: [{ x: 0.5, y: 0.5 }],
      id: 'fresh-ann',
    });

    // Prune with 5000ms TTL
    useLiveSupportStore.getState().pruneAnnotations(Date.now(), 5000);
    const remaining = useLiveSupportStore.getState().annotations;
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe('fresh-ann');
  });

  it('should set remote cursor', () => {
    useLiveSupportStore.getState().setRemoteCursor({ x: 0.5, y: 0.7 });
    expect(useLiveSupportStore.getState().remoteCursor).toEqual({ x: 0.5, y: 0.7 });
  });

  it('should toggle modal open state', () => {
    useLiveSupportStore.getState().setModalOpen(true);
    expect(useLiveSupportStore.getState().modalOpen).toBe(true);

    useLiveSupportStore.getState().setModalOpen(false);
    expect(useLiveSupportStore.getState().modalOpen).toBe(false);
  });

  it('should set ended message', () => {
    useLiveSupportStore.getState().setEndedMessage('Session ended by admin');
    expect(useLiveSupportStore.getState().endedMessage).toBe('Session ended by admin');
  });

  it('should reset all state', () => {
    useLiveSupportStore.getState().setSessionId('test');
    useLiveSupportStore.getState().setPeerConnected(true);
    useLiveSupportStore.getState().setWsConnected(true);
    useLiveSupportStore.getState().setModalOpen(true);
    useLiveSupportStore.getState().setEndedMessage('ended');

    useLiveSupportStore.getState().reset();

    const state = useLiveSupportStore.getState();
    expect(state.sessionId).toBeNull();
    expect(state.peerConnected).toBe(false);
    expect(state.wsConnected).toBe(false);
    expect(state.modalOpen).toBe(false);
    expect(state.endedMessage).toBeNull();
  });
});

// ── Session DTO validation ────────────────────────────────────────────────────

describe('SessionDTO shape', () => {
  it('should accept valid session states', () => {
    const validStates = ['pending', 'awaiting-approval', 'active', 'ended', 'expired'];
    for (const state of validStates) {
      const session: SessionDTO = {
        id: 'test',
        state: state as any,
        userId: 'u1',
        userEmail: 'u@e.com',
        createdAt: new Date().toISOString(),
        direction: 'user-to-admin',
        directionsUsed: [],
      };
      expect(session.state).toBe(state);
    }
  });

  it('should accept valid directions', () => {
    const session: SessionDTO = {
      id: 'test',
      state: 'active',
      userId: 'u1',
      userEmail: 'u@e.com',
      createdAt: new Date().toISOString(),
      direction: 'admin-to-user',
      directionsUsed: ['user-to-admin', 'admin-to-user'],
    };
    expect(session.direction).toBe('admin-to-user');
    expect(session.directionsUsed).toHaveLength(2);
  });

  it('should accept optional fields', () => {
    const session: SessionDTO = {
      id: 'test',
      state: 'ended',
      userId: 'u1',
      userEmail: 'u@e.com',
      adminId: 'a1',
      adminEmail: 'admin@e.com',
      createdAt: new Date().toISOString(),
      approvedAt: new Date().toISOString(),
      endedAt: new Date().toISOString(),
      direction: 'user-to-admin',
      directionsUsed: ['user-to-admin'],
      endedBy: 'admin',
      endReason: 'Support complete',
    };
    expect(session.endedBy).toBe('admin');
    expect(session.endReason).toBe('Support complete');
  });
});
