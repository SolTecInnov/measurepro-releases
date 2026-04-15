import { describe, it, expect } from 'vitest';

import { Tractor, Trailer, JeepDolly, SteerableDolly, Cargo } from '../vehicleSegments';
import { ArticulationJoint } from '../articulationJoints';

describe('VehicleSegments', () => {
  describe('Tractor', () => {
    it('creates with correct dimensions', () => {
      const tractor = new Tractor(6, 2.5, 2, 0.5);
      expect(tractor.getLength()).toBe(6);
      expect(tractor.getWidth()).toBe(2.5);
      expect(tractor.getAxleCount()).toBe(2);
      expect(tractor.getPowerAxles()).toBe(2);
    });

    it('starts at origin with heading 0', () => {
      const tractor = new Tractor(6, 2.5);
      const pos = tractor.getPosition();
      expect(pos.x).toBe(0);
      expect(pos.y).toBe(0);
      expect(tractor.getHeading()).toBe(0);
    });

    it('updates position from setInput', () => {
      const tractor = new Tractor(6, 2.5);
      tractor.setInput({ x: 10, y: 20 }, Math.PI / 4);
      tractor.updatePosition(null, null);

      const pos = tractor.getPosition();
      expect(pos.x).toBe(10);
      expect(pos.y).toBe(20);
      expect(tractor.getHeading()).toBe(Math.PI / 4);
    });

    it('calculates front position correctly', () => {
      const tractor = new Tractor(6, 2.5);
      tractor.setInput({ x: 0, y: 0 }, 0);
      tractor.updatePosition(null, null);

      const front = tractor.getFrontPosition();
      expect(front.x).toBeCloseTo(3); // half length
      expect(front.y).toBeCloseTo(0);
    });

    it('calculates fifth wheel position correctly', () => {
      const tractor = new Tractor(6, 2.5, 2, 0.5);
      tractor.setInput({ x: 0, y: 0 }, 0);
      tractor.updatePosition(null, null);

      const fifthWheel = tractor.getFifthWheelPosition();
      // rearDist = 6/2 - 0.5 = 2.5
      expect(fifthWheel.x).toBeCloseTo(-2.5);
      expect(fifthWheel.y).toBeCloseTo(0);
    });

    it('returns 4 corner envelope', () => {
      const tractor = new Tractor(6, 2.5);
      tractor.setInput({ x: 0, y: 0 }, 0);
      tractor.updatePosition(null, null);

      const envelope = tractor.getEnvelope();
      expect(envelope).toHaveLength(4);

      // Front-left should be at (3, 1.25)
      expect(envelope[0].x).toBeCloseTo(3);
      expect(envelope[0].y).toBeCloseTo(1.25);
    });

    it('rear position matches fifth wheel', () => {
      const tractor = new Tractor(6, 2.5, 2, 0.5);
      tractor.setInput({ x: 0, y: 0 }, 0);
      tractor.updatePosition(null, null);

      const rear = tractor.getRearPosition();
      const fw = tractor.getFifthWheelPosition();
      expect(rear.x).toBeCloseTo(fw.x);
      expect(rear.y).toBeCloseTo(fw.y);
    });
  });

  describe('Trailer', () => {
    it('creates with correct properties', () => {
      const trailer = new Trailer(16, 2.6, 1.5, 3, 1.0);
      expect(trailer.getLength()).toBe(16);
      expect(trailer.getWidth()).toBe(2.6);
      expect(trailer.getDeckHeight()).toBe(1.5);
      expect(trailer.getAxleCount()).toBe(3);
      expect(trailer.getRearOverhang()).toBe(1.0);
    });

    it('calculates rear position with overhang', () => {
      const trailer = new Trailer(10, 2.5, 1.5, 2, 2.0);
      // Position at origin, heading = 0
      const rear = trailer.getRearPosition();
      // rearOffset = 10/2 + 2.0 = 7.0
      expect(rear.x).toBeCloseTo(-7.0);
      expect(rear.y).toBeCloseTo(0);
    });

    it('updates position from previous segment via joint', () => {
      const tractor = new Tractor(6, 2.5, 2, 0.5);
      tractor.setInput({ x: 0, y: 0 }, 0);
      tractor.updatePosition(null, null);

      const joint = new ArticulationJoint('fifth_wheel', 45);
      // No turn = 0 articulation
      joint.updateArticulation(0, 10);

      const trailer = new Trailer(16, 2.6, 1.5, 3);
      trailer.updatePosition(tractor, joint);

      const pos = trailer.getPosition();
      // Trailer center is at tractor rear + halfLength along heading (straight)
      // Tractor rear (fifth wheel) is at x = -2.5, trailer center = -2.5 + 8 = 5.5
      expect(pos.x).toBeCloseTo(5.5);
    });

    it('does not update without previous segment', () => {
      const trailer = new Trailer(16, 2.6, 1.5, 3);
      trailer.updatePosition(null, null);
      const pos = trailer.getPosition();
      expect(pos.x).toBe(0);
      expect(pos.y).toBe(0);
    });
  });

  describe('JeepDolly', () => {
    it('creates with correct properties', () => {
      const dolly = new JeepDolly(4, 2.5, 2);
      expect(dolly.getLength()).toBe(4);
      expect(dolly.getWidth()).toBe(2.5);
      expect(dolly.getJeepAxles()).toBe(2);
    });

    it('calculates front and rear positions', () => {
      const dolly = new JeepDolly(4, 2.5, 2);
      const front = dolly.getFrontPosition();
      const rear = dolly.getRearPosition();

      expect(front.x).toBeCloseTo(2);  // halfLength
      expect(rear.x).toBeCloseTo(-2);
    });

    it('returns 4 corner envelope', () => {
      const dolly = new JeepDolly(4, 2.5, 2);
      expect(dolly.getEnvelope()).toHaveLength(4);
    });
  });

  describe('SteerableDolly', () => {
    it('creates with correct properties', () => {
      const dolly = new SteerableDolly(5, 2.5, 4, 0.70);
      expect(dolly.getLength()).toBe(5);
      expect(dolly.getSteerableAxles()).toBe(4);
      expect(dolly.getOffTrackingReduction()).toBe(0.70);
    });

    it('defaults offTrackingReduction to 0.70', () => {
      const dolly = new SteerableDolly(5, 2.5, 4);
      expect(dolly.getOffTrackingReduction()).toBe(0.70);
    });

    it('returns 4 corner envelope', () => {
      const dolly = new SteerableDolly(5, 2.5, 4);
      expect(dolly.getEnvelope()).toHaveLength(4);
    });
  });

  describe('Cargo', () => {
    it('creates with correct properties', () => {
      const cargo = new Cargo(12, 2.6, 4.5, { x: 0, y: 0 });
      expect(cargo.getLength()).toBe(12);
      expect(cargo.getWidth()).toBe(2.6);
      expect(cargo.getCargoHeight()).toBe(4.5);
      expect(cargo.getAxleCount()).toBe(0);
    });

    it('returns center of gravity', () => {
      const cog = { x: 0.5, y: -0.2 };
      const cargo = new Cargo(12, 2.6, 4.5, cog);
      const result = cargo.getCenterOfGravity();
      expect(result).toEqual(cog);
      // Verify it returns a copy
      result.x = 999;
      expect(cargo.getCenterOfGravity().x).toBe(0.5);
    });

    it('follows trailer position exactly', () => {
      const trailer = new Trailer(16, 2.6, 1.5, 3);
      const cargo = new Cargo(12, 2.6, 4.5);

      // Simulating trailer at some position
      const tractor = new Tractor(6, 2.5);
      tractor.setInput({ x: 10, y: 5 }, 0.1);
      tractor.updatePosition(null, null);

      const joint = new ArticulationJoint('fifth_wheel', 45);
      joint.updateArticulation(0, 10);
      trailer.updatePosition(tractor, joint);

      cargo.updatePosition(trailer, null);

      const cargoPos = cargo.getPosition();
      const trailerPos = trailer.getPosition();
      expect(cargoPos.x).toBeCloseTo(trailerPos.x);
      expect(cargoPos.y).toBeCloseTo(trailerPos.y);
      expect(cargo.getHeading()).toBe(trailer.getHeading());
    });

    it('applies center of gravity offset in envelope', () => {
      const cargo = new Cargo(10, 4, 3, { x: 1, y: 0.5 });
      const envelope = cargo.getEnvelope();
      expect(envelope).toHaveLength(4);
      // Front-left corner should be offset by cog
      expect(envelope[0].x).toBeCloseTo(1 + 5); // cog.x + halfLength
      expect(envelope[0].y).toBeCloseTo(0.5 + 2); // cog.y + halfWidth
    });
  });
});
