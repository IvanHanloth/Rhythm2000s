// Combo tier 2 on the XP desktop (doc/combo.md "Windows XP details"): the wallpaper turns into a Windows Media Player
// visualization, after WMP 9's "Ambience" and "Bars and Waves". A dark layer dims Bliss, glowing swirls turn around
// the centre with a ring pulsing out on each beat, and spectrum bars along the bottom jump on the beat. Bar heights
// come from the beat number, not the sound, so the same beat always looks the same.

import { BlurFilter, Container, Graphics } from 'pixi.js';
import { LUNA } from '@/theme/xp-luna.ts';
import { WORK_AREA_HEIGHT, XP_SCREEN_WIDTH } from './components/screen.ts';

/** Strongest alpha of the dark layer over Bliss */
const BACKDROP_ALPHA = 0.6;
/** Spectrum bars: how many, their gap and tallest height (px) */
export const BAR_COUNT = 32;
const BAR_GAP = 4;
const BAR_MAX_HEIGHT = 110;
const PEAK_HEIGHT = 3;
/** How far a peak cap falls per beat, as a share of the tallest bar */
const PEAK_FALL = 0.6;
/** Swirls: size (px), turning speed (radians per second), stroke and blur */
const SWIRL_RADIUS = [150, 205, 260];
const SWIRL_SPEED = [0.35, -0.22, 0.15];
const SWIRL_LOBES = [3, 5, 4];
const SWIRL_WIDTH = 9;
const SWIRL_ALPHA = 0.95;
const SWIRL_BLUR = 3;
/** How much the swirls swell on the beat */
const SWIRL_PULSE = 0.08;
/** The beat ring grows from this radius to this one over a beat (px) */
const RING_FROM = 30;
const RING_TO = 420;

const CENTRE = { x: XP_SCREEN_WIDTH / 2, y: WORK_AREA_HEIGHT / 2 };

/** A repeatable 0–1 value for an integer */
function hash01(n: number): number {
  return (Math.imul(n + 1, 2654435761) >>> 0) / 2 ** 32;
}

/** Height (0–1) of the jump bar `bar` makes on beat `beat`, or on the half beat after it (`half`) */
function jumpHeight(bar: number, beat: number, half: boolean): number {
  // The bass end (left) jumps higher
  const bass = 1 - 0.55 * (bar / (BAR_COUNT - 1));
  const seed = beat * 97 + bar * 13 + (half ? 7 : 0);
  return half ? (0.2 + 0.3 * hash01(seed)) * bass : (0.5 + 0.5 * hash01(seed)) * bass;
}

/** Height (0–1) of a spectrum bar at `beat`: a jump on each beat and a smaller one on the half beat, falling back in between */
export function barLevel(bar: number, beat: number): number {
  const whole = Math.floor(beat);
  const p = beat - whole;
  const onBeat = jumpHeight(bar, whole, false) * (1 - p) ** 2;
  if (p < 0.5) return onBeat;
  const onHalf = jumpHeight(bar, whole, true) * (1 - (p - 0.5) * 2) ** 2;
  return Math.max(onBeat, onHalf);
}

/** Height (0–1) of a bar's peak cap at `beat`: the highest recent jump, falling PEAK_FALL per beat, never below the bar */
export function peakLevel(bar: number, beat: number): number {
  const whole = Math.floor(beat);
  const jumps = [
    { at: whole - 1, height: jumpHeight(bar, whole - 1, false) },
    { at: whole - 0.5, height: jumpHeight(bar, whole - 1, true) },
    { at: whole, height: jumpHeight(bar, whole, false) },
  ];
  if (beat - whole >= 0.5) jumps.push({ at: whole + 0.5, height: jumpHeight(bar, whole, true) });
  const falling = Math.max(...jumps.map((jump) => jump.height - PEAK_FALL * (beat - jump.at)));
  return Math.max(falling, barLevel(bar, beat));
}

export class MediaVisualizer {
  readonly view = new Container({ label: 'media-visualizer' });
  private readonly backdrop = new Graphics();
  private readonly swirls = new Graphics();
  private readonly ring = new Graphics();
  private readonly bars = new Graphics();

  constructor() {
    const v = LUNA.combo.visualizer;
    this.backdrop.rect(0, 0, XP_SCREEN_WIDTH, WORK_AREA_HEIGHT).fill(v.backdrop);
    this.swirls.filters = [new BlurFilter({ strength: SWIRL_BLUR })];
    this.swirls.blendMode = 'add';
    this.ring.blendMode = 'add';
    this.view.addChild(this.backdrop, this.swirls, this.ring, this.bars);
  }

  /** Draws the visualization at `beat`, `fade` (0–1) of the way in */
  update(beat: number, audioTime: number, fade: number): void {
    const v = LUNA.combo.visualizer;
    const p = beat - Math.floor(beat);
    this.backdrop.alpha = BACKDROP_ALPHA * fade;

    const swell = 1 + SWIRL_PULSE * (1 - p) ** 2;
    this.swirls.clear();
    SWIRL_RADIUS.forEach((radius, i) => {
      const turn = audioTime * SWIRL_SPEED[i]!;
      const lobes = SWIRL_LOBES[i]!;
      const points: number[] = [];
      for (let step = 0; step <= 96; step++) {
        const a = (step / 96) * Math.PI * 2;
        const r = radius * swell * (0.65 + 0.35 * Math.sin(lobes * a + turn * 2));
        points.push(CENTRE.x + r * Math.cos(a + turn), CENTRE.y + r * 0.62 * Math.sin(a + turn));
      }
      this.swirls.poly(points).stroke({ width: SWIRL_WIDTH, color: v.swirls[i]!, join: 'round' });
    });
    this.swirls.alpha = SWIRL_ALPHA * fade;

    this.ring
      .clear()
      .ellipse(
        CENTRE.x,
        CENTRE.y,
        RING_FROM + (RING_TO - RING_FROM) * p,
        (RING_FROM + (RING_TO - RING_FROM) * p) * 0.62,
      )
      .stroke({ width: 5, color: v.ring });
    this.ring.alpha = 0.7 * (1 - p) * fade;

    const g = this.bars.clear();
    const width = (XP_SCREEN_WIDTH - BAR_GAP) / BAR_COUNT - BAR_GAP;
    for (let bar = 0; bar < BAR_COUNT; bar++) {
      const x = BAR_GAP + bar * (width + BAR_GAP);
      const height = BAR_MAX_HEIGHT * barLevel(bar, beat);
      if (height > 0.5) {
        g.rect(x, WORK_AREA_HEIGHT - height, width, height).fill(v.barBottom);
        // The top half of each bar lit brighter, like the player's gradient
        g.rect(x, WORK_AREA_HEIGHT - height, width, height / 2).fill({
          color: v.barTop,
          alpha: 0.7,
        });
      }
      const peak = WORK_AREA_HEIGHT - BAR_MAX_HEIGHT * peakLevel(bar, beat) - PEAK_HEIGHT - 1;
      g.rect(x, peak, width, PEAK_HEIGHT).fill(v.peak);
    }
    this.bars.alpha = fade;
  }
}
