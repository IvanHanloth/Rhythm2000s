import { describe, expect, it } from 'vite-plus/test';
import { dampAngle, headingOf, moveDirection, nearestSpot, orbitOffset } from './motion.ts';

const none = { forward: false, back: false, left: false, right: false };

describe('moveDirection', () => {
  it('stays put with no keys', () => {
    expect(moveDirection(none, 0)).toBeNull();
    expect(moveDirection({ ...none, forward: true, back: true }, 0)).toBeNull();
  });

  it('W walks where the camera looks', () => {
    // At yaw = 0 the camera is on the +z side, looking towards -z
    const d = moveDirection({ ...none, forward: true }, 0)!;
    expect(d.x).toBeCloseTo(0);
    expect(d.z).toBeCloseTo(-1);
    // The camera's forward is the opposite of orbitOffset
    const yaw = 1.1;
    const f = moveDirection({ ...none, forward: true }, yaw)!;
    const o = orbitOffset(yaw, 0, 1);
    expect(f.x).toBeCloseTo(-o.x);
    expect(f.z).toBeCloseTo(-o.z);
  });

  it('D walks to the camera right; diagonals are unit length too', () => {
    const r = moveDirection({ ...none, right: true }, 0)!;
    expect(r.x).toBeCloseTo(1);
    expect(r.z).toBeCloseTo(0);
    const diag = moveDirection({ ...none, forward: true, left: true }, 0.4)!;
    expect(Math.hypot(diag.x, diag.z)).toBeCloseTo(1);
  });
});

describe('dampAngle', () => {
  it('turns the short way round', () => {
    const next = dampAngle(Math.PI - 0.1, -Math.PI + 0.1, 10, 0.05);
    expect(next).toBeGreaterThan(Math.PI - 0.1);
  });

  it('reaches the target angle given enough time', () => {
    const target = headingOf({ x: 1, z: 0 });
    expect(dampAngle(0, target, 20, 2)).toBeCloseTo(target);
  });
});

describe('nearestSpot', () => {
  const spots = [
    { id: 'a', x: 0, z: 0, reach: 1 },
    { id: 'b', x: 1.5, z: 0, reach: 1 },
  ];

  it('returns null when nothing is in reach', () => {
    expect(nearestSpot({ x: 5, z: 5 }, spots)).toBeNull();
  });

  it('picks the nearer of two in reach', () => {
    expect(nearestSpot({ x: 0.9, z: 0 }, spots)?.id).toBe('b');
    expect(nearestSpot({ x: 0.6, z: 0 }, spots)?.id).toBe('a');
  });
});
