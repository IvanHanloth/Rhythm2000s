// Message box (MessageBox, window class #32770): Luna frame, 32 px icon on the left, text on the right,
// a centred row of buttons below. Sized to its text like the original. Origin at the centre for scaling.

import { Container, Sprite } from 'pixi.js';
import { xpAssets } from '@/scenes/windows-xp/assets.ts';
import { DIALOG_KINDS, type DialogKind } from '@/scenes/windows-xp/dialog-kinds.ts';
import { BUTTON_HEIGHT, BUTTON_WIDTH, XpButton } from './button.ts';
import { CAPTION_HEIGHT, FRAME_WIDTH, measureCaption, XpWindowFrame } from './window-frame.ts';
import { xpText } from './xp-text.ts';

/** Client area padding */
const PADDING = 11;
const ICON_SIZE = 32;
/** Gap between icon and text */
const ICON_GAP = 12;
const BUTTON_GAP = 6;
/** Gap between text and buttons */
const TEXT_BUTTON_GAP = 14;
const MIN_CLIENT_WIDTH = 160;

export interface XpMessageBoxOptions {
  kind: DialogKind;
  title: string;
  text: string;
  /** Defaults to the kind's buttons ("OK", or "Yes" and "No") */
  buttons?: readonly string[];
  /** Text wraps beyond this width */
  maxTextWidth?: number;
}

export class XpMessageBox {
  readonly view: Container;
  readonly width: number;
  readonly height: number;
  readonly frame: XpWindowFrame;
  readonly buttons: XpButton[];

  constructor({ kind, title, text, buttons, maxTextWidth = 300 }: XpMessageBoxOptions) {
    const info = DIALOG_KINDS[kind];
    const labels = buttons ?? info.buttons;

    const body = xpText(text, {
      wordWrap: true,
      wordWrapWidth: maxTextWidth,
      breakWords: true,
      lineHeight: 16,
    });
    this.buttons = labels.map((label, i) => new XpButton({ label, isDefault: i === 0 }));
    const buttonsWidth = labels.length * BUTTON_WIDTH + (labels.length - 1) * BUTTON_GAP;

    const textLeft = PADDING + ICON_SIZE + ICON_GAP;
    const contentHeight = Math.max(ICON_SIZE, Math.ceil(body.height));
    const titleWidth = measureCaption(title);
    const clientWidth = Math.ceil(
      Math.max(
        MIN_CLIENT_WIDTH,
        textLeft + body.width + PADDING + 8,
        buttonsWidth + PADDING * 2,
        titleWidth + 50,
      ),
    );
    const buttonsTop = PADDING + contentHeight + TEXT_BUTTON_GAP;
    const clientHeight = buttonsTop + BUTTON_HEIGHT + PADDING;

    this.width = clientWidth + FRAME_WIDTH * 2;
    this.height = CAPTION_HEIGHT + clientHeight + FRAME_WIDTH;
    this.view = new Container({ label: `${kind}-${title}` });
    this.view.pivot.set(Math.round(this.width / 2), Math.round(this.height / 2));

    this.frame = new XpWindowFrame({ title, width: this.width, height: this.height });

    const client = new Container({ label: 'client' });
    client.position.set(FRAME_WIDTH, CAPTION_HEIGHT);

    const icon = new Sprite(xpAssets().icon(info.icon));
    icon.setSize(ICON_SIZE);
    icon.position.set(PADDING, PADDING);

    // A single line is centred on the icon; more lines start at the top
    body.position.set(textLeft, PADDING + Math.max(0, Math.round((ICON_SIZE - body.height) / 2)));

    let x = Math.round((clientWidth - buttonsWidth) / 2);
    for (const button of this.buttons) {
      button.view.position.set(x, buttonsTop);
      x += BUTTON_WIDTH + BUTTON_GAP;
    }

    client.addChild(icon, body, ...this.buttons.map((b) => b.view));
    this.view.addChild(this.frame.view, client);
  }

  setActive(active: boolean): void {
    this.frame.setActive(active);
  }

  /** Centre of button `index` (the default button by default) relative to the box centre, for the virtual mouse */
  buttonCenter(index = 0): { x: number; y: number } {
    const button = this.buttons[index];
    if (!button) throw new Error(`The message box has no button ${index + 1}`);
    return {
      x: FRAME_WIDTH + button.view.x + button.width / 2 - this.view.pivot.x,
      y: CAPTION_HEIGHT + button.view.y + button.height / 2 - this.view.pivot.y,
    };
  }

  destroy(): void {
    this.view.destroy({ children: true });
  }
}
