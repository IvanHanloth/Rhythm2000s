// 游戏入口：创建画布和音频时钟，登记场景，每帧把音频时间交给当前场景。

import './style.css';
import { AudioClock } from '../audio/audio-clock.ts';
import { mac2000Scene } from '../scenes/mac-2000/scene.ts';
import { windowsXpScene } from '../scenes/windows-xp/scene.ts';
import { createDevPanel } from './dev-panel.ts';
import { GameCanvas } from './game-canvas.ts';
import { SceneDirector } from './scene-director.ts';

const host = document.querySelector<HTMLElement>('#game');
if (!host) throw new Error('找不到游戏容器 #game');

const clock = new AudioClock();
const canvas = await GameCanvas.create(host);
const director = new SceneDirector(canvas.stage, [windowsXpScene, mac2000Scene]);

// 浏览器要求在用户操作里恢复音频；恢复之前音频时间不走
const resumeAudio = () => void clock.resume();
window.addEventListener('pointerdown', resumeAudio, { once: true });
window.addEventListener('keydown', resumeAudio, { once: true });

canvas.onFrame(() => director.update({ audioTime: clock.heardNow() }));

// 网址里的 #场景标识 决定打开哪个场景，刷新后停在原场景
function sceneFromHash(): string {
  const id = decodeURIComponent(location.hash.slice(1));
  return director.entries.some((e) => e.id === id) ? id : director.entries[0]!.id;
}

const panel = createDevPanel(director.entries, (id) => {
  location.hash = id;
});
document.body.append(panel.element);

function showSceneFromHash(): void {
  const id = sceneFromHash();
  director.show(id);
  panel.setActive(id);
}

window.addEventListener('hashchange', showSceneFromHash);
showSceneFromHash();
