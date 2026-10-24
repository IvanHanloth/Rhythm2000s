// Scene theme colours from the design-system proposal's tokens.json (2026-10-24 version, not final):
// https://claude.ai/artifact/YTAfdQKAfiofe7o2vbNz5K
// Usage of each token is described in the proposal; only the values live here. The proposal is the source of truth; change both together.
// The proposal's Mac Platinum theme is unused for now (ADR 0002); add it from the proposal when needed.

export type ThemeId = 'xp' | 'aqua';

export interface ThemeColors {
  desktop: string;
  desktopHorizon: string;
  surface: string;
  surfaceAlt: string;
  surfaceRaised: string;
  ink: string;
  inkMuted: string;
  line: string;
  lineSoft: string;
  highlight: string;
  titlebar: string;
  titlebarHi: string;
  onTitlebar: string;
  titlebarInactive: string;
  onTitlebarInactive: string;
  accent: string;
  onAccent: string;
  hot: string;
  focus: string;
  ctlClose: string;
  ctlMin: string;
  ctlZoom: string;
  onCtl: string;
}

export const THEMES: Record<ThemeId, ThemeColors> = {
  xp: {
    desktop: '#2f6fd0',
    desktopHorizon: '#4b9a2c',
    surface: '#ece9d8',
    surfaceAlt: '#e3dfc8',
    surfaceRaised: '#fbfaf4',
    ink: '#1b1b1b',
    inkMuted: '#57533f',
    line: '#1f4a8a',
    lineSoft: '#aca899',
    highlight: '#ffffff',
    titlebar: '#0a52c8',
    titlebarHi: '#2a6fdc',
    onTitlebar: '#ffffff',
    titlebarInactive: '#8aa6e0',
    onTitlebarInactive: '#1b2f5c',
    accent: '#2f5fc0',
    onAccent: '#ffffff',
    hot: '#e39b2b',
    focus: '#0b2f6e',
    ctlClose: '#c7432b',
    ctlMin: '#2a68dc',
    ctlZoom: '#2a68dc',
    onCtl: '#ffffff',
  },
  aqua: {
    desktop: '#2c5fa8',
    desktopHorizon: '#1d4785',
    surface: '#ececec',
    surfaceAlt: '#f5f5f5',
    surfaceRaised: '#ffffff',
    ink: '#111111',
    inkMuted: '#595959',
    line: '#767676',
    lineSoft: '#b5b5b5',
    highlight: '#ffffff',
    titlebar: '#d6d6d6',
    titlebarHi: '#f7f7f7',
    onTitlebar: '#111111',
    titlebarInactive: '#ededed',
    onTitlebarInactive: '#636363',
    accent: '#1d5fd0',
    onAccent: '#ffffff',
    hot: '#5c9cf5',
    focus: '#1d5fd0',
    ctlClose: '#e0443e',
    ctlMin: '#e2a51c',
    ctlZoom: '#3aa437',
    onCtl: '#3a0d00',
  },
};

/** Font families. Font files aren't loaded yet, so they fall back to system fonts for now (ADR 0002). */
export const FONT_FAMILIES = {
  ui: ['PT Sans', 'Noto Sans SC', 'sans-serif'],
  display: ['Baloo 2', 'Noto Sans SC', 'sans-serif'],
  pixel: ['Pixelify Sans', 'Noto Sans SC', 'monospace'],
};

/** Joins a font list into a CSS font-family value, quoting names (unquoted, "Baloo 2" invalidates the whole declaration) */
export function cssFontFamily(families: readonly string[]): string {
  const generic = new Set(['serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui']);
  return families.map((f) => (generic.has(f) ? f : `"${f}"`)).join(', ');
}

/** Judgement colours, shared by every theme so feedback is consistent across scenes. on-* is the text colour on each */
export const JUDGEMENT_COLORS = {
  perfect: '#f2b705',
  onPerfect: '#1b1b1b',
  good: '#2f6fd6',
  onGood: '#ffffff',
  miss: '#a8281f',
  onMiss: '#ffffff',
};

/**
 * 律动组件（doc/beat-guide.md）的颜色，各主题共用。press 和 Perfect 同一种黄色。
 * 设计系统提案里还没有这个组件，先定在这里，提案补上后两边一起改。
 */
export const BEAT_GUIDE_COLORS = {
  /** 平常的弧 */
  idle: '#a6a6a6',
  /** 要按的拍的弧，和中间圆的闪光 */
  press: JUDGEMENT_COLORS.perfect,
  /** 中间的圆 */
  core: '#ffffff',
};

/** Animation durations in beats. Multiplied by the song's beat length at runtime, positions computed from the audio clock */
export const BEATS = {
  /** Window pop-up, completing on the target beat */
  windowOpen: 0.25,
  /** Window close */
  windowClose: 0.125,
  /** Squash-and-bounce on a hit */
  squash: 0.125,
  /** How long a judgement word stays */
  judgementHold: 1,
};
