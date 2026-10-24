import { describe, expect, it } from 'vite-plus/test';
import { newDraft } from './chart-draft.ts';
import { ChartEditor, describeProblem, gridBeats, snapBeat } from './chart-editor.ts';

describe('ChartEditor', () => {
  it('undoes and redoes edits, and knows when the chart has unsaved changes', () => {
    const editor = new ChartEditor(newDraft('windows-xp'), null);
    expect(editor.dirty).toBe(false);
    editor.place(1, 'dialog-info');
    editor.setSong('title', 'Pop-ups');
    expect(editor.dirty).toBe(true);
    editor.undo();
    expect(editor.draft.title).toBe('Untitled');
    editor.undo();
    expect(editor.draft.phrases[0]!.events).toEqual([]);
    expect(editor.dirty).toBe(false);
    editor.redo();
    expect(editor.draft.phrases[0]!.events).toHaveLength(1);
    editor.setSong('id', 'pop-ups');
    expect(editor.canRedo).toBe(false);
    editor.markSaved();
    expect(editor.dirty).toBe(false);
    expect(editor.savedId).toBe('pop-ups');
  });

  it('keeps the selection inside the chart after deletes and undo', () => {
    const editor = new ChartEditor(newDraft('windows-xp'), null);
    editor.addPhrase();
    editor.place(0, 'dialog-info');
    expect(editor.phrase).toBe(1);
    expect(editor.selection).toEqual({ lane: 'call', index: 0 });
    editor.deletePhrase();
    expect(editor.phrase).toBe(0);
    expect(editor.selection).toBeNull();
    editor.undo();
    editor.selectPhrase(1);
    editor.selectEvent({ lane: 'call', index: 0 });
    editor.removeSelected();
    expect(editor.draft.phrases[1]!.events).toEqual([]);
  });

  it('reports problems in the editor’s words', () => {
    const editor = new ChartEditor(newDraft('windows-xp'), null);
    const texts = editor.problems.map((p) => p.text);
    expect(texts).toContain('File name must be a string of lowercase letters, digits and hyphens');
    expect(texts).toContain('Phrase 1: add at least one action');
    editor.setSong('id', 'ok');
    editor.place(0, 'dialog-info');
    expect(editor.problems).toEqual([]);
  });
});

describe('describeProblem', () => {
  it('ties event errors to their phrase and event', () => {
    expect(describeProblem('phrases[2].call[1].beat must be after the previous event')).toEqual({
      phrase: 2,
      event: { lane: 'call', index: 1 },
      text: 'Phrase 3, call 2: beat must be after the previous event',
    });
    expect(describeProblem('phrases[0]: 7 message boxes, the XP scene allows at most 6')).toEqual({
      phrase: 0,
      event: null,
      text: 'Phrase 1: 7 message boxes, the XP scene allows at most 6',
    });
  });
});

describe('grid', () => {
  it('snaps inside the bar', () => {
    expect(snapBeat(1.3, 0.5, 4)).toBe(1.5);
    expect(snapBeat(-1, 0.5, 4)).toBe(0);
    expect(snapBeat(9, 0.25, 4)).toBe(3.75);
    expect(gridBeats(3, 0.5)).toEqual([0, 0.5, 1, 1.5, 2, 2.5]);
  });
});
