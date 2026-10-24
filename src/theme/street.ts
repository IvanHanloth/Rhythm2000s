// 街区大厅（doc/hub.md）的颜色：黄昏的 2000 年代街道。第一版占位，未经设计评审。
// 设计系统提案里还没有大厅的 token，以后补进提案时两边一起改。

export const STREET_COLORS = {
  /** 雾；HDRI 天空下载完成前也用它当背景 */
  fog: '#7a5878',
  /** 环境光：天空一侧、地面一侧 */
  ambientSky: '#b7a6e0',
  ambientGround: '#4a3a40',
  /** 落日 */
  sun: '#ffb070',
  /** 路灯、店里的灯 */
  lampWarm: '#ffd59a',
  lampCool: '#d8f0ff',
  neonPink: '#ff4fa3',
  neonCyan: '#3fe8ff',
  neonPurple: '#9a5cff',
  roadLine: '#e8e2c8',

  /** 楼面 */
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
  /** 招牌底色 */
  signRed: '#c8241e',
  signBlue: '#1f4fa8',
  signYellow: '#ffd23a',
  signGreen: '#1f8a4c',
  signText: '#ffffff',
  /** 角色 */
  skin: '#f0c8a0',
  hair: '#2a211c',
  /** 玩家角色：DeepSeek 鲸鱼娘（2026-10-24 用户指定），主色取 DeepSeek 的品牌蓝 */
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
  /** 半透明一体机外壳 */
  imacShell: '#2ab3c9',
  /** 可以开始关卡的电脑上方的提示标记 */
  marker: '#f2b705',
};
