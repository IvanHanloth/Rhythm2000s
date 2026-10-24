// 一局 XP 关卡：谱面、伴奏、判定串在一起，不负责画面。
// 时间都是音频时间（秒）。画面用「听到的」时间；判定用扣除校准值之后的时间。
// 一个谱面事件可能要按几下（desktop-refresh 先右键、再点「刷新」），每一下单独判定。
// 长按的动作（volume-mute）第二下是「松开」：按下命中后开始按住，松开时对松开的目标判定
// （doc/scenes/windows-xp-levels.md「判定（暂定）」）。按下的目标交给 ResponseJudge，松开的目标在这里判。

import { Sequencer } from '../../audio/sequencer.ts';
import type { SceneContext } from '../../game/scene.ts';
import { actionTapKind, actionTapOffsets } from '../../rhythm/actions.ts';
import { beatToTime, timeToBeat } from '../../rhythm/beat.ts';
import type { Chart, ChartCue } from '../../rhythm/chart.ts';
import {
  levelForOffset,
  MVP_WINDOWS,
  ResponseJudge,
  type Judgement,
  type JudgementLevel,
} from '../../rhythm/judge.ts';
import { buildBackingTrack, clickSound, type PopupSounds } from './song.ts';

/** 按下开始后，第 0 拍延后多久（秒） */
const LEAD_IN = 0.2;

/** 跟打段里一个事件的某一下 */
export interface ClickState {
  /** 这一下的目标拍位置（全曲拍） */
  beat: number;
  /** 命中的听到时间；还没命中时为 null */
  hitAt: number | null;
  /** 判定为 Miss 的听到时间；没有 Miss 时为 null */
  missedAt: number | null;
}

/** 一个谱面事件：示范和对应的跟打，以及跟打每一下的状态 */
export interface PopupWindowState {
  call: ChartCue;
  response: ChartCue;
  /** 按顺序的每一下；消息框只有一下 */
  clicks: ClickState[];
  /** 最后一下命中的听到时间（消息框：玩家关掉它的时间）；还没完成时为 null */
  closedAt: number | null;
  /** 最早一次 Miss 的听到时间；没有 Miss 时为 null */
  missedAt: number | null;
}

export interface JudgementRecord extends Judgement {
  /** 属于第几个谱面事件（windows 的下标）；target 是第几下（所有事件的每一下按时间排） */
  event: number;
  /** 这个事件的第几下（从 0 开始） */
  step: number;
  /** 判定在画面上出现的时间（听到的时间，没有扣除校准值） */
  shownAt: number;
}

interface TapTarget {
  event: number;
  step: number;
}

/** 长按的松开目标 */
interface ReleaseTarget extends TapTarget {
  /** 目标时间（音频时间，秒） */
  time: number;
  judged: boolean;
}

export class PopupSession {
  readonly chart: Chart;
  readonly startTime: number;
  readonly windows: PopupWindowState[];
  /** 按发生顺序追加，画面据此弹出判定字样 */
  readonly judgements: JudgementRecord[] = [];

  private readonly context: SceneContext;
  private readonly sounds: PopupSounds;
  private readonly output: GainNode;
  private readonly sequencer: Sequencer;
  private readonly judge: ResponseJudge;
  /** 按下的判定目标（每一下）对应哪个事件的第几下，按时间排 */
  private readonly targets: TapTarget[] = [];
  /** 松开的判定目标，按时间排 */
  private readonly releases: ReleaseTarget[] = [];
  /** 正按住的长按：releases 的下标；没有按住时为 null */
  private holding: number | null = null;

  constructor(context: SceneContext, chart: Chart, sounds: PopupSounds) {
    const audio = context.clock.context;
    this.context = context;
    this.chart = chart;
    this.sounds = sounds;
    this.startTime = audio.currentTime + LEAD_IN;

    this.output = audio.createGain();
    this.output.gain.value = 0.8;
    this.output.connect(audio.destination);

    this.sequencer = new Sequencer(audio, this.output, buildBackingTrack(chart, sounds), {
      startTime: this.startTime,
      bpm: chart.bpm,
    });
    this.windows = chart.calls.map((call, i) => {
      const response = chart.responses[i]!;
      return {
        call,
        response,
        clicks: actionTapOffsets(response.action).map((offset) => ({
          beat: response.beat + offset,
          hitAt: null,
          missedAt: null,
        })),
        closedAt: null,
        missedAt: null,
      };
    });
    // 谱面校验保证下一个事件在上一个事件的最后一下之后，所以按事件顺序展开就是按时间排好的
    this.windows.forEach((state, event) => {
      state.clicks.forEach((click, step) => {
        if (actionTapKind(state.response.action, step) === 'release') {
          this.releases.push({ event, step, time: this.timeAt(click.beat), judged: false });
        } else {
          this.targets.push({ event, step });
        }
      });
    });
    this.judge = new ResponseJudge(
      this.targets.map(({ event, step }) => this.timeAt(this.windows[event]!.clicks[step]!.beat)),
    );
  }

  beatAt(time: number): number {
    return timeToBeat(this.startTime, this.chart.bpm, time);
  }

  timeAt(beat: number): number {
    return beatToTime(this.startTime, this.chart.bpm, beat);
  }

  get endTime(): number {
    return this.timeAt(this.chart.endBeat);
  }

  /** 每帧调用：预约伴奏，并把过了判定窗口的目标记为 Miss。 */
  update(audioTime: number): void {
    this.sequencer.schedule();
    const calibration = this.context.calibration();
    for (const judgement of this.judge.expire(audioTime - calibration)) {
      this.recordMiss(judgement, judgement.time + calibration);
    }
    this.expireReleases(audioTime - calibration, calibration);
  }

  /**
   * 玩家输入（听到的时间）。命中时记下这一下，返回判定；提前按（见 ResponseJudge.tap）时这一下记为 Miss；
   * 没有对上目标时返回 null。
   */
  tap(audioTime: number): JudgementRecord | null {
    const judgement = this.judge.tap(audioTime - this.context.calibration());
    if (!judgement) return null;
    if (judgement.level === 'miss') return this.recordMiss(judgement, audioTime);
    const { event, step } = this.targets[judgement.target]!;
    const state = this.windows[event]!;
    state.clicks[step]!.hitAt = audioTime;
    if (step === state.clicks.length - 1) state.closedAt = audioTime;
    const record = { ...judgement, event, step, shownAt: audioTime };
    this.judgements.push(record);
    this.playNow(clickSound(this.sounds, state.response.action, step));
    // 长按的按下命中：开始按住，等松开
    const release = this.releases.findIndex((r) => r.event === event && r.step === step + 1);
    if (release >= 0) this.holding = release;
    return record;
  }

  /**
   * 玩家松开（听到的时间）。正按住长按时对它的松开目标判定：在 Good 窗口里算命中，否则算 Miss
   * （松早了，或者窗口关了还按着——后者通常已在 update 里记过）。没有按住时返回 null。
   */
  release(audioTime: number): JudgementRecord | null {
    const index = this.holding;
    this.holding = null;
    const target = index === null ? undefined : this.releases[index];
    if (!target || target.judged) return null;
    const time = audioTime - this.context.calibration();
    const offset = time - target.time;
    const level = levelForOffset(offset, MVP_WINDOWS);
    if (!level) return this.recordReleaseMiss(index!, time, audioTime, true);

    target.judged = true;
    const { event, step } = target;
    const state = this.windows[event]!;
    state.clicks[step]!.hitAt = audioTime;
    if (step === state.clicks.length - 1) state.closedAt = audioTime;
    const record: JudgementRecord = {
      target: this.targets.length + index!,
      level,
      offset,
      time,
      event,
      step,
      shownAt: audioTime,
    };
    this.judgements.push(record);
    this.playNow(clickSound(this.sounds, state.response.action, step));
    return record;
  }

  /** 正按住长按的谱面事件（windows 的下标）；没有按住时为 null。画面用它决定滑块跟不跟着走 */
  get heldEvent(): number | null {
    return this.holding === null ? null : (this.releases[this.holding]?.event ?? null);
  }

  counts(): Record<JudgementLevel, number> {
    const counts = { perfect: 0, good: 0, miss: 0 };
    for (const judgement of this.judgements) counts[judgement.level]++;
    return counts;
  }

  stop(): void {
    this.sequencer.stop();
    this.output.disconnect();
  }

  private recordMiss(judgement: Judgement, shownAt: number): JudgementRecord {
    const { event, step } = this.targets[judgement.target]!;
    const state = this.windows[event]!;
    state.clicks[step]!.missedAt = shownAt;
    state.missedAt ??= shownAt;
    const record = { ...judgement, event, step, shownAt };
    this.judgements.push(record);
    this.playNow(this.sounds.miss);
    return record;
  }

  /**
   * 松开目标的 Miss：按下这一下 Miss 了（松开也跟着丢，不再响一次 Miss 声），
   * 或者松开窗口关闭时还按着 / 还没按下。time 是扣除校准值后的时间。
   */
  private expireReleases(time: number, calibration: number): void {
    this.releases.forEach((target, index) => {
      if (target.judged) return;
      const press = this.windows[target.event]!.clicks[target.step - 1];
      if (press?.missedAt != null) {
        this.recordReleaseMiss(index, press.missedAt - calibration, press.missedAt, false);
      } else if (time > target.time + MVP_WINDOWS.good) {
        const closeTime = target.time + MVP_WINDOWS.good;
        this.recordReleaseMiss(index, closeTime, closeTime + calibration, true);
      }
    });
  }

  private recordReleaseMiss(
    index: number,
    time: number,
    shownAt: number,
    withSound: boolean,
  ): JudgementRecord {
    const target = this.releases[index]!;
    target.judged = true;
    if (this.holding === index) this.holding = null;
    const { event, step } = target;
    const state = this.windows[event]!;
    state.clicks[step]!.missedAt = shownAt;
    state.missedAt ??= shownAt;
    const record: JudgementRecord = {
      target: this.targets.length + index,
      level: 'miss',
      offset: null,
      time,
      event,
      step,
      shownAt,
    };
    this.judgements.push(record);
    if (withSound) this.playNow(this.sounds.miss);
    return record;
  }

  /** 玩家动作的反馈音跟随输入立即播放，不预约在拍点上。 */
  private playNow(buffer: AudioBuffer): void {
    const audio = this.context.clock.context;
    const source = audio.createBufferSource();
    source.buffer = buffer;
    source.connect(this.output);
    source.start();
  }
}
