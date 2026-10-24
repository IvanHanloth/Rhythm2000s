// The virtual mouse in a round (doc/scenes/mac-2000.md "Virtual mouse"). The path is the shared PointerTrack;
// this adds the Aqua arrow, the demonstrated clicks of menu-apple and sheet-save, and dragging the
// menu-volume slider. Coordinates are virtual Mac screen coordinates.

import { Container } from 'pixi.js';
import { demoBeat, PointerTrack, type Point } from '@/scenes/shared/cursor-path.ts';
import { drawArrowCursor } from './components/icons.ts';
import type { MacSession, MacTarget } from './session.ts';

/** Where the pointer rests before and after a round */
const HOME: Point = { x: 700, y: 400 };
/** Where it returns after the call: the middle between the menu bar and the Dock */
const CENTER: Point = { x: 512, y: 270 };
/** How long a press shrinks the pointer (beats) */
const PRESS_BEATS = 1 / 8;

/** Where each press of a target lands, supplied by the view */
export type MacClickPoints = (target: MacTarget, event: number) => Point[];
/** Slider drag progress (0–1) for an event, null when not dragging; supplied by the view so pointer and slider move together */
export type MacDragProgress = (event: number, beat: number) => number | null;

export class MacVirtualMouse {
  readonly view = new Container({ label: 'virtual-mouse' });
  private readonly pointer = drawArrowCursor();
  private readonly session: MacSession;
  private readonly points: Point[][];
  private readonly drag: MacDragProgress;
  private readonly track: PointerTrack;
  /** Beats where the mouse really clicks while demonstrating (menus and sheets) */
  private readonly demoClicks: number[] = [];

  constructor(session: MacSession, clickPoints: MacClickPoints, drag: MacDragProgress) {
    this.session = session;
    this.drag = drag;
    this.view.addChild(this.pointer);
    this.points = session.targets.map((target, event) => clickPoints(target, event));
    this.track = new PointerTrack(session, (event) => this.points[event]!, {
      home: HOME,
      center: CENTER,
    });
    for (const target of session.targets) {
      if (target.kind !== 'menu' && target.kind !== 'sheet') continue;
      target.clicks.forEach((_, step) => this.demoClicks.push(demoBeat(target, step)));
    }
  }

  update(beat: number): void {
    const position = this.track.positionAt(beat);
    const clicks = [...this.demoClicks, ...this.track.hitBeats()];
    let pressed = clicks.some((b) => beat >= b && beat < b + PRESS_BEATS);
    // While holding the slider the pointer drags it along and stays pressed
    this.session.targets.forEach((target, event) => {
      if (target.kind !== 'volume') return;
      const progress = this.drag(event, beat);
      const [from, to] = this.points[event]!;
      if (progress === null || !from || !to) return;
      position.x = from.x + (to.x - from.x) * progress;
      position.y = from.y + (to.y - from.y) * progress;
      pressed = true;
    });
    this.pointer.position.set(position.x, position.y);
    this.pointer.scale.set(pressed ? 0.85 : 1);
  }

  destroy(): void {
    this.view.destroy({ children: true });
  }
}
