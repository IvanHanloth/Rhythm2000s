// The virtual mouse and desktop context menu in a round (doc/scenes/windows-xp.md "Virtual mouse",
// "Desktop context menu and Refresh"). The path itself is the shared PointerTrack; this adds the XP pointer,
// the right-click menu of desktop-refresh, and the pressed look while volume-mute holds the slider.
// Coordinates are virtual XP screen coordinates.

import { Container, Sprite } from 'pixi.js';
import { xpAssets } from './assets.ts';
import { DESKTOP_MENU, XpContextMenu } from './components/context-menu.ts';
import type { XpDesktop } from './components/desktop.ts';
import { WORK_AREA_HEIGHT, XP_SCREEN_WIDTH } from './components/screen.ts';
import { demoBeat, PointerTrack, type Point, type Turn } from '@/scenes/shared/cursor-path.ts';
import type { XpSession, XpTarget } from './session.ts';

/** Where the pointer rests before and after a round */
const HOME: Point = { x: 700, y: 420 };
/** Where it returns after the call: the centre of the desktop work area */
const CENTER: Point = { x: XP_SCREEN_WIDTH / 2, y: WORK_AREA_HEIGHT / 2 };
/** desktop-refresh right-click spots: empty desktop, rotating by index in the phrase */
const REFRESH_SPOTS: readonly Point[] = [
  { x: 400, y: 200 },
  { x: 640, y: 180 },
  { x: 300, y: 250 },
  { x: 700, y: 250 },
];
const REFRESH_ITEM = 'Refresh';
/** How long a press shrinks the pointer, and how long the desktop icons vanish on Refresh (beats) */
const PRESS_BEATS = 1 / 8;
const FLICKER_BEATS = 1 / 8;

/** Where each press of an event lands; volume-mute drags in opposite directions per turn */
export type ClickPoints = (target: XpTarget, event: number, turn: Turn) => Point[];

export class VirtualMouse {
  readonly view = new Container({ label: 'virtual-mouse' });
  private readonly pointer: Sprite;
  private readonly menu = new XpContextMenu(DESKTOP_MENU);
  private readonly session: XpSession;
  private readonly desktop: XpDesktop;
  private readonly points: Record<Turn, Point[][]>;
  private readonly track: PointerTrack;

  constructor(session: XpSession, desktop: XpDesktop, clickPoints: ClickPoints) {
    this.session = session;
    this.desktop = desktop;

    const { texture, hotspot } = xpAssets().pointer;
    this.pointer = new Sprite(texture);
    this.pointer.anchor.set(hotspot.x / texture.width, hotspot.y / texture.height);
    this.menu.view.visible = false;
    this.view.addChild(this.menu.view, this.pointer);

    // desktop-refresh's two presses are computed here; the scene supplies the rest
    const pointsFor = (turn: Turn) =>
      session.targets.map((target, event) =>
        target.call.action === 'desktop-refresh'
          ? this.refreshPoints(target)
          : clickPoints(target, event, turn),
      );
    this.points = { call: pointsFor('call'), response: pointsFor('response') };
    this.track = new PointerTrack(session, (event, turn) => this.points[turn][event]!, {
      home: HOME,
      center: CENTER,
    });
  }

  /** Right-click spot of a desktop-refresh (its judgement shows above it) */
  static refreshSpot(target: XpTarget): Point {
    return REFRESH_SPOTS[target.call.index % REFRESH_SPOTS.length]!;
  }

  /** Current pointer position, valid after update() */
  get position(): Point {
    return { x: this.pointer.x, y: this.pointer.y };
  }

  update(beat: number): void {
    const position = this.track.positionAt(beat);
    this.pointer.position.set(position.x, position.y);
    const pressed =
      this.clickBeats().some((b) => beat >= b && beat < b + PRESS_BEATS) || this.holding(beat);
    this.pointer.scale.set(pressed ? 0.85 : 1);
    this.renderMenu(beat);
  }

  destroy(): void {
    this.desktop.setIconsVisible(true);
    this.menu.destroy();
    this.view.destroy({ children: true });
  }

  /** First press: the right-click spot; second: the centre of "Refresh" in the menu opened there */
  private refreshPoints(target: XpTarget): Point[] {
    const spot = VirtualMouse.refreshSpot(target);
    const item = this.menu.itemCenter(REFRESH_ITEM);
    return [spot, { x: spot.x + item.x, y: spot.y + item.y }];
  }

  /** Beats the mouse clicks: the demonstrated presses that are real clicks, and every hit in the response */
  private clickBeats(): number[] {
    const beats = this.track.hitBeats();
    for (const target of this.session.targets) {
      const action = target.call.action;
      if (action !== 'desktop-refresh' && action !== 'progress-download') continue;
      target.clicks.forEach((_, step) => beats.push(demoBeat(target, step)));
    }
    return beats;
  }

  /** volume-mute holds the slider from press to release: in the call, and from the hit press in the response */
  private holding(beat: number): boolean {
    const session = this.session;
    return session.targets.some((target) => {
      if (target.call.action !== 'volume-mute') return false;
      const [press, release] = target.clicks;
      if (!press || !release) return false;
      const callPress = target.call.beat;
      const callRelease = callPress + (release.beat - press.beat);
      if (beat >= callPress && beat < callRelease) return true;
      if (press.hitAt === null || beat < session.beatAt(press.hitAt)) return false;
      const ended = release.hitAt ?? release.missedAt;
      return ended === null || beat < session.beatAt(ended);
    });
  }

  /** At most one context menu at a time; the desktop icons blink off on Refresh */
  private renderMenu(beat: number): void {
    let shown: { point: Point; hot: boolean } | null = null;
    let flicker = false;
    const session = this.session;

    session.targets.forEach((target, event) => {
      if (target.call.action !== 'desktop-refresh') return;
      const [spot, item] = this.points.call[event]!;
      const [first, second] = target.clicks;
      if (!spot || !item || !first || !second) return;
      const gap = second.beat - first.beat;

      // Call: opens on the beat, closes after "Refresh"
      const callOpen = target.call.beat;
      const callRefresh = callOpen + gap;
      // Response: opens when the first press is judged (a Miss opens it too, so the second can follow),
      // closes when the second is judged
      const opened = first.hitAt ?? first.missedAt;
      const closed = second.hitAt ?? second.missedAt;
      const responseOpen = opened === null ? null : session.beatAt(opened);
      const responseClose = closed === null ? Infinity : session.beatAt(closed);

      const spans: [number, number, number][] = [[callOpen, callRefresh, callRefresh]];
      if (responseOpen !== null) spans.push([responseOpen, responseClose, second.beat]);
      for (const [open, close, press] of spans) {
        if (beat >= open && beat < close) {
          shown = { point: spot, hot: beat >= press - this.track.leadBeats };
        }
      }

      const refreshedAt = [callRefresh];
      if (second.hitAt !== null) refreshedAt.push(session.beatAt(second.hitAt));
      if (refreshedAt.some((b) => beat >= b && beat < b + FLICKER_BEATS)) flicker = true;
    });

    const current = shown as { point: Point; hot: boolean } | null;
    this.menu.view.visible = current !== null;
    if (current) {
      this.menu.view.position.set(current.point.x, current.point.y);
      this.menu.setHot(current.hot ? REFRESH_ITEM : null);
    }
    this.desktop.setIconsVisible(!flicker);
  }
}
