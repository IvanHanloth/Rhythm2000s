// 律动组件（Beat Guide，doc/beat-guide.md）的画面：((((O)))) ——
// 中间的圆按节拍跳；每拍一对弧从两端往中间靠，拍点时合成一圈正好套住圆。平常灰色，要按的拍黄色。
// 按住（音量动作）：按下的弧和结束的弧之间连一条黄色长条，按住期间圆外面一直套着黄圈、圆保持黄色，直到结束。
// 原点在组件中心，按画布坐标画；每帧只根据当前拍位置重画。摆在画面水平正中、中线偏下（BEAT_GUIDE_POSITION）。

import { Container, Graphics } from 'pixi.js';
import {
  GUIDE_FADE_BEATS,
  GUIDE_LOOKAHEAD_BEATS,
  guideHolds,
  guideMarks,
  guidePulse,
  holdSpans,
  pressBeats,
  type HoldSpan,
} from '../rhythm/beat-guide.ts';
import type { Chart } from '../rhythm/chart.ts';
import { DESIGN_HEIGHT, DESIGN_WIDTH } from '../game/layout.ts';
import { BEAT_GUIDE_COLORS } from '../theme/tokens.ts';

/** 组件中心在画布上的位置：水平正中，垂直在中线偏下（doc/beat-guide.md） */
export const BEAT_GUIDE_POSITION = { x: DESIGN_WIDTH / 2, y: DESIGN_HEIGHT - 200 };

/** 中间圆的半径 */
const CORE_RADIUS = 18;
/** 拍点时那一圈弧的半径（套在圆外面） */
const RING_RADIUS = 32;
/** 每差一拍，弧离中心远多少 */
const BEAT_SPACING = 56;
/** 每段弧的张角（弧度，单侧）；左右两段合起来接近一整圈 */
const ARC_HALF_ANGLE = (70 * Math.PI) / 180;
const ARC_WIDTH = 7;
/** 中间圆在拍点放大多少倍 */
const PULSE_SCALE = 0.45;
/** 弧在最远处的头一拍里淡入 */
const FADE_IN_BEATS = 1;
/** 按住长条的粗细、透明度；结束拍的弧比要按的拍细 */
const HOLD_BAR_HEIGHT = 28;
const HOLD_BAR_ALPHA = 0.6;
const HOLD_END_WIDTH = 4;

export class BeatGuideView {
  readonly view = new Container({ label: 'beat-guide' });
  private readonly arcs = new Graphics();
  private readonly core = new Graphics();
  private presses: readonly number[] = [];
  private holds: readonly HoldSpan[] = [];
  private endBeat = 0;

  constructor() {
    // 没有底板，直接画在桌面上（doc/beat-guide.md）
    this.view.addChild(this.arcs, this.core);
    this.view.visible = false;
  }

  /** 换一局（正文或演示的小谱面）：算出要按的拍和按住的各段 */
  setRound(chart: Chart): void {
    this.presses = pressBeats(chart);
    this.holds = holdSpans(chart);
    this.endBeat = chart.endBeat;
  }

  /** 每帧调用：beat 是当前（听到的）拍位置 */
  update(beat: number): void {
    const g = this.arcs.clear();
    const press = BEAT_GUIDE_COLORS.press;

    // 按住长条画在最底下：左右各一条，从按下的弧外沿到结束的弧外沿
    let holding = false;
    for (const hold of guideHolds(beat, this.holds)) {
      holding ||= hold.active;
      const near = RING_RADIUS + hold.from * BEAT_SPACING;
      const far = RING_RADIUS + hold.to * BEAT_SPACING;
      const y = -HOLD_BAR_HEIGHT / 2;
      g.roundRect(-far, y, far - near, HOLD_BAR_HEIGHT, HOLD_BAR_HEIGHT / 2)
        .roundRect(near, y, far - near, HOLD_BAR_HEIGHT, HOLD_BAR_HEIGHT / 2)
        .fill({ color: press, alpha: HOLD_BAR_ALPHA });
    }
    // 正在按住：圆外面一直套着一圈黄圈
    if (holding) g.circle(0, 0, RING_RADIUS).stroke({ width: ARC_WIDTH, color: press });

    for (const mark of guideMarks(beat, this.endBeat, this.presses, this.holds)) {
      const { distance } = mark;
      const yellow = mark.press || mark.holdEnd;
      const color = yellow ? press : BEAT_GUIDE_COLORS.idle;
      const alpha =
        distance < 0
          ? 1 - Math.min(1, -distance / GUIDE_FADE_BEATS)
          : Math.min(1, (GUIDE_LOOKAHEAD_BEATS - distance) / FADE_IN_BEATS);
      // 过了拍点不再往里走，停在圆外淡掉
      const offset = Math.max(0, distance) * BEAT_SPACING;
      const width = mark.holdEnd ? HOLD_END_WIDTH : ARC_WIDTH;
      const stroke = { width, color, alpha, cap: 'round' as const };
      // 左边 (：圆心往左挪 offset 的一段左半圆
      arc(g, -offset, Math.PI - ARC_HALF_ANGLE, Math.PI + ARC_HALF_ANGLE).stroke(stroke);
      // 右边 )：往右挪的一段右半圆
      arc(g, offset, -ARC_HALF_ANGLE, ARC_HALF_ANGLE).stroke(stroke);
    }

    const pulse = guidePulse(beat, this.presses, this.holds);
    const radius = CORE_RADIUS * (1 + PULSE_SCALE * pulse.strength);
    this.core
      .clear()
      .circle(0, 0, radius)
      .fill(pulse.press ? BEAT_GUIDE_COLORS.press : BEAT_GUIDE_COLORS.core);
  }
}

/** 圆心在 (cx, 0)、半径 RING_RADIUS 的一段弧；先 moveTo 起点，免得和上一段连起来 */
function arc(g: Graphics, cx: number, start: number, end: number): Graphics {
  return g
    .moveTo(cx + RING_RADIUS * Math.cos(start), RING_RADIUS * Math.sin(start))
    .arc(cx, 0, RING_RADIUS, start, end);
}
