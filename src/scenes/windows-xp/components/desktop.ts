// 桌面：Bliss 壁纸按比例铺满（上下略裁），左上角一列系统图标，右下角回收站。
// 图标 32 像素，下方白字带黑色阴影，和原版一样。

import { Container, Sprite } from 'pixi.js';
import { LUNA } from '../../../theme/xp-luna.ts';
import { xpAssets } from '../assets.ts';
import { WORK_AREA_HEIGHT, XP_SCREEN_HEIGHT, XP_SCREEN_WIDTH } from './screen.ts';
import { hardShadow, xpText } from './xp-text.ts';

export const DESKTOP_ICON_SIZE = 32;
const ICON_SIZE = DESKTOP_ICON_SIZE;
/** 一个图标格子的宽、高 */
export const DESKTOP_CELL_WIDTH = 76;
export const DESKTOP_CELL_HEIGHT = 72;
const CELL_WIDTH = DESKTOP_CELL_WIDTH;
const CELL_HEIGHT = DESKTOP_CELL_HEIGHT;
const MARGIN_TOP = 8;

const LEFT_COLUMN = [
  { icon: 'my-documents', label: 'My Documents' },
  { icon: 'my-computer', label: 'My Computer' },
  { icon: 'network-global', label: 'My Network Places' },
  { icon: 'internet-explorer', label: 'Internet Explorer' },
];
const RECYCLE_BIN = { icon: 'recycle-bin-empty', label: 'Recycle Bin' };

export class XpDesktop {
  readonly view = new Container({ label: 'desktop' });
  /** 回收站图标中心（虚拟屏幕坐标），文件扔进回收站时飞向这里 */
  readonly recycleBinCenter = {
    x: XP_SCREEN_WIDTH - CELL_WIDTH / 2,
    y: WORK_AREA_HEIGHT - CELL_HEIGHT + 2 + DESKTOP_ICON_SIZE / 2,
  };
  private readonly recycleBinIcon: Sprite;
  private recycleBinFull = false;

  constructor() {
    const assets = xpAssets();
    const wallpaper = new Sprite(assets.wallpaper);
    const scale = Math.max(
      XP_SCREEN_WIDTH / wallpaper.texture.width,
      XP_SCREEN_HEIGHT / wallpaper.texture.height,
    );
    wallpaper.scale.set(scale);
    wallpaper.anchor.set(0.5);
    wallpaper.position.set(XP_SCREEN_WIDTH / 2, XP_SCREEN_HEIGHT / 2);
    this.view.addChild(wallpaper);

    LEFT_COLUMN.forEach((item, i) => {
      this.view.addChild(desktopIcon(item.icon, item.label, 0, MARGIN_TOP + i * CELL_HEIGHT));
    });
    const recycleBin = desktopIcon(
      RECYCLE_BIN.icon,
      RECYCLE_BIN.label,
      XP_SCREEN_WIDTH - CELL_WIDTH,
      WORK_AREA_HEIGHT - CELL_HEIGHT,
    );
    this.recycleBinIcon = recycleBin.children[0] as Sprite;
    this.view.addChild(recycleBin);
  }

  /** 回收站里有没有东西：空的是空纸篓，有东西是满纸篓 */
  setRecycleBinFull(full: boolean): void {
    if (this.recycleBinFull === full) return;
    this.recycleBinFull = full;
    this.recycleBinIcon.texture = xpAssets().icon(full ? 'recycle-bin-full' : 'recycle-bin-empty');
  }

  /** 显示 / 隐藏桌面图标（壁纸不变）。桌面「刷新」时图标会消失一下再出现 */
  setIconsVisible(visible: boolean): void {
    for (const child of this.view.children) {
      if (child.label.startsWith('desktop-icon-')) child.visible = visible;
    }
  }

  destroy(): void {
    this.view.destroy({ children: true });
  }
}

/** 一个桌面图标格子，(x, y) 是格子左上角；第一个子节点是图标 Sprite */
export function desktopIcon(icon: string, label: string, x: number, y: number): Container {
  const cell = new Container({ label: `desktop-icon-${icon}` });
  cell.position.set(x, y);

  const sprite = new Sprite(xpAssets().icon(icon));
  sprite.setSize(ICON_SIZE);
  sprite.position.set((CELL_WIDTH - ICON_SIZE) / 2, 2);

  const text = xpText(label, {
    fill: LUNA.white,
    align: 'center',
    wordWrap: true,
    wordWrapWidth: CELL_WIDTH - 4,
    breakWords: true,
    lineHeight: 14,
    dropShadow: hardShadow(LUNA.desktopTextShadow),
  });
  text.anchor.set(0.5, 0);
  text.position.set(CELL_WIDTH / 2, ICON_SIZE + 6);

  cell.addChild(sprite, text);
  return cell;
}
