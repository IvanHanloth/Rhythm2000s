// Easing functions. Input is 0…1 progress computed from the audio clock, never from frame counts.

export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** Overshoots then settles, for windows popping up. */
export function easeOutBack(progress: number): number {
  const p = clamp01(progress);
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * (p - 1) ** 3 + c1 * (p - 1) ** 2;
}

export function easeOutCubic(progress: number): number {
  return 1 - (1 - clamp01(progress)) ** 3;
}
