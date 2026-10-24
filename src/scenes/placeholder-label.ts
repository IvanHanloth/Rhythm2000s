// 占位场景中央的标题，场景还没有正式内容时用来标明「这是哪个场景」。

import { Container, Text } from 'pixi.js';
import { DESIGN_HEIGHT, DESIGN_WIDTH } from '../game/layout.ts';
import { FONT_FAMILIES } from '../theme/tokens.ts';

export function createPlaceholderLabel(title: string, color: string): Container {
  const label = new Container({ label: 'placeholder-label' });

  // 字号和字重取自设计系统的 scene-title / body 字样
  const heading = new Text({
    text: title,
    style: { fontFamily: FONT_FAMILIES.display, fontSize: 32, fontWeight: '800', fill: color },
  });
  const note = new Text({
    text: '占位场景 · 1280×720',
    style: { fontFamily: FONT_FAMILIES.ui, fontSize: 15, fill: color },
  });
  heading.anchor.set(0.5, 1);
  note.anchor.set(0.5, 0);
  note.y = 12;
  label.addChild(heading, note);

  label.position.set(DESIGN_WIDTH / 2, DESIGN_HEIGHT * 0.4);
  return label;
}
