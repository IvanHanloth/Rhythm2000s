import { describe, expect, it } from 'vite-plus/test';
import { SCENE_CATALOG } from '@/scenes/catalog.ts';
import type { DrumKit } from './backing-track.ts';
import { buildShowcase, SHOWCASE_BEATS_PER_BAR, showcaseActAt, showcaseDrums } from './showcase.ts';

const buffer = (name: string) => name as unknown as AudioBuffer;
const KIT: DrumKit = {
  kick: buffer('kick'),
  snare: buffer('snare'),
  hat: buffer('hat'),
  countAccent: buffer('countAccent'),
  count: buffer('count'),
};

describe('buildShowcase', () => {
  for (const [sceneId, info] of [
    ['windows-xp', SCENE_CATALOG['windows-xp']],
    ['mac-2000', SCENE_CATALOG['mac-2000']],
  ] as const) {
    it(`${sceneId}: every widget, then hit effects, rhythm widgets and combo, back to back`, () => {
      const { acts, passBeats } = buildShowcase(sceneId, info.actions);
      expect(acts.map((act) => (act.kind === 'widget' ? act.action : act.kind))).toEqual([
        ...info.actions,
        'judgement',
        'judgement',
        'judgement',
        'beat-guide',
        'turn-banner',
        'combo',
        'combo',
        'combo',
        'combo-break',
      ]);
      // After a count-in bar, each act starts where the one before ends, on a bar line
      expect(acts[0]!.start).toBe(SHOWCASE_BEATS_PER_BAR);
      acts.forEach((act, i) => {
        if (i > 0) expect(act.start).toBe(acts[i - 1]!.end);
        expect(act.start % SHOWCASE_BEATS_PER_BAR).toBe(0);
      });
      expect(passBeats).toBe(acts.at(-1)!.end);
    });
  }

  it('shows each widget as one phrase with no count-in, the action on its first beat', () => {
    const [act] = buildShowcase('windows-xp', ['dialog-info']).acts;
    if (act?.kind !== 'widget') throw new Error('Expected a widget first');
    expect(act.end - act.start).toBe(act.chart.endBeat);
    expect(act.chart.calls.map((c) => [c.beat, c.action])).toEqual([[0, 'dialog-info']]);
    expect(act.chart.responses.map((c) => c.beat)).toEqual([SHOWCASE_BEATS_PER_BAR]);
  });

  it('shows the hit effects in order and the combo tiers one at a time', () => {
    const { acts } = buildShowcase('mac-2000', ['alert-note']);
    expect(acts.flatMap((act) => (act.kind === 'judgement' ? [act.level] : []))).toEqual([
      'perfect',
      'good',
      'miss',
    ]);
    expect(acts.flatMap((act) => (act.kind === 'combo' ? [act.tier] : []))).toEqual([1, 2, 3]);
  });

  it('refuses a scene without actions', () => {
    expect(() => buildShowcase('windows-xp', [])).toThrow();
  });
});

describe('showcaseActAt', () => {
  it('finds nothing in the count-in and past the end', () => {
    const showcase = buildShowcase('windows-xp', ['dialog-info']);
    expect(showcaseActAt(showcase, 0)).toBeNull();
    expect(showcaseActAt(showcase, SHOWCASE_BEATS_PER_BAR)?.kind).toBe('widget');
    expect(showcaseActAt(showcase, showcase.passBeats)).toBeNull();
  });
});

describe('showcaseDrums', () => {
  it('counts in, leaves widgets to their own rounds and drums under everything else', () => {
    const showcase = buildShowcase('windows-xp', ['dialog-info']);
    const track = showcaseDrums(showcase, KIT);
    const widget = showcase.acts[0]!;
    expect(track.filter((s) => s.beat < widget.start).map((s) => s.buffer)).toEqual([
      KIT.countAccent,
      KIT.count,
      KIT.count,
      KIT.count,
    ]);
    expect(track.some((s) => s.beat >= widget.start && s.beat < widget.end)).toBe(false);
    const kicks = track.filter((s) => s.buffer === KIT.kick).map((s) => s.beat);
    expect(kicks[0]).toBe(widget.end);
    expect(Math.max(...track.map((s) => s.beat))).toBeLessThan(showcase.passBeats);
  });
});
