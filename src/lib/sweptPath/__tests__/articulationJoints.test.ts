import { describe, it, expect } from 'vitest';

import { ArticulationJoint, ArticulationJointFactory } from '../articulationJoints';
import { Tractor, Trailer } from '../vehicleSegments';

describe('ArticulationJoint', () => {
  describe('constructor', () => {
    it('creates joint with correct type and max articulation', () => {
      const joint = new ArticulationJoint('fifth_wheel', 45);
      expect(joint.getJointType()).toBe('fifth_wheel');
      expect(joint.getMaxArticulation()).toBe(45);
      expect(joint.getCurrentAngle()).toBe(0);
    });
  });

  describe('updateArticulation', () => {
    it('sets angle to 0 when curvature is 0', () => {
      const joint = new ArticulationJoint('fifth_wheel', 45);
      joint.updateArticulation(0, 10);
      expect(joint.getArticulationRadians()).toBe(0);
      expect(joint.getCurrentAngle()).toBe(0);
    });

    it('calculates articulation from curvature and wheelbase', () => {
      const joint = new ArticulationJoint('fifth_wheel', 45);
      // curvature = 1/50 (turn radius 50m), wheelbase 10m
      joint.updateArticulation(1 / 50, 10);

      const expectedRad = Math.atan(10 / 50);
      expect(joint.getArticulationRadians()).toBeCloseTo(expectedRad);
    });

    it('constrains to max articulation', () => {
      const joint = new ArticulationJoint('fifth_wheel', 10);
      // Very tight turn that would exceed 10 degrees
      joint.updateArticulation(1 / 2, 10);

      const maxRad = (10 * Math.PI) / 180;
      expect(Math.abs(joint.getArticulationRadians())).toBeLessThanOrEqual(maxRad + 0.001);
    });

    it('applies steerable reduction', () => {
      const joint = new ArticulationJoint('fifth_wheel', 45);
      const curvature = 1 / 50;
      const wheelbase = 10;

      joint.updateArticulation(curvature, wheelbase, 0);
      const fullAngle = joint.getArticulationRadians();

      joint.updateArticulation(curvature, wheelbase, 0.5);
      const reducedAngle = joint.getArticulationRadians();

      expect(Math.abs(reducedAngle)).toBeCloseTo(Math.abs(fullAngle) * 0.5, 5);
    });

    it('handles negative curvature (left turn)', () => {
      const joint = new ArticulationJoint('fifth_wheel', 45);
      joint.updateArticulation(-1 / 50, 10);
      expect(joint.getArticulationRadians()).toBeLessThan(0);
    });
  });

  describe('constrainAngle', () => {
    it('passes through angle within limits', () => {
      const joint = new ArticulationJoint('fifth_wheel', 45);
      expect(joint.constrainAngle(30)).toBe(30);
      expect(joint.constrainAngle(-30)).toBe(-30);
    });

    it('constrains positive angle to max', () => {
      const joint = new ArticulationJoint('fifth_wheel', 45);
      expect(joint.constrainAngle(60)).toBe(45);
    });

    it('constrains negative angle to -max', () => {
      const joint = new ArticulationJoint('fifth_wheel', 45);
      expect(joint.constrainAngle(-60)).toBe(-45);
    });
  });

  describe('isWithinLimits', () => {
    it('returns true when angle is zero', () => {
      const joint = new ArticulationJoint('fifth_wheel', 45);
      expect(joint.isWithinLimits()).toBe(true);
    });

    it('returns true when angle is within limits', () => {
      const joint = new ArticulationJoint('fifth_wheel', 45);
      joint.updateArticulation(1 / 100, 5); // Small turn
      expect(joint.isWithinLimits()).toBe(true);
    });
  });

  describe('getCharacteristics', () => {
    it('returns correct characteristics for fifth_wheel', () => {
      const joint = new ArticulationJoint('fifth_wheel', 45);
      const chars = joint.getCharacteristics();
      expect(chars.type).toBe('fifth_wheel');
      expect(chars.maxArticulation).toBe(45);
      expect(chars.description).toContain('fifth wheel');
    });

    it('returns correct characteristics for turntable', () => {
      const joint = new ArticulationJoint('turntable', 90);
      const chars = joint.getCharacteristics();
      expect(chars.type).toBe('turntable');
      expect(chars.maxArticulation).toBe(90);
    });
  });

  describe('calculateOptimalAngle', () => {
    it('calculates optimal angle for a given turn', () => {
      const joint = new ArticulationJoint('fifth_wheel', 45);
      const angle = joint.calculateOptimalAngle(50, 20);
      expect(angle).toBeGreaterThan(0);
      expect(angle).toBeLessThanOrEqual(45);
    });

    it('constrains result to max articulation', () => {
      const joint = new ArticulationJoint('fifth_wheel', 10);
      // Very tight turn
      const angle = joint.calculateOptimalAngle(5, 30);
      expect(angle).toBeLessThanOrEqual(10);
    });
  });

  describe('calculateArticulationAngle (legacy)', () => {
    it('calculates angle between two segments', () => {
      const tractor = new Tractor(6, 2.5);
      tractor.setInput({ x: 0, y: 0 }, 0.1);
      tractor.updatePosition(null, null);

      const trailer = new Trailer(16, 2.6, 1.5, 3);
      // Trailer at heading 0 (straight behind)

      const joint = new ArticulationJoint('fifth_wheel', 45);
      const angle = joint.calculateArticulationAngle(tractor, trailer);
      // Tractor heading is 0.1 rad, trailer is 0, so diff is ~5.7 degrees
      expect(angle).toBeCloseTo((0.1 * 180) / Math.PI, 0);
    });
  });

  describe('getJointPosition', () => {
    it('returns position at rear of front segment', () => {
      const tractor = new Tractor(6, 2.5);
      tractor.setInput({ x: 0, y: 0 }, 0);
      tractor.updatePosition(null, null);

      const joint = new ArticulationJoint('fifth_wheel', 45);
      const pos = joint.getJointPosition(tractor);

      // Joint at rear of tractor (half length behind center)
      expect(pos.x).toBeCloseTo(-3);
      expect(pos.y).toBeCloseTo(0);
    });
  });
});

describe('ArticulationJointFactory', () => {
  it('creates fifth wheel with 45 degrees max', () => {
    const joint = ArticulationJointFactory.createFifthWheel();
    expect(joint.getJointType()).toBe('fifth_wheel');
    expect(joint.getMaxArticulation()).toBe(45);
  });

  it('creates king pin with 60 degrees max', () => {
    const joint = ArticulationJointFactory.createKingPin();
    expect(joint.getJointType()).toBe('king_pin');
    expect(joint.getMaxArticulation()).toBe(60);
  });

  it('creates pivot with 60 degrees max', () => {
    const joint = ArticulationJointFactory.createPivot();
    expect(joint.getJointType()).toBe('pivot');
    expect(joint.getMaxArticulation()).toBe(60);
  });

  it('creates turntable with 90 degrees max', () => {
    const joint = ArticulationJointFactory.createTurntable();
    expect(joint.getJointType()).toBe('turntable');
    expect(joint.getMaxArticulation()).toBe(90);
  });

  it('creates joint from type with custom max', () => {
    const joint = ArticulationJointFactory.createFromType('fifth_wheel', 30);
    expect(joint.getJointType()).toBe('fifth_wheel');
    expect(joint.getMaxArticulation()).toBe(30);
  });

  it('creates joint from type with default max', () => {
    const joint = ArticulationJointFactory.createFromType('turntable');
    expect(joint.getMaxArticulation()).toBe(90);
  });
});
