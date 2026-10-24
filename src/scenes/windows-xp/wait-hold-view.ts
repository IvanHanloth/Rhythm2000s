// 一局里下载进度窗（progress-download）和音量控制（volume-mute）的画面
// （doc/scenes/windows-xp-levels.md「等待与长按」）。
// 两个动作在示范段和跟打段都要做一遍：下载窗两段各弹出一次、各走 3 拍；
// 音量小窗示范段由电脑把音量从原位拖到 0，跟打段由玩家从 0 拖回原位。
// 所以每个事件建两份部件，示范一份、跟打一份。音量控制只是画面，不改游戏的实际音量。
// 画面每帧只根据拍位置计算，不累加帧间隔。坐标都是虚拟 XP 屏幕坐标。

import { Container } from 'pixi.js';
import { actionTapOffsets } from '../../rhythm/actions.ts';
import { BEATS } from '../../theme/tokens.ts';
import { clamp01, easeOutBack, easeOutCubic } from '../../ui/easing.ts';
import { XpDownloadDialog } from './components/download-dialog.ts';
import { WORK_AREA_HEIGHT, XP_SCREEN_WIDTH } from './components/screen.ts';
import type { XpTaskbar } from './components/taskbar.ts';
import { XpVolumeControl } from './components/volume-control.ts';
import type { PopupSession, PopupWindowState } from './popup-session.ts';
import type { Turn } from './virtual-mouse.ts';

type Point = { x: number; y: number };

/** 下载窗的中心：屏幕中间偏下，盖在消息框之上 */
const DOWNLOAD_CENTER: Point = { x: XP_SCREEN_WIDTH / 2, y: 300 };
/** 被下载的文件，按乐句轮换（英文，2026-10-24 起新增的显示内容一律英文） */
const DOWNLOADS = [
  { fileName: 'setup.exe', sizeKb: 1240 },
  { fileName: 'song.mp3', sizeKb: 3712 },
  { fileName: 'photos.zip', sizeKb: 2048 },
  { fileName: 'homework.doc', sizeKb: 96 },
  { fileName: 'game_demo.exe', sizeKb: 5120 },
];
const DOWNLOAD_HOST = 'www.example-files.com';

/** 音量原来的位置（0～1）：示范段从这里拖到 0，玩家要把滑块拖回这里 */
const ORIGINAL_VOLUME = 0.7;
/** Miss 后左右抖动的时长（拍）和幅度（像素），之后收起 */
const SHAKE_BEATS = 0.25;
const SHAKE_PIXELS = 4;
/** Miss 后标题栏闪烁：每隔多少拍切换一次，闪多久（拍），与消息框相同 */
const FLASH_STEP_BEATS = 0.125;
const FLASH_BEATS = 0.75;
const FADE_BEATS = 0.25;

/** 一次演出（示范段或跟打段）的时间点，都是全曲拍 */
interface Run {
  /** 事件拍位置：下载窗弹出到位 / 音量按下滑块的拍点 */
  start: number;
  /** 下载窗点「Open」或音量松开的时间；还没有时为 null */
  done: number | null;
  /** Miss 的时间；没有时为 null */
  missed: number | null;
  /** 音量：此刻是否正按着滑块 */
  held: boolean;
}

interface DownloadTarget {
  kind: 'download';
  event: number;
  call: XpDownloadDialog;
  response: XpDownloadDialog;
}
interface VolumeTarget {
  kind: 'volume';
  event: number;
  call: XpVolumeControl;
  response: XpVolumeControl;
  /** 小窗左上角 */
  origin: Point;
}
type Target = DownloadTarget | VolumeTarget;

export interface WaitHoldViewOptions {
  session: PopupSession;
  taskbar: XpTaskbar;
}

export class WaitHoldView {
  /** 下载窗和音量小窗都在任务栏之上、虚拟鼠标之下 */
  readonly layer = new Container({ label: 'wait-hold' });
  private readonly session: PopupSession;
  private readonly taskbar: XpTaskbar;
  private readonly targets = new Map<number, Target>();

  constructor({ session, taskbar }: WaitHoldViewOptions) {
    this.session = session;
    this.taskbar = taskbar;
    session.windows.forEach((state, event) => {
      const { action, phrase } = state.call;
      if (action === 'progress-download') {
        const make = () => {
          const spec = DOWNLOADS[phrase % DOWNLOADS.length]!;
          const dialog = new XpDownloadDialog({ ...spec, host: DOWNLOAD_HOST });
          dialog.view.position.set(DOWNLOAD_CENTER.x, DOWNLOAD_CENTER.y);
          dialog.view.visible = false;
          this.layer.addChild(dialog.view);
          return dialog;
        };
        this.targets.set(event, { kind: 'download', event, call: make(), response: make() });
      } else if (action === 'volume-mute') {
        const origin = this.volumeOrigin();
        const make = () => {
          const control = new XpVolumeControl({
            volume: ORIGINAL_VOLUME,
            muted: false,
            labels: { title: 'Volume', mute: 'Mute' },
          });
          // 从下沿往上展开：原点放在左下角
          control.view.pivot.set(0, control.height);
          control.view.position.set(origin.x, origin.y + control.height);
          control.view.eventMode = 'none';
          control.view.visible = false;
          this.layer.addChild(control.view);
          return control;
        };
        this.targets.set(event, {
          kind: 'volume',
          event,
          call: make(),
          response: make(),
          origin,
        });
      }
    });
  }

  /** 虚拟鼠标每一下要点的位置；不是这里画的事件返回 null */
  clickPoints(event: number, turn: Turn): Point[] | null {
    const target = this.targets.get(event);
    if (!target) return null;
    if (target.kind === 'download') {
      const open = target.response.openCenter();
      return [{ x: DOWNLOAD_CENTER.x + open.x, y: DOWNLOAD_CENTER.y + open.y }];
    }
    const thumb = (volume: number) => {
      const p = target.response.thumbCenter(volume);
      return { x: target.origin.x + p.x, y: target.origin.y + p.y };
    };
    // 示范段从原位按下、拖到底松开；跟打段从底部按下、拖回原位松开
    return turn === 'call'
      ? [thumb(ORIGINAL_VOLUME), thumb(0)]
      : [thumb(0), thumb(ORIGINAL_VOLUME)];
  }

  /** 判定字样的位置：部件上沿的中点 */
  judgementAnchor(event: number): Point | null {
    const target = this.targets.get(event);
    if (!target) return null;
    if (target.kind === 'download') {
      return { x: DOWNLOAD_CENTER.x, y: DOWNLOAD_CENTER.y - target.response.height / 2 };
    }
    return { x: target.origin.x + target.response.width / 2, y: target.origin.y };
  }

  /** pointer：虚拟鼠标此刻的位置；按着滑块时滑块跟着它走 */
  update(beat: number, pointer: Point): void {
    let muted = false;
    for (const target of this.targets.values()) {
      const state = this.session.windows[target.event]!;
      const call = this.callRun(state, beat);
      const response = this.responseRun(state);
      if (target.kind === 'download') {
        this.renderDownload(target.call, call, beat);
        this.renderDownload(target.response, response, beat);
      } else {
        this.renderVolume(target, target.call, call, 'call', beat, pointer);
        this.renderVolume(target, target.response, response, 'response', beat, pointer);
        if (this.volumeMuted(state, response, beat)) muted = true;
      }
    }
    this.taskbar.setMuted(muted);
  }

  destroy(): void {
    this.taskbar.setMuted(false);
    this.layer.destroy({ children: true });
  }

  // ---------- 两段的时间点 ----------

  /** 示范段：电脑自己做完，最后一下就是完成的时间 */
  private callRun(state: PopupWindowState, beat: number): Run {
    const start = state.call.beat;
    const end = start + actionTapOffsets(state.call.action).at(-1)!;
    return { start, done: end, missed: null, held: beat >= start && beat < end };
  }

  /** 跟打段：看玩家的判定 */
  private responseRun(state: PopupWindowState): Run {
    const toBeat = (time: number | null) => (time === null ? null : this.session.beatAt(time));
    return {
      start: state.response.beat,
      done: toBeat(state.closedAt),
      missed: toBeat(state.missedAt),
      // 只判定按下：按下命中后滑块跟着鼠标走，到自动松开为止
      held: state.clicks[0]?.hitAt != null,
    };
  }

  // ---------- 下载窗 ----------

  private renderDownload(dialog: XpDownloadDialog, run: Run, beat: number): void {
    const view = dialog.view;
    const appear = run.start - BEATS.windowOpen;
    let visible = beat >= appear;
    let scale = 1;
    let alpha = 1;
    let active = true;
    let pressed = false;

    if (visible && run.done !== null && beat >= run.done) {
      // 点下「Open」：缩小淡出
      pressed = true;
      const p = (beat - run.done) / BEATS.windowClose;
      visible = p < 1;
      scale = 1 - 0.2 * clamp01(p);
      alpha = 1 - clamp01(p);
    } else if (visible && run.missed !== null && beat >= run.missed) {
      const since = beat - run.missed;
      if (since < FLASH_BEATS) active = Math.floor(since / FLASH_STEP_BEATS) % 2 === 0;
      alpha = 1 - clamp01((since - FLASH_BEATS) / FADE_BEATS);
      visible = alpha > 0;
    } else if (visible) {
      scale = easeOutBack((beat - appear) / BEATS.windowOpen);
    }

    view.visible = visible;
    if (!visible) return;
    // 进度条走 3 拍（progress-download 的判定点在事件后 3 拍）
    const wait = actionTapOffsets('progress-download')[0]!;
    dialog.setProgress((beat - run.start) / wait);
    dialog.setOpenPressed(pressed);
    dialog.setActive(active);
    view.scale.set(Math.max(0.01, scale));
    view.alpha = alpha;
  }

  // ---------- 音量控制 ----------

  /**
   * 画一份音量小窗。示范段电脑把滑块从原位拖到 0，跟打段玩家把它从 0 拖回原位；
   * 按住期间滑块跟着鼠标走，不超出 0～原位。
   */
  private renderVolume(
    target: VolumeTarget,
    control: XpVolumeControl,
    run: Run,
    turn: Turn,
    beat: number,
    pointer: Point,
  ): void {
    const view = control.view;
    const appear = run.start - BEATS.windowOpen;
    if (beat < appear) {
      view.visible = false;
      return;
    }
    const from = turn === 'call' ? ORIGINAL_VOLUME : 0;
    const to = turn === 'call' ? 0 : ORIGINAL_VOLUME;
    const done = run.done !== null && beat >= run.done;
    let open = easeOutCubic(clamp01((beat - appear) / BEATS.windowOpen));
    let shake = 0;
    let volume = from;
    let dragging = false;

    if (done) {
      // 松开：滑块停在终点，小窗收起
      volume = to;
      open = 1 - clamp01((beat - run.done!) / BEATS.windowClose);
    } else if (run.missed !== null && beat >= run.missed) {
      // Miss（只有跟打段会有）：滑块掉回底部，抖一下再收起
      const since = beat - run.missed;
      if (since < SHAKE_BEATS) {
        shake = Math.sin(since * Math.PI * 16) * SHAKE_PIXELS * (1 - since / SHAKE_BEATS);
      }
      open = 1 - clamp01((since - SHAKE_BEATS) / FADE_BEATS);
    } else if (run.held) {
      dragging = true;
      volume = Math.min(ORIGINAL_VOLUME, control.volumeAtY(pointer.y - target.origin.y));
    }

    view.visible = open > 0;
    if (!view.visible) return;
    view.position.set(target.origin.x + shake, target.origin.y + control.height);
    view.scale.set(1, Math.max(0.01, open));
    control.setVolume(volume, dragging);
    // 「Mute」：示范段松开时勾上，跟打段松开时取消
    control.setMuted(turn === 'call' ? done : !done);
  }

  /** 托盘小喇叭显示静音：从示范段松开起，到跟打段松开或 Miss 后小窗收起为止 */
  private volumeMuted(state: PopupWindowState, response: Run, beat: number): boolean {
    const mutedFrom = state.call.beat + actionTapOffsets(state.call.action).at(-1)!;
    const mutedUntil =
      response.done ??
      (response.missed !== null ? response.missed + SHAKE_BEATS + FADE_BEATS : Infinity);
    return beat >= mutedFrom && beat < mutedUntil;
  }

  /** 音量小窗的左上角：托盘小喇叭正上方，不超出屏幕右边 */
  private volumeOrigin(): Point {
    const speaker = this.taskbar.volumeIcon;
    const trayX = speaker.parent?.x ?? 0;
    const probe = new XpVolumeControl({ volume: 0, muted: false });
    const { width, height } = probe;
    probe.destroy();
    const centerX = trayX + speaker.x + 8;
    const x = Math.min(XP_SCREEN_WIDTH - width - 2, Math.round(centerX - width / 2));
    return { x, y: WORK_AREA_HEIGHT - height - 2 };
  }
}
