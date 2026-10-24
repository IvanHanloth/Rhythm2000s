// The shape of chair-swivel's 3D cutaway (doc/cross-dimension.md), as a function of how far through it is (0–1).
// The level drives it from the audio clock; no three.js here, so it is testable. Timings are provisional.

/** End of the pull out of the monitor, and of the spin (fractions of the cutaway) */
const OUT_END = 0.25;
const SPIN_END = 0.75;

/** Where the camera is along its path, and how far the chair has turned */
export interface CutawayPhase {
  /** 0 in front of the monitor, 1 over the shoulder, 2 up behind the chair */
  path: number;
  /** Chair turn (radians), 0 to one full turn */
  spin: number;
}

function smoothstep(t: number): number {
  const k = Math.max(0, Math.min(1, t));
  return k * k * (3 - 2 * k);
}

export function cutawayPhase(progress: number): CutawayPhase {
  if (progress < OUT_END) return { path: 2 * smoothstep(progress / OUT_END), spin: 0 };
  if (progress < SPIN_END) {
    return { path: 2, spin: 2 * Math.PI * smoothstep((progress - OUT_END) / (SPIN_END - OUT_END)) };
  }
  return { path: 2 - 2 * smoothstep((progress - SPIN_END) / (1 - SPIN_END)), spin: 2 * Math.PI };
}
