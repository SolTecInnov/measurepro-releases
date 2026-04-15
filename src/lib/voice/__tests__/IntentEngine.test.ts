import { describe, it, expect, beforeEach } from 'vitest';

import { IntentEngine } from '../IntentEngine';

describe('IntentEngine', () => {
  let engine: IntentEngine;

  beforeEach(() => {
    engine = new IntentEngine();
  });

  describe('recognizeIntent - English', () => {
    it('returns exact match with confidence 1.0', () => {
      const match = engine.recognizeIntent('last measurement', 'en-US');
      expect(match.intent).toBe('last_measurement');
      expect(match.confidence).toBe(1.0);
      expect(match.language).toBe('en-US');
    });

    it('matches case-insensitively', () => {
      const match = engine.recognizeIntent('Last Measurement', 'en-US');
      expect(match.intent).toBe('last_measurement');
      expect(match.confidence).toBe(1.0);
    });

    it('matches GPS location', () => {
      const match = engine.recognizeIntent('gps location', 'en-US');
      expect(match.intent).toBe('gps_location');
      expect(match.confidence).toBe(1.0);
    });

    it('matches substring with 0.9 confidence', () => {
      const match = engine.recognizeIntent('what was the last measurement please', 'en-US');
      // "what was the last measurement" is a pattern, so contains match
      expect(match.confidence).toBeGreaterThanOrEqual(0.9);
    });

    it('matches POI types', () => {
      const match = engine.recognizeIntent('bridge', 'en-US');
      expect(match.intent).toBe('poi_bridge');
      expect(match.confidence).toBe(1.0);
    });

    it('matches tunnel', () => {
      const match = engine.recognizeIntent('tunnel', 'en-US');
      expect(match.intent).toBe('poi_tunnel');
      expect(match.confidence).toBe(1.0);
    });

    it('returns unknown for gibberish', () => {
      const match = engine.recognizeIntent('xyzzy blargfoo', 'en-US');
      expect(match.intent).toBe('unknown');
      expect(match.confidence).toBeLessThan(0.6);
    });

    it('matches identity command', () => {
      const match = engine.recognizeIntent('who are you', 'en-US');
      expect(match.intent).toBe('identity');
    });

    it('matches volume up', () => {
      const match = engine.recognizeIntent('volume up', 'en-US');
      expect(match.intent).toBe('volume_up');
      expect(match.confidence).toBe(1.0);
    });

    it('matches clear warnings', () => {
      const match = engine.recognizeIntent('clear warnings', 'en-US');
      expect(match.intent).toBe('clear_warnings');
      expect(match.confidence).toBe(1.0);
    });

    it('matches start logging', () => {
      const match = engine.recognizeIntent('start logging', 'en-US');
      expect(match.intent).toBe('start_logging');
      expect(match.confidence).toBe(1.0);
    });
  });

  describe('recognizeIntent - French', () => {
    it('matches French exact phrases', () => {
      const match = engine.recognizeIntent('position gps', 'fr-FR');
      expect(match.intent).toBe('gps_location');
      expect(match.confidence).toBe(1.0);
    });

    it('matches French POI types', () => {
      const match = engine.recognizeIntent('pont', 'fr-FR');
      expect(match.intent).toBe('poi_bridge');
      expect(match.confidence).toBe(1.0);
    });

    it('matches French identity', () => {
      const match = engine.recognizeIntent('qui es-tu', 'fr-FR');
      expect(match.intent).toBe('identity');
    });
  });

  describe('recognizeIntent - Spanish', () => {
    it('matches Spanish exact phrases', () => {
      const match = engine.recognizeIntent('velocidad', 'es-ES');
      expect(match.intent).toBe('speed');
      expect(match.confidence).toBe(1.0);
    });

    it('matches Spanish POI types', () => {
      const match = engine.recognizeIntent('puente', 'es-ES');
      expect(match.intent).toBe('poi_bridge');
      expect(match.confidence).toBe(1.0);
    });
  });

  describe('fuzzy matching', () => {
    it('matches near-miss typos via similarity', () => {
      // "brdge" is close to "bridge"
      const match = engine.recognizeIntent('brdge', 'en-US');
      expect(match.confidence).toBeGreaterThanOrEqual(0.6);
    });

    it('does not match very dissimilar text', () => {
      const match = engine.recognizeIntent('zzzzzzzzzzz', 'en-US');
      expect(match.intent).toBe('unknown');
    });
  });

  describe('confidence threshold', () => {
    it('defaults to 0.6', () => {
      expect(engine.getConfidenceThreshold()).toBe(0.6);
    });

    it('can be changed', () => {
      engine.setConfidenceThreshold(0.8);
      expect(engine.getConfidenceThreshold()).toBe(0.8);
    });

    it('clamps to 0..1 range', () => {
      engine.setConfidenceThreshold(1.5);
      expect(engine.getConfidenceThreshold()).toBe(1);
      engine.setConfidenceThreshold(-0.5);
      expect(engine.getConfidenceThreshold()).toBe(0);
    });
  });

  describe('originalText preservation', () => {
    it('preserves the original text in the result', () => {
      const match = engine.recognizeIntent('Last Measurement', 'en-US');
      expect(match.originalText).toBe('Last Measurement');
    });
  });
});
