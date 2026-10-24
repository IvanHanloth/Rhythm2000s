// Audio assets (wav etc.): download, decode, and tidy them so they land on the beat.
// Original OS sounds often start with milliseconds to over 100 ms of silence, which sounds late when scheduled on a beat,
// so loading trims the leading silence and normalises every sound to the same peak.

export interface SampleOptions {
  /** Peak after processing (0…1), default 0.7 */
  peak?: number;
  /** Trim leading silence, default true */
  trim?: boolean;
}

/** Samples below this fraction of the peak count as silence */
const ONSET_RATIO = 0.05;
/** How much to keep before the attack (s), to preserve its leading edge */
const PRE_ROLL = 0.001;

/** Largest absolute sample across all channels */
export function peakOf(channels: readonly Float32Array[]): number {
  let peak = 0;
  for (const data of channels) {
    for (const value of data) peak = Math.max(peak, Math.abs(value));
  }
  return peak;
}

/** Position of the first non-silent sample; 0 for pure silence. */
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

/** Trims leading silence and normalises the peak, returning a new AudioBuffer. */
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

/** Downloads and decodes an audio file, then tidies it with prepareSample. */
export async function loadSample(
  context: BaseAudioContext,
  url: string,
  options?: SampleOptions,
): Promise<AudioBuffer> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Sound ${url} failed to download (HTTP ${response.status})`);
  const decoded = await context.decodeAudioData(await response.arrayBuffer());
  return prepareSample(context, decoded, options);
}
