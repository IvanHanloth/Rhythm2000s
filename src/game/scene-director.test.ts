import { describe, expect, it } from 'vite-plus/test';
import type { Container } from 'pixi.js';
import type { FrameInfo, Scene, SceneContext, SceneEntry } from './scene.ts';
import { SceneDirector, type SceneHost } from './scene-director.ts';

/** 记录调用顺序的假场景，不依赖 PixiJS 渲染。 */
function fakeEntry(id: string, log: string[]): SceneEntry {
  return {
    id: id as SceneEntry['id'],
    label: id,
    create(): Scene {
      log.push(`create ${id}`);
      return {
        view: { label: id } as unknown as Container,
        update: (frame: FrameInfo) => log.push(`update ${id} ${frame.audioTime}`),
        onTap: (tap) => log.push(`tap ${id} ${tap.audioTime}`),
        destroy: () => log.push(`destroy ${id}`),
      };
    },
  };
}

/** 假场景用不到音频时钟 */
const context = { calibration: () => 0, charts: [], leave() {} } as unknown as SceneContext;

function fakeHost(log: string[]): SceneHost {
  return {
    addChild: (view) => log.push(`add ${view.label}`),
    removeChild: (view) => log.push(`remove ${view.label}`),
  };
}

describe('SceneDirector', () => {
  it('切换场景时先移除并销毁旧场景，再创建新场景', () => {
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

  it('已经在目标场景时不重建', () => {
    const log: string[] = [];
    const director = new SceneDirector(fakeHost(log), [fakeEntry('a', log)], context);

    director.show('a');
    director.show('a');

    expect(log).toEqual(['create a', 'add a']);
  });

  it('每帧只更新当前场景', () => {
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

  it('输入只转给当前场景', () => {
    const log: string[] = [];
    const director = new SceneDirector(fakeHost(log), [fakeEntry('a', log)], context);

    director.tap({ audioTime: 1 });
    director.show('a');
    director.tap({ audioTime: 2 });

    expect(log.filter((line) => line.startsWith('tap'))).toEqual(['tap a 2']);
  });

  it('Esc 转给当前场景；场景没处理或没有场景时返回 false', () => {
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

  it('切换到没登记的场景时报错，并保留当前场景', () => {
    const log: string[] = [];
    const director = new SceneDirector(fakeHost(log), [fakeEntry('a', log)], context);
    director.show('a');

    expect(() => director.show('missing')).toThrow('没有登记场景 missing');
    expect(director.currentId).toBe('a');
  });

  it('不允许重复登记同一个场景标识', () => {
    expect(
      () => new SceneDirector(fakeHost([]), [fakeEntry('a', []), fakeEntry('a', [])], context),
    ).toThrow('场景 a 重复登记');
  });
});
