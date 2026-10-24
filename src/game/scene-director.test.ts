import { describe, expect, it } from 'vite-plus/test';
import type { Container } from 'pixi.js';
import type { FrameInfo, Scene, SceneEntry } from './scene.ts';
import { SceneDirector, type SceneHost } from './scene-director.ts';

/** 记录调用顺序的假场景，不依赖 PixiJS 渲染。 */
function fakeEntry(id: string, log: string[]): SceneEntry {
  return {
    id,
    label: id,
    create(): Scene {
      log.push(`create ${id}`);
      return {
        view: { label: id } as unknown as Container,
        update: (frame: FrameInfo) => log.push(`update ${id} ${frame.audioTime}`),
        destroy: () => log.push(`destroy ${id}`),
      };
    },
  };
}

function fakeHost(log: string[]): SceneHost {
  return {
    addChild: (view) => log.push(`add ${view.label}`),
    removeChild: (view) => log.push(`remove ${view.label}`),
  };
}

describe('SceneDirector', () => {
  it('切换场景时先移除并销毁旧场景，再创建新场景', () => {
    const log: string[] = [];
    const director = new SceneDirector(fakeHost(log), [fakeEntry('a', log), fakeEntry('b', log)]);

    director.show('a');
    director.show('b');

    expect(director.currentId).toBe('b');
    expect(log).toEqual(['create a', 'add a', 'remove a', 'destroy a', 'create b', 'add b']);
  });

  it('已经在目标场景时不重建', () => {
    const log: string[] = [];
    const director = new SceneDirector(fakeHost(log), [fakeEntry('a', log)]);

    director.show('a');
    director.show('a');

    expect(log).toEqual(['create a', 'add a']);
  });

  it('每帧只更新当前场景', () => {
    const log: string[] = [];
    const director = new SceneDirector(fakeHost(log), [fakeEntry('a', log), fakeEntry('b', log)]);

    director.update({ audioTime: 0 });
    director.show('b');
    director.update({ audioTime: 1.5 });

    expect(log.filter((line) => line.startsWith('update'))).toEqual(['update b 1.5']);
  });

  it('切换到没登记的场景时报错，并保留当前场景', () => {
    const log: string[] = [];
    const director = new SceneDirector(fakeHost(log), [fakeEntry('a', log)]);
    director.show('a');

    expect(() => director.show('missing')).toThrow('没有登记场景 missing');
    expect(director.currentId).toBe('a');
  });

  it('不允许重复登记同一个场景标识', () => {
    expect(() => new SceneDirector(fakeHost([]), [fakeEntry('a', []), fakeEntry('a', [])])).toThrow(
      '场景 a 重复登记',
    );
  });
});
