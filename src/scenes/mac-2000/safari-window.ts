// Safari 1.0 for the Rickroll easter egg (doc/easter-eggs.md), opened by the link in the 4chan message: an Aqua window
// (the original's brushed metal is left out) with Back / Forward, the address field and a Google field around the
// shared pages (src/ui/rickroll-pages.ts). The title and address follow the page. The toolbar is decoration; the red
// button closes the window. Origin at the centre.

import { Container, Graphics, type Text } from 'pixi.js';
import type { BrowserWindowOptions } from '@/scenes/shared/level-scene.ts';
import { AQUA } from '@/theme/aqua.ts';
import { RickrollPages, THREAD_PAGE, type PageInfo } from '@/ui/rickroll-pages.ts';
import { aquaText, drawGelPill } from './components/paint.ts';
import { AquaWindow } from './components/window.ts';
import { closeHit } from './mail-window.ts';

const WIDTH = 820;
const HEIGHT = 470;
const TOOLBAR_HEIGHT = 34;
const GOOGLE_WIDTH = 150;

export class MacSafariWindow {
  readonly view: Container;
  private readonly window: AquaWindow;
  private readonly pages: RickrollPages;
  private readonly address: Text;

  constructor({ overlay, onClose }: BrowserWindowOptions) {
    this.window = new AquaWindow({
      title: THREAD_PAGE.title,
      width: WIDTH,
      height: HEIGHT,
      content: 'white',
      toolbarHeight: TOOLBAR_HEIGHT,
      growBox: false,
    });
    this.view = this.window.view;
    this.view.addChild(closeHit(this.window, onClose));

    const bar = new Container({ label: 'safari-toolbar' });
    bar.addChild(arrowButton(10, 'back'), arrowButton(40, 'forward'));
    const fieldLeft = 76;
    const fieldWidth = WIDTH - fieldLeft - GOOGLE_WIDTH - 24;
    bar.addChild(field(fieldLeft, fieldWidth, 4));
    this.address = aquaText(THREAD_PAGE.url, { size: 12 });
    this.address.anchor.set(0, 0.5);
    this.address.position.set(fieldLeft + 8, 15);
    const google = field(WIDTH - GOOGLE_WIDTH - 12, GOOGLE_WIDTH, 10);
    const googleHint = aquaText('Google', { size: 12, color: AQUA.inkMuted });
    googleHint.anchor.set(0, 0.5);
    googleHint.position.set(WIDTH - GOOGLE_WIDTH - 2, 15);
    bar.addChild(this.address, google, googleHint);
    this.window.toolbar.addChild(bar);

    this.pages = new RickrollPages({
      width: this.window.contentWidth,
      height: this.window.contentHeight,
      overlay,
      linkCursor: 'pointer',
      onNavigate: (page) => this.navigated(page),
    });
    this.window.content.addChild(this.pages.view);
  }

  /** Keeps the video's iframe over the page */
  update(): void {
    this.pages.update();
  }

  destroy(): void {
    this.pages.destroy();
    this.window.destroy();
  }

  private navigated(page: PageInfo): void {
    this.window.setTitle(page.title);
    this.address.text = page.url;
  }
}

/** A white text field with Safari's thin edge; `radius` rounds the Google field */
function field(x: number, width: number, radius: number): Graphics {
  return new Graphics()
    .roundRect(x, 4, width, 22, radius)
    .fill(AQUA.white)
    .stroke({ width: 1, color: AQUA.web.fieldEdge, alignment: 1 });
}

/** Back or Forward: a grey arrow on a white gel button */
function arrowButton(x: number, direction: 'back' | 'forward'): Graphics {
  const g = drawGelPill(new Graphics(), x, 4, 28, 22, AQUA.gel.white);
  const mid = x + 14;
  const dx = direction === 'back' ? -1 : 1;
  return g.poly([mid + 4 * dx, 15, mid - 3 * dx, 10, mid - 3 * dx, 20]).fill(AQUA.inkMuted);
}
