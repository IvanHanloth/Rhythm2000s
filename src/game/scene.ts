// Scene interface: each themed minigame (Windows XP desktop, Mac desktop…) is a scene (ADR 0002).

import type { Container } from 'pixi.js';
import type { AudioClock } from '@/audio/audio-clock.ts';
import type { Chart } from '@/rhythm/chart.ts';
import type { SceneId } from '@/scenes/catalog.ts';

export interface FrameInfo {
  /** Audio time the speakers are playing right now (s, AudioContext timeline). Draw only from this; never accumulate frame deltas. */
  audioTime: number;
}

/** One action input (Space or a click). */
export interface TapInfo {
  /** Audio time the speakers were playing at the input (s), before calibration is subtracted. */
  audioTime: number;
}

/** Shared resources a scene gets when created. */
export interface SceneContext {
  clock: AudioClock;
  /** Player calibration (s); positive means the player presses late. Subtracted from input times when judging */
  calibration(): number;
  /**
   * 律动组件（doc/beat-guide.md）现在开着没有；玩家随时可以按 H 切换，场景每帧读。
   * 没有时（单元测试、原型页面）当作关闭。
   */
  beatGuide?(): boolean;
  /** Every loaded, validated chart; scenes pick theirs by chart.scene */
  charts: readonly Chart[];
  /** Leave the scene and go back to the street hub ("Back" in the level select) */
  leave(): void;
  /** The chart to play (when #scene/chart opens a level directly); without it the scene shows its level list first */
  chartId?: string;
  /**
   * Called before a level starts: the shell shows the level intro (title, tempo, widgets, best score, how to play).
   * The player's first Space or click dismisses it; that press still reaches the scene, which then starts.
   * When absent (unit tests, prototype pages) the scene starts straight away.
   */
  introduce?(chartId: string): void;
}

export interface Scene {
  /** Everything the scene draws, in 1280×720 logical coordinates */
  readonly view: Container;
  update(frame: FrameInfo): void;
  /** Player input; scenes without input can leave it out */
  onTap?(tap: TapInfo): void;
  /**
   * The player pressed Esc. Return true if the scene handled it (e.g. going from a level back to the level list);
   * otherwise the entry point goes back to the street hub.
   */
  onEscape?(): boolean;
  /** Called when leaving the scene; frees views and other resources */
  destroy(): void;
}

export interface SceneEntry {
  /** Scene id, matching the scene catalog (scenes/catalog.ts) */
  id: SceneId;
  /** Display name, e.g. "Windows XP" */
  label: string;
  /** Loads scene assets (images, fonts, sounds); awaited at start-up so create() can use them synchronously */
  preload?(audio: BaseAudioContext): Promise<void>;
  /** Mouse cursor over the game while this scene is shown (CSS cursor value); browser default when omitted */
  cursor?: string;
  create(context: SceneContext): Scene;
}
