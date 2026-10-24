// Volume control, the pop-up from the tray speaker: "Volume" on top, a vertical slider with ticks on both
// sides, a "Mute" check box below. Like the original, releasing the slider should play the default beep at the
// new volume; the owner does that in onChange. Origin at the top left.

import { Container, Graphics, Rectangle, type FederatedPointerEvent } from 'pixi.js';
import { LUNA } from '@/theme/xp-luna.ts';
import { edgeRing, verticalGradient } from './draw.ts';
import { xpText } from './xp-text.ts';

export const VOLUME_CONTROL_WIDTH = 72;
export const VOLUME_CONTROL_HEIGHT = 152;
const TRACK_TOP = 32;
const TRACK_LENGTH = 82;
const TICKS = 11;
const THUMB_WIDTH = 21;
const THUMB_HEIGHT = 11;
const CHECK_SIZE = 13;

export interface VolumeControlOptions {
  /** 0–1 */
  volume: number;
  muted: boolean;
  /** Volume changed; `released` is true when the slider was let go */
  onChange?(volume: number, released: boolean): void;
  onMuteChange?(muted: boolean): void;
}

export class XpVolumeControl {
  readonly view = new Container({ label: 'volume-control' });
  readonly width = VOLUME_CONTROL_WIDTH;
  readonly height = VOLUME_CONTROL_HEIGHT;
  private readonly thumb = new Graphics();
  private readonly check = new Graphics();
  private readonly options: VolumeControlOptions;
  private volume: number;
  private muted: boolean;
  private dragging = false;
  private hot = false;

  constructor(options: VolumeControlOptions) {
    this.options = options;
    this.volume = clamp01(options.volume);
    this.muted = options.muted;
    const w = VOLUME_CONTROL_WIDTH;
    const h = VOLUME_CONTROL_HEIGHT;
    const cx = Math.round(w / 2);

    // Pop-up: beige face, dark outer shadow, light and dark inner edges
    const face = new Graphics().rect(0, 0, w, h).fill(LUNA.face);
    edgeRing(face, 0, 0, w, h, {
      top: LUNA.edgeShadow,
      left: LUNA.edgeShadow,
      right: LUNA.edgeDarkShadow,
      bottom: LUNA.edgeDarkShadow,
    });
    edgeRing(face, 1, 1, w - 2, h - 2, {
      top: LUNA.edgeHighlight,
      left: LUNA.edgeHighlight,
      right: LUNA.edgeShadow,
      bottom: LUNA.edgeShadow,
    });

    const title = xpText('Volume');
    title.anchor.set(0.5, 0);
    title.position.set(cx, 9);

    // Channel: a 4 px groove
    const track = new Graphics()
      .rect(cx - 2, TRACK_TOP, 4, TRACK_LENGTH)
      .fill(LUNA.trackbar.channelFill);
    edgeRing(track, cx - 2, TRACK_TOP, 4, TRACK_LENGTH, {
      top: LUNA.trackbar.channelDark,
      left: LUNA.trackbar.channelDark,
      right: LUNA.trackbar.channelLight,
      bottom: LUNA.trackbar.channelLight,
    });
    for (let i = 0; i < TICKS; i++) {
      const y = TRACK_TOP + Math.round((i / (TICKS - 1)) * TRACK_LENGTH);
      const long = i === 0 || i === TICKS - 1;
      const size = long ? 4 : 3;
      track.rect(cx - THUMB_WIDTH / 2 - 3 - size, y, size, 1).fill(LUNA.trackbar.tick);
      track.rect(cx + THUMB_WIDTH / 2 + 3, y, size, 1).fill(LUNA.trackbar.tick);
    }

    const slider = new Container({ label: 'slider' });
    slider.addChild(track, this.thumb);
    slider.eventMode = 'static';
    slider.hitArea = new Rectangle(cx - 18, TRACK_TOP - 8, 36, TRACK_LENGTH + 16);
    slider.on('pointerdown', (e) => this.startDrag(e, slider));
    slider.on('pointerover', () => this.setHot(true));
    slider.on('pointerout', () => this.setHot(false));

    // "Mute" check box
    const checkbox = new Container({ label: 'mute' });
    const box = new Graphics()
      .rect(0, 0, CHECK_SIZE, CHECK_SIZE)
      .fill(LUNA.checkbox.border)
      .rect(1, 1, CHECK_SIZE - 2, CHECK_SIZE - 2)
      .fill(verticalGradient(LUNA.checkbox.fill));
    const label = xpText('Mute');
    label.anchor.set(0, 0.5);
    label.position.set(CHECK_SIZE + 5, CHECK_SIZE / 2);
    checkbox.addChild(box, this.check, label);
    const checkboxWidth = CHECK_SIZE + 5 + label.width;
    checkbox.position.set(Math.round((w - checkboxWidth) / 2), h - CHECK_SIZE - 12);
    checkbox.eventMode = 'static';
    checkbox.hitArea = new Rectangle(-2, -3, checkboxWidth + 4, CHECK_SIZE + 6);
    checkbox.on('pointertap', () => this.setMuted(!this.muted, true));

    this.view.addChild(face, title, slider, checkbox);
    this.drawThumb();
    this.drawCheck();
  }

  /** Sets the slider from outside (the volume-mute action) without onChange; `dragging` turns its border orange */
  setVolume(volume: number, dragging = false): void {
    const next = clamp01(volume);
    if (next === this.volume && dragging === this.dragging) return;
    this.volume = next;
    this.dragging = dragging;
    this.drawThumb();
  }

  /** Slider centre for a volume, relative to the top left */
  thumbCenter(volume: number): { x: number; y: number } {
    return {
      x: Math.round(VOLUME_CONTROL_WIDTH / 2),
      y: TRACK_TOP + Math.round((1 - clamp01(volume)) * TRACK_LENGTH),
    };
  }

  /** Inverse of thumbCenter: the volume when the slider centre is at y */
  volumeAtY(y: number): number {
    return clamp01(1 - (y - TRACK_TOP) / TRACK_LENGTH);
  }

  setMuted(muted: boolean, notify = false): void {
    this.muted = muted;
    this.drawCheck();
    if (notify) this.options.onMuteChange?.(muted);
  }

  destroy(): void {
    this.view.destroy({ children: true });
  }

  private startDrag(event: FederatedPointerEvent, slider: Container): void {
    this.dragging = true;
    this.moveTo(event, slider);
    const move = (e: FederatedPointerEvent) => this.moveTo(e, slider);
    const end = () => {
      slider.off('globalpointermove', move);
      slider.off('pointerup', end);
      slider.off('pointerupoutside', end);
      this.dragging = false;
      this.drawThumb();
      this.options.onChange?.(this.volume, true);
    };
    slider.on('globalpointermove', move);
    slider.on('pointerup', end);
    slider.on('pointerupoutside', end);
  }

  private moveTo(event: FederatedPointerEvent, slider: Container): void {
    const { y } = event.getLocalPosition(slider);
    const volume = clamp01(1 - (y - TRACK_TOP) / TRACK_LENGTH);
    if (volume === this.volume) return;
    this.volume = volume;
    this.drawThumb();
    this.options.onChange?.(volume, false);
  }

  private setHot(hot: boolean): void {
    this.hot = hot;
    this.drawThumb();
  }

  /** A vertical slider with ticks on both sides has a flat rounded-rectangle thumb */
  private drawThumb(): void {
    const cx = Math.round(VOLUME_CONTROL_WIDTH / 2);
    const y = TRACK_TOP + Math.round((1 - this.volume) * TRACK_LENGTH);
    const x = cx - THUMB_WIDTH / 2;
    const top = y - Math.floor(THUMB_HEIGHT / 2);
    const border =
      this.hot || this.dragging ? LUNA.trackbar.thumbBorderHot : LUNA.trackbar.thumbBorder;
    this.thumb
      .clear()
      .roundRect(x, top, THUMB_WIDTH, THUMB_HEIGHT, 2)
      .fill(border)
      .roundRect(x + 1, top + 1, THUMB_WIDTH - 2, THUMB_HEIGHT - 2, 1)
      .fill(verticalGradient(LUNA.trackbar.thumbFill));
  }

  /** XP's check mark is green */
  private drawCheck(): void {
    this.check.clear();
    if (!this.muted) return;
    this.check
      .moveTo(3, 6)
      .lineTo(5.5, 8.5)
      .lineTo(10, 3.5)
      .stroke({ width: 2, color: LUNA.checkbox.check, cap: 'square', join: 'miter' });
  }
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
