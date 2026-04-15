import { describe, it, expect } from 'vitest';

import { exportToPLY, estimatePLYFileSize } from '../PLYExporter';
import type { PointCloudScan, PointCloudFrame } from '../../types';

function makeScan(overrides: Partial<PointCloudScan> = {}): PointCloudScan {
  return {
    id: 'scan-1',
    name: 'Test Scan',
    startTime: 1700000000000,
    totalFrames: 1,
    totalPoints: 2,
    bounds: {
      min: { x: -10, y: -10, z: -10 },
      max: { x: 10, y: 10, z: 10 },
    },
    gpsCenter: { lat: 45.5, lon: -73.5, alt: 100 },
    status: 'completed',
    storageSizeBytes: 1024,
    ...overrides,
  };
}

function makeFrame(overrides: Partial<PointCloudFrame> = {}): PointCloudFrame {
  return {
    id: 'frame-1',
    scanId: 'scan-1',
    timestamp: 1700000001000,
    points: new Float32Array([1.5, 2.5, 3.5, 4.5, 5.5, 6.5]),
    colors: new Uint8Array([255, 128, 0, 0, 128, 255]),
    gpsPosition: { lat: 45.5, lon: -73.5, alt: 100 },
    frameNumber: 0,
    pointCount: 2,
    ...overrides,
  };
}

describe('PLYExporter', () => {
  describe('exportToPLY', () => {
    it('throws when no frames provided', () => {
      expect(() => exportToPLY(makeScan(), [])).toThrow('No frames to export');
    });

    it('produces a Blob for ASCII format', () => {
      const blob = exportToPLY(makeScan(), [makeFrame()], { format: 'ascii' });
      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe('text/plain');
    });

    it('produces a Blob for binary format', () => {
      const blob = exportToPLY(makeScan(), [makeFrame()], { format: 'binary' });
      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe('application/octet-stream');
    });

    it('ASCII output contains PLY header', async () => {
      const blob = exportToPLY(makeScan(), [makeFrame()], { format: 'ascii' });
      const text = await blob.text();
      expect(text).toContain('ply');
      expect(text).toContain('format ascii 1.0');
      expect(text).toContain('element vertex 2');
      expect(text).toContain('property float x');
      expect(text).toContain('end_header');
    });

    it('ASCII output includes color properties when requested', async () => {
      const blob = exportToPLY(makeScan(), [makeFrame()], {
        format: 'ascii',
        includeColors: true,
      });
      const text = await blob.text();
      expect(text).toContain('property uchar red');
      expect(text).toContain('property uchar green');
      expect(text).toContain('property uchar blue');
    });

    it('ASCII output excludes color properties when not requested', async () => {
      const blob = exportToPLY(makeScan(), [makeFrame()], {
        format: 'ascii',
        includeColors: false,
      });
      const text = await blob.text();
      expect(text).not.toContain('property uchar red');
    });

    it('ASCII output includes normals when requested', async () => {
      const blob = exportToPLY(makeScan(), [makeFrame()], {
        format: 'ascii',
        includeNormals: true,
      });
      const text = await blob.text();
      expect(text).toContain('property float nx');
      expect(text).toContain('property float ny');
      expect(text).toContain('property float nz');
    });

    it('ASCII output includes point data', async () => {
      const blob = exportToPLY(makeScan(), [makeFrame()], {
        format: 'ascii',
        includeColors: true,
      });
      const text = await blob.text();
      // First point: 1.5, 2.5, 3.5, colors 255, 128, 0
      expect(text).toContain('1.500000 2.500000 3.500000 255 128 0');
    });

    it('ASCII uses default gray color when no colors available', async () => {
      const frame = makeFrame({ colors: undefined });
      const blob = exportToPLY(makeScan(), [frame], {
        format: 'ascii',
        includeColors: true,
      });
      const text = await blob.text();
      expect(text).toContain('128 128 128');
    });

    it('binary output contains PLY header', async () => {
      const blob = exportToPLY(makeScan(), [makeFrame()], { format: 'binary' });
      const text = await blob.text();
      expect(text).toContain('format binary_little_endian 1.0');
    });

    it('includes scan metadata in header comments', async () => {
      const blob = exportToPLY(makeScan({ name: 'My Scan' }), [makeFrame()], { format: 'ascii' });
      const text = await blob.text();
      expect(text).toContain('comment MeasurePRO 3D Scan: My Scan');
      expect(text).toContain('comment Scan ID: scan-1');
    });
  });

  describe('estimatePLYFileSize', () => {
    it('estimates ASCII size', () => {
      const size = estimatePLYFileSize(100, 'ascii', true, false);
      expect(size).toBe(500 + 100 * (40 + 12));
    });

    it('estimates ASCII size with normals', () => {
      const size = estimatePLYFileSize(100, 'ascii', false, true);
      expect(size).toBe(500 + 100 * (40 + 18));
    });

    it('estimates binary size', () => {
      const size = estimatePLYFileSize(100, 'binary', true, false);
      expect(size).toBe(500 + 100 * (12 + 3));
    });

    it('estimates binary size with normals', () => {
      const size = estimatePLYFileSize(100, 'binary', true, true);
      expect(size).toBe(500 + 100 * (12 + 3 + 12));
    });

    it('estimates binary size without colors or normals', () => {
      const size = estimatePLYFileSize(100, 'binary', false, false);
      expect(size).toBe(500 + 100 * 12);
    });
  });
});
