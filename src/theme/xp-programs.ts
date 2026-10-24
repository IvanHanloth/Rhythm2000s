// Colours inside XP's bundled programs: Notepad, Paint, Internet Explorer, Minesweeper. Window frames and system controls are in xp-luna.ts.
// Used by the program windows that window-minimize opens (doc/scenes/windows-xp-levels.md).

export const XP_PROGRAMS = {
  /** White behind editors, web pages and the canvas */
  paper: '#ffffff',
  /** Sunken border of editors and the address bar */
  sunkenEdge: '#7f9db9',
  /** Hyperlinks in Internet Explorer pages */
  link: '#0000ff',
  /** Minesweeper keeps the Windows Classic colours */
  minesweeper: {
    face: '#c0c0c0',
    light: '#ffffff',
    shadow: '#808080',
    counter: '#000000',
    digit: '#ff0000',
    smiley: '#ffff00',
    smileyInk: '#000000',
  },
  /** Paint's palette (the first row of the classic 28) and the doodle on the canvas */
  paint: {
    palette: [
      '#000000',
      '#808080',
      '#800000',
      '#808000',
      '#008000',
      '#008080',
      '#000080',
      '#800080',
      '#ffffff',
      '#c0c0c0',
      '#ff0000',
      '#ffff00',
      '#00ff00',
      '#00ffff',
    ],
    sun: '#ffd800',
    grass: '#3aa63a',
    sky: '#3a7bd5',
  },
} as const;
