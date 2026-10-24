// 程序合成的鼓点和音效，不依赖素材文件。
// 每个声音都从第一个采样起音（只做极短的淡入防爆音），预约时间就是听感上的拍点。

/** 按采样逐个生成单声道 AudioBuffer。sample(t) 的 t 是秒。 */
export function renderBuffer(
  context: BaseAudioContext,
  duration: number,
  sample: (t: number) => number,
): AudioBuffer {
  const sampleRate = context.sampleRate;
  const length = Math.max(1, Math.round(duration * sampleRate));
  const buffer = context.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);
  const attack = 0.001;
  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    data[i] = Math.min(1, t / attack) * sample(t);
  }
  return buffer;
}

/** 指数衰减包络，tau 是衰减到 1/e 的时间（秒） */
function decay(t: number, tau: number): number {
  return Math.exp(-t / tau);
}

/** 底鼓：音高从 150Hz 快速滑到 50Hz 的正弦。 */
export function createKick(context: BaseAudioContext): AudioBuffer {
  let phase = 0;
  const dt = 1 / context.sampleRate;
  return renderBuffer(context, 0.3, (t) => {
    const frequency = 50 + 100 * decay(t, 0.03);
    phase += 2 * Math.PI * frequency * dt;
    return 0.9 * decay(t, 0.08) * Math.sin(phase);
  });
}

/** 白噪声，用一阶差分简单去掉低频，听起来更「沙」。 */
function highNoise(): () => number {
  let previous = 0;
  return () => {
    const current = Math.random() * 2 - 1;
    const out = current - previous;
    previous = current;
    return out / 2;
  };
}

/** 军鼓：噪声 + 180Hz 的短促鼓皮音。 */
export function createSnare(context: BaseAudioContext): AudioBuffer {
  const noise = highNoise();
  return renderBuffer(context, 0.2, (t) => {
    const body = 0.4 * decay(t, 0.03) * Math.sin(2 * Math.PI * 180 * t);
    return body + 0.5 * decay(t, 0.05) * noise();
  });
}

/** 闭合踩镲：很短的高频噪声。 */
export function createHat(context: BaseAudioContext): AudioBuffer {
  const noise = highNoise();
  return renderBuffer(context, 0.05, (t) => 0.35 * decay(t, 0.012) * noise());
}

export interface BlipOptions {
  /** 起始音高（Hz） */
  from: number;
  /** 结束音高（Hz）；与 from 不同时在时长内线性滑音 */
  to?: number;
  duration: number;
  gain?: number;
  /** 方波更「电子」，正弦更柔和 */
  wave?: 'sine' | 'square';
}

/** 短促的电子提示音，用于弹窗、关窗、出错等界面音效。 */
export function createBlip(
  context: BaseAudioContext,
  { from, to = from, duration, gain = 0.4, wave = 'sine' }: BlipOptions,
): AudioBuffer {
  let phase = 0;
  const dt = 1 / context.sampleRate;
  return renderBuffer(context, duration, (t) => {
    const frequency = from + (to - from) * Math.min(1, t / duration);
    phase += 2 * Math.PI * frequency * dt;
    const s = Math.sin(phase);
    const shaped = wave === 'square' ? Math.sign(s) * 0.5 : s;
    // 尾部 20% 线性淡出，避免截断爆音
    const tail = Math.min(1, (duration - t) / (duration * 0.2));
    return gain * tail * shaped;
  });
}
