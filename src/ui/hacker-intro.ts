// HackerEditor's opening (doc/chart-editor.md "Decided"): a black screen where "Welcome Back Hacker" is typed out
// letter by letter in green, then it cuts to the desktop with HackerEditor open. It covers the whole canvas.
// It has nothing to do with the beat, so it runs on wall-clock time (performance.now) read every frame, which keeps
// going while the audio clock waits for a user gesture.

import { Container, Graphics, Text } from 'pixi.js';
import { DESIGN_HEIGHT, DESIGN_WIDTH } from '@/game/layout.ts';

export const WELCOME_TEXT = 'Welcome Back Hacker';

/** Provisional timing (ms): a pause on the black screen, each letter, and the hold on the finished line */
const START_MS = 400;
const LETTER_MS = 75;
const HOLD_MS = 1100;
const CURSOR_BLINK_MS = 530;
const GREEN = '#33ff66';

export class HackerIntro {
  readonly view = new Container({ label: 'hacker-intro' });
  private readonly line: Text;
  private readonly cursor: Graphics;
  private readonly started = performance.now();
  private readonly onDone: () => void;
  private done = false;

  constructor(onDone: () => void) {
    this.onDone = onDone;
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

  /** Call every frame; calls onDone once the line has been shown long enough */
  update(): void {
    if (this.done) return;
    const elapsed = performance.now() - this.started;
    const letters = Math.max(
      0,
      Math.min(WELCOME_TEXT.length, Math.floor((elapsed - START_MS) / LETTER_MS) + 1),
    );
    this.line.text = elapsed < START_MS ? '' : WELCOME_TEXT.slice(0, letters);
    this.cursor.x = this.line.x + this.line.width + 4;
    const typing = elapsed >= START_MS && letters < WELCOME_TEXT.length;
    this.cursor.visible = typing || Math.floor(elapsed / CURSOR_BLINK_MS) % 2 === 0;
    if (elapsed >= START_MS + WELCOME_TEXT.length * LETTER_MS + HOLD_MS) {
      this.done = true;
      this.onDone();
    }
  }

  destroy(): void {
    this.view.destroy({ children: true });
  }
}
