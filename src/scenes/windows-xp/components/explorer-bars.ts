// Bars shared by Explorer-style windows (Explorer, Internet Explorer, Outlook Express): menu bar, toolbar buttons,
// address bar and status bar, at original size. Each is laid out from its own top left, except the address bar,
// which places itself under the menu bar and toolbar.

import { Container, Graphics, Rectangle, Sprite } from 'pixi.js';
import { LUNA } from '@/theme/xp-luna.ts';
import { xpAssets } from '@/scenes/windows-xp/assets.ts';
import { edgeRing, topRoundedRect, verticalGradient } from './draw.ts';
import { xpText } from './xp-text.ts';

export const MENU_HEIGHT = 20;
export const TOOLBAR_HEIGHT = 38;
export const ADDRESS_HEIGHT = 24;
export const STATUS_HEIGHT = 20;

export function iconSprite(name: string, size: number): Sprite {
  const sprite = new Sprite(xpAssets().icon(name));
  sprite.setSize(size);
  return sprite;
}

// ---------- Menu bar, address bar, status bar ----------

export function menuBar(width: number, menus: readonly string[]): Container {
  const bar = new Container({ label: 'menu-bar' });
  bar.addChild(new Graphics().rect(0, 0, width, MENU_HEIGHT).fill(LUNA.face));
  let x = 2;
  for (const item of menus) {
    const text = xpText(item);
    text.anchor.set(0, 0.5);
    text.position.set(x + 7, MENU_HEIGHT / 2);
    bar.addChild(text);
    x += Math.ceil(text.width) + 14;
  }
  return bar;
}

export function addressBar(width: number, address: string, icon: string): Container {
  const e = LUNA.explorer;
  const bar = new Container({ label: 'address-bar' });
  bar.y = MENU_HEIGHT + TOOLBAR_HEIGHT;
  bar.addChild(
    new Graphics()
      .rect(0, 0, width, ADDRESS_HEIGHT)
      .fill(LUNA.face)
      .rect(0, ADDRESS_HEIGHT - 1, width, 1)
      .fill(e.bandDark),
  );

  const label = xpText('Address', { fill: e.addressLabel });
  label.anchor.set(0, 0.5);
  label.position.set(6, ADDRESS_HEIGHT / 2);

  const comboLeft = 58;
  const goWidth = 56;
  const comboWidth = width - comboLeft - goWidth - 8;
  const comboTop = 2;
  const comboHeight = ADDRESS_HEIGHT - 5;
  const combo = new Graphics()
    .rect(comboLeft, comboTop, comboWidth, comboHeight)
    .fill(e.comboBorder)
    .rect(comboLeft + 1, comboTop + 1, comboWidth - 2, comboHeight - 2)
    .fill(LUNA.white);
  // Drop-down button at the right end
  const buttonX = comboLeft + comboWidth - 18;
  combo
    .roundRect(buttonX, comboTop + 1, 17, comboHeight - 2, 2)
    .fill(e.comboButtonEdge)
    .roundRect(buttonX + 1, comboTop + 2, 15, comboHeight - 4, 1)
    .fill(verticalGradient(e.comboButton))
    .poly([buttonX + 5, 9, buttonX + 12, 9, buttonX + 8.5, 13])
    .fill(e.comboArrow);

  const folder = iconSprite(icon, 16);
  folder.position.set(comboLeft + 4, comboTop + 2);
  const path = xpText(address);
  path.anchor.set(0, 0.5);
  path.position.set(comboLeft + 24, ADDRESS_HEIGHT / 2);

  const go = new Graphics()
    .roundRect(0, 0, 18, 18, 3)
    .fill(e.go)
    .stroke({ width: 1, color: e.goEdge, alignment: 1 })
    .moveTo(4.5, 9)
    .lineTo(12.5, 9)
    .moveTo(9.5, 5.5)
    .lineTo(13, 9)
    .lineTo(9.5, 12.5)
    .stroke({ width: 2, color: LUNA.white });
  go.position.set(width - goWidth, (ADDRESS_HEIGHT - 18) / 2);
  const goText = xpText('Go');
  goText.anchor.set(0, 0.5);
  goText.position.set(width - goWidth + 22, ADDRESS_HEIGHT / 2);

  bar.addChild(label, combo, folder, path, go, goText);
  return bar;
}

export function statusBar(width: number, left: string, right: string): Container {
  const e = LUNA.explorer;
  const bar = new Container({ label: 'status-bar' });
  const split = Math.round(width * 0.62);
  const g = new Graphics()
    .rect(0, 0, width, STATUS_HEIGHT)
    .fill(LUNA.face)
    .rect(0, 0, width, 1)
    .fill(e.bandLight);
  // Sunken dividers between the panes
  g.rect(split, 3, 1, STATUS_HEIGHT - 6).fill(LUNA.edgeShadow);
  g.rect(split + 1, 3, 1, STATUS_HEIGHT - 6).fill(LUNA.edgeHighlight);
  const leftText = xpText(left);
  leftText.anchor.set(0, 0.5);
  leftText.position.set(6, STATUS_HEIGHT / 2);
  const rightText = xpText(right);
  rightText.anchor.set(0, 0.5);
  rightText.position.set(split + 8, STATUS_HEIGHT / 2);
  bar.addChild(g, leftText, rightText);
  return bar;
}

// ---------- Toolbar buttons and icons ----------

/**
 * Toolbar button: icon, optional label and optional drop-down arrow. Flat until hovered, then raised;
 * buttons with a null onTap are decoration (their original functions have no use here).
 */
export function toolbarButton(
  icon: Container,
  label: string,
  dropdown: boolean,
  onTap: (() => void) | null,
): { view: Container; width: number } {
  const view = new Container({ label: `toolbar-${label || 'button'}` });
  const height = TOOLBAR_HEIGHT - 6;
  icon.position.set(4, (height - icon.height) / 2);
  let width = 4 + icon.width + 4;
  const parts: Container[] = [icon];
  if (label) {
    const text = xpText(label);
    text.anchor.set(0, 0.5);
    text.position.set(width, height / 2);
    width += Math.ceil(text.width) + 6;
    parts.push(text);
  }
  if (dropdown) {
    parts.push(new Graphics().poly([width, 15, width + 5, 15, width + 2.5, 18]).fill(LUNA.ink));
    width += 9;
  }
  const hot = new Graphics();
  topRoundedRect(hot, 0, 0, width, height, 3).fill({ color: LUNA.white, alpha: 0.35 });
  edgeRing(hot, 0, 0, width, height, {
    top: LUNA.explorer.hotEdgeLight,
    left: LUNA.explorer.hotEdgeLight,
    right: LUNA.explorer.hotEdgeDark,
    bottom: LUNA.explorer.hotEdgeDark,
  });
  hot.visible = false;
  view.addChild(hot, ...parts);
  if (onTap) {
    view.eventMode = 'static';
    view.hitArea = new Rectangle(0, 0, width, height);
    view.on('pointerover', () => (hot.visible = true));
    view.on('pointerout', () => (hot.visible = false));
    view.on('pointertap', onTap);
  }
  return { view, width };
}

/** Green circle with a left arrow (Back), drawn as vectors since the original icon isn't available */
export function drawBackIcon(size: number): Graphics {
  const e = LUNA.explorer;
  const r = size / 2;
  const k = size / 28;
  return new Graphics()
    .circle(r, r, r - 1)
    .fill(e.go)
    .stroke({ width: 1, color: e.goEdge })
    .moveTo(r + 2 * k, r - 6 * k)
    .lineTo(r - 4 * k, r)
    .lineTo(r + 2 * k, r + 6 * k)
    .stroke({ width: 3 * k, color: LUNA.white, cap: 'round', join: 'round' });
}

/** Disabled Forward button */
export function drawForwardIcon(): Graphics {
  const e = LUNA.explorer;
  return new Graphics()
    .circle(13, 13, 12)
    .fill(e.goDisabled)
    .stroke({ width: 1, color: e.goDisabledEdge })
    .moveTo(11, 7)
    .lineTo(17, 13)
    .lineTo(11, 19)
    .stroke({ width: 3, color: LUNA.white, cap: 'round', join: 'round' });
}
