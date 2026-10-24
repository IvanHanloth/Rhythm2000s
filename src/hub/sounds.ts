// 大厅的声音：坐到电脑前时，XP 机器响 XP 的登录声，iMac 响经典 Mac 的开机和弦（原版素材，ADR 0004）。
// 用到时才下载、解码，之后缓存。音频上下文和节奏关卡共用同一个。

import xpLogonUrl from '../../assets/reference/windows-xp/sounds/Windows XP Logon Sound.wav?url';
import macChimeUrl from '../../assets/reference/mac-os-classic/sounds/Startup Chime.mp3?url';

const STARTUP_URLS: Record<string, string> = {
  'windows-xp': xpLogonUrl,
  'mac-2000': macChimeUrl,
};

const VOLUME = 0.55;

export class HubSounds {
  private readonly audio: AudioContext;
  private readonly cache = new Map<string, Promise<AudioBuffer | null>>();

  constructor(audio: AudioContext) {
    this.audio = audio;
  }

  /** 这个场景的电脑「开机」；没有对应的声音或下载失败时什么都不做 */
  playStartup(sceneId: string): void {
    const url = STARTUP_URLS[sceneId];
    if (!url) return;
    void this.load(url).then((buffer) => {
      if (!buffer) return;
      const source = this.audio.createBufferSource();
      const gain = this.audio.createGain();
      gain.gain.value = VOLUME;
      source.buffer = buffer;
      source.connect(gain).connect(this.audio.destination);
      source.start();
    });
  }

  private load(url: string): Promise<AudioBuffer | null> {
    let promise = this.cache.get(url);
    if (!promise) {
      promise = fetch(url)
        .then((response) => response.arrayBuffer())
        .then((data) => this.audio.decodeAudioData(data))
        .catch((error: unknown) => {
          console.warn(`大厅音效 ${url} 加载失败`, error);
          return null;
        });
      this.cache.set(url, promise);
    }
    return promise;
  }
}
