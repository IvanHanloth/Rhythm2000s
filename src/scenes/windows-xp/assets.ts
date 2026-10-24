// Original assets for the XP scene, all from assets/reference/windows-xp/: wallpaper, icons, Tahoma, system sounds.
// Call preloadXpAssets() before creating the scene, then read them synchronously with xpAssets().
// Which sound goes with which event: doc/scenes/windows-xp.md "Sounds".

import { Assets, Texture } from 'pixi.js';
import { loadSample, type SampleOptions } from '@/audio/samples.ts';
import { decodeCur } from './cur-file.ts';
import tahomaUrl from '@assets/reference/windows-xp/fonts/TAHOMA.TTF?url';
import tahomaBoldUrl from '@assets/reference/windows-xp/fonts/TAHOMABD.TTF?url';
import blissUrl from '@assets/reference/windows-xp/wallpapers/Bliss.jpg?url';
import asteriskUrl from '@assets/reference/windows-xp/sounds/Windows XP Error.wav?url';
import exclamationUrl from '@assets/reference/windows-xp/sounds/Windows XP Exclamation.wav?url';
import criticalStopUrl from '@assets/reference/windows-xp/sounds/Windows XP Critical Stop.wav?url';
import chimesUrl from '@assets/reference/windows-xp/sounds/chimes.wav?url';
import dingUrl from '@assets/reference/windows-xp/sounds/Windows XP Ding.wav?url';
import navigateUrl from '@assets/reference/windows-xp/sounds/Windows XP Start.wav?url';
import menuCommandUrl from '@assets/reference/windows-xp/sounds/Windows XP Menu Command.wav?url';
import balloonUrl from '@assets/reference/windows-xp/sounds/Windows XP Balloon.wav?url';
import tadaUrl from '@assets/reference/windows-xp/sounds/tada.wav?url';
import restoreUrl from '@assets/reference/windows-xp/sounds/Windows XP Restore.wav?url';
import minimizeUrl from '@assets/reference/windows-xp/sounds/Windows XP Minimize.wav?url';
import recycleUrl from '@assets/reference/windows-xp/sounds/Windows XP Recycle.wav?url';
import defaultSoundUrl from '@assets/reference/windows-xp/sounds/Windows XP Default.wav?url';
import hardwareInsertUrl from '@assets/reference/windows-xp/sounds/Windows XP Hardware Insert.wav?url';
import hardwareRemoveUrl from '@assets/reference/windows-xp/sounds/Windows XP Hardware Remove.wav?url';
import notifyUrl from '@assets/reference/windows-xp/sounds/Windows XP Notify.wav?url';
import chordUrl from '@assets/reference/windows-xp/sounds/chord.wav?url';
import arrowCursorUrl from '@assets/reference/windows-xp/icons/default_arrow.cur?url';
import linkCursorUrl from '@assets/reference/windows-xp/icons/default_link.cur?url';
import { XP_FONT_FAMILY } from './components/xp-text.ts';
import { XP_ICON_URLS } from './system-icons.ts';

/**
 * XP's standard arrow pointer (the .cur file carries its hotspot, at the arrow's tip).
 */
export const XP_CURSOR = `url("${arrowCursorUrl}"), default`;

/** XP's hand over links (Link Select), for the easter egg's web pages and message links */
export const XP_LINK_CURSOR = `url("${linkCursorUrl}"), pointer`;

/** Sounds named after the original system events */
const SOUND_FILES = {
  /** Asterisk: information box */
  asterisk: { url: asteriskUrl },
  /** Exclamation: warning box */
  exclamation: { url: exclamationUrl },
  /** Critical Stop: error box */
  criticalStop: { url: criticalStopUrl },
  /** The original Question event is silent; chimes.wav stands in */
  question: { url: chimesUrl, peak: 0.55 },
  /** Default Beep: clicking outside a modal box, releasing the volume slider */
  defaultBeep: { url: dingUrl, peak: 0.55 },
  /** Explorer's Start Navigation click */
  navigate: { url: navigateUrl, peak: 0.8 },
  menuCommand: { url: menuCommandUrl, peak: 0.6 },
  balloon: { url: balloonUrl, peak: 0.55 },
  tada: { url: tadaUrl, peak: 0.6 },
  /** Restore Up: window-minimize's program window appears in the call */
  restore: { url: restoreUrl, peak: 0.6 },
  /** Minimize: window-minimize hit in the response */
  minimize: { url: minimizeUrl, peak: 0.6 },
  /** Empty Recycle Bin: recycle-bin hit in the response */
  recycle: { url: recycleUrl, peak: 0.6 },
  /** Windows XP Default.wav: a file lands on the desktop in the recycle-bin call (provisional) */
  fileDrop: { url: defaultSoundUrl, peak: 0.5 },
  /** progress-download window opens (provisional; the original download start is silent) */
  downloadStart: { url: hardwareInsertUrl, peak: 0.55 },
  /** progress-download "Open" clicked (provisional) */
  downloadOpen: { url: notifyUrl, peak: 0.55 },
  /** volume-mute slider released: chord, since Ding (the original) is the Miss sound here (provisional) */
  volumeRelease: { url: chordUrl, peak: 0.55 },
  /** New Mail Notification: the Rickroll message arrives (doc/easter-eggs.md) */
  newMail: { url: notifyUrl, peak: 0.55 },
  /** Hardware Remove: a combo of 10 or more breaks (doc/combo.md "Combo break") */
  comboBreak: { url: hardwareRemoveUrl, peak: 0.55 },
} satisfies Record<string, { url: string } & SampleOptions>;

export type XpSoundName = keyof typeof SOUND_FILES;
export type XpSounds = Record<XpSoundName, AudioBuffer>;

export interface XpAssets {
  wallpaper: Texture;
  sounds: XpSounds;
  /** XP arrow for the virtual mouse, decoded from default_arrow.cur; the hotspot is the clicking pixel */
  pointer: { texture: Texture; hotspot: { x: number; y: number } };
  /** Icon by file name; throws for a missing icon rather than drawing nothing */
  icon(name: string): Texture;
}

let loading: Promise<XpAssets> | null = null;
let loaded: XpAssets | null = null;

/** Loads every asset; repeated calls share one result. */
export function preloadXpAssets(audio: BaseAudioContext): Promise<XpAssets> {
  loading ??= load(audio).then((assets) => (loaded = assets));
  return loading;
}

/** The loaded assets; throws if they are not loaded yet. */
export function xpAssets(): XpAssets {
  if (!loaded) throw new Error('XP assets are not loaded yet; call preloadXpAssets() first');
  return loaded;
}

async function load(audio: BaseAudioContext): Promise<XpAssets> {
  const iconEntries = Object.entries(XP_ICON_URLS);
  const [wallpaper, icons, sounds, , pointer] = await Promise.all([
    Assets.load<Texture>(blissUrl),
    Promise.all(
      iconEntries.map(([, url]) =>
        Assets.load<Texture>({ src: url, data: { autoGenerateMipmaps: true } }),
      ),
    ),
    loadSounds(audio),
    loadFonts(),
    loadPointer(),
  ]);
  const iconTextures = new Map(iconEntries.map(([name], i) => [name, icons[i]!]));
  return {
    wallpaper,
    sounds,
    pointer,
    icon(name) {
      const texture = iconTextures.get(name);
      if (!texture) throw new Error(`No XP icon ${name}.png`);
      return texture;
    },
  };
}

/** Browsers can't read .cur, so decode the pixels onto a canvas as a texture, scaled nearest-neighbour to stay crisp */
async function loadPointer(): Promise<XpAssets['pointer']> {
  const response = await fetch(arrowCursorUrl);
  if (!response.ok)
    throw new Error(`Failed to download pointer ${arrowCursorUrl} (HTTP ${response.status})`);
  const image = decodeCur(new Uint8Array(await response.arrayBuffer()));
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Cannot create a canvas to decode the pointer');
  context.putImageData(new ImageData(image.rgba, image.width, image.height), 0, 0);
  const texture = Texture.from(canvas);
  texture.source.scaleMode = 'nearest';
  return { texture, hotspot: image.hotspot };
}

async function loadSounds(audio: BaseAudioContext): Promise<XpSounds> {
  const entries = Object.entries(SOUND_FILES) as [XpSoundName, { url: string } & SampleOptions][];
  const buffers = await Promise.all(
    entries.map(([, { url, ...options }]) => loadSample(audio, url, options)),
  );
  return Object.fromEntries(entries.map(([name], i) => [name, buffers[i]!])) as XpSounds;
}

/** Tahoma regular and bold. Text drawn before they load is measured in a fallback font and never redrawn. */
async function loadFonts(): Promise<void> {
  const faces = [
    new FontFace(XP_FONT_FAMILY, `url("${tahomaUrl}")`, { weight: '400' }),
    new FontFace(XP_FONT_FAMILY, `url("${tahomaBoldUrl}")`, { weight: '700' }),
  ];
  await Promise.all(faces.map((face) => face.load()));
  for (const face of faces) document.fonts.add(face);
}
