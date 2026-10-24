// Dock（10.0–10.2 样式）：贴着屏幕底边、水平居中的半透明白色圆角条，带淡淡的细条纹。
// 左边是程序，正在运行的程序下面有黑色小三角；废纸篓放在最右，前面有一道分隔线。
// 图标可以弹跳（requestUserAttention），可以带红色未读角标（Mail 的新邮件数）。

import { Container, Graphics, type Text } from 'pixi.js';
import { AQUA } from '../../../theme/aqua.ts';
import { appIcon, type AppIconName } from '../assets.ts';
import { drawFinderIcon, drawTrashIcon } from './icons.ts';
import { aquaText, stripes, vGradient } from './paint.ts';

export const DOCK_ICON_SIZE = 48;
/** 图标之间、图标与两端的间距 */
const GAP = 4;
const PADDING_TOP = 3;
/** 图标下方留给小三角的高度 */
const PADDING_BOTTOM = 6;
const SEPARATOR_WIDTH = 13;
const RADIUS = 8;
const BADGE_HEIGHT = 20;

export const DOCK_HEIGHT = PADDING_TOP + DOCK_ICON_SIZE + PADDING_BOTTOM;

export interface DockItem {
  /** 'finder' 用矢量画的笑脸；其余取 assets/reference/mac-os-x/icons/ */
  icon: AppIconName | 'finder';
  running?: boolean;
}

interface ItemView {
  /** 图标（弹跳时上下移动）；原点在图标底边中点，挤压时以底边为准 */
  icon: Container;
  indicator: Graphics;
  /** 角标；原点在角标中心 */
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

  /** 左上角在 (0, 0)；调用方负责把它放到屏幕底边居中 */
  constructor(items: readonly DockItem[]) {
    this.width =
      GAP + items.length * (DOCK_ICON_SIZE + GAP) + SEPARATOR_WIDTH + DOCK_ICON_SIZE + GAP;

    // 底边贴着屏幕，所以下方两角画到屏幕外
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
      icon.addChild(graphic);
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
      this.items.push({ icon, indicator, badge, badgeShape, badgeText, badgeCount: 0, centerX });
      x += DOCK_ICON_SIZE + GAP;
    }

    // 分隔线：一道暗线配一道亮线
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

  /** 第 index 个图标中心（Dock 自己的坐标） */
  iconCenter(index: number): { x: number; y: number } {
    return { x: this.items[index]!.centerX, y: PADDING_TOP + DOCK_ICON_SIZE / 2 };
  }

  /** 最小化的窗口缩进去的位置：分隔线旁边（原版的最小化窗口排在分隔线和废纸篓之间） */
  minimizeTarget(): { x: number; y: number } {
    return { x: this.separatorX, y: PADDING_TOP + DOCK_ICON_SIZE / 2 };
  }

  /** 废纸篓图标的中心（Dock 自己的坐标） */
  trashCenter(): { x: number; y: number } {
    return { x: this.trashX + DOCK_ICON_SIZE / 2, y: PADDING_TOP + DOCK_ICON_SIZE / 2 };
  }

  /** 废纸篓空 / 满 */
  setTrashFull(full: boolean): void {
    this.trashEmpty.visible = !full;
    this.trashFull.visible = full;
  }

  /** 图标离开 Dock 的高度（弹跳）和落地时的挤压量（0～1） */
  setLift(index: number, lift: number, squash = 0): void {
    const icon = this.items[index]!.icon;
    icon.y = PADDING_TOP + DOCK_ICON_SIZE - lift;
    icon.scale.set(1 + 0.12 * squash, 1 - 0.12 * squash);
  }

  setRunning(index: number, running: boolean): void {
    this.items[index]!.indicator.visible = running;
  }

  /** 未读角标：0 表示不显示。pop 是 0～1 的弹出量，数字刚变时放大一下 */
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
