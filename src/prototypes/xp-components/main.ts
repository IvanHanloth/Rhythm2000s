// XP 部件展示页：把重新设计的 XP 界面部件摆在一张桌面上，可以逐个点开看效果、听声音。
// 用来对照原版检查外观，不是游戏玩法。说明见 doc/scenes/windows-xp.md「界面部件」。
//
// - 点「开始」打开开始菜单，点菜单项响「菜单命令」声
// - 点托盘小喇叭打开音量控制；拖动滑块改本页音量，松开时响默认提示音；「静音」同步到托盘图标
// - 右上角按钮弹出四种消息框（各带提示音）和托盘气泡；消息框可以拖标题栏、点按钮或关闭按钮关掉

import '../../game/style.css';
import { Container, Rectangle, type FederatedPointerEvent } from 'pixi.js';
import { AudioClock } from '../../audio/audio-clock.ts';
import { GameCanvas } from '../../game/game-canvas.ts';
import { ACTION_LABELS } from '../../rhythm/actions.ts';
import { preloadXpAssets, XP_CURSOR, type XpSoundName } from '../../scenes/windows-xp/assets.ts';
import { XpBalloon } from '../../scenes/windows-xp/components/balloon.ts';
import { XpDesktop } from '../../scenes/windows-xp/components/desktop.ts';
import { XpMessageBox } from '../../scenes/windows-xp/components/message-box.ts';
import {
  WORK_AREA_HEIGHT,
  XP_SCALE,
  XP_SCREEN_HEIGHT,
  XP_SCREEN_WIDTH,
} from '../../scenes/windows-xp/components/screen.ts';
import { XpStartMenu } from '../../scenes/windows-xp/components/start-menu.ts';
import { XpTaskbar } from '../../scenes/windows-xp/components/taskbar.ts';
import { CAPTION_HEIGHT } from '../../scenes/windows-xp/components/window-frame.ts';
import { XpVolumeControl } from '../../scenes/windows-xp/components/volume-control.ts';
import { DIALOG_KINDS, type DialogKind } from '../../scenes/windows-xp/dialog-kinds.ts';

const host = document.querySelector<HTMLElement>('#game');
if (!host) throw new Error('找不到容器 #game');

const clock = new AudioClock();
const audio = clock.context;
const canvas = await GameCanvas.create(host);
const assets = await preloadXpAssets(audio);
host.style.cursor = XP_CURSOR;

// 浏览器要求在用户操作里恢复音频
const resumeAudio = () => void clock.resume();
window.addEventListener('pointerdown', resumeAudio, { once: true });
window.addEventListener('keydown', resumeAudio, { once: true });

// ---------- 音量 ----------

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

// ---------- 桌面 ----------

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

// 点桌面空白处：关掉开始菜单和音量控制，所有窗口变成非活动
desktop.view.eventMode = 'static';
desktop.view.hitArea = new Rectangle(0, 0, XP_SCREEN_WIDTH, WORK_AREA_HEIGHT);
desktop.view.on('pointerdown', () => {
  closePopups();
  activate(null);
});

// ---------- 开始菜单 ----------

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

// ---------- 音量控制 ----------

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
      // 原版松开滑块时按新音量响一声默认提示音
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

// ---------- 消息框 ----------

const SAMPLE_TEXTS: Record<DialogKind, { title: string; text: string }> = {
  'dialog-info': { title: '网络连接', text: '已连接到 Internet。\n速度：56.0 Kbps' },
  'dialog-warning': { title: '磁盘空间不足', text: '本地磁盘 (C:) 的空间不足。' },
  'dialog-error': { title: '应用程序错误', text: '该程序执行了非法操作，即将关闭。' },
  'dialog-question': { title: '记事本', text: '是否保存对「无标题」的更改？' },
};

const dialogs: XpMessageBox[] = [];
let spawned = 0;

function openDialog(kind: DialogKind): void {
  closePopups();
  const dialog = new XpMessageBox({ kind, ...SAMPLE_TEXTS[kind] });
  // 依次错开排开，和原版层叠窗口一样
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

  // 拖动标题栏移动窗口
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

// ---------- 托盘气泡 ----------

let balloon: XpBalloon | null = null;

function showBalloon(): void {
  balloon?.destroy();
  balloon = new XpBalloon({
    title: '发现新硬件',
    text: 'USB 大容量存储设备\n新硬件已安装并可以使用了。',
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

// ---------- 页面上的按钮 ----------

const toolbar = document.createElement('nav');
toolbar.className = 'dev-panel';
toolbar.setAttribute('aria-label', 'XP 部件');
for (const kind of Object.keys(DIALOG_KINDS) as DialogKind[]) {
  toolbar.append(toolbarButton(`${kind}（${ACTION_LABELS[kind]}）`, () => openDialog(kind)));
}
toolbar.append(toolbarButton('托盘气泡', showBalloon));
const back = document.createElement('a');
back.href = '/';
back.textContent = '回到游戏';
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

// 开发时把画面挂到全局，便于在浏览器控制台里截取放大图对照原版
if (import.meta.env.DEV) Object.assign(globalThis, { xpDebug: { app: canvas.app, screen } });
