// Entry point: creates the canvas and audio clock, registers scenes, feeds them the audio time every frame and forwards input.
// Opens the street hub by default (title screen + level select, ADR 0005); sitting at a computer switches to the rhythm scene's canvas.

import './style.css';
import { Rectangle } from 'pixi.js';
import { AudioClock } from '@/audio/audio-clock.ts';
import { Hub, type LevelInfo } from '@/hub/hub.ts';
import { mac2000Scene } from '@/scenes/mac-2000/scene.ts';
import { windowsXpScene } from '@/scenes/windows-xp/scene.ts';
import { browserChartStore, ChartLibrary } from './chart-library.ts';
import { fetchChartFromSite, loadCharts } from './chart-loader.ts';
import { browserChartFiles } from './chart-transfer.ts';
import { CheatMode, listenForCheatCode } from './cheat.ts';
import { CheatNotice } from './cheat-notice.ts';
import { GameCanvas } from './game-canvas.ts';
import { DESIGN_HEIGHT, DESIGN_WIDTH } from './layout.ts';
import { listenForTaps } from './input.ts';
import { LevelIntro } from './level-intro.ts';
import { Mailbox } from './mailbox.ts';
import { buildLevels, editorRoute, formatBestScore, parseRoute } from './levels.ts';
import { loadBestAssisted, loadBestScore } from './records.ts';
import { SceneDirector } from './scene-director.ts';
import type { CutawayStage } from './scene.ts';
import { PlayerSettings } from './settings.ts';

const host = document.querySelector<HTMLElement>('#game');
if (!host) throw new Error('Game container #game not found');

const clock = new AudioClock();
// Prepare the canvas and charts together; charts are downloaded from public/charts/ at runtime (ADR 0003)
const [canvas, { charts: builtInCharts, errors: chartErrors }] = await Promise.all([
  GameCanvas.create(host),
  loadCharts(fetchChartFromSite(import.meta.env.BASE_URL)),
]);
for (const error of chartErrors) console.error(error);
/** Built-in charts plus the player's imported ones (doc/chart-import-export.md) */
const library = new ChartLibrary(builtInCharts, browserChartStore());
for (const error of library.loadErrors) console.error(error);
/** Calibration, "Skip tutorial" and the beat guide (doc/settings.md); the in-game settings window and H change them */
const settings = new PlayerSettings();
/** The cheat code (doc/cheat-code.md): in memory only, so a refresh ends it */
const cheat = new CheatMode();
const cheatNotice = new CheatNotice(clock.context);
cheat.onChange((active) => cheatNotice.setActive(active));
listenForCheatCode(cheat, (turnedOn) => cheatNotice.announce(turnedOn));

const scenes = [windowsXpScene, mac2000Scene];
// Load scene assets after the canvas exists (PixiJS texture loading is safer once the renderer is initialised)
await Promise.all(scenes.map(async (scene) => scene.preload?.(clock.context)));

/** URL id of the street hub; also opened when the URL names no scene */
const HUB_ROUTE = 'street';

/** The street hub, created below; chair-swivel's cutaway draws its café (doc/cross-dimension.md) */
let cafe: Hub | null = null;
/** The cutaway is showing: the game canvas sits over the café with its background cleared */
let inCutaway = false;
const cutaway: CutawayStage = {
  prepare: (sceneId) => requireHub().prepareCutaway(sceneId),
  show: (sceneId, progress, desktop) => {
    let snapshot: HTMLCanvasElement | null = null;
    if (!inCutaway) {
      inCutaway = true;
      host.classList.add('is-cutaway');
      // The desktop fills the 1280×720 stage at its own scale; captured once, as the café's monitor image
      const frame = new Rectangle(
        0,
        0,
        DESIGN_WIDTH / desktop.scale.x,
        DESIGN_HEIGHT / desktop.scale.y,
      );
      const captured = canvas.app.renderer.extract.canvas({ target: desktop, frame });
      if (!(captured instanceof HTMLCanvasElement))
        throw new Error('Desktop capture is not a canvas');
      snapshot = captured;
    }
    requireHub().renderCutaway(sceneId, progress, snapshot);
  },
  hide: () => {
    if (!inCutaway) return;
    inCutaway = false;
    host.classList.remove('is-cutaway');
    requireHub().endCutaway();
  },
};
function requireHub(): Hub {
  if (!cafe) throw new Error('The street hub is not created yet');
  return cafe;
}

const director = new SceneDirector(canvas.stage, scenes, {
  clock,
  calibration: () => settings.values.calibrationMs / 1000,
  settings,
  cheat,
  library,
  chartFiles: browserChartFiles,
  cutaway,
  overlay: host,
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

/**
 * All levels: one per chart, by scene then index order, imports last; picked in Explorer / Finder after sitting down
 * (doc/level-select.md). Rebuilt when the level list imports or deletes a chart.
 */
let levels = buildLevels(director.entries, library.charts);

/**
 * Two computers per scene in the café: one to play, whose card lists that computer's levels, and HackerEditor behind
 * it (doc/chart-editor.md). Their ids are the URL routes they open.
 */
function computerCards(): LevelInfo[] {
  const play = director.entries.map(({ id, label }): LevelInfo => {
    const own = levels.filter((level) => level.sceneId === id);
    const details = own.map((level) => `Level ${level.number}: ${level.title} (${level.bpm} BPM)`);
    if (details.length === 0) details.push('No playable levels on this machine yet.');
    return {
      id,
      sceneId: id,
      role: 'levels',
      action: 'Play',
      label,
      details,
      playable: own.length > 0,
    };
  });
  const editors = director.entries.map(({ id, label }): LevelInfo => ({
    id: editorRoute(id),
    sceneId: id,
    role: 'editor',
    action: 'Open',
    label: `HackerEditor (${label})`,
    details: [
      `Make levels for the ${label} computer.`,
      'Saved levels show up on the computer in front.',
    ],
    playable: true,
  }));
  return [...play, ...editors];
}

/** The charts played to their results window, which the scenes record; the street's second objective reads it */
const finishedCharts = new Mailbox();

const hub = new Hub({
  levels: computerCards(),
  recordOf: (computerId) => {
    const own = levels.filter((level) => level.sceneId === computerId);
    const played = own.filter((level) => loadBestScore(level.id) !== null).length;
    return own.length > 0 ? `Played: ${played} / ${own.length} levels` : null;
  },
  audio: clock.context,
  cheat,
  onCoinInserted: () => cheatNotice.playDrop(),
  playedOnce: () => finishedCharts.finishedCount > 0,
  onPlay: (computerId) => {
    location.hash = computerId;
  },
});
cafe = hub;
document.body.append(hub.element);
document.body.append(cheatNotice.element);
document.querySelector('#boot')?.remove();

library.onChange(() => {
  levels = buildLevels(director.entries, library.charts);
  hub.setLevels(computerCards());
});

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
    gameHost.style.cursor = '';
    hub.show();
    return;
  }
  hub.hide();
  canvas.app.ticker.start();
  if (route.kind === 'editor') director.show(route.sceneId, undefined, 'editor');
  else director.show(route.sceneId, route.chartId);
  // PixiJS makes the canvas inherit its container's cursor, so set it on the container
  gameHost.style.cursor = director.entries.find((e) => e.id === route.sceneId)?.cursor ?? '';
}

window.addEventListener('hashchange', showRoute);
showRoute();
