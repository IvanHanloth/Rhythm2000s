// 音序器：按音频时钟预约播放一串以拍为单位的声音。
// 和节拍器一样，每帧调用 schedule()，把未来 lookAhead 秒内的声音用 start(when) 预约好；
// 帧只负责提前排队，声音何时响完全由音频时钟决定。

import { beatToTime } from '../rhythm/beat.ts';

export interface SequencedSound {
  /** 全曲拍位置 */
  beat: number;
  buffer: AudioBuffer;
  /** 音量倍数，默认 1 */
  gain?: number;
}

export interface SequencerOptions {
  /** 第 0 拍的音频时间（秒） */
  startTime: number;
  bpm: number;
  /** 提前预约的时长（秒），要大于最长可能的掉帧时间 */
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

  /** 每帧调用一次。 */
  schedule(): void {
    if (this.stopped) return;
    const now = this.context.currentTime;
    const horizon = now + this.lookAhead;

    while (this.next < this.sounds.length) {
      const sound = this.sounds[this.next]!;
      const when = beatToTime(this.startTime, this.bpm, sound.beat);
      if (when >= horizon) break;
      this.next++;
      // 掉帧太久导致已经过时的声音直接跳过，避免一次性补放一串
      if (when < now) continue;
      this.play(sound, when);
    }
  }

  /** 停止并取消所有已预约、还没播完的声音。 */
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
