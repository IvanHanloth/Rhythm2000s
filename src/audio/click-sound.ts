// 程序合成的节拍器点击音，不依赖任何音频素材。

export interface ClickOptions {
  /** 音高（Hz） */
  frequency: number;
  /** 时长（秒） */
  duration?: number;
  /** 音量（0～1） */
  gain?: number;
}

/**
 * 生成一个短促的点击音：起音在第一个采样就开始（只做 1 毫秒的淡入防爆音），
 * 这样预约的播放时间就是听感上的拍点。
 */
export function createClickBuffer(
  context: BaseAudioContext,
  { frequency, duration = 0.05, gain = 0.6 }: ClickOptions,
): AudioBuffer {
  const sampleRate = context.sampleRate;
  const length = Math.max(1, Math.round(duration * sampleRate));
  const buffer = context.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);
  const attack = Math.max(1, Math.round(0.001 * sampleRate));
  const decay = duration / 6;

  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    const envelope = Math.min(1, i / attack) * Math.exp(-t / decay);
    data[i] = gain * envelope * Math.sin(2 * Math.PI * frequency * t);
  }
  return buffer;
}
