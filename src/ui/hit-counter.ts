// Combo hit counter (doc/combo.md): a GeoCities-style web counter, six black cells with white digits and a "HITS" tag,
// identical in every theme. Digits roll like an odometer on each change; a reset flashes the cells red. From tier 2 a
// "HOT!" flame flickers to its left, flaring on each beat. Drawn from the audio time; origin at the top right corner.

import { Container, Graphics, Text } from 'pixi.js';
import type { ComboTracker } from '@/rhythm/combo.ts';
import { BEATS, FONT_FAMILIES, HIT_COUNTER_COLORS as C } from '@/theme/tokens.ts';
import { clamp01 } from './easing.ts';

const DIGITS = 6;
const MAX_COUNT = 10 ** DIGITS - 1;
const CELL_WIDTH = 20;
const CELL_HEIGHT = 30;
const CELL_GAP = 2;
const PADDING = 4;
const FRAME_WIDTH = PADDING * 2 + DIGITS * CELL_WIDTH + (DIGITS - 1) * CELL_GAP;
const FRAME_HEIGHT = PADDING * 2 + CELL_HEIGHT;
const CAPTION_HEIGHT = 15;

interface Cell {
  /** The digit leaving (or standing still) */
  out: Text;
  /** The digit rolling in from below */
  in: Text;
  flash: Graphics;
}

export class HitCounterView {
  readonly view = new Container({ label: 'hit-counter' });
  private readonly cells: Cell[] = [];
  private readonly flame = new Container({ label: 'hot' });
  private readonly fire: Graphics;

  constructor() {
    const left = -FRAME_WIDTH;
    const frame = new Graphics()
      .rect(left, 0, FRAME_WIDTH, FRAME_HEIGHT)
      .fill(C.frame)
      // Raised bevel: light top and left, dark bottom and right
      .rect(left, 0, FRAME_WIDTH, 1)
      .fill(C.frameLight)
      .rect(left, 0, 1, FRAME_HEIGHT)
      .fill(C.frameLight)
      .rect(left, FRAME_HEIGHT - 1, FRAME_WIDTH, 1)
      .fill(C.frameDark)
      .rect(-1, 0, 1, FRAME_HEIGHT)
      .fill(C.frameDark);
    this.view.addChild(frame);

    for (let i = 0; i < DIGITS; i++) {
      const x = left + PADDING + i * (CELL_WIDTH + CELL_GAP);
      const cell = new Container({ label: `digit-${i}` });
      cell.position.set(x, PADDING);
      const back = new Graphics().rect(0, 0, CELL_WIDTH, CELL_HEIGHT).fill(C.cell);
      const flash = new Graphics().rect(0, 0, CELL_WIDTH, CELL_HEIGHT).fill(C.broken);
      flash.visible = false;
      const out = digitText();
      const incoming = digitText();
      const mask = new Graphics().rect(0, 0, CELL_WIDTH, CELL_HEIGHT).fill(C.cell);
      cell.addChild(back, flash, out, incoming, mask);
      out.mask = mask;
      incoming.mask = mask;
      this.cells.push({ out, in: incoming, flash });
      this.view.addChild(cell);
    }

    const caption = new Text({
      text: 'HITS',
      style: { fontFamily: FONT_FAMILIES.pixel, fontSize: 11, fontWeight: '700', fill: C.caption },
    });
    caption.anchor.set(0.5);
    const tagWidth = Math.ceil(caption.width) + 12;
    const tag = new Graphics()
      .rect(-tagWidth, FRAME_HEIGHT, tagWidth, CAPTION_HEIGHT)
      .fill(C.captionBack);
    caption.position.set(-tagWidth / 2, FRAME_HEIGHT + CAPTION_HEIGHT / 2);
    this.view.addChild(tag, caption);

    this.fire = drawFlame();
    const hot = new Text({
      text: 'HOT!',
      style: {
        fontFamily: FONT_FAMILIES.display,
        fontSize: 18,
        fontWeight: '800',
        fontStyle: 'italic',
        fill: C.hot,
        stroke: { color: C.hotEdge, width: 3 },
      },
    });
    hot.anchor.set(0.5);
    hot.rotation = -0.14;
    hot.position.set(0, 4);
    this.flame.addChild(this.fire, hot);
    this.flame.position.set(left - 30, FRAME_HEIGHT / 2 + 2);
    this.flame.visible = false;
    this.view.addChild(this.flame);
    this.show(0, 0, 1);
  }

  /**
   * Call every frame while the chart plays. `beat` is the song beat (for the flame), `beatSeconds` the beat length;
   * hit and reset times in the tracker are heard times on the same clock as `audioTime`.
   */
  update(combo: ComboTracker, audioTime: number, beat: number, beatSeconds: number): void {
    const roll = BEATS.counterRoll * beatSeconds;
    const hit = combo.lastHit;
    const broke = combo.lastBreak;
    const resetLast = broke !== null && (hit === null || broke.time >= hit);

    let from = combo.count;
    let progress = 1;
    if (resetLast && audioTime - broke.time < roll) {
      from = broke.lost;
      progress = clamp01((audioTime - broke.time) / roll);
    } else if (!resetLast && hit !== null && audioTime - hit < roll) {
      from = combo.count - 1;
      progress = clamp01((audioTime - hit) / roll);
    }
    this.show(from, combo.count, progress);

    const flashing = resetLast && audioTime - broke.time < BEATS.counterFlash * beatSeconds;
    for (const cell of this.cells) cell.flash.visible = flashing;

    this.flame.visible = combo.tier >= 2;
    if (this.flame.visible) {
      // Flares on the beat, then settles; a quick flicker keeps it alive between beats
      const flare = 1 - clamp01((beat - Math.floor(beat)) * 4);
      const flicker = Math.sin(audioTime * 37) * 0.05;
      this.fire.scale.set(1 + flare * 0.08, 1 + flare * 0.25 + flicker);
    }
  }

  destroy(): void {
    this.view.destroy({ children: true });
  }

  /** Digits rolling from `from` to `to`, `progress` 0–1 */
  private show(from: number, to: number, progress: number): void {
    const before = digitsOf(from);
    const after = digitsOf(to);
    this.cells.forEach((cell, i) => {
      const a = before[i]!;
      const b = after[i]!;
      cell.out.text = a;
      cell.in.text = b;
      if (a === b || progress >= 1) {
        cell.out.text = b;
        cell.out.y = CELL_HEIGHT / 2;
        cell.in.visible = false;
        return;
      }
      cell.out.y = CELL_HEIGHT / 2 - progress * CELL_HEIGHT;
      cell.in.y = CELL_HEIGHT / 2 + (1 - progress) * CELL_HEIGHT;
      cell.in.visible = true;
    });
  }
}

function digitsOf(count: number): string[] {
  return String(Math.min(MAX_COUNT, Math.max(0, count)))
    .padStart(DIGITS, '0')
    .split('');
}

function digitText(): Text {
  const text = new Text({
    text: '0',
    style: { fontFamily: FONT_FAMILIES.pixel, fontSize: 24, fontWeight: '700', fill: C.digit },
  });
  text.anchor.set(0.5);
  text.position.set(CELL_WIDTH / 2, CELL_HEIGHT / 2);
  return text;
}

/** A flame: orange outer tongue with a yellow core, based at the origin's bottom so it grows upward */
function drawFlame(): Graphics {
  const flame = new Graphics()
    .moveTo(0, 14)
    .bezierCurveTo(-16, 12, -14, -4, -6, -10)
    .bezierCurveTo(-6, -2, -2, -2, 0, -22)
    .bezierCurveTo(4, -10, 14, -8, 12, 2)
    .bezierCurveTo(14, 10, 8, 14, 0, 14)
    .fill(C.flameOuter)
    .moveTo(0, 14)
    .bezierCurveTo(-8, 13, -8, 2, -2, -4)
    .bezierCurveTo(0, 2, 2, 0, 3, -8)
    .bezierCurveTo(8, 0, 8, 12, 0, 14)
    .fill(C.flameInner);
  flame.pivot.set(0, 14);
  flame.position.set(0, 14);
  return flame;
}
