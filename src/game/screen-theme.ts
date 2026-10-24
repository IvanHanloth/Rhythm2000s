// Level intro colours follow the scene: Luna for XP levels, Aqua for Mac levels (ADR 0004).
// Colours come only from src/theme, injected as CSS variables (--screen-*); screens.css only references the variables.

import { AQUA, AQUA_FONT } from '@/theme/aqua.ts';
import { cssFontFamily, FONT_FAMILIES, JUDGEMENT_COLORS } from '@/theme/tokens.ts';
import { LUNA } from '@/theme/xp-luna.ts';
import type { SceneId } from '@/scenes/catalog.ts';

export type ScreenTheme = 'xp' | 'aqua';

const SCENE_THEMES: Record<SceneId, ScreenTheme> = { 'windows-xp': 'xp', 'mac-2000': 'aqua' };

export function screenThemeFor(sceneId: SceneId): ScreenTheme {
  return SCENE_THEMES[sceneId];
}

function gradient(stops: readonly (readonly [number, string])[]): string {
  return `linear-gradient(${stops.map(([at, color]) => `${color} ${at * 100}%`).join(', ')})`;
}

const SHARED: Record<string, string> = {
  '--screen-good': JUDGEMENT_COLORS.good,
  '--screen-font-display': cssFontFamily(FONT_FAMILIES.display),
  // How-to-play uses the XP yellow tooltip in both themes
  '--screen-tip': LUNA.tooltip.fill,
  '--screen-tip-edge': LUNA.tooltip.border,
};

const THEME_VARS: Record<ScreenTheme, Record<string, string>> = {
  xp: {
    '--screen-font': cssFontFamily(['Tahoma', ...FONT_FAMILIES.ui]),
    '--screen-face': LUNA.face,
    '--screen-ink': LUNA.ink,
    '--screen-ink-soft': LUNA.edgeDarkShadow,
    '--screen-line': LUNA.edgeShadow,
    '--screen-panel': LUNA.white,
    '--screen-caption': gradient(LUNA.window.caption),
    '--screen-caption-ink': LUNA.window.captionText,
    '--screen-frame': LUNA.window.captionEdgeLight,
    '--screen-accent': LUNA.selection,
    '--screen-button': `linear-gradient(${LUNA.white}, ${LUNA.face})`,
    '--screen-button-ink': LUNA.ink,
    '--screen-button-edge': LUNA.button.border,
    '--screen-primary': gradient(LUNA.window.caption),
    '--screen-primary-ink': LUNA.window.captionText,
    '--screen-radius': '8px 8px 0 0',
    '--screen-button-radius': '3px',
  },
  aqua: {
    '--screen-font': cssFontFamily(AQUA_FONT),
    '--screen-face': `repeating-linear-gradient(${AQUA.stripe.light} 0 2px, ${AQUA.stripe.dark} 2px 4px)`,
    '--screen-ink': AQUA.ink,
    '--screen-ink-soft': AQUA.inkSoft,
    '--screen-line': AQUA.separator,
    '--screen-panel': AQUA.white,
    '--screen-caption': `repeating-linear-gradient(${AQUA.titleStripe.light} 0 2px, ${AQUA.titleStripe.dark} 2px 4px)`,
    '--screen-caption-ink': AQUA.ink,
    '--screen-frame': AQUA.windowEdge,
    '--screen-accent': AQUA.selection,
    '--screen-button': `linear-gradient(${AQUA.gel.white.glow}, ${AQUA.gel.white.mid} 50%, ${AQUA.gel.white.top} 51%, ${AQUA.gel.white.glow})`,
    '--screen-button-ink': AQUA.ink,
    '--screen-button-edge': AQUA.gel.white.rim,
    '--screen-primary': `linear-gradient(${AQUA.gel.blue.glow}, ${AQUA.gel.blue.mid} 50%, ${AQUA.gel.blue.top} 51%, ${AQUA.gel.blue.glow})`,
    '--screen-primary-ink': AQUA.ink,
    '--screen-radius': '8px',
    '--screen-button-radius': '999px',
  },
};

/** Applies a scene's colours to a UI root element */
export function applyScreenTheme(element: HTMLElement, theme: ScreenTheme): void {
  element.dataset.theme = theme;
  for (const [name, value] of Object.entries({ ...SHARED, ...THEME_VARS[theme] })) {
    element.style.setProperty(name, value);
  }
}
