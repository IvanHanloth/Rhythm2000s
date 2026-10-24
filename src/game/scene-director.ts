// Scene director: registers every scene and shows one at a time.
// Switching destroys the old scene entirely; nothing keeps running in the background.

import type { FrameInfo, Scene, SceneContext, SceneEntry, TapInfo } from './scene.ts';

/** Where scene views attach. Only these two methods, to keep it testable. */
export interface SceneHost {
  addChild(view: Scene['view']): void;
  removeChild(view: Scene['view']): void;
}

export class SceneDirector {
  readonly entries: readonly SceneEntry[];
  private readonly host: SceneHost;
  private context: SceneContext;
  private current: { id: string; chartId: string | undefined; scene: Scene } | null = null;

  constructor(host: SceneHost, entries: readonly SceneEntry[], context: SceneContext) {
    const ids = new Set<string>();
    for (const entry of entries) {
      if (ids.has(entry.id)) throw new Error(`Scene registered twice: ${entry.id}`);
      ids.add(entry.id);
    }
    this.host = host;
    this.entries = entries;
    this.context = context;
  }

  /** Shows the intro before a level; every scene created afterwards gets it */
  setIntroduce(introduce: SceneContext['introduce']): void {
    this.context = { ...this.context, introduce };
  }

  /** Current scene id; null before any scene is shown. */
  get currentId(): string | null {
    return this.current?.id ?? null;
  }

  /** Switches to a scene, optionally with a chart. Does nothing when already on that scene and chart. */
  show(id: string, chartId?: string): void {
    if (this.current?.id === id && this.current.chartId === chartId) return;
    const entry = this.entries.find((e) => e.id === id);
    if (!entry) throw new Error(`Scene not registered: ${id}`);

    this.clear();
    const scene = entry.create({ ...this.context, chartId });
    this.host.addChild(scene.view);
    this.current = { id, chartId, scene };
  }

  update(frame: FrameInfo): void {
    this.current?.scene.update(frame);
  }

  tap(tap: TapInfo): void {
    this.current?.scene.onTap?.(tap);
  }

  /** The player released; forwarded to the current scene. */
  release(tap: TapInfo): void {
    this.current?.scene.onRelease?.(tap);
  }

  /** The player pressed Esc; forwarded to the current scene, true when the scene handled it. */
  escape(): boolean {
    return this.current?.scene.onEscape?.() ?? false;
  }

  clear(): void {
    if (!this.current) return;
    const { scene } = this.current;
    this.current = null;
    this.host.removeChild(scene.view);
    scene.destroy();
  }
}
