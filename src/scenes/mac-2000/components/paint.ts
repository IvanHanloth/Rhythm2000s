// Drawing shared by the Aqua widgets: pinstripes, gel capsules, gel balls, gradients and text.
// The originals are bitmaps; these are vector approximations (doc/scenes/mac-2000.md "Missing assets").

import { BlurFilter, FillGradient, FillPattern, Graphics, Text, Texture } from 'pixi.js';
import { AQUA, AQUA_FONT, type BallColors, type GelColors } from '@/theme/aqua.ts';

type Stops = readonly (readonly [offset: number, color: string])[];

// Gradients use local coordinates (0–1 over the shape's bounds), so one set of stops fits any size and is cached
const gradients = new Map<string, FillGradient>();

function gradient(kind: 'v' | 'h', stops: Stops): FillGradient {
  const key = kind + JSON.stringify(stops);
  let fill = gradients.get(key);
  if (!fill) {
    fill = new FillGradient({
      end: kind === 'v' ? { x: 0, y: 1 } : { x: 1, y: 0 },
      colorStops: stops.map(([offset, color]) => ({ offset, color })),
    });
    gradients.set(key, fill);
  }
  return fill;
}

/** Top-to-bottom linear gradient */
export const vGradient = (stops: Stops) => gradient('v', stops);
/** Left-to-right linear gradient */
export const hGradient = (stops: Stops) => gradient('h', stops);

/** Light through a gel ball: brightest low down, darkening upwards and outwards */
function ballGradient(colors: BallColors): FillGradient {
  const key = `ball${colors.dark}${colors.light}`;
  let fill = gradients.get(key);
  if (!fill) {
    fill = new FillGradient({
      type: 'radial',
      center: { x: 0.5, y: 0.92 },
      innerRadius: 0,
      outerCenter: { x: 0.5, y: 0.62 },
      outerRadius: 0.72,
      colorStops: [
        { offset: 0, color: colors.light },
        { offset: 1, color: colors.dark },
      ],
    });
    gradients.set(key, fill);
  }
  return fill;
}

/** Highlight on top of the gel: white fading out downwards */
const SHINE: Stops = [
  [0, 'rgba(255,255,255,0.95)'],
  [1, 'rgba(255,255,255,0.2)'],
];

const patterns = new Map<string, FillPattern>();

/** Horizontal pinstripes: 2 px light and 2 px dark */
export function stripes(colors: { light: string; dark: string }): FillPattern {
  const key = colors.light + colors.dark;
  let pattern = patterns.get(key);
  if (!pattern) {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 4;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = colors.light;
    ctx.fillRect(0, 0, 1, 2);
    ctx.fillStyle = colors.dark;
    ctx.fillRect(0, 2, 1, 2);
    pattern = new FillPattern({ texture: Texture.from(canvas), repetition: 'repeat' });
    patterns.set(key, pattern);
  }
  return pattern;
}

/** Rectangle path with only the top corners rounded (an Aqua window has square bottom corners). Fill or stroke after. */
export function topRoundedRect(
  g: Graphics,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): Graphics {
  return g
    .moveTo(x, y + height)
    .lineTo(x, y + radius)
    .arcTo(x, y, x + radius, y, radius)
    .lineTo(x + width - radius, y)
    .arcTo(x + width, y, x + width, y + radius, radius)
    .lineTo(x + width, y + height)
    .closePath();
}

/** Horizontal gel capsule (push button): highlight on the upper half, light through the bottom. */
export function drawGelPill(
  g: Graphics,
  x: number,
  y: number,
  width: number,
  height: number,
  colors: GelColors,
): Graphics {
  const r = height / 2;
  const inset = Math.max(3, r * 0.55);
  return g
    .roundRect(x, y + 1, width, height, r)
    .fill({ color: AQUA.shadow, alpha: 0.16 })
    .roundRect(x, y, width, height, r)
    .fill(colors.rim)
    .roundRect(x + 1, y + 1, width - 2, height - 2, r - 1)
    .fill(
      vGradient([
        [0, colors.top],
        [0.5, colors.mid],
        [1, colors.glow],
      ]),
    )
    .roundRect(x + inset, y + 1.5, width - inset * 2, height * 0.46, height * 0.23)
    .fill(vGradient(SHINE));
}

/** Vertical gel capsule (scroller thumb): highlight on the left half, light through the right. */
export function drawGelThumb(
  g: Graphics,
  x: number,
  y: number,
  width: number,
  height: number,
  colors: GelColors,
): Graphics {
  const r = width / 2;
  const inset = Math.max(3, r * 0.55);
  return g
    .roundRect(x, y, width, height, r)
    .fill(colors.rim)
    .roundRect(x + 1, y + 1, width - 2, height - 2, r - 1)
    .fill(
      hGradient([
        [0, colors.top],
        [0.5, colors.mid],
        [1, colors.glow],
      ]),
    )
    .roundRect(x + 1.5, y + inset, width * 0.46, height - inset * 2, width * 0.23)
    .fill(
      hGradient([
        [0, 'rgba(255,255,255,0.9)'],
        [1, 'rgba(255,255,255,0.15)'],
      ]),
    );
}

/** Gel ball (the three window buttons) centred at (cx, cy) */
export function drawGelBall(
  g: Graphics,
  cx: number,
  cy: number,
  r: number,
  colors: BallColors,
): Graphics {
  return g
    .circle(cx, cy + 0.6, r + 0.4)
    .fill({ color: AQUA.shadow, alpha: 0.2 })
    .circle(cx, cy, r)
    .fill(colors.rim)
    .circle(cx, cy, r - 1)
    .fill(ballGradient(colors))
    .ellipse(cx, cy - r * 0.43, r * 0.62, r * 0.4)
    .fill(vGradient(SHINE));
}

/** One blur filter shared by every window shadow */
let shadowBlur: BlurFilter | null = null;

/**
 * The large soft Aqua window shadow, offset slightly down and spread all round.
 * Its top left lines up with the window's; place it under the window.
 */
export function drawWindowShadow(width: number, height: number, alpha: number): Graphics {
  shadowBlur ??= new BlurFilter({ strength: 9, quality: 3 });
  const g = new Graphics({ label: 'shadow' })
    .roundRect(-1, 3, width + 2, height + 2, 6)
    .fill({ color: AQUA.shadow, alpha });
  g.filters = [shadowBlur];
  return g;
}

/**
 * Text rasterised at 3× resolution: the desktop is scaled 1.25× and then to the screen, so the default blurs.
 */
const TEXT_RESOLUTION = 3;

export interface AquaTextOptions {
  size: number;
  bold?: boolean;
  color?: string;
  /** Wrap width; no wrapping if omitted */
  wrapWidth?: number;
  lineHeight?: number;
  align?: 'left' | 'center' | 'right';
}

export function aquaText(
  text: string,
  { size, bold = false, color = AQUA.ink, wrapWidth, lineHeight, align }: AquaTextOptions,
): Text {
  return new Text({
    text,
    resolution: TEXT_RESOLUTION,
    style: {
      fontFamily: AQUA_FONT,
      fontSize: size,
      fontWeight: bold ? '700' : '400',
      fill: color,
      // Leave out unset options so undefined doesn't override PixiJS defaults
      ...(lineHeight !== undefined && { lineHeight }),
      ...(align !== undefined && { align }),
      ...(wrapWidth !== undefined && {
        wordWrap: true,
        wordWrapWidth: wrapWidth,
        breakWords: true,
      }),
    },
  });
}
