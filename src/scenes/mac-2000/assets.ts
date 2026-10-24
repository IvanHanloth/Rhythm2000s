// Original assets for the Mac scene, all from assets/reference/mac-os-x/: Jaguar's Aqua Blue wallpaper,
// the 10.4 application icons and the system alert sounds. Call preloadMacAssets() before creating the scene, then read them with macAssets().
// Which sound goes with which event: doc/scenes/mac-2000.md "Sounds".

import { Assets, Sprite, type Texture } from 'pixi.js';
import { loadAiffSample } from '@/audio/aiff.ts';
import wallpaperUrl from '@assets/reference/mac-os-x/wallpapers/aqua/10.4 Jaguar Aqua Blue.jpg?url';
import type { MacSoundName } from './action-kinds.ts';

/** File name (without extension) → URL */
function urlsByName(files: Record<string, string>): Map<string, string> {
  return new Map(
    Object.entries(files).map(([path, url]) => [path.replace(/^.*\/(.+)\.\w+$/, '$1'), url]),
  );
}

const ICON_URLS = urlsByName(
  import.meta.glob<string>('/assets/reference/mac-os-x/icons/*.png', {
    eager: true,
    query: '?url',
    import: 'default',
  }),
);

const SOUND_URLS = urlsByName(
  import.meta.glob<string>('/assets/reference/mac-os-x/sounds/*.aiff', {
    eager: true,
    query: '?url',
    import: 'default',
  }),
);

/** Alert sounds the scene uses, with their peak volume */
const SOUNDS: Record<MacSoundName, number> = {
  Basso: 0.7,
  Blow: 0.6,
  Bottle: 0.6,
  Frog: 0.6,
  Funk: 0.7,
  Glass: 0.6,
  Hero: 0.6,
  Morse: 0.6,
  Ping: 0.6,
  Pop: 0.7,
  Purr: 0.7,
  Sosumi: 0.6,
  Submarine: 0.6,
  Tink: 0.7,
};

/** File names under assets/reference/mac-os-x/icons/ (without extension) */
export type AppIconName =
  | 'AddressBook'
  | 'Calculator'
  | 'Chess'
  | 'DVD Player'
  | 'Mail'
  | 'Preview'
  | 'QuickTime Player'
  | 'Safari'
  | 'Sherlock'
  | 'Stickies'
  | 'System Preferences'
  | 'Terminal'
  | 'TextEdit'
  | 'iCal'
  | 'iChat'
  | 'iPhoto'
  | 'iTunes';

export type MacSounds = Record<MacSoundName, AudioBuffer>;

export interface MacAssets {
  wallpaper: Texture;
  sounds: MacSounds;
  /** Application icon by file name */
  icon(name: AppIconName): Texture;
}

let loading: Promise<MacAssets> | null = null;
let loaded: MacAssets | null = null;

/** Loads every asset; repeated calls share one result. */
export function preloadMacAssets(audio: BaseAudioContext): Promise<MacAssets> {
  loading ??= load(audio).then((assets) => (loaded = assets));
  return loading;
}

/** The loaded assets; throws if they are not loaded yet. */
export function macAssets(): MacAssets {
  if (!loaded) throw new Error('Mac assets are not loaded yet; call preloadMacAssets() first');
  return loaded;
}

/** An application icon with its top left at (0, 0), `size` square */
export function appIcon(name: AppIconName, size: number): Sprite {
  const sprite = new Sprite({ texture: macAssets().icon(name), label: name });
  sprite.setSize(size);
  return sprite;
}

async function load(audio: BaseAudioContext): Promise<MacAssets> {
  const iconEntries = [...ICON_URLS];
  const soundNames = Object.keys(SOUNDS) as MacSoundName[];
  const [wallpaper, icons, buffers] = await Promise.all([
    Assets.load<Texture>(wallpaperUrl),
    // The icons are 256 px but drawn at 32–64 px, so they need mipmaps to shrink cleanly
    Promise.all(
      iconEntries.map(([, url]) =>
        Assets.load<Texture>({ src: url, data: { autoGenerateMipmaps: true } }),
      ),
    ),
    Promise.all(
      soundNames.map((name) => {
        const url = SOUND_URLS.get(name);
        if (!url) throw new Error(`No Mac alert sound ${name}.aiff`);
        return loadAiffSample(audio, url, { peak: SOUNDS[name] });
      }),
    ),
  ]);
  const iconTextures = new Map(iconEntries.map(([name], i) => [name, icons[i]!]));
  return {
    wallpaper,
    sounds: Object.fromEntries(soundNames.map((name, i) => [name, buffers[i]!])) as MacSounds,
    icon(name) {
      const texture = iconTextures.get(name);
      if (!texture) throw new Error(`No Mac icon ${name}.png`);
      return texture;
    },
  };
}
