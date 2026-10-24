// The pages inside the in-game browsers for the Rickroll easter egg (doc/easter-eggs.md): the 4chan /v/ thread, then,
// after its "mirror" link, the embedded YouTube video (ADR 0014). The same on XP and Mac, like a real web page; each
// scene's browser window frames it and shows the address and title it reports. Top-left at (0, 0), clipped to its size.

import { Container, Graphics, Rectangle, Text, type TextStyleOptions } from 'pixi.js';
import {
  MIRROR_LINK_TEXT,
  THREAD_POSTS,
  THREAD_TITLE,
  THREAD_URL,
  VIDEO_EMBED_URL,
  VIDEO_TITLE,
  VIDEO_URL,
  type ChanPost,
  type PostLine,
} from '@/scenes/shared/rickroll.ts';
import { WEB_2007 } from '@/theme/web-2007.ts';
import { VideoEmbed } from './video-embed.ts';

const C = WEB_2007.chan;
/** Page text is rasterised at 3× so it stays sharp when the desktop is scaled up */
const RESOLUTION = 3;
const SANS = ['Arial', 'Helvetica', 'sans-serif'];
const SERIF = ['Times New Roman', 'Times', 'serif'];
const PAGE_PADDING = 10;
const PICTURE = { width: 126, height: 94 };
const REPLY_GUTTER = 22;
const LINE_HEIGHT = 16;
/** The 16:9 player, at most this wide */
const VIDEO_MAX_WIDTH = 640;

/** What a page is, for the window's address bar and title */
export interface PageInfo {
  url: string;
  title: string;
}

export interface RickrollPagesOptions {
  width: number;
  height: number;
  /** Where the YouTube iframe goes (SceneContext.overlay) */
  overlay: HTMLElement;
  /** CSS cursor over links: each system's own hand */
  linkCursor: string;
  /** The browser went to another page: update the address bar and title */
  onNavigate: (page: PageInfo) => void;
}

export const THREAD_PAGE: PageInfo = { url: THREAD_URL, title: THREAD_TITLE };
export const VIDEO_PAGE: PageInfo = { url: VIDEO_URL, title: VIDEO_TITLE };

export class RickrollPages {
  readonly view = new Container({ label: 'web-page' });
  private readonly width: number;
  private readonly height: number;
  private readonly overlay: HTMLElement;
  private readonly onNavigate: (page: PageInfo) => void;
  private page: Container;
  private embed: VideoEmbed | null = null;

  constructor({ width, height, overlay, linkCursor, onNavigate }: RickrollPagesOptions) {
    this.width = width;
    this.height = height;
    this.overlay = overlay;
    this.onNavigate = onNavigate;
    const mask = new Graphics().rect(0, 0, width, height).fill('#ffffff');
    this.view.addChild(mask);
    this.view.mask = mask;
    this.page = drawThread(width, height, linkCursor, () => this.showVideo());
    this.view.addChild(this.page);
  }

  /** Keeps the video's iframe on the page; call every frame */
  update(): void {
    this.embed?.update();
  }

  destroy(): void {
    this.embed?.destroy();
    this.embed = null;
    this.view.destroy({ children: true });
  }

  /** The mirror link: the same window goes to YouTube and the video starts */
  private showVideo(): void {
    if (this.embed) return;
    this.page.destroy({ children: true });
    const page = new Container({ label: 'video-page' });
    page.addChild(new Graphics().rect(0, 0, this.width, this.height).fill(WEB_2007.video));
    const width = Math.min(VIDEO_MAX_WIDTH, this.width - PAGE_PADDING * 2);
    const height = Math.min(Math.round((width * 9) / 16), this.height - PAGE_PADDING * 2);
    const player = new Container({ label: 'player' });
    player.position.set(
      Math.round((this.width - width) / 2),
      Math.round((this.height - height) / 2),
    );
    page.addChild(player);
    this.view.addChild(page);
    this.page = page;
    this.embed = new VideoEmbed({
      overlay: this.overlay,
      src: VIDEO_EMBED_URL,
      title: VIDEO_TITLE,
      target: player,
      width,
      height,
    });
    this.onNavigate(VIDEO_PAGE);
  }
}

function pageText(text: string, style: TextStyleOptions): Text {
  return new Text({
    text,
    resolution: RESOLUTION,
    style: { fontFamily: SANS, fontSize: 13, fill: C.text, ...style },
  });
}

/** The thread: board title, "Posting mode: Reply", the opening post with its picture, then the replies */
function drawThread(
  width: number,
  height: number,
  linkCursor: string,
  onMirror: () => void,
): Container {
  const page = new Container({ label: 'thread-page' });
  page.addChild(new Graphics().rect(0, 0, width, height).fill(C.page));

  const boards = pageText(
    '[a / b / c / d / e / g / gif / h / k / m / o / p / r / s / t / u / v / w ]',
    {
      fontSize: 10,
    },
  );
  boards.position.set(PAGE_PADDING, 6);
  const title = pageText(THREAD_TITLE, {
    fontFamily: ['Tahoma', ...SANS],
    fontSize: 24,
    fontWeight: '700',
    fill: C.title,
    letterSpacing: -1,
  });
  title.anchor.set(0.5, 0);
  title.position.set(width / 2, 22);
  let y = title.y + title.height + 6;

  const rules = new Graphics();
  rules.rect(PAGE_PADDING, y, width - PAGE_PADDING * 2, 1).fill(C.rule);
  y += 6;
  const mode = new Graphics().rect(0, y, width, 20).fill(C.modeBar);
  const modeText = pageText('Posting mode: Reply', {
    fontWeight: '700',
    fill: C.onModeBar,
  });
  modeText.anchor.set(0.5, 0.5);
  modeText.position.set(width / 2, y + 10);
  y += 26;
  rules.rect(PAGE_PADDING, y, width - PAGE_PADDING * 2, 1).fill(C.rule);
  y += 8;
  page.addChild(boards, title, rules, mode, modeText);

  const [op, ...replies] = THREAD_POSTS;
  if (!op) throw new Error('The thread has no opening post');
  const opening = drawOpeningPost(op, { onTap: onMirror, cursor: linkCursor });
  opening.view.position.set(PAGE_PADDING, y);
  page.addChild(opening.view);
  y += opening.height + 8;

  for (const post of replies) {
    const reply = drawReply(post, width - PAGE_PADDING * 2);
    reply.view.position.set(PAGE_PADDING, y);
    page.addChild(reply.view);
    y += reply.height + 4;
  }
  return page;
}

/** Subject (opening post only), name, date and number on one line */
function postHeader(post: ChanPost): Container {
  const header = new Container({ label: 'post-header' });
  let x = 0;
  const add = (text: string, style: TextStyleOptions) => {
    const part = pageText(text, { fontSize: 12, ...style });
    part.x = x;
    x += part.width + 5;
    header.addChild(part);
  };
  if (post.subject) add(post.subject, { fontWeight: '700', fill: C.subject });
  add(post.name, { fontWeight: '700', fill: C.name });
  add(`${post.date} No.${post.number}`, {});
  return header;
}

/** The mirror link's click and cursor */
interface MirrorHandler {
  onTap: () => void;
  cursor: string;
}

/** A post's lines from `top`; the mirror line is an underlined link */
function postLines(
  lines: readonly PostLine[],
  top: number,
  mirror: MirrorHandler | null,
): { view: Container; height: number } {
  const view = new Container({ label: 'post-lines' });
  let y = top;
  for (const line of lines) {
    if ('mirror' in line) {
      if (!mirror) throw new Error('A mirror link outside the opening post');
      view.addChild(mirrorLink(y, mirror));
    } else {
      const text =
        'quote' in line
          ? pageText(line.quote, { fontFamily: SERIF, fontSize: 14, fill: C.quote })
          : pageText(line.text, { fontFamily: SERIF, fontSize: 14 });
      text.y = y;
      view.addChild(text);
    }
    y += LINE_HEIGHT + 1;
  }
  return { view, height: y };
}

function mirrorLink(y: number, { onTap, cursor }: MirrorHandler): Container {
  const link = new Container({ label: 'mirror-link' });
  const text = pageText(MIRROR_LINK_TEXT, { fontFamily: SERIF, fontSize: 14, fill: C.link });
  const underline = new Graphics()
    .rect(0, Math.round(text.height) - 2, Math.ceil(text.width), 1)
    .fill(C.link);
  link.addChild(text, underline);
  link.y = y;
  link.eventMode = 'static';
  link.cursor = cursor;
  link.hitArea = new Rectangle(0, 0, text.width, text.height);
  link.on('pointertap', onTap);
  return link;
}

function drawOpeningPost(
  post: ChanPost,
  mirror: MirrorHandler,
): { view: Container; height: number } {
  const view = new Container({ label: 'opening-post' });
  const file = pageText('File : 1175184240913.jpg-(41 KB, 400x300, liberty.jpg)', {
    fontSize: 11,
  });
  view.addChild(file);
  const picture = drawPicture();
  picture.position.set(0, 18);
  const textLeft = PICTURE.width + 14;
  const header = postHeader(post);
  header.position.set(textLeft, 18);
  const lines = postLines(post.lines, 40, mirror);
  lines.view.x = textLeft;
  view.addChild(picture, header, lines.view);
  return { view, height: Math.max(18 + PICTURE.height, lines.height) };
}

function drawReply(post: ChanPost, width: number): { view: Container; height: number } {
  const view = new Container({ label: 'reply' });
  const arrows = pageText('>>', { fontSize: 12, fill: C.rule });
  arrows.position.set(2, 6);
  const header = postHeader(post);
  header.position.set(6, 4);
  const lines = postLines(post.lines, 22, null);
  lines.view.x = 6;
  const boxWidth = Math.min(
    width - REPLY_GUTTER,
    Math.ceil(Math.max(header.width, lines.view.width)) + 16,
  );
  const boxHeight = lines.height + 4;
  const box = new Graphics()
    .rect(0, 0, boxWidth, boxHeight)
    .fill(C.replyEdge)
    .rect(0, 0, boxWidth - 1, boxHeight - 1)
    .fill(C.reply);
  const inner = new Container();
  inner.x = REPLY_GUTTER;
  inner.addChild(box, header, lines.view);
  view.addChild(arrows, inner);
  return { view, height: boxHeight };
}

/** The opening post's picture: a night skyline (drawn, no Rockstar artwork) */
function drawPicture(): Graphics {
  const { width, height } = PICTURE;
  const p = C.picture;
  const g = new Graphics().rect(0, 0, width, height).fill(p.border);
  const bands = 8;
  for (let i = 0; i < bands; i++) {
    g.rect(1, 1 + ((height - 2) * i) / bands, width - 2, (height - 2) / bands + 1).fill(
      i < bands / 2 ? p.sky[0] : p.sky[1],
    );
  }
  // Towers left to right: [x, width, height]
  const towers: [number, number, number][] = [
    [4, 14, 34],
    [18, 10, 52],
    [28, 16, 40],
    [44, 12, 70],
    [56, 18, 46],
    [74, 9, 60],
    [83, 15, 36],
    [98, 11, 56],
    [109, 15, 30],
  ];
  for (const [x, w, h] of towers) {
    g.rect(x, height - 1 - h, w, h).fill(p.buildings);
    for (let wy = height - h + 4; wy < height - 6; wy += 6) {
      for (let wx = x + 2; wx < x + w - 2; wx += 4) {
        if ((wx * 7 + wy * 3) % 5 < 2) g.rect(wx, wy, 1.5, 2).fill(p.windows);
      }
    }
  }
  return g;
}
