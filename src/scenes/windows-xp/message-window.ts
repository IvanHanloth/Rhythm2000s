// Message box over the level list for chart import and delete (doc/chart-import-export.md): an XP message box
// with "OK", or "Yes" / "No" for a confirmation. Enter presses the default (first) button; the close button closes.

import type { Container } from 'pixi.js';
import type { MessageWindowOptions, ModalWindow } from '@/scenes/shared/level-scene.ts';
import { XpMessageBox } from './components/message-box.ts';
import type { DialogKind } from './dialog-kinds.ts';
import { wireXpButton } from './panel-kit.ts';

const ICONS: Record<MessageWindowOptions['kind'], DialogKind> = {
  info: 'dialog-info',
  error: 'dialog-error',
  question: 'dialog-question',
};

/** Wide enough that chart errors with field paths wrap into few lines */
const TEXT_WIDTH = 440;

export class XpMessageWindow implements ModalWindow {
  readonly view: Container;
  private readonly box: XpMessageBox;
  private readonly pressDefault: () => void;

  constructor(options: MessageWindowOptions) {
    const { confirm, onClose } = options;
    this.box = new XpMessageBox({
      kind: ICONS[options.kind],
      title: options.title,
      text: options.detail ? `${options.message}\n\n${options.detail}` : options.message,
      buttons: confirm ? ['Yes', 'No'] : ['OK'],
      maxTextWidth: TEXT_WIDTH,
    });
    const actions = confirm ? [confirm.onConfirm, onClose] : [onClose];
    this.box.buttons.forEach((button, i) => wireXpButton(button, actions[i]!));
    this.pressDefault = actions[0]!;
    const close = this.box.frame.closeButton.view;
    close.eventMode = 'static';
    close.on('pointertap', onClose);
    this.view = this.box.view;
  }

  onKeyDown(event: KeyboardEvent): void {
    if (event.repeat || (event.code !== 'Enter' && event.code !== 'NumpadEnter')) return;
    event.preventDefault();
    this.pressDefault();
  }

  destroy(): void {
    this.box.destroy();
  }
}
