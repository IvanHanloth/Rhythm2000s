// Combo tier 1 on the Mac desktop (doc/combo.md "Mac details"): glassy Aqua bubbles. On each beat a row starts just
// above the Dock; each bubble rises to just under the menu bar over RISE_BEATS, swaying a little, and pops on the beat
// it arrives, so every beat one row starts and one pops. Positions come from the beat alone.

import { Graphics } from 'pixi.js';
import { AQUA } from '@/theme/aqua.ts';

export const BUBBLES_PER_ROW = 6;
/** Beats a bubble takes to rise; it pops on the beat it arrives */
export const RISE_BEATS = 4;
/** How long a pop's ring takes to grow and fade (beats) */
export const POP_BEATS = 0.25;
/** Bubble radius range (px) */
const MIN_RADIUS = 9;
const RADIUS_RANGE = 15;
/** Sideways sway (px) */
const SWAY = 10;

/** Where the bubbles rise: the screen width, from `bottom` (top of the Dock) up to `top` (under the menu bar) */
export interface BubbleArea {
  width: number;
  top: number;
  bottom: number;
}

export interface Bubble {
  x: number;
  y: number;
  radius: number;
  /** 0–1 through its pop, or null while still rising */
  pop: number | null;
}

/** A repeatable 0–1 value for an integer */
function hash01(n: number): number {
  return (Math.imul(n + 1, 2654435761) >>> 0) / 2 ** 32;
}

/** Every bubble on screen at `beat`, for bubbles that started at beat `start`: rows start on the whole beats from then */
export function bubblesAt(start: number, beat: number, area: BubbleArea): Bubble[] {
  const first = Math.ceil(start);
  const bubbles: Bubble[] = [];
  const oldest = Math.max(first, Math.ceil(beat - RISE_BEATS - POP_BEATS));
  for (let row = oldest; row <= beat; row++) {
    const age = beat - row;
    for (let j = 0; j < BUBBLES_PER_ROW; j++) {
      const seed = row * 31 + j;
      const radius = MIN_RADIUS + RADIUS_RANGE * hash01(seed);
      const lane = area.width / BUBBLES_PER_ROW;
      const x = lane * (j + 0.2 + 0.6 * hash01(seed + 500)) + SWAY * Math.sin(Math.PI * age + seed);
      const rise = Math.min(1, age / RISE_BEATS);
      const low = area.bottom - radius;
      const high = area.top + radius;
      const y = low - (low - high) * rise;
      const pop = age >= RISE_BEATS ? (age - RISE_BEATS) / POP_BEATS : null;
      if (pop !== null && pop >= 1) continue;
      bubbles.push({ x, y, radius, pop });
    }
  }
  return bubbles;
}

/** Draws bubbles like Aqua gel: a see-through blue body, a lighter rim and a white shine at the top; a pop is a fading ring */
export function drawBubbles(g: Graphics, bubbles: readonly Bubble[], alpha: number): void {
  const c = AQUA.combo.bubble;
  for (const { x, y, radius, pop } of bubbles) {
    if (pop !== null) {
      g.circle(x, y, radius * (1 + 0.8 * pop)).stroke({
        width: 2,
        color: c.pop,
        alpha: alpha * (1 - pop),
      });
      continue;
    }
    g.circle(x, y, radius)
      .fill({ color: c.body, alpha: alpha * 0.28 })
      .stroke({ width: 1.5, color: c.rim, alpha: alpha * 0.8 });
    g.ellipse(x, y - radius * 0.5, radius * 0.6, radius * 0.3).fill({
      color: c.shine,
      alpha: alpha * 0.7,
    });
    // The soft light the gel gathers at the bottom
    g.ellipse(x, y + radius * 0.55, radius * 0.5, radius * 0.22).fill({
      color: c.rim,
      alpha: alpha * 0.35,
    });
  }
}
