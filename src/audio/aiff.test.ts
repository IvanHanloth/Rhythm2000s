import { describe, expect, it } from 'vite-plus/test';
import { decodeAiff } from './aiff.ts';

/** 拼一个最小的 AIFF：COMM + SSND，16 位 */
function makeAiff(samples: number[][], sampleRateBytes: number[]): ArrayBuffer {
  const channels = samples.length;
  const frames = samples[0]!.length;
  const soundBytes = frames * channels * 2;
  const size = 12 + (8 + 18) + (8 + 8 + soundBytes);
  const view = new DataView(new ArrayBuffer(size));
  const writeId = (at: number, id: string) => {
    for (let i = 0; i < id.length; i++) view.setUint8(at + i, id.charCodeAt(i));
  };
  writeId(0, 'FORM');
  view.setUint32(4, size - 8);
  writeId(8, 'AIFF');
  writeId(12, 'COMM');
  view.setUint32(16, 18);
  view.setInt16(20, channels);
  view.setUint32(22, frames);
  view.setInt16(26, 16);
  sampleRateBytes.forEach((b, i) => view.setUint8(28 + i, b));
  writeId(38, 'SSND');
  view.setUint32(42, 8 + soundBytes);
  for (let f = 0; f < frames; f++) {
    for (let c = 0; c < channels; c++) {
      view.setInt16(54 + (f * channels + c) * 2, samples[c]![f]!);
    }
  }
  return view.buffer;
}

/** 44100 的 80 位扩展精度表示 */
const RATE_44100 = [0x40, 0x0e, 0xac, 0x44, 0, 0, 0, 0, 0, 0];

describe('decodeAiff', () => {
  it('读出采样率、声道数，并把 16 位采样换算到 -1～1', () => {
    const decoded = decodeAiff(
      makeAiff(
        [
          [0, 16384, -32768],
          [32767, 0, 0],
        ],
        RATE_44100,
      ),
    );
    expect(decoded.sampleRate).toBe(44100);
    expect(decoded.channels).toHaveLength(2);
    expect([...decoded.channels[0]!]).toEqual([0, 0.5, -1]);
    expect(decoded.channels[1]![0]).toBeCloseTo(1, 4);
  });

  it('不是 AIFF 时报错', () => {
    expect(() => decodeAiff(new ArrayBuffer(16))).toThrow('不是 AIFF 文件');
  });
});
