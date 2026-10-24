// 一局里的虚拟鼠标和右键菜单（doc/scenes/windows-xp.md「虚拟鼠标」「桌面右键菜单与刷新」）。
// 示范段：鼠标自己示范（滑到新弹出的消息框上；desktop-refresh 在拍点上右键、0.5 拍后点「刷新」）。
// 跟打段：提前滑到下一个目标上停好，玩家按键时在原地点下去，判定完才离开。
// progress-download 示范段在进度条走满那一拍点「Open」；volume-mute 示范段按住滑块 1 拍，从原位拖到底再松开，
// 跟打段从按下命中一直按到松开，鼠标从底部拖回原位，滑块跟着它走（wait-hold-view.ts）。
// 画面每帧只根据拍位置计算。坐标都是虚拟 XP 屏幕坐标。

import { Container, Sprite } from 'pixi.js';
import { secondsPerBeat } from '../../rhythm/beat.ts';
import { MVP_WINDOWS } from '../../rhythm/judge.ts';
import { xpAssets } from './assets.ts';
import { DESKTOP_MENU, XpContextMenu } from './components/context-menu.ts';
import type { XpDesktop } from './components/desktop.ts';
import { WORK_AREA_HEIGHT, XP_SCREEN_WIDTH } from './components/screen.ts';
import {
  cursorAt,
  returnToCenterStops,
  turnGaps,
  type CursorStop,
  type Point,
} from './cursor-path.ts';
import type { PopupSession, PopupWindowState } from './popup-session.ts';

/** 一局开始前、结束后鼠标停的位置：屏幕中央偏右下 */
const HOME: Point = { x: 700, y: 420 };
/** 示范完回到的屏幕中央（桌面工作区的中心） */
const CENTER: Point = { x: XP_SCREEN_WIDTH / 2, y: WORK_AREA_HEIGHT / 2 };
/** desktop-refresh 右键的位置：桌面中间的空白处，按乐句里的序号轮换（暂定） */
const REFRESH_SPOTS: readonly Point[] = [
  { x: 400, y: 200 },
  { x: 640, y: 180 },
  { x: 300, y: 250 },
  { x: 700, y: 250 },
];
const REFRESH_ITEM = '刷新(E)';
/** 点下去时指针缩一下、桌面刷新时图标消失的时长（拍） */
const PRESS_BEATS = 1 / 8;
const FLICKER_BEATS = 1 / 8;
/** 示范段点完以后停多久再走（拍） */
const HOLD_BEATS = 1 / 16;

/** 示范段还是跟打段 */
export type Turn = 'call' | 'response';

/**
 * 一个谱面事件每一下要点的位置（虚拟屏幕坐标）。新动作在场景的 clickPoints 里补上自己的位置。
 * 大多数动作两段点同样的位置；volume-mute 两段拖的方向相反，所以按 turn 分开给。
 */
export type ClickPoints = (state: PopupWindowState, event: number, turn: Turn) => Point[];

interface StopSource {
  stop: CursorStop;
  /** 跟打段的停靠点：等这一下判定完才离开 */
  click?: { event: number; step: number };
}

export class VirtualMouse {
  readonly view = new Container({ label: 'virtual-mouse' });
  private readonly pointer: Sprite;
  private readonly menu = new XpContextMenu(DESKTOP_MENU);
  private readonly session: PopupSession;
  private readonly desktop: XpDesktop;
  /** 示范段、跟打段每个事件每一下的位置 */
  private readonly points: Record<Turn, Point[][]>;
  private readonly stops: StopSource[];
  /** 提前多少拍到位：Good 判定窗口 + 1/16 拍，保证最早的有效输入也点在目标上 */
  private readonly leadBeats: number;
  private readonly goodBeats: number;

  constructor(session: PopupSession, desktop: XpDesktop, clickPoints: ClickPoints) {
    this.session = session;
    this.desktop = desktop;
    this.goodBeats = MVP_WINDOWS.good / secondsPerBeat(session.chart.bpm);
    this.leadBeats = this.goodBeats + 1 / 16;

    const { texture, hotspot } = xpAssets().pointer;
    this.pointer = new Sprite(texture);
    this.pointer.anchor.set(hotspot.x / texture.width, hotspot.y / texture.height);
    this.menu.view.visible = false;
    this.view.addChild(this.menu.view, this.pointer);

    // desktop-refresh 的两下（右键位置、「刷新」条目）由这里算；其余动作由场景给出
    const pointsFor = (turn: Turn) =>
      session.windows.map((state, event) =>
        state.call.action === 'desktop-refresh'
          ? this.refreshPoints(state)
          : clickPoints(state, event, turn),
      );
    this.points = { call: pointsFor('call'), response: pointsFor('response') };
    this.stops = this.buildStops();
  }

  /** desktop-refresh 右键的位置（判定字样显示在它上方） */
  static refreshSpot(state: PopupWindowState): Point {
    return REFRESH_SPOTS[state.call.index % REFRESH_SPOTS.length]!;
  }

  /** 指针此刻的位置（虚拟屏幕坐标），update 之后读 */
  get position(): Point {
    return { x: this.pointer.x, y: this.pointer.y };
  }

  update(beat: number): void {
    // 跟打段的停靠点：判定完（命中或 Miss）才离开，还没判定时最多停到 Good 窗口关闭
    for (const { stop, click } of this.stops) {
      if (!click) continue;
      const state = this.session.windows[click.event]!.clicks[click.step]!;
      const done = state.hitAt ?? state.missedAt;
      stop.leave = done !== null ? this.session.beatAt(done) : stop.beat + this.goodBeats;
    }
    const position = cursorAt(
      this.stops.map((s) => s.stop),
      beat,
      { leadBeats: this.leadBeats, holdBeats: HOLD_BEATS },
    );
    this.pointer.position.set(position.x, position.y);
    const pressed =
      this.clickBeats().some((b) => beat >= b && beat < b + PRESS_BEATS) || this.holding(beat);
    this.pointer.scale.set(pressed ? 0.85 : 1);

    this.renderMenu(beat);
  }

  destroy(): void {
    this.desktop.setIconsVisible(true);
    this.menu.destroy();
    this.view.destroy({ children: true });
  }

  /** 第一下：右键的位置；第二下：菜单在那里打开后「刷新」条目的中心 */
  private refreshPoints(state: PopupWindowState): Point[] {
    const spot = VirtualMouse.refreshSpot(state);
    const item = this.menu.itemCenter(REFRESH_ITEM);
    return [spot, { x: spot.x + item.x, y: spot.y + item.y }];
  }

  private buildStops(): StopSource[] {
    const stops: StopSource[] = [{ stop: { beat: -Infinity, ...HOME } }];
    this.session.windows.forEach((state, event) => {
      const callPoints = this.points.call[event]!;
      const responsePoints = this.points.response[event]!;
      // 示范段：消息框只有一个停靠点（在它弹出的拍点上停在默认按钮上）；要按几下的动作每一下一个
      const callOffsets = state.clicks.map((c) => c.beat - state.response.beat);
      callOffsets.forEach((offset, step) => {
        stops.push({ stop: { beat: state.call.beat + offset, ...callPoints[step]! } });
      });
      state.clicks.forEach((click, step) => {
        stops.push({
          stop: { beat: click.beat, ...responsePoints[step]! },
          click: { event, step },
        });
      });
    });
    // 示范完回到屏幕中央，跟打段再出发去目标
    const gaps = turnGaps(
      this.session.windows.map((state) => ({
        phrase: state.call.phrase,
        callBeats: state.clicks.map((c) => c.beat - state.response.beat + state.call.beat),
        responseBeats: state.clicks.map((c) => c.beat),
      })),
    );
    for (const stop of returnToCenterStops(gaps, CENTER)) stops.push({ stop });
    stops.push({ stop: { beat: this.session.chart.endBeat, ...HOME } });
    return stops.sort((a, b) => a.stop.beat - b.stop.beat);
  }

  /** 鼠标点下去的拍位置：示范段的 desktop-refresh 两下，以及跟打段每一次命中 */
  private clickBeats(): number[] {
    const beats: number[] = [];
    for (const state of this.session.windows) {
      const action = state.call.action;
      if (action === 'desktop-refresh' || action === 'progress-download') {
        for (const click of state.clicks)
          beats.push(click.beat - state.response.beat + state.call.beat);
      }
      for (const click of state.clicks) {
        if (click.hitAt !== null) beats.push(this.session.beatAt(click.hitAt));
      }
    }
    return beats;
  }

  /** volume-mute 按着滑块的时候：示范段从按下到松开，跟打段从按下命中到松开判定 */
  private holding(beat: number): boolean {
    const session = this.session;
    return session.windows.some((state) => {
      if (state.call.action !== 'volume-mute') return false;
      const [press, release] = state.clicks;
      if (!press || !release) return false;
      const callPress = state.call.beat;
      const callRelease = callPress + (release.beat - press.beat);
      if (beat >= callPress && beat < callRelease) return true;
      if (press.hitAt === null || beat < session.beatAt(press.hitAt)) return false;
      const ended = release.hitAt ?? release.missedAt;
      return ended === null || beat < session.beatAt(ended);
    });
  }

  /** 右键菜单：同一时间最多一个；刷新那一刻桌面图标消失一下 */
  private renderMenu(beat: number): void {
    let shown: { point: Point; hot: boolean } | null = null;
    let flicker = false;
    const session = this.session;

    session.windows.forEach((state, event) => {
      if (state.call.action !== 'desktop-refresh') return;
      const [spot, item] = this.points.call[event]!;
      const [first, second] = state.clicks;
      if (!spot || !item || !first || !second) return;
      const gap = second.beat - first.beat;

      // 示范段：拍点上右键弹出，第二下点「刷新」后关闭
      const callOpen = state.call.beat;
      const callRefresh = callOpen + gap;
      // 跟打段：第一下命中或 Miss 时弹出（Miss 也弹，让第二下能接着做）；第二下判定后关闭
      const opened = first.hitAt ?? first.missedAt;
      const closed = second.hitAt ?? second.missedAt;
      const responseOpen = opened === null ? null : session.beatAt(opened);
      const responseClose = closed === null ? Infinity : session.beatAt(closed);

      const windows: [number, number, number][] = [[callOpen, callRefresh, callRefresh]];
      if (responseOpen !== null) windows.push([responseOpen, responseClose, second.beat]);
      for (const [open, close, target] of windows) {
        if (beat >= open && beat < close) {
          shown = { point: spot, hot: beat >= target - this.leadBeats };
        }
      }

      const refreshedAt = [callRefresh];
      if (second.hitAt !== null) refreshedAt.push(session.beatAt(second.hitAt));
      if (refreshedAt.some((b) => beat >= b && beat < b + FLICKER_BEATS)) flicker = true;
    });

    const current = shown as { point: Point; hot: boolean } | null;
    this.menu.view.visible = current !== null;
    if (current) {
      this.menu.view.position.set(current.point.x, current.point.y);
      this.menu.setHot(current.hot ? REFRESH_ITEM : null);
    }
    this.desktop.setIconsVisible(!flicker);
  }
}
