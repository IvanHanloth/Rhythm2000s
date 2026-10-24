// 大厅里角色和镜头的运动计算：按键 → 移动方向、镜头环绕位置、平滑转向、找身边能互动的东西。
// 不依赖 three，单元测试可以直接用。

import type { Point } from './collision.ts';

/** 第三人称镜头的仰角范围（弧度）：不能钻到地下，也不能翻到头顶 */
export const PITCH_MIN = -0.35;
export const PITCH_MAX = 1.2;

export interface MoveKeys {
  forward: boolean;
  back: boolean;
  left: boolean;
  right: boolean;
}

/**
 * 按键换成水平面上的单位移动方向，相对镜头朝向：W 是镜头看过去的方向。
 * 镜头在角色的 (sin yaw, cos yaw) 一侧，所以「向前」是它的反方向。没有按键时返回 null。
 */
export function moveDirection(keys: MoveKeys, yaw: number): Point | null {
  const ahead = Number(keys.forward) - Number(keys.back);
  const side = Number(keys.right) - Number(keys.left);
  if (ahead === 0 && side === 0) return null;
  const sin = Math.sin(yaw);
  const cos = Math.cos(yaw);
  const x = -sin * ahead + cos * side;
  const z = -cos * ahead - sin * side;
  const length = Math.hypot(x, z);
  return { x: x / length, z: z / length };
}

/** 镜头相对看点的偏移：yaw 绕竖轴，pitch 是仰角，distance 是到看点的距离 */
export function orbitOffset(
  yaw: number,
  pitch: number,
  distance: number,
): { x: number; y: number; z: number } {
  const flat = Math.cos(pitch) * distance;
  return { x: Math.sin(yaw) * flat, y: Math.sin(pitch) * distance, z: Math.cos(yaw) * flat };
}

export function clampPitch(pitch: number): number {
  return Math.max(PITCH_MIN, Math.min(PITCH_MAX, pitch));
}

/** 角色面朝 direction 时的朝向角（模型默认面朝 +z） */
export function headingOf(direction: Point): number {
  return Math.atan2(direction.x, direction.z);
}

/** 从角度 from 转到 to 的 k 倍（0 到 1），走较短的一边 */
export function lerpAngle(from: number, to: number, k: number): number {
  let delta = (to - from) % (Math.PI * 2);
  if (delta > Math.PI) delta -= Math.PI * 2;
  if (delta < -Math.PI) delta += Math.PI * 2;
  return from + delta * k;
}

/** 把角度从 current 平滑地转向 target；rate 越大转得越快，dt 单位是秒 */
export function dampAngle(current: number, target: number, rate: number, dt: number): number {
  return lerpAngle(current, target, 1 - Math.exp(-rate * dt));
}

/** 可以互动的东西：门、电脑、店员 */
export interface Spot {
  x: number;
  z: number;
  /** 离它多近时可以互动（米） */
  reach: number;
}

/** 角色身边最近、够得着的互动点；没有时返回 null */
export function nearestSpot<T extends Spot>(position: Point, spots: readonly T[]): T | null {
  let best: T | null = null;
  let bestDist = Infinity;
  for (const spot of spots) {
    const dist = Math.hypot(spot.x - position.x, spot.z - position.z);
    if (dist <= spot.reach && dist < bestDist) {
      best = spot;
      bestDist = dist;
    }
  }
  return best;
}
