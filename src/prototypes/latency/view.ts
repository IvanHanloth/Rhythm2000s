// 延迟测试的 PixiJS 画面：拍点闪光 + 偏差分布条。
// 画面只读取外部传入的拍位置（来自音频时钟），自己不计时。

import { Application, Container, Graphics, Text } from 'pixi.js';
import { INPUT_KINDS, type InputKind, type TapRecord } from './records.ts';

/** 偏差条的显示范围（毫秒）。只是可视化刻度，不代表判定窗口。 */
const RANGE_MS = 150;
const TICKS_MS = [-150, -100, -50, 0, 50, 100, 150];
/** 偏差条上最多显示最近几次输入 */
const MAX_DOTS = 40;

const COLORS = {
  background: 0x14161c,
  dim: 0x2a2e38,
  axis: 0x5a6070,
  text: 0xc8ccd6,
  beat: 0x8fb4ff,
  accent: 0xffd166,
};

export const KIND_COLORS: Record<InputKind, number> = {
  keyboard: 0x4fc3f7,
  mouse: 0xffb74d,
  touch: 0x81c784,
  pen: 0xce93d8,
};

export interface ViewState {
  /** 当前听到的拍位置（小数）；未开始时为 null */
  beatPosition: number | null;
  beatsPerBar: number;
  taps: readonly TapRecord[];
}

export class LatencyView {
  private readonly app: Application;
  private readonly shapes = new Graphics();
  private readonly labels = new Container();
  private readonly tickLabels: Text[];
  private readonly earlyLabel: Text;
  private readonly lateLabel: Text;
  private readonly hint: Text;

  private constructor(app: Application) {
    this.app = app;
    const style = { fontFamily: 'system-ui, sans-serif', fontSize: 12, fill: COLORS.text };

    this.tickLabels = TICKS_MS.map((ms) => new Text({ text: `${ms > 0 ? '+' : ''}${ms}`, style }));
    this.earlyLabel = new Text({ text: '← 早', style });
    this.lateLabel = new Text({ text: '晚 →', style });
    this.hint = new Text({
      text: '点击「开始」，然后跟着听到的拍子\n按空格键，或点击 / 触摸这里',
      style: { ...style, fontSize: 16, align: 'center' },
    });
    for (const label of [...this.tickLabels, this.earlyLabel, this.lateLabel, this.hint]) {
      label.anchor.set(0.5, 0);
      this.labels.addChild(label);
    }

    app.stage.addChild(this.shapes, this.labels);
  }

  static async create(host: HTMLElement): Promise<LatencyView> {
    const app = new Application();
    await app.init({
      resizeTo: host,
      background: COLORS.background,
      antialias: true,
      autoDensity: true,
      resolution: window.devicePixelRatio,
    });
    host.appendChild(app.canvas);
    return new LatencyView(app);
  }

  /** 每帧回调，回调里拿到的是 Pixi 的 requestAnimationFrame 节奏。 */
  onFrame(callback: () => void): void {
    this.app.ticker.add(callback);
  }

  update({ beatPosition, beatsPerBar, taps }: ViewState): void {
    const { width, height } = this.app.screen;
    const g = this.shapes.clear();

    // ---- 拍点闪光 ----
    const cx = width / 2;
    const cy = height * 0.32;
    const radius = Math.max(24, Math.min(width, height) * 0.14);
    let intensity = 0;
    let currentBeat = -1;
    if (beatPosition != null && beatPosition >= 0) {
      currentBeat = Math.floor(beatPosition);
      intensity = Math.exp(-(beatPosition - currentBeat) * 6);
    }
    const accent = currentBeat >= 0 && currentBeat % beatsPerBar === 0;
    const flashColor = accent ? COLORS.accent : COLORS.beat;

    g.circle(cx, cy, radius).fill(COLORS.dim);
    if (intensity > 0.01) {
      g.circle(cx, cy, radius * (1 + 0.15 * intensity)).fill({
        color: flashColor,
        alpha: intensity,
      });
    }

    // 小节内的拍位置
    const dotGap = radius * 0.5;
    const dotsY = cy + radius * 1.5;
    for (let i = 0; i < beatsPerBar; i++) {
      const x = cx + (i - (beatsPerBar - 1) / 2) * dotGap;
      const lit = currentBeat >= 0 && currentBeat % beatsPerBar === i;
      g.circle(x, dotsY, 6).fill(lit ? (i === 0 ? COLORS.accent : COLORS.beat) : COLORS.dim);
    }

    // ---- 偏差分布条 ----
    const left = width * 0.08;
    const right = width * 0.92;
    const axisY = height * 0.72;
    const toX = (ms: number) =>
      left +
      ((Math.max(-RANGE_MS, Math.min(RANGE_MS, ms)) + RANGE_MS) / (2 * RANGE_MS)) * (right - left);

    g.moveTo(left, axisY).lineTo(right, axisY).stroke({ width: 1, color: COLORS.axis });
    TICKS_MS.forEach((ms, i) => {
      const x = toX(ms);
      const tall = ms === 0;
      g.moveTo(x, axisY - (tall ? 40 : 6))
        .lineTo(x, axisY + 6)
        .stroke({ width: tall ? 2 : 1, color: COLORS.axis });
      this.tickLabels[i]!.position.set(x, axisY + 10);
    });
    this.earlyLabel.position.set(left + 20, axisY + 28);
    this.lateLabel.position.set(right - 20, axisY + 28);

    // 每种输入一行，越新的点越亮；超出范围的点画在边缘、改成方块
    const recent = taps.slice(-MAX_DOTS);
    recent.forEach((tap, i) => {
      const offset = tap.offsetA ?? tap.offsetB;
      const row = INPUT_KINDS.indexOf(tap.kind);
      const y = axisY - 12 - row * 9;
      const x = toX(offset);
      const alpha = 0.25 + 0.75 * ((i + 1) / recent.length);
      const color = KIND_COLORS[tap.kind];
      if (Math.abs(offset) > RANGE_MS) {
        g.rect(x - 4, y - 4, 8, 8).fill({ color, alpha });
      } else {
        g.circle(x, y, 4).fill({ color, alpha });
      }
    });

    this.hint.visible = beatPosition == null;
    this.hint.position.set(cx, cy - 22);
  }
}
