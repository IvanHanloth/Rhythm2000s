import { describe, expect, it } from 'vite-plus/test';
import { dampAngle, headingOf, moveDirection, nearestSpot, orbitOffset } from './motion.ts';

const none = { forward: false, back: false, left: false, right: false };

describe('moveDirection', () => {
  it('没按键时不动', () => {
    expect(moveDirection(none, 0)).toBeNull();
    expect(moveDirection({ ...none, forward: true, back: true }, 0)).toBeNull();
  });

  it('W 朝着镜头看的方向走', () => {
    // yaw = 0 时镜头在 +z 一侧，看向 -z
    const d = moveDirection({ ...none, forward: true }, 0)!;
    expect(d.x).toBeCloseTo(0);
    expect(d.z).toBeCloseTo(-1);
    // 镜头的前方和 orbitOffset 给的偏移正好相反
    const yaw = 1.1;
    const f = moveDirection({ ...none, forward: true }, yaw)!;
    const o = orbitOffset(yaw, 0, 1);
    expect(f.x).toBeCloseTo(-o.x);
    expect(f.z).toBeCloseTo(-o.z);
  });

  it('D 朝镜头右手边走，斜着走也是单位长度', () => {
    const r = moveDirection({ ...none, right: true }, 0)!;
    expect(r.x).toBeCloseTo(1);
    expect(r.z).toBeCloseTo(0);
    const diag = moveDirection({ ...none, forward: true, left: true }, 0.4)!;
    expect(Math.hypot(diag.x, diag.z)).toBeCloseTo(1);
  });
});

describe('dampAngle', () => {
  it('走较短的一边', () => {
    const next = dampAngle(Math.PI - 0.1, -Math.PI + 0.1, 10, 0.05);
    expect(next).toBeGreaterThan(Math.PI - 0.1);
  });

  it('时间够长时到达目标朝向', () => {
    const target = headingOf({ x: 1, z: 0 });
    expect(dampAngle(0, target, 20, 2)).toBeCloseTo(target);
  });
});

describe('nearestSpot', () => {
  const spots = [
    { id: 'a', x: 0, z: 0, reach: 1 },
    { id: 'b', x: 1.5, z: 0, reach: 1 },
  ];

  it('够不着时返回 null', () => {
    expect(nearestSpot({ x: 5, z: 5 }, spots)).toBeNull();
  });

  it('两个都够得着时选近的', () => {
    expect(nearestSpot({ x: 0.9, z: 0 }, spots)?.id).toBe('b');
    expect(nearestSpot({ x: 0.6, z: 0 }, spots)?.id).toBe('a');
  });
});
