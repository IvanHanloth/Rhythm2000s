// 节拍器：按音频时钟预约每一拍的点击音。
// 调度方式：每帧调用 schedule()，把未来 lookAhead 秒内的拍子用 start(when) 预约好。
// 帧本身只负责「提前排队」，声音何时响完全由音频时钟决定。

import { beatToTime } from '../rhythm/beat.ts';
import type { AudioClock } from './audio-clock.ts';
import { createClickBuffer } from './click-sound.ts';

export interface MetronomeOptions {
  beatsPerBar?: number;
  /** 提前预约的时长（秒），要大于最长可能的掉帧时间 */
  lookAhead?: number;
  /** 按下开始后，第 0 拍延后多久（秒） */
  startDelay?: number;
}

export class Metronome {
  readonly beatsPerBar: number;
  private readonly lookAhead: number;
  private readonly startDelay: number;
  private readonly clock: AudioClock;
  private readonly accent: AudioBuffer;
  private readonly normal: AudioBuffer;
  private readonly output: GainNode;
  private readonly pending = new Set<AudioBufferSourceNode>();

  private _bpm = 120;
  private _startTime = 0;
  private _running = false;
  private nextBeat = 0;

  constructor(clock: AudioClock, options: MetronomeOptions = {}) {
    this.clock = clock;
    this.beatsPerBar = options.beatsPerBar ?? 4;
    this.lookAhead = options.lookAhead ?? 0.2;
    this.startDelay = options.startDelay ?? 0.5;

    const ctx = clock.context;
    this.accent = createClickBuffer(ctx, { frequency: 1760 });
    this.normal = createClickBuffer(ctx, { frequency: 880 });
    this.output = ctx.createGain();
    this.output.connect(ctx.destination);
  }

  get bpm(): number {
    return this._bpm;
  }

  /** 第 0 拍的音频时间 */
  get startTime(): number {
    return this._startTime;
  }

  get running(): boolean {
    return this._running;
  }

  start(bpm: number): void {
    this.stop();
    this._bpm = bpm;
    this._startTime = this.clock.context.currentTime + this.startDelay;
    this.nextBeat = 0;
    this._running = true;
    this.schedule();
  }

  stop(): void {
    this._running = false;
    for (const source of this.pending) {
      source.onended = null;
      source.stop();
    }
    this.pending.clear();
  }

  beatTime(beat: number): number {
    return beatToTime(this._startTime, this._bpm, beat);
  }

  isAccent(beat: number): boolean {
    return beat % this.beatsPerBar === 0;
  }

  /** 每帧调用一次。 */
  schedule(): void {
    if (!this._running) return;
    const ctx = this.clock.context;
    const horizon = ctx.currentTime + this.lookAhead;

    while (this.beatTime(this.nextBeat) < horizon) {
      const when = this.beatTime(this.nextBeat);
      // 掉帧太久导致已经过时的拍直接跳过，避免一次性补放一串
      if (when >= ctx.currentTime) {
        const source = ctx.createBufferSource();
        source.buffer = this.isAccent(this.nextBeat) ? this.accent : this.normal;
        source.connect(this.output);
        source.onended = () => this.pending.delete(source);
        source.start(when);
        this.pending.add(source);
      }
      this.nextBeat++;
    }
  }
}
