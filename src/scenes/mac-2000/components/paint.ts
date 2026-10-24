// Aqua 部件共用的画法：细条纹、果冻胶囊、果冻圆球、渐变和文字。
// 原版的这些图形都是位图，这里用渐变矢量近似（doc/scenes/mac-2000.md「本地素材缺口」）。

import { BlurFilter, FillGradient, FillPattern, Graphics, Text, Texture } from 'pixi.js';
import { AQUA, AQUA_FONT, type BallColors, type GelColors } from '@/theme/aqua.ts';

type Stops = readonly (readonly [offset: number, color: string])[];

// 渐变用局部坐标（0–1 对应图形的包围盒），同一组色标可以给任意大小的图形共用，所以缓存起来一直用
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

/** 从上到下的线性渐变 */
export const vGradient = (stops: Stops) => gradient('v', stops);
/** 从左到右的线性渐变 */
export const hGradient = (stops: Stops) => gradient('h', stops);

/** 果冻圆球的透光：亮部在底部偏下，向上、向外变暗 */
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

/** 果冻上方的高光：白色，从上到下变透明 */
const SHINE: Stops = [
  [0, 'rgba(255,255,255,0.95)'],
  [1, 'rgba(255,255,255,0.2)'],
];

const patterns = new Map<string, FillPattern>();

/** 横向细条纹：2 像素浅色、2 像素深色交替 */
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

/** 只圆上方两个角的矩形路径（Aqua 窗口的外形：下方两角是直角）。画完路径再 fill / stroke。 */
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

/** 横放的果冻胶囊（推按钮）。高光在上半部，底部透光。 */
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

/** 竖放的果冻胶囊（滚动条滑块）。高光在左半部，右侧透光。 */
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

/** 果冻圆球（窗口左上角的三颗按钮），圆心在 (cx, cy) */
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

/** 窗口投影共用一个模糊滤镜：同一个滤镜可以挂在多个图形上 */
let shadowBlur: BlurFilter | null = null;

/**
 * Aqua 窗口大而柔和的投影：比窗口略向下偏，四周晕开。
 * 返回的图形左上角对齐窗口左上角，放在窗口图形下面。
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
 * 文字按 3 倍分辨率栅格化：桌面整体放大 1.25 倍、再按屏幕缩放，默认分辨率会糊。
 */
const TEXT_RESOLUTION = 3;

export interface AquaTextOptions {
  size: number;
  bold?: boolean;
  color?: string;
  /** 自动换行的宽度；不传则不换行 */
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
      // 没给的项不写进样式，避免用 undefined 盖掉 PixiJS 的默认值
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
