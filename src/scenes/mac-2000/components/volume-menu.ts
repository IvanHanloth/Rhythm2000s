// 菜单栏音量小工具（NSMenuExtra，Volume.menu）点开后垂下的窄菜单：里面是一根竖向滑块，
// 灰色凹槽、蓝色果冻圆钮。只是画面，不改游戏的实际音量。原点在菜单左上角（贴着菜单栏下沿）。
// 另有 drawSpeakerIcon()：菜单栏上的黑色小喇叭。

import { Container, Graphics } from 'pixi.js';
import { AQUA } from '@/theme/aqua.ts';
import { drawGelBall, drawWindowShadow, hGradient, stripes } from './paint.ts';

export const VOLUME_MENU_WIDTH = 30;
const HEIGHT = 128;
const TRACK_TOP = 14;
const TRACK_BOTTOM = HEIGHT - 14;
const TRACK_WIDTH = 5;
const KNOB_RADIUS = 7;
const RADIUS = 5;

export class VolumeMenu {
  readonly view = new Container({ label: 'volume-menu' });
  readonly width = VOLUME_MENU_WIDTH;
  readonly height = HEIGHT;
  private readonly knob: Graphics;
  private readonly fill: Graphics;

  constructor() {
    const cx = VOLUME_MENU_WIDTH / 2;
    const body = new Graphics()
      .moveTo(0, 0)
      .lineTo(VOLUME_MENU_WIDTH, 0)
      .lineTo(VOLUME_MENU_WIDTH, HEIGHT - RADIUS)
      .arcTo(VOLUME_MENU_WIDTH, HEIGHT, VOLUME_MENU_WIDTH - RADIUS, HEIGHT, RADIUS)
      .lineTo(RADIUS, HEIGHT)
      .arcTo(0, HEIGHT, 0, HEIGHT - RADIUS, RADIUS)
      .closePath()
      .fill({ fill: stripes(AQUA.menuStripe), alpha: AQUA.menu.alpha })
      .stroke({ width: 1, color: AQUA.menu.edge, alpha: 0.35, alignment: 1 });
    const track = new Graphics()
      .roundRect(cx - TRACK_WIDTH / 2, TRACK_TOP, TRACK_WIDTH, TRACK_BOTTOM - TRACK_TOP, 2.5)
      .fill(
        hGradient([
          [0, AQUA.slider.trackDark],
          [1, AQUA.slider.trackLight],
        ]),
      );
    // 滑钮以下的凹槽是蓝色（已有的音量）
    this.fill = new Graphics();
    this.knob = drawGelBall(new Graphics(), 0, 0, KNOB_RADIUS, AQUA.slider.knob);
    this.view.addChild(
      drawWindowShadow(VOLUME_MENU_WIDTH, HEIGHT, 0.4),
      body,
      track,
      this.fill,
      this.knob,
    );
    this.setLevel(1);
  }

  /** 滑块位置：0 在底，1 在顶 */
  setLevel(level: number): void {
    const center = this.knobCenter(level);
    this.knob.position.set(center.x, center.y);
    const cx = VOLUME_MENU_WIDTH / 2;
    this.fill
      .clear()
      .roundRect(cx - TRACK_WIDTH / 2, center.y, TRACK_WIDTH, TRACK_BOTTOM - center.y, 2.5)
      .fill({ color: AQUA.slider.knob.dark, alpha: 0.8 });
  }

  /** 滑钮中心（菜单自己的坐标） */
  knobCenter(level: number): { x: number; y: number } {
    const clamped = Math.min(1, Math.max(0, level));
    const top = TRACK_TOP + KNOB_RADIUS - 2;
    const bottom = TRACK_BOTTOM - KNOB_RADIUS + 2;
    return { x: VOLUME_MENU_WIDTH / 2, y: bottom + (top - bottom) * clamped };
  }

  destroy(): void {
    this.view.destroy({ children: true });
  }
}

/**
 * 菜单栏的小喇叭：喇叭本体加三道声波；muted 时没有声波。白色版本用在菜单打开时的蓝色标题底上。
 * 左上角在 (0, 0)，大约 18×16。
 */
export function drawSpeakerIcon({ muted = false, white = false } = {}): Graphics {
  const color = white ? AQUA.white : AQUA.ink;
  const g = new Graphics({ label: 'speaker-icon' })
    .poly([1, 6, 4, 6, 8, 2, 8, 14, 4, 10, 1, 10])
    .fill(color);
  if (!muted) {
    for (const r of [3, 6, 9]) {
      g.arc(8, 8, r, -Math.PI / 4, Math.PI / 4);
      g.stroke({ width: 1.3, color });
    }
  }
  return g;
}
