import { describe, expect, it } from 'vite-plus/test';
import { buildStatsRows, type InputKind, type TapRecord } from './records.ts';

function tap(seq: number, kind: InputKind, offsetA: number | null, offsetB: number): TapRecord {
  return {
    seq,
    kind,
    eventTimeStamp: seq * 500,
    timeStampFallback: false,
    beat: seq,
    offsetA,
    offsetB,
    baseLatencyMs: 5,
    outputLatencyMs: 20,
  };
}

describe('buildStatsRows', () => {
  it('groups by input type with methods A and B for each', () => {
    const rows = buildStatsRows([tap(0, 'keyboard', 10, 12), tap(1, 'mouse', 20, 25)]);
    expect(rows.map((row) => `${row.kind}/${row.method}`)).toEqual([
      'keyboard/A',
      'keyboard/B',
      'mouse/A',
      'mouse/B',
    ]);
    expect(rows[0]!.summary.mean).toBe(10);
    expect(rows[3]!.summary.mean).toBe(25);
  });

  it('gives only method B when method A is never available', () => {
    const rows = buildStatsRows([tap(0, 'touch', null, 40), tap(1, 'touch', null, 50)]);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.method).toBe('B');
    expect(rows[0]!.summary.median).toBe(45);
  });

  it('returns an empty list without input', () => {
    expect(buildStatsRows([])).toEqual([]);
  });
});
