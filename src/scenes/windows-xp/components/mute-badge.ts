// 托盘小喇叭静音时右下角的红色禁止符号，画在 speaker.png 上面（16×16 的图标坐标）。

import type { Graphics } from 'pixi.js';
import { LUNA } from '@/theme/xp-luna.ts';

export function drawMuteBadge(g: Graphics): Graphics {
  return g
    .circle(12, 11.5, 3.6)
    .fill(LUNA.speaker.mute)
    .stroke({ width: 1, color: '#ffffff' })
    .moveTo(9.7, 13.8)
    .lineTo(14.3, 9.2)
    .stroke({ width: 1.2, color: '#ffffff' });
}
