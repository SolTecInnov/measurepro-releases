import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.stubGlobal('localStorage', {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
});

import {
  generateMediaFilename,
  generatePOIMediaFilenames,
  parseMediaFilename,
  generateTimelapseFilename,
  createPOIManifestEntry,
  SURVEY_PART_CONSTANTS,
} from '../mediaNames';

describe('mediaNames', () => {
  beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(1700000000000);
  });

  describe('generateMediaFilename', () => {
    it('generates a filename with correct format', () => {
      const result = generateMediaFilename({
        surveyId: 'a1b2c3d4-e5f6-g7h8-i9j0-k1l2m3n4o5p6',
        poiId: 'e5f6g7h8-i9j0-k1l2-m3n4-o5p6q7r8s9t0',
        poiType: 'Bridge',
        partOrdinal: 1,
        mediaType: 'image',
      });

      expect(result).toBe('a1b2c3d4_p1_e5f6g7h8_bridge_1700000000000.jpg');
    });

    it('uses default extension for each media type', () => {
      const base = {
        surveyId: 'abcdefgh',
        poiId: '12345678',
      };

      expect(generateMediaFilename({ ...base, mediaType: 'image' })).toMatch(/\.jpg$/);
      expect(generateMediaFilename({ ...base, mediaType: 'video' })).toMatch(/\.webm$/);
      expect(generateMediaFilename({ ...base, mediaType: 'drawing' })).toMatch(/\.png$/);
      expect(generateMediaFilename({ ...base, mediaType: 'timelapse' })).toMatch(/\.mp4$/);
    });

    it('uses custom extension when provided', () => {
      const result = generateMediaFilename({
        surveyId: 'abcdefgh',
        poiId: '12345678',
        mediaType: 'image',
        extension: 'webp',
      });

      expect(result).toMatch(/\.webp$/);
    });

    it('adds index suffix when index > 0', () => {
      const result = generateMediaFilename({
        surveyId: 'abcdefgh',
        poiId: '12345678',
        mediaType: 'image',
        index: 3,
      });

      expect(result).toContain('_i3.');
    });

    it('does not add index suffix when index is 0', () => {
      const result = generateMediaFilename({
        surveyId: 'abcdefgh',
        poiId: '12345678',
        mediaType: 'image',
        index: 0,
      });

      expect(result).not.toContain('_i0');
    });

    it('defaults partOrdinal to 1', () => {
      const result = generateMediaFilename({
        surveyId: 'abcdefgh',
        poiId: '12345678',
        mediaType: 'image',
      });

      expect(result).toContain('_p1_');
    });

    it('sanitizes poiType removing special chars', () => {
      const result = generateMediaFilename({
        surveyId: 'abcdefgh',
        poiId: '12345678',
        poiType: 'Traffic Light #3!',
        mediaType: 'image',
      });

      expect(result).toContain('_trafficlight3_');
    });

    it('uses "poi" when poiType is null', () => {
      const result = generateMediaFilename({
        surveyId: 'abcdefgh',
        poiId: '12345678',
        poiType: null,
        mediaType: 'image',
      });

      expect(result).toContain('_poi_');
    });

    it('truncates poiType to 20 chars', () => {
      const result = generateMediaFilename({
        surveyId: 'abcdefgh',
        poiId: '12345678',
        poiType: 'a'.repeat(50),
        mediaType: 'image',
      });

      const parts = result.split('.')[0].split('_');
      const typePart = parts[3];
      expect(typePart.length).toBeLessThanOrEqual(20);
    });
  });

  describe('parseMediaFilename', () => {
    it('parses a valid filename', () => {
      const parsed = parseMediaFilename('a1b2c3d4_p1_e5f6g7h8_bridge_1700000000000.jpg');

      expect(parsed).toEqual({
        surveyIdShort: 'a1b2c3d4',
        partOrdinal: 1,
        poiIdShort: 'e5f6g7h8',
        poiType: 'bridge',
        timestamp: 1700000000000,
        index: undefined,
        extension: 'jpg',
      });
    });

    it('parses filename with index', () => {
      const parsed = parseMediaFilename('a1b2c3d4_p2_e5f6g7h8_bridge_1700000000000_i3.jpg');

      expect(parsed).not.toBeNull();
      expect(parsed!.index).toBe(3);
      expect(parsed!.partOrdinal).toBe(2);
    });

    it('returns null for filename without extension', () => {
      expect(parseMediaFilename('a1b2c3d4_p1_e5f6g7h8_bridge_1700000000000')).toBeNull();
    });

    it('returns null for filename with too few parts', () => {
      expect(parseMediaFilename('a1b2c3d4_p1.jpg')).toBeNull();
    });

    it('returns null for invalid part format', () => {
      expect(parseMediaFilename('a1b2c3d4_x1_e5f6g7h8_bridge_1700000000000.jpg')).toBeNull();
    });
  });

  describe('generateTimelapseFilename', () => {
    it('generates timelapse filename without segment', () => {
      const result = generateTimelapseFilename('a1b2c3d4-e5f6-g7h8', 1);
      expect(result).toBe('timelapse_a1b2c3d4_p1_1700000000000.mp4');
    });

    it('generates timelapse filename with segment', () => {
      const result = generateTimelapseFilename('a1b2c3d4-e5f6-g7h8', 2, 5);
      expect(result).toBe('timelapse_a1b2c3d4_p2_seg5_1700000000000.mp4');
    });
  });

  describe('generatePOIMediaFilenames', () => {
    const survey = { id: 'survey-1234-5678', partOrdinal: 1 } as any;

    it('returns null for media types without URLs', () => {
      const measurement = {
        id: 'poi-1234-5678',
        poi_type: 'bridge',
        imageUrl: null,
        videoUrl: null,
        drawingUrl: null,
        images: [],
      } as any;

      const result = generatePOIMediaFilenames(survey, measurement);

      expect(result.image).toBeNull();
      expect(result.video).toBeNull();
      expect(result.drawing).toBeNull();
      expect(result.images).toEqual([]);
    });

    it('generates filenames for present media', () => {
      const measurement = {
        id: 'poi-1234-5678',
        poi_type: 'bridge',
        imageUrl: 'data:image/jpeg;base64,...',
        videoUrl: 'blob:http://...',
        drawingUrl: 'data:image/png;base64,...',
        images: ['img1', 'img2'],
      } as any;

      const result = generatePOIMediaFilenames(survey, measurement);

      expect(result.image).toMatch(/\.jpg$/);
      expect(result.video).toMatch(/\.webm$/);
      expect(result.drawing).toMatch(/\.png$/);
      expect(result.images).toHaveLength(2);
    });
  });

  describe('createPOIManifestEntry', () => {
    it('creates a valid manifest entry', () => {
      const survey = { id: 'survey-1', partOrdinal: 2 } as any;
      const measurement = {
        id: 'poi-1',
        poi_type: 'tree',
        roadNumber: 1,
        poiNumber: 5,
        createdAt: '2024-01-01T00:00:00Z',
        latitude: 45.5,
        longitude: -73.5,
        altGPS: 100,
        rel: 5.5,
        widthMeasure: 3.2,
        lengthMeasure: null,
        imageUrl: null,
        videoUrl: null,
        drawingUrl: null,
        images: [],
      } as any;

      const entry = createPOIManifestEntry(survey, measurement);

      expect(entry.poiId).toBe('poi-1');
      expect(entry.surveyId).toBe('survey-1');
      expect(entry.partOrdinal).toBe(2);
      expect(entry.legacyRoadNumber).toBe(1);
      expect(entry.legacyPoiNumber).toBe(5);
      expect(entry.poiType).toBe('tree');
      expect(entry.coordinates).toEqual({ latitude: 45.5, longitude: -73.5, altitude: 100 });
      expect(entry.measurement).toEqual({ height: 5.5, width: 3.2, length: undefined });
    });
  });

  describe('SURVEY_PART_CONSTANTS', () => {
    it('has expected structure', () => {
      expect(SURVEY_PART_CONSTANTS.MAX_POI_PER_PART).toBe(250);
      expect(SURVEY_PART_CONSTANTS.WARNING_THRESHOLD).toBe(200);
      expect(SURVEY_PART_CONSTANTS.TIMELAPSE_FRAMES_PER_SEGMENT).toBe(250);
    });
  });
});
