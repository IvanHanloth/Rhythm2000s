// The download window (progress-download) and volume control (volume-mute) in a round
// (doc/scenes/windows-xp-levels.md "Waits and holds"). Both play out in the call and again in the response:
// the download window opens and fills over 3 beats each time; the computer drags the volume from its
// setting to 0 in the call and the player drags it back in the response. So every event has two widgets.
// The volume control is only visual and never changes the game's volume.
// Everything is computed from the beat; coordinates are virtual XP screen coordinates.

import { Container } from 'pixi.js';
import { actionTapOffsets } from '@/rhythm/actions.ts';
import { BEATS } from '@/theme/tokens.ts';
import { clamp01, easeOutBack, easeOutCubic } from '@/ui/easing.ts';
import { XpDownloadDialog } from './components/download-dialog.ts';
import { WORK_AREA_HEIGHT, XP_SCREEN_WIDTH } from './components/screen.ts';
import type { XpTaskbar } from './components/taskbar.ts';
import { XpVolumeControl } from './components/volume-control.ts';
import type { XpSession, XpTarget } from './session.ts';
import type { Turn } from '@/scenes/shared/cursor-path.ts';

type Point = { x: number; y: number };

/** Download window centre: below the middle of the screen, over the message boxes */
const DOWNLOAD_CENTER: Point = { x: XP_SCREEN_WIDTH / 2, y: 300 };
/** Downloaded files, rotating by phrase */
const DOWNLOADS = [
  { fileName: 'setup.exe', sizeKb: 1240 },
  { fileName: 'song.mp3', sizeKb: 3712 },
  { fileName: 'photos.zip', sizeKb: 2048 },
  { fileName: 'homework.doc', sizeKb: 96 },
  { fileName: 'game_demo.exe', sizeKb: 5120 },
];
const DOWNLOAD_HOST = 'www.example-files.com';

/** Original volume (0–1): dragged from here to 0 in the call, back here by the player */
const ORIGINAL_VOLUME = 0.7;
/** Shake after a Miss before closing: duration (beats) and amplitude (px) */
const SHAKE_BEATS = 0.25;
const SHAKE_PIXELS = 4;
/** Title bar flashing after a Miss, as for message boxes: step and duration (beats) */
const FLASH_STEP_BEATS = 0.125;
const FLASH_BEATS = 0.75;
const FADE_BEATS = 0.25;

/** Timing of one run (call or response), in song beats */
interface Run {
  /** Event beat: the download window is in place / the volume slider is pressed */
  start: number;
  /** When Open was clicked or the slider released; null until then */
  done: number | null;
  /** When it missed; null without a Miss */
  missed: number | null;
  /** Volume: whether the slider is held right now */
  held: boolean;
}

interface DownloadTarget {
  kind: 'download';
  event: number;
  call: XpDownloadDialog;
  response: XpDownloadDialog;
}
interface VolumeTarget {
  kind: 'volume';
  event: number;
  call: XpVolumeControl;
  response: XpVolumeControl;
  /** Top left of the pop-up */
  origin: Point;
}
type Target = DownloadTarget | VolumeTarget;

export interface WaitHoldViewOptions {
  session: XpSession;
  taskbar: XpTaskbar;
}

export class WaitHoldView {
  /** Both windows sit above the taskbar and below the virtual mouse */
  readonly layer = new Container({ label: 'wait-hold' });
  private readonly session: XpSession;
  private readonly taskbar: XpTaskbar;
  private readonly targets = new Map<number, Target>();

  constructor({ session, taskbar }: WaitHoldViewOptions) {
    this.session = session;
    this.taskbar = taskbar;
    session.targets.forEach((state, event) => {
      const { action, phrase } = state.call;
      if (action === 'progress-download') {
        const make = () => {
          const spec = DOWNLOADS[phrase % DOWNLOADS.length]!;
          const dialog = new XpDownloadDialog({ ...spec, host: DOWNLOAD_HOST });
          dialog.view.position.set(DOWNLOAD_CENTER.x, DOWNLOAD_CENTER.y);
          dialog.view.visible = false;
          this.layer.addChild(dialog.view);
          return dialog;
        };
        this.targets.set(event, { kind: 'download', event, call: make(), response: make() });
      } else if (action === 'volume-mute') {
        const origin = this.volumeOrigin();
        const make = () => {
          const control = new XpVolumeControl({
            volume: ORIGINAL_VOLUME,
            muted: false,
          });
          // Unfolds upwards from its bottom edge: origin at the bottom left
          control.view.pivot.set(0, control.height);
          control.view.position.set(origin.x, origin.y + control.height);
          control.view.eventMode = 'none';
          control.view.visible = false;
          this.layer.addChild(control.view);
          return control;
        };
        this.targets.set(event, {
          kind: 'volume',
          event,
          call: make(),
          response: make(),
          origin,
        });
      }
    });
  }

  /** Where the virtual mouse presses for each step; null for events drawn elsewhere */
  clickPoints(event: number, turn: Turn): Point[] | null {
    const target = this.targets.get(event);
    if (!target) return null;
    if (target.kind === 'download') {
      const open = target.response.openCenter();
      return [{ x: DOWNLOAD_CENTER.x + open.x, y: DOWNLOAD_CENTER.y + open.y }];
    }
    const thumb = (volume: number) => {
      const p = target.response.thumbCenter(volume);
      return { x: target.origin.x + p.x, y: target.origin.y + p.y };
    };
    // Call: press at the setting, release at 0; response: press at 0, release back at the setting
    return turn === 'call'
      ? [thumb(ORIGINAL_VOLUME), thumb(0)]
      : [thumb(0), thumb(ORIGINAL_VOLUME)];
  }

  /** Where the judgement label goes: the middle of the widget's top edge */
  judgementAnchor(event: number): Point | null {
    const target = this.targets.get(event);
    if (!target) return null;
    if (target.kind === 'download') {
      return { x: DOWNLOAD_CENTER.x, y: DOWNLOAD_CENTER.y - target.response.height / 2 };
    }
    return { x: target.origin.x + target.response.width / 2, y: target.origin.y };
  }

  /** pointer: the virtual mouse position; a held slider follows it */
  update(beat: number, pointer: Point): void {
    let muted = false;
    for (const target of this.targets.values()) {
      const state = this.session.targets[target.event]!;
      const call = this.callRun(state, beat);
      const response = this.responseRun(state);
      if (target.kind === 'download') {
        this.renderDownload(target.call, call, beat);
        this.renderDownload(target.response, response, beat);
      } else {
        this.renderVolume(target, target.call, call, 'call', beat, pointer);
        this.renderVolume(target, target.response, response, 'response', beat, pointer);
        if (this.volumeMuted(state, response, beat)) muted = true;
      }
    }
    this.taskbar.setMuted(muted);
  }

  destroy(): void {
    this.taskbar.setMuted(false);
    this.layer.destroy({ children: true });
  }

  // ---------- Run timing ----------

  /** Call: the computer does it all, so the last press is the completion time */
  private callRun(state: XpTarget, beat: number): Run {
    const start = state.call.beat;
    const end = start + actionTapOffsets(state.call.action).at(-1)!;
    return { start, done: end, missed: null, held: beat >= start && beat < end };
  }

  /** Response: follows the player's judgements */
  private responseRun(state: XpTarget): Run {
    const toBeat = (time: number | null) => (time === null ? null : this.session.beatAt(time));
    return {
      start: state.response.beat,
      done: toBeat(state.handledAt),
      missed: toBeat(state.missedAt),
      // Only the press is judged: once it hits, the slider follows the mouse until the automatic release
      held: state.clicks[0]?.hitAt != null,
    };
  }

  // ---------- Download window ----------

  private renderDownload(dialog: XpDownloadDialog, run: Run, beat: number): void {
    const view = dialog.view;
    const appear = run.start - BEATS.windowOpen;
    let visible = beat >= appear;
    let scale = 1;
    let alpha = 1;
    let active = true;
    let pressed = false;

    if (visible && run.done !== null && beat >= run.done) {
      // Open clicked: shrink and fade
      pressed = true;
      const p = (beat - run.done) / BEATS.windowClose;
      visible = p < 1;
      scale = 1 - 0.2 * clamp01(p);
      alpha = 1 - clamp01(p);
    } else if (visible && run.missed !== null && beat >= run.missed) {
      const since = beat - run.missed;
      if (since < FLASH_BEATS) active = Math.floor(since / FLASH_STEP_BEATS) % 2 === 0;
      alpha = 1 - clamp01((since - FLASH_BEATS) / FADE_BEATS);
      visible = alpha > 0;
    } else if (visible) {
      scale = easeOutBack((beat - appear) / BEATS.windowOpen);
    }

    view.visible = visible;
    if (!visible) return;
    // The bar fills over 3 beats (progress-download is judged 3 beats after the event)
    const wait = actionTapOffsets('progress-download')[0]!;
    dialog.setProgress((beat - run.start) / wait);
    dialog.setOpenPressed(pressed);
    dialog.setActive(active);
    view.scale.set(Math.max(0.01, scale));
    view.alpha = alpha;
  }

  // ---------- Volume control ----------

  /**
   * Draws one volume pop-up. The computer drags the slider from the setting to 0 in the call, the player drags it
   * back in the response; while held it follows the mouse, kept between 0 and the setting.
   */
  private renderVolume(
    target: VolumeTarget,
    control: XpVolumeControl,
    run: Run,
    turn: Turn,
    beat: number,
    pointer: Point,
  ): void {
    const view = control.view;
    const appear = run.start - BEATS.windowOpen;
    if (beat < appear) {
      view.visible = false;
      return;
    }
    const from = turn === 'call' ? ORIGINAL_VOLUME : 0;
    const to = turn === 'call' ? 0 : ORIGINAL_VOLUME;
    const done = run.done !== null && beat >= run.done;
    let open = easeOutCubic(clamp01((beat - appear) / BEATS.windowOpen));
    let shake = 0;
    let volume = from;
    let dragging = false;

    if (done) {
      // Released: the slider stays at its end point and the pop-up closes
      volume = to;
      open = 1 - clamp01((beat - run.done!) / BEATS.windowClose);
    } else if (run.missed !== null && beat >= run.missed) {
      // Miss (response only): the slider drops back to the bottom, shakes, then closes
      const since = beat - run.missed;
      if (since < SHAKE_BEATS) {
        shake = Math.sin(since * Math.PI * 16) * SHAKE_PIXELS * (1 - since / SHAKE_BEATS);
      }
      open = 1 - clamp01((since - SHAKE_BEATS) / FADE_BEATS);
    } else if (run.held) {
      dragging = true;
      volume = Math.min(ORIGINAL_VOLUME, control.volumeAtY(pointer.y - target.origin.y));
    }

    view.visible = open > 0;
    if (!view.visible) return;
    view.position.set(target.origin.x + shake, target.origin.y + control.height);
    view.scale.set(1, Math.max(0.01, open));
    control.setVolume(volume, dragging);
    // "Mute" is ticked on the call's release and cleared on the response's
    control.setMuted(turn === 'call' ? done : !done);
  }

  /** The tray speaker shows muted from the call's release until the response's release, or the pop-up closing after a Miss */
  private volumeMuted(state: XpTarget, response: Run, beat: number): boolean {
    const mutedFrom = state.call.beat + actionTapOffsets(state.call.action).at(-1)!;
    const mutedUntil =
      response.done ??
      (response.missed !== null ? response.missed + SHAKE_BEATS + FADE_BEATS : Infinity);
    return beat >= mutedFrom && beat < mutedUntil;
  }

  /** Top left of the volume pop-up: right above the tray speaker, kept inside the screen */
  private volumeOrigin(): Point {
    const speaker = this.taskbar.volumeIcon;
    const trayX = speaker.parent?.x ?? 0;
    const probe = new XpVolumeControl({ volume: 0, muted: false });
    const { width, height } = probe;
    probe.destroy();
    const centerX = trayX + speaker.x + 8;
    const x = Math.min(XP_SCREEN_WIDTH - width - 2, Math.round(centerX - width / 2));
    return { x, y: WORK_AREA_HEIGHT - height - 2 };
  }
}
