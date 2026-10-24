// 场景主题颜色，取自设计系统提案的 tokens.json（2026-10-24 版本，未定稿）：
// https://claude.ai/artifact/YTAfdQKAfiofe7o2vbNz5K
// 每个 token 的用法说明见提案；这里只保留颜色值。改颜色时以提案为准，两边一起改。
// 提案里的 Mac 铂金主题暂不使用（ADR 0002），需要时再从提案里加进来。

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

/** 字体族。字体文件尚未加载，暂时会落到系统字体（ADR 0002）。 */
export const FONT_FAMILIES = {
  ui: ['PT Sans', 'Noto Sans SC', 'sans-serif'],
  display: ['Baloo 2', 'Noto Sans SC', 'sans-serif'],
  pixel: ['Pixelify Sans', 'Noto Sans SC', 'monospace'],
};

/** 字体列表拼成 CSS 的 font-family 值：名字里有空格或数字的要加引号（不加时「Baloo 2」会让整条声明失效） */
export function cssFontFamily(families: readonly string[]): string {
  const generic = new Set(['serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui']);
  return families.map((f) => (generic.has(f) ? f : `"${f}"`)).join(', ');
}

/** 判定颜色：三套主题共用，保证判定反馈跨场景一致。on-* 是落在对应底色上的文字颜色 */
export const JUDGEMENT_COLORS = {
  perfect: '#f2b705',
  onPerfect: '#1b1b1b',
  good: '#2f6fd6',
  onGood: '#ffffff',
  miss: '#a8281f',
  onMiss: '#ffffff',
};

/** 动画时长，单位是拍。运行时乘以当前曲子的拍长，并按音频时钟计算每帧位置 */
export const BEATS = {
  /** 窗口弹出，在目标拍点完成 */
  windowOpen: 0.25,
  /** 窗口关闭 */
  windowClose: 0.125,
  /** 命中时的挤压回弹 */
  squash: 0.125,
  /** 判定字样停留时长 */
  judgementHold: 1,
};
