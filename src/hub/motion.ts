// Character and camera movement in the hub: keys to direction, camera orbit, smooth turning, nearest interaction.
// No three.js, so unit tests can use it.

import type { Point } from './collision.ts';

/** Third-person camera pitch range (radians): not below the ground, not over the top */
export const PITCH_MIN = -0.35;
export const PITCH_MAX = 1.2;

export interface MoveKeys {
  forward: boolean;
  back: boolean;
  left: boolean;
  right: boolean;
}

/**
 * Keys to a unit direction on the ground relative to the camera: W is where the camera looks.
 * The camera sits on the (sin yaw, cos yaw) side of the character, so forward is the opposite. Null with no keys.
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

/** Camera offset from its target: yaw about the vertical axis, pitch upwards, distance from the target */
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

/** Heading of a character facing `direction` (models face +z) */
export function headingOf(direction: Point): number {
  return Math.atan2(direction.x, direction.z);
}

/** From angle `from` towards `to` by fraction k (0–1), the short way round */
export function lerpAngle(from: number, to: number, k: number): number {
  let delta = (to - from) % (Math.PI * 2);
  if (delta > Math.PI) delta -= Math.PI * 2;
  if (delta < -Math.PI) delta += Math.PI * 2;
  return from + delta * k;
}

/** Turns `current` smoothly towards `target`; higher rate turns faster; dt in seconds */
export function dampAngle(current: number, target: number, rate: number, dt: number): number {
  return lerpAngle(current, target, 1 - Math.exp(-rate * dt));
}

/** Something to interact with: a door, a computer, the clerk */
export interface Spot {
  x: number;
  z: number;
  /** How close counts as in reach (m) */
  reach: number;
}

/** The nearest interaction in reach of the character; null when none */
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
