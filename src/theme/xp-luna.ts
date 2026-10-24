// Windows XP Luna（蓝色）主题的原版配色，用于贴近原版的 XP 界面部件（ADR 0004、doc/scenes/windows-xp.md）。
// 本地没有 luna.msstyles 位图，颜色按原版截图和常见的 Luna 复刻样式整理，渐变写成 [位置 0～1, 颜色] 列表。
// 与 tokens.ts 的 THEMES.xp（设计系统提案）分开：那一套仍给轮次横幅等游戏界面用。

export type GradientStops = readonly (readonly [offset: number, color: string])[];

export const LUNA = {
  /** 窗口底色、按钮面（「3D 对象」颜色） */
  face: '#ece9d8',
  ink: '#000000',
  inkDisabled: '#aca899',
  white: '#ffffff',
  /** 3D 边框：亮边、阴影、深阴影（Luna 的 ButtonHighlight / ButtonShadow / ButtonDkShadow） */
  edgeHighlight: '#ffffff',
  edgeShadow: '#aca899',
  edgeDarkShadow: '#716f64',
  /** 选中项、菜单高亮的蓝底 */
  selection: '#316ac5',
  /** 文本框、复选框等控件的边框 */
  controlBorder: '#1c5180',
  /** 桌面图标文字的阴影 */
  desktopTextShadow: '#000000',

  window: {
    caption: [
      [0, '#0997ff'],
      [0.08, '#0053ee'],
      [0.4, '#0050ee'],
      [0.88, '#0066ff'],
      [0.93, '#0066ff'],
      [0.95, '#005bff'],
      [0.96, '#003dd7'],
      [1, '#003dd7'],
    ] as GradientStops,
    captionInactive: [
      [0, '#a6baf0'],
      [0.08, '#7f9be6'],
      [0.4, '#7a96df'],
      [0.88, '#8aa5ea'],
      [0.95, '#7e9ae2'],
      [1, '#6f8bd6'],
    ] as GradientStops,
    captionText: '#ffffff',
    captionTextShadow: '#0f1089',
    captionTextInactive: '#d8e4f8',
    /** 标题栏上沿、左沿的亮边 */
    captionEdgeLight: '#0831d9',
    captionEdgeLightInactive: '#9fb4ea',
    /** 边框三圈，从外到内：左上方向、右下方向各一组 */
    frameLight: ['#0831d9', '#166aee', '#0855dd'],
    frameDark: ['#00138c', '#001ea0', '#003bda'],
    frameLightInactive: ['#8ea6e6', '#a6baf0', '#9fb4ea'],
    frameDarkInactive: ['#6077c0', '#6b85cf', '#7a96df'],
  },

  closeButton: {
    border: '#ffffff',
    fill: [
      [0, '#f0a589'],
      [0.25, '#e4704f'],
      [0.6, '#d5462a'],
      [1, '#c1351a'],
    ] as GradientStops,
    glyph: '#ffffff',
  },

  button: {
    border: '#003c74',
    fill: [
      [0, '#ffffff'],
      [0.86, '#ecebe6'],
      [1, '#d6d0c5'],
    ] as GradientStops,
    pressedFill: [
      [0, '#cdcac3'],
      [0.08, '#e3e3db'],
      [0.94, '#e5e4de'],
      [1, '#f2f1ec'],
    ] as GradientStops,
    /** 默认按钮（回车键对应的按钮）的蓝色内框：内圈 1、内圈 2，各为 上、左右、下 */
    defaultRings: [
      ['#cee7ff', '#bcd4f6', '#89ade4'],
      ['#bcd4f6', '#98b8ea', '#89ade4'],
    ],
    /** 鼠标悬停的橙色内框 */
    hotRings: [
      ['#fff0cf', '#fbc761', '#e5a01a'],
      ['#fdd889', '#fbc761', '#e5a01a'],
    ],
  },

  checkbox: {
    border: '#1c5180',
    fill: [
      [0, '#dcdcd7'],
      [1, '#ffffff'],
    ] as GradientStops,
    check: '#21a121',
  },

  trackbar: {
    channelFill: '#f4f3ee',
    channelDark: '#9d9c99',
    channelLight: '#ffffff',
    tick: '#a1a192',
    thumbBorder: '#7f9db9',
    thumbBorderHot: '#e5a01a',
    thumbFill: [
      [0, '#ffffff'],
      [0.7, '#f1f0ea'],
      [1, '#d9d8cf'],
    ] as GradientStops,
  },

  taskbar: {
    fill: [
      [0, '#1f2f86'],
      [0.03, '#3165c4'],
      [0.06, '#3682e5'],
      [0.1, '#4490e6'],
      [0.12, '#3883e5'],
      [0.15, '#2b71e0'],
      [0.18, '#2663da'],
      [0.2, '#235bd6'],
      [0.23, '#2258d5'],
      [0.38, '#2157d6'],
      [0.54, '#245ddb'],
      [0.86, '#2562df'],
      [0.89, '#245fdc'],
      [0.92, '#2158d4'],
      [0.95, '#1d4ec0'],
      [1, '#1941a5'],
    ] as GradientStops,
    trayFill: [
      [0, '#0c59b9'],
      [0.06, '#139ee9'],
      [0.1, '#18b5f2'],
      [0.14, '#139beb'],
      [0.19, '#1290e8'],
      [0.63, '#0d8dea'],
      [0.81, '#0d9ff1'],
      [0.88, '#0f9eed'],
      [0.91, '#119be9'],
      [0.94, '#1392e2'],
      [0.97, '#137ed7'],
      [1, '#095bc9'],
    ] as GradientStops,
    trayBorder: '#1042af',
    trayHighlight: '#18bbff',
    text: '#ffffff',
  },

  startButton: {
    fill: [
      [0, '#3c8f3c'],
      [0.06, '#6cc16c'],
      [0.14, '#55b455'],
      [0.45, '#40a53f'],
      [0.8, '#36963a'],
      [0.94, '#2f8732'],
      [1, '#1f6a22'],
    ] as GradientStops,
    /** 右侧弧边的深色描边 */
    edge: '#1d5f1d',
    text: '#ffffff',
    textShadow: '#184d18',
  },

  /** Windows 旗帜四格：左上红、右上绿、左下蓝、右下黄 */
  flag: ['#f35b22', '#7cbc1f', '#1d9be6', '#fdbb12'],

  startMenu: {
    header: [
      [0, '#1868ce'],
      [0.12, '#0e60cb'],
      [0.2, '#0e60cb'],
      [0.32, '#1164cf'],
      [0.33, '#1667cf'],
      [0.47, '#1b6cd3'],
      [0.54, '#1e70d9'],
      [0.6, '#2476dc'],
      [0.65, '#297ae0'],
      [0.77, '#3482e3'],
      [0.79, '#3786e5'],
      [0.9, '#428ee9'],
      [1, '#4791eb'],
    ] as GradientStops,
    footer: [
      [0, '#4282d6'],
      [0.03, '#3b85e0'],
      [0.05, '#418ae3'],
      [0.17, '#418ae3'],
      [0.21, '#3c87e2'],
      [0.26, '#3786e4'],
      [0.29, '#3482e3'],
      [0.39, '#2e7ee1'],
      [0.49, '#2374df'],
      [0.57, '#2072db'],
      [0.62, '#196edb'],
      [0.72, '#176bd8'],
      [0.75, '#1468d8'],
      [0.83, '#1165d4'],
      [1, '#0f61cb'],
    ] as GradientStops,
    /** 用户栏下方的橙色分隔线（中间最亮，两端透明） */
    accentLine: [
      [0, '#da884a00'],
      [0.5, '#da884aff'],
      [1, '#da884a00'],
    ] as GradientStops,
    frame: '#3a6fd0',
    left: '#ffffff',
    right: '#d3e5fa',
    rightBorder: '#95bdee',
    leftSeparator: [
      [0, '#00000000'],
      [0.5, '#0000001f'],
      [1, '#00000000'],
    ] as GradientStops,
    rightSeparator: [
      [0, '#87b3e200'],
      [0.5, '#87b3e2ff'],
      [1, '#87b3e200'],
    ] as GradientStops,
    subtitle: '#8d8d8d',
    rightText: '#0a246a',
    headerText: '#ffffff',
    headerTextShadow: '#00000099',
    footerHot: '#ffffff33',
    allProgramsArrow: [
      [0, '#7bd97b'],
      [0.5, '#35a235'],
      [1, '#257d25'],
    ] as GradientStops,
  },

  /** 信息提示（气泡、工具提示）的浅黄底 */
  tooltip: {
    fill: '#ffffe1',
    border: '#000000',
  },

  /** 托盘小喇叭图标（本地没有原版图标，矢量绘制） */
  speaker: {
    body: '#dcdcdc',
    outline: '#3b3b3b',
    wave: '#ffffff',
    mute: '#e0301e',
  },
} as const;
