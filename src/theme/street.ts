// Colours of the street hub (doc/hub.md): a bright, dreamcore daytime British high street (user request, 2026-10-24). First pass, not design-reviewed.
// The design-system proposal has no hub tokens yet; when they are added, change both together.

export const STREET_COLORS = {
  /** Sky: saturated blue overhead, lighter lower down, pale pink-white at the horizon; warm glow around the sun */
  skyTop: '#4f9cf5',
  skyMid: '#a8d2ff',
  skyHorizon: '#fde8f2',
  skySunGlow: '#fff4d6',
  /** Distant fog: a faint pink-lilac, like dream haze */
  fog: '#dcdcf5',
  /** Ambient light: sky side, ground side */
  ambientSky: '#cfe3ff',
  ambientGround: '#f0d9c4',
  /** Sunlight: warm white */
  sun: '#fff1dc',
  /** Dreamcore grade: shadows lift toward this pastel, screen edges fade toward it */
  dreamLift: '#f3d6ea',
  dreamHaze: '#fdf3ff',
  /** Floating light motes */
  dreamMote: '#ffe9b0',
  /** Street lamps and shop lights */
  lampWarm: '#ffd59a',
  lampCool: '#d8f0ff',
  neonPink: '#ff4fa3',
  neonCyan: '#3fe8ff',
  neonPurple: '#9a5cff',
  roadLine: '#e8e2c8',

  /** Facades */
  wallCream: '#d9cfb6',
  windowLit: '#ffd98a',
  windowDark: '#2f3346',
  glass: '#9fd2e6',
  metal: '#8c9098',
  metalDark: '#4a4d55',
  wood: '#8a5a3a',
  woodLight: '#b98a5c',
  plastic: '#e3dccb',
  plasticDark: '#3a3a3e',
  trunk: '#5e4630',
  ceiling: '#e8e4d8',
  /** Sign backgrounds */
  signRed: '#c8241e',
  signBlue: '#1f4fa8',
  signYellow: '#ffd23a',
  signGreen: '#1f8a4c',
  signText: '#ffffff',
  signTextDark: '#1b1b1b',
  /** British red phone boxes, post boxes, buses */
  postRed: '#d0161e',
  /** Double yellow lines along the kerb */
  roadYellow: '#f2c230',
  /** Belisha beacons at the zebra crossing */
  beaconAmber: '#ffb31a',
  /** Characters */
  skin: '#f0c8a0',
  hair: '#2a211c',
  /** Player character: the DeepSeek whale girl (user's choice, 2026-10-24), keyed to DeepSeek's brand blue */
  whaleBlue: '#4d6bfe',
  whaleHair: '#3a55d8',
  whaleHairDark: '#2a3a9e',
  whaleBelly: '#e6ecff',
  whaleEye: '#2f5bff',
  whaleEyeDark: '#16205a',
  whaleShirt: '#fbfbff',
  whaleSkirt: '#2c44c4',
  whaleRibbon: '#8fc0ff',
  whaleSock: '#f2f4fb',
  whaleShoe: '#1e2a5a',
  blush: '#f5a3a8',
  /** Translucent all-in-one shell */
  imacShell: '#2ab3c9',
  /** Marker above computers where a level can start */
  marker: '#f2b705',
  /** The guide booklet on the café's front desk (doc/hub.md#guide-booklet): cover, paper, printed ink, the staff's red pen */
  bookletCover: '#1f4fa8',
  bookletPaper: '#fbf6e9',
  bookletInk: '#22252c',
  bookletInkMuted: '#5c6170',
  bookletPen: '#d0161e',
  /** The bars round the 16:9 level on a 4:3 CRT during chair-swivel's cutaway */
  monitorLetterbox: '#000000',
};
