// A DOM iframe kept over a rectangle of the canvas (ADR 0014): the canvas can't draw web content, so the Rickroll's
// YouTube player is a real iframe that follows a PixiJS container. Call update() every frame; it reads the container's
// place on the canvas, which shares its box with the overlay element (SceneContext.overlay).

import type { Container } from 'pixi.js';

export interface VideoEmbedOptions {
  /** Element covering the canvas, the iframe's parent */
  overlay: HTMLElement;
  /** iframe address */
  src: string;
  /** Accessible name of the iframe */
  title: string;
  /** Container the player covers, from its (0, 0) to (width, height) in its own coordinates */
  target: Container;
  width: number;
  height: number;
}

export class VideoEmbed {
  private readonly frame = document.createElement('iframe');
  private readonly target: Container;
  private readonly width: number;
  private readonly height: number;

  constructor({ overlay, src, title, target, width, height }: VideoEmbedOptions) {
    this.target = target;
    this.width = width;
    this.height = height;
    const frame = this.frame;
    frame.src = src;
    frame.title = title;
    frame.allow = 'autoplay; encrypted-media; picture-in-picture';
    frame.allowFullscreen = true;
    frame.referrerPolicy = 'strict-origin-when-cross-origin';
    Object.assign(frame.style, {
      position: 'absolute',
      border: '0',
      zIndex: '1',
      background: '#000',
    });
    overlay.append(frame);
    this.update();
  }

  /** Lines the iframe up with the target; hidden while the target isn't shown */
  update(): void {
    const style = this.frame.style;
    if (!this.target.visible || this.target.destroyed) {
      style.display = 'none';
      return;
    }
    const topLeft = this.target.toGlobal({ x: 0, y: 0 });
    const bottomRight = this.target.toGlobal({ x: this.width, y: this.height });
    style.display = 'block';
    style.left = `${topLeft.x}px`;
    style.top = `${topLeft.y}px`;
    style.width = `${bottomRight.x - topLeft.x}px`;
    style.height = `${bottomRight.y - topLeft.y}px`;
  }

  destroy(): void {
    this.frame.remove();
  }
}
