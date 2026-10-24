import { describe, expect, it } from 'vite-plus/test';
import { sourceFromPatterns } from '@/rhythm/test-charts.ts';
import {
  addPhrase,
  deletePhrase,
  draftFromSource,
  draftToSource,
  duplicatePhrase,
  moveCallEvent,
  movePhrase,
  moveResponseEvent,
  newDraft,
  placeEvent,
  removeEvent,
  resetResponse,
  setPhraseGap,
} from './chart-draft.ts';

const beats = (draft: ReturnType<typeof newDraft>, p = 0) =>
  draft.phrases[p]!.events.map((e) => [e.call, e.response]);

describe('chart drafts', () => {
  it('round-trips a chart file, writing response and gaps only when they differ', () => {
    const source = sourceFromPatterns(
      [
        [0, 1],
        [0, 2],
      ],
      { responseGapBeats: 2 },
    );
    source.phrases[1]!.response = [
      { beat: 0.5, action: 'dialog-info' },
      { beat: 2, action: 'dialog-info' },
    ];
    source.phrases[0]!.responseGapBeats = 1;
    const draft = draftFromSource(source);
    expect(draft.phrases.map((p) => p.ownResponse)).toEqual([false, true]);
    expect(draftToSource(draft)).toEqual(source);

    const plain = draftToSource({ ...draft, gap: 0 });
    expect('responseGapBeats' in plain).toBe(false);
  });

  it('keeps the icon, and leaves it out of the file when the actions pick it', () => {
    const source = { ...sourceFromPatterns([[0]]), icon: 'my-computer' };
    const draft = draftFromSource(source);
    expect(draft.icon).toBe('my-computer');
    expect(draftToSource(draft).icon).toBe('my-computer');
    expect('icon' in draftToSource({ ...draft, icon: null })).toBe(false);
  });

  it('places events in call order, on the same beat in the response', () => {
    let draft = newDraft('windows-xp');
    draft = placeEvent(draft, 0, 2, 'dialog-info').draft;
    const placed = placeEvent(draft, 0, 1, 'dialog-error');
    expect(placed.index).toBe(0);
    expect(beats(placed.draft)).toEqual([
      [1, 1],
      [2, 2],
    ]);
    const replaced = placeEvent(placed.draft, 0, 2, 'dialog-warning');
    expect(replaced.index).toBe(1);
    expect(replaced.draft.phrases[0]!.events.map((e) => e.action)).toEqual([
      'dialog-error',
      'dialog-warning',
    ]);
  });

  it('moves the response with the call until the response has its own rhythm', () => {
    let draft = placeEvent(newDraft('windows-xp'), 0, 0, 'dialog-info').draft;
    draft = placeEvent(draft, 0, 1, 'dialog-info').draft;
    const moved = moveCallEvent(draft, 0, 0, 2);
    expect(moved.index).toBe(1);
    expect(beats(moved.draft)).toEqual([
      [1, 1],
      [2, 2],
    ]);

    const own = moveResponseEvent(moved.draft, 0, 1, 2.5);
    expect(own.phrases[0]!.ownResponse).toBe(true);
    expect(beats(moveCallEvent(own, 0, 0, 0).draft)).toEqual([
      [0, 1],
      [2, 2.5],
    ]);
    expect(beats(resetResponse(own, 0))).toEqual([
      [1, 1],
      [2, 2],
    ]);
  });

  it('refuses to move an event onto an occupied call beat', () => {
    let draft = placeEvent(newDraft('windows-xp'), 0, 0, 'dialog-info').draft;
    draft = placeEvent(draft, 0, 1, 'dialog-info').draft;
    expect(moveCallEvent(draft, 0, 0, 1)).toEqual({ draft, index: 0 });
  });

  it('adds, duplicates, moves and deletes phrases, always keeping one', () => {
    let draft = placeEvent(newDraft('windows-xp'), 0, 0, 'dialog-info').draft;
    draft = addPhrase(draft, 0);
    expect(draft.phrases[1]!.events).toEqual([]);
    draft = duplicatePhrase(draft, 0);
    expect(draft.phrases.map((p) => p.events.length)).toEqual([1, 1, 0]);
    draft = movePhrase(draft, 2, -1);
    expect(draft.phrases.map((p) => p.events.length)).toEqual([1, 0, 1]);
    expect(movePhrase(draft, 0, -1)).toBe(draft);
    draft = setPhraseGap(draft, 1, 2);
    expect(draft.phrases[1]!.gap).toBe(2);

    let one = deletePhrase(deletePhrase(draft, 0), 0);
    one = deletePhrase(one, 0);
    expect(one.phrases).toEqual([{ events: [], ownResponse: false, gap: null }]);
    expect(removeEvent(draft, 0, 0).phrases[0]!.events).toEqual([]);
  });
});
