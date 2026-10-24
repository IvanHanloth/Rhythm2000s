// XP widget gallery: the redesigned XP widgets on a desktop, to open one by one and hear their sounds.
// For checking the look against the original, not gameplay (doc/scenes/windows-xp.md "Widgets").
//
// - Click Start for the Start menu; items play Menu Command
// - Click the tray speaker for the volume control; the slider sets this page's volume and plays Default Beep on release; Mute shows on the tray icon
// - The top right buttons open the four message boxes (with sounds) and a tray balloon; drag boxes by the title bar, close them with a button or the close box
// - "File download" opens the download window; the bar fills in 2 s, Open lights up, and Open or Close dismisses it

import '@/game/style.css';
import { Container, Rectangle, type FederatedPointerEvent } from 'pixi.js';
import { AudioClock } from '@/audio/audio-clock.ts';
import { GameCanvas } from '@/game/game-canvas.ts';
import { ACTION_LABELS } from '@/rhythm/actions.ts';
import { preloadXpAssets, XP_CURSOR, type XpSoundName } from '@/scenes/windows-xp/assets.ts';
import { XpBalloon } from '@/scenes/windows-xp/components/balloon.ts';
import { XpDesktop } from '@/scenes/windows-xp/components/desktop.ts';
import { XpDownloadDialog } from '@/scenes/windows-xp/components/download-dialog.ts';
import { XpMessageBox } from '@/scenes/windows-xp/components/message-box.ts';
import {
  WORK_AREA_HEIGHT,
  XP_SCALE,
  XP_SCREEN_HEIGHT,
  XP_SCREEN_WIDTH,
} from '@/scenes/windows-xp/components/screen.ts';
import { XpStartMenu } from '@/scenes/windows-xp/components/start-menu.ts';
import { XpTaskbar } from '@/scenes/windows-xp/components/taskbar.ts';
import { CAPTION_HEIGHT } from '@/scenes/windows-xp/components/window-frame.ts';
import { XpVolumeControl } from '@/scenes/windows-xp/components/volume-control.ts';
import { DIALOG_KINDS, type DialogKind } from '@/scenes/windows-xp/dialog-kinds.ts';
import { XpResultsWindow } from '@/scenes/windows-xp/results-window.ts';
import { summarizeResult, type HitResult } from '@/rhythm/result-summary.ts';

const host = document.querySelector<HTMLElement>('#game');
if (!host) throw new Error('Container #game not found');

const clock = new AudioClock();
const audio = clock.context;
const canvas = await GameCanvas.create(host);
const assets = await preloadXpAssets(audio);
host.style.cursor = XP_CURSOR;

// Browsers only resume audio inside a user gesture
const resumeAudio = () => void clock.resume();
window.addEventListener('pointerdown', resumeAudio, { once: true });
window.addEventListener('keydown', resumeAudio, { once: true });

// ---------- Volume ----------

let volume = 0.8;
let muted = false;
const master = audio.createGain();
master.connect(audio.destination);
const applyVolume = () => {
  master.gain.value = muted ? 0 : volume;
};
applyVolume();

function play(name: XpSoundName): void {
  const source = audio.createBufferSource();
  source.buffer = assets.sounds[name];
  source.connect(master);
  source.start();
}

// ---------- Desktop ----------

const screen = new Container({ label: 'xp-screen' });
screen.scale.set(XP_SCALE);
canvas.stage.addChild(screen);

const desktop = new XpDesktop();
const windowLayer = new Container({ label: 'windows' });
const taskbar = new XpTaskbar();
taskbar.view.y = XP_SCREEN_HEIGHT - taskbar.view.height;
const popupLayer = new Container({ label: 'popups' });
screen.addChild(desktop.view, windowLayer, taskbar.view, popupLayer);
canvas.onFrame(() => taskbar.setClock(new Date()));

// Clicking empty desktop closes the Start menu and volume control and deactivates every window
desktop.view.eventMode = 'static';
desktop.view.hitArea = new Rectangle(0, 0, XP_SCREEN_WIDTH, WORK_AREA_HEIGHT);
desktop.view.on('pointerdown', () => {
  closePopups();
  activate(null);
});

// ---------- Start menu ----------

let startMenu: XpStartMenu | null = null;
const startButton = taskbar.startButton;
startButton.view.eventMode = 'static';
startButton.view.on('pointerdown', () => {
  if (startMenu) {
    closePopups();
    return;
  }
  closePopups();
  startMenu = new XpStartMenu({
    onSelect: () => {
      play('menuCommand');
      closePopups();
    },
  });
  startMenu.view.position.set(0, WORK_AREA_HEIGHT - startMenu.height);
  popupLayer.addChild(startMenu.view);
  startButton.setPressed(true);
});

// ---------- Volume control ----------

let volumeControl: XpVolumeControl | null = null;
taskbar.volumeIcon.eventMode = 'static';
taskbar.volumeIcon.on('pointerdown', () => {
  if (volumeControl) {
    closePopups();
    return;
  }
  closePopups();
  volumeControl = new XpVolumeControl({
    volume,
    muted,
    onChange: (value, released) => {
      volume = value;
      applyVolume();
      // The original plays the default beep at the new volume on release
      if (released) play('defaultBeep');
    },
    onMuteChange: (value) => {
      muted = value;
      applyVolume();
      taskbar.setMuted(muted);
    },
  });
  const icon = screen.toLocal(taskbar.volumeIcon.getGlobalPosition());
  const x = Math.min(
    icon.x + 8 - volumeControl.width / 2,
    XP_SCREEN_WIDTH - volumeControl.width - 2,
  );
  volumeControl.view.position.set(Math.round(x), WORK_AREA_HEIGHT - volumeControl.height);
  popupLayer.addChild(volumeControl.view);
});

function closePopups(): void {
  startMenu?.destroy();
  startMenu = null;
  startButton.setPressed(false);
  volumeControl?.destroy();
  volumeControl = null;
}

// ---------- Message boxes ----------

const SAMPLE_TEXTS: Record<DialogKind, { title: string; text: string }> = {
  'dialog-info': {
    title: 'Network Connection',
    text: 'You are now connected to the Internet.\nSpeed: 56.0 Kbps',
  },
  'dialog-warning': {
    title: 'Low Disk Space',
    text: 'You are running out of disk space on Local Disk (C:).',
  },
  'dialog-error': {
    title: 'Application Error',
    text: 'This program has performed an illegal operation and will be shut down.',
  },
  'dialog-question': {
    title: 'Notepad',
    text: 'The text in the Untitled file has changed.\nDo you want to save the changes?',
  },
};

const dialogs: XpMessageBox[] = [];
let spawned = 0;

function openDialog(kind: DialogKind): void {
  closePopups();
  const dialog = new XpMessageBox({ kind, ...SAMPLE_TEXTS[kind] });
  // Cascaded like the original's stacked windows
  const step = spawned++ % 8;
  dialog.view.position.set(300 + step * 26, 150 + step * 26);
  windowLayer.addChild(dialog.view);
  dialogs.push(dialog);
  wireDialog(dialog);
  activate(dialog);
  play(DIALOG_KINDS[kind].sound);
}

function wireDialog(dialog: XpMessageBox): void {
  const view = dialog.view;
  view.eventMode = 'static';
  view.on('pointerdown', (event) => {
    event.stopPropagation();
    closePopups();
    activate(dialog);
  });

  // Drag the title bar to move the window
  const caption = new Container({ label: 'caption-drag' });
  caption.eventMode = 'static';
  caption.hitArea = new Rectangle(0, 0, dialog.width - 30, CAPTION_HEIGHT);
  view.addChildAt(caption, 1);
  caption.on('pointerdown', (event: FederatedPointerEvent) => {
    const start = screen.toLocal(event.global);
    const origin = { x: view.x, y: view.y };
    const move = (e: FederatedPointerEvent) => {
      const now = screen.toLocal(e.global);
      view.position.set(
        Math.round(origin.x + now.x - start.x),
        Math.round(origin.y + now.y - start.y),
      );
    };
    const end = () => {
      caption.off('globalpointermove', move);
      caption.off('pointerup', end);
      caption.off('pointerupoutside', end);
    };
    caption.on('globalpointermove', move);
    caption.on('pointerup', end);
    caption.on('pointerupoutside', end);
  });

  const close = dialog.frame.closeButton;
  close.view.eventMode = 'static';
  close.view.on('pointerover', () => close.setState('hot'));
  close.view.on('pointerout', () => close.setState('normal'));
  close.view.on('pointerdown', () => close.setState('pressed'));
  close.view.on('pointertap', () => closeDialog(dialog));

  for (const button of dialog.buttons) {
    button.view.eventMode = 'static';
    button.view.on('pointerover', () => button.setHot(true));
    button.view.on('pointerout', () => {
      button.setHot(false);
      button.setPressed(false);
    });
    button.view.on('pointerdown', () => button.setPressed(true));
    button.view.on('pointertap', () => closeDialog(dialog));
  }
}

function activate(dialog: XpMessageBox | null): void {
  for (const d of dialogs) d.setActive(d === dialog);
  if (dialog) windowLayer.addChild(dialog.view);
}

function closeDialog(dialog: XpMessageBox): void {
  dialogs.splice(dialogs.indexOf(dialog), 1);
  dialog.destroy();
  activate(dialogs.at(-1) ?? null);
}

// ---------- Tray balloon ----------

let balloon: XpBalloon | null = null;

// ---------- Results window (sample data: 31 hits, 2 Misses, slightly late) ----------

let results: XpResultsWindow | null = null;

function showResults(): void {
  closePopups();
  results?.destroy();
  const offsetsMs = [
    -58, -41, -35, -22, -20, -14, -9, -6, -3, 0, 2, 4, 6, 9, 11, 13, 15, 18, 20, 21, 24, 26, 29, 33,
    36, 39, 44, 52, 61, 70, 84,
  ];
  const hits: HitResult[] = offsetsMs.map((ms, i) => ({
    level: Math.abs(ms) <= 45 ? 'perfect' : 'good',
    offset: ms / 1000,
    phrase: Math.floor(i / 4),
  }));
  hits.push({ level: 'miss', offset: null, phrase: 3 }, { level: 'miss', offset: null, phrase: 6 });
  const close = () => {
    results?.destroy();
    results = null;
  };
  results = new XpResultsWindow({
    title: 'Pop-up Sweep',
    summary: summarizeResult(hits),
    newRecord: true,
    assisted: false,
    hasNext: true,
    onRetry: close,
    onList: close,
    onNext: close,
  });
  results.view.position.set(XP_SCREEN_WIDTH / 2, WORK_AREA_HEIGHT / 2);
  windowLayer.addChild(results.view);
  play('tada');
}

function showBalloon(): void {
  balloon?.destroy();
  balloon = new XpBalloon({
    title: 'Found New Hardware',
    text: 'USB Mass Storage Device\nYour new hardware is installed and ready to use.',
    onClose: () => {
      balloon?.destroy();
      balloon = null;
    },
  });
  const icon = screen.toLocal(taskbar.volumeIcon.getGlobalPosition());
  balloon.view.position.set(icon.x + 8, icon.y + 2);
  popupLayer.addChild(balloon.view);
  play('balloon');
}

// ---------- Download window (the progress-download widget) ----------

let download: XpDownloadDialog | null = null;
let downloadStart = 0;
const DOWNLOAD_SECONDS = 2;

function showDownload(): void {
  download?.destroy();
  download = new XpDownloadDialog({
    fileName: 'setup.exe',
    sizeKb: 1240,
    host: 'www.example-files.com',
  });
  download.view.position.set(XP_SCREEN_WIDTH / 2, WORK_AREA_HEIGHT / 2);
  download.view.eventMode = 'static';
  // Disabled until full; once full, a click anywhere counts as Open (gallery only)
  download.view.on('pointertap', () => {
    if (performance.now() - downloadStart < DOWNLOAD_SECONDS * 1000) return;
    play('downloadOpen');
    download?.destroy();
    download = null;
  });
  windowLayer.addChild(download.view);
  downloadStart = performance.now();
  play('downloadStart');
}

canvas.onFrame(() => {
  download?.setProgress((performance.now() - downloadStart) / (DOWNLOAD_SECONDS * 1000));
});

// ---------- Page buttons ----------

const toolbar = document.createElement('nav');
toolbar.className = 'dev-panel';
toolbar.setAttribute('aria-label', 'XP components');
for (const kind of Object.keys(DIALOG_KINDS) as DialogKind[]) {
  toolbar.append(toolbarButton(`${kind} (${ACTION_LABELS[kind]})`, () => openDialog(kind)));
}
toolbar.append(toolbarButton('Tray balloon', showBalloon));
toolbar.append(toolbarButton('Results window', showResults));
toolbar.append(toolbarButton('File download', showDownload));
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
    onClick();
  });
  return button;
}

// Expose the view globally in development, for grabbing zoomed captures in the console to compare with the original
if (import.meta.env.DEV) Object.assign(globalThis, { xpDebug: { app: canvas.app, screen } });
