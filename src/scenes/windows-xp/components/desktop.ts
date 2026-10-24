// 桌面：Bliss 壁纸按比例铺满（上下略裁），左上角一列系统图标，右下角回收站。
// 图标 32 像素，下方白字带黑色阴影，和原版一样。

import { Container, Sprite } from 'pixi.js';
import { LUNA } from '../../../theme/xp-luna.ts';
import { xpAssets } from '../assets.ts';
import { WORK_AREA_HEIGHT, XP_SCREEN_HEIGHT, XP_SCREEN_WIDTH } from './screen.ts';
import { hardShadow, xpText } from './xp-text.ts';

const ICON_SIZE = 32;
/** 一个图标格子的宽、高 */
const CELL_WIDTH = 76;
const CELL_HEIGHT = 72;
const MARGIN_TOP = 8;

const LEFT_COLUMN = [
  { icon: 'my-documents', label: '我的文档' },
  { icon: 'my-computer', label: '我的电脑' },
  { icon: 'network-global', label: '网上邻居' },
  { icon: 'internet-explorer', label: 'Internet Explorer' },
];
const RECYCLE_BIN = { icon: 'recycle-bin-empty', label: '回收站' };

export class XpDesktop {
  readonly view = new Container({ label: 'desktop' });

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
    this.view.addChild(
      desktopIcon(
        RECYCLE_BIN.icon,
        RECYCLE_BIN.label,
        XP_SCREEN_WIDTH - CELL_WIDTH,
        WORK_AREA_HEIGHT - CELL_HEIGHT,
      ),
    );
  }

  destroy(): void {
    this.view.destroy({ children: true });
  }
}

/** 一个桌面图标格子，(x, y) 是格子左上角 */
function desktopIcon(icon: string, label: string, x: number, y: number): Container {
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
