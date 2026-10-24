// The beat guide (doc/beat-guide.md): ((((O)))). The centre dot pulses with the beat; each beat a pair of arcs
// closes in from both sides and meets as a ring around the dot on the beat. Grey normally, yellow on beats to press.
// A hold joins its press and end arcs with a yellow bar and keeps a yellow ring around the dot until it ends.
// Origin at the centre, canvas coordinates, redrawn every frame from the current beat.

import { Container, Graphics } from 'pixi.js';
import {
  GUIDE_FADE_BEATS,
  GUIDE_LOOKAHEAD_BEATS,
  guideHolds,
  guideMarks,
  guidePulse,
  holdSpans,
  pressBeats,
  type HoldSpan,
} from '@/rhythm/beat-guide.ts';
import type { Chart } from '@/rhythm/chart.ts';
import { DESIGN_HEIGHT, DESIGN_WIDTH } from '@/game/layout.ts';
import { BEAT_GUIDE_COLORS } from '@/theme/tokens.ts';

/** Centre on the canvas: horizontally centred, a little below the middle (doc/beat-guide.md) */
export const BEAT_GUIDE_POSITION = { x: DESIGN_WIDTH / 2, y: DESIGN_HEIGHT - 200 };

const CORE_RADIUS = 18;
/** Radius of the ring the arcs form on the beat (around the dot) */
const RING_RADIUS = 32;
/** How much farther from the centre the arcs are per beat */
const BEAT_SPACING = 56;
/** Half the sweep of each arc (radians); the two sides together nearly close the circle */
const ARC_HALF_ANGLE = (70 * Math.PI) / 180;
const ARC_WIDTH = 7;
/** How much the dot grows on the beat */
const PULSE_SCALE = 0.45;
/** Arcs fade in over their first beat at the far edge */
const FADE_IN_BEATS = 1;
/** Hold bar thickness and opacity; hold-end arcs are thinner than press arcs */
const HOLD_BAR_HEIGHT = 28;
const HOLD_BAR_ALPHA = 0.6;
const HOLD_END_WIDTH = 4;

export class BeatGuideView {
  readonly view = new Container({ label: 'beat-guide' });
  private readonly arcs = new Graphics();
  private readonly core = new Graphics();
  private presses: readonly number[] = [];
  private holds: readonly HoldSpan[] = [];
  private endBeat = 0;

  constructor() {
    // No backing plate: drawn straight on the desktop
    this.view.addChild(this.arcs, this.core);
    this.view.visible = false;
  }

  /** New round (the chart or a demo chart): work out the presses and holds */
  setRound(chart: Chart): void {
    this.presses = pressBeats(chart);
    this.holds = holdSpans(chart);
    this.endBeat = chart.endBeat;
  }

  /** Call every frame with the current (heard) beat */
  update(beat: number): void {
    const g = this.arcs.clear();
    const press = BEAT_GUIDE_COLORS.press;

    // Hold bars at the bottom: one per side, from the outer edge of the press arc to that of the end arc
    let holding = false;
    for (const hold of guideHolds(beat, this.holds)) {
      holding ||= hold.active;
      const near = RING_RADIUS + hold.from * BEAT_SPACING;
      const far = RING_RADIUS + hold.to * BEAT_SPACING;
      const y = -HOLD_BAR_HEIGHT / 2;
      g.roundRect(-far, y, far - near, HOLD_BAR_HEIGHT, HOLD_BAR_HEIGHT / 2)
        .roundRect(near, y, far - near, HOLD_BAR_HEIGHT, HOLD_BAR_HEIGHT / 2)
        .fill({ color: press, alpha: HOLD_BAR_ALPHA });
    }
    // During a hold the dot keeps a yellow ring
    if (holding) g.circle(0, 0, RING_RADIUS).stroke({ width: ARC_WIDTH, color: press });

    for (const mark of guideMarks(beat, this.endBeat, this.presses, this.holds)) {
      const { distance } = mark;
      const yellow = mark.press || mark.holdEnd;
      const color = yellow ? press : BEAT_GUIDE_COLORS.idle;
      const alpha =
        distance < 0
          ? 1 - Math.min(1, -distance / GUIDE_FADE_BEATS)
          : Math.min(1, (GUIDE_LOOKAHEAD_BEATS - distance) / FADE_IN_BEATS);
      // Past the beat the arcs stop at the ring and fade
      const offset = Math.max(0, distance) * BEAT_SPACING;
      const width = mark.holdEnd ? HOLD_END_WIDTH : ARC_WIDTH;
      const stroke = { width, color, alpha, cap: 'round' as const };
      // Left "(": a left half-arc shifted left by offset
      arc(g, -offset, Math.PI - ARC_HALF_ANGLE, Math.PI + ARC_HALF_ANGLE).stroke(stroke);
      // Right ")": a right half-arc shifted right
      arc(g, offset, -ARC_HALF_ANGLE, ARC_HALF_ANGLE).stroke(stroke);
    }

    const pulse = guidePulse(beat, this.presses, this.holds);
    const radius = CORE_RADIUS * (1 + PULSE_SCALE * pulse.strength);
    this.core
      .clear()
      .circle(0, 0, radius)
      .fill(pulse.press ? BEAT_GUIDE_COLORS.press : BEAT_GUIDE_COLORS.core);
  }
}

/** An arc of radius RING_RADIUS centred at (cx, 0); moveTo first so it doesn't join the previous one */
function arc(g: Graphics, cx: number, start: number, end: number): Graphics {
  return g
    .moveTo(cx + RING_RADIUS * Math.cos(start), RING_RADIUS * Math.sin(start))
    .arc(cx, 0, RING_RADIUS, start, end);
}
