// Colours and fonts for Mac OS X 10.0–10.2 (early Aqua) widgets (doc/scenes/mac-2000.md).
// The originals are bitmaps; these are approximations from screenshots, redrawn as vector gradients. The design-system
// aqua theme (tokens.ts) only has broad colours, not enough for gel buttons and pinstripes, so they live here.

/** Gel capsule (push buttons, scroller thumbs): rim, upper body, middle body, bottom glow */
export interface GelColors {
  rim: string;
  top: string;
  mid: string;
  glow: string;
}

/** Gel ball (the three window buttons): rim, dark body, bottom glow */
export interface BallColors {
  rim: string;
  dark: string;
  light: string;
}

export const AQUA = {
  /** Black text in the original UI */
  ink: '#000000',
  /** Inactive window titles, disabled text */
  inkMuted: '#7f7f7f',
  /** Captions, status bar text */
  inkSoft: '#404040',
  white: '#ffffff',
  shadow: '#000000',
  /** Desktop colour before the wallpaper loads */
  desktop: '#2c5fa8',

  /** Pinstripes behind windows and alerts: 2 px light, 2 px dark */
  stripe: { light: '#f5f5f5', dark: '#e8e8e8' },
  /** Active title bar pinstripes, higher contrast */
  titleStripe: { light: '#ffffff', dark: '#e1e1e1' },
  /** Inactive title bar pinstripes */
  titleStripeInactive: { light: '#fbfbfb', dark: '#efefef' },
  /** Menu bar pinstripes, barely visible */
  menuStripe: { light: '#ffffff', dark: '#f1f1f1' },
  /** Divider under the title bar and status bar */
  separator: '#a3a3a3',
  /** Hairline around the window */
  windowEdge: '#6e6e6e',

  /** Blue behind selected items in Finder */
  selection: '#3875d7',

  gel: {
    /** Default button, active window scroller thumb */
    blue: { rim: '#163f94', top: '#1b56c4', mid: '#3a82ec', glow: '#9fdcff' } satisfies GelColors,
    /** Normal buttons, inactive window scroller thumb */
    white: { rim: '#8b8b8b', top: '#d2d2d2', mid: '#e6e6e6', glow: '#ffffff' } satisfies GelColors,
  },

  /** The three buttons at the top left of a window */
  lights: {
    close: { rim: '#8a1a10', dark: '#c4291c', light: '#ffa184' } satisfies BallColors,
    minimize: { rim: '#8c5a00', dark: '#cf8d0a', light: '#ffe887' } satisfies BallColors,
    zoom: { rim: '#2a6512', dark: '#3a9620', light: '#b6f47e' } satisfies BallColors,
    /** All three turn this colour on inactive windows */
    inactive: { rim: '#8c8c8c', dark: '#b4b4b4', light: '#f2f2f2' } satisfies BallColors,
  },

  /** Blue apple at the top left of the menu bar */
  apple: { rim: '#0f3c8e', top: '#64aef7', bottom: '#1450c0' },

  scroller: {
    /** Track: dark on the left, light on the right */
    trackDark: '#c9c9c9',
    trackLight: '#fbfbfb',
    trackEdge: '#9d9d9d',
    /** Little triangles in the arrow buttons */
    arrow: '#2b2b2b',
  },

  dock: {
    /** Translucent white; opacity in dock.ts */
    fill: '#ffffff',
    edge: '#ffffff',
    /** Triangle under running applications */
    indicator: '#000000',
  },
  /** Red unread badge on Dock icons */
  badge: { top: '#f0573f', bottom: '#c51b0e' },
  /** Yellow triangle on caution alerts */
  caution: { rim: '#8a6000', top: '#ffe35a', bottom: '#f3a600', mark: '#000000' },

  /** Finder face icon */
  finder: {
    light: '#bfe5ff',
    lightEdge: '#82c3f6',
    dark: '#3d8fee',
    darkEdge: '#0f4fb8',
    face: '#0b2754',
  },
  /** Trash (wire basket); paper is the crumpled paper showing in the basket when it is full */
  trash: {
    light: '#eef2f6',
    dark: '#98a3ae',
    wire: '#6c7783',
    inside: '#3e4650',
    paper: '#fbfbf7',
    paperShade: '#c9ccd0',
  },

  /** Drop-down menu (NSMenu): slightly translucent white; the item under the mouse is blue gel */
  menu: {
    alpha: 0.95,
    edge: '#8a8a8a',
    separator: '#d2d2d2',
    disabled: '#9a9a9a',
    highlightTop: '#6aa6f5',
    highlightBottom: '#1d5fd6',
  },

  /** Arrow pointer: black arrow, white outline */
  cursor: { fill: '#000000', outline: '#ffffff' },

  /** Desktop document icon (white page, folded corner) and folder (blue) */
  document: { paper: '#ffffff', fold: '#d9dde3', edge: '#8c929a' },
  folder: { top: '#a9d1ff', bottom: '#4d8fe6', tab: '#7fb4f6', edge: '#2f69bf' },
  /** White file name under desktop icons and its shadow */
  desktopLabel: { text: '#ffffff', shadow: '#000000' },

  /** iChat 1.0 speech bubble: light blue gradient, slightly darker edge */
  chatBubble: { top: '#e3f0ff', bottom: '#b9d6fb', edge: '#7da5d8' },

  /** Sliders (volume menu, settings window): grey groove, blue gel knob */
  slider: {
    trackDark: '#9a9a9a',
    trackLight: '#dcdcdc',
    knob: { rim: '#163f94', dark: '#2f6fe0', light: '#bfe6ff' } satisfies BallColors,
  },
};

/** UI font: Lucida Grande is the original; on Windows, the related Lucida Sans Unicode. */
export const AQUA_FONT = ['Lucida Grande', 'Lucida Sans Unicode', 'Lucida Sans', 'sans-serif'];
