import { describe, it, expect, vi, beforeEach } from 'vitest';

// Stub globals before any vi.mock
vi.hoisted(() => {
  const localStorageMap = new Map<string, string>();
  (globalThis as any).localStorage = {
    getItem: (key: string) => localStorageMap.get(key) ?? null,
    setItem: (key: string, value: string) => localStorageMap.set(key, value),
    removeItem: (key: string) => localStorageMap.delete(key),
    clear: () => localStorageMap.clear(),
  };
  (globalThis as any).Audio = class MockAudio {
    src = ''; preload = 'auto'; volume = 1;
    play = vi.fn(() => Promise.resolve());
    pause = vi.fn(); remove = vi.fn(); addEventListener = vi.fn();
  };
  (globalThis as any).AudioContext = vi.fn(() => ({
    state: 'running', resume: vi.fn(() => Promise.resolve()),
    createBuffer: vi.fn(() => ({})),
    createBufferSource: vi.fn(() => ({ buffer: null, connect: vi.fn(), start: vi.fn() })),
    destination: {},
  }));
  if (typeof globalThis.document === 'undefined') {
    (globalThis as any).document = { addEventListener: vi.fn(), createElement: vi.fn(() => ({})), body: { appendChild: vi.fn() } };
  }
});

vi.mock('@/lib/sounds', () => ({
  soundManager: {
    playWarning: vi.fn(),
    playCritical: vi.fn(),
    playEmergency: vi.fn(),
  },
}));

import { dryRunDetector } from '../detector';
import type { Point3D } from '@/lib/lidar/types';
import type { BoundingBox3D, DetectionZone, SimpleThreshold } from '../types';

describe('DryRunDetector', () => {
  describe('isPointInBox', () => {
    const box: BoundingBox3D = { xMin: -10, xMax: 10, yMin: -5, yMax: 5, zMin: 0, zMax: 3 };

    it('returns true for point inside box', () => {
      expect(dryRunDetector.isPointInBox({ x: 0, y: 0, z: 1 }, box)).toBe(true);
    });

    it('returns false for point outside x range', () => {
      expect(dryRunDetector.isPointInBox({ x: 15, y: 0, z: 1 }, box)).toBe(false);
    });

    it('returns false for point outside y range', () => {
      expect(dryRunDetector.isPointInBox({ x: 0, y: 10, z: 1 }, box)).toBe(false);
    });

    it('returns false for point outside z range', () => {
      expect(dryRunDetector.isPointInBox({ x: 0, y: 0, z: 5 }, box)).toBe(false);
    });

    it('returns true for point at boundary', () => {
      expect(dryRunDetector.isPointInBox({ x: 10, y: 5, z: 3 }, box)).toBe(true);
    });

    it('respects ignoreAboveHeight from zone', () => {
      const zone = { ignoreAboveHeight: 2 } as DetectionZone;
      expect(dryRunDetector.isPointInBox({ x: 0, y: 0, z: 2.5 }, box, zone)).toBe(false);
      expect(dryRunDetector.isPointInBox({ x: 0, y: 0, z: 1.5 }, box, zone)).toBe(true);
    });

    it('respects ignoreBelowHeight from zone', () => {
      const zone = { ignoreBelowHeight: 1 } as DetectionZone;
      expect(dryRunDetector.isPointInBox({ x: 0, y: 0, z: 0.5 }, box, zone)).toBe(false);
      expect(dryRunDetector.isPointInBox({ x: 0, y: 0, z: 1.5 }, box, zone)).toBe(true);
    });
  });

  describe('isPointInSimpleThreshold', () => {
    it('detects left side points (negative y)', () => {
      const threshold: SimpleThreshold = { side: 'left', enabled: true, distanceMeters: 5 };
      expect(dryRunDetector.isPointInSimpleThreshold({ x: 0, y: -3, z: 1 }, threshold)).toBe(true);
      expect(dryRunDetector.isPointInSimpleThreshold({ x: 0, y: 3, z: 1 }, threshold)).toBe(false);
    });

    it('detects right side points (positive y)', () => {
      const threshold: SimpleThreshold = { side: 'right', enabled: true, distanceMeters: 5 };
      expect(dryRunDetector.isPointInSimpleThreshold({ x: 0, y: 3, z: 1 }, threshold)).toBe(true);
      expect(dryRunDetector.isPointInSimpleThreshold({ x: 0, y: -3, z: 1 }, threshold)).toBe(false);
    });

    it('detects rear points (negative x)', () => {
      const threshold: SimpleThreshold = { side: 'rear', enabled: true, distanceMeters: 10 };
      expect(dryRunDetector.isPointInSimpleThreshold({ x: -5, y: 0, z: 1 }, threshold)).toBe(true);
      expect(dryRunDetector.isPointInSimpleThreshold({ x: 5, y: 0, z: 1 }, threshold)).toBe(false);
    });

    it('rejects points beyond distance threshold', () => {
      const threshold: SimpleThreshold = { side: 'left', enabled: true, distanceMeters: 3 };
      expect(dryRunDetector.isPointInSimpleThreshold({ x: 0, y: -5, z: 1 }, threshold)).toBe(false);
    });

    it('respects minHeight and maxHeight', () => {
      const threshold: SimpleThreshold = { side: 'left', enabled: true, distanceMeters: 5, minHeight: 1, maxHeight: 3 };
      expect(dryRunDetector.isPointInSimpleThreshold({ x: 0, y: -3, z: 0.5 }, threshold)).toBe(false);
      expect(dryRunDetector.isPointInSimpleThreshold({ x: 0, y: -3, z: 2 }, threshold)).toBe(true);
      expect(dryRunDetector.isPointInSimpleThreshold({ x: 0, y: -3, z: 4 }, threshold)).toBe(false);
    });

    it('returns false for y=0 on left/right', () => {
      const left: SimpleThreshold = { side: 'left', enabled: true, distanceMeters: 5 };
      const right: SimpleThreshold = { side: 'right', enabled: true, distanceMeters: 5 };
      expect(dryRunDetector.isPointInSimpleThreshold({ x: 0, y: 0, z: 1 }, left)).toBe(false);
      expect(dryRunDetector.isPointInSimpleThreshold({ x: 0, y: 0, z: 1 }, right)).toBe(false);
    });
  });

  describe('onDetection callback', () => {
    it('registers and unregisters callbacks', () => {
      const cb = vi.fn();
      const unsubscribe = dryRunDetector.onDetection(cb);
      expect(typeof unsubscribe).toBe('function');
      unsubscribe();
      // No error thrown means success
    });
  });

  describe('reset', () => {
    it('clears last alert times without errors', () => {
      expect(() => dryRunDetector.reset()).not.toThrow();
    });
  });
});
