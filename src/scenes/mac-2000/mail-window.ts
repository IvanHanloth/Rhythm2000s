// Mail 1.x's viewer window for the Rickroll easter egg (doc/easter-eggs.md), opened from Mail in the Dock: an Aqua
// window with a toolbar, the message list and the preview below it. Empty until three charts are finished; then the
// 4chan message waits in "In". Clicking it marks it read and shows it below, where its link opens Safari. The toolbar
// is decoration; the red button closes the window. Origin at the centre.

import { Container, Graphics, Rectangle, type Text } from 'pixi.js';
import type { MailWindowOptions } from '@/scenes/shared/level-scene.ts';
import { RICKROLL_MAIL, THREAD_URL } from '@/scenes/shared/rickroll.ts';
import { AQUA } from '@/theme/aqua.ts';
import { appIcon } from './assets.ts';
import { drawDocumentIcon, drawFolderIcon, drawTrashIcon } from './components/icons.ts';
import { aquaText, vGradient } from './components/paint.ts';
import { AquaWindow } from './components/window.ts';

const WIDTH = 760;
const HEIGHT = 450;
const TOOLBAR_HEIGHT = 58;
const HEADER_HEIGHT = 18;
const ROW_HEIGHT = 18;
const LIST_HEIGHT = 120;
/** Message list columns: left edge and label */
const COLUMNS = [
  { x: 0, label: '' },
  { x: 20, label: 'From' },
  { x: 190, label: 'Subject' },
  { x: 560, label: 'Date Received' },
];
const BODY_PADDING = 14;
/** Hit radius around the red close button */
const CLOSE_HIT = 9;

export class MacMailWindow {
  readonly view: Container;
  private readonly window: AquaWindow;
  private readonly options: MailWindowOptions;
  private readonly row = new Container({ label: 'message-row' });
  private readonly preview = new Container({ label: 'preview' });
  private read: boolean;
  private selected: boolean;

  constructor(options: MailWindowOptions) {
    this.options = options;
    this.read = options.message?.read ?? false;
    // A message already read opens selected; an unread one waits for its click
    this.selected = this.read;
    this.window = new AquaWindow({
      title: '',
      width: WIDTH,
      height: HEIGHT,
      content: 'white',
      toolbarHeight: TOOLBAR_HEIGHT,
      growBox: false,
    });
    this.view = this.window.view;
    this.view.addChild(closeHit(this.window, options.onClose));
    this.window.toolbar.addChild(toolbar());

    const content = this.window.content;
    const width = this.window.contentWidth;
    content.addChild(listHeader(width));
    this.row.y = HEADER_HEIGHT;
    // The splitter between the list and the preview
    const splitter = new Graphics()
      .rect(0, HEADER_HEIGHT + LIST_HEIGHT, width, 8)
      .fill(
        vGradient([
          [0, AQUA.web.listHeaderTop],
          [1, AQUA.web.listHeaderBottom],
        ]),
      )
      .rect(0, HEADER_HEIGHT + LIST_HEIGHT, width, 1)
      .fill(AQUA.separator)
      .rect(0, HEADER_HEIGHT + LIST_HEIGHT + 7, width, 1)
      .fill(AQUA.separator);
    this.preview.y = HEADER_HEIGHT + LIST_HEIGHT + 8;
    content.addChild(this.row, splitter, this.preview);
    this.refresh();
  }

  destroy(): void {
    this.window.destroy();
  }

  private refresh(): void {
    const message = this.options.message;
    const unread = message !== null && !this.read;
    this.window.setTitle(
      message ? `In — 1 message${unread ? ', 1 unread' : ''}` : 'In — 0 messages',
    );
    for (const child of this.row.removeChildren()) child.destroy({ children: true });
    for (const child of this.preview.removeChildren()) child.destroy({ children: true });
    if (!message) return;

    const width = this.window.contentWidth;
    const selected = this.selected;
    const ink = selected ? AQUA.white : AQUA.ink;
    const row = new Container({ label: 'row' });
    if (selected) row.addChild(new Graphics().rect(0, 0, width, ROW_HEIGHT).fill(AQUA.selection));
    if (unread) {
      row.addChild(
        new Graphics().circle(10, ROW_HEIGHT / 2, 4).fill(selected ? AQUA.white : AQUA.web.unread),
      );
    }
    const cells = [RICKROLL_MAIL.fromName, RICKROLL_MAIL.subject, RICKROLL_MAIL.received];
    cells.forEach((cell, i) => {
      const text = aquaText(cell, { size: 12, color: ink, bold: unread });
      text.anchor.set(0, 0.5);
      text.position.set(COLUMNS[i + 1]!.x + 6, ROW_HEIGHT / 2);
      row.addChild(text);
    });
    row.eventMode = 'static';
    row.hitArea = new Rectangle(0, 0, width, ROW_HEIGHT);
    row.on('pointertap', () => this.openMessage());
    this.row.addChild(row);
    if (selected) this.preview.addChild(this.previewContent(width));
  }

  private openMessage(): void {
    if (this.selected && this.read) return;
    this.selected = true;
    if (!this.read) {
      this.read = true;
      this.options.onRead();
    }
    this.refresh();
  }

  /** Grey header lines (From, Date, To, Subject), then the body with the link */
  private previewContent(width: number): Container {
    const m = RICKROLL_MAIL;
    const view = new Container({ label: 'message' });
    const headers: [string, string][] = [
      ['From:', `${m.fromName} <${m.fromAddress}>`],
      ['Date:', m.date],
      ['To:', m.to],
      ['Subject:', m.subject],
    ];
    let y = 8;
    for (const [label, value] of headers) {
      const name = aquaText(label, { size: 12, bold: true, color: AQUA.inkSoft });
      name.anchor.set(1, 0);
      name.position.set(BODY_PADDING + 58, y);
      const text = aquaText(value, { size: 12 });
      text.position.set(BODY_PADDING + 64, y);
      view.addChild(name, text);
      y += 16;
    }
    y += 8;
    view.addChild(
      new Graphics().rect(BODY_PADDING, y, width - BODY_PADDING * 2, 1).fill(AQUA.separator),
    );
    y += 10;
    const wrap = width - BODY_PADDING * 2;
    for (const paragraph of m.body) {
      const text = aquaText(paragraph, { size: 12, wrapWidth: wrap, lineHeight: 16 });
      text.position.set(BODY_PADDING, y);
      view.addChild(text);
      y += text.height + 6;
    }
    const link = linkText(THREAD_URL, () => this.options.onOpenLink());
    link.position.set(BODY_PADDING, y);
    view.addChild(link);
    y += link.height + 10;
    const signOff = aquaText(m.signOff, { size: 12 });
    signOff.position.set(BODY_PADDING, y);
    view.addChild(signOff);
    return view;
  }
}

/** Column headers over the message list: a light gradient with thin dividers */
function listHeader(width: number): Container {
  const view = new Container({ label: 'list-header' });
  const g = new Graphics()
    .rect(0, 0, width, HEADER_HEIGHT)
    .fill(
      vGradient([
        [0, AQUA.web.listHeaderTop],
        [1, AQUA.web.listHeaderBottom],
      ]),
    )
    .rect(0, HEADER_HEIGHT - 1, width, 1)
    .fill(AQUA.separator);
  view.addChild(g);
  for (const { x, label } of COLUMNS) {
    if (x > 0) g.rect(x, 2, 1, HEADER_HEIGHT - 4).fill(AQUA.separator);
    if (!label) continue;
    const text = aquaText(label, { size: 11 });
    text.anchor.set(0, 0.5);
    text.position.set(x + 6, HEADER_HEIGHT / 2);
    view.addChild(text);
  }
  return view;
}

/** Get Mail, Compose, Delete, Mailbox and a search field: decoration */
function toolbar(): Container {
  const bar = new Container({ label: 'mail-toolbar' });
  let x = 14;
  const items: [Container, string][] = [
    [appIcon('Mail', 32), 'Get Mail'],
    [drawDocumentIcon(32), 'Compose'],
    [drawTrashIcon(32), 'Delete'],
    [drawFolderIcon(32), 'Mailbox'],
  ];
  for (const [icon, label] of items) {
    const text = aquaText(label, { size: 11 });
    const width = Math.max(48, Math.ceil(text.width) + 8);
    icon.position.set(x + (width - 32) / 2, 6);
    text.anchor.set(0.5, 0);
    text.position.set(x + width / 2, 40);
    bar.addChild(icon, text);
    x += width + 8;
  }
  return bar;
}

/** Blue underlined link that responds to clicks */
function linkText(text: string, onTap: () => void): Container {
  const view = new Container({ label: 'link' });
  const label: Text = aquaText(text, { size: 12, color: AQUA.web.link });
  view.addChild(
    label,
    new Graphics()
      .rect(0, Math.round(label.height) - 2, Math.ceil(label.width), 1)
      .fill(AQUA.web.link),
  );
  view.eventMode = 'static';
  view.cursor = 'pointer';
  view.hitArea = new Rectangle(0, 0, label.width, label.height);
  view.on('pointertap', onTap);
  return view;
}

/** Hit area over the red close button */
export function closeHit(window: AquaWindow, onClose: () => void): Container {
  const close = new Container({ label: 'close-hit' });
  close.eventMode = 'static';
  const { x, y } = window.closeCenter;
  const pivot = window.view.pivot;
  close.hitArea = new Rectangle(
    x + pivot.x - CLOSE_HIT,
    y + pivot.y - CLOSE_HIT,
    CLOSE_HIT * 2,
    CLOSE_HIT * 2,
  );
  close.on('pointertap', onClose);
  return close;
}
