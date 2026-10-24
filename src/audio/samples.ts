// 音频素材（wav 等）：下载、解码，再整理成能踩在拍点上的样子。
// 原版系统音效开头常有几毫秒到上百毫秒的静音，按拍点预约播放时会听起来偏晚，
// 所以加载时切掉开头的静音，并把峰值统一到同一音量。

export interface SampleOptions {
  /** 整理后的峰值（0～1），默认 0.7 */
  peak?: number;
  /** 是否切掉开头的静音，默认是 */
  trim?: boolean;
}

/** 低于峰值这个比例的采样算作静音 */
const ONSET_RATIO = 0.05;
/** 起音点之前保留的时长（秒），留住起音的前沿 */
const PRE_ROLL = 0.001;

/** 所有声道里绝对值最大的采样 */
export function peakOf(channels: readonly Float32Array[]): number {
  let peak = 0;
  for (const data of channels) {
    for (const value of data) peak = Math.max(peak, Math.abs(value));
  }
  return peak;
}

/** 第一个「不算静音」的采样位置；全是静音时返回 0。 */
export function findOnset(channels: readonly Float32Array[], peak = peakOf(channels)): number {
  if (peak === 0) return 0;
  const threshold = peak * ONSET_RATIO;
  const length = Math.max(0, ...channels.map((c) => c.length));
  for (let i = 0; i < length; i++) {
    for (const data of channels) {
      if (Math.abs(data[i] ?? 0) >= threshold) return i;
    }
  }
  return 0;
}

/** 切掉开头静音、统一峰值，返回新的 AudioBuffer。 */
export function prepareSample(
  context: BaseAudioContext,
  buffer: AudioBuffer,
  { peak: targetPeak = 0.7, trim = true }: SampleOptions = {},
): AudioBuffer {
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, i) =>
    buffer.getChannelData(i),
  );
  const peak = peakOf(channels);
  const preRoll = Math.round(PRE_ROLL * buffer.sampleRate);
  const start = trim ? Math.max(0, findOnset(channels, peak) - preRoll) : 0;
  const gain = peak > 0 ? targetPeak / peak : 1;

  const length = Math.max(1, buffer.length - start);
  const result = context.createBuffer(buffer.numberOfChannels, length, buffer.sampleRate);
  channels.forEach((data, i) => {
    const out = result.getChannelData(i);
    for (let j = 0; j < length; j++) out[j] = (data[start + j] ?? 0) * gain;
  });
  return result;
}

/** 下载并解码一个音频文件，再按 prepareSample 整理。 */
export async function loadSample(
  context: BaseAudioContext,
  url: string,
  options?: SampleOptions,
): Promise<AudioBuffer> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`音效 ${url} 下载失败（HTTP ${response.status}）`);
  const decoded = await context.decodeAudioData(await response.arrayBuffer());
  return prepareSample(context, decoded, options);
}
