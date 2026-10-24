// The demo caption (doc/level-design.md "Rule 1"), right of the Follow me / Your turn banner:
// "Practice 2 of 4 · Volume" (or "Try again · Volume") over how to handle the action, with the skip key at the top right.
// Coloured like the banner's call side, as given by the scene. Origin at the left edge, vertically centred.

import { Container, Graphics, Text } from 'pixi.js';
import { FONT_FAMILIES } from '@/theme/tokens.ts';
import type { TurnBannerStyle } from './turn-banner.ts';

const WIDTH = 460;
const HEIGHT = 56;
const PADDING_X = 18;
/** The key that skips the tutorial (handled by the level scene) */
const SKIP_HINT = 'Backspace: skip';

export interface TutorialCaptionContent {
  /** First line, e.g. "Practice 2 of 4 · Volume" */
  title: string;
  /** Second line, e.g. "Grab the slider on the beat" */
  how: string;
}

export class TutorialCaption {
  readonly view = new Container({ label: 'tutorial-caption' });
  private readonly title: Text;
  private readonly how: Text;
  private readonly skip: Text;

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
    this.skip = new Text({
      text: SKIP_HINT,
      style: { fontFamily: FONT_FAMILIES.display, fontSize: 13, fill: style.text },
    });
    this.skip.anchor.set(1, 1);
    this.skip.position.set(WIDTH - PADDING_X - 6, 1);
    this.skip.alpha = 0.7;
    this.view.addChild(pill, this.title, this.how, this.skip);
    this.show(null);
  }

  /** null hides it */
  show(content: TutorialCaptionContent | null): void {
    this.view.visible = content !== null;
    if (!content) return;
    this.title.text = content.title;
    this.how.text = content.how;
  }
}
