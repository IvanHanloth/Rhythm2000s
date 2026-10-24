// Mac 场景的一局：谱面、伴奏、判定串在一起，不负责画面。
// 时间都是音频时间（秒）。画面用「听到的」时间；判定用扣除校准值之后的时间。
// 一个目标可能要按几下（menu-apple 先点苹果、再点菜单项），每一下单独判定。

import { Sequencer } from '../../audio/sequencer.ts';
import type { SceneContext } from '../../game/scene.ts';
import { actionTapOffsets } from '../../rhythm/actions.ts';
import { beatToTime, timeToBeat } from '../../rhythm/beat.ts';
import type { Chart, ChartCue } from '../../rhythm/chart.ts';
import { ResponseJudge, type Judgement, type JudgementLevel } from '../../rhythm/judge.ts';
import { isMacAction, MAC_ACTIONS, type MacAction, type MacTargetKind } from './action-kinds.ts';
import { buildBackingTrack, handledSound, type MacSongSounds } from './song.ts';

/** 按下开始后，第 0 拍延后多久（秒） */
const LEAD_IN = 0.2;

/** 跟打段里一个目标的某一下 */
export interface ClickState {
  /** 这一下的目标拍位置（全曲拍） */
  beat: number;
  /** 命中的听到时间；还没命中时为 null */
  hitAt: number | null;
  /** 判定为 Miss 的听到时间；没有 Miss 时为 null */
  missedAt: number | null;
}

/** 一个要玩家处理的目标：示范段出现的一个提示框 / 弹跳图标 / 新邮件 / 窗口 / 菜单 / 文件 */
export interface MacTarget {
  call: ChartCue;
  response: ChartCue;
  action: MacAction;
  kind: MacTargetKind;
  /**
   * 在本乐句同类目标里排第几（从 0 开始），决定画在哪：
   * 提示框和窗口共用画面上的位置；Dock 弹跳决定用哪个图标；文件决定排在哪一格；
   * 新邮件、菜单只用来区分先后。
   */
  order: number;
  /** 跟打段按顺序的每一下；大多数目标只有一下 */
  clicks: ClickState[];
  /** 玩家处理掉它（最后一下命中）的听到时间；还没处理时为 null */
  handledAt: number | null;
  /** 最早一次 Miss 的听到时间；没有 Miss 时为 null */
  missedAt: number | null;
}

/** 画面位置的分组：提示框和窗口共用一组位置 */
function slotGroup(kind: MacTargetKind): string {
  return kind === 'alert' || kind === 'window' ? 'screen' : kind;
}

/** 把谱面里的示范 / 跟打事件配成一个个目标。谱面应已通过 checkMacChart（个数、动作一一对应）。 */
export function buildTargets(chart: Chart): MacTarget[] {
  const counters = new Map<string, number>();
  return chart.calls.map((call, i) => {
    const action: MacAction = isMacAction(call.action) ? call.action : 'alert-note';
    const kind = MAC_ACTIONS[action].kind;
    const key = `${call.phrase}:${slotGroup(kind)}`;
    const order = counters.get(key) ?? 0;
    counters.set(key, order + 1);
    const response = chart.responses[i]!;
    return {
      call,
      response,
      action,
      kind,
      order,
      clicks: actionTapOffsets(action).map((offset) => ({
        beat: response.beat + offset,
        hitAt: null,
        missedAt: null,
      })),
      handledAt: null,
      missedAt: null,
    };
  });
}

export interface JudgementRecord extends Judgement {
  /** 属于第几个目标（targets 的下标）；Judgement.target 是第几下（所有目标的每一下按时间排） */
  event: number;
  /** 这个目标的第几下（从 0 开始） */
  step: number;
  /** 判定在画面上出现的时间（听到的时间，没有扣除校准值） */
  shownAt: number;
}

interface TapTarget {
  event: number;
  step: number;
}

export class MacSession {
  readonly chart: Chart;
  readonly startTime: number;
  readonly targets: MacTarget[];
  /** 按发生顺序追加，画面据此弹出判定字样 */
  readonly judgements: JudgementRecord[] = [];

  private readonly context: SceneContext;
  private readonly sounds: MacSongSounds;
  private readonly output: GainNode;
  private readonly sequencer: Sequencer;
  private readonly judge: ResponseJudge;
  /** 判定目标（每一下）对应哪个目标的第几下，按时间排 */
  private readonly taps: TapTarget[] = [];

  constructor(context: SceneContext, chart: Chart, sounds: MacSongSounds) {
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
    this.targets = buildTargets(chart);
    // 谱面校验保证下一个事件在上一个事件的最后一下之后，所以按目标顺序展开就是按时间排好的
    this.targets.forEach((target, event) => {
      target.clicks.forEach((_, step) => this.taps.push({ event, step }));
    });
    this.judge = new ResponseJudge(
      this.taps.map(({ event, step }) => this.timeAt(this.targets[event]!.clicks[step]!.beat)),
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
  }

  /**
   * 玩家输入（听到的时间）。命中时记下这一下，最后一下命中就处理掉目标，返回判定；
   * 提前按（见 ResponseJudge.tap）时这一下记为 Miss；没有对上目标时返回 null。
   */
  tap(audioTime: number): JudgementRecord | null {
    const judgement = this.judge.tap(audioTime - this.context.calibration());
    if (!judgement) return null;
    if (judgement.level === 'miss') return this.recordMiss(judgement, audioTime);
    const { event, step } = this.taps[judgement.target]!;
    const target = this.targets[event]!;
    target.clicks[step]!.hitAt = audioTime;
    if (step === target.clicks.length - 1) target.handledAt = audioTime;
    const record = { ...judgement, event, step, shownAt: audioTime };
    this.judgements.push(record);
    this.playNow(handledSound(this.sounds, target.action, step));
    return record;
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
    const { event, step } = this.taps[judgement.target]!;
    const target = this.targets[event]!;
    target.clicks[step]!.missedAt = shownAt;
    target.missedAt ??= shownAt;
    const record = { ...judgement, event, step, shownAt };
    this.judgements.push(record);
    this.playNow(this.sounds.miss);
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
