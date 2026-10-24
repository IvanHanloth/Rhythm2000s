import { describe, expect, it } from 'vite-plus/test';
import { findOnset, peakOf, prepareSample } from './samples.ts';

/** Implements only what prepareSample uses */
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
  it("skips leading audio below 5% of the peak; any channel's attack counts", () => {
    const left = [0, 0.01, 0, 0, 0.2, 1];
    const right = [0, 0, 0, 0.5, 0, 0];
    expect(findOnset([Float32Array.from(left), Float32Array.from(right)])).toBe(3);
  });

  it('returns 0 for pure silence', () => {
    expect(findOnset([new Float32Array(4)])).toBe(0);
  });
});

describe('prepareSample', () => {
  it('trims leading silence (keeping 1 ms) and normalises the peak', () => {
    const buffer = fakeBuffer([[0, 0, 0, 0, 0, 0.25, -0.5, 0.1]]);
    const result = prepareSample(context, buffer, { peak: 1 });
    // Sample rate 1000: the attack is at sample 5, keep 1 before it
    const out = Array.from(result.getChannelData(0));
    [0, 0.5, -1, 0.2].forEach((value, i) => expect(out[i]).toBeCloseTo(value, 6));
    expect(out).toHaveLength(4);
    expect(peakOf([result.getChannelData(0)])).toBe(1);
  });

  it('only adjusts volume when trim is false', () => {
    const buffer = fakeBuffer([[0, 0, 0.5]]);
    const result = prepareSample(context, buffer, { peak: 1, trim: false });
    expect(Array.from(result.getChannelData(0))).toEqual([0, 0, 1]);
  });
});
