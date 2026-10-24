import { describe, expect, it } from 'vite-plus/test';
import { resolveTimeStamp } from './input.ts';

describe('resolveTimeStamp', () => {
  it('正常的事件时间直接使用', () => {
    expect(resolveTimeStamp(990, 1000)).toBe(990);
  });

  it('事件时间为 0 或是纪元时间时，退回当前时间', () => {
    expect(resolveTimeStamp(0, 1000)).toBe(1000);
    expect(resolveTimeStamp(1_700_000_000_000, 1000)).toBe(1000);
  });
});
