// The Dock (10.0–10.2): a translucent white rounded bar along the bottom edge, centred, with faint pinstripes.
// Applications on the left, with a small black triangle under running ones; the Trash on the far right
// past a divider. Icons can bounce (requestUserAttention) and carry a red badge (Mail's unread count).

import { Container, Graphics, type Text } from 'pixi.js';
import { AQUA } from '@/theme/aqua.ts';
import { appIcon, type AppIconName } from '@/scenes/mac-2000/assets.ts';
import { drawFinderIcon, drawTrashIcon } from './icons.ts';
import { aquaText, stripes, vGradient } from './paint.ts';

export const DOCK_ICON_SIZE = 48;
/** Gap between icons and at both ends */
const GAP = 4;
const PADDING_TOP = 3;
/** Room under the icons for the running triangle */
const PADDING_BOTTOM = 6;
const SEPARATOR_WIDTH = 13;
const RADIUS = 8;
const BADGE_HEIGHT = 20;

export const DOCK_HEIGHT = PADDING_TOP + DOCK_ICON_SIZE + PADDING_BOTTOM;

export interface DockItem {
  /** 'finder' is the vector smiley; the rest come from assets/reference/mac-os-x/icons/ */
  icon: AppIconName | 'finder';
  running?: boolean;
}

interface ItemView {
  /** The icon (moves when bouncing); origin at the middle of its bottom edge so it squashes from there */
  icon: Container;
  /** Wraps the picture inside `icon`; scaled for the combo swell so it doesn't fight the bounce's squash */
  swell: Container;
  indicator: Graphics;
  /** Badge; origin at its centre */
  badge: Container;
  badgeShape: Graphics;
  badgeText: Text;
  badgeCount: number;
  centerX: number;
}

export class Dock {
  readonly view = new Container({ label: 'dock' });
  readonly width: number;
  private readonly items: ItemView[] = [];
  private readonly separatorX: number;
  private readonly trashX: number;
  private readonly trashEmpty: Graphics;
  private readonly trashFull: Graphics;

  /** Top left at (0, 0); the caller centres it on the bottom of the screen */
  constructor(items: readonly DockItem[]) {
    this.width =
      GAP + items.length * (DOCK_ICON_SIZE + GAP) + SEPARATOR_WIDTH + DOCK_ICON_SIZE + GAP;

    // It sits on the bottom edge, so the lower corners are drawn off screen
    const shelf = new Graphics()
      .roundRect(0, 0, this.width, DOCK_HEIGHT + RADIUS, RADIUS)
      .fill({ fill: stripes(AQUA.stripe), alpha: 0.5 })
      .roundRect(0.5, 0.5, this.width - 1, DOCK_HEIGHT + RADIUS, RADIUS)
      .stroke({ width: 1, color: AQUA.dock.edge, alpha: 0.65 })
      .roundRect(-0.5, -0.5, this.width + 1, DOCK_HEIGHT + RADIUS + 1, RADIUS + 1)
      .stroke({ width: 1, color: AQUA.shadow, alpha: 0.18 });
    this.view.addChild(shelf);

    const iconLayer = new Container({ label: 'icons' });
    const overlay = new Container({ label: 'indicators-and-badges' });
    let x = GAP;
    for (const item of items) {
      const graphic =
        item.icon === 'finder'
          ? drawFinderIcon(DOCK_ICON_SIZE)
          : appIcon(item.icon, DOCK_ICON_SIZE);
      graphic.position.set(-DOCK_ICON_SIZE / 2, -DOCK_ICON_SIZE);
      const icon = new Container({ label: `dock-${item.icon}` });
      const swell = new Container({ label: 'swell' });
      swell.addChild(graphic);
      icon.addChild(swell);
      const centerX = x + DOCK_ICON_SIZE / 2;
      icon.position.set(centerX, PADDING_TOP + DOCK_ICON_SIZE);
      iconLayer.addChild(icon);

      const y = DOCK_HEIGHT - 1;
      const indicator = new Graphics()
        .poly([centerX - 3.5, y, centerX + 3.5, y, centerX, y - 4])
        .fill(AQUA.dock.indicator);
      indicator.visible = item.running ?? false;

      const badgeText = aquaText('', { size: 12, bold: true, color: AQUA.white });
      badgeText.anchor.set(0.5);
      const badgeShape = new Graphics();
      const badge = new Container({ label: 'badge' });
      badge.addChild(badgeShape, badgeText);
      badge.position.set(x + DOCK_ICON_SIZE - 6, PADDING_TOP + 6);
      badge.visible = false;

      overlay.addChild(indicator, badge);
      this.items.push({
        icon,
        swell,
        indicator,
        badge,
        badgeShape,
        badgeText,
        badgeCount: 0,
        centerX,
      });
      x += DOCK_ICON_SIZE + GAP;
    }

    // Divider: a dark line beside a light one
    this.separatorX = x + (SEPARATOR_WIDTH - GAP) / 2;
    const separator = new Graphics()
      .rect(this.separatorX, 6, 1, DOCK_HEIGHT - 10)
      .fill({ color: AQUA.shadow, alpha: 0.35 })
      .rect(this.separatorX + 1, 6, 1, DOCK_HEIGHT - 10)
      .fill({ color: AQUA.white, alpha: 0.6 });
    x += SEPARATOR_WIDTH;

    this.trashX = x;
    this.trashEmpty = drawTrashIcon(DOCK_ICON_SIZE);
    this.trashFull = drawTrashIcon(DOCK_ICON_SIZE, { full: true });
    this.trashEmpty.position.set(x, PADDING_TOP);
    this.trashFull.position.set(x, PADDING_TOP);
    this.trashFull.visible = false;

    this.view.addChild(separator, this.trashEmpty, this.trashFull, iconLayer, overlay);
  }

  /** Centre of icon `index` (Dock coordinates) */
  iconCenter(index: number): { x: number; y: number } {
    return { x: this.items[index]!.centerX, y: PADDING_TOP + DOCK_ICON_SIZE / 2 };
  }

  /** Where minimised windows shrink to: beside the divider (the original lines them up between it and the Trash) */
  minimizeTarget(): { x: number; y: number } {
    return { x: this.separatorX, y: PADDING_TOP + DOCK_ICON_SIZE / 2 };
  }

  /** Centre of the Trash icon (Dock coordinates) */
  trashCenter(): { x: number; y: number } {
    return { x: this.trashX + DOCK_ICON_SIZE / 2, y: PADDING_TOP + DOCK_ICON_SIZE / 2 };
  }

  /** Empty or full Trash */
  setTrashFull(full: boolean): void {
    this.trashEmpty.visible = !full;
    this.trashFull.visible = full;
  }

  /** How far the icon is off the Dock (bounce) and how much it squashes on landing (0–1) */
  setLift(index: number, lift: number, squash = 0): void {
    const icon = this.items[index]!.icon;
    icon.y = PADDING_TOP + DOCK_ICON_SIZE - lift;
    icon.scale.set(1 + 0.12 * squash, 1 - 0.12 * squash);
  }

  /** Number of application icons (the Trash not included) */
  get iconCount(): number {
    return this.items.length;
  }

  /** Enlarges icon `index` from its bottom centre by `amount` (0 = normal size), like Dock magnification (doc/combo.md) */
  setSwell(index: number, amount: number): void {
    // The picture sits above and centred on the wrapper's origin, so scaling the wrapper grows it from the bottom centre
    this.items[index]!.swell.scale.set(1 + amount);
  }

  setRunning(index: number, running: boolean): void {
    this.items[index]!.indicator.visible = running;
  }

  /** Unread badge; 0 hides it. `pop` (0–1) briefly enlarges it when the number changes */
  setBadge(index: number, count: number, pop = 0): void {
    const item = this.items[index]!;
    item.badge.visible = count > 0;
    item.badge.scale.set(1 + 0.35 * pop);
    if (count === item.badgeCount) return;
    item.badgeCount = count;
    if (count <= 0) return;
    item.badgeText.text = String(count);
    const width = Math.max(BADGE_HEIGHT, item.badgeText.width + 12);
    const inner = BADGE_HEIGHT - 4;
    item.badgeShape
      .clear()
      .roundRect(-width / 2, -BADGE_HEIGHT / 2 + 1, width, BADGE_HEIGHT, BADGE_HEIGHT / 2)
      .fill({ color: AQUA.shadow, alpha: 0.3 })
      .roundRect(-width / 2, -BADGE_HEIGHT / 2, width, BADGE_HEIGHT, BADGE_HEIGHT / 2)
      .fill(AQUA.white)
      .roundRect(-width / 2 + 2, -inner / 2, width - 4, inner, inner / 2)
      .fill(
        vGradient([
          [0, AQUA.badge.top],
          [1, AQUA.badge.bottom],
        ]),
      );
  }
}
