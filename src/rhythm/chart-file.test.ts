import { describe, expect, it } from 'vite-plus/test';
import { parseChartFile, parseChartIndex, type ChartFileOptions } from './chart-file.ts';
import { sourceFromPatterns } from './test-charts.ts';

const options: ChartFileOptions = {
  scenes: { 'windows-xp': ['dialog-info'], 'mac-2000': [] },
};

/** 深拷贝成普通 JSON 对象，方便改坏某个字段 */
function json(value: unknown): Record<string, any> {
  return JSON.parse(JSON.stringify(value));
}

function errorsOf(data: unknown, opts = options): string[] {
  const result = parseChartFile(data, opts);
  return result.ok ? [] : result.errors;
}

describe('parseChartFile', () => {
  it('合法的谱面通过校验', () => {
    const result = parseChartFile(json(sourceFromPatterns([[0, 1.5]])), options);
    expect(result.ok).toBe(true);
  });

  it('response 可以省略，也可以显式写出', () => {
    const data = json(sourceFromPatterns([[0, 1]]));
    data.phrases[0].response = [{ beat: 2, action: 'dialog-info' }];
    expect(errorsOf(data)).toEqual([]);
  });

  it('responseGapBeats 可选；写了就必须是不小于 0 的数字', () => {
    const data = json(sourceFromPatterns([[0], [0]], { responseGapBeats: 4 }));
    data.phrases[0].responseGapBeats = 2;
    expect(errorsOf(data)).toEqual([]);

    data.responseGapBeats = -1;
    data.phrases[1].responseGapBeats = '1';
    expect(errorsOf(data)).toEqual([
      'responseGapBeats 必须是不小于 0 的数字',
      'phrases[1].responseGapBeats 必须是不小于 0 的数字',
    ]);
  });

  it('缺字段、类型不对时逐个报出', () => {
    const data = json(sourceFromPatterns([[0]]));
    delete data.title;
    data.bpm = 0;
    data.beatsPerBar = 3.5;
    expect(errorsOf(data)).toEqual([
      'title 必须是非空字符串',
      'bpm 必须是大于 0 的数字',
      'beatsPerBar 必须是大于 0 的整数',
    ]);
  });

  it('未定义的字段视为错误，防止拼错字段名', () => {
    const data = json(sourceFromPatterns([[0]]));
    data.phrases[0].respone = [];
    data.phrases[0].call[0].actoin = 'x';
    expect(errorsOf(data)).toEqual([
      'phrases[0].respone 是未定义的字段',
      'phrases[0].call[0].actoin 是未定义的字段',
    ]);
  });

  it('格式版本不对时报错', () => {
    const data = json(sourceFromPatterns([[0]]));
    data.format = 2;
    expect(errorsOf(data)).toEqual(['format 必须是 1，收到 2']);
  });

  it('拍位置超出小节、乱序、重复时报出路径', () => {
    const data = json(sourceFromPatterns([[0, 2, 2, 4]]));
    expect(errorsOf(data)).toEqual([
      'phrases[0].call[2].beat 必须大于上一个事件的拍位置',
      'phrases[0].call[3].beat 必须小于每小节拍数 4',
    ]);
  });

  it('要按两下的动作：下一个事件要在第二下之后，第二下也要在小节之内', () => {
    const refresh = { scenes: { 'windows-xp': ['dialog-info', 'desktop-refresh'] } } as const;
    const data = json(sourceFromPatterns([[0]]));
    data.phrases[0].call = [
      { beat: 0, action: 'desktop-refresh' },
      { beat: 0.5, action: 'dialog-info' },
      { beat: 1, action: 'desktop-refresh' },
      { beat: 1.5, action: 'dialog-info' },
      { beat: 3.5, action: 'desktop-refresh' },
    ];
    expect(errorsOf(data, refresh)).toEqual([
      'phrases[0].call[1].beat 必须在上一个事件的最后一下（第 0.5 拍）之后',
      'phrases[0].call[3].beat 必须在上一个事件的最后一下（第 1.5 拍）之后',
      'phrases[0].call[4].beat：desktop-refresh 的最后一下在第 4 拍，必须小于每小节拍数 4',
    ]);
  });

  it('未知动作、场景不支持的动作、未知场景都报错', () => {
    const unknownAction = json(sourceFromPatterns([[0]]));
    unknownAction.phrases[0].call[0].action = 'refresh';
    expect(errorsOf(unknownAction)[0]).toContain('phrases[0].call[0].action 必须是已有动作之一');

    const macChart = json(sourceFromPatterns([[0]], { scene: 'mac-2000' }));
    expect(errorsOf(macChart)).toEqual([
      'phrases[0].call[0].action：场景 mac-2000 不支持动作 dialog-info',
    ]);

    const unknownScene = json(sourceFromPatterns([[0]], { scene: 'win98' }));
    expect(errorsOf(unknownScene)[0]).toContain('scene 必须是已有场景之一');
  });

  it('id 与文件名不一致时报错', () => {
    const data = json(sourceFromPatterns([[0]], { id: 'abc' }));
    expect(errorsOf(data, { ...options, expectedId: 'xyz' })).toEqual([
      'id「abc」必须与文件名「xyz」一致',
    ]);
  });

  it('不是对象、乐句为空时报错', () => {
    expect(errorsOf([])).toEqual(['谱面必须是一个 JSON 对象']);
    const data = json(sourceFromPatterns([]));
    expect(errorsOf(data)).toEqual(['phrases 必须是至少有一个乐句的数组']);
  });
});

describe('parseChartIndex', () => {
  it('合法清单通过', () => {
    expect(parseChartIndex({ format: 1, charts: ['a.json', 'b-2.json'] }).ok).toBe(true);
  });

  it('文件名不合规或重复时报错', () => {
    const result = parseChartIndex({ format: 1, charts: ['../x.json', 'a.json', 'a.json'] });
    expect(result.ok ? [] : result.errors).toEqual([
      'charts[0] 必须是「小写字母、数字、连字符 + .json」的文件名',
      'charts[2]「a.json」重复',
    ]);
  });
});
