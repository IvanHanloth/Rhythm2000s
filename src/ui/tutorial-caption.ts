// 系统演示的提示条（doc/level-design.md「规则 1」）：放在 Follow me / Your turn 横幅右边。
// 第一行「Practice 2 of 4 · Volume」（重来时「Try again · Volume」），第二行写怎么处理。
// 颜色和轮次横幅「Follow me」一面相同，由场景按自己的主题传入。原点在提示条左边的竖直中点。

import { Container, Graphics, Text } from 'pixi.js';
import { FONT_FAMILIES } from '../theme/tokens.ts';
import type { TurnBannerStyle } from './turn-banner.ts';

const WIDTH = 460;
const HEIGHT = 56;
const PADDING_X = 18;

export interface TutorialCaptionContent {
  /** 第一行，例如「Practice 2 of 4 · Volume」 */
  title: string;
  /** 第二行，例如「Press on the beat, release one beat later」 */
  how: string;
}

export class TutorialCaption {
  readonly view = new Container({ label: 'tutorial-caption' });
  private readonly title: Text;
  private readonly how: Text;

  constructor(style: TurnBannerStyle) {
    const pill = new Graphics()
      .roundRect(0, -HEIGHT / 2, WIDTH, HEIGHT, HEIGHT / 2)
      .fill(style.fill)
      .stroke({ width: 2, color: style.line, alignment: 1 });
    this.title = new Text({
      text: '',
      style: {
        fontFamily: FONT_FAMILIES.display,
        fontSize: 17,
        fontWeight: '800',
        fill: style.text,
      },
    });
    this.title.anchor.set(0, 1);
    this.title.position.set(PADDING_X + 6, 2);
    this.how = new Text({
      text: '',
      style: { fontFamily: FONT_FAMILIES.display, fontSize: 15, fill: style.text },
    });
    this.how.anchor.set(0, 0);
    this.how.position.set(PADDING_X + 6, 2);
    this.view.addChild(pill, this.title, this.how);
    this.show(null);
  }

  /** null 表示隐藏 */
  show(content: TutorialCaptionContent | null): void {
    this.view.visible = content !== null;
    if (!content) return;
    this.title.text = content.title;
    this.how.text = content.how;
  }
}
