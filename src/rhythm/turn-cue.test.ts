import { describe, expect, it } from 'vite-plus/test';
import { chartFromPatterns } from './test-charts.ts';
import { buildTurnCues, checkTurnCueSpacing, turnCueAt } from './turn-cue.ts';

describe('buildTurnCues', () => {
  it('连续的乐句：提前半拍切换，前后衔接没有空档', () => {
    const chart = chartFromPatterns([[0], [0]]);

    expect(buildTurnCues(chart)).toEqual([
      { turn: 'call', phrase: 0, start: 3.5, end: 7.5 },
      { turn: 'response', phrase: 0, start: 7.5, end: 11.5 },
      { turn: 'call', phrase: 1, start: 11.5, end: 15.5 },
      { turn: 'response', phrase: 1, start: 15.5, end: 20 },
    ]);
  });

  it('最后一个 Your turn 显示到乐句结束', () => {
    const chart = chartFromPatterns([[0]]);
    const cues = buildTurnCues(chart);

    expect(turnCueAt(cues, 11.9)?.turn).toBe('response');
    expect(turnCueAt(cues, 12)).toBeNull();
  });
});

describe('turnCueAt', () => {
  const chart = chartFromPatterns([[0]]);
  const cues = buildTurnCues(chart);

  it('预备小节前半段没有提示，最后半拍开始显示 Follow me', () => {
    expect(turnCueAt(cues, 3)).toBeNull();
    expect(turnCueAt(cues, 3.5)?.turn).toBe('call');
  });

  it('跟打小节开头前半拍换成 Your turn', () => {
    expect(turnCueAt(cues, 7.49)?.turn).toBe('call');
    expect(turnCueAt(cues, 7.5)?.turn).toBe('response');
  });
});

describe('checkTurnCueSpacing', () => {
  it('最后一个事件的判定窗口在提示切换前关闭时没有错误', () => {
    expect(checkTurnCueSpacing(chartFromPatterns([[0, 3.25]]), 0.1)).toEqual([]);
  });

  it('事件太靠后时，示范和跟打都报出路径和允许的拍位置', () => {
    // 第二个乐句只用来让第一个乐句的 Your turn 提前切走
    expect(checkTurnCueSpacing(chartFromPatterns([[0, 3.5], [0]]), 0.1)).toEqual([
      'phrases[0].call[1]：第 3.5 拍太靠后，提示会在判定结束前切走；120 BPM 下要早于第 3.3 拍',
      'phrases[0].response[1]：第 3.5 拍太靠后，提示会在判定结束前切走；120 BPM 下要早于第 3.3 拍',
    ]);
  });

  it('最后一个乐句的 Your turn 显示到乐句结束，跟打可以更靠后', () => {
    const errors = checkTurnCueSpacing(chartFromPatterns([[0, 3.5]]), 0.1);
    expect(errors.map((e) => e.split('：')[0])).toEqual(['phrases[0].call[1]']);
  });
});
