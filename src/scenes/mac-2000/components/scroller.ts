// 竖向滚动条（NSScroller）：15 像素宽。滑块是果冻胶囊，窗口活动时蓝色、非活动时白色；
// 上下箭头按原版默认设置并排放在底部。

import { Graphics } from 'pixi.js';
import { AQUA } from '@/theme/aqua.ts';
import { drawGelThumb, hGradient } from './paint.ts';

export const SCROLLER_WIDTH = 15;
const ARROW = 15;
const THUMB_MIN = 20;

export interface ScrollerOptions {
  height: number;
  /** 滑块顶端在滑轨里的位置，0–1 */
  thumbStart: number;
  /** 滑块长度占滑轨的比例，0–1（可见内容 / 全部内容） */
  thumbSize: number;
  active: boolean;
}

/** 画一根竖向滚动条，左上角在 (0, 0) */
export function drawScroller({ height, thumbStart, thumbSize, active }: ScrollerOptions): Graphics {
  const { trackDark, trackLight, trackEdge, arrow } = AQUA.scroller;
  const trackHeight = height - ARROW * 2;
  const g = new Graphics({ label: 'scroller' });

  // 滑轨：左暗右亮的凹槽
  g.rect(0, 0, SCROLLER_WIDTH, trackHeight).fill(
    hGradient([
      [0, trackDark],
      [0.4, trackLight],
      [1, trackLight],
    ]),
  );

  // 滑块
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

  // 底部并排的上、下箭头按钮
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

  // 和内容区之间的分隔线
  g.rect(0, 0, 1, height).fill(trackEdge);
  return g;
}
