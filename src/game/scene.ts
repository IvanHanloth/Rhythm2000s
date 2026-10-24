// Scene interface: each themed minigame (Windows XP desktop, Mac desktop…) is a scene (ADR 0002).

import type { Container } from 'pixi.js';
import type { AudioClock } from '@/audio/audio-clock.ts';
import type { SceneId } from '@/scenes/catalog.ts';
import type { ChartLibrary } from './chart-library.ts';
import type { ChartFiles } from './chart-transfer.ts';
import type { PlayerSettings } from './settings.ts';

export interface FrameInfo {
  /** Audio time the speakers are playing right now (s, AudioContext timeline). Draw only from this; never accumulate frame deltas. */
  audioTime: number;
}

/** One action input (Space or a click). */
export interface TapInfo {
  /** Audio time the speakers were playing at the input (s), before calibration is subtracted. */
  audioTime: number;
}

/** What a scene computer runs: the level list and its levels, or HackerEditor (doc/chart-editor.md) */
export type SceneMode = 'levels' | 'editor';

/** Shared resources a scene gets when created. */
export interface SceneContext {
  clock: AudioClock;
  /** Player calibration (s); positive means the player presses late. Subtracted from input times when judging */
  calibration(): number;
  /**
   * Player settings (doc/settings.md): the beat guide and "Skip tutorial" are read when needed, and the settings
   * window changes them. Calibration is read through calibration() above.
   */
  settings: PlayerSettings;
  /**
   * Every validated chart, built-in and imported; scenes pick theirs by chart.scene. The level list imports,
   * exports and deletes through it (doc/chart-import-export.md)
   */
  library: ChartLibrary;
  /** The browser's file picker and downloads, for importing and exporting charts */
  chartFiles: ChartFiles;
  /** Leave the scene and go back to the street hub ("Back" in the level select) */
  leave(): void;
  /** The chart to play (when #scene/chart opens a level directly); without it the scene shows its level list first */
  chartId?: string;
  /** The level list and levels, or the chart editor (doc/chart-editor.md) */
  mode: SceneMode;
  /**
   * Called before a level starts: the shell shows the level intro (title, tempo, widgets, best score, how to play).
   * The player's first Space or click dismisses it; that press still reaches the scene, which then starts.
   * When absent (unit tests) the scene starts straight away.
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
