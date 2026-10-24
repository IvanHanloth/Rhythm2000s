// Combo tier 3 on the Mac desktop (doc/combo.md "Mac details"): after Mac OS X 10.2's Flurry screen saver. A dark
// layer dims the wallpaper; four ribbons stream and curl out of a source wandering round the middle of the screen,
// widening and fading towards their ends, and flare on each beat. A ribbon is the path of the light given off over
// the last RIBBON_SECONDS, so it is drawn from the audio time alone.

import { BlurFilter, Container, Graphics } from 'pixi.js';
import { AQUA } from '@/theme/aqua.ts';

/** How much of its past each ribbon shows (s), and how finely it is drawn */
export const RIBBON_SECONDS = 2.2;
const SAMPLES = 36;
/** How fast the light leaves the source (px per second) */
const SPEED = 170;
/** How fast each ribbon curls (radians per second) and its leaving direction turns */
const CURL = [1.6, -1.25, 2.05, -1.8];
const SPIN = [0.5, -0.42, 0.33, -0.6];
/** How far the source wanders from the middle (px) */
const WANDER = { x: 70, y: 45 };
/** Ribbon width near the source and at the end (px) */
const WIDTH_START = 3;
const WIDTH_END = 16;
/** How much brighter and wider the ribbons flare on the beat */
const FLARE = 0.7;
const BACKDROP_ALPHA = 0.6;
const GLOW_BLUR = 8;

export interface Point {
  x: number;
  y: number;
}

/** Where the source is at audio time `time` */
function sourceAt(centre: Point, time: number): Point {
  return {
    x: centre.x + WANDER.x * Math.sin(0.31 * time),
    y: centre.y + WANDER.y * Math.sin(0.47 * time + 1),
  };
}

/**
 * Where the light ribbon `ribbon` gave off `age` seconds before `now` is at `now`: it left the source as it was then,
 * heading in the direction the ribbon pointed then, and has curled at a steady rate since.
 */
export function ribbonPoint(centre: Point, ribbon: number, now: number, age: number): Point {
  const left = now - age;
  const source = sourceAt(centre, left);
  const heading = (ribbon * Math.PI) / 2 + SPIN[ribbon]! * left;
  const curl = CURL[ribbon]!;
  return {
    x: source.x + (SPEED / curl) * (Math.sin(heading + curl * age) - Math.sin(heading)),
    y: source.y - (SPEED / curl) * (Math.cos(heading + curl * age) - Math.cos(heading)),
  };
}

export class Flurry {
  readonly view = new Container({ label: 'flurry' });
  private readonly backdrop = new Graphics();
  private readonly glow = new Graphics();
  private readonly ribbons = new Graphics();
  private readonly centre: Point;

  constructor(width: number, height: number) {
    const f = AQUA.combo.flurry;
    this.centre = { x: width / 2, y: height / 2 };
    this.backdrop.rect(0, 0, width, height).fill(f.backdrop);
    this.glow.filters = [new BlurFilter({ strength: GLOW_BLUR })];
    this.glow.blendMode = 'add';
    this.ribbons.blendMode = 'add';
    this.view.addChild(this.backdrop, this.glow, this.ribbons);
  }

  /** Draws the ribbons at audio time `audioTime`, flaring on the beat, `fade` (0–1) of the way in */
  update(beat: number, audioTime: number, fade: number): void {
    const f = AQUA.combo.flurry;
    const phase = beat - Math.floor(beat);
    const flare = 1 + FLARE * (1 - phase) ** 2;
    this.backdrop.alpha = BACKDROP_ALPHA * fade;
    this.glow.clear();
    this.ribbons.clear();
    f.ribbons.forEach((color, ribbon) => {
      let from = ribbonPoint(this.centre, ribbon, audioTime, 0);
      for (let i = 1; i <= SAMPLES; i++) {
        const along = i / SAMPLES;
        const to = ribbonPoint(this.centre, ribbon, audioTime, along * RIBBON_SECONDS);
        const width = (WIDTH_START + (WIDTH_END - WIDTH_START) * along) * flare;
        const alpha = Math.min(1, (1 - along) ** 1.5 * flare) * fade;
        this.glow
          .moveTo(from.x, from.y)
          .lineTo(to.x, to.y)
          .stroke({ width: width * 2.2, color, alpha: alpha * 0.5, cap: 'round' });
        this.ribbons
          .moveTo(from.x, from.y)
          .lineTo(to.x, to.y)
          .stroke({ width: width * 0.6, color, alpha, cap: 'round' });
        // A hot white core near the source
        if (along < 0.3) {
          this.ribbons
            .moveTo(from.x, from.y)
            .lineTo(to.x, to.y)
            .stroke({
              width: width * 0.25,
              color: f.core,
              alpha: alpha * (1 - along / 0.3),
              cap: 'round',
            });
        }
        from = to;
      }
    });
  }
}
