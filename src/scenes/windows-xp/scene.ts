// 场景：Windows XP 桌面（doc/scenes/windows-xp.md）。
// 目前是占位：蓝天草地的桌面背景和底部任务栏，全部原创绘制。

import { Container, FillGradient, Graphics, Text } from 'pixi.js';
import type { Scene, SceneEntry } from '../../game/scene.ts';
import { DESIGN_HEIGHT, DESIGN_WIDTH } from '../../game/layout.ts';
import { FONT_FAMILIES, THEMES } from '../../theme/tokens.ts';
import { createPlaceholderLabel } from '../placeholder-label.ts';

const theme = THEMES.xp;
const TASKBAR_HEIGHT = 40;
const START_BUTTON_WIDTH = 110;

class WindowsXpScene implements Scene {
  readonly view = new Container({ label: 'windows-xp' });
  private readonly taskbarFill = new FillGradient({
    end: { x: 0, y: 1 },
    colorStops: [
      { offset: 0, color: theme.titlebarHi },
      { offset: 1, color: theme.titlebar },
    ],
  });

  constructor() {
    const taskbarTop = DESIGN_HEIGHT - TASKBAR_HEIGHT;

    const wallpaper = new Graphics()
      .rect(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT)
      .fill(theme.desktop)
      // 一道平缓的草坡
      .moveTo(0, 520)
      .bezierCurveTo(360, 430, 820, 440, DESIGN_WIDTH, 500)
      .lineTo(DESIGN_WIDTH, DESIGN_HEIGHT)
      .lineTo(0, DESIGN_HEIGHT)
      .closePath()
      .fill(theme.desktopHorizon);

    const taskbar = new Graphics()
      .rect(0, taskbarTop, DESIGN_WIDTH, TASKBAR_HEIGHT)
      .fill(this.taskbarFill)
      // 「开始」按钮只圆右侧两个角：左侧圆角画在舞台外，被舞台裁掉
      .roundRect(-16, taskbarTop, START_BUTTON_WIDTH + 16, TASKBAR_HEIGHT, 14)
      .fill(theme.desktopHorizon);

    // 20px 粗体属于大字号，白字在草绿底上满足 3:1
    const startLabel = new Text({
      text: '开始',
      style: {
        fontFamily: FONT_FAMILIES.ui,
        fontSize: 20,
        fontWeight: '700',
        fill: theme.highlight,
      },
    });
    startLabel.anchor.set(0.5);
    startLabel.position.set(START_BUTTON_WIDTH / 2, taskbarTop + TASKBAR_HEIGHT / 2);

    this.view.addChild(
      wallpaper,
      taskbar,
      startLabel,
      createPlaceholderLabel('Windows XP 桌面', theme.highlight),
    );
  }

  update(): void {
    // 占位场景没有动画
  }

  destroy(): void {
    this.view.destroy({ children: true });
    this.taskbarFill.destroy();
  }
}

export const windowsXpScene: SceneEntry = {
  id: 'windows-xp',
  label: 'Windows XP 桌面',
  create: () => new WindowsXpScene(),
};
