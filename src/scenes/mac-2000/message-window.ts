// Alert over the level list for chart import and delete (doc/chart-import-export.md): an Aqua alert with "OK", or
// "Cancel" and the action's verb for a confirmation. Return presses the default (rightmost) button, which pulses.

import { Container } from 'pixi.js';
import type { MessageWindowOptions, ModalWindow } from '@/scenes/shared/level-scene.ts';
import { AquaAlert } from './components/alert.ts';
import { drawCautionIcon, drawFinderIcon } from './components/icons.ts';

/** Wider than gameplay alerts so chart errors with field paths wrap into few lines */
const ALERT_WIDTH = 480;

export class MacMessageWindow implements ModalWindow {
  readonly view: Container;
  private readonly alert: AquaAlert;
  private readonly pressDefault: () => void;

  constructor(options: MessageWindowOptions) {
    const { confirm, onClose } = options;
    const buttons = confirm
      ? [
          { label: 'Cancel', onTap: onClose },
          { label: confirm.verb, onTap: confirm.onConfirm, isDefault: true },
        ]
      : [{ label: 'OK', onTap: onClose, isDefault: true }];
    this.alert = new AquaAlert({
      width: ALERT_WIDTH,
      icon: alertIcon(options.kind),
      message: options.message,
      ...(options.detail !== undefined && { informative: options.detail }),
      buttons: buttons.map(({ label, isDefault }) => ({ label, isDefault: isDefault === true })),
    });
    this.alert.buttons.forEach((button, i) => {
      const { onTap } = buttons[i]!;
      button.view.eventMode = 'static';
      button.view.on('pointerdown', () => (button.view.alpha = 0.75));
      button.view.on('pointerout', () => (button.view.alpha = 1));
      button.view.on('pointertap', () => {
        button.view.alpha = 1;
        onTap();
      });
    });
    this.pressDefault = buttons.at(-1)!.onTap;
    this.view = this.alert.view;
  }

  update(audioTime: number): void {
    this.alert.update(audioTime);
  }

  onKeyDown(event: KeyboardEvent): void {
    if (event.repeat || (event.code !== 'Enter' && event.code !== 'NumpadEnter')) return;
    event.preventDefault();
    this.pressDefault();
  }

  destroy(): void {
    this.alert.destroy();
  }
}

/** The Finder's icon, as the application showing the alert; a question gets the caution triangle with a Finder badge */
function alertIcon(kind: MessageWindowOptions['kind']): Container {
  const icon = new Container({ label: 'alert-icon' });
  if (kind === 'question') {
    const badge = drawFinderIcon(32);
    badge.position.set(32, 32);
    icon.addChild(drawCautionIcon(64), badge);
  } else {
    icon.addChild(drawFinderIcon(64));
  }
  return icon;
}
