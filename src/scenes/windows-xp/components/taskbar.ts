// Taskbar (Shell_TrayWnd): a 30 px blue gradient bar, the green "start" button on the left and the
// notification area on the right with network, Messenger, volume and the clock. Origin at the top left.

import { Container, Graphics, Rectangle, Sprite, type Text } from 'pixi.js';
import { LUNA } from '@/theme/xp-luna.ts';
import { xpAssets } from '@/scenes/windows-xp/assets.ts';
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
  /** File name under assets/reference/windows-xp/icons/ */
  icon: string;
  label: string;
}

export class XpTaskbar {
  readonly view = new Container({ label: 'taskbar' });
  readonly startButton: StartButton;
  /** Tray volume icon; can take pointer events to open the volume control */
  readonly volumeIcon = new Container({ label: 'tray-volume' });
  /** Left edge of the notification area (taskbar coordinates) */
  readonly trayLeft: number;
  private readonly muteBadge = new Graphics();
  private readonly clock: Text;
  private clockText = '';
  private muted = false;
  private readonly taskButtons: TaskButton[] = [];

  /** tasks: program buttons, laid out right of Start */
  constructor({ tasks = [] }: { tasks?: TaskbarTask[] } = {}) {
    const bar = new Graphics()
      .rect(0, 0, XP_SCREEN_WIDTH, TASKBAR_HEIGHT)
      .fill(verticalGradient(LUNA.taskbar.fill));

    this.startButton = new StartButton();

    // Tray: lay out the contents first, then size the background to them
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
    // The clock reserves the width of "00:00 PM" so the tray never resizes
    const trayWidth = Math.ceil(x + this.clock.width + TRAY_PADDING);

    const trayFace = new Graphics()
      .rect(0, 0, trayWidth, TASKBAR_HEIGHT)
      .fill(verticalGradient(LUNA.taskbar.trayFill))
      .rect(0, 0, 1, TASKBAR_HEIGHT)
      .fill(LUNA.taskbar.trayBorder)
      .rect(1, 1, 1, TASKBAR_HEIGHT - 2)
      .fill(LUNA.taskbar.trayHighlight);
    tray.addChild(trayFace, ...icons, this.volumeIcon, this.clock);
    this.trayLeft = XP_SCREEN_WIDTH - trayWidth;
    tray.position.set(this.trayLeft, 0);

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

  /** Top centre of the tray speaker icon (taskbar coordinates) */
  get volumeIconTop(): { x: number; y: number } {
    return { x: this.trayLeft + this.volumeIcon.x + TRAY_ICON / 2, y: this.volumeIcon.y };
  }

  /** Local time in the English 12-hour format, e.g. "5:49 PM"; redraws only when the minute changes */
  setClock(now: Date): void {
    const hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const text = `${hours % 12 || 12}:${minutes} ${hours < 12 ? 'AM' : 'PM'}`;
    if (text === this.clockText) return;
    this.clockText = text;
    this.clock.text = text;
  }

  /** Whether program button `index` is pressed (its window is in front) */
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

/** Start button: green gradient, rounded right end, Windows flag on the left */
export class StartButton {
  readonly view = new Container({ label: 'start-button' });
  private readonly shade = new Graphics();

  constructor() {
    const s = LUNA.startButton;
    const face = startShape(new Graphics())
      .fill(verticalGradient(s.fill))
      .stroke({ width: 1, color: s.edge, alignment: 1 });
    // Highlight at the top left
    const gloss = new Graphics()
      .rect(0, 1, START_WIDTH - START_RADIUS, 1)
      .fill({ color: '#ffffff', alpha: 0.25 });
    startShape(this.shade).fill({ color: '#000000', alpha: 0.22 });
    this.shade.visible = false;

    // Windows flag with a faint 1 px shadow
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

    // The English button reads "start" in lowercase italics
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

  /** Stays pressed (darker) while the Start menu is open */
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

/** Program button on the taskbar: 16 px icon and white text; dark blue and pressed when its window is in front */
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
