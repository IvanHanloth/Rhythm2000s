// HackerEditor's opening (doc/chart-editor.md "Decided"): a black screen where "Welcome Back Hacker" is typed out
// letter by letter in green, with a key click per letter, then the black screen fades out to the desktop with
// HackerEditor open. It covers the whole canvas, and keeps covering it (fading) until onDone, so the desktop behind
// can't be clicked mid-fade.
// It has nothing to do with the beat, so it runs on wall-clock time (performance.now) read every frame, which keeps
// going while the audio clock waits for a user gesture. The key clicks are still booked on the audio clock: on the first
// frame it runs, every letter still to come gets its click at the audio time heard when that letter appears; letters
// already shown by then stay silent rather than click late.

import { Container, Graphics, Text } from 'pixi.js';
import type { AudioClock } from '@/audio/audio-clock.ts';
import { createKeystroke } from '@/audio/synth.ts';
import { DESIGN_HEIGHT, DESIGN_WIDTH } from '@/game/layout.ts';
import { clamp01, easeOutCubic } from './easing.ts';

export const WELCOME_TEXT = 'Welcome Back Hacker';

/** Provisional timing (ms): a pause on the black screen, each letter, the hold on the finished line, and the fade out */
const START_MS = 400;
const LETTER_MS = 75;
const HOLD_MS = 1100;
const FADE_MS = 500;
const FADE_START_MS = START_MS + WELCOME_TEXT.length * LETTER_MS + HOLD_MS;
const CURSOR_BLINK_MS = 530;
/** Body pitches (Hz) of the letter keys, taken in turn so the clicks don't all sound the same, and the space bar */
const KEY_BODIES = [430, 490, 455, 520];
const SPACE_BODY = 250;
const GREEN = '#33ff66';

export interface HackerIntroOptions {
  clock: AudioClock;
  /** Where the key clicks go */
  output: AudioNode;
  onDone: () => void;
}

export class HackerIntro {
  readonly view = new Container({ label: 'hacker-intro' });
  private readonly line: Text;
  private readonly cursor: Graphics;
  private readonly started = performance.now();
  private readonly clock: AudioClock;
  private readonly output: AudioNode;
  private readonly keys: AudioBuffer[];
  private readonly space: AudioBuffer;
  /** The key clicks, once booked */
  private booked: AudioBufferSourceNode[] | null = null;
  private readonly onDone: () => void;
  private done = false;

  constructor({ clock, output, onDone }: HackerIntroOptions) {
    const audio = clock.context;
    this.clock = clock;
    this.output = output;
    this.onDone = onDone;
    this.keys = KEY_BODIES.map((body) => createKeystroke(audio, { body }));
    this.space = createKeystroke(audio, { body: SPACE_BODY, gain: 0.6 });
    const black = new Graphics().rect(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT).fill('#000000');
    black.eventMode = 'static';
    this.line = new Text({
      text: WELCOME_TEXT,
      style: {
        fontFamily: ['Lucida Console', 'Courier New', 'monospace'],
        fontSize: 44,
        fill: GREEN,
        dropShadow: { color: GREEN, alpha: 0.6, blur: 8, distance: 0, angle: 0 },
      },
    });
    // Measure the whole line once so it stays put as letters appear
    const width = this.line.width;
    this.line.anchor.set(0, 0.5);
    this.line.position.set(Math.round((DESIGN_WIDTH - width) / 2), DESIGN_HEIGHT / 2);
    this.line.text = '';
    this.cursor = new Graphics().rect(0, -24, 24, 48).fill(GREEN);
    this.cursor.y = DESIGN_HEIGHT / 2;
    this.view.addChild(black, this.line, this.cursor);
  }

  /** Call every frame; calls onDone once the line has been shown long enough and faded out */
  update(): void {
    if (this.done) return;
    if (!this.booked && this.clock.context.state === 'running') this.booked = this.bookKeys();
    const elapsed = performance.now() - this.started;
    const letters = Math.max(
      0,
      Math.min(WELCOME_TEXT.length, Math.floor((elapsed - START_MS) / LETTER_MS) + 1),
    );
    this.line.text = elapsed < START_MS ? '' : WELCOME_TEXT.slice(0, letters);
    this.cursor.x = this.line.x + this.line.width + 4;
    const typing = elapsed >= START_MS && letters < WELCOME_TEXT.length;
    this.cursor.visible = typing || Math.floor(elapsed / CURSOR_BLINK_MS) % 2 === 0;
    const fade = clamp01((elapsed - FADE_START_MS) / FADE_MS);
    this.view.alpha = 1 - easeOutCubic(fade);
    if (fade >= 1) {
      this.done = true;
      this.onDone();
    }
  }

  /** Books the key click of every letter still to come at the audio time heard when that letter appears */
  private bookKeys(): AudioBufferSourceNode[] {
    const audio = this.clock.context;
    const now = performance.now();
    const heardNow = this.clock.heardNow();
    const booked: AudioBufferSourceNode[] = [];
    for (let index = 0; index < WELCOME_TEXT.length; index++) {
      const when = heardNow + (this.started + START_MS + index * LETTER_MS - now) / 1000;
      if (when < audio.currentTime) continue;
      const source = audio.createBufferSource();
      source.buffer =
        WELCOME_TEXT[index] === ' ' ? this.space : this.keys[index % this.keys.length]!;
      source.connect(this.output);
      source.start(when);
      booked.push(source);
    }
    return booked;
  }

  destroy(): void {
    for (const source of this.booked ?? []) source.stop();
    this.view.destroy({ children: true });
  }
}
