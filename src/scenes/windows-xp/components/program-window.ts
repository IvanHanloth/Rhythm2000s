// XP 自带程序的小窗口：Luna 外框（最小化、最大化、关闭三个按钮）+ 菜单栏 + 程序自己的内容。
// window-minimize 动作用它（doc/scenes/windows-xp-levels.md）。内容只是示意，按原版的样子简化绘制。
// 原点在窗口中心，方便和消息框共用屏幕上的位置、做缩放动画。

import { Container, Graphics } from 'pixi.js';
import { LUNA } from '@/theme/xp-luna.ts';
import { XP_PROGRAMS } from '@/theme/xp-programs.ts';
import { CAPTION_HEIGHT, FRAME_WIDTH, XpWindowFrame } from './window-frame.ts';
import { xpText } from './xp-text.ts';

export const PROGRAM_WINDOW_WIDTH = 250;
export const PROGRAM_WINDOW_HEIGHT = 164;
const MENU_HEIGHT = 19;
/** 标题栏按钮的边长和间距，与 window-frame.ts 一致 */
const CAPTION_BUTTON = 21;
const CAPTION_BUTTON_GAP = 2;

export type ProgramKind = 'notepad' | 'paint' | 'ie' | 'minesweeper';

interface ProgramSpec {
  title: string;
  /** 标题栏和任务栏按钮上的图标 */
  icon: string;
  /** 任务栏按钮上的字 */
  taskLabel: string;
  menu: string;
  draw(client: Container, width: number, height: number): void;
}

export const PROGRAMS: Record<ProgramKind, ProgramSpec> = {
  notepad: {
    title: 'Untitled - Notepad',
    icon: 'notepad',
    taskLabel: 'Untitled - Notepad',
    menu: 'File   Edit   Format   View   Help',
    draw: drawNotepad,
  },
  paint: {
    title: 'untitled - Paint',
    icon: 'paint',
    taskLabel: 'untitled - Paint',
    menu: 'File   Edit   View   Image   Colors   Help',
    draw: drawPaint,
  },
  ie: {
    title: 'about:blank - Microsoft Internet Explorer',
    icon: 'internet-explorer',
    taskLabel: 'about:blank - Micr...',
    menu: 'File   Edit   View   Favorites   Tools   Help',
    draw: drawInternetExplorer,
  },
  minesweeper: {
    title: 'Minesweeper',
    icon: 'minesweeper',
    taskLabel: 'Minesweeper',
    menu: 'Game   Help',
    draw: drawMinesweeper,
  },
};

export const PROGRAM_KINDS = Object.keys(PROGRAMS) as ProgramKind[];

export class XpProgramWindow {
  readonly view: Container;
  readonly width = PROGRAM_WINDOW_WIDTH;
  readonly height = PROGRAM_WINDOW_HEIGHT;
  readonly spec: ProgramSpec;
  /** 最小化按钮中心（相对窗口中心），虚拟鼠标点这里 */
  readonly minimizeCenter: { x: number; y: number };
  private readonly frame: XpWindowFrame;

  constructor(kind: ProgramKind) {
    const spec = PROGRAMS[kind];
    this.spec = spec;
    const { width, height } = this;
    this.view = new Container({ label: `program-${kind}` });
    this.frame = new XpWindowFrame({
      title: spec.title,
      width,
      height,
      icon: spec.icon,
      controls: 'all',
    });

    const menu = xpText(spec.menu);
    menu.position.set(FRAME_WIDTH + 6, CAPTION_HEIGHT + 3);

    const client = new Container({ label: 'client' });
    client.position.set(FRAME_WIDTH, CAPTION_HEIGHT + MENU_HEIGHT);
    spec.draw(client, width - FRAME_WIDTH * 2, height - CAPTION_HEIGHT - MENU_HEIGHT - FRAME_WIDTH);

    const body = new Container();
    body.addChild(this.frame.view, menu, client);
    body.position.set(-width / 2, -height / 2);
    this.view.addChild(body);

    // 关闭按钮在最右，左边依次是最大化、最小化（window-frame.ts 的排法）
    const closeLeft = width - FRAME_WIDTH - 2 - CAPTION_BUTTON;
    const minimizeLeft = closeLeft - 2 * (CAPTION_BUTTON + CAPTION_BUTTON_GAP);
    this.minimizeCenter = {
      x: -width / 2 + minimizeLeft + CAPTION_BUTTON / 2,
      y: -height / 2 + 4 + CAPTION_BUTTON / 2,
    };
  }

  setActive(active: boolean): void {
    this.frame.setActive(active);
  }

  destroy(): void {
    this.view.destroy({ children: true });
  }
}

/** 凹陷的白色区域（编辑区、画布、网页） */
function sunkenPaper(x: number, y: number, w: number, h: number): Graphics {
  return new Graphics()
    .rect(x, y, w, h)
    .fill(XP_PROGRAMS.paper)
    .stroke({ width: 1, color: XP_PROGRAMS.sunkenEdge, alignment: 1 });
}

function drawNotepad(client: Container, w: number, h: number): void {
  const text = xpText('June 1, 2003\nNet café this afternoon,\nthen copy my homework.|', {
    lineHeight: 16,
  });
  text.position.set(5, 4);
  client.addChild(sunkenPaper(1, 0, w - 2, h - 1), text);
}

function drawPaint(client: Container, w: number, h: number): void {
  const p = XP_PROGRAMS.paint;
  const toolbox = new Graphics().rect(0, 0, 28, h).fill(LUNA.face);
  for (let i = 0; i < 8; i++) {
    const x = 3 + (i % 2) * 12;
    const y = 4 + Math.floor(i / 2) * 12;
    toolbox.rect(x, y, 10, 10).stroke({ width: 1, color: LUNA.edgeShadow, alignment: 1 });
  }
  const paletteTop = h - 18;
  const canvas = sunkenPaper(30, 2, w - 33, paletteTop - 4);
  // 涂鸦：蓝天、太阳、草地
  const doodle = new Graphics()
    .rect(31, 3, w - 35, 20)
    .fill(p.sky)
    .circle(w - 30, 18, 9)
    .fill(p.sun)
    .rect(31, paletteTop - 18, w - 35, 15)
    .fill(p.grass);
  const palette = new Graphics().rect(0, paletteTop, w, 18).fill(LUNA.face);
  p.palette.forEach((color, i) => {
    palette
      .rect(30 + i * 13, paletteTop + 3, 11, 11)
      .fill(color)
      .stroke({ width: 1, color: LUNA.edgeDarkShadow, alignment: 1 });
  });
  client.addChild(toolbox, canvas, doodle, palette);
}

function drawInternetExplorer(client: Container, w: number, h: number): void {
  const bar = new Graphics().rect(0, 0, w, 22).fill(LUNA.face);
  const label = xpText('Address', { fill: LUNA.inkDisabled });
  label.position.set(4, 4);
  const address = sunkenPaper(52, 3, w - 56, 16);
  const url = xpText('about:blank');
  url.position.set(56, 4);
  const page = sunkenPaper(1, 24, w - 2, h - 25);
  const link = xpText('Welcome to my homepage!\nYou are visitor #000123', {
    fill: XP_PROGRAMS.link,
    lineHeight: 16,
  });
  link.position.set(8, 32);
  client.addChild(bar, label, address, url, page, link);
}

function drawMinesweeper(client: Container, w: number, h: number): void {
  const m = XP_PROGRAMS.minesweeper;
  const g = new Graphics().rect(0, 0, w, h).fill(m.face);
  // 顶部：剩余地雷数、笑脸、计时
  g.rect(8, 6, 39, 24)
    .fill(m.counter)
    .rect(w - 47, 6, 39, 24)
    .fill(m.counter);
  g.rect(w / 2 - 12, 6, 24, 24)
    .fill(m.face)
    .stroke({ width: 2, color: m.shadow, alignment: 1 })
    .circle(w / 2, 18, 8)
    .fill(m.smiley)
    .stroke({ width: 1, color: m.smileyInk })
    .circle(w / 2 - 3, 16, 1.2)
    .circle(w / 2 + 3, 16, 1.2)
    .fill(m.smileyInk)
    // 嘴巴另起一条路径：Pixi 在 fill 之后会从上一个图形的终点接着画，
    // 圆没有终点，弧线会被连上一条从别处拉过来的直线
    .beginPath()
    .arc(w / 2, 18, 4.5, 0.3, Math.PI - 0.3)
    .stroke({ width: 1, color: m.smileyInk });
  // 雷区：一格格凸起的灰块
  const size = 13;
  const cols = Math.floor((w - 16) / size);
  const rows = Math.floor((h - 44) / size);
  const left = (w - cols * size) / 2;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = left + c * size;
      const y = 38 + r * size;
      g.rect(x, y, size, size)
        .fill(m.shadow)
        .rect(x, y, size - 1, size - 1)
        .fill(m.light)
        .rect(x + 1.5, y + 1.5, size - 3, size - 3)
        .fill(m.face);
    }
  }
  const digits = ['010', '000'].map((value) => {
    const text = xpText(value, { fill: m.digit, fontSize: 18, fontWeight: '700' });
    text.anchor.set(0.5);
    return text;
  });
  digits[0]!.position.set(27, 18);
  digits[1]!.position.set(w - 27, 18);
  client.addChild(g, ...digits);
}
