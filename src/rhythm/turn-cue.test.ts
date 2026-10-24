import { describe, expect, it } from 'vite-plus/test';
import { buildCallResponseChart } from './chart.ts';
import { buildTurnCues, turnCueAt } from './turn-cue.ts';

const base = { bpm: 120, beatsPerBar: 4, countInBars: 1, outroBars: 1 };

describe('buildTurnCues', () => {
  it('连续的乐句：提前半拍切换，前后衔接没有空档', () => {
    const chart = buildCallResponseChart({ ...base, patterns: [[0], [0]] });

    expect(buildTurnCues(chart)).toEqual([
      { turn: 'call', phrase: 0, start: 3.5, end: 7.5 },
      { turn: 'response', phrase: 0, start: 7.5, end: 11.5 },
      { turn: 'call', phrase: 1, start: 11.5, end: 15.5 },
      { turn: 'response', phrase: 1, start: 15.5, end: 20 },
    ]);
  });

  it('最后一个 Your turn 显示到乐句结束', () => {
    const chart = buildCallResponseChart({ ...base, patterns: [[0]] });
    const cues = buildTurnCues(chart);

    expect(turnCueAt(cues, 11.9)?.turn).toBe('response');
    expect(turnCueAt(cues, 12)).toBeNull();
  });
});

describe('turnCueAt', () => {
  const chart = buildCallResponseChart({ ...base, patterns: [[0]] });
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
