import { describe, it, expect } from 'vitest';

import { haversine, clusterByHeight, partitionCorridors } from '../utils';

describe('overhead utils', () => {
  describe('haversine', () => {
    it('returns 0 for same point', () => {
      expect(haversine(45.5, -73.5, 45.5, -73.5)).toBe(0);
    });

    it('calculates distance between two known points', () => {
      // Montreal to Quebec City (~233 km)
      const dist = haversine(45.5017, -73.5673, 46.8139, -71.2080);
      expect(dist).toBeGreaterThan(230000);
      expect(dist).toBeLessThan(240000);
    });

    it('calculates short distance correctly', () => {
      // Approximately 111km for 1 degree of latitude at equator
      const dist = haversine(0, 0, 1, 0);
      expect(dist).toBeGreaterThan(110000);
      expect(dist).toBeLessThan(112000);
    });

    it('handles negative coordinates', () => {
      const dist = haversine(-33.8688, 151.2093, -37.8136, 144.9631);
      // Sydney to Melbourne (~714 km)
      expect(dist).toBeGreaterThan(700000);
      expect(dist).toBeLessThan(730000);
    });

    it('is symmetric', () => {
      const d1 = haversine(45.5, -73.5, 46.8, -71.2);
      const d2 = haversine(46.8, -71.2, 45.5, -73.5);
      expect(d1).toBeCloseTo(d2, 5);
    });
  });

  describe('clusterByHeight', () => {
    const makePoint = (d: number, s = 0) => ({
      s, d, t: 0, lat: 0, lon: 0,
    });

    it('returns empty array for empty input', () => {
      expect(clusterByHeight([], 1)).toEqual([]);
    });

    it('puts all points in one cluster when within minSep', () => {
      const points = [makePoint(1.0), makePoint(1.3), makePoint(1.5)];
      const clusters = clusterByHeight(points, 0.5);
      expect(clusters).toHaveLength(1);
      expect(clusters[0].points).toHaveLength(3);
    });

    it('splits into multiple clusters when gap exceeds minSep', () => {
      const points = [makePoint(1.0), makePoint(1.2), makePoint(5.0), makePoint(5.1)];
      const clusters = clusterByHeight(points, 0.5);
      expect(clusters).toHaveLength(2);
      expect(clusters[0].points).toHaveLength(2);
      expect(clusters[1].points).toHaveLength(2);
    });

    it('sorts by height (d) before clustering', () => {
      const points = [makePoint(5.0), makePoint(1.0), makePoint(1.2)];
      const clusters = clusterByHeight(points, 0.5);
      expect(clusters[0].minD).toBe(1.0);
      expect(clusters[1].minD).toBe(5.0);
    });

    it('sets minD to lowest point in cluster', () => {
      const points = [makePoint(2.0), makePoint(2.3), makePoint(2.1)];
      const clusters = clusterByHeight(points, 0.5);
      expect(clusters[0].minD).toBe(2.0);
    });

    it('handles single point', () => {
      const clusters = clusterByHeight([makePoint(3.0)], 0.5);
      expect(clusters).toHaveLength(1);
      expect(clusters[0].points).toHaveLength(1);
    });
  });

  describe('partitionCorridors', () => {
    const makePoint = (s: number, d = 0) => ({
      s, d, t: 0, lat: 0, lon: 0,
    });

    it('returns empty array for empty input', () => {
      expect(partitionCorridors([], 10)).toEqual([]);
    });

    it('puts all points in one corridor when within window', () => {
      const points = [makePoint(0), makePoint(5), makePoint(8)];
      const corridors = partitionCorridors(points, 10);
      expect(corridors).toHaveLength(1);
      expect(corridors[0]).toHaveLength(3);
    });

    it('splits into multiple corridors', () => {
      const points = [makePoint(0), makePoint(5), makePoint(20), makePoint(25)];
      const corridors = partitionCorridors(points, 10);
      expect(corridors).toHaveLength(2);
      expect(corridors[0]).toHaveLength(2);
      expect(corridors[1]).toHaveLength(2);
    });

    it('sorts by s before partitioning', () => {
      const points = [makePoint(20), makePoint(0), makePoint(5)];
      const corridors = partitionCorridors(points, 10);
      expect(corridors[0][0].s).toBe(0);
    });

    it('handles single point', () => {
      const corridors = partitionCorridors([makePoint(100)], 10);
      expect(corridors).toHaveLength(1);
      expect(corridors[0]).toHaveLength(1);
    });
  });
});
