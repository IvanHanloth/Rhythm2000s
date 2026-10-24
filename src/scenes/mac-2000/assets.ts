// Mac 场景用到的原版素材：Jaguar 的 Aqua Blue 壁纸、10.4 自带的应用图标、系统提示音，
// 全部取自 assets/reference/mac-os-x/。场景创建前先调用 preloadMacAssets() 加载完，之后用 macAssets() 同步取用。
// 提示音与事件的对应关系见 doc/scenes/mac-2000.md「音效」。

import { Assets, Sprite, type Texture } from 'pixi.js';
import { loadAiffSample } from '../../audio/aiff.ts';
import wallpaperUrl from '../../../assets/reference/mac-os-x/wallpapers/aqua/10.4 Jaguar Aqua Blue.jpg?url';
import type { MacSoundName } from './action-kinds.ts';

/** 文件名（不含扩展名） → 地址 */
function urlsByName(files: Record<string, string>): Map<string, string> {
  return new Map(
    Object.entries(files).map(([path, url]) => [path.replace(/^.*\/(.+)\.\w+$/, '$1'), url]),
  );
}

const ICON_URLS = urlsByName(
  import.meta.glob<string>('../../../assets/reference/mac-os-x/icons/*.png', {
    eager: true,
    query: '?url',
    import: 'default',
  }),
);

const SOUND_URLS = urlsByName(
  import.meta.glob<string>('../../../assets/reference/mac-os-x/sounds/*.aiff', {
    eager: true,
    query: '?url',
    import: 'default',
  }),
);

/** 场景用到的提示音和各自的峰值音量 */
const SOUNDS: Record<MacSoundName, number> = {
  Basso: 0.7,
  Blow: 0.6,
  Bottle: 0.6,
  Funk: 0.7,
  Glass: 0.6,
  Hero: 0.6,
  Morse: 0.6,
  Ping: 0.6,
  Pop: 0.7,
  Purr: 0.7,
  Sosumi: 0.6,
  Tink: 0.7,
};

/** assets/reference/mac-os-x/icons/ 里的文件名（不含扩展名） */
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
  /** 按文件名取应用图标 */
  icon(name: AppIconName): Texture;
}

let loading: Promise<MacAssets> | null = null;
let loaded: MacAssets | null = null;

/** 加载全部素材。重复调用返回同一个结果。 */
export function preloadMacAssets(audio: BaseAudioContext): Promise<MacAssets> {
  loading ??= load(audio).then((assets) => (loaded = assets));
  return loading;
}

/** 取已加载的素材；还没加载完时抛出错误。 */
export function macAssets(): MacAssets {
  if (!loaded) throw new Error('Mac 素材还没有加载，先调用 preloadMacAssets()');
  return loaded;
}

/** 应用图标，左上角在 (0, 0)、边长 size */
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
    // 图标原图 256 像素，画出来只有 32–64 像素，要开 mipmap 才不会缩得发毛
    Promise.all(
      iconEntries.map(([, url]) =>
        Assets.load<Texture>({ src: url, data: { autoGenerateMipmaps: true } }),
      ),
    ),
    Promise.all(
      soundNames.map((name) => {
        const url = SOUND_URLS.get(name);
        if (!url) throw new Error(`没有 Mac 提示音 ${name}.aiff`);
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
      if (!texture) throw new Error(`没有 Mac 图标 ${name}.png`);
      return texture;
    },
  };
}
