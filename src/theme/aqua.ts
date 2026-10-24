// Mac OS X 10.0–10.2（早期 Aqua）界面部件的颜色与字体（doc/scenes/mac-2000.md）。
// 原版是位图，这里按截图估出近似值，用渐变矢量重画。设计系统提案里的 aqua 主题（tokens.ts）只有
// 大类颜色，不够画果冻按钮和细条纹，所以单独放在这里。

/** 果冻胶囊（推按钮、滚动条滑块）的配色：外圈、主体上部、主体中部、底部透光 */
export interface GelColors {
  rim: string;
  top: string;
  mid: string;
  glow: string;
}

/** 果冻圆球（窗口左上角的三颗按钮）的配色：外圈、主体暗部、底部透光 */
export interface BallColors {
  rim: string;
  dark: string;
  light: string;
}

export const AQUA = {
  /** 原版界面里的黑字 */
  ink: '#000000',
  /** 非活动窗口的标题、灰掉的文字 */
  inkMuted: '#7f7f7f',
  /** 说明文字、状态栏文字 */
  inkSoft: '#404040',
  white: '#ffffff',
  shadow: '#000000',
  /** 壁纸加载出来之前的桌面底色 */
  desktop: '#2c5fa8',

  /** 窗口、提示框背景的细条纹：2 像素浅、2 像素深 */
  stripe: { light: '#f5f5f5', dark: '#e8e8e8' },
  /** 活动窗口标题栏的细条纹，对比更强 */
  titleStripe: { light: '#ffffff', dark: '#e1e1e1' },
  /** 非活动窗口标题栏的细条纹 */
  titleStripeInactive: { light: '#fbfbfb', dark: '#efefef' },
  /** 菜单栏的细条纹，几乎看不出来 */
  menuStripe: { light: '#ffffff', dark: '#f1f1f1' },
  /** 标题栏、状态栏下沿的分隔线 */
  separator: '#a3a3a3',
  /** 窗口外缘的细线 */
  windowEdge: '#6e6e6e',

  /** Finder 里选中项的蓝底 */
  selection: '#3875d7',
  /** 列表视图的列标题：普通列是白色渐变，排序所在的列是浅蓝果冻 */
  listHeader: { top: '#ffffff', bottom: '#dadada', edge: '#a2a2a2' },
  listHeaderSorted: { top: '#d3e6fc', bottom: '#86b6ee' },

  gel: {
    /** 默认按钮、活动窗口的滚动条滑块 */
    blue: { rim: '#163f94', top: '#1b56c4', mid: '#3a82ec', glow: '#9fdcff' } satisfies GelColors,
    /** 普通按钮、非活动窗口的滚动条滑块 */
    white: { rim: '#8b8b8b', top: '#d2d2d2', mid: '#e6e6e6', glow: '#ffffff' } satisfies GelColors,
  },

  /** 窗口左上角的三颗按钮 */
  lights: {
    close: { rim: '#8a1a10', dark: '#c4291c', light: '#ffa184' } satisfies BallColors,
    minimize: { rim: '#8c5a00', dark: '#cf8d0a', light: '#ffe887' } satisfies BallColors,
    zoom: { rim: '#2a6512', dark: '#3a9620', light: '#b6f47e' } satisfies BallColors,
    /** 非活动窗口的三颗按钮都变成这一种 */
    inactive: { rim: '#8c8c8c', dark: '#b4b4b4', light: '#f2f2f2' } satisfies BallColors,
  },

  /** 菜单栏左上角的蓝色苹果 */
  apple: { rim: '#0f3c8e', top: '#64aef7', bottom: '#1450c0' },

  scroller: {
    /** 滑轨：左侧暗、右侧亮 */
    trackDark: '#c9c9c9',
    trackLight: '#fbfbfb',
    trackEdge: '#9d9d9d',
    /** 箭头按钮里的小三角 */
    arrow: '#2b2b2b',
  },

  dock: {
    /** 半透明白底，透明度见 dock.ts */
    fill: '#ffffff',
    edge: '#ffffff',
    /** 正在运行的程序下面的小三角 */
    indicator: '#000000',
  },
  /** Dock 图标上的红色未读角标 */
  badge: { top: '#f0573f', bottom: '#c51b0e' },
  /** 警告提示框的黄色三角 */
  caution: { rim: '#8a6000', top: '#ffe35a', bottom: '#f3a600', mark: '#000000' },

  /** Finder 笑脸图标 */
  finder: {
    light: '#bfe5ff',
    lightEdge: '#82c3f6',
    dark: '#3d8fee',
    darkEdge: '#0f4fb8',
    face: '#0b2754',
  },
  /** 废纸篓（金属网篓）；paper 是装满时网篓里揉皱的纸 */
  trash: {
    light: '#eef2f6',
    dark: '#98a3ae',
    wire: '#6c7783',
    inside: '#3e4650',
    paper: '#fbfbf7',
    paperShade: '#c9ccd0',
  },

  /** 下拉菜单（NSMenu）：略透明的白底，鼠标所在的条目是蓝色果冻底 */
  menu: {
    alpha: 0.95,
    edge: '#8a8a8a',
    separator: '#d2d2d2',
    disabled: '#9a9a9a',
    highlightTop: '#6aa6f5',
    highlightBottom: '#1d5fd6',
  },

  /** 箭头指针：黑色箭头、白色描边 */
  cursor: { fill: '#000000', outline: '#ffffff' },

  /** 桌面上的文稿图标（白纸、折角）和文件夹（蓝色） */
  document: { paper: '#ffffff', fold: '#d9dde3', edge: '#8c929a' },
  folder: { top: '#a9d1ff', bottom: '#4d8fe6', tab: '#7fb4f6', edge: '#2f69bf' },
  /** 桌面图标下的白色文件名和它的投影 */
  desktopLabel: { text: '#ffffff', shadow: '#000000' },
};

/**
 * 界面字体：Lucida Grande 是原版界面字体；Windows 上没有时用同源的 Lucida Sans Unicode。
 * 中文先找原版的华文黑体，再落到系统自带的中文黑体。
 */
export const AQUA_FONT = [
  'Lucida Grande',
  'Lucida Sans Unicode',
  'Lucida Sans',
  'STHeiti',
  'Heiti SC',
  'PingFang SC',
  'Microsoft YaHei',
  'sans-serif',
];
