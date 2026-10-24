// 游戏画布：一个 PixiJS Application，铺满宿主元素。
// 场景画在 1280×720 的「舞台」上，舞台等比缩放后居中，四周留黑边（ADR 0002）。

import { Application, Container, Graphics } from 'pixi.js';
import { DESIGN_HEIGHT, DESIGN_WIDTH, fitToScreen } from './layout.ts';

/** 舞台以外的黑边颜色 */
const LETTERBOX_COLOR = 0x000000;

export class GameCanvas {
  readonly app: Application;
  /** 1280×720 的舞台，场景画面挂在这里 */
  readonly stage: Container;

  private constructor(app: Application) {
    this.app = app;
    this.stage = new Container({ label: 'stage' });

    // 裁掉超出舞台的部分，避免场景画进黑边
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

  /** 每帧回调。回调里只读取音频时钟，不使用帧间隔。 */
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
