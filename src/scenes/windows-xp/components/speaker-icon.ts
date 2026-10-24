// 托盘的 16×16 小喇叭（音量）图标。本地没有原版图标，按原版样子矢量绘制：
// 灰白喇叭、深色描边、右侧两道声波；静音时右下角是红色禁止符号。

import type { Graphics } from 'pixi.js';
import { LUNA } from '../../../theme/xp-luna.ts';

export function drawSpeakerIcon(g: Graphics, muted: boolean): Graphics {
  const c = LUNA.speaker;
  // 喇叭：左边方形磁体 + 向右张开的喇叭口
  g.moveTo(1.5, 5.5)
    .lineTo(4.5, 5.5)
    .lineTo(8.5, 2)
    .lineTo(8.5, 14)
    .lineTo(4.5, 10.5)
    .lineTo(1.5, 10.5)
    .closePath()
    .fill(c.body)
    .stroke({ width: 1, color: c.outline, join: 'round' });

  if (muted) {
    g.circle(12, 11, 3.5).fill(c.mute).stroke({ width: 1, color: '#ffffff' });
    g.moveTo(9.8, 13.2).lineTo(14.2, 8.8).stroke({ width: 1.2, color: '#ffffff' });
    return g;
  }

  for (const [radius, alpha] of [
    [3.5, 1],
    [6, 0.9],
  ] as const) {
    g.arc(8.5, 8, radius, -Math.PI / 3.2, Math.PI / 3.2).stroke({
      width: 2.2,
      color: c.outline,
      alpha: 0.45 * alpha,
      cap: 'round',
    });
    g.arc(8.5, 8, radius, -Math.PI / 3.2, Math.PI / 3.2).stroke({
      width: 1.1,
      color: c.wave,
      alpha,
      cap: 'round',
    });
  }
  return g;
}
