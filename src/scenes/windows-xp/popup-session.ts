// 一局「弹窗 → 关窗」：谱面、伴奏、判定串在一起，不负责画面。
// 时间都是音频时间（秒）。画面用「听到的」时间；判定用扣除校准值之后的时间。

import { Sequencer } from '../../audio/sequencer.ts';
import type { SceneContext } from '../../game/scene.ts';
import { beatToTime, timeToBeat } from '../../rhythm/beat.ts';
import type { Chart, ChartCue } from '../../rhythm/chart.ts';
import { ResponseJudge, type Judgement, type JudgementLevel } from '../../rhythm/judge.ts';
import { buildBackingTrack, type PopupSounds } from './song.ts';

/** 按下开始后，第 0 拍延后多久（秒） */
const LEAD_IN = 0.2;

export interface PopupWindowState {
  call: ChartCue;
  response: ChartCue;
  /** 玩家关掉这个窗口的听到时间；还没关时为 null */
  closedAt: number | null;
  /** 判定为 Miss 的听到时间；没有 Miss 时为 null */
  missedAt: number | null;
}

export interface JudgementRecord extends Judgement {
  /** 判定在画面上出现的时间（听到的时间，没有扣除校准值） */
  shownAt: number;
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
    this.judge = new ResponseJudge(chart.responses.map((cue) => this.timeAt(cue.beat)));
    this.windows = chart.calls.map((call, i) => ({
      call,
      response: chart.responses[i]!,
      closedAt: null,
      missedAt: null,
    }));
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
      const shownAt = judgement.time + calibration;
      this.windows[judgement.target]!.missedAt = shownAt;
      this.judgements.push({ ...judgement, shownAt });
      this.playNow(this.sounds.miss);
    }
  }

  /** 玩家输入（听到的时间）。命中时关掉对应的窗口，返回判定；没有对上目标时返回 null。 */
  tap(audioTime: number): Judgement | null {
    const judgement = this.judge.tap(audioTime - this.context.calibration());
    if (!judgement) return null;
    this.windows[judgement.target]!.closedAt = audioTime;
    this.judgements.push({ ...judgement, shownAt: audioTime });
    this.playNow(this.sounds.close);
    return judgement;
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

  /** 玩家动作的反馈音跟随输入立即播放，不预约在拍点上。 */
  private playNow(buffer: AudioBuffer): void {
    const audio = this.context.clock.context;
    const source = audio.createBufferSource();
    source.buffer = buffer;
    source.connect(this.output);
    source.start();
  }
}
