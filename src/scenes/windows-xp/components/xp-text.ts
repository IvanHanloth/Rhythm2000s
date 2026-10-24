// XP interface text, after English XP: Tahoma 8 pt (12 px) for the UI, Trebuchet MS bold for title bars.
// Tahoma is loaded from the local assets by assets.ts; Trebuchet MS comes from the system.

import { Text, type TextStyleOptions } from 'pixi.js';
import { LUNA } from '@/theme/xp-luna.ts';

/** Tahoma from assets/reference/windows-xp/fonts/, under its own name so it can't be confused with a system Tahoma */
export const XP_FONT_FAMILY = 'XP Tahoma';

export const XP_FONTS = {
  ui: [XP_FONT_FAMILY, 'sans-serif'],
  caption: ['Trebuchet MS', XP_FONT_FAMILY, 'sans-serif'],
};

/** UI text size (px) */
export const XP_FONT_SIZE = 12;

/**
 * Widgets are drawn at original pixel size and scaled up with the desktop and canvas,
 * so text is rasterised at a higher resolution to stay sharp.
 */
const TEXT_RESOLUTION = Math.max(2, Math.ceil((globalThis.devicePixelRatio || 1) * 2));

export function xpText(text: string, style: TextStyleOptions = {}): Text {
  return new Text({
    text,
    style: { fontFamily: XP_FONTS.ui, fontSize: XP_FONT_SIZE, fill: LUNA.ink, ...style },
    resolution: TEXT_RESOLUTION,
  });
}

/** The original's 1 px, unblurred text shadow, offset down and right */
export function hardShadow(color: string, distance = 1) {
  return { color, alpha: 1, blur: 0, distance: Math.SQRT2 * distance, angle: Math.PI / 4 };
}
