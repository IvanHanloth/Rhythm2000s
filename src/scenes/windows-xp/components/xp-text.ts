// XP 界面文字。参照英文版 XP：界面字体是 Tahoma 8 磅（12 像素），标题栏是 Trebuchet MS 粗体。
// Tahoma 由 assets.ts 从本地素材加载，Trebuchet MS 用系统里装的；后面的中文字体只是兜底。

import { Text, type TextStyleOptions } from 'pixi.js';
import { LUNA } from '@/theme/xp-luna.ts';

/** 从 assets/reference/windows-xp/fonts/ 加载的 Tahoma，起个独立的名字，避免和系统里的 Tahoma 混淆 */
export const XP_FONT_FAMILY = 'XP Tahoma';

export const XP_FONTS = {
  ui: [XP_FONT_FAMILY, 'SimSun', 'Microsoft YaHei', 'PingFang SC', 'sans-serif'],
  caption: ['Trebuchet MS', XP_FONT_FAMILY, 'SimSun', 'Microsoft YaHei', 'sans-serif'],
};

/** 界面正文字号（像素） */
export const XP_FONT_SIZE = 12;

/**
 * 部件按原版像素尺寸绘制，再随桌面和画布一起放大；
 * 文字按更高的分辨率栅格化，放大后才不发虚。
 */
const TEXT_RESOLUTION = Math.max(2, Math.ceil((globalThis.devicePixelRatio || 1) * 2));

export function xpText(text: string, style: TextStyleOptions = {}): Text {
  return new Text({
    text,
    style: { fontFamily: XP_FONTS.ui, fontSize: XP_FONT_SIZE, fill: LUNA.ink, ...style },
    resolution: TEXT_RESOLUTION,
  });
}

/** 原版那种 1 像素、不模糊、向右下偏移的文字阴影 */
export function hardShadow(color: string, distance = 1) {
  return { color, alpha: 1, blur: 0, distance: Math.SQRT2 * distance, angle: Math.PI / 4 };
}
