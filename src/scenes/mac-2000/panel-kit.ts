// Native Aqua pieces for the shared window panels (results, settings): text, the group box and push button wiring.

import { Container, Graphics, type Text } from 'pixi.js';
import { AQUA } from '@/theme/aqua.ts';
import type { PanelTextStyle } from '@/ui/results-panel.ts';
import { aquaText } from './components/paint.ts';
import type { PushButton } from './components/push-button.ts';

/** Width and height a group box's padding takes (left + right, top + bottom) */
export const MAC_GROUP_INSET = { x: 20, y: 40 };

export function macPanelText(
  text: string,
  { size, bold, color, wrapWidth, lineHeight }: PanelTextStyle,
): Text {
  return aquaText(text, {
    size,
    ...(bold !== undefined && { bold }),
    ...(color !== undefined && { color }),
    ...(wrapWidth !== undefined && { wrapWidth }),
    ...(lineHeight !== undefined && { lineHeight }),
  });
}

/** Aqua group box: translucent white, thin grey rounded border, bold title inside at the top left */
export function macGroupBox(
  title: string,
  width: number,
  height: number,
): { view: Container; inner: Container } {
  const view = new Container({ label: `group-${title}` });
  const box = new Graphics()
    .roundRect(0.5, 0.5, width - 1, height - 1, 6)
    .fill({ color: AQUA.white, alpha: 0.4 })
    .stroke({ width: 1, color: AQUA.separator });
  const label = aquaText(title, { size: 12, bold: true });
  label.position.set(10, 7);
  const inner = new Container({ label: 'inner' });
  inner.position.set(10, 30);
  view.addChild(box, label, inner);
  return { view, inner };
}

/** Pressing dims the button until it is released or the mouse leaves */
export function wirePushButton(button: PushButton, onTap: () => void): void {
  button.view.eventMode = 'static';
  button.view.on('pointerdown', () => (button.view.alpha = 0.75));
  button.view.on('pointerout', () => (button.view.alpha = 1));
  button.view.on('pointertap', () => {
    button.view.alpha = 1;
    onTap();
  });
}
