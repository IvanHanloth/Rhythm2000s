// 判定字样：Perfect! / Good / Miss，三套主题外观相同（设计系统提案的 Judgement 组件）。
// 等级必须靠文字读出来，颜色只是加强。

import { Container, Graphics, Text } from 'pixi.js';
import type { JudgementLevel } from '../rhythm/judge.ts';
import { FONT_FAMILIES, JUDGEMENT_COLORS } from '../theme/tokens.ts';

const LABELS: Record<JudgementLevel, string> = {
  perfect: 'Perfect!',
  good: 'Good',
  miss: 'Miss',
};

const COLORS: Record<JudgementLevel, { fill: string; text: string }> = {
  perfect: { fill: JUDGEMENT_COLORS.perfect, text: JUDGEMENT_COLORS.onPerfect },
  good: { fill: JUDGEMENT_COLORS.good, text: JUDGEMENT_COLORS.onGood },
  miss: { fill: JUDGEMENT_COLORS.miss, text: JUDGEMENT_COLORS.onMiss },
};

const PADDING_X = 20;
const HEIGHT = 56;

/** 以中心为原点的判定字样，挤压、淡出由使用方按拍计算。 */
export function createJudgementView(level: JudgementLevel): Container {
  const view = new Container({ label: `judgement-${level}` });
  const { fill, text: textColor } = COLORS[level];

  // 字号与字重取自设计系统的 judgement 字样
  const text = new Text({
    text: LABELS[level],
    style: { fontFamily: FONT_FAMILIES.display, fontSize: 40, fontWeight: '800', fill: textColor },
  });
  text.anchor.set(0.5);

  const width = text.width + PADDING_X * 2;
  const pill = new Graphics()
    .roundRect(-width / 2, -HEIGHT / 2, width, HEIGHT, HEIGHT / 2)
    .fill(fill);

  view.addChild(pill, text);
  return view;
}
