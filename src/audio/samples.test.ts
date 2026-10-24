import { describe, expect, it } from 'vite-plus/test';
import { findOnset, peakOf, prepareSample } from './samples.ts';

/** 只实现 prepareSample 用到的部分 */
function fakeBuffer(channels: number[][], sampleRate = 1000): AudioBuffer {
  const data = channels.map((c) => Float32Array.from(c));
  return {
    numberOfChannels: data.length,
    length: data[0]!.length,
    sampleRate,
    getChannelData: (i: number) => data[i]!,
  } as unknown as AudioBuffer;
}

const context = {
  createBuffer: (channels: number, length: number, sampleRate: number) =>
    fakeBuffer(
      Array.from({ length: channels }, () => Array.from({ length }, () => 0)),
      sampleRate,
    ),
} as unknown as BaseAudioContext;

describe('findOnset', () => {
  it('跳过低于峰值 5% 的开头静音，任一声道起音就算', () => {
    const left = [0, 0.01, 0, 0, 0.2, 1];
    const right = [0, 0, 0, 0.5, 0, 0];
    expect(findOnset([Float32Array.from(left), Float32Array.from(right)])).toBe(3);
  });

  it('全是静音时返回 0', () => {
    expect(findOnset([new Float32Array(4)])).toBe(0);
  });
});

describe('prepareSample', () => {
  it('切掉开头静音（保留 1 毫秒），并把峰值统一到指定值', () => {
    const buffer = fakeBuffer([[0, 0, 0, 0, 0, 0.25, -0.5, 0.1]]);
    const result = prepareSample(context, buffer, { peak: 1 });
    // 采样率 1000：起音在第 5 个采样，往前留 1 个
    const out = Array.from(result.getChannelData(0));
    [0, 0.5, -1, 0.2].forEach((value, i) => expect(out[i]).toBeCloseTo(value, 6));
    expect(out).toHaveLength(4);
    expect(peakOf([result.getChannelData(0)])).toBe(1);
  });

  it('trim 为 false 时只调音量', () => {
    const buffer = fakeBuffer([[0, 0, 0.5]]);
    const result = prepareSample(context, buffer, { peak: 1, trim: false });
    expect(Array.from(result.getChannelData(0))).toEqual([0, 0, 1]);
  });
});
