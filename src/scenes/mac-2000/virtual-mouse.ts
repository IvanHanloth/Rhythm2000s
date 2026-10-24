// 一局里的虚拟鼠标（doc/scenes/mac-2000.md「虚拟鼠标」），做法与 XP 场景相同：
// 示范段：鼠标自己示范，在拍点上停在新出现的目标上；menu-apple、sheet-save 在拍点上点、0.5 拍后再点一下；
// menu-volume 在拍点上按住滑块，1 拍里拖到顶再松开。
// 跟打段：提前滑到下一个目标上停好，玩家按键时在原地点下去，判定完才离开。
// 画面每帧只根据拍位置计算。坐标都是虚拟 Mac 屏幕坐标。

import { Container } from 'pixi.js';
import { secondsPerBeat } from '../../rhythm/beat.ts';
import { MVP_WINDOWS } from '../../rhythm/judge.ts';
// 轨迹算法和 XP 共用（不依赖 PixiJS 的纯函数）
import {
  cursorAt,
  returnToCenterStops,
  turnGaps,
  type CursorStop,
  type Point,
} from '../windows-xp/cursor-path.ts';
import { drawArrowCursor } from './components/icons.ts';
import type { MacSession, MacTarget } from './session.ts';

/** 一局开始前、结束后鼠标停的位置：屏幕中央偏右下 */
const HOME: Point = { x: 700, y: 400 };
/** 示范完回到的屏幕中央：1024×576 虚拟屏幕里菜单栏和 Dock 之间的中心 */
const CENTER: Point = { x: 512, y: 270 };
/** 点下去时指针缩一下的时长（拍） */
const PRESS_BEATS = 1 / 8;
/** 示范段点完以后停多久再走（拍） */
const HOLD_BEATS = 1 / 16;

/** 一个目标每一下要点的位置（虚拟屏幕坐标），由画面那边给出 */
export type MacClickPoints = (target: MacTarget, event: number) => Point[];
/** 长按拖动滑块的进度（0～1），不在拖时为 null；由画面那边给出，指针和滑块走同一条路 */
export type MacDragProgress = (event: number, beat: number) => number | null;

interface StopSource {
  stop: CursorStop;
  /** 跟打段的停靠点：等这一下判定完才离开 */
  click?: { event: number; step: number };
}

export class MacVirtualMouse {
  readonly view = new Container({ label: 'virtual-mouse' });
  private readonly pointer = drawArrowCursor();
  private readonly session: MacSession;
  private readonly stops: StopSource[];
  /** 每个目标每一下的位置；长按时在第一下和第二下的位置之间拖 */
  private readonly points: Point[][] = [];
  private readonly drag: MacDragProgress;
  /** 示范段虚拟鼠标真的点下去的拍位置（menu-apple 的两下） */
  private readonly demoClicks: number[] = [];
  /** 提前多少拍到位：Good 判定窗口 + 1/16 拍，保证最早的有效输入也点在目标上 */
  private readonly leadBeats: number;
  private readonly goodBeats: number;

  constructor(
    session: MacSession,
    clickPoints: MacClickPoints,
    drag: MacDragProgress = () => null,
  ) {
    this.session = session;
    this.drag = drag;
    this.goodBeats = MVP_WINDOWS.good / secondsPerBeat(session.chart.bpm);
    this.leadBeats = this.goodBeats + 1 / 16;
    this.view.addChild(this.pointer);

    const stops: StopSource[] = [{ stop: { beat: -Infinity, ...HOME } }];
    session.targets.forEach((target, event) => {
      const points = clickPoints(target, event);
      this.points[event] = points;
      target.clicks.forEach((click, step) => {
        const point = points[step] ?? points[0] ?? HOME;
        // 示范段：每一下在示范拍点上停在同一个位置
        const callBeat = target.call.beat + (click.beat - target.response.beat);
        stops.push({ stop: { beat: callBeat, ...point } });
        if (target.kind === 'menu' || target.kind === 'sheet') this.demoClicks.push(callBeat);
        stops.push({ stop: { beat: click.beat, ...point }, click: { event, step } });
      });
    });
    // 示范完回到屏幕中央，跟打段再出发去目标
    const gaps = turnGaps(
      session.targets.map((target) => ({
        phrase: target.call.phrase,
        callBeats: target.clicks.map((c) => c.beat - target.response.beat + target.call.beat),
        responseBeats: target.clicks.map((c) => c.beat),
      })),
    );
    for (const stop of returnToCenterStops(gaps, CENTER)) stops.push({ stop });
    stops.push({ stop: { beat: session.chart.endBeat, ...HOME } });
    this.stops = stops.sort((a, b) => a.stop.beat - b.stop.beat);
  }

  update(beat: number): void {
    // 跟打段的停靠点：判定完（命中或 Miss）才离开，还没判定时最多停到 Good 窗口关闭
    for (const { stop, click } of this.stops) {
      if (!click) continue;
      const state = this.session.targets[click.event]!.clicks[click.step]!;
      const done = state.hitAt ?? state.missedAt;
      stop.leave = done !== null ? this.session.beatAt(done) : stop.beat + this.goodBeats;
    }
    const position = cursorAt(
      this.stops.map((s) => s.stop),
      beat,
      { leadBeats: this.leadBeats, holdBeats: HOLD_BEATS },
    );
    let pressed = this.clickBeats().some((b) => beat >= b && beat < b + PRESS_BEATS);
    // 长按：按住期间拖着滑块走，指针一直是按下的样子
    this.session.targets.forEach((target, event) => {
      if (target.kind !== 'volume') return;
      const progress = this.drag(event, beat);
      const [from, to] = this.points[event] ?? [];
      if (progress === null || !from || !to) return;
      position.x = from.x + (to.x - from.x) * progress;
      position.y = from.y + (to.y - from.y) * progress;
      pressed = true;
    });
    this.pointer.position.set(position.x, position.y);
    this.pointer.scale.set(pressed ? 0.85 : 1);
  }

  destroy(): void {
    this.view.destroy({ children: true });
  }

  /** 鼠标点下去的拍位置：示范段的 menu-apple 两下，以及跟打段每一次命中 */
  private clickBeats(): number[] {
    const beats = [...this.demoClicks];
    for (const target of this.session.targets) {
      for (const click of target.clicks) {
        if (click.hitAt !== null) beats.push(this.session.beatAt(click.hitAt));
      }
    }
    return beats;
  }
}
