// 游戏入口：创建画布和音频时钟，登记场景，每帧把音频时间交给当前场景，并转发玩家输入。

import './style.css';
import { AudioClock } from '../audio/audio-clock.ts';
import { mac2000Scene } from '../scenes/mac-2000/scene.ts';
import { windowsXpScene } from '../scenes/windows-xp/scene.ts';
import { fetchChartFromSite, loadCharts } from './chart-loader.ts';
import { createDevPanel } from './dev-panel.ts';
import { GameCanvas } from './game-canvas.ts';
import { listenForTaps } from './input.ts';
import { SceneDirector } from './scene-director.ts';
import { clampCalibrationMs, loadCalibrationMs, saveCalibrationMs } from './settings.ts';

const host = document.querySelector<HTMLElement>('#game');
if (!host) throw new Error('找不到游戏容器 #game');

const clock = new AudioClock();
// 画布和谱面同时准备；谱面从 public/charts/ 运行时下载（ADR 0003）
const [canvas, { charts, errors: chartErrors }] = await Promise.all([
  GameCanvas.create(host),
  loadCharts(fetchChartFromSite(import.meta.env.BASE_URL)),
]);
for (const error of chartErrors) console.error(error);
let calibrationMs = loadCalibrationMs();

const scenes = [windowsXpScene, mac2000Scene];
// 场景素材在画布建好之后加载（PixiJS 的纹理加载放在渲染器初始化之后更稳妥）
await Promise.all(scenes.map(async (scene) => scene.preload?.(clock.context)));

const director = new SceneDirector(canvas.stage, scenes, {
  clock,
  calibration: () => calibrationMs / 1000,
  charts,
});

// 浏览器要求在用户操作里恢复音频；恢复之前音频时间不走
const resumeAudio = () => void clock.resume();
window.addEventListener('pointerdown', resumeAudio, { once: true });
window.addEventListener('keydown', resumeAudio, { once: true });

listenForTaps(clock, host, (tap) => director.tap(tap));
canvas.onFrame(() => director.update({ audioTime: clock.heardNow() }));

// 网址里的 #场景标识 决定打开哪个场景，刷新后停在原场景
function sceneFromHash(): string {
  const id = decodeURIComponent(location.hash.slice(1));
  return director.entries.some((e) => e.id === id) ? id : director.entries[0]!.id;
}

const panel = createDevPanel({
  scenes: director.entries,
  onSelectScene: (id) => {
    location.hash = id;
  },
  calibrationMs,
  onCalibrationChange: (value) => {
    calibrationMs = clampCalibrationMs(value);
    saveCalibrationMs(calibrationMs);
    return calibrationMs;
  },
});
document.body.append(panel.element);

function showSceneFromHash(): void {
  const id = sceneFromHash();
  director.show(id);
  panel.setActive(id);
}

window.addEventListener('hashchange', showSceneFromHash);
showSceneFromHash();
