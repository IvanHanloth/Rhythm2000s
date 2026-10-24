// Metronome: schedules a click on every beat against the audio clock.
// Call schedule() every frame; it books the beats within the next lookAhead seconds with start(when).
// Frames only queue ahead; when a sound plays is decided entirely by the audio clock.

import { beatToTime } from '@/rhythm/beat.ts';
import type { AudioClock } from './audio-clock.ts';
import { createClickBuffer } from './click-sound.ts';

export interface MetronomeOptions {
  beatsPerBar?: number;
  /** How far ahead to schedule (s); must exceed the longest likely frame stall */
  lookAhead?: number;
  /** Delay of beat 0 after pressing start (s) */
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

  /** Audio time of beat 0 */
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

  schedule(): void {
    if (!this._running) return;
    const ctx = this.clock.context;
    const horizon = ctx.currentTime + this.lookAhead;

    while (this.beatTime(this.nextBeat) < horizon) {
      const when = this.beatTime(this.nextBeat);
      // After a long stall, skip beats already in the past instead of playing a burst
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
