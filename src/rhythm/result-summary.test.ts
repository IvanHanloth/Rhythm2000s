import { describe, expect, it } from 'vite-plus/test';
import { formatScore, summarizeResult, type HitResult } from './result-summary.ts';

const perfect = (offset: number, phrase = 0): HitResult => ({ level: 'perfect', offset, phrase });
const good = (offset: number, phrase = 0): HitResult => ({ level: 'good', offset, phrase });
const miss = (phrase = 0): HitResult => ({ level: 'miss', offset: null, phrase });

describe('summarizeResult', () => {
  it('Perfect 1 point, Good half, Miss 0, scaled to 10000', () => {
    const summary = summarizeResult([perfect(0), perfect(0), good(0.06), miss()]);
    expect(summary.counts).toEqual({ perfect: 2, good: 1, miss: 1 });
    expect(summary.score).toBe(6250);
    expect(summary.rank).toBe('ok');
  });

  it('8000 and up is Superb, below 6000 is Try again', () => {
    expect(summarizeResult([perfect(0), perfect(0), perfect(0), perfect(0), good(0.06)]).rank).toBe(
      'superb',
    );
    expect(summarizeResult([perfect(0), miss()]).rank).toBe('tryAgain');
  });

  it('best combo is the longest run of hits; Full Combo needs a press and no Miss', () => {
    const summary = summarizeResult([
      perfect(0),
      good(0.05),
      miss(),
      perfect(0),
      perfect(0),
      good(0),
    ]);
    expect(summary.bestCombo).toBe(3);
    expect(summary.fullCombo).toBe(false);
    expect(summarizeResult([perfect(0), good(0.05)]).fullCombo).toBe(true);
    expect(summarizeResult([]).fullCombo).toBe(false);
  });

  it('buckets offsets by 20 ms; beyond ±120 ms goes to the ends', () => {
    const { bins } = summarizeResult([perfect(0), perfect(0.009), good(-0.061), good(0.15)]);
    expect(bins).toEqual([0, 0, 0, 1, 0, 0, 2, 0, 0, 0, 0, 0, 1]);
  });

  it('comments: overall verdict, phrases with mistakes, a hint when consistently late', () => {
    const summary = summarizeResult([
      perfect(0.03, 0),
      perfect(0.03, 0),
      perfect(0.03, 1),
      perfect(0.03, 1),
      miss(3),
      miss(6),
    ]);
    expect(summary.missedPhrases).toEqual([4, 7]);
    expect(summary.meanOffsetMs).toBeCloseTo(30, 6);
    expect(summary.comments).toEqual([
      'You mostly kept up with the beat.',
      'Phrases 4, 7 had mistakes.',
      'You were 30 ms late on average. Try recalibrating.',
    ]);
  });

  it('says so when there are no mistakes and timing is centred; too few hits gets no timing comment', () => {
    const steady = summarizeResult([perfect(0.01), perfect(-0.01), perfect(0), perfect(0)]);
    expect(steady.comments.slice(1)).toEqual([
      'No mistakes.',
      'Your timing was neither early nor late.',
    ]);
    expect(summarizeResult([perfect(0.05)]).comments).toHaveLength(2);
  });

  it('lists at most 3 phrases with mistakes', () => {
    const summary = summarizeResult([miss(0), miss(1), miss(2), miss(3)]);
    expect(summary.comments[1]).toBe('Phrases 1, 2, 3 and more had mistakes.');
    expect(summary.score).toBe(0);
    expect(summary.meanOffsetMs).toBeNull();
  });
});

describe('formatScore', () => {
  it('pads to five digits', () => {
    expect(formatScore(8250)).toBe('08250');
    expect(formatScore(10000)).toBe('10000');
  });
});
