// 菜单栏：22 像素高的白色细条纹，横贯屏幕顶端。左边蓝色苹果、加粗的程序名和各菜单，
// 右边音量小工具（黑色小喇叭）和时钟。
// 菜单名用美国英文版 Finder 的说法。

import { Container, Graphics, type Text } from 'pixi.js';
import { AQUA } from '@/theme/aqua.ts';
import { drawAppleLogo } from './icons.ts';
import { aquaText, stripes, vGradient } from './paint.ts';
import { drawSpeakerIcon, VOLUME_MENU_WIDTH } from './volume-menu.ts';

export const MENU_BAR_HEIGHT = 22;
const APPLE_X = 14;
const APPLE_HEIGHT = 17;
/** 苹果菜单标题的高亮范围（菜单打开时的蓝底）；苹果菜单从 APPLE_MENU_LEFT 垂下 */
export const APPLE_MENU_LEFT = 4;
const APPLE_TITLE_WIDTH = 32;
const FIRST_MENU_X = 40;
/** 菜单名左右各留的空白 */
const MENU_PADDING = 10;
const CLOCK_RIGHT = 14;
/** 小喇叭标题的左沿离右边多远：留出时钟「Sat 12:59 PM」的宽度 */
const SPEAKER_FROM_RIGHT = 150;
const SPEAKER_TITLE_WIDTH = VOLUME_MENU_WIDTH;
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export interface MenuBarOptions {
  width: number;
  /** 当前程序名，加粗显示在苹果右边 */
  appName: string;
  menus: readonly string[];
}

export class MenuBar {
  readonly view = new Container({ label: 'menu-bar' });
  private readonly clock: Text;
  /** 苹果菜单打开时的蓝色标题底和白色苹果 */
  private readonly appleHighlight: Container;
  /** 音量小工具：普通、静音两种小喇叭，和菜单打开时的蓝色标题底 + 白色小喇叭 */
  private readonly speakerLeft: number;
  private readonly speaker: Graphics;
  private readonly speakerMuted: Graphics;
  private readonly speakerHighlight: Container;
  private readonly speakerWhite: Graphics;
  private readonly speakerWhiteMuted: Graphics;
  private clockLabel = '';

  constructor({ width, appName, menus }: MenuBarOptions) {
    const bar = new Graphics()
      .rect(0, 0, width, MENU_BAR_HEIGHT)
      .fill(stripes(AQUA.menuStripe))
      .rect(0, MENU_BAR_HEIGHT - 1, width, 1)
      .fill(AQUA.separator)
      // 菜单栏下沿的一道浅影
      .rect(0, MENU_BAR_HEIGHT, width, 3)
      .fill(
        vGradient([
          [0, 'rgba(0,0,0,0.22)'],
          [1, 'rgba(0,0,0,0)'],
        ]),
      );

    const apple = drawAppleLogo(APPLE_HEIGHT);
    apple.position.set(APPLE_X, 2);

    this.appleHighlight = new Container({ label: 'apple-highlight' });
    const whiteApple = drawAppleLogo(APPLE_HEIGHT, { white: true });
    whiteApple.position.set(APPLE_X, 2);
    this.appleHighlight.addChild(
      new Graphics().rect(APPLE_MENU_LEFT, 0, APPLE_TITLE_WIDTH, MENU_BAR_HEIGHT - 1).fill(
        vGradient([
          [0, AQUA.menu.highlightTop],
          [1, AQUA.menu.highlightBottom],
        ]),
      ),
      whiteApple,
    );
    this.appleHighlight.visible = false;

    this.view.addChild(bar, apple, this.appleHighlight);

    let x = FIRST_MENU_X;
    [appName, ...menus].forEach((name, i) => {
      const text = aquaText(name, { size: 14, bold: i === 0 });
      text.anchor.set(0, 0.5);
      text.position.set(x + MENU_PADDING, MENU_BAR_HEIGHT / 2);
      x += text.width + MENU_PADDING * 2;
      this.view.addChild(text);
    });

    this.speakerLeft = width - SPEAKER_FROM_RIGHT;
    const iconX = this.speakerLeft + (SPEAKER_TITLE_WIDTH - 18) / 2;
    const place = (g: Graphics) => {
      g.position.set(iconX, 3);
      return g;
    };
    this.speaker = place(drawSpeakerIcon());
    this.speakerMuted = place(drawSpeakerIcon({ muted: true }));
    this.speakerWhite = place(drawSpeakerIcon({ white: true }));
    this.speakerWhiteMuted = place(drawSpeakerIcon({ muted: true, white: true }));
    this.speakerHighlight = new Container({ label: 'speaker-highlight' });
    this.speakerHighlight.addChild(
      new Graphics().rect(this.speakerLeft, 0, SPEAKER_TITLE_WIDTH, MENU_BAR_HEIGHT - 1).fill(
        vGradient([
          [0, AQUA.menu.highlightTop],
          [1, AQUA.menu.highlightBottom],
        ]),
      ),
      this.speakerWhite,
      this.speakerWhiteMuted,
    );
    this.view.addChild(this.speaker, this.speakerMuted, this.speakerHighlight);
    this.setVolumeExtra({ muted: false, open: false });

    this.clock = aquaText('', { size: 14 });
    this.clock.anchor.set(1, 0.5);
    this.clock.position.set(width - CLOCK_RIGHT, MENU_BAR_HEIGHT / 2);
    this.view.addChild(this.clock);
  }

  /** 苹果标志的中心（菜单栏自己的坐标），虚拟鼠标点这里打开苹果菜单 */
  get appleCenter(): { x: number; y: number } {
    return { x: APPLE_MENU_LEFT + APPLE_TITLE_WIDTH / 2, y: MENU_BAR_HEIGHT / 2 };
  }

  /** 苹果菜单打开时，苹果的标题底变蓝 */
  setAppleHighlighted(highlighted: boolean): void {
    this.appleHighlight.visible = highlighted;
  }

  /** 音量菜单垂下的位置：小喇叭标题的左下角（菜单栏自己的坐标） */
  get volumeMenuOrigin(): { x: number; y: number } {
    return { x: this.speakerLeft, y: MENU_BAR_HEIGHT };
  }

  /** 小喇叭：muted 时没有声波；open 时标题底变蓝、喇叭变白 */
  setVolumeExtra({ muted, open }: { muted: boolean; open: boolean }): void {
    this.speaker.visible = !open && !muted;
    this.speakerMuted.visible = !open && muted;
    this.speakerHighlight.visible = open;
    this.speakerWhite.visible = !muted;
    this.speakerWhiteMuted.visible = muted;
  }

  /** 显示本机时间，例如「Thu 3:01 PM」。分钟变了才重画文字。 */
  update(now: Date): void {
    const hours = now.getHours();
    const label = `${WEEKDAYS[now.getDay()]} ${hours % 12 || 12}:${String(now.getMinutes()).padStart(2, '0')} ${hours < 12 ? 'AM' : 'PM'}`;
    if (label === this.clockLabel) return;
    this.clockLabel = label;
    this.clock.text = label;
  }
}
