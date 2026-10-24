// Sequencer: schedules a list of beat-timed sounds against the audio clock.
// Like the metronome, call schedule() every frame to book sounds within the next lookAhead seconds with start(when);
// frames only queue ahead, and when a sound plays is decided entirely by the audio clock.

import { beatToTime } from '@/rhythm/beat.ts';

export interface SequencedSound {
  /** Beat position in the song */
  beat: number;
  buffer: AudioBuffer;
  /** Volume multiplier, default 1 */
  gain?: number;
}

export interface SequencerOptions {
  /** Audio time of beat 0 (s) */
  startTime: number;
  bpm: number;
  /** How far ahead to schedule (s); must exceed the longest likely frame stall */
  lookAhead?: number;
}

export class Sequencer {
  private readonly context: BaseAudioContext;
  private readonly output: AudioNode;
  private readonly sounds: SequencedSound[];
  private readonly startTime: number;
  private readonly bpm: number;
  private readonly lookAhead: number;
  private readonly pending = new Set<AudioBufferSourceNode>();
  private next = 0;
  private stopped = false;

  constructor(
    context: BaseAudioContext,
    output: AudioNode,
    sounds: readonly SequencedSound[],
    { startTime, bpm, lookAhead = 0.2 }: SequencerOptions,
  ) {
    this.context = context;
    this.output = output;
    this.sounds = [...sounds].sort((a, b) => a.beat - b.beat);
    this.startTime = startTime;
    this.bpm = bpm;
    this.lookAhead = lookAhead;
  }

  schedule(): void {
    if (this.stopped) return;
    const now = this.context.currentTime;
    const horizon = now + this.lookAhead;

    while (this.next < this.sounds.length) {
      const sound = this.sounds[this.next]!;
      const when = beatToTime(this.startTime, this.bpm, sound.beat);
      if (when >= horizon) break;
      this.next++;
      // After a long stall, skip sounds already in the past instead of playing a burst
      if (when < now) continue;
      this.play(sound, when);
    }
  }

  /** Stops and cancels every scheduled sound that hasn't finished. */
  stop(): void {
    this.stopped = true;
    for (const source of this.pending) {
      source.onended = null;
      source.stop();
    }
    this.pending.clear();
  }

  private play(sound: SequencedSound, when: number): void {
    const source = this.context.createBufferSource();
    source.buffer = sound.buffer;
    let destination = this.output;
    if (sound.gain !== undefined && sound.gain !== 1) {
      const gain = this.context.createGain();
      gain.gain.value = sound.gain;
      gain.connect(this.output);
      destination = gain;
    }
    source.connect(destination);
    source.onended = () => this.pending.delete(source);
    source.start(when);
    this.pending.add(source);
  }
}
