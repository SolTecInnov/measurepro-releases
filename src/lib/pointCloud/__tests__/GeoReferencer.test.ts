import { describe, it, expect, vi } from 'vitest';

vi.stubGlobal('navigator', {
  geolocation: {
    getCurrentPosition: vi.fn(),
  },
});

import {
  georeference,
  getCurrentGPSPosition,
  calculateGPSCenter,
  isValidGPSPosition,
} from '../GeoReferencer';
import type { GPSPosition, CameraOrientation } from '../types';

describe('GeoReferencer', () => {
  describe('georeference', () => {
    const gps: GPSPosition = { lat: 45.5, lon: -73.5, alt: 100 };
    const points = new Float32Array([1, 2, 3, 4, 5, 6]);

    it('returns original points when GPS is 0,0', () => {
      const result = georeference(points, { lat: 0, lon: 0, alt: 0 });
      expect(result).toEqual(points);
    });

    it('returns copy when no options applied', () => {
      const result = georeference(points, gps, undefined, {
        applyOrientation: false,
        transformToGlobal: false,
      });
      expect(result).toEqual(points);
      // Verify it's a copy
      expect(result).not.toBe(points);
    });

    it('applies rotation when orientation provided', () => {
      const orientation: CameraOrientation = { roll: 0, pitch: 0, yaw: 90 };
      const result = georeference(
        new Float32Array([1, 0, 0]),
        gps,
        orientation,
        { applyOrientation: true, transformToGlobal: false }
      );
      // 90 degree yaw rotation: x -> close to 0, y -> close to 1
      expect(result[0]).toBeCloseTo(0, 4);
      expect(result[1]).toBeCloseTo(1, 4);
      expect(result[2]).toBeCloseTo(0, 4);
    });

    it('transforms to global coordinates', () => {
      const result = georeference(
        new Float32Array([0, 0, 0]),
        gps,
        undefined,
        { applyOrientation: false, transformToGlobal: true }
      );
      // Point at origin should map to GPS position
      expect(result[0]).toBeCloseTo(-73.5, 3); // lon
      expect(result[1]).toBeCloseTo(45.5, 3);  // lat
      expect(result[2]).toBeCloseTo(100, 3);   // alt
    });

    it('offsets global coordinates for non-zero local points', () => {
      const result = georeference(
        new Float32Array([100, 0, 10]),
        gps,
        undefined,
        { applyOrientation: false, transformToGlobal: true }
      );
      // X offset should increase longitude
      expect(result[0]).toBeGreaterThan(-73.5);
      // Y offset 0, so latitude unchanged
      expect(result[1]).toBeCloseTo(45.5, 3);
      // Z offset should increase altitude
      expect(result[2]).toBeCloseTo(110, 3);
    });

    it('applies identity rotation for zero orientation', () => {
      const orientation: CameraOrientation = { roll: 0, pitch: 0, yaw: 0 };
      const result = georeference(
        new Float32Array([1, 2, 3]),
        gps,
        orientation,
        { applyOrientation: true, transformToGlobal: false }
      );
      expect(result[0]).toBeCloseTo(1);
      expect(result[1]).toBeCloseTo(2);
      expect(result[2]).toBeCloseTo(3);
    });
  });

  describe('getCurrentGPSPosition', () => {
    it('resolves with position data', async () => {
      vi.mocked(navigator.geolocation.getCurrentPosition).mockImplementation(
        (success) => {
          success({
            coords: {
              latitude: 45.5,
              longitude: -73.5,
              altitude: 100,
              accuracy: 5,
            },
            timestamp: 1700000000000,
          } as any);
        }
      );

      const pos = await getCurrentGPSPosition();
      expect(pos.lat).toBe(45.5);
      expect(pos.lon).toBe(-73.5);
      expect(pos.alt).toBe(100);
      expect(pos.accuracy).toBe(5);
      expect(pos.timestamp).toBe(1700000000000);
    });

    it('defaults altitude to 0 when null', async () => {
      vi.mocked(navigator.geolocation.getCurrentPosition).mockImplementation(
        (success) => {
          success({
            coords: { latitude: 45.5, longitude: -73.5, altitude: null, accuracy: 10 },
            timestamp: 0,
          } as any);
        }
      );

      const pos = await getCurrentGPSPosition();
      expect(pos.alt).toBe(0);
    });

    it('rejects when geolocation not supported', async () => {
      const orig = navigator.geolocation;
      Object.defineProperty(navigator, 'geolocation', { value: undefined, configurable: true });

      await expect(getCurrentGPSPosition()).rejects.toThrow('Geolocation not supported');

      Object.defineProperty(navigator, 'geolocation', { value: orig, configurable: true });
    });

    it('rejects on geolocation error', async () => {
      vi.mocked(navigator.geolocation.getCurrentPosition).mockImplementation(
        (_success, error) => {
          error!({ message: 'Position unavailable', code: 2 } as any);
        }
      );

      await expect(getCurrentGPSPosition()).rejects.toThrow('GPS error');
    });
  });

  describe('calculateGPSCenter', () => {
    it('returns zero for empty array', () => {
      const center = calculateGPSCenter([]);
      expect(center).toEqual({ lat: 0, lon: 0, alt: 0 });
    });

    it('returns the single position for one-element array', () => {
      const center = calculateGPSCenter([{ lat: 45, lon: -73, alt: 100 }]);
      expect(center).toEqual({ lat: 45, lon: -73, alt: 100 });
    });

    it('averages multiple positions', () => {
      const center = calculateGPSCenter([
        { lat: 44, lon: -72, alt: 100 },
        { lat: 46, lon: -74, alt: 200 },
      ]);
      expect(center.lat).toBeCloseTo(45);
      expect(center.lon).toBeCloseTo(-73);
      expect(center.alt).toBeCloseTo(150);
    });
  });

  describe('isValidGPSPosition', () => {
    it('returns true for valid position', () => {
      expect(isValidGPSPosition({ lat: 45.5, lon: -73.5, alt: 100 })).toBe(true);
    });

    it('returns false for out-of-range latitude', () => {
      expect(isValidGPSPosition({ lat: 91, lon: -73.5, alt: 100 })).toBe(false);
      expect(isValidGPSPosition({ lat: -91, lon: -73.5, alt: 100 })).toBe(false);
    });

    it('returns false for out-of-range longitude', () => {
      expect(isValidGPSPosition({ lat: 45, lon: 181, alt: 0 })).toBe(false);
      expect(isValidGPSPosition({ lat: 45, lon: -181, alt: 0 })).toBe(false);
    });

    it('returns false for NaN values', () => {
      expect(isValidGPSPosition({ lat: NaN, lon: -73, alt: 0 })).toBe(false);
      expect(isValidGPSPosition({ lat: 45, lon: NaN, alt: 0 })).toBe(false);
      expect(isValidGPSPosition({ lat: 45, lon: -73, alt: NaN })).toBe(false);
    });

    it('returns falsy for null/undefined', () => {
      expect(isValidGPSPosition(null as any)).toBeFalsy();
      expect(isValidGPSPosition(undefined as any)).toBeFalsy();
    });

    it('accepts boundary values', () => {
      expect(isValidGPSPosition({ lat: 90, lon: 180, alt: 0 })).toBe(true);
      expect(isValidGPSPosition({ lat: -90, lon: -180, alt: 0 })).toBe(true);
    });
  });
});
