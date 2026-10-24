// 菜单栏：22 像素高的白色细条纹，横贯屏幕顶端。左边蓝色苹果、加粗的程序名和各菜单，右边时钟。
// 菜单名用简体中文版 Finder 的说法。

import { Container, Graphics, type Text } from 'pixi.js';
import { AQUA } from '../../../theme/aqua.ts';
import { drawAppleLogo } from './icons.ts';
import { aquaText, stripes, vGradient } from './paint.ts';

export const MENU_BAR_HEIGHT = 22;
const APPLE_X = 14;
const FIRST_MENU_X = 40;
/** 菜单名左右各留的空白 */
const MENU_PADDING = 10;
const CLOCK_RIGHT = 14;
const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

export interface MenuBarOptions {
  width: number;
  /** 当前程序名，加粗显示在苹果右边 */
  appName: string;
  menus: readonly string[];
}

export class MenuBar {
  readonly view = new Container({ label: 'menu-bar' });
  private readonly clock: Text;
  private clockLabel = '';

  constructor({ width, appName, menus }: MenuBarOptions) {
    const bar = new Graphics()
      .rect(0, 0, width, MENU_BAR_HEIGHT)
      .fill(stripes(AQUA.menuStripe))
      .rect(0, MENU_BAR_HEIGHT - 1, width, 1)
      .fill(AQUA.separator)
      // 菜单栏下沿的一道浅影
      .rect(0, MENU_BAR_HEIGHT, width, 3)
      .fill(
        vGradient([
          [0, 'rgba(0,0,0,0.22)'],
          [1, 'rgba(0,0,0,0)'],
        ]),
      );

    const apple = drawAppleLogo(17);
    apple.position.set(APPLE_X, 2);

    this.view.addChild(bar, apple);

    let x = FIRST_MENU_X;
    [appName, ...menus].forEach((name, i) => {
      const text = aquaText(name, { size: 14, bold: i === 0 });
      text.anchor.set(0, 0.5);
      text.position.set(x + MENU_PADDING, MENU_BAR_HEIGHT / 2);
      x += text.width + MENU_PADDING * 2;
      this.view.addChild(text);
    });

    this.clock = aquaText('', { size: 14 });
    this.clock.anchor.set(1, 0.5);
    this.clock.position.set(width - CLOCK_RIGHT, MENU_BAR_HEIGHT / 2);
    this.view.addChild(this.clock);
  }

  /** 显示本机时间，例如「周四 下午3:01」。分钟变了才重画文字。 */
  update(now: Date): void {
    const hours = now.getHours();
    const label = `${WEEKDAYS[now.getDay()]} ${hours < 12 ? '上午' : '下午'}${hours % 12 || 12}:${String(now.getMinutes()).padStart(2, '0')}`;
    if (label === this.clockLabel) return;
    this.clockLabel = label;
    this.clock.text = label;
  }
}
