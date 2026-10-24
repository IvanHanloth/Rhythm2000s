// 场景切换器：登记所有场景，同一时间只显示其中一个。
// 切换时旧场景整个销毁，不在后台继续运行。

import type { FrameInfo, Scene, SceneContext, SceneEntry, TapInfo } from './scene.ts';

/** 场景画面挂在哪里。只需要这两个方法，便于测试。 */
export interface SceneHost {
  addChild(view: Scene['view']): unknown;
  removeChild(view: Scene['view']): unknown;
}

export class SceneDirector {
  readonly entries: readonly SceneEntry[];
  private readonly host: SceneHost;
  private readonly context: SceneContext;
  private current: { id: string; scene: Scene } | null = null;

  constructor(host: SceneHost, entries: readonly SceneEntry[], context: SceneContext) {
    const ids = new Set<string>();
    for (const entry of entries) {
      if (ids.has(entry.id)) throw new Error(`场景 ${entry.id} 重复登记`);
      ids.add(entry.id);
    }
    this.host = host;
    this.entries = entries;
    this.context = context;
  }

  /** 当前场景的标识；还没有显示任何场景时为 null。 */
  get currentId(): string | null {
    return this.current?.id ?? null;
  }

  /** 切换到指定场景。已经在这个场景时什么都不做。 */
  show(id: string): void {
    if (this.current?.id === id) return;
    const entry = this.entries.find((e) => e.id === id);
    if (!entry) throw new Error(`没有登记场景 ${id}`);

    this.clear();
    const scene = entry.create(this.context);
    this.host.addChild(scene.view);
    this.current = { id, scene };
  }

  /** 每帧调用，转给当前场景。 */
  update(frame: FrameInfo): void {
    this.current?.scene.update(frame);
  }

  /** 玩家输入，转给当前场景。 */
  tap(tap: TapInfo): void {
    this.current?.scene.onTap?.(tap);
  }

  /** 销毁当前场景。 */
  clear(): void {
    if (!this.current) return;
    const { scene } = this.current;
    this.current = null;
    this.host.removeChild(scene.view);
    scene.destroy();
  }
}
