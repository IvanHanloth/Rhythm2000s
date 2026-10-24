// 任务栏（Shell_TrayWnd）：30 像素高的蓝色渐变条，左边绿色「start」按钮，右边通知区域（托盘）。
// 托盘里有网络连接、Messenger、音量小喇叭和时钟。原点在任务栏左上角。

import { Container, Graphics, Rectangle, Sprite, type Text } from 'pixi.js';
import { LUNA } from '../../../theme/xp-luna.ts';
import { xpAssets } from '../assets.ts';
import { verticalGradient } from './draw.ts';
import { TASKBAR_HEIGHT, XP_SCREEN_WIDTH } from './screen.ts';
import { drawMuteBadge } from './mute-badge.ts';
import { hardShadow, xpText, XP_FONTS } from './xp-text.ts';

const START_WIDTH = 99;
const START_RADIUS = 11;
const FLAG_SIZE = 20;
const TRAY_ICON = 16;
const TRAY_GAP = 6;
const TRAY_PADDING = 10;

export const TASK_LEFT = START_WIDTH + 10;
export const TASK_WIDTH = 160;
export const TASK_HEIGHT = 22;

export interface TaskbarTask {
  /** assets/reference/windows-xp/icons/ 的文件名 */
  icon: string;
  label: string;
}

export class XpTaskbar {
  readonly view = new Container({ label: 'taskbar' });
  readonly startButton: StartButton;
  /** 托盘的音量图标：可以挂鼠标事件，弹出音量控制 */
  readonly volumeIcon = new Container({ label: 'tray-volume' });
  private readonly muteBadge = new Graphics();
  private readonly clock: Text;
  private clockText = '';
  private muted = false;
  private readonly taskButtons: TaskButton[] = [];

  /** tasks：任务栏上的程序按钮，从「开始」右边依次排开 */
  constructor({ tasks = [] }: { tasks?: TaskbarTask[] } = {}) {
    const bar = new Graphics()
      .rect(0, 0, XP_SCREEN_WIDTH, TASKBAR_HEIGHT)
      .fill(verticalGradient(LUNA.taskbar.fill));

    this.startButton = new StartButton();

    // 托盘：先排好内容，再按内容宽度画底
    const tray = new Container({ label: 'tray' });
    const icons = ['network-neighborhood', 'windows-messenger'].map((name) => {
      const sprite = new Sprite(xpAssets().icon(name));
      sprite.setSize(TRAY_ICON);
      return sprite;
    });
    this.clock = xpText('00:00 PM', { fill: LUNA.taskbar.text });
    this.clock.anchor.set(0, 0.5);

    const speaker = new Sprite(xpAssets().icon('speaker'));
    speaker.setSize(TRAY_ICON);
    drawMuteBadge(this.muteBadge);
    this.muteBadge.visible = false;
    this.volumeIcon.addChild(speaker, this.muteBadge);
    this.volumeIcon.hitArea = new Rectangle(-2, -4, TRAY_ICON + 4, TRAY_ICON + 8);

    let x = TRAY_PADDING;
    const iconTop = (TASKBAR_HEIGHT - TRAY_ICON) / 2;
    for (const icon of icons) {
      icon.position.set(x, iconTop);
      x += TRAY_ICON + TRAY_GAP;
    }
    this.volumeIcon.position.set(x, iconTop);
    x += TRAY_ICON + TRAY_GAP + 2;
    this.clock.position.set(x, TASKBAR_HEIGHT / 2);
    // 时钟宽度按最宽的「00:00 PM」留，走动时托盘不变宽
    const trayWidth = Math.ceil(x + this.clock.width + TRAY_PADDING);

    const trayFace = new Graphics()
      .rect(0, 0, trayWidth, TASKBAR_HEIGHT)
      .fill(verticalGradient(LUNA.taskbar.trayFill))
      .rect(0, 0, 1, TASKBAR_HEIGHT)
      .fill(LUNA.taskbar.trayBorder)
      .rect(1, 1, 1, TASKBAR_HEIGHT - 2)
      .fill(LUNA.taskbar.trayHighlight);
    tray.addChild(trayFace, ...icons, this.volumeIcon, this.clock);
    tray.position.set(XP_SCREEN_WIDTH - trayWidth, 0);

    this.view.addChild(bar, this.startButton.view, tray);
    tasks.forEach((task, i) => {
      const button = new TaskButton(task);
      const top = (TASKBAR_HEIGHT - TASK_HEIGHT) / 2 + 1;
      button.view.position.set(TASK_LEFT + i * (TASK_WIDTH + 3), top);
      this.taskButtons.push(button);
      this.view.addChild(button.view);
    });
    this.setClock(new Date());
  }

  /** 时钟显示本机时间（英文版的 12 小时制，如「5:49 PM」）；每帧调用也只在分钟变化时重画 */
  setClock(now: Date): void {
    const hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const text = `${hours % 12 || 12}:${minutes} ${hours < 12 ? 'AM' : 'PM'}`;
    if (text === this.clockText) return;
    this.clockText = text;
    this.clock.text = text;
  }

  /** 第 index 个程序按钮是否按下（它的窗口在最前面） */
  setTaskActive(index: number, active: boolean): void {
    this.taskButtons[index]?.setActive(active);
  }

  setMuted(muted: boolean): void {
    if (this.muted === muted) return;
    this.muted = muted;
    this.muteBadge.visible = muted;
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

    // Windows 旗帜，带 1 像素的淡阴影
    const flag = new Container({ label: 'flag' });
    for (const shadow of [true, false]) {
      const sprite = new Sprite(xpAssets().icon('windows-logo'));
      sprite.setSize(FLAG_SIZE);
      if (shadow) {
        sprite.tint = '#000000';
        sprite.alpha = 0.35;
        sprite.position.set(1, 1);
      }
      flag.addChild(sprite);
    }
    flag.position.set(8, (TASKBAR_HEIGHT - FLAG_SIZE) / 2);

    // 英文版按钮上是小写斜体的「start」
    const label = xpText('start', {
      fontFamily: XP_FONTS.caption,
      fontSize: 18,
      fontStyle: 'italic',
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

/** 任务栏上的程序按钮：16 像素图标 + 白字；窗口在最前面时是按下的深蓝色 */
export class TaskButton {
  readonly view: Container;
  private readonly normal: Graphics;
  private readonly pressed: Graphics;

  constructor({ icon, label }: TaskbarTask) {
    this.view = new Container({ label: `task-${label}` });
    const t = LUNA.taskbar;
    const face = (stops: typeof t.taskButton) =>
      new Graphics()
        .roundRect(0, 0, TASK_WIDTH, TASK_HEIGHT, 3)
        .fill(t.taskButtonEdge)
        .roundRect(1, 1, TASK_WIDTH - 2, TASK_HEIGHT - 2, 2)
        .fill(verticalGradient(stops));
    this.normal = face(t.taskButton);
    this.pressed = face(t.taskButtonActive);
    this.pressed.visible = false;

    const sprite = new Sprite(xpAssets().icon(icon));
    sprite.setSize(16);
    sprite.position.set(6, (TASK_HEIGHT - 16) / 2);
    const text = xpText(label, { fill: t.text });
    text.anchor.set(0, 0.5);
    text.position.set(28, TASK_HEIGHT / 2);
    this.view.addChild(this.normal, this.pressed, sprite, text);
  }

  setActive(active: boolean): void {
    this.normal.visible = !active;
    this.pressed.visible = active;
  }
}
