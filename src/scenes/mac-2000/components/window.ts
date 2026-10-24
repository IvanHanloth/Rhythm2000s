// Aqua 文稿窗口（NSWindow）：22 像素细条纹标题栏，上方两角圆角、下方直角；
// 左边关闭 / 最小化 / 缩放三颗果冻按钮，标题居中，右边工具栏开关；可选工具栏、状态栏、滚动条、缩放手柄。
// 原点在窗口中心，方便做缩放动画（与 XP 的弹出窗口一致）。

import { Container, Graphics, type Text } from 'pixi.js';
import { AQUA } from '../../../theme/aqua.ts';
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
/** 三颗按钮的半径、第一颗的圆心横坐标、相邻两颗的间距 */
const LIGHT_RADIUS = 7;
const LIGHT_X = 15;
const LIGHT_PITCH = 21;
const GROW_BOX = 15;

export interface AquaWindowOptions {
  title: string;
  width: number;
  height: number;
  /** 内容区底色：白色（Finder、文本编辑）或细条纹（对话框、偏好设置）。默认细条纹 */
  content?: 'white' | 'pinstripe';
  /** 标题栏右边的工具栏开关（白色椭圆）。默认有 */
  toolbarButton?: boolean;
  /** 标题栏下方工具栏的高度（Finder 是 58）；工具栏里的东西放进 toolbar 容器。默认 0，没有工具栏 */
  toolbarHeight?: number;
  /** 标题栏下方状态栏的文字，例如「17 项，6.8 GB 可用」；不传则没有状态栏 */
  statusText?: string;
  /** 右侧竖向滚动条；不传则没有 */
  scroller?: { thumbStart: number; thumbSize: number };
  /** 右下角的缩放手柄。默认有 */
  growBox?: boolean;
}

export class AquaWindow {
  readonly view: Container;
  /** 内容区：左上角在内容区左上角，超出内容区的部分被裁掉 */
  readonly content: Container;
  readonly contentWidth: number;
  readonly contentHeight: number;
  /** 工具栏：左上角在标题栏下方；没有工具栏时是空的 */
  readonly toolbar = new Container({ label: 'toolbar' });
  /** 活动 / 非活动两种状态下各画一份的部分：标题栏、三颗按钮、工具栏开关、滚动条 */
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

    // 窗口底：整块细条纹
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

  /** 非活动窗口：三颗按钮变灰、标题字变灰、标题栏条纹变淡、投影变浅 */
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
  // 上亮下暗的一层光泽，让条纹有一点弧面感
  topRoundedRect(g, 0, 0, width, TITLE_BAR_HEIGHT, CORNER_RADIUS).fill(
    vGradient([
      [0, 'rgba(255,255,255,0.55)'],
      [0.5, 'rgba(255,255,255,0)'],
      [1, 'rgba(0,0,0,0.04)'],
    ]),
  );
  return g.rect(0, TITLE_BAR_HEIGHT - 1, width, 1).fill(AQUA.separator);
}

/** 关闭（红）、最小化（黄）、缩放（绿）；非活动时三颗都是灰色 */
function drawLights(active: boolean): Graphics {
  const { close, minimize, zoom, inactive } = AQUA.lights;
  const colors = active ? [close, minimize, zoom] : [inactive, inactive, inactive];
  const g = new Graphics({ label: 'window-buttons' });
  colors.forEach((c, i) => {
    drawGelBall(g, LIGHT_X + i * LIGHT_PITCH, TITLE_BAR_HEIGHT / 2, LIGHT_RADIUS, c);
  });
  return g;
}

/** 右下角的缩放手柄：三道斜纹，每道一暗一亮 */
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
