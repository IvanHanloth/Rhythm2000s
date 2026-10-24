// XP 自带程序窗口里的颜色：记事本、画图、IE、扫雷。窗口外框和系统控件的颜色在 xp-luna.ts。
// 用在 window-minimize 动作弹出的程序窗口上（doc/scenes/windows-xp-levels.md）。

export const XP_PROGRAMS = {
  /** 编辑区、网页、画布的白底 */
  paper: '#ffffff',
  /** 编辑区、地址栏的凹陷边框 */
  sunkenEdge: '#7f9db9',
  /** IE 网页里的超链接 */
  link: '#0000ff',
  /** 扫雷沿用 Windows 经典配色 */
  minesweeper: {
    face: '#c0c0c0',
    light: '#ffffff',
    shadow: '#808080',
    counter: '#000000',
    digit: '#ff0000',
    smiley: '#ffff00',
    smileyInk: '#000000',
  },
  /** 画图的调色板（经典 28 色里取前一行）和画布上的涂鸦 */
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
