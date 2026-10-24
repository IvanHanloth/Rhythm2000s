// Aqua document window (NSWindow): 22 px pinstriped title bar with rounded top and square bottom corners; close,
// minimise and zoom gel buttons on the left, centred title, toolbar button on the right; optional toolbar, status bar, scroller and grow box.
// Origin at the centre for scaling (like XP's pop-up windows).

import { Container, Graphics, type Text } from 'pixi.js';
import { AQUA } from '@/theme/aqua.ts';
import {
  aquaText,
  drawGelBall,
  drawGelPill,
  drawWindowShadow,
  stripes,
  topRoundedRect,
  vGradient,
} from './paint.ts';
import { drawScroller, SCROLLER_WIDTH } from './scroller.ts';

export const TITLE_BAR_HEIGHT = 22;
export const STATUS_BAR_HEIGHT = 18;
const CORNER_RADIUS = 6;
/** Radius of the three buttons, centre x of the first, spacing between them */
const LIGHT_RADIUS = 7;
const LIGHT_X = 15;
const LIGHT_PITCH = 21;
const GROW_BOX = 15;

export interface AquaWindowOptions {
  title: string;
  width: number;
  height: number;
  /** Content background: white (Finder, TextEdit) or pinstripes (dialogs, preferences). Defaults to pinstripes */
  content?: 'white' | 'pinstripe';
  /** Toolbar button (white oval) on the right of the title bar. On by default */
  toolbarButton?: boolean;
  /** Toolbar height under the title bar (Finder: 58); toolbar items go in `toolbar`. Defaults to 0, no toolbar */
  toolbarHeight?: number;
  /** Status bar text under the toolbar, e.g. "17 items, 6.8 GB available"; no status bar if omitted */
  statusText?: string;
  /** Vertical scroller on the right; none if omitted */
  scroller?: { thumbStart: number; thumbSize: number };
  /** Grow box at the bottom right. On by default */
  growBox?: boolean;
}

export class AquaWindow {
  readonly view: Container;
  /** Content area, top left at its top left; anything outside is clipped */
  readonly content: Container;
  readonly contentWidth: number;
  readonly contentHeight: number;
  /** Toolbar, top left just under the title bar; empty without a toolbar */
  readonly toolbar = new Container({ label: 'toolbar' });
  /** Parts drawn twice, once per active state: title bar, the three buttons, toolbar button, scroller */
  private readonly activeLayer: Container;
  private readonly inactiveLayer: Container;
  private readonly activeShadow: Graphics;
  private readonly inactiveShadow: Graphics;
  private readonly titleText: Text;
  private active = true;

  constructor(options: AquaWindowOptions) {
    const {
      title,
      width,
      height,
      content = 'pinstripe',
      toolbarButton = true,
      toolbarHeight = 0,
      statusText,
      scroller,
      growBox = true,
    } = options;
    this.view = new Container({ label: `window-${title}` });
    this.view.pivot.set(width / 2, height / 2);

    this.activeShadow = drawWindowShadow(width, height, 0.55);
    this.inactiveShadow = drawWindowShadow(width, height, 0.3);
    this.inactiveShadow.visible = false;

    // Window body: pinstripes throughout
    const frame = topRoundedRect(new Graphics(), 0, 0, width, height, CORNER_RADIUS).fill(
      stripes(AQUA.stripe),
    );

    const statusTop = TITLE_BAR_HEIGHT + toolbarHeight;
    const contentTop = statusTop + (statusText !== undefined ? STATUS_BAR_HEIGHT : 0);
    this.toolbar.position.set(0, TITLE_BAR_HEIGHT);
    const scrollerWidth = scroller ? SCROLLER_WIDTH : 0;
    this.contentWidth = width - scrollerWidth;
    this.contentHeight = height - contentTop;

    if (content === 'white') {
      frame.rect(0, contentTop, this.contentWidth, this.contentHeight).fill(AQUA.white);
    }
    if (statusText !== undefined) {
      frame.rect(0, contentTop - 1, width, 1).fill(AQUA.separator);
    }

    this.content = new Container({ label: 'content' });
    this.content.position.set(0, contentTop);
    const contentMask = new Graphics()
      .rect(0, contentTop, this.contentWidth, this.contentHeight)
      .fill(AQUA.white);
    this.content.mask = contentMask;

    const status =
      statusText !== undefined ? aquaText(statusText, { size: 11, color: AQUA.inkSoft }) : null;
    status?.anchor.set(0.5);
    status?.position.set(width / 2, statusTop + STATUS_BAR_HEIGHT / 2);

    const scrollerHeight = this.contentHeight - (growBox ? GROW_BOX : 0);
    const makeLayer = (active: boolean): Container => {
      const root = new Container({ label: active ? 'active' : 'inactive' });
      root.addChild(drawTitleBar(width, active), drawLights(active));
      if (toolbarButton) {
        const pill = drawGelPill(new Graphics(), width - 27, 5.5, 19, 11, AQUA.gel.white);
        pill.alpha = active ? 1 : 0.6;
        root.addChild(pill);
      }
      if (scroller) {
        const bar = drawScroller({ height: scrollerHeight, ...scroller, active });
        bar.position.set(width - SCROLLER_WIDTH, contentTop);
        root.addChild(bar);
      }
      return root;
    };
    this.activeLayer = makeLayer(true);
    this.inactiveLayer = makeLayer(false);
    this.inactiveLayer.visible = false;

    this.titleText = aquaText(title, { size: 13 });
    this.titleText.anchor.set(0.5);
    this.titleText.position.set(width / 2, TITLE_BAR_HEIGHT / 2);

    const edge = topRoundedRect(new Graphics(), 0, 0, width, height, CORNER_RADIUS).stroke({
      width: 1,
      color: AQUA.windowEdge,
      alpha: 0.55,
      alignment: 1,
    });

    this.view.addChild(
      this.activeShadow,
      this.inactiveShadow,
      frame,
      this.content,
      contentMask,
      this.activeLayer,
      this.inactiveLayer,
      this.titleText,
      this.toolbar,
    );
    if (status) this.view.addChild(status);
    if (growBox) this.view.addChild(drawGrowBox(width - GROW_BOX, height - GROW_BOX));
    this.view.addChild(edge);
  }

  /** Centre of the red close button relative to the window centre, in view coordinates */
  get closeCenter(): { x: number; y: number } {
    return { x: LIGHT_X - this.view.pivot.x, y: TITLE_BAR_HEIGHT / 2 - this.view.pivot.y };
  }

  /** Centre of the yellow minimise button relative to the window centre, in view coordinates */
  get minimizeCenter(): { x: number; y: number } {
    return {
      x: LIGHT_X + LIGHT_PITCH - this.view.pivot.x,
      y: TITLE_BAR_HEIGHT / 2 - this.view.pivot.y,
    };
  }

  /** A new title, e.g. when the document is renamed */
  setTitle(title: string): void {
    this.titleText.text = title;
  }

  /** Inactive window: grey buttons and title, fainter title bar stripes, lighter shadow */
  setActive(active: boolean): void {
    if (this.active === active) return;
    this.active = active;
    this.activeLayer.visible = active;
    this.inactiveLayer.visible = !active;
    this.activeShadow.visible = active;
    this.inactiveShadow.visible = !active;
    this.titleText.style.fill = active ? AQUA.ink : AQUA.inkMuted;
  }

  destroy(): void {
    this.view.destroy({ children: true });
  }
}

function drawTitleBar(width: number, active: boolean): Graphics {
  const g = topRoundedRect(
    new Graphics({ label: 'title-bar' }),
    0,
    0,
    width,
    TITLE_BAR_HEIGHT,
    CORNER_RADIUS,
  ).fill(stripes(active ? AQUA.titleStripe : AQUA.titleStripeInactive));
  // A light-to-dark sheen so the stripes look slightly curved
  topRoundedRect(g, 0, 0, width, TITLE_BAR_HEIGHT, CORNER_RADIUS).fill(
    vGradient([
      [0, 'rgba(255,255,255,0.55)'],
      [0.5, 'rgba(255,255,255,0)'],
      [1, 'rgba(0,0,0,0.04)'],
    ]),
  );
  return g.rect(0, TITLE_BAR_HEIGHT - 1, width, 1).fill(AQUA.separator);
}

/** Close (red), minimise (yellow), zoom (green); all grey when inactive */
function drawLights(active: boolean): Graphics {
  const { close, minimize, zoom, inactive } = AQUA.lights;
  const colors = active ? [close, minimize, zoom] : [inactive, inactive, inactive];
  const g = new Graphics({ label: 'window-buttons' });
  colors.forEach((c, i) => {
    drawGelBall(g, LIGHT_X + i * LIGHT_PITCH, TITLE_BAR_HEIGHT / 2, LIGHT_RADIUS, c);
  });
  return g;
}

/** Grow box at the bottom right: three diagonal ridges, each dark then light */
function drawGrowBox(x: number, y: number): Graphics {
  const g = new Graphics({ label: 'grow-box' });
  for (const d of [4, 8, 12]) {
    g.moveTo(x + GROW_BOX - 2, y + GROW_BOX - 2 - d).lineTo(x + GROW_BOX - 2 - d, y + GROW_BOX - 2);
  }
  g.stroke({ width: 1, color: AQUA.inkMuted });
  for (const d of [5, 9, 13]) {
    g.moveTo(x + GROW_BOX - 2, y + GROW_BOX - 2 - d).lineTo(x + GROW_BOX - 2 - d, y + GROW_BOX - 2);
  }
  return g.stroke({ width: 1, color: AQUA.white });
}
