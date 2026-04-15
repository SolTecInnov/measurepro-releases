import { describe, it, expect, vi, beforeEach } from 'vitest';

const clickFn = vi.fn();
const mockCreateElement = vi.fn();

vi.hoisted(() => {
  (globalThis as any).localStorage = {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  };

  // Patch URL static methods without replacing URL constructor
  if (typeof URL !== 'undefined') {
    if (!URL.createObjectURL) {
      (URL as any).createObjectURL = vi.fn(() => 'blob:mock');
    }
    if (!URL.revokeObjectURL) {
      (URL as any).revokeObjectURL = vi.fn();
    }
  }

  // Ensure document exists for module loading
  if (typeof globalThis.document === 'undefined') {
    (globalThis as any).document = {
      addEventListener: vi.fn(),
      createElement: vi.fn(() => ({
        href: '', download: '', click: vi.fn(),
        style: {}, setAttribute: vi.fn(), appendChild: vi.fn(),
        parentNode: { removeChild: vi.fn() },
      })),
      body: { appendChild: vi.fn() },
      referrer: '',
    };
  }
});

import { exportProfile } from '../ProfileExport';

const samplePoints = [
  {
    distance_m: 0,
    latitude: 45.5,
    longitude: -73.5,
    altitude: 100.123,
    timestamp: '2024-01-01T12:00:00Z',
    grade_pct: 2.5,
    k_factor: null,
    curvature_type: null as any,
  },
  {
    distance_m: 50,
    latitude: 45.501,
    longitude: -73.499,
    altitude: 101.456,
    timestamp: '2024-01-01T12:00:30Z',
    grade_pct: -1.2,
    k_factor: 100,
    curvature_type: 'convex' as const,
  },
  {
    distance_m: 100,
    latitude: 45.502,
    longitude: -73.498,
    altitude: 100.789,
    timestamp: '2024-01-01T12:01:00Z',
    grade_pct: 0.5,
    k_factor: null,
    curvature_type: null as any,
  },
];

describe('ProfileExport', () => {
  let downloadedFilename = '';
  let blobParts: any[] = [];

  beforeEach(() => {
    vi.clearAllMocks();
    downloadedFilename = '';
    blobParts = [];

    // Ensure URL statics exist
    (URL as any).createObjectURL = vi.fn(() => 'blob:mock');
    (URL as any).revokeObjectURL = vi.fn();

    // Intercept document.createElement to capture download
    const realCreateElement = document.createElement;
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'a') {
        const el = {
          href: '',
          download: '',
          click: vi.fn(function (this: any) {
            downloadedFilename = this.download;
          }),
        };
        return el as any;
      }
      try {
        return realCreateElement.call(document, tag);
      } catch {
        return { style: {}, setAttribute: vi.fn(), appendChild: vi.fn() } as any;
      }
    });

    // Intercept Blob to capture content — use a Proxy to avoid infinite recursion
    const OrigBlob = globalThis.Blob;
    globalThis.Blob = new Proxy(OrigBlob, {
      construct(target, args) {
        if (args[0]) blobParts = args[0];
        return Reflect.construct(target, args);
      },
    });
  });

  function getBlobContent(): string {
    return typeof blobParts[0] === 'string' ? blobParts[0] : '';
  }

  it('does nothing for less than 2 points', async () => {
    await exportProfile([samplePoints[0]], 'gpx', true);
    expect(downloadedFilename).toBe('');
  });

  it('exports GPX format with grade', async () => {
    await exportProfile(samplePoints, 'gpx', true, 'Test Profile');
    const content = getBlobContent();
    expect(content).toContain('<?xml');
    expect(content).toContain('<gpx');
    expect(content).toContain('lat="45.5"');
    expect(content).toContain('<ele>100.123</ele>');
    expect(content).toContain('<grade>');
    expect(downloadedFilename).toMatch(/test-profile.*\.gpx$/);
  });

  it('exports GPX without grade', async () => {
    await exportProfile(samplePoints, 'gpx', false);
    expect(getBlobContent()).not.toContain('<grade>');
  });

  it('exports KML format with grade description', async () => {
    await exportProfile(samplePoints, 'kml', true, 'Road Test');
    const content = getBlobContent();
    expect(content).toContain('<kml');
    expect(content).toContain('<coordinates>');
    expect(content).toContain('-73.5,45.5,100.123');
    expect(content).toContain('Max grade:');
    expect(downloadedFilename).toMatch(/road-test.*\.kml$/);
  });

  it('exports KML without grade description', async () => {
    await exportProfile(samplePoints, 'kml', false);
    expect(getBlobContent()).not.toContain('Max grade:');
  });

  it('exports GeoJSON format with grade', async () => {
    await exportProfile(samplePoints, 'json', true, 'Profile');
    const parsed = JSON.parse(getBlobContent());
    expect(parsed.type).toBe('FeatureCollection');
    expect(parsed.features).toHaveLength(1);
    expect(parsed.features[0].geometry.type).toBe('LineString');
    expect(parsed.features[0].geometry.coordinates).toHaveLength(3);
    expect(parsed.features[0].properties.maxGrade).toBeDefined();
    expect(parsed.features[0].properties.points).toHaveLength(3);
    expect(downloadedFilename).toMatch(/profile.*\.geojson$/);
  });

  it('exports GeoJSON without grade data', async () => {
    await exportProfile(samplePoints, 'json', false);
    const parsed = JSON.parse(getBlobContent());
    expect(parsed.features[0].properties.maxGrade).toBeUndefined();
    expect(parsed.features[0].properties.points).toBeUndefined();
  });

  it('sanitizes label for filename', async () => {
    await exportProfile(samplePoints, 'gpx', false, 'My Road/Profile #1');
    expect(downloadedFilename).toMatch(/my-road-profile--1/);
  });

  it('exports KMZ format', async () => {
    await exportProfile(samplePoints, 'kmz', false, 'test-kmz');
    // KMZ either succeeds (jszip available) producing a binary blob, or falls back to KML
    // Either way a download should have happened
    expect(downloadedFilename).toMatch(/test-kmz/);
  });
});
