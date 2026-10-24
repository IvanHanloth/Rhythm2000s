// 场景：2000 年前后的 Mac 桌面（doc/scenes/mac-2000.md）。
// 目前是占位，只做水晶（早期 Aqua）主题（ADR 0002）：渐变桌面和顶部细条纹菜单栏，全部原创绘制。

import { Container, FillGradient, Graphics, Text } from 'pixi.js';
import type { Scene, SceneEntry } from '../../game/scene.ts';
import { DESIGN_HEIGHT, DESIGN_WIDTH } from '../../game/layout.ts';
import { FONT_FAMILIES, THEMES } from '../../theme/tokens.ts';
import { createPlaceholderLabel } from '../placeholder-label.ts';

const theme = THEMES.aqua;
const MENU_BAR_HEIGHT = 24;
const MENU_ITEMS = ['文件', '编辑', '显示', '窗口', '帮助'];

class Mac2000Scene implements Scene {
  readonly view = new Container({ label: 'mac-2000' });
  private readonly desktopFill = new FillGradient({
    end: { x: 0, y: 1 },
    colorStops: [
      { offset: 0, color: theme.desktop },
      { offset: 1, color: theme.desktopHorizon },
    ],
  });

  constructor() {
    const wallpaper = new Graphics().rect(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT).fill(this.desktopFill);

    const menuBar = new Graphics().rect(0, 0, DESIGN_WIDTH, MENU_BAR_HEIGHT).fill(theme.surface);
    // 水晶风格的横向细条纹
    for (let y = 1; y < MENU_BAR_HEIGHT; y += 2) {
      menuBar.rect(0, y, DESIGN_WIDTH, 1);
    }
    menuBar
      .fill(theme.surfaceAlt)
      .rect(0, MENU_BAR_HEIGHT - 1, DESIGN_WIDTH, 1)
      .fill(theme.lineSoft);

    const menuItems = new Container({ label: 'menu-items' });
    let x = 20;
    for (const item of MENU_ITEMS) {
      const text = new Text({
        text: item,
        style: { fontFamily: FONT_FAMILIES.ui, fontSize: 14, fill: theme.ink },
      });
      text.anchor.set(0, 0.5);
      text.position.set(x, MENU_BAR_HEIGHT / 2);
      x += text.width + 24;
      menuItems.addChild(text);
    }

    this.view.addChild(
      wallpaper,
      menuBar,
      menuItems,
      createPlaceholderLabel('Mac 桌面（水晶）', theme.highlight),
    );
  }

  update(): void {
    // 占位场景没有动画
  }

  destroy(): void {
    this.view.destroy({ children: true });
    this.desktopFill.destroy();
  }
}

export const mac2000Scene: SceneEntry = {
  id: 'mac-2000',
  label: 'Mac 桌面（水晶）',
  create: () => new Mac2000Scene(),
};
