import { describe, expect, it } from 'vite-plus/test';
import { boxAt, pushOut } from './collision.ts';

describe('pushOut', () => {
  const wall = boxAt(0, 0, 2, 2);

  it('does nothing far from walls', () => {
    expect(pushOut({ x: 3, z: 0 }, 0.5, [wall])).toEqual({ x: 3, z: 0 });
  });

  it('pushes out along the normal to just touch an edge', () => {
    const p = pushOut({ x: 1.2, z: 0.3 }, 0.5, [wall]);
    expect(p.x).toBeCloseTo(1.5);
    expect(p.z).toBeCloseTo(0.3);
  });

  it('pushes out diagonally at a corner', () => {
    const p = pushOut({ x: 1.1, z: 1.1 }, 0.5, [wall]);
    expect(Math.hypot(p.x - 1, p.z - 1)).toBeCloseTo(0.5);
  });

  it('leaves through the nearest edge when the centre is inside', () => {
    const p = pushOut({ x: 0.1, z: -0.9 }, 0.5, [wall]);
    expect(p).toEqual({ x: 0.1, z: -1.5 });
  });

  it('is not pushed into the other wall in an inside corner', () => {
    const left = boxAt(-1, 0, 0.2, 4);
    const back = boxAt(0, -1, 4, 0.2);
    const p = pushOut({ x: -0.8, z: -0.8 }, 0.4, [left, back]);
    expect(p.x).toBeGreaterThanOrEqual(-0.9 + 0.4 - 1e-9);
    expect(p.z).toBeGreaterThanOrEqual(-0.9 + 0.4 - 1e-9);
  });
});
