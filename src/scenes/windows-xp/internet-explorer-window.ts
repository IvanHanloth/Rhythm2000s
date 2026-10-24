// Internet Explorer 6 for the Rickroll easter egg (doc/easter-eggs.md), opened by the link in the 4chan message:
// a Luna window with menu bar, standard toolbar, address bar and status bar around the shared pages
// (src/ui/rickroll-pages.ts). The title and address follow the page. Toolbar and menus are decoration.
// Origin at the centre.

import { Container, Graphics } from 'pixi.js';
import type { BrowserWindowOptions } from '@/scenes/shared/level-scene.ts';
import { LUNA } from '@/theme/xp-luna.ts';
import { XP_PROGRAMS } from '@/theme/xp-programs.ts';
import { RickrollPages, THREAD_PAGE, type PageInfo } from '@/ui/rickroll-pages.ts';
import { XP_LINK_CURSOR } from './assets.ts';
import {
  ADDRESS_HEIGHT,
  addressBar,
  drawBackIcon,
  drawForwardIcon,
  iconSprite,
  MENU_HEIGHT,
  menuBar,
  STATUS_HEIGHT,
  statusBar,
  TOOLBAR_HEIGHT,
  toolbarButton,
} from './components/explorer-bars.ts';
import { CAPTION_HEIGHT, FRAME_WIDTH, XpWindowFrame } from './components/window-frame.ts';

const WIDTH = 820;
const HEIGHT = 530;
const MENUS = ['File', 'Edit', 'View', 'Favorites', 'Tools', 'Help'];

export class XpInternetExplorerWindow {
  readonly view = new Container({ label: 'internet-explorer' });
  private readonly frame: XpWindowFrame;
  private readonly pages: RickrollPages;
  private readonly clientWidth: number;
  private address: Container;

  constructor({ overlay, onClose }: BrowserWindowOptions) {
    this.view.pivot.set(WIDTH / 2, HEIGHT / 2);
    this.frame = new XpWindowFrame({
      title: windowTitle(THREAD_PAGE),
      width: WIDTH,
      height: HEIGHT,
      icon: 'internet-explorer',
      controls: 'all',
    });
    this.frame.closeButton.view.eventMode = 'static';
    this.frame.closeButton.view.on('pointertap', onClose);

    const clientWidth = WIDTH - FRAME_WIDTH * 2;
    const clientHeight = HEIGHT - CAPTION_HEIGHT - FRAME_WIDTH;
    this.clientWidth = clientWidth;
    const client = new Container({ label: 'client' });
    client.position.set(FRAME_WIDTH, CAPTION_HEIGHT);

    const pageTop = MENU_HEIGHT + TOOLBAR_HEIGHT + ADDRESS_HEIGHT;
    const pageHeight = clientHeight - pageTop - STATUS_HEIGHT;
    // The page sits in IE's thin sunken border
    const border = new Graphics()
      .rect(0, pageTop, clientWidth, pageHeight)
      .fill(XP_PROGRAMS.paper)
      .stroke({ width: 1, color: XP_PROGRAMS.sunkenEdge, alignment: 1 });
    this.pages = new RickrollPages({
      width: clientWidth - 2,
      height: pageHeight - 2,
      overlay,
      linkCursor: XP_LINK_CURSOR,
      onNavigate: (page) => this.navigated(page),
    });
    this.pages.view.position.set(1, pageTop + 1);

    const status = statusBar(clientWidth, 'Done', 'Internet');
    status.y = clientHeight - STATUS_HEIGHT;
    this.address = addressBar(clientWidth, THREAD_PAGE.url, 'internet-explorer');

    client.addChild(
      new Graphics().rect(0, 0, clientWidth, clientHeight).fill(LUNA.face),
      menuBar(clientWidth, MENUS),
      toolbar(clientWidth),
      this.address,
      border,
      this.pages.view,
      status,
    );
    this.view.addChild(this.frame.view, client);
  }

  /** Keeps the video's iframe over the page */
  update(): void {
    this.pages.update();
  }

  destroy(): void {
    this.pages.destroy();
    this.view.destroy({ children: true });
  }

  private navigated(page: PageInfo): void {
    this.frame.setTitle(windowTitle(page));
    const parent = this.address.parent;
    if (!parent) throw new Error('The address bar is not in the window');
    const index = parent.getChildIndex(this.address);
    this.address.destroy({ children: true });
    this.address = addressBar(this.clientWidth, page.url, 'internet-explorer');
    parent.addChildAt(this.address, index);
  }
}

function windowTitle(page: PageInfo): string {
  return `${page.title} - Microsoft Internet Explorer`;
}

/** Back, Forward, Search, Favorites, Home: decoration */
function toolbar(width: number): Container {
  const e = LUNA.explorer;
  const bar = new Container({ label: 'toolbar' });
  bar.y = MENU_HEIGHT;
  bar.addChild(
    new Graphics()
      .rect(0, 0, width, TOOLBAR_HEIGHT)
      .fill(LUNA.face)
      .rect(0, 0, width, 1)
      .fill(e.bandLight)
      .rect(0, TOOLBAR_HEIGHT - 1, width, 1)
      .fill(e.bandDark),
  );
  let x = 4;
  const add = (button: { view: Container; width: number }) => {
    button.view.position.set(x, 3);
    bar.addChild(button.view);
    x += button.width + 2;
  };
  add(toolbarButton(drawBackIcon(26), 'Back', true, null));
  add(toolbarButton(drawForwardIcon(), '', true, null));
  add(toolbarButton(iconSprite('home', 24), '', false, null));
  bar.addChild(
    new Graphics()
      .rect(x + 3, 6, 1, TOOLBAR_HEIGHT - 12)
      .fill(e.toolbarSeparator)
      .rect(x + 4, 6, 1, TOOLBAR_HEIGHT - 12)
      .fill(e.bandLight),
  );
  x += 8;
  add(toolbarButton(iconSprite('search', 24), 'Search', false, null));
  add(toolbarButton(iconSprite('favorites', 24), 'Favorites', false, null));
  return bar;
}
