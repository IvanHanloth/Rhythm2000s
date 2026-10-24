import { describe, expect, it } from 'vite-plus/test';
import { buildChart } from './chart.ts';
import { chartFromPatterns, sourceFromPatterns } from './test-charts.ts';

describe('buildChart', () => {
  it('没写 response 时，跟打与示范相同、晚整整 1 小节', () => {
    const chart = chartFromPatterns([[0, 1, 2]]);

    expect(chart.calls.map((c) => c.beat)).toEqual([4, 5, 6]);
    expect(chart.responses.map((c) => c.beat)).toEqual([8, 9, 10]);
    expect(chart.phrases).toEqual([{ callStart: 4, callEnd: 8, responseStart: 8, end: 12 }]);
  });

  it('顶层 responseGapBeats 在示范和跟打之间插入空档，乐句可以单独覆盖', () => {
    const source = sourceFromPatterns([[0], [0], [0]], { responseGapBeats: 4 });
    source.phrases[1]!.responseGapBeats = 2;
    source.phrases[2]!.responseGapBeats = 0;
    const chart = buildChart(source);

    expect(chart.phrases).toEqual([
      { callStart: 4, callEnd: 8, responseStart: 12, end: 16 },
      { callStart: 16, callEnd: 20, responseStart: 22, end: 26 },
      { callStart: 26, callEnd: 30, responseStart: 30, end: 34 },
    ]);
    expect(chart.responses.map((c) => c.beat)).toEqual([12, 22, 30]);
    expect(chart.endBeat).toBe(34 + 4);
  });

  it('不写 responseGapBeats 时，空档默认 0.5 拍', () => {
    const source = sourceFromPatterns([[0]]);
    delete source.responseGapBeats;
    expect(buildChart(source).phrases).toEqual([
      { callStart: 4, callEnd: 8, responseStart: 8.5, end: 12.5 },
    ]);
  });

  it('写了 response 时按 response 排跟打目标', () => {
    const source = sourceFromPatterns([[0, 1]]);
    source.phrases[0]!.response = [{ beat: 0.5, action: 'dialog-info' }];
    const chart = buildChart(source);

    expect(chart.responses).toEqual([{ beat: 8.5, phrase: 0, index: 0, action: 'dialog-info' }]);
  });

  it('乐句依次排列，记录乐句序号、乐句内序号和动作', () => {
    const chart = chartFromPatterns([[0], [0.5, 3]]);

    expect(chart.calls).toEqual([
      { beat: 4, phrase: 0, index: 0, action: 'dialog-info' },
      { beat: 12.5, phrase: 1, index: 0, action: 'dialog-info' },
      { beat: 15, phrase: 1, index: 1, action: 'dialog-info' },
    ]);
  });

  it('全曲长度 = 预备 + 每个乐句 2 小节 + 结尾', () => {
    expect(chartFromPatterns([[0], [0], [0]]).endBeat).toBe((1 + 3 * 2 + 1) * 4);
  });

  it('保留 id、标题和场景', () => {
    const chart = chartFromPatterns([[0]], { id: 'abc', title: '曲名', scene: 'mac-2000' });
    expect([chart.id, chart.title, chart.scene]).toEqual(['abc', '曲名', 'mac-2000']);
  });
});
