// Game canvas: one PixiJS Application filling its host element.
// Scenes draw on a 1280×720 stage, scaled to fit and centred, letterboxed in black (ADR 0002).

import { Application, Container, Graphics } from 'pixi.js';
import { DESIGN_HEIGHT, DESIGN_WIDTH, fitToScreen } from './layout.ts';

const LETTERBOX_COLOR = 0x000000;

export class GameCanvas {
  readonly app: Application;
  /** The 1280×720 stage that scenes attach to */
  readonly stage: Container;

  private constructor(app: Application) {
    this.app = app;
    this.stage = new Container({ label: 'stage' });

    // Clip anything outside the stage so scenes never draw into the letterbox
    const mask = new Graphics().rect(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT).fill(0xffffff);
    this.stage.addChild(mask);
    this.stage.mask = mask;

    app.stage.addChild(this.stage);
    app.renderer.on('resize', () => this.layout());
    this.layout();
  }

  static async create(host: HTMLElement): Promise<GameCanvas> {
    const app = new Application();
    await app.init({
      resizeTo: host,
      background: LETTERBOX_COLOR,
      antialias: true,
      autoDensity: true,
      resolution: window.devicePixelRatio,
    });
    host.appendChild(app.canvas);
    return new GameCanvas(app);
  }

  /** Per-frame callback. Read the audio clock in it; never use the frame delta. */
  onFrame(callback: () => void): void {
    this.app.ticker.add(callback);
  }

  private layout(): void {
    const { width, height } = this.app.screen;
    const { scale, x, y } = fitToScreen(width, height);
    this.stage.scale.set(scale);
    this.stage.position.set(x, y);
  }
}
