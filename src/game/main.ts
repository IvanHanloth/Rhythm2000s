// Entry point: creates the canvas and audio clock, registers scenes, feeds them the audio time every frame and forwards input.
// Opens the street hub by default (title screen + level select, ADR 0005); sitting at a computer switches to the rhythm scene's canvas.

import './style.css';
import { AudioClock } from '@/audio/audio-clock.ts';
import { Hub } from '@/hub/hub.ts';
import { mac2000Scene } from '@/scenes/mac-2000/scene.ts';
import { windowsXpScene } from '@/scenes/windows-xp/scene.ts';
import { fetchChartFromSite, loadCharts } from './chart-loader.ts';
import { GameCanvas } from './game-canvas.ts';
import { listenForTaps } from './input.ts';
import { LevelIntro } from './level-intro.ts';
import { buildLevels, formatBestScore, parseRoute } from './levels.ts';
import { loadBestAssisted, loadBestScore } from './records.ts';
import { SceneDirector } from './scene-director.ts';
import { PlayerSettings } from './settings.ts';

const host = document.querySelector<HTMLElement>('#game');
if (!host) throw new Error('Game container #game not found');

const clock = new AudioClock();
// Prepare the canvas and charts together; charts are downloaded from public/charts/ at runtime (ADR 0003)
const [canvas, { charts, errors: chartErrors }] = await Promise.all([
  GameCanvas.create(host),
  loadCharts(fetchChartFromSite(import.meta.env.BASE_URL)),
]);
for (const error of chartErrors) console.error(error);
/** Calibration, "Skip tutorial" and the beat guide (doc/settings.md); the in-game settings window and H change them */
const settings = new PlayerSettings();

const scenes = [windowsXpScene, mac2000Scene];
// Load scene assets after the canvas exists (PixiJS texture loading is safer once the renderer is initialised)
await Promise.all(scenes.map(async (scene) => scene.preload?.(clock.context)));

/** URL id of the street hub; also opened when the URL names no scene */
const HUB_ROUTE = 'street';

const director = new SceneDirector(canvas.stage, scenes, {
  clock,
  calibration: () => settings.values.calibrationMs / 1000,
  settings,
  charts,
  leave: () => {
    location.hash = HUB_ROUTE;
  },
});

// Browsers only resume audio inside a user gesture; audio time stands still until then
const resumeAudio = () => void clock.resume();
window.addEventListener('pointerdown', resumeAudio, { once: true });
window.addEventListener('keydown', resumeAudio, { once: true });

listenForTaps(clock, host, (tap) => director.tap(tap));
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
    record: formatBestScore(loadBestScore(level.id), loadBestAssisted(level.id)),
  });
});

const backHint = document.createElement('div');
backHint.className = 'back-hint';
backHint.hidden = true;
document.body.append(backHint);
/** Where Esc goes; the hint also shows the beat guide toggle */
let backLabel = 'Esc: back to the café';
function renderBackHint(): void {
  backHint.textContent = `${backLabel} · H: Beat Guide ${settings.values.beatGuide ? 'on' : 'off'}`;
}
settings.onChange(renderBackHint);

// H toggles the beat guide in a level; ignored on the street, where it could clash with the controls
window.addEventListener('keydown', (event) => {
  if (event.code !== 'KeyH' || event.repeat) return;
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement)
    return;
  if (parseRoute(location.hash, sceneIds).kind === 'hub') return;
  settings.setBeatGuide(!settings.values.beatGuide);
});

window.addEventListener('keydown', (event) => {
  if (event.code !== 'Escape' || parseRoute(location.hash, sceneIds).kind === 'hub') return;
  intro.hide();
  // Inside a level Esc goes back to the level list first; Esc on the list goes to the street (doc/level-select.md)
  if (!director.escape()) location.hash = HUB_ROUTE;
});

const gameHost: HTMLElement = host;

// The URL's #scene or #scene/chart decides where to go, so a refresh stays put
function showRoute(): void {
  const route = parseRoute(location.hash, sceneIds);
  intro.hide();
  if (route.kind === 'hub') {
    director.clear();
    canvas.app.ticker.stop();
    backHint.hidden = true;
    gameHost.style.cursor = '';
    hub.show();
    return;
  }
  hub.hide();
  canvas.app.ticker.start();
  director.show(route.sceneId, route.chartId);
  // PixiJS makes the canvas inherit its container's cursor, so set it on the container
  gameHost.style.cursor = director.entries.find((e) => e.id === route.sceneId)?.cursor ?? '';
  backHint.hidden = false;
  backLabel = cameFromHub ? 'Esc: back to the café' : 'Esc: back to the street';
  renderBackHint();
  // Only for this one entry: later entries from a URL don't count
  cameFromHub = false;
}

window.addEventListener('hashchange', showRoute);
showRoute();
