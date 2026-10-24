// 游戏入口：创建画布和音频时钟，登记场景，每帧把音频时间交给当前场景，并转发玩家输入。
// 默认打开街区大厅（开始界面 + 选关，ADR 0005）；在网吧里坐下开始关卡后切到节奏场景的画布。

import './style.css';
import { AudioClock } from '../audio/audio-clock.ts';
import { Hub } from '../hub/hub.ts';
import { mac2000Scene } from '../scenes/mac-2000/scene.ts';
import { windowsXpScene } from '../scenes/windows-xp/scene.ts';
import { fetchChartFromSite, loadCharts } from './chart-loader.ts';
import { createDevPanel } from './dev-panel.ts';
import { GameCanvas } from './game-canvas.ts';
import { listenForTaps } from './input.ts';
import { LevelIntro } from './level-intro.ts';
import { buildLevels, formatRecord, levelRoute, nextLevel, parseRoute } from './levels.ts';
import { isBetter, loadRecords, saveResult } from './records.ts';
import { ResultsScreen } from './results-screen.ts';
import { summarize } from './round-summary.ts';
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

/** 街区大厅的网址标识；网址里没有写场景时也打开大厅 */
const HUB_ROUTE = 'street';
const sceneIds = director.entries.map((e) => e.id);

/** 全部关卡：一首谱面一关，网吧里一关一台电脑 */
const levels = buildLevels(director.entries, charts);
let records = loadRecords();
const recordOf = (id: string): string | null => {
  const best = records[id];
  return best ? formatRecord(best) : null;
};

/** 当前关卡是从网吧坐下进来的；直接用网址打开时按 Esc 也回网吧，但大厅从开始界面开始 */
let cameFromHub = false;

const hub = new Hub({
  levels: levels.map((level) => ({
    id: level.id,
    sceneId: level.sceneId,
    label: level.title,
    details: [
      `${level.sceneLabel} · 第 ${level.number} 关`,
      `速度：${level.bpm} BPM`,
      `部件：${level.actions}`,
    ],
    playable: true,
  })),
  recordOf,
  audio: clock.context,
  onPlay: (levelId) => {
    const level = levels.find((l) => l.id === levelId);
    if (!level) return;
    // 进关卡后按 Esc 回到网吧
    cameFromHub = true;
    location.hash = levelRoute(level);
  },
});
document.body.append(hub.element);
document.querySelector('#boot')?.remove();

const intro = new LevelIntro();
document.body.append(intro.element);

/** 结算页的「重试」：交给当前这一局的场景 */
let retryRound: (() => void) | null = null;
let lastResult: { chartId: string } | null = null;
const results = new ResultsScreen({
  onRetry: () => {
    results.hide();
    retryRound?.();
  },
  onSelect: () => {
    results.hide();
    location.hash = HUB_ROUTE;
  },
  onNext: () => {
    const next = lastResult && nextLevel(levels, lastResult.chartId);
    if (!next) return;
    results.hide();
    location.hash = levelRoute(next);
  },
});
document.body.append(results.element);

/** 场景一局结束：记成绩、显示结算页 */
director.setFinishRound((result, retry) => {
  const before = records[result.chartId];
  const summary = summarize(result);
  records = saveResult(result.chartId, summary.counts);
  retryRound = retry;
  lastResult = result;
  results.show({
    sceneId: result.sceneId,
    title: result.title,
    summary,
    newRecord: before !== undefined && isBetter(summary.counts, before),
    nextTitle: nextLevel(levels, result.chartId)?.title ?? null,
  });
});

const backHint = document.createElement('div');
backHint.className = 'back-hint';
backHint.textContent = 'Esc 回到网吧';
backHint.hidden = true;
document.body.append(backHint);

window.addEventListener('keydown', (event) => {
  if (event.code === 'Escape' && parseRoute(location.hash, sceneIds).kind !== 'hub') {
    location.hash = HUB_ROUTE;
  }
});

const panel = createDevPanel({
  scenes: [{ id: HUB_ROUTE, label: '街区（开始 / 选关）' }, ...director.entries],
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

const gameHost: HTMLElement = host;

// 网址里的 #场景 或 #场景/谱面 决定打开哪里，刷新后停在原处
function showRoute(): void {
  const route = parseRoute(location.hash, sceneIds);
  results.hide();
  intro.hide();
  if (route.kind === 'hub') {
    panel.setActive(HUB_ROUTE);
    director.clear();
    canvas.app.ticker.stop();
    backHint.hidden = true;
    gameHost.style.cursor = '';
    hub.show();
    return;
  }
  panel.setActive(route.sceneId);
  hub.hide();
  canvas.app.ticker.start();
  director.show(route.sceneId, route.chartId);
  // PixiJS 默认让画布继承容器的指针，所以设在容器上
  gameHost.style.cursor = director.entries.find((e) => e.id === route.sceneId)?.cursor ?? '';
  backHint.hidden = false;
  backHint.textContent = cameFromHub ? 'Esc 回到网吧' : 'Esc 回到街区';
  // 只对这一次进关卡有效：之后从开发面板或网址直接进来的不算
  cameFromHub = false;

  const level = levels.find((l) => l.id === route.chartId && l.sceneId === route.sceneId);
  if (level) {
    intro.show({
      sceneId: level.sceneId,
      kicker: `${level.sceneLabel} · 第 ${level.number} 关`,
      title: level.title,
      bpm: level.bpm,
      actions: level.actions,
      record: recordOf(level.id),
    });
  }
}

window.addEventListener('hashchange', showRoute);
showRoute();
