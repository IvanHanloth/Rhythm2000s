// 音频时钟：游戏里所有「现在是第几拍」「这次输入在哪一刻」都以它为准。

import {
  heardTimeFromCurrentTime,
  heardTimeFromStamp,
  isUsableStamp,
  type OutputStamp,
} from './time-mapping.ts';

export class AudioClock {
  readonly context: AudioContext;

  constructor(context: AudioContext = new AudioContext({ latencyHint: 'interactive' })) {
    this.context = context;
  }

  /** 浏览器要求在用户操作（点击、按键）里调用一次，之后才能出声。 */
  async resume(): Promise<void> {
    if (this.context.state !== 'running') {
      await this.context.resume();
    }
  }

  /** 音频图内部的处理延迟（秒）；旧浏览器没有这个属性时为 0。 */
  get baseLatency(): number {
    return this.context.baseLatency ?? 0;
  }

  /** 浏览器估计的硬件输出延迟（秒）；不支持时为 0。 */
  get outputLatency(): number {
    return this.context.outputLatency ?? 0;
  }

  get supportsOutputTimestamp(): boolean {
    return typeof this.context.getOutputTimestamp === 'function';
  }

  /** 读取 getOutputTimestamp()；不支持或音频还没开始流动时返回 null。 */
  readOutputStamp(): OutputStamp | null {
    if (!this.supportsOutputTimestamp) return null;
    const stamp = this.context.getOutputTimestamp();
    return isUsableStamp(stamp) ? stamp : null;
  }

  /** 方法 A：把 performance.now() 时间轴上的时刻换算成当时听到的音频时间。 */
  heardTimeA(eventPerfMs: number): number | null {
    const stamp = this.readOutputStamp();
    return stamp ? heardTimeFromStamp(stamp, eventPerfMs) : null;
  }

  /** 方法 B：用 currentTime 回推并扣除浏览器报告的延迟。必须在事件回调里尽快调用。 */
  heardTimeB(eventPerfMs: number): number {
    return heardTimeFromCurrentTime(
      this.context.currentTime,
      performance.now(),
      eventPerfMs,
      this.baseLatency + this.outputLatency,
    );
  }

  /** 此刻扬声器正在播放的音频时间：优先方法 A，不可用时退回方法 B。用于驱动画面。 */
  heardNow(): number {
    const now = performance.now();
    return this.heardTimeA(now) ?? this.heardTimeB(now);
  }
}
