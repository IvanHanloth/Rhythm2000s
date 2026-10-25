// Audio clock: the single source of truth for "which beat is it" and "when did this input happen".

import {
  heardTimeFromCurrentTime,
  heardTimeFromStamp,
  isUsableStamp,
  type OutputStamp,
} from './time-mapping.ts';

/**
 * Level of the keep-awake signal: far below hearing (about −100 dB, under one 16-bit step) but not zero, which is
 * all Chrome's silence detection checks.
 */
const KEEP_AWAKE_LEVEL = 1e-5;

export class AudioClock {
  readonly context: AudioContext;

  constructor(context: AudioContext = new AudioContext({ latencyHint: 'interactive' })) {
    this.context = context;
    this.keepOutputAwake();
  }

  /**
   * After about 30 s of exact silence Chrome swaps the speakers for a fake output and only swaps back once sound
   * appears, losing the first sounds of a level (doc/tech-research.md, 2.5). An inaudible constant signal that runs
   * for the life of the page means the output is never silent. It starts once the context is resumed.
   */
  private keepOutputAwake(): void {
    const signal = this.context.createConstantSource();
    signal.offset.value = KEEP_AWAKE_LEVEL;
    signal.connect(this.context.destination);
    signal.start();
  }

  /** Browsers require this inside a user gesture (click, key press) before any sound plays. */
  async resume(): Promise<void> {
    if (this.context.state !== 'running') {
      await this.context.resume();
    }
  }

  /** Internal processing latency of the audio graph (s); 0 on old browsers without it. */
  get baseLatency(): number {
    return this.context.baseLatency ?? 0;
  }

  /** The browser's estimate of hardware output latency (s); 0 when unsupported. */
  get outputLatency(): number {
    return this.context.outputLatency ?? 0;
  }

  get supportsOutputTimestamp(): boolean {
    return typeof this.context.getOutputTimestamp === 'function';
  }

  /** Reads getOutputTimestamp(); null when unsupported or before audio starts flowing. */
  readOutputStamp(): OutputStamp | null {
    if (!this.supportsOutputTimestamp) return null;
    const stamp = this.context.getOutputTimestamp();
    return isUsableStamp(stamp) ? stamp : null;
  }

  /** Method A: converts a performance.now() instant to the audio time heard then. */
  heardTimeA(eventPerfMs: number): number | null {
    const stamp = this.readOutputStamp();
    return stamp ? heardTimeFromStamp(stamp, eventPerfMs) : null;
  }

  /** Method B: works back from currentTime minus reported latency. Call as early as possible in the event handler. */
  heardTimeB(eventPerfMs: number): number {
    return heardTimeFromCurrentTime(
      this.context.currentTime,
      performance.now(),
      eventPerfMs,
      this.baseLatency + this.outputLatency,
    );
  }

  /** Audio time the speakers are playing now: method A, falling back to B. Drives the visuals. */
  heardNow(): number {
    const now = performance.now();
    return this.heardTimeA(now) ?? this.heardTimeB(now);
  }
}
