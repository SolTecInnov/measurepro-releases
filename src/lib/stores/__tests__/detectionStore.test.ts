import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Stub window global before imports — use getter so fake timers work
vi.stubGlobal('window', new Proxy(globalThis, {
  get(target, prop) {
    if (prop === 'setTimeout') return globalThis.setTimeout;
    if (prop === 'clearTimeout') return globalThis.clearTimeout;
    if (prop === 'dispatchEvent') return () => {};
    return (target as any)[prop];
  },
  set(target, prop, value) {
    (target as any)[prop] = value;
    return true;
  },
}));

import { useDetectionStore } from '../detectionStore';
import type { Detection } from '../../mockDetection';

function makeDetection(id: string, objectClass = 'sign'): Detection {
  return {
    id,
    objectClass,
    confidence: 0.95,
    boundingBox: { x: 0.1, y: 0.2, width: 0.3, height: 0.4 },
    timestamp: Date.now(),
  };
}

describe('useDetectionStore', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useDetectionStore.setState({
      activeDetections: [],
      detectionLog: [],
      pendingDetection: null,
      pendingTimeout: null,
      expirationTimeouts: new Map(),
    });
  });

  afterEach(() => {
    // Clear any remaining timeouts
    useDetectionStore.getState().clearActiveDetections();
    vi.useRealTimers();
  });

  it('has correct defaults', () => {
    const state = useDetectionStore.getState();
    expect(state.activeDetections).toEqual([]);
    expect(state.detectionLog).toEqual([]);
    expect(state.pendingDetection).toBeNull();
    expect(state.pendingTimeout).toBeNull();
  });

  describe('addDetection', () => {
    it('adds to activeDetections and detectionLog', () => {
      const det = makeDetection('d1');
      useDetectionStore.getState().addDetection(det);
      const state = useDetectionStore.getState();
      expect(state.activeDetections).toHaveLength(1);
      expect(state.activeDetections[0].id).toBe('d1');
      expect(state.detectionLog).toHaveLength(1);
      expect(state.detectionLog[0].status).toBe('pending');
    });

    it('auto-expires after 3 seconds', () => {
      const det = makeDetection('d1');
      useDetectionStore.getState().addDetection(det);
      expect(useDetectionStore.getState().activeDetections).toHaveLength(1);

      vi.advanceTimersByTime(3000);
      expect(useDetectionStore.getState().activeDetections).toHaveLength(0);
    });

    it('keeps log entry after auto-expiration', () => {
      const det = makeDetection('d1');
      useDetectionStore.getState().addDetection(det);
      vi.advanceTimersByTime(3000);
      expect(useDetectionStore.getState().detectionLog).toHaveLength(1);
    });
  });

  describe('removeDetection', () => {
    it('removes from activeDetections', () => {
      const det = makeDetection('d1');
      useDetectionStore.getState().addDetection(det);
      useDetectionStore.getState().removeDetection('d1');
      expect(useDetectionStore.getState().activeDetections).toHaveLength(0);
    });

    it('clears expiration timeout', () => {
      const det = makeDetection('d1');
      useDetectionStore.getState().addDetection(det);
      useDetectionStore.getState().removeDetection('d1');
      // Advancing time should not cause issues
      vi.advanceTimersByTime(5000);
      expect(useDetectionStore.getState().activeDetections).toHaveLength(0);
    });
  });

  describe('clearActiveDetections', () => {
    it('removes all active detections', () => {
      useDetectionStore.getState().addDetection(makeDetection('d1'));
      useDetectionStore.getState().addDetection(makeDetection('d2'));
      useDetectionStore.getState().clearActiveDetections();
      expect(useDetectionStore.getState().activeDetections).toHaveLength(0);
    });
  });

  describe('acceptDetection', () => {
    it('updates log entry status to accepted and removes from active', () => {
      const det = makeDetection('d1');
      useDetectionStore.getState().addDetection(det);
      useDetectionStore.getState().acceptDetection('d1');
      const entry = useDetectionStore.getState().detectionLog[0];
      expect(entry.status).toBe('accepted');
      expect(useDetectionStore.getState().activeDetections).toHaveLength(0);
    });
  });

  describe('rejectDetection', () => {
    it('updates log entry status to rejected and removes from active', () => {
      const det = makeDetection('d1');
      useDetectionStore.getState().addDetection(det);
      useDetectionStore.getState().rejectDetection('d1');
      const entry = useDetectionStore.getState().detectionLog[0];
      expect(entry.status).toBe('rejected');
      expect(useDetectionStore.getState().activeDetections).toHaveLength(0);
    });
  });

  describe('correctDetection', () => {
    it('updates log entry with corrected class', () => {
      const det = makeDetection('d1', 'sign');
      useDetectionStore.getState().addDetection(det);
      useDetectionStore.getState().correctDetection('d1', 'pole');
      const entry = useDetectionStore.getState().detectionLog[0];
      expect(entry.status).toBe('corrected');
      expect(entry.correctedClass).toBe('pole');
      expect(useDetectionStore.getState().activeDetections).toHaveLength(0);
    });
  });

  describe('setPendingDetection / clearPendingDetection', () => {
    it('sets pending detection', () => {
      const det = makeDetection('d1');
      useDetectionStore.getState().setPendingDetection(det);
      expect(useDetectionStore.getState().pendingDetection).toEqual(det);
    });

    it('clears pending detection', () => {
      const det = makeDetection('d1');
      useDetectionStore.getState().setPendingDetection(det);
      useDetectionStore.getState().clearPendingDetection();
      expect(useDetectionStore.getState().pendingDetection).toBeNull();
    });
  });

  describe('query methods', () => {
    beforeEach(() => {
      useDetectionStore.getState().addDetection(makeDetection('d1', 'sign'));
      useDetectionStore.getState().addDetection(makeDetection('d2', 'pole'));
      useDetectionStore.getState().addDetection(makeDetection('d3', 'sign'));
      useDetectionStore.getState().acceptDetection('d1');
      useDetectionStore.getState().correctDetection('d3', 'wire');
    });

    it('getDetectionById returns the correct entry', () => {
      const entry = useDetectionStore.getState().getDetectionById('d1');
      expect(entry).toBeDefined();
      expect(entry!.id).toBe('d1');
    });

    it('getDetectionById returns undefined for unknown id', () => {
      expect(useDetectionStore.getState().getDetectionById('xxx')).toBeUndefined();
    });

    it('getDetectionsByClass filters by class', () => {
      const signs = useDetectionStore.getState().getDetectionsByClass('sign');
      expect(signs).toHaveLength(2);
    });

    it('getAcceptedDetections returns accepted entries', () => {
      const accepted = useDetectionStore.getState().getAcceptedDetections();
      expect(accepted).toHaveLength(1);
      expect(accepted[0].id).toBe('d1');
    });

    it('getCorrectedDetections returns corrected entries', () => {
      const corrected = useDetectionStore.getState().getCorrectedDetections();
      expect(corrected).toHaveLength(1);
      expect(corrected[0].correctedClass).toBe('wire');
    });
  });
});
