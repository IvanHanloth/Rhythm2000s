// Mac widget gallery: the Mac scene's widgets on a Jaguar desktop, to open one by one and hear their sounds.
// For checking the look against the original, not gameplay (doc/scenes/mac-2000.md "Widget gallery").
//
// - Click the menu bar Apple for the Apple menu; items play Tink
// - Click the speaker for the volume menu; the slider sets this page's volume and plays Pop on release
// - Page buttons open alerts, document windows, sheets and iChat messages, bounce Dock icons, add to Mail's badge, empty or fill the Trash and drop desktop files
// - Alert and sheet buttons and the windows' red close buttons dismiss them

import '@/game/style.css';
import { Container, Graphics, Rectangle, Sprite, type FederatedPointerEvent } from 'pixi.js';
import { AudioClock } from '@/audio/audio-clock.ts';
import { DESIGN_HEIGHT, DESIGN_WIDTH } from '@/game/layout.ts';
import { GameCanvas } from '@/game/game-canvas.ts';
import { appIcon, preloadMacAssets, type AppIconName } from '@/scenes/mac-2000/assets.ts';
import type { MacSoundName } from '@/scenes/mac-2000/action-kinds.ts';
import { AquaAlert } from '@/scenes/mac-2000/components/alert.ts';
import { ChatWindow } from '@/scenes/mac-2000/components/chat-window.ts';
import { createDesktopFile } from '@/scenes/mac-2000/components/desktop-file.ts';
import { Dock, DOCK_HEIGHT, type DockItem } from '@/scenes/mac-2000/components/dock.ts';
import { drawCautionIcon, drawFinderIcon } from '@/scenes/mac-2000/components/icons.ts';
import { APPLE_MENU, AquaMenu } from '@/scenes/mac-2000/components/menu.ts';
import {
  APPLE_MENU_LEFT,
  MENU_BAR_HEIGHT,
  MenuBar,
} from '@/scenes/mac-2000/components/menu-bar.ts';
import { aquaText } from '@/scenes/mac-2000/components/paint.ts';
import { AquaSheet } from '@/scenes/mac-2000/components/sheet.ts';
import { VolumeMenu } from '@/scenes/mac-2000/components/volume-menu.ts';
import { AquaWindow, TITLE_BAR_HEIGHT } from '@/scenes/mac-2000/components/window.ts';
import { AQUA } from '@/theme/aqua.ts';

const host = document.querySelector<HTMLElement>('#game');
if (!host) throw new Error('Container #game not found');

const SCALE = 1.25;
const WIDTH = DESIGN_WIDTH / SCALE;
const HEIGHT = DESIGN_HEIGHT / SCALE;

const clock = new AudioClock();
const audio = clock.context;
const canvas = await GameCanvas.create(host);
const assets = await preloadMacAssets(audio);

const resumeAudio = () => void clock.resume();
window.addEventListener('pointerdown', resumeAudio, { once: true });
window.addEventListener('keydown', resumeAudio, { once: true });

// ---------- Volume (the volume menu slider sets this page's volume) ----------

let volume = 0.8;
const master = audio.createGain();
master.gain.value = volume;
master.connect(audio.destination);

function play(name: MacSoundName): void {
  const source = audio.createBufferSource();
  source.buffer = assets.sounds[name];
  source.connect(master);
  source.start();
}

// ---------- Desktop ----------

const screen = new Container({ label: 'mac-screen' });
screen.scale.set(SCALE);
canvas.stage.addChild(screen);

const wallpaper = new Container({ label: 'wallpaper' });
const sprite = new Sprite(assets.wallpaper);
const cover = Math.max(WIDTH / assets.wallpaper.width, HEIGHT / assets.wallpaper.height);
sprite.scale.set(cover);
sprite.position.set(
  (WIDTH - assets.wallpaper.width * cover) / 2,
  (HEIGHT - assets.wallpaper.height * cover) / 2,
);
wallpaper.addChild(new Graphics().rect(0, 0, WIDTH, HEIGHT).fill(AQUA.desktop), sprite);

const DOCK_ITEMS: DockItem[] = [
  { icon: 'finder', running: true },
  { icon: 'Mail', running: true },
  { icon: 'iChat' },
  { icon: 'Safari' },
  { icon: 'iTunes' },
  { icon: 'iPhoto' },
  { icon: 'iCal' },
  { icon: 'QuickTime Player' },
  { icon: 'Sherlock' },
  { icon: 'System Preferences' },
];
const dock = new Dock(DOCK_ITEMS);
dock.view.position.set(Math.round((WIDTH - dock.width) / 2), HEIGHT - DOCK_HEIGHT);
const menuBar = new MenuBar({
  width: WIDTH,
  appName: 'Finder',
  menus: ['File', 'Edit', 'View', 'Go', 'Window', 'Help'],
});
const fileLayer = new Container({ label: 'files' });
const windowLayer = new Container({ label: 'windows' });
const menuLayer = new Container({ label: 'menus' });
screen.addChild(wallpaper, fileLayer, windowLayer, dock.view, menuBar.view, menuLayer);
canvas.onFrame(() => menuBar.update(new Date()));

// Clicking empty desktop closes the menus
wallpaper.eventMode = 'static';
wallpaper.hitArea = new Rectangle(0, 0, WIDTH, HEIGHT);
wallpaper.on('pointerdown', () => closeMenus());

// ---------- Apple menu ----------

let appleMenu: AquaMenu | null = null;
const appleHit = new Container({ label: 'apple-hit' });
appleHit.eventMode = 'static';
appleHit.cursor = 'pointer';
appleHit.hitArea = new Rectangle(APPLE_MENU_LEFT, 0, 32, MENU_BAR_HEIGHT);
menuBar.view.addChild(appleHit);
appleHit.on('pointerdown', () => {
  if (appleMenu) return closeMenus();
  closeMenus();
  const menu = new AquaMenu({ entries: APPLE_MENU });
  menu.view.position.set(APPLE_MENU_LEFT, MENU_BAR_HEIGHT);
  menu.view.eventMode = 'static';
  menu.view.on('globalpointermove', (event: FederatedPointerEvent) => {
    const local = menu.view.toLocal(event.global);
    menu.setHot(itemAt(menu, local.y));
  });
  menu.view.on('pointertap', (event: FederatedPointerEvent) => {
    if (!itemAt(menu, menu.view.toLocal(event.global).y)) return;
    play('Tink');
    closeMenus();
  });
  menuLayer.addChild(menu.view);
  menuBar.setAppleHighlighted(true);
  appleMenu = menu;
});

/** The enabled menu item at height y, if any */
function itemAt(menu: AquaMenu, y: number): string | null {
  for (const entry of APPLE_MENU) {
    if (entry === 'separator' || entry.submenu) continue;
    const center = menu.itemCenter(entry.label);
    if (Math.abs(center.y - y) < 10) return entry.label;
  }
  return null;
}

// ---------- Volume menu ----------

let volumeMenu: VolumeMenu | null = null;
const speakerHit = new Container({ label: 'speaker-hit' });
speakerHit.eventMode = 'static';
speakerHit.cursor = 'pointer';
const origin = menuBar.volumeMenuOrigin;
speakerHit.hitArea = new Rectangle(origin.x, 0, 30, MENU_BAR_HEIGHT);
menuBar.view.addChild(speakerHit);
speakerHit.on('pointerdown', () => {
  if (volumeMenu) return closeMenus();
  closeMenus();
  const menu = new VolumeMenu();
  menu.setLevel(volume);
  menu.view.position.set(origin.x, origin.y);
  menu.view.eventMode = 'static';
  menu.view.hitArea = new Rectangle(0, 0, menu.width, menu.height);
  const levelAt = (event: FederatedPointerEvent) => {
    const y = menu.view.toLocal(event.global).y;
    const bottom = menu.knobCenter(0).y;
    const top = menu.knobCenter(1).y;
    return Math.min(1, Math.max(0, (y - bottom) / (top - bottom)));
  };
  const drag = (event: FederatedPointerEvent) => setVolume(levelAt(event), menu);
  menu.view.on('pointerdown', (event: FederatedPointerEvent) => {
    event.stopPropagation();
    drag(event);
    menu.view.on('globalpointermove', drag);
  });
  const release = () => {
    if (!menu.view.listenerCount('globalpointermove')) return;
    menu.view.off('globalpointermove', drag);
    // The original plays a beep at the new volume on release
    play('Pop');
  };
  menu.view.on('pointerup', release);
  menu.view.on('pointerupoutside', release);
  menuLayer.addChild(menu.view);
  menuBar.setVolumeExtra({ muted: volume === 0, open: true });
  volumeMenu = menu;
});

function setVolume(level: number, menu: VolumeMenu): void {
  volume = level;
  master.gain.value = volume;
  menu.setLevel(volume);
  menuBar.setVolumeExtra({ muted: volume === 0, open: true });
}

function closeMenus(): void {
  appleMenu?.destroy();
  appleMenu = null;
  menuBar.setAppleHighlighted(false);
  volumeMenu?.destroy();
  volumeMenu = null;
  menuBar.setVolumeExtra({ muted: volume === 0, open: false });
}

// ---------- Windows: cascaded, a click brings one to the front ----------

let spawned = 0;
function place(view: Container): void {
  const step = spawned++ % 8;
  view.position.set(330 + step * 24, 170 + step * 22);
  view.eventMode = 'static';
  view.on('pointerdown', () => windowLayer.addChild(view));
  windowLayer.addChild(view);
}

/** Makes a button clickable: darker while pressed, runs onTap on click */
function clickable(view: Container, onTap: () => void): void {
  view.eventMode = 'static';
  view.cursor = 'pointer';
  view.on('pointerdown', (event) => {
    event.stopPropagation();
    view.alpha = 0.75;
  });
  view.on('pointerout', () => (view.alpha = 1));
  view.on('pointertap', () => onTap());
}

const ALERTS: Record<
  'note' | 'caution' | 'stop',
  { app: AppIconName | 'finder'; message: string; informative: string; sound: MacSoundName }
> = {
  note: {
    app: 'System Preferences',
    message: 'Software Update found new software.',
    informative: '3 updates are available for your computer.',
    sound: 'Glass',
  },
  caution: {
    app: 'finder',
    message: 'Are you sure you want to empty the Trash?',
    informative: 'It contains 12 items. You cannot undo this action.',
    sound: 'Funk',
  },
  stop: {
    app: 'iTunes',
    message: 'The application iTunes has unexpectedly quit.',
    informative: 'The system and other applications have not been affected.',
    sound: 'Basso',
  },
};

function showAlert(kind: keyof typeof ALERTS): void {
  const { app, message, informative, sound } = ALERTS[kind];
  const icon = new Container();
  const appGraphic = (size: number) =>
    app === 'finder' ? drawFinderIcon(size) : appIcon(app, size);
  if (kind === 'caution') {
    const badge = appGraphic(32);
    badge.position.set(32, 32);
    icon.addChild(drawCautionIcon(64), badge);
  } else {
    icon.addChild(appGraphic(64));
  }
  const alert = new AquaAlert({
    icon,
    message,
    informative,
    buttons: [{ label: 'OK', isDefault: true }],
    width: 340,
  });
  for (const button of alert.buttons) clickable(button.view, () => alert.destroy());
  canvas.onFrame(() => {
    if (!alert.view.destroyed) alert.update(audio.currentTime);
  });
  place(alert.view);
  play(sound);
}

/** A document window, closable with its red button; withSheet also slides out a save sheet */
function showDocument(withSheet: boolean): void {
  const width = withSheet ? 320 : 260;
  const height = withSheet ? 200 : 160;
  const window = new AquaWindow({
    title: withSheet ? 'Essay.rtf' : 'Untitled',
    width,
    height,
    content: 'white',
    toolbarButton: !withSheet,
    statusText: withSheet ? undefined : '1 page',
    scroller: { thumbStart: 0, thumbSize: 0.6 },
  });
  const text = aquaText('Dear diary,\nToday I finally got broadband.', {
    size: 12,
    lineHeight: 16,
  });
  text.position.set(8, 6);
  window.content.addChild(text);
  const close = new Container();
  close.hitArea = new Rectangle(window.closeCenter.x - 8, window.closeCenter.y - 8, 16, 16);
  close.position.copyFrom(window.view.pivot);
  window.view.addChild(close);
  clickable(close, () => window.destroy());
  place(window.view);

  if (!withSheet) {
    play('Bottle');
    return;
  }
  const sheet = new AquaSheet({
    icon: appIcon('TextEdit', 48),
    message: 'Do you want to save changes to this document before closing?',
    informative: "If you don't save, your changes will be lost.",
    leftButton: "Don't Save",
    buttons: ['Cancel', 'Save'],
    width: 300,
  });
  sheet.view.position.set(width / 2, TITLE_BAR_HEIGHT);
  window.view.addChild(sheet.view);
  // The sheet slides out over 0.2 s
  const start = performance.now();
  canvas.onFrame(() => {
    if (sheet.view.destroyed) return;
    sheet.setReveal((performance.now() - start) / 200);
    sheet.update(audio.currentTime);
  });
  for (const label of ["Don't Save", 'Cancel', 'Save']) {
    const center = sheet.buttonCenter(label);
    const hit = new Container();
    hit.hitArea = new Rectangle(center.x - 36, center.y - 11, 72, 22);
    sheet.view.addChild(hit);
    clickable(hit, () => {
      play('Tink');
      if (label === 'Cancel') sheet.destroy();
      else window.destroy();
    });
  }
  play('Frog');
}

function showChat(): void {
  const chat = new ChatWindow({ buddy: 'Sam', text: 'u there?' });
  clickable(chat.view, () => chat.destroy());
  place(chat.view);
  play('Submarine');
}

// ---------- Dock and desktop files ----------

const ICHAT_INDEX = 2;
const MAIL_INDEX = 1;
let bounceStart = -Infinity;
let unread = 0;
let mailChanged = -Infinity;
let trashFull = false;
canvas.onFrame(() => {
  // Bounce: one high jump, then small hops, 2 s in all
  const t = (performance.now() - bounceStart) / 1000;
  const lift =
    t < 0.5
      ? 26 * 4 * (t / 0.5) * (1 - t / 0.5)
      : t < 2
        ? 10 * 4 * ((t % 0.5) / 0.5) * (1 - (t % 0.5) / 0.5)
        : 0;
  dock.setLift(ICHAT_INDEX, lift);
  const pop = Math.max(0, 1 - (performance.now() - mailChanged) / 200);
  dock.setBadge(MAIL_INDEX, unread, pop);
});

function bounce(): void {
  bounceStart = performance.now();
  play('Pop');
}

function newMail(): void {
  unread++;
  mailChanged = performance.now();
  play('Ping');
}

function toggleTrash(): void {
  trashFull = !trashFull;
  dock.setTrashFull(trashFull);
  play(trashFull ? 'Blow' : 'Tink');
}

const FILES: { label: string; app: AppIconName | 'folder' }[] = [
  { label: 'Untitled.rtf', app: 'TextEdit' },
  { label: 'Mix Tape.mp3', app: 'iTunes' },
  { label: 'Holiday.jpg', app: 'Preview' },
  { label: 'Old Stuff', app: 'folder' },
];
let files = 0;
function dropFile(): void {
  const file = FILES[files % FILES.length]!;
  const view = createDesktopFile(file.label, file.app);
  view.position.set(120 + (files % 6) * 92, 466);
  files++;
  clickable(view, () => {
    view.destroy({ children: true });
    if (!trashFull) toggleTrash();
  });
  fileLayer.addChild(view);
  play('Purr');
}

// ---------- Page buttons (a dev tool, in English like the game) ----------

const toolbar = document.createElement('nav');
toolbar.className = 'dev-panel';
toolbar.setAttribute('aria-label', 'Mac components');
const buttons: [string, () => void][] = [
  ['Note alert-note', () => showAlert('note')],
  ['Caution alert-caution', () => showAlert('caution')],
  ['Stop alert-stop', () => showAlert('stop')],
  ['Document window', () => showDocument(false)],
  ['Sheet sheet-save', () => showDocument(true)],
  ['iChat message ichat-message', showChat],
  ['Dock bounce', bounce],
  ['New mail', newMail],
  ['Trash empty / full', toggleTrash],
  ['Desktop file', dropFile],
];
for (const [label, onClick] of buttons) toolbar.append(toolbarButton(label, onClick));
const back = document.createElement('a');
back.href = '/';
back.textContent = 'Back to game';
toolbar.append(back);
document.body.append(toolbar);

function toolbarButton(label: string, onClick: () => void): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  button.addEventListener('click', () => {
    button.blur();
    void clock.resume();
    closeMenus();
    onClick();
  });
  return button;
}

// Expose the view globally in development, for grabbing zoomed captures in the console to compare with the original
if (import.meta.env.DEV) Object.assign(globalThis, { macDebug: { app: canvas.app, screen } });
