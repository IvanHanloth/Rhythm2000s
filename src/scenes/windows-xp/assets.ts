// XP 场景用到的原版素材：壁纸、图标、Tahoma 字体、系统音效，全部取自 assets/reference/windows-xp/。
// 场景创建前先调用 preloadXpAssets() 加载完，之后用 xpAssets() 同步取用。
// 音效与事件的对应关系见 doc/scenes/windows-xp.md「音效」。

import { Assets, Texture } from 'pixi.js';
import { loadSample, type SampleOptions } from '../../audio/samples.ts';
import { decodeCur } from './cur-file.ts';
import tahomaUrl from '../../../assets/reference/windows-xp/fonts/TAHOMA.TTF?url';
import tahomaBoldUrl from '../../../assets/reference/windows-xp/fonts/TAHOMABD.TTF?url';
import blissUrl from '../../../assets/reference/windows-xp/wallpapers/Bliss.jpg?url';
import asteriskUrl from '../../../assets/reference/windows-xp/sounds/Windows XP Error.wav?url';
import exclamationUrl from '../../../assets/reference/windows-xp/sounds/Windows XP Exclamation.wav?url';
import criticalStopUrl from '../../../assets/reference/windows-xp/sounds/Windows XP Critical Stop.wav?url';
import chimesUrl from '../../../assets/reference/windows-xp/sounds/chimes.wav?url';
import dingUrl from '../../../assets/reference/windows-xp/sounds/Windows XP Ding.wav?url';
import navigateUrl from '../../../assets/reference/windows-xp/sounds/Windows XP Start.wav?url';
import menuCommandUrl from '../../../assets/reference/windows-xp/sounds/Windows XP Menu Command.wav?url';
import balloonUrl from '../../../assets/reference/windows-xp/sounds/Windows XP Balloon.wav?url';
import tadaUrl from '../../../assets/reference/windows-xp/sounds/tada.wav?url';
import restoreUrl from '../../../assets/reference/windows-xp/sounds/Windows XP Restore.wav?url';
import minimizeUrl from '../../../assets/reference/windows-xp/sounds/Windows XP Minimize.wav?url';
import recycleUrl from '../../../assets/reference/windows-xp/sounds/Windows XP Recycle.wav?url';
import defaultSoundUrl from '../../../assets/reference/windows-xp/sounds/Windows XP Default.wav?url';
import hardwareInsertUrl from '../../../assets/reference/windows-xp/sounds/Windows XP Hardware Insert.wav?url';
import notifyUrl from '../../../assets/reference/windows-xp/sounds/Windows XP Notify.wav?url';
import chordUrl from '../../../assets/reference/windows-xp/sounds/chord.wav?url';
import arrowCursorUrl from '../../../assets/reference/windows-xp/icons/default_arrow.cur?url';
import { XP_FONT_FAMILY } from './components/xp-text.ts';

/** 图标文件名（不含 .png） → 地址 */
const ICON_URLS: Record<string, string> = Object.fromEntries(
  Object.entries(
    import.meta.glob<string>('../../../assets/reference/windows-xp/icons/*.png', {
      eager: true,
      query: '?url',
      import: 'default',
    }),
  ).map(([path, url]) => [path.replace(/^.*\/(.+)\.png$/, '$1'), url]),
);

/**
 * XP 的标准箭头指针（.cur 文件自带热点，就在箭头尖上）。
 * 同目录还有手形指针 default_link.cur（原版用在超链接上），场景里暂时没有需要它的地方。
 */
export const XP_CURSOR = `url("${arrowCursorUrl}"), default`;

/** 按原版事件命名的音效 */
const SOUND_FILES = {
  /** 星号：信息消息框 */
  asterisk: { url: asteriskUrl },
  /** 感叹号：警告消息框 */
  exclamation: { url: exclamationUrl },
  /** 严重停止：错误消息框 */
  criticalStop: { url: criticalStopUrl },
  /** 原版的「问题」事件没有声音，暂用 chimes.wav */
  question: { url: chimesUrl, peak: 0.55 },
  /** 默认提示音：点到模态框外、音量滑块松开 */
  defaultBeep: { url: dingUrl, peak: 0.55 },
  /** 资源管理器「开始导航」的点击声 */
  navigate: { url: navigateUrl, peak: 0.8 },
  menuCommand: { url: menuCommandUrl, peak: 0.6 },
  balloon: { url: balloonUrl, peak: 0.55 },
  tada: { url: tadaUrl, peak: 0.6 },
  /** 窗口还原：window-minimize 示范段弹出程序窗口 */
  restore: { url: restoreUrl, peak: 0.6 },
  /** 窗口最小化：window-minimize 跟打段命中 */
  minimize: { url: minimizeUrl, peak: 0.6 },
  /** 清空 / 扔进回收站：recycle-bin 跟打段命中 */
  recycle: { url: recycleUrl, peak: 0.6 },
  /** Windows XP Default.wav：recycle-bin 示范段桌面落下文件，暂定 */
  fileDrop: { url: defaultSoundUrl, peak: 0.5 },
  /** progress-download 弹出下载窗，暂定（原版下载开始没有声音） */
  downloadStart: { url: hardwareInsertUrl, peak: 0.55 },
  /** progress-download 下载完点「Open」，暂定 */
  downloadOpen: { url: notifyUrl, peak: 0.55 },
  /** volume-mute 松开滑块。原版是 Ding，但游戏里 Ding 是 Miss 的声音，换成 chord，暂定 */
  volumeRelease: { url: chordUrl, peak: 0.55 },
} satisfies Record<string, { url: string } & SampleOptions>;

export type XpSoundName = keyof typeof SOUND_FILES;
export type XpSounds = Record<XpSoundName, AudioBuffer>;

export interface XpAssets {
  wallpaper: Texture;
  sounds: XpSounds;
  /** 虚拟鼠标用的 XP 箭头（从 default_arrow.cur 解出来的），热点是点击发生的像素 */
  pointer: { texture: Texture; hotspot: { x: number; y: number } };
  /** 按文件名取图标；没有这个图标时抛出错误，避免悄悄画成空白 */
  icon(name: string): Texture;
}

let loading: Promise<XpAssets> | null = null;
let loaded: XpAssets | null = null;

/** 加载全部素材。重复调用返回同一个结果。 */
export function preloadXpAssets(audio: BaseAudioContext): Promise<XpAssets> {
  loading ??= load(audio).then((assets) => (loaded = assets));
  return loading;
}

/** 取已加载的素材；还没加载完时抛出错误。 */
export function xpAssets(): XpAssets {
  if (!loaded) throw new Error('XP 素材还没有加载，先调用 preloadXpAssets()');
  return loaded;
}

async function load(audio: BaseAudioContext): Promise<XpAssets> {
  const iconEntries = Object.entries(ICON_URLS);
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
      if (!texture) throw new Error(`没有 XP 图标 ${name}.png`);
      return texture;
    },
  };
}

/** .cur 不是浏览器认识的图片格式，解码成像素再画到画布上做纹理；按最近邻放大，保持像素清楚 */
async function loadPointer(): Promise<XpAssets['pointer']> {
  const response = await fetch(arrowCursorUrl);
  if (!response.ok) throw new Error(`指针 ${arrowCursorUrl} 下载失败（HTTP ${response.status}）`);
  const image = decodeCur(new Uint8Array(await response.arrayBuffer()));
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('无法创建画布来解码指针');
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

/** Tahoma 常规和粗体。字体没加载完就画字，PixiJS 会用后备字体量尺寸，之后也不会自动重画。 */
async function loadFonts(): Promise<void> {
  const faces = [
    new FontFace(XP_FONT_FAMILY, `url("${tahomaUrl}")`, { weight: '400' }),
    new FontFace(XP_FONT_FAMILY, `url("${tahomaBoldUrl}")`, { weight: '700' }),
  ];
  await Promise.all(faces.map((face) => face.load()));
  for (const face of faces) document.fonts.add(face);
}
