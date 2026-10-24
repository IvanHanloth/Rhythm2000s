import { describe, expect, it } from 'vite-plus/test';
import type { Container } from 'pixi.js';
import type { FrameInfo, Scene, SceneContext, SceneEntry } from './scene.ts';
import { SceneDirector, type SceneHost } from './scene-director.ts';

/** Fake scene that logs calls, no PixiJS rendering. */
function fakeEntry(id: string, log: string[]): SceneEntry {
  return {
    id: id as SceneEntry['id'],
    label: id,
    create(context): Scene {
      log.push(context.chartId ? `create ${id} ${context.chartId}` : `create ${id}`);
      return {
        view: { label: id } as unknown as Container,
        update: (frame: FrameInfo) => log.push(`update ${id} ${frame.audioTime}`),
        onTap: (tap) => log.push(`tap ${id} ${tap.audioTime}`),
        destroy: () => log.push(`destroy ${id}`),
      };
    },
  };
}

/** Fake scenes don't need the audio clock */
const context = { calibration: () => 0, charts: [], leave() {} } as unknown as SceneContext;

function fakeHost(log: string[]): SceneHost {
  return {
    addChild: (view) => log.push(`add ${view.label}`),
    removeChild: (view) => log.push(`remove ${view.label}`),
  };
}

describe('SceneDirector', () => {
  it('removes and destroys the old scene before creating the new one', () => {
    const log: string[] = [];
    const director = new SceneDirector(
      fakeHost(log),
      [fakeEntry('a', log), fakeEntry('b', log)],
      context,
    );

    director.show('a');
    director.show('b');

    expect(director.currentId).toBe('b');
    expect(log).toEqual(['create a', 'add a', 'remove a', 'destroy a', 'create b', 'add b']);
  });

  it('does not rebuild when already on the target scene', () => {
    const log: string[] = [];
    const director = new SceneDirector(fakeHost(log), [fakeEntry('a', log)], context);

    director.show('a');
    director.show('a');

    expect(log).toEqual(['create a', 'add a']);
  });

  it('rebuilds for a different chart in the same scene and passes the chart id', () => {
    const log: string[] = [];
    const director = new SceneDirector(fakeHost(log), [fakeEntry('a', log)], context);

    director.show('a', 'x');
    director.show('a', 'x');
    director.show('a', 'y');

    expect(log).toEqual(['create a x', 'add a', 'remove a', 'destroy a', 'create a y', 'add a']);
  });

  it('updates only the current scene each frame', () => {
    const log: string[] = [];
    const director = new SceneDirector(
      fakeHost(log),
      [fakeEntry('a', log), fakeEntry('b', log)],
      context,
    );

    director.update({ audioTime: 0 });
    director.show('b');
    director.update({ audioTime: 1.5 });

    expect(log.filter((line) => line.startsWith('update'))).toEqual(['update b 1.5']);
  });

  it('forwards input only to the current scene', () => {
    const log: string[] = [];
    const director = new SceneDirector(fakeHost(log), [fakeEntry('a', log)], context);

    director.tap({ audioTime: 1 });
    director.show('a');
    director.tap({ audioTime: 2 });

    expect(log.filter((line) => line.startsWith('tap'))).toEqual(['tap a 2']);
  });

  it('forwards Esc to the current scene; false when it is unhandled or there is no scene', () => {
    const handled: SceneEntry = {
      id: 'a' as SceneEntry['id'],
      label: 'a',
      create: () => ({
        view: { label: 'a' } as unknown as Container,
        update() {},
        onEscape: () => true,
        destroy() {},
      }),
    };
    const director = new SceneDirector(fakeHost([]), [handled, fakeEntry('b', [])], context);

    expect(director.escape()).toBe(false);
    director.show('a');
    expect(director.escape()).toBe(true);
    director.show('b');
    expect(director.escape()).toBe(false);
  });

  it('throws on an unregistered scene and keeps the current one', () => {
    const log: string[] = [];
    const director = new SceneDirector(fakeHost(log), [fakeEntry('a', log)], context);
    director.show('a');

    expect(() => director.show('missing')).toThrow('Scene not registered: missing');
    expect(director.currentId).toBe('a');
  });

  it('rejects registering the same scene id twice', () => {
    expect(
      () => new SceneDirector(fakeHost([]), [fakeEntry('a', []), fakeEntry('a', [])], context),
    ).toThrow('Scene registered twice: a');
  });
});
