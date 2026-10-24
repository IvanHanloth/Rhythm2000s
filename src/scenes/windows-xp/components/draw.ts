// Helpers for drawing Luna widgets: cached gradients and 1 px borders coloured per edge.

import { FillGradient, type Graphics } from 'pixi.js';
import type { GradientStops } from '@/theme/xp-luna.ts';

const vertical = new Map<GradientStops, FillGradient>();
const horizontal = new Map<GradientStops, FillGradient>();

/**
 * Top-to-bottom gradient relative to the filled shape's bounds.
 * Each set of stops is built once and shared by every widget, never destroyed with them.
 */
export function verticalGradient(stops: GradientStops): FillGradient {
  let gradient = vertical.get(stops);
  if (!gradient) {
    gradient = createGradient(stops, { x: 0, y: 1 });
    vertical.set(stops, gradient);
  }
  return gradient;
}

/** Left-to-right gradient, used like verticalGradient */
export function horizontalGradient(stops: GradientStops): FillGradient {
  let gradient = horizontal.get(stops);
  if (!gradient) {
    gradient = createGradient(stops, { x: 1, y: 0 });
    horizontal.set(stops, gradient);
  }
  return gradient;
}

function createGradient(stops: GradientStops, end: { x: number; y: number }): FillGradient {
  return new FillGradient({
    start: { x: 0, y: 0 },
    end,
    colorStops: stops.map(([offset, color]) => ({ offset, color })),
  });
}

export interface EdgeColors {
  top: string;
  left: string;
  right: string;
  bottom: string;
}

/** A 1 px line just inside (x, y, w, h), each edge its own colour (like CSS inset box-shadow). */
export function edgeRing(g: Graphics, x: number, y: number, w: number, h: number, c: EdgeColors) {
  g.rect(x, y, w, 1).fill(c.top);
  g.rect(x, y + h - 1, w, 1).fill(c.bottom);
  g.rect(x, y + 1, 1, h - 2).fill(c.left);
  g.rect(x + w - 1, y + 1, 1, h - 2).fill(c.right);
}

/** Rectangle path with only the top corners rounded (title bars, the Start menu header) */
export function topRoundedRect(g: Graphics, x: number, y: number, w: number, h: number, r: number) {
  return g
    .moveTo(x, y + h)
    .lineTo(x, y + r)
    .arcTo(x, y, x + r, y, r)
    .lineTo(x + w - r, y)
    .arcTo(x + w, y, x + w, y + r, r)
    .lineTo(x + w, y + h)
    .closePath();
}
