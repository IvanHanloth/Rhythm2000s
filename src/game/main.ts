// Entry point: creates the canvas and audio clock, registers scenes, feeds them the audio time every frame and forwards input.
// Opens the street hub by default (title screen + level select, ADR 0005); sitting at a computer switches to the rhythm scene's canvas.

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
import { buildLevels, formatBestScore, parseRoute } from './levels.ts';
import { loadBestScore } from './records.ts';
import { SceneDirector } from './scene-director.ts';
import {
  clampCalibrationMs,
  loadCalibrationMs,
  loadSkipTutorial,
  saveCalibrationMs,
  saveSkipTutorial,
} from './settings.ts';

const host = document.querySelector<HTMLElement>('#game');
if (!host) throw new Error('Game container #game not found');

const clock = new AudioClock();
// Prepare the canvas and charts together; charts are downloaded from public/charts/ at runtime (ADR 0003)
const [canvas, { charts, errors: chartErrors }] = await Promise.all([
  GameCanvas.create(host),
  loadCharts(fetchChartFromSite(import.meta.env.BASE_URL)),
]);
for (const error of chartErrors) console.error(error);
let calibrationMs = loadCalibrationMs();

const scenes = [windowsXpScene, mac2000Scene];
// Load scene assets after the canvas exists (PixiJS texture loading is safer once the renderer is initialised)
await Promise.all(scenes.map(async (scene) => scene.preload?.(clock.context)));

/** URL id of the street hub; also opened when the URL names no scene */
const HUB_ROUTE = 'street';

const director = new SceneDirector(canvas.stage, scenes, {
  clock,
  calibration: () => calibrationMs / 1000,
  charts,
  leave: () => {
    location.hash = HUB_ROUTE;
  },
});

// Browsers only resume audio inside a user gesture; audio time stands still until then
const resumeAudio = () => void clock.resume();
window.addEventListener('pointerdown', resumeAudio, { once: true });
window.addEventListener('keydown', resumeAudio, { once: true });

listenForTaps(
  clock,
  host,
  (tap) => director.tap(tap),
  (tap) => director.release(tap),
);
canvas.onFrame(() => director.update({ audioTime: clock.heardNow() }));

const sceneIds = director.entries.map((e) => e.id);

/** All levels: one per chart, by scene then index order; picked in Explorer / Finder after sitting down (doc/level-select.md) */
const levels = buildLevels(director.entries, charts);

/** This level was entered by sitting down in the café. Opened from a URL, Esc also goes to the café, but the hub starts at the title screen */
let cameFromHub = false;

// One computer per scene in the café: the card after sitting down lists that computer's levels
const hub = new Hub({
  levels: director.entries.map(({ id, label }) => {
    const own = levels.filter((level) => level.sceneId === id);
    const details = own.map((level) => `Level ${level.number}: ${level.title} (${level.bpm} BPM)`);
    if (details.length === 0) details.push('No playable levels on this machine yet.');
    return { id, sceneId: id, label, details, playable: own.length > 0 };
  }),
  recordOf: (sceneId) => {
    const own = levels.filter((level) => level.sceneId === sceneId);
    const played = own.filter((level) => loadBestScore(level.id) !== null).length;
    return own.length > 0 ? `Played: ${played} / ${own.length} levels` : null;
  },
  audio: clock.context,
  onPlay: (sceneId) => {
    // Esc inside the computer goes back to the café
    cameFromHub = true;
    location.hash = sceneId;
  },
});
document.body.append(hub.element);
document.querySelector('#boot')?.remove();

const intro = new LevelIntro();
document.body.append(intro.element);

/** Before a scene starts a level: show that level's intro */
director.setIntroduce((chartId) => {
  const level = levels.find((l) => l.id === chartId);
  if (!level) return;
  intro.show({
    sceneId: level.sceneId,
    kicker: `${level.sceneLabel} · Level ${level.number}`,
    title: level.title,
    bpm: level.bpm,
    actions: level.actions,
    record: formatBestScore(loadBestScore(level.id)),
  });
});

const backHint = document.createElement('div');
backHint.className = 'back-hint';
backHint.textContent = 'Esc: back to the café';
backHint.hidden = true;
document.body.append(backHint);

window.addEventListener('keydown', (event) => {
  if (event.code !== 'Escape' || parseRoute(location.hash, sceneIds).kind === 'hub') return;
  intro.hide();
  // Inside a level Esc goes back to the level list first; Esc on the list goes to the street (doc/level-select.md)
  if (!director.escape()) location.hash = HUB_ROUTE;
});

const panel = createDevPanel({
  scenes: [{ id: HUB_ROUTE, label: 'Street (title / level select)' }, ...director.entries],
  onSelectScene: (id) => {
    location.hash = id;
  },
  calibrationMs,
  onCalibrationChange: (value) => {
    calibrationMs = clampCalibrationMs(value);
    saveCalibrationMs(calibrationMs);
    return calibrationMs;
  },
  skipTutorial: loadSkipTutorial(),
  onSkipTutorialChange: saveSkipTutorial,
});
document.body.append(panel.element);

const gameHost: HTMLElement = host;

// The URL's #scene or #scene/chart decides where to go, so a refresh stays put
function showRoute(): void {
  const route = parseRoute(location.hash, sceneIds);
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
  // PixiJS makes the canvas inherit its container's cursor, so set it on the container
  gameHost.style.cursor = director.entries.find((e) => e.id === route.sceneId)?.cursor ?? '';
  backHint.hidden = false;
  backHint.textContent = cameFromHub ? 'Esc: back to the café' : 'Esc: back to the street';
  // Only for this one entry: later entries from the dev panel or a URL don't count
  cameFromHub = false;
}

window.addEventListener('hashchange', showRoute);
showRoute();
