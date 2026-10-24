// 绘制 Luna 部件的小工具：渐变缓存、按边上色的 1 像素边框。

import { FillGradient, type Graphics } from 'pixi.js';
import type { GradientStops } from '@/theme/xp-luna.ts';

const vertical = new Map<GradientStops, FillGradient>();
const horizontal = new Map<GradientStops, FillGradient>();

/**
 * 从上到下的渐变，相对于被填充图形的外框。
 * 同一组色标只建一次，所有部件共用，不随部件销毁。
 */
export function verticalGradient(stops: GradientStops): FillGradient {
  let gradient = vertical.get(stops);
  if (!gradient) {
    gradient = createGradient(stops, { x: 0, y: 1 });
    vertical.set(stops, gradient);
  }
  return gradient;
}

/** 从左到右的渐变，用法同 verticalGradient */
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

/** 在 (x, y, w, h) 的内侧画一圈 1 像素的线，四条边各自上色（模仿 CSS 的 inset box-shadow）。 */
export function edgeRing(g: Graphics, x: number, y: number, w: number, h: number, c: EdgeColors) {
  g.rect(x, y, w, 1).fill(c.top);
  g.rect(x, y + h - 1, w, 1).fill(c.bottom);
  g.rect(x, y + 1, 1, h - 2).fill(c.left);
  g.rect(x + w - 1, y + 1, 1, h - 2).fill(c.right);
}

/** 只圆上方两个角的矩形路径（窗口标题栏、开始菜单顶部） */
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
