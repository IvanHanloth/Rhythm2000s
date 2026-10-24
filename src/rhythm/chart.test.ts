import { describe, expect, it } from 'vite-plus/test';
import { buildCallResponseChart } from './chart.ts';

const base = { bpm: 120, beatsPerBar: 4, countInBars: 1, outroBars: 1 };

describe('buildCallResponseChart', () => {
  it('跟打目标比示范动作晚整整 1 小节', () => {
    const chart = buildCallResponseChart({ ...base, patterns: [[0, 1, 2]] });

    expect(chart.calls.map((c) => c.beat)).toEqual([4, 5, 6]);
    expect(chart.responses.map((c) => c.beat)).toEqual([8, 9, 10]);
    expect(chart.phrases).toEqual([{ callStart: 4, responseStart: 8, end: 12 }]);
  });

  it('乐句依次排列，并记录乐句序号和乐句内序号', () => {
    const chart = buildCallResponseChart({ ...base, patterns: [[0], [0.5, 3]] });

    expect(chart.calls).toEqual([
      { beat: 4, phrase: 0, index: 0 },
      { beat: 12.5, phrase: 1, index: 0 },
      { beat: 15, phrase: 1, index: 1 },
    ]);
    expect(chart.responses.map((c) => c.beat)).toEqual([8, 16.5, 19]);
  });

  it('全曲长度 = 预备 + 每个乐句 2 小节 + 结尾', () => {
    const chart = buildCallResponseChart({ ...base, patterns: [[0], [0], [0]] });
    expect(chart.endBeat).toBe((1 + 3 * 2 + 1) * 4);
  });

  it('拍位置超出小节、乱序或乐句为空时报错', () => {
    expect(() => buildCallResponseChart({ ...base, patterns: [[4]] })).toThrow('超出小节');
    expect(() => buildCallResponseChart({ ...base, patterns: [[1, 1]] })).toThrow('从小到大');
    expect(() => buildCallResponseChart({ ...base, patterns: [[]] })).toThrow('没有动作');
  });
});
