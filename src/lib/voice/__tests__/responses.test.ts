import { describe, it, expect } from 'vitest';

import { getResponse, responses } from '../responses';

describe('responses', () => {
  describe('getResponse', () => {
    it('returns string responses as-is', () => {
      expect(getResponse('en-US', 'clear_warnings')).toBe('Warnings cleared');
      expect(getResponse('fr-FR', 'clear_warnings')).toBe('Avertissements effac\u00e9s');
      expect(getResponse('es-ES', 'clear_warnings')).toBe('Advertencias borradas');
    });

    it('calls function responses with args', () => {
      const result = getResponse('en-US', 'last_measurement', '4.25m');
      expect(result).toBe('Last measurement: 4.25m');
    });

    it('formats GPS location with coordinates', () => {
      const result = getResponse('en-US', 'gps_location', 45.123456, -73.654321);
      expect(result).toContain('45.123456');
      expect(result).toContain('-73.654321');
    });

    it('formats speed with unit', () => {
      const result = getResponse('en-US', 'speed', 65.3, 'km/h');
      expect(result).toContain('65.3');
      expect(result).toContain('km/h');
    });

    it('formats volume up percentage', () => {
      const result = getResponse('en-US', 'volume_up', 0.9);
      expect(result).toContain('90');
    });

    it('formats volume down percentage', () => {
      const result = getResponse('en-US', 'volume_down', 0.5);
      expect(result).toContain('50');
    });

    it('formats fix quality', () => {
      const result = getResponse('en-US', 'fix_quality', 'RTK', 12);
      expect(result).toContain('RTK');
      expect(result).toContain('12');
    });

    it('formats GPS status connected', () => {
      const result = getResponse('en-US', 'gps_status', true, 'RTK');
      expect(result).toContain('connected');
      expect(result).toContain('RTK');
    });

    it('formats GPS status disconnected', () => {
      const result = getResponse('en-US', 'gps_status', false, 'None');
      expect(result).toContain('disconnected');
    });

    it('returns identity response', () => {
      expect(getResponse('en-US', 'identity')).toContain('Max Load');
      expect(getResponse('fr-FR', 'identity')).toContain('Max Load');
      expect(getResponse('es-ES', 'identity')).toContain('Max Load');
    });
  });

  describe('responses object', () => {
    it('has all three language keys', () => {
      expect(responses).toHaveProperty('en-US');
      expect(responses).toHaveProperty('fr-FR');
      expect(responses).toHaveProperty('es-ES');
    });

    it('all languages have the same keys', () => {
      const enKeys = Object.keys(responses['en-US']).sort();
      const frKeys = Object.keys(responses['fr-FR']).sort();
      const esKeys = Object.keys(responses['es-ES']).sort();
      expect(enKeys).toEqual(frKeys);
      expect(enKeys).toEqual(esKeys);
    });

    it('POI responses exist for all types', () => {
      const poiKeys = Object.keys(responses['en-US']).filter(k => k.startsWith('poi_'));
      expect(poiKeys.length).toBeGreaterThan(30);
      for (const key of poiKeys) {
        expect(typeof (responses['en-US'] as any)[key]).toBe('string');
        expect(typeof (responses['fr-FR'] as any)[key]).toBe('string');
        expect(typeof (responses['es-ES'] as any)[key]).toBe('string');
      }
    });
  });

  describe('French responses', () => {
    it('returns French last measurement', () => {
      const result = getResponse('fr-FR', 'last_measurement', '3.50m');
      expect(result).toContain('Derni\u00e8re mesure');
      expect(result).toContain('3.50m');
    });

    it('returns French GPS location', () => {
      const result = getResponse('fr-FR', 'gps_location', 48.8566, 2.3522);
      expect(result).toContain('Position GPS');
    });
  });

  describe('Spanish responses', () => {
    it('returns Spanish last measurement', () => {
      const result = getResponse('es-ES', 'last_measurement', '2.80m');
      expect(result).toContain('\u00daltima medici\u00f3n');
      expect(result).toContain('2.80m');
    });
  });
});
