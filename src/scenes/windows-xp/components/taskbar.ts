// 任务栏（Shell_TrayWnd）：30 像素高的蓝色渐变条，左边绿色「开始」按钮，右边通知区域（托盘）。
// 托盘里有 Messenger 图标、音量小喇叭和时钟。原点在任务栏左上角。

import { Container, Graphics, Rectangle, Sprite, type Text } from 'pixi.js';
import { LUNA } from '../../../theme/xp-luna.ts';
import { xpAssets } from '../assets.ts';
import { verticalGradient } from './draw.ts';
import { TASKBAR_HEIGHT, XP_SCREEN_WIDTH } from './screen.ts';
import { drawSpeakerIcon } from './speaker-icon.ts';
import { hardShadow, xpText } from './xp-text.ts';

const START_WIDTH = 99;
const START_RADIUS = 11;
const TRAY_ICON = 16;
const TRAY_GAP = 6;
const TRAY_PADDING = 10;

export class XpTaskbar {
  readonly view = new Container({ label: 'taskbar' });
  readonly startButton: StartButton;
  /** 托盘的音量图标：可以挂鼠标事件，弹出音量控制 */
  readonly volumeIcon = new Container({ label: 'tray-volume' });
  private readonly speaker = new Graphics();
  private readonly clock: Text;
  private clockText = '';
  private muted = false;

  constructor() {
    const bar = new Graphics()
      .rect(0, 0, XP_SCREEN_WIDTH, TASKBAR_HEIGHT)
      .fill(verticalGradient(LUNA.taskbar.fill));

    this.startButton = new StartButton();

    // 托盘：先排好内容，再按内容宽度画底
    const tray = new Container({ label: 'tray' });
    const messenger = new Sprite(xpAssets().icon('windows-messenger'));
    messenger.setSize(TRAY_ICON);
    this.clock = xpText('00:00', { fill: LUNA.taskbar.text });
    this.clock.anchor.set(0, 0.5);

    drawSpeakerIcon(this.speaker, false);
    this.volumeIcon.addChild(this.speaker);
    this.volumeIcon.hitArea = new Rectangle(-2, -4, TRAY_ICON + 4, TRAY_ICON + 8);

    let x = TRAY_PADDING;
    const iconTop = (TASKBAR_HEIGHT - TRAY_ICON) / 2;
    messenger.position.set(x, iconTop);
    x += TRAY_ICON + TRAY_GAP;
    this.volumeIcon.position.set(x, iconTop);
    x += TRAY_ICON + TRAY_GAP + 2;
    this.clock.position.set(x, TASKBAR_HEIGHT / 2);
    // 时钟宽度按最宽的「00:00」留，走动时托盘不变宽
    const trayWidth = Math.ceil(x + this.clock.width + TRAY_PADDING);

    const trayFace = new Graphics()
      .rect(0, 0, trayWidth, TASKBAR_HEIGHT)
      .fill(verticalGradient(LUNA.taskbar.trayFill))
      .rect(0, 0, 1, TASKBAR_HEIGHT)
      .fill(LUNA.taskbar.trayBorder)
      .rect(1, 1, 1, TASKBAR_HEIGHT - 2)
      .fill(LUNA.taskbar.trayHighlight);
    tray.addChild(trayFace, messenger, this.volumeIcon, this.clock);
    tray.position.set(XP_SCREEN_WIDTH - trayWidth, 0);

    this.view.addChild(bar, this.startButton.view, tray);
    this.setClock(new Date());
  }

  /** 时钟显示本机时间（24 小时制）；每帧调用也只在分钟变化时重画 */
  setClock(now: Date): void {
    const text = `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;
    if (text === this.clockText) return;
    this.clockText = text;
    this.clock.text = text;
  }

  setMuted(muted: boolean): void {
    if (this.muted === muted) return;
    this.muted = muted;
    drawSpeakerIcon(this.speaker.clear(), muted);
  }

  destroy(): void {
    this.view.destroy({ children: true });
  }
}

/** 「开始」按钮：绿色渐变，右侧圆弧，左边是 Windows 旗帜 */
export class StartButton {
  readonly view = new Container({ label: 'start-button' });
  private readonly shade = new Graphics();

  constructor() {
    const s = LUNA.startButton;
    const face = startShape(new Graphics())
      .fill(verticalGradient(s.fill))
      .stroke({ width: 1, color: s.edge, alignment: 1 });
    // 左上角的高光
    const gloss = new Graphics()
      .rect(0, 1, START_WIDTH - START_RADIUS, 1)
      .fill({ color: '#ffffff', alpha: 0.25 });
    startShape(this.shade).fill({ color: '#000000', alpha: 0.22 });
    this.shade.visible = false;

    const flag = drawFlag();
    flag.position.set(8, 5);

    const label = xpText('开始', {
      fontSize: 16,
      fontWeight: '700',
      fill: s.text,
      dropShadow: hardShadow(s.textShadow),
    });
    label.anchor.set(0, 0.5);
    label.position.set(35, TASKBAR_HEIGHT / 2);

    this.view.addChild(face, gloss, flag, label, this.shade);
    this.view.hitArea = new Rectangle(0, 0, START_WIDTH, TASKBAR_HEIGHT);
  }

  /** 开始菜单打开时按钮保持按下的暗色 */
  setPressed(pressed: boolean): void {
    this.shade.visible = pressed;
  }
}

function startShape(g: Graphics): Graphics {
  const w = START_WIDTH;
  const h = TASKBAR_HEIGHT;
  const r = START_RADIUS;
  return g
    .moveTo(0, 0)
    .lineTo(w - r, 0)
    .arcTo(w, 0, w, r, r)
    .lineTo(w, h - r)
    .arcTo(w, h, w - r, h, r)
    .lineTo(0, h)
    .closePath();
}

/** Windows 旗帜：四格微微飘动的彩色方块（本地没有原版小图标，矢量绘制） */
function drawFlag(): Graphics {
  const g = new Graphics();
  const size = 9;
  const gap = 1;
  const panes = [
    { x: 0, y: 0 },
    { x: size + gap, y: -1 },
    { x: 0, y: size + gap },
    { x: size + gap, y: size + gap - 1 },
  ];
  // 先画阴影，再画四格
  for (const pass of ['shadow', 'color'] as const) {
    panes.forEach((p, i) => {
      const dx = pass === 'shadow' ? 1 : 0;
      wavyPane(g, p.x + dx, p.y + dx, size, size);
      g.fill(pass === 'shadow' ? { color: '#000000', alpha: 0.35 } : LUNA.flag[i]!);
    });
  }
  g.skew.set(-0.08, 0);
  return g;
}

function wavyPane(g: Graphics, x: number, y: number, w: number, h: number): void {
  g.moveTo(x, y + 1)
    .bezierCurveTo(x + w * 0.35, y - 1, x + w * 0.65, y + 1.5, x + w, y)
    .lineTo(x + w, y + h)
    .bezierCurveTo(x + w * 0.65, y + h + 1.5, x + w * 0.35, y + h - 1, x, y + h + 1)
    .closePath();
}
