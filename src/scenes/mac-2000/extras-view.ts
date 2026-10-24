// The later Mac actions in a round (doc/scenes/mac-2000.md "Gameplay"): the window with a save sheet
// (sheet-save), the iChat message (ichat-message) and the menu bar volume (menu-volume). Driven by MacTargetsView.
// Everything is computed from the beat; coordinates are virtual Mac screen coordinates.

import { Container } from 'pixi.js';
import { BEATS } from '@/theme/tokens.ts';
import { clamp01, easeOutBack, easeOutCubic } from '@/ui/easing.ts';
import { appIcon } from './assets.ts';
import { CHAT_HEIGHT, ChatWindow } from './components/chat-window.ts';
import type { Dock } from './components/dock.ts';
import type { MenuBar } from './components/menu-bar.ts';
import { aquaText } from './components/paint.ts';
import { AquaSheet } from './components/sheet.ts';
import { VolumeMenu } from './components/volume-menu.ts';
import { AquaWindow, TITLE_BAR_HEIGHT } from './components/window.ts';
import type { MacSession, MacTarget } from './session.ts';

type Point = { x: number; y: number };

/** Windows with a sheet are larger than document windows, to fit the sheet */
const SHEET_WINDOW_WIDTH = 320;
const SHEET_WINDOW_HEIGHT = 200;
const SHEET_WIDTH = 300;
/** Highest a window's top may go: just below the turn banner, so the title bar stays visible */
const WINDOW_TOP_MIN = 64;
/** How long before the event beat the window appears (beats) */
const SHEET_WINDOW_LEAD = 1;
/** How long the sheet takes to slide out (beats) */
const SHEET_SLIDE_BEATS = 0.25;
const DONT_SAVE = "Don't Save";

/** iChat's place in the Dock (DOCK_ITEMS in scene.ts) */
const ICHAT_DOCK_INDEX = 2;
const CHAT_GAP = 6;

/** Volume menu: how long before the beat it drops and the slider falls, and how long after release it closes (beats) */
const VOLUME_LEAD = 0.25;
const VOLUME_CLOSE_BEATS = 1 / 16;

/** Shake and fade-out after a Miss (beats) */
const SHAKE_BEATS = 0.25;
const FADE_BEATS = 0.25;
const CLOSE_BEATS = 0.25;

/** Unsaved documents: title and text */
const DOCUMENTS = [
  { title: 'Untitled', text: 'Dear diary,\nToday I finally got broadband.' },
  { title: 'Essay.rtf', text: 'Chapter 1\nIt was a dark and stormy night…' },
  { title: 'Notes.txt', text: 'Buy blank CDs\nReturn videos\nCall Sam' },
  { title: 'Letter.rtf', text: 'Hi Mum,\nThe new iMac is great!' },
];

/** iChat messages: sender and line */
const CHATS = [
  { buddy: 'Sam', text: 'u there?' },
  { buddy: 'Alex', text: 'did you get my email?' },
  { buddy: 'Jo', text: 'brb' },
  { buddy: 'Sam', text: 'check out this mp3' },
  { buddy: 'Alex', text: 'lol' },
];

interface SheetTarget {
  target: MacTarget;
  index: number;
  window: AquaWindow;
  sheet: AquaSheet;
  slot: Point;
}

interface ChatTarget {
  target: MacTarget;
  index: number;
  chat: ChatWindow;
  /** Window centre */
  center: Point;
}

export interface ExtrasViewOptions {
  windowLayer: Container;
  menuLayer: Container;
  dock: Dock;
  menuBar: MenuBar;
  /** The 6 slots (window centres) shared by alerts and windows */
  slots: readonly Point[];
}

export class MacExtrasView {
  private readonly session: MacSession;
  private readonly options: ExtrasViewOptions;
  private readonly sheets: SheetTarget[] = [];
  private readonly chats: ChatTarget[] = [];
  private readonly volumes: { target: MacTarget; index: number }[] = [];
  private readonly volumeMenu = new VolumeMenu();
  private readonly volumeOrigin: Point;

  constructor(session: MacSession, options: ExtrasViewOptions) {
    this.session = session;
    this.options = options;
    const { dock, menuBar, slots } = options;
    const icon = add(dock.view.position, dock.iconCenter(ICHAT_DOCK_INDEX));

    session.targets.forEach((target, index) => {
      const variant = target.call.phrase * 3 + target.order;
      if (target.kind === 'sheet') {
        const doc = DOCUMENTS[variant % DOCUMENTS.length]!;
        const window = new AquaWindow({
          title: doc.title,
          width: SHEET_WINDOW_WIDTH,
          height: SHEET_WINDOW_HEIGHT,
          content: 'white',
          toolbarButton: false,
        });
        const text = aquaText(doc.text, { size: 12, lineHeight: 16 });
        text.position.set(8, 6);
        window.content.addChild(text);
        const sheet = new AquaSheet({
          icon: appIcon('TextEdit', 48),
          message: 'Do you want to save changes to this document before closing?',
          informative: "If you don't save, your changes will be lost.",
          leftButton: DONT_SAVE,
          buttons: ['Cancel', 'Save'],
          width: SHEET_WIDTH,
        });
        sheet.view.position.set(SHEET_WINDOW_WIDTH / 2, TITLE_BAR_HEIGHT);
        window.view.addChild(sheet.view);
        window.view.visible = false;
        options.windowLayer.addChild(window.view);
        const shared = slots[target.order % slots.length]!;
        const slot = {
          x: shared.x,
          y: Math.max(shared.y, WINDOW_TOP_MIN + SHEET_WINDOW_HEIGHT / 2),
        };
        this.sheets.push({ target, index, window, sheet, slot });
      } else if (target.kind === 'chat') {
        const chat = new ChatWindow(CHATS[variant % CHATS.length]!);
        chat.view.visible = false;
        options.windowLayer.addChild(chat.view);
        const bottom = dock.view.y - CHAT_GAP;
        const center = {
          x: icon.x,
          y: bottom - CHAT_HEIGHT / 2 - target.order * (CHAT_HEIGHT + CHAT_GAP),
        };
        this.chats.push({ target, index, chat, center });
      } else if (target.kind === 'volume') {
        this.volumes.push({ target, index });
      }
    });

    this.volumeOrigin = add(menuBar.view.position, menuBar.volumeMenuOrigin);
    this.volumeMenu.view.position.set(this.volumeOrigin.x, this.volumeOrigin.y);
    this.volumeMenu.view.visible = false;
    options.menuLayer.addChild(this.volumeMenu.view);
  }

  /** Whether this view draws the target */
  handles(target: MacTarget): boolean {
    return target.kind === 'sheet' || target.kind === 'chat' || target.kind === 'volume';
  }

  /** Where the virtual mouse presses for each step */
  clickPoints(index: number): Point[] {
    const sheet = this.sheets.find((s) => s.index === index);
    if (sheet) {
      const { window, sheet: panel, slot } = sheet;
      const sheetTop = { x: slot.x, y: slot.y - SHEET_WINDOW_HEIGHT / 2 + TITLE_BAR_HEIGHT };
      return [add(slot, window.closeCenter), add(sheetTop, panel.buttonCenter(DONT_SAVE))];
    }
    const chat = this.chats.find((c) => c.index === index);
    if (chat) return [add(chat.center, chat.chat.bubbleCenter)];
    return [
      add(this.volumeOrigin, this.volumeMenu.knobCenter(0)),
      add(this.volumeOrigin, this.volumeMenu.knobCenter(1)),
    ];
  }

  /** Where the judgement label goes (above the target) */
  judgementAnchor(target: MacTarget): Point {
    const sheet = this.sheets.find((s) => s.target === target);
    if (sheet) return { x: sheet.slot.x, y: sheet.slot.y - SHEET_WINDOW_HEIGHT / 2 };
    const chat = this.chats.find((c) => c.target === target);
    if (chat) return { x: chat.center.x, y: chat.center.y - CHAT_HEIGHT / 2 };
    return { x: this.volumeOrigin.x - 50, y: this.volumeOrigin.y + 70 };
  }

  /** focus: the next target (index into targets), whose window shows as active */
  update(beat: number, audioTime: number, focus: number): void {
    for (const sheet of this.sheets) this.renderSheet(sheet, beat, audioTime, focus);
    for (const chat of this.chats) this.renderChat(chat, beat, focus);
    this.renderVolume(beat);
  }

  destroy(): void {
    for (const { window } of this.sheets) window.destroy();
    for (const { chat } of this.chats) chat.destroy();
    this.volumeMenu.destroy();
    this.options.menuBar.setVolumeExtra({ muted: false, open: false });
  }

  /**
   * Volume slider position (0 at the bottom, 1 at the top): in call and response it is dragged to the top over 1 beat
   * from the press, then released. The virtual mouse follows it while held, hence shared here. Null when not dragging.
   */
  dragProgress(target: MacTarget, beat: number): number | null {
    const [press, release] = target.clicks;
    if (!press || !release) return null;
    const holdBeats = release.beat - press.beat;
    const callPress = target.call.beat;
    if (beat >= callPress && beat < callPress + holdBeats) return (beat - callPress) / holdBeats;
    if (press.hitAt === null) return null;
    const pressBeat = this.session.beatAt(press.hitAt);
    if (beat < pressBeat || beat >= pressBeat + holdBeats) return null;
    return (beat - pressBeat) / holdBeats;
  }

  // ---------- Actions ----------

  /**
   * Window with a save sheet, opening once in the call and once in the response (same slot):
   * the first press clicks close and the sheet slides out; the second clicks "Don't Save" and the window closes.
   */
  private renderSheet(
    { target, index, window, sheet, slot }: SheetTarget,
    beat: number,
    audioTime: number,
    focus: number,
  ): void {
    const { session } = this;
    const [first, second] = target.clicks;
    if (!first || !second) return;
    const gap = second.beat - first.beat;
    const phraseEnd = session.chart.phrases[target.call.phrase]!.end;
    const responseStart = target.response.beat - SHEET_WINDOW_LEAD;

    let appear: number;
    let reveal: number | null = null;
    let closedAt: number | null = null;
    let missedAt: number | null = null;
    if (beat < responseStart) {
      // Call
      appear = target.call.beat - SHEET_WINDOW_LEAD;
      reveal = target.call.beat;
      closedAt = target.call.beat + gap;
    } else {
      appear = responseStart;
      if (first.hitAt !== null) reveal = session.beatAt(first.hitAt);
      if (second.hitAt !== null) closedAt = session.beatAt(second.hitAt);
      if (target.missedAt !== null) missedAt = session.beatAt(target.missedAt);
    }

    const view = window.view;
    let visible = beat >= appear;
    let x = slot.x;
    let scale = 1;
    let alpha = 1;
    if (visible && closedAt !== null && beat >= closedAt) {
      // "Don't Save" clicked: the sheet retracts and the window shrinks and fades
      const p = (beat - closedAt) / CLOSE_BEATS;
      visible = p < 1;
      scale = 1 - 0.2 * clamp01(p);
      alpha = 1 - clamp01(p);
    } else if (visible && missedAt !== null && beat >= missedAt) {
      const since = beat - missedAt;
      if (since < SHAKE_BEATS) x += Math.sin(since * Math.PI * 16) * 7 * (1 - since / SHAKE_BEATS);
      alpha = 1 - clamp01((beat - phraseEnd) / FADE_BEATS);
      visible = alpha > 0;
    } else if (visible) {
      scale = easeOutBack((beat - appear) / BEATS.windowOpen);
    }
    view.visible = visible;
    if (!visible) return;
    view.position.set(x, slot.y);
    view.scale.set(Math.max(0.01, scale));
    view.alpha = alpha;
    window.setActive(index === focus);
    sheet.setActive(index === focus);
    const sheetOpen = reveal === null ? 0 : (beat - reveal) / SHEET_SLIDE_BEATS;
    sheet.setReveal(closedAt !== null && beat >= closedAt ? 0 : sheetOpen);
    sheet.setPressed(closedAt !== null && beat >= closedAt ? DONT_SAVE : null);
    sheet.update(audioTime);
  }

  /** iChat message: pops out of the iChat icon and shrinks back into it once clicked */
  private renderChat(
    { target, index, chat, center }: ChatTarget,
    beat: number,
    focus: number,
  ): void {
    const { session } = this;
    const { dock } = this.options;
    const icon = add(dock.view.position, dock.iconCenter(ICHAT_DOCK_INDEX));
    const appear = target.call.beat - BEATS.windowOpen;
    const view = chat.view;
    let visible = beat >= appear;
    let progress = 1;
    let alpha = 1;
    let x = center.x;
    if (visible && target.handledAt !== null && beat >= session.beatAt(target.handledAt)) {
      const p = (beat - session.beatAt(target.handledAt)) / CLOSE_BEATS;
      visible = p < 1;
      progress = 1 - easeOutCubic(clamp01(p));
    } else if (visible && target.missedAt !== null) {
      const since = beat - session.beatAt(target.missedAt);
      if (since < SHAKE_BEATS) x += Math.sin(since * Math.PI * 16) * 7 * (1 - since / SHAKE_BEATS);
      const phraseEnd = session.chart.phrases[target.call.phrase]!.end;
      alpha = 1 - clamp01((beat - phraseEnd) / FADE_BEATS);
      visible = alpha > 0;
    } else if (visible) {
      progress = easeOutBack((beat - appear) / BEATS.windowOpen);
    }
    view.visible = visible;
    if (!visible) return;
    view.position.set(icon.x + (x - icon.x) * progress, icon.y + (center.y - icon.y) * progress);
    view.scale.set(Math.max(0.05, progress));
    view.alpha = alpha;
    chat.setActive(index === focus);
  }

  /**
   * Volume menu, at most one at a time. Before the beat it drops, the slider falls and the speaker mutes; a hit press drags
   * the slider up over 1 beat, then it releases, closes and unmutes; a missed press leaves it at the bottom, shakes and closes.
   */
  private renderVolume(beat: number): void {
    const { session } = this;
    let shown: { level: number; shake: number; muted: boolean } | null = null;

    for (const { target } of this.volumes) {
      const [press, release] = target.clicks;
      if (!press || !release) continue;
      const holdBeats = release.beat - press.beat;
      const drag = this.dragProgress(target, beat);

      // Call
      const callOpen = target.call.beat - VOLUME_LEAD;
      const callRelease = target.call.beat + holdBeats;
      if (beat >= callOpen && beat < callRelease + VOLUME_CLOSE_BEATS) {
        const level =
          drag ?? (beat < target.call.beat ? 1 - clamp01((beat - callOpen) / VOLUME_LEAD) : 1);
        shown = { level, shake: 0, muted: beat < callRelease };
        continue;
      }

      // Response
      const open = target.response.beat - VOLUME_LEAD;
      if (beat < open) continue;
      if (drag !== null) {
        shown = { level: drag, shake: 0, muted: true };
        continue;
      }
      const released = release.hitAt === null ? null : session.beatAt(release.hitAt);
      if (released !== null && beat >= released) {
        if (beat < released + VOLUME_CLOSE_BEATS) shown = { level: 1, shake: 0, muted: false };
        continue;
      }
      const missed = target.missedAt === null ? null : session.beatAt(target.missedAt);
      if (missed !== null && beat >= missed) {
        const since = beat - missed;
        if (since < SHAKE_BEATS) {
          const shake = Math.sin(since * Math.PI * 16) * 4 * (1 - since / SHAKE_BEATS);
          shown = { level: 0, shake, muted: true };
        }
        continue;
      }
      const level = beat < target.response.beat ? 1 - clamp01((beat - open) / VOLUME_LEAD) : 0;
      shown = { level, shake: 0, muted: true };
    }

    const current = shown as { level: number; shake: number; muted: boolean } | null;
    this.volumeMenu.view.visible = current !== null;
    if (current) {
      this.volumeMenu.setLevel(current.level);
      this.volumeMenu.view.x = this.volumeOrigin.x + current.shake;
    }
    this.options.menuBar.setVolumeExtra({
      muted: current?.muted ?? false,
      open: current !== null,
    });
  }
}

function add(a: Point, b: Point): Point {
  return { x: a.x + b.x, y: a.y + b.y };
}
