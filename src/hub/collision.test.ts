import { describe, expect, it } from 'vite-plus/test';
import { boxAt, pushOut } from './collision.ts';

describe('pushOut', () => {
  const wall = boxAt(0, 0, 2, 2);

  it('离墙够远时不动', () => {
    expect(pushOut({ x: 3, z: 0 }, 0.5, [wall])).toEqual({ x: 3, z: 0 });
  });

  it('贴着边时沿法线推开到正好相切', () => {
    const p = pushOut({ x: 1.2, z: 0.3 }, 0.5, [wall]);
    expect(p.x).toBeCloseTo(1.5);
    expect(p.z).toBeCloseTo(0.3);
  });

  it('在角上时沿对角线推开', () => {
    const p = pushOut({ x: 1.1, z: 1.1 }, 0.5, [wall]);
    expect(Math.hypot(p.x - 1, p.z - 1)).toBeCloseTo(0.5);
  });

  it('圆心进到矩形里面时，从最近的边出去', () => {
    const p = pushOut({ x: 0.1, z: -0.9 }, 0.5, [wall]);
    expect(p).toEqual({ x: 0.1, z: -1.5 });
  });

  it('两面墙夹成的墙角里不会被推进另一面墙', () => {
    const left = boxAt(-1, 0, 0.2, 4);
    const back = boxAt(0, -1, 4, 0.2);
    const p = pushOut({ x: -0.8, z: -0.8 }, 0.4, [left, back]);
    expect(p.x).toBeGreaterThanOrEqual(-0.9 + 0.4 - 1e-9);
    expect(p.z).toBeGreaterThanOrEqual(-0.9 + 0.4 - 1e-9);
  });
});
