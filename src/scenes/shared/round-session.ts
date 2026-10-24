// One round of a level: ties the chart, backing track and judging together, without drawing anything.
// Shared by every scene; each scene supplies its own targets, backing track and feedback sounds.
// All times are audio times (s). Visuals use the time being heard; judging uses that time minus the calibration.
// One chart event can take several presses (e.g. desktop-refresh: right-click, then "Refresh"), each judged on its own.
// Presses whose kind is `auto` (the release of volume-mute / menu-volume) are completed by the game
// after the previous press hits: they play their sound but are neither judged nor scored.

import { Sequencer, type SequencedSound } from '@/audio/sequencer.ts';
import type { SceneContext } from '@/game/scene.ts';
import { actionTapKind, actionTapOffsets } from '@/rhythm/actions.ts';
import { beatToTime, timeToBeat } from '@/rhythm/beat.ts';
import type { Chart, ChartCue } from '@/rhythm/chart.ts';
import { ResponseJudge, type Judgement, type JudgementLevel } from '@/rhythm/judge.ts';

/** Delay (s) between starting a round and beat 0 */
const LEAD_IN = 0.2;

/** One press of a response target */
export interface ClickState {
  /** Target beat of this press (song beats) */
  beat: number;
  /** Heard time of the hit; null until hit */
  hitAt: number | null;
  /** Heard time of the Miss; null without a Miss */
  missedAt: number | null;
}

/** One chart event: the call, its response and the state of each response press */
export interface RoundTarget {
  call: ChartCue;
  response: ChartCue;
  /** Every press in order; most actions take one */
  clicks: ClickState[];
  /** Heard time the last press hit (the player dealt with the target); null until then */
  handledAt: number | null;
  /** Heard time of the first Miss; null without a Miss */
  missedAt: number | null;
}

export interface JudgementRecord extends Judgement {
  /** Index of the chart event (into `targets`); `target` counts every judged press across all events */
  event: number;
  /** Which press of the event this is (from 0) */
  step: number;
  /** Heard time the judgement appears on screen (calibration not subtracted) */
  shownAt: number;
}

/** Untouched press states for a response cue, one per press of its action */
export function createClicks(response: ChartCue): ClickState[] {
  return actionTapOffsets(response.action).map((offset) => ({
    beat: response.beat + offset,
    hitAt: null,
    missedAt: null,
  }));
}

/** Pairs every call with its response, the minimal target most scenes need */
export function pairTargets(chart: Chart): RoundTarget[] {
  return chart.calls.map((call, i) => {
    const response = chart.responses[i]!;
    return { call, response, clicks: createClicks(response), handledAt: null, missedAt: null };
  });
}

export interface RoundSessionOptions<T extends RoundTarget> {
  targets: T[];
  backingTrack: SequencedSound[];
  /** Sound for the step-th press of a target, played when it hits (or is completed automatically) */
  hitSound(target: T, step: number): AudioBuffer;
  missSound: AudioBuffer;
}

interface TapTarget {
  event: number;
  step: number;
}

export class RoundSession<T extends RoundTarget = RoundTarget> {
  readonly chart: Chart;
  readonly startTime: number;
  readonly targets: T[];
  /** Appended in the order they happen; the view pops a judgement label for each */
  readonly judgements: JudgementRecord[] = [];

  private readonly context: SceneContext;
  private readonly options: RoundSessionOptions<T>;
  private readonly output: GainNode;
  private readonly sequencer: Sequencer;
  private readonly judge: ResponseJudge;
  /** Which event and press each judged press belongs to, in time order; auto presses are left out */
  private readonly taps: TapTarget[] = [];

  constructor(context: SceneContext, chart: Chart, options: RoundSessionOptions<T>) {
    const audio = context.clock.context;
    this.context = context;
    this.chart = chart;
    this.options = options;
    this.targets = options.targets;
    this.startTime = audio.currentTime + LEAD_IN;

    this.output = audio.createGain();
    this.output.gain.value = 0.8;
    this.output.connect(audio.destination);

    this.sequencer = new Sequencer(audio, this.output, options.backingTrack, {
      startTime: this.startTime,
      bpm: chart.bpm,
    });
    // Chart validation puts each event after the previous event's last press, so event order is time order
    this.targets.forEach((target, event) => {
      target.clicks.forEach((_, step) => {
        if (actionTapKind(target.response.action, step) !== 'auto') this.taps.push({ event, step });
      });
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

  /** Number of judged presses (auto presses excluded) */
  get targetCount(): number {
    return this.taps.length;
  }

  /**
   * Call every frame: books the backing track and marks targets whose window has passed as Misses. With the cheat code
   * on (doc/cheat-code.md) the game hits a target nobody pressed on its beat instead.
   */
  update(audioTime: number): void {
    this.sequencer.schedule();
    const calibration = this.context.calibration();
    if (this.context.cheat.active) this.autoplay(audioTime);
    for (const judgement of this.judge.expire(audioTime - calibration)) {
      this.recordMiss(judgement, judgement.time + calibration);
    }
  }

  /**
   * Player input (heard time). A hit records the press and returns its judgement; an early press
   * (see ResponseJudge.tap) records a Miss; a press that matches no target returns null.
   */
  tap(audioTime: number): JudgementRecord | null {
    const judgement = this.judge.tap(
      audioTime - this.context.calibration(),
      this.context.cheat.active,
    );
    if (!judgement) return null;
    if (judgement.level === 'miss') return this.recordMiss(judgement, audioTime);
    const { event, step } = this.taps[judgement.target]!;
    const target = this.targets[event]!;
    target.clicks[step]!.hitAt = audioTime;
    if (step === target.clicks.length - 1) target.handledAt = audioTime;
    const record = { ...judgement, event, step, shownAt: audioTime };
    this.judgements.push(record);
    this.play(this.options.hitSound(target, step));
    this.completeAuto(target, step, audioTime);
    return record;
  }

  /**
   * HackerEditor's Play (doc/chart-editor.md): the computer makes every judged press on its beat, once the heard time
   * reaches it, as a perfectly timed player would. Call every frame before update().
   */
  autoplay(audioTime: number): void {
    const calibration = this.context.calibration();
    for (const { event, step } of this.taps) {
      const click = this.targets[event]!.clicks[step]!;
      if (click.hitAt !== null || click.missedAt !== null) continue;
      const time = this.timeAt(click.beat);
      // Presses are in time order, so the rest are still ahead
      if (time > audioTime) return;
      this.tap(time + calibration);
    }
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

  /** After press `step` hits, the auto presses right after it complete on their own at the chart's spacing */
  private completeAuto(target: T, step: number, audioTime: number): void {
    const audio = this.context.clock.context;
    const secondsPerBeat = 60 / this.chart.bpm;
    for (let next = step + 1; next < target.clicks.length; next++) {
      if (actionTapKind(target.response.action, next) !== 'auto') return;
      const delay = (target.clicks[next]!.beat - target.clicks[step]!.beat) * secondsPerBeat;
      target.clicks[next]!.hitAt = audioTime + delay;
      if (next === target.clicks.length - 1) target.handledAt = audioTime + delay;
      this.play(this.options.hitSound(target, next), audio.currentTime + delay);
    }
  }

  private recordMiss(judgement: Judgement, shownAt: number): JudgementRecord {
    const { event, step } = this.taps[judgement.target]!;
    const target = this.targets[event]!;
    target.clicks[step]!.missedAt = shownAt;
    target.missedAt ??= shownAt;
    const record = { ...judgement, event, step, shownAt };
    this.judgements.push(record);
    this.play(this.options.missSound);
    return record;
  }

  /** Feedback follows the input, not the beat grid: plays now, or at `when` for auto presses */
  private play(buffer: AudioBuffer, when?: number): void {
    const source = this.context.clock.context.createBufferSource();
    source.buffer = buffer;
    source.connect(this.output);
    if (when === undefined) source.start();
    else source.start(when);
  }
}
