// Native XP pieces for the shared window panels (results, settings, latency test): text, the Luna group box,
// label-sized buttons and button wiring.

import { Container, Graphics, type Text } from 'pixi.js';
import { LUNA } from '@/theme/xp-luna.ts';
import type { PanelTextStyle } from '@/ui/results-panel.ts';
import { BUTTON_WIDTH, XpButton } from './components/button.ts';
import { xpText } from './components/xp-text.ts';

/** Luna group box: thin light grey rounded border, blue title set into the top edge */
const GROUP_BORDER = '#d0d0bf';
const GROUP_TITLE = '#0046d5';
/** Caption text on the window face */
export const XP_PANEL_MUTED = '#57533f';
/** Width and height a group box's padding takes (left + right, top + bottom) */
export const XP_GROUP_INSET = { x: 20, y: 30 };

export function xpPanelText(
  text: string,
  { size, bold, color, wrapWidth, lineHeight }: PanelTextStyle,
): Text {
  return xpText(text, {
    fontSize: size,
    fontWeight: bold ? '700' : '400',
    fill: color ?? LUNA.ink,
    ...(lineHeight !== undefined && { lineHeight }),
    ...(wrapWidth !== undefined && {
      wordWrap: true,
      wordWrapWidth: wrapWidth,
      breakWords: true,
    }),
  });
}

export function xpGroupBox(
  title: string,
  width: number,
  height: number,
): { view: Container; inner: Container } {
  const view = new Container({ label: `group-${title}` });
  const label = xpText(title, { fill: GROUP_TITLE });
  const top = Math.round(label.height / 2);
  const box = new Graphics()
    .roundRect(0.5, top + 0.5, width - 1, height - top - 1, 3)
    .stroke({ width: 1, color: GROUP_BORDER })
    // Back the title with the window face to break the border line
    .rect(6, 0, Math.ceil(label.width) + 6, label.height)
    .fill(LUNA.face);
  label.position.set(9, 0);
  const inner = new Container({ label: 'inner' });
  inner.position.set(10, top + 14);
  view.addChild(box, label, inner);
  return { view, inner };
}

/** Hover turns orange and pressing darkens, like the original */
export function wireXpButton(button: XpButton, onTap: () => void): void {
  button.view.eventMode = 'static';
  button.view.on('pointerover', () => button.setHot(true));
  button.view.on('pointerout', () => {
    button.setHot(false);
    button.setPressed(false);
  });
  button.view.on('pointerdown', () => button.setPressed(true));
  button.view.on('pointertap', onTap);
}

/** A push button at least the standard 75 px wide, wider for long labels */
export function xpLabelButton(label: string, isDefault = false): XpButton {
  const probe = xpText(label);
  const width = Math.max(BUTTON_WIDTH, Math.ceil(probe.width) + 20);
  probe.destroy();
  return new XpButton({ label, width, isDefault });
}
