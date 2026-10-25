// Colours of the arcade dance machine's screen (doc/dance-machine.md "Screen"). First pass, not design-reviewed;
// the design-system proposal has no dance machine tokens yet. The neon matches the arcade's signs (street.ts).

import { STREET_COLORS } from './street.ts';

export const DANCE_COLORS = {
  /** Screen background, top to bottom */
  backTop: '#0b0623',
  backBottom: '#24104a',
  /** The neon floor grid, pulsing on each beat */
  grid: STREET_COLORS.neonPurple,
  gridPulse: STREET_COLORS.neonCyan,
  title: STREET_COLORS.neonPink,
  titleEdge: '#ffffff',
  text: '#ffffff',
  textMuted: '#b9a9e6',
  /** Song list: the picked row */
  selected: STREET_COLORS.neonCyan,
  onSelected: '#0b0623',
  rowBack: '#1d1240',
  /** Foot rating marks */
  foot: '#ffd400',
  footOff: '#4a3d78',
  /** The four targets: outline, and the flash on a press */
  target: '#c9c3da',
  targetEdge: '#5a5470',
  targetFlash: '#ffffff',
  /** Arrows by where they fall in the beat, as on the period machines: whole, half and quarter beats */
  quarter: '#ff2d55',
  eighth: '#2d7bff',
  sixteenth: '#ffd400',
  arrowEdge: '#ffffff',
  /** The ring and spokes arrows travel along */
  guide: STREET_COLORS.neonCyan,
  /** The pad picture at the centre: metal base, centre plate, arrow panels, their arrows, a held panel */
  padBase: '#8c9098',
  padPlate: '#4a4d55',
  padPanel: '#2a2440',
  padArrow: '#ff4fa3',
  padLit: '#3fe8ff',
  /** Burst on a hit */
  burstPerfect: '#ffe46b',
  burstGood: '#7fd3ff',
  combo: '#ffffff',
  comboEdge: STREET_COLORS.neonPink,
};
