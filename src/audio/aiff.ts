// AIFF decoding: Mac OS X alert sounds are AIFF, which Chrome's decodeAudioData can't handle, so we decode them ourselves.
// Uncompressed PCM only (AIFF, or AIFF-C with compression NONE), 8 / 16 / 24 / 32-bit, big-endian.

import { prepareSample, type SampleOptions } from './samples.ts';

export interface DecodedAudio {
  sampleRate: number;
  /** One array of -1…1 samples per channel */
  channels: Float32Array<ArrayBuffer>[];
}

/** 80-bit extended float (AIFF stores the sample rate this way) */
function readExtended(view: DataView, offset: number): number {
  const exponent = view.getUint16(offset) & 0x7fff;
  const sign = view.getUint16(offset) & 0x8000 ? -1 : 1;
  const hi = view.getUint32(offset + 2);
  const lo = view.getUint32(offset + 6);
  if (exponent === 0 && hi === 0 && lo === 0) return 0;
  return sign * (hi * 2 ** 32 + lo) * 2 ** (exponent - 16383 - 63);
}

function readId(view: DataView, offset: number): string {
  return String.fromCharCode(
    view.getUint8(offset),
    view.getUint8(offset + 1),
    view.getUint8(offset + 2),
    view.getUint8(offset + 3),
  );
}

export function decodeAiff(data: ArrayBuffer): DecodedAudio {
  const view = new DataView(data);
  if (view.byteLength < 12 || readId(view, 0) !== 'FORM') throw new Error('Not an AIFF file');
  const form = readId(view, 8);
  if (form !== 'AIFF' && form !== 'AIFC') throw new Error(`Not an AIFF file (${form})`);

  let format: { channels: number; frames: number; bits: number; sampleRate: number } | null = null;
  let sound: { offset: number; length: number } | null = null;

  // Read chunk by chunk; odd-length chunks are padded with one byte
  let offset = 12;
  while (offset + 8 <= view.byteLength) {
    const id = readId(view, offset);
    const size = view.getUint32(offset + 4);
    const body = offset + 8;
    if (id === 'COMM') {
      format = {
        channels: view.getInt16(body),
        frames: view.getUint32(body + 2),
        bits: view.getInt16(body + 6),
        sampleRate: readExtended(view, body + 8),
      };
      if (form === 'AIFC' && readId(view, body + 18) !== 'NONE') {
        throw new Error(`Compressed AIFF-C is not supported (${readId(view, body + 18)})`);
      }
    } else if (id === 'SSND') {
      const dataOffset = view.getUint32(body);
      sound = { offset: body + 8 + dataOffset, length: size - 8 - dataOffset };
    }
    offset = body + size + (size % 2);
  }

  if (!format) throw new Error('AIFF file has no COMM chunk');
  if (!sound) throw new Error('AIFF file has no SSND chunk');
  const { channels: channelCount, bits, sampleRate } = format;
  if (![8, 16, 24, 32].includes(bits)) throw new Error(`${bits}-bit AIFF is not supported`);

  const bytes = bits / 8;
  const frames = Math.min(format.frames, Math.floor(sound.length / (bytes * channelCount)));
  const scale = 2 ** (bits - 1);
  const channels = Array.from({ length: channelCount }, () => new Float32Array(frames));
  for (let frame = 0; frame < frames; frame++) {
    for (let ch = 0; ch < channelCount; ch++) {
      const at = sound.offset + (frame * channelCount + ch) * bytes;
      let value: number;
      if (bits === 8) value = view.getInt8(at);
      else if (bits === 16) value = view.getInt16(at);
      else if (bits === 24) value = (view.getInt8(at) << 16) | view.getUint16(at + 1);
      else value = view.getInt32(at);
      channels[ch]![frame] = value / scale;
    }
  }
  return { sampleRate, channels };
}

/** Downloads and decodes an AIFF file, then trims leading silence and normalises the peak via prepareSample. */
export async function loadAiffSample(
  context: BaseAudioContext,
  url: string,
  options?: SampleOptions,
): Promise<AudioBuffer> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Sound ${url} failed to download (HTTP ${response.status})`);
  const { sampleRate, channels } = decodeAiff(await response.arrayBuffer());
  const buffer = context.createBuffer(
    channels.length,
    Math.max(1, channels[0]!.length),
    sampleRate,
  );
  channels.forEach((data, i) => buffer.copyToChannel(data, i));
  return prepareSample(context, buffer, options);
}
