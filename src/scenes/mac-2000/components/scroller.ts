// Vertical scroller (NSScroller), 15 px wide. The thumb is a gel capsule, blue in an active window and white
// otherwise; the arrows sit together at the bottom as in the original default.

import { Graphics } from 'pixi.js';
import { AQUA } from '@/theme/aqua.ts';
import { drawGelThumb, hGradient } from './paint.ts';

export const SCROLLER_WIDTH = 15;
const ARROW = 15;
const THUMB_MIN = 20;

export interface ScrollerOptions {
  height: number;
  /** Thumb top within the track, 0–1 */
  thumbStart: number;
  /** Thumb length as a share of the track, 0–1 (visible / total content) */
  thumbSize: number;
  active: boolean;
}

/** Draws a vertical scroller with its top left at (0, 0) */
export function drawScroller({ height, thumbStart, thumbSize, active }: ScrollerOptions): Graphics {
  const { trackDark, trackLight, trackEdge, arrow } = AQUA.scroller;
  const trackHeight = height - ARROW * 2;
  const g = new Graphics({ label: 'scroller' });

  // Track: a groove darker on the left, lighter on the right
  g.rect(0, 0, SCROLLER_WIDTH, trackHeight).fill(
    hGradient([
      [0, trackDark],
      [0.4, trackLight],
      [1, trackLight],
    ]),
  );

  // Thumb
  const room = trackHeight - 4;
  const thumbHeight = Math.min(room, Math.max(THUMB_MIN, room * thumbSize));
  const thumbY = 2 + (room - thumbHeight) * thumbStart;
  drawGelThumb(
    g,
    1.5,
    thumbY,
    SCROLLER_WIDTH - 3,
    thumbHeight,
    active ? AQUA.gel.blue : AQUA.gel.white,
  );

  // Up and down arrows side by side at the bottom
  for (const [i, up] of [
    [0, true],
    [1, false],
  ] as const) {
    const y = trackHeight + i * ARROW;
    g.rect(0, y, SCROLLER_WIDTH, ARROW)
      .fill(
        hGradient([
          [0, trackLight],
          [1, trackDark],
        ]),
      )
      .rect(0, y, SCROLLER_WIDTH, 1)
      .fill(trackEdge);
    const cx = SCROLLER_WIDTH / 2;
    const cy = y + ARROW / 2;
    if (up) g.poly([cx, cy - 3, cx - 3.5, cy + 2.5, cx + 3.5, cy + 2.5]);
    else g.poly([cx - 3.5, cy - 2.5, cx + 3.5, cy - 2.5, cx, cy + 3]);
    g.fill(arrow);
  }

  // Divider from the content area
  g.rect(0, 0, 1, height).fill(trackEdge);
  return g;
}
