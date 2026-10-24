// 轮次横幅：Follow me（示范小节）/ Your turn（跟打小节）。原点在横幅中心。
// 颜色由场景按自己的主题传入；Your turn 用强调色，比 Follow me 醒目。

import { Container, Graphics, Text } from 'pixi.js';
import type { Turn } from '../rhythm/turn-cue.ts';
import { FONT_FAMILIES } from '../theme/tokens.ts';

export interface TurnBannerStyle {
  fill: string;
  text: string;
  line: string;
}

export interface TurnBannerColors {
  call: TurnBannerStyle;
  response: TurnBannerStyle;
}

const LABELS: Record<Turn, string> = {
  call: 'Follow me',
  response: 'Your turn',
};

const WIDTH = 240;
const HEIGHT = 48;

export class TurnBanner {
  readonly view = new Container({ label: 'turn-banner' });
  private readonly faces: Record<Turn, Container>;

  constructor(colors: TurnBannerColors) {
    this.faces = {
      call: drawFace(LABELS.call, colors.call),
      response: drawFace(LABELS.response, colors.response),
    };
    this.view.addChild(this.faces.call, this.faces.response);
    this.show(null);
  }

  /** 显示哪一面；null 表示隐藏。squash 是 0～1 的挤压量，0 表示原样。 */
  show(turn: Turn | null, squash = 0): void {
    this.view.visible = turn !== null;
    this.faces.call.visible = turn === 'call';
    this.faces.response.visible = turn === 'response';
    this.view.scale.set(1 + 0.2 * squash, 1 - 0.2 * squash);
  }
}

function drawFace(label: string, style: TurnBannerStyle): Container {
  const face = new Container({ label: `turn-${label}` });
  const pill = new Graphics()
    .roundRect(-WIDTH / 2, -HEIGHT / 2, WIDTH, HEIGHT, HEIGHT / 2)
    .fill(style.fill)
    .stroke({ width: 2, color: style.line, alignment: 1 });
  const text = new Text({
    text: label,
    style: { fontFamily: FONT_FAMILIES.display, fontSize: 28, fontWeight: '800', fill: style.text },
  });
  text.anchor.set(0.5);
  face.addChild(pill, text);
  return face;
}
