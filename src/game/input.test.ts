import { describe, expect, it } from 'vite-plus/test';
import { resolveTimeStamp } from './input.ts';

describe('resolveTimeStamp', () => {
  it('uses a normal event time as is', () => {
    expect(resolveTimeStamp(990, 1000)).toBe(990);
  });

  it('falls back to now when the event time is 0 or an epoch time', () => {
    expect(resolveTimeStamp(0, 1000)).toBe(1000);
    expect(resolveTimeStamp(1_700_000_000_000, 1000)).toBe(1000);
  });
});
