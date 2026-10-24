// Menu bar: 22 px of white pinstripes across the top of the screen. The blue Apple, the bold application name and
// the menus on the left; the volume menu extra (black speaker) and the clock on the right.
// Menu names follow US English Finder.

import { Container, Graphics, type Text } from 'pixi.js';
import { AQUA } from '@/theme/aqua.ts';
import { drawAppleLogo } from './icons.ts';
import { aquaText, stripes, vGradient } from './paint.ts';
import { drawSpeakerIcon, VOLUME_MENU_WIDTH } from './volume-menu.ts';

export const MENU_BAR_HEIGHT = 22;
const APPLE_X = 14;
const APPLE_HEIGHT = 17;
/** Highlight of the Apple menu title when open (blue); the Apple menu drops from APPLE_MENU_LEFT */
export const APPLE_MENU_LEFT = 4;
const APPLE_TITLE_WIDTH = 32;
const FIRST_MENU_X = 40;
/** Padding either side of a menu name */
const MENU_PADDING = 10;
const CLOCK_RIGHT = 14;
/** Left edge of the speaker title from the right: leaves room for the clock "Sat 12:59 PM" */
const SPEAKER_FROM_RIGHT = 150;
const SPEAKER_TITLE_WIDTH = VOLUME_MENU_WIDTH;
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export interface MenuBarOptions {
  width: number;
  /** Current application name, bold right of the Apple */
  appName: string;
  menus: readonly string[];
}

export class MenuBar {
  readonly view = new Container({ label: 'menu-bar' });
  private readonly clock: Text;
  /** Blue title and white Apple while the Apple menu is open */
  private readonly appleHighlight: Container;
  /** Volume menu extra: normal and muted speakers, plus the blue title with a white speaker while open */
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
      // A light shadow under the menu bar
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

  /** Centre of the Apple (menu bar coordinates), where the virtual mouse opens the Apple menu */
  get appleCenter(): { x: number; y: number } {
    return { x: APPLE_MENU_LEFT + APPLE_TITLE_WIDTH / 2, y: MENU_BAR_HEIGHT / 2 };
  }

  /** The Apple's title turns blue while its menu is open */
  setAppleHighlighted(highlighted: boolean): void {
    this.appleHighlight.visible = highlighted;
  }

  /** Where the volume menu drops from: bottom left of the speaker title (menu bar coordinates) */
  get volumeMenuOrigin(): { x: number; y: number } {
    return { x: this.speakerLeft, y: MENU_BAR_HEIGHT };
  }

  /** Speaker: no sound waves when muted; blue title and white speaker when open */
  setVolumeExtra({ muted, open }: { muted: boolean; open: boolean }): void {
    this.speaker.visible = !open && !muted;
    this.speakerMuted.visible = !open && muted;
    this.speakerHighlight.visible = open;
    this.speakerWhite.visible = !muted;
    this.speakerWhiteMuted.visible = muted;
  }

  /** Local time, e.g. "Thu 3:01 PM"; redraws only when the minute changes */
  update(now: Date): void {
    const hours = now.getHours();
    const label = `${WEEKDAYS[now.getDay()]} ${hours % 12 || 12}:${String(now.getMinutes()).padStart(2, '0')} ${hours < 12 ? 'AM' : 'PM'}`;
    if (label === this.clockLabel) return;
    this.clockLabel = label;
    this.clock.text = label;
  }
}
