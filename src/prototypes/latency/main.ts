// Latency test prototype entry: wires the audio clock, metronome, input and view together.

import './style.css';
import { AudioClock } from '@/audio/audio-clock.ts';
import { Metronome } from '@/audio/metronome.ts';
import { nearestBeat, timeToBeat } from '@/rhythm/beat.ts';
import {
  buildStatsRows,
  INPUT_KIND_LABELS,
  INPUT_KINDS,
  METHOD_LABELS,
  type InputKind,
  type TapRecord,
} from './records.ts';
import { KIND_COLORS, LatencyView } from './view.ts';

const MIN_BPM = 60;
const MAX_BPM = 200;
/** Refresh interval of the device info panel (ms); display only */
const ENV_REFRESH_MS = 250;

function $<T extends HTMLElement>(selector: string): T {
  const el = document.querySelector<T>(selector);
  if (!el) throw new Error(`Element not found: ${selector}`);
  return el;
}

const stageEl = $<HTMLDivElement>('#stage');
const legendEl = $<HTMLUListElement>('#legend');
const bpmInput = $<HTMLInputElement>('#bpm');
const startButton = $<HTMLButtonElement>('#start');
const resetButton = $<HTMLButtonElement>('#reset');
const exportButton = $<HTMLButtonElement>('#export');
const statusEl = $<HTMLParagraphElement>('#status');
const envEl = $<HTMLDListElement>('#env');
const statsBody = $<HTMLTableSectionElement>('#stats tbody');

const clock = new AudioClock();
const metronome = new Metronome(clock);
const view = await LatencyView.create(stageEl);
const taps: TapRecord[] = [];

// ---------- Formatting ----------

function ms(value: number | null | undefined, digits = 1): string {
  return value == null || Number.isNaN(value) ? '—' : value.toFixed(digits);
}

function signedMs(value: number | null): string {
  if (value == null || Number.isNaN(value)) return '—';
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}`;
}

// ---------- Start / stop ----------

function readBpm(): number {
  const value = Math.round(Number(bpmInput.value));
  const bpm = Number.isFinite(value) ? Math.min(MAX_BPM, Math.max(MIN_BPM, value)) : 120;
  bpmInput.value = String(bpm);
  return bpm;
}

async function start(): Promise<void> {
  await clock.resume();
  metronome.start(readBpm());
  startButton.textContent = 'Stop';
  statusEl.textContent = `Playing: ${metronome.bpm} BPM, ${metronome.beatsPerBar} beats per bar (beat 1 is the high click)`;
}

function stop(reason?: string): void {
  metronome.stop();
  startButton.textContent = 'Start';
  statusEl.textContent = reason ?? 'Stopped';
}

startButton.addEventListener('click', () => {
  // Drop focus so a later Space doesn't press this button again
  startButton.blur();
  if (metronome.running) {
    stop();
  } else {
    void start();
  }
});

bpmInput.addEventListener('change', () => {
  readBpm();
  if (metronome.running) void start();
});

resetButton.addEventListener('click', () => {
  resetButton.blur();
  taps.length = 0;
  renderStats();
});

// Throttled background tabs make timing unreliable, so stop
document.addEventListener('visibilitychange', () => {
  if (document.hidden && metronome.running) {
    stop('The page went into the background, so the test stopped. Please start again.');
  }
});

// ---------- Input ----------

/**
 * event.timeStamp should share performance.now()'s timeline. Some old browsers give an epoch time or 0;
 * then the callback's performance.now() is used instead and the record says so.
 */
function resolveTimeStamp(eventTimeStamp: number): { time: number; fallback: boolean } {
  const now = performance.now();
  if (eventTimeStamp > 0 && eventTimeStamp <= now + 1) {
    return { time: eventTimeStamp, fallback: false };
  }
  return { time: now, fallback: true };
}

function recordTap(kind: InputKind, eventTimeStamp: number): void {
  if (!metronome.running) return;
  const { time, fallback } = resolveTimeStamp(eventTimeStamp);

  const heardA = clock.heardTimeA(time);
  const heardB = clock.heardTimeB(time);
  const { beat } = nearestBeat(metronome.startTime, metronome.bpm, heardA ?? heardB);
  const beatTime = metronome.beatTime(beat);

  taps.push({
    seq: taps.length,
    kind,
    eventTimeStamp: time,
    timeStampFallback: fallback,
    beat,
    offsetA: heardA == null ? null : (heardA - beatTime) * 1000,
    offsetB: (heardB - beatTime) * 1000,
    baseLatencyMs: clock.baseLatency * 1000,
    outputLatencyMs: clock.outputLatency * 1000,
  });
  renderStats();
}

function isTextField(target: EventTarget | null): boolean {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
}

window.addEventListener('keydown', (event) => {
  if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
  if (isTextField(event.target)) return;
  const isTapKey = event.code === 'Space' || /^Key[A-Z]$/.test(event.code);
  if (!isTapKey) return;
  // Keep Space from scrolling the page or pressing a button
  event.preventDefault();
  recordTap('keyboard', event.timeStamp);
});

stageEl.addEventListener('pointerdown', (event) => {
  if (event.pointerType === 'mouse' && event.button !== 0) return;
  const kind: InputKind =
    event.pointerType === 'touch' || event.pointerType === 'pen' ? event.pointerType : 'mouse';
  event.preventDefault();
  recordTap(kind, event.timeStamp);
});

stageEl.addEventListener('contextmenu', (event) => event.preventDefault());

// ---------- Panels ----------

function renderLegend(): void {
  legendEl.replaceChildren(
    ...INPUT_KINDS.map((kind) => {
      const li = document.createElement('li');
      li.textContent = INPUT_KIND_LABELS[kind];
      li.style.setProperty('--dot', `#${KIND_COLORS[kind].toString(16).padStart(6, '0')}`);
      return li;
    }),
  );
}

function renderStats(): void {
  const rows = buildStatsRows(taps);
  if (rows.length === 0) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 7;
    td.textContent = 'No taps recorded yet';
    tr.append(td);
    statsBody.replaceChildren(tr);
    return;
  }
  statsBody.replaceChildren(
    ...rows.map((row) => {
      const tr = document.createElement('tr');
      const cells = [
        INPUT_KIND_LABELS[row.kind],
        METHOD_LABELS[row.method],
        String(row.summary.count),
        signedMs(row.summary.mean),
        signedMs(row.summary.median),
        ms(row.summary.stdDev),
        signedMs(row.calibration),
      ];
      for (const text of cells) {
        const td = document.createElement('td');
        td.textContent = text;
        tr.append(td);
      }
      return tr;
    }),
  );
}

function renderEnv(): void {
  const ctx = clock.context;
  const now = performance.now();
  const stamp = clock.readOutputStamp();
  const heardA = clock.heardTimeA(now);
  const heardB = clock.heardTimeB(now);

  const entries: [string, string][] = [
    ['Browser', navigator.userAgent],
    ['Audio state', ctx.state],
    ['Sample rate', `${ctx.sampleRate} Hz`],
    ['baseLatency', `${ms(clock.baseLatency * 1000)} ms`],
    ['outputLatency', `${ms(clock.outputLatency * 1000)} ms`],
    [
      'getOutputTimestamp',
      !clock.supportsOutputTimestamp
        ? 'Not supported'
        : stamp
          ? `Available (contextTime ${stamp.contextTime.toFixed(3)} s)`
          : 'No valid value yet (audio not started)',
    ],
    ['Method A − method B', heardA == null ? '—' : `${signedMs((heardA - heardB) * 1000)} ms`],
    ['Taps', String(taps.length)],
  ];

  envEl.replaceChildren(
    ...entries.flatMap(([label, value]) => {
      const dt = document.createElement('dt');
      dt.textContent = label;
      const dd = document.createElement('dd');
      dd.textContent = value;
      return [dt, dd];
    }),
  );
}

// ---------- Export ----------

exportButton.addEventListener('click', () => {
  exportButton.blur();
  const ctx = clock.context;
  const data = {
    exportedAt: new Date().toISOString(),
    userAgent: navigator.userAgent,
    sampleRate: ctx.sampleRate,
    baseLatencyMs: clock.baseLatency * 1000,
    outputLatencyMs: clock.outputLatency * 1000,
    supportsOutputTimestamp: clock.supportsOutputTimestamp,
    bpm: metronome.bpm,
    beatsPerBar: metronome.beatsPerBar,
    stats: buildStatsRows(taps),
    taps,
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `latency-${data.exportedAt.replace(/[:.]/g, '-')}.json`;
  link.click();
  URL.revokeObjectURL(url);
});

// ---------- Every frame ----------

let lastEnvRefresh = -Infinity;

view.onFrame(() => {
  metronome.schedule();

  const beatPosition = metronome.running
    ? timeToBeat(metronome.startTime, metronome.bpm, clock.heardNow())
    : null;
  view.update({ beatPosition, beatsPerBar: metronome.beatsPerBar, taps });

  const now = performance.now();
  if (now - lastEnvRefresh >= ENV_REFRESH_MS) {
    lastEnvRefresh = now;
    renderEnv();
  }
});

renderLegend();
renderStats();
renderEnv();
