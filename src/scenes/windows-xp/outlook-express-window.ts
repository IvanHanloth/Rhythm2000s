// Outlook Express 6 for the Rickroll easter egg (doc/easter-eggs.md), opened from "start" → "E-mail" or the new-mail
// balloon: a Luna window with menu bar, toolbar, the "Inbox" band, the folder list, the message list and the preview
// pane. Empty until three charts are finished; then the 4chan message waits in the Inbox. Clicking it marks it read and
// shows it in the preview pane, whose link opens Internet Explorer. Toolbar, menus and folders are decoration.
// Origin at the centre.

import { Container, Graphics, Rectangle, type Text } from 'pixi.js';
import type { MailWindowOptions } from '@/scenes/shared/level-scene.ts';
import { RICKROLL_MAIL, THREAD_URL } from '@/scenes/shared/rickroll.ts';
import { LUNA } from '@/theme/xp-luna.ts';
import { XP_PROGRAMS } from '@/theme/xp-programs.ts';
import { XP_LINK_CURSOR } from './assets.ts';
import { verticalGradient } from './components/draw.ts';
import {
  iconSprite,
  MENU_HEIGHT,
  menuBar,
  STATUS_HEIGHT,
  statusBar,
  TOOLBAR_HEIGHT,
  toolbarButton,
} from './components/explorer-bars.ts';
import { CAPTION_HEIGHT, FRAME_WIDTH, XpWindowFrame } from './components/window-frame.ts';
import { xpText } from './components/xp-text.ts';

export const OUTLOOK_TITLE = 'Inbox - Outlook Express';
const WIDTH = 780;
const HEIGHT = 500;
const MENUS = ['File', 'Edit', 'View', 'Tools', 'Message', 'Help'];
/** The dark "Inbox" band under the toolbar */
const BAND_HEIGHT = 26;
const FOLDERS_WIDTH = 176;
const PANE_HEADER_HEIGHT = 20;
const LIST_HEIGHT = 112;
const ROW_HEIGHT = 18;
/** Message list columns: left edge and label */
const COLUMNS = [
  { x: 0, label: '!' },
  { x: 22, label: 'From' },
  { x: 110, label: 'Subject' },
  { x: 460, label: 'Received' },
];
const PREVIEW_HEADER_HEIGHT = 44;
const BODY_PADDING = 10;

export class XpOutlookExpressWindow {
  readonly view = new Container({ label: 'outlook-express' });
  private readonly options: MailWindowOptions;
  private readonly listWidth: number;
  private readonly previewHeight: number;
  /** The message row, preview and status, rebuilt when the message is clicked */
  private readonly row = new Container({ label: 'message-row' });
  private readonly preview = new Container({ label: 'preview' });
  private readonly inboxLabel: Text;
  private readonly status = new Container({ label: 'status' });
  private readonly clientWidth: number;
  private read: boolean;
  private selected: boolean;

  constructor(options: MailWindowOptions) {
    this.options = options;
    this.read = options.message?.read ?? false;
    // A message already read opens selected; an unread one waits for its click
    this.selected = this.read;
    this.view.pivot.set(WIDTH / 2, HEIGHT / 2);
    const frame = new XpWindowFrame({
      title: OUTLOOK_TITLE,
      width: WIDTH,
      height: HEIGHT,
      icon: 'outlook-express',
      controls: 'all',
    });
    frame.closeButton.view.eventMode = 'static';
    frame.closeButton.view.on('pointertap', options.onClose);

    const clientWidth = WIDTH - FRAME_WIDTH * 2;
    const clientHeight = HEIGHT - CAPTION_HEIGHT - FRAME_WIDTH;
    this.clientWidth = clientWidth;
    const client = new Container({ label: 'client' });
    client.position.set(FRAME_WIDTH, CAPTION_HEIGHT);
    client.addChild(new Graphics().rect(0, 0, clientWidth, clientHeight).fill(LUNA.face));

    const band = new Container({ label: 'band' });
    band.y = MENU_HEIGHT + TOOLBAR_HEIGHT;
    band.addChild(
      new Graphics()
        .rect(0, 0, clientWidth, BAND_HEIGHT)
        .fill(verticalGradient(LUNA.explorer.taskPane)),
    );
    const bandTitle = xpText('Inbox', { fontSize: 16, fontWeight: '700', fill: LUNA.white });
    bandTitle.anchor.set(0, 0.5);
    bandTitle.position.set(10, BAND_HEIGHT / 2);
    band.addChild(bandTitle);

    const bodyTop = band.y + BAND_HEIGHT + 2;
    const bodyHeight = clientHeight - bodyTop - STATUS_HEIGHT - 2;
    this.listWidth = clientWidth - FOLDERS_WIDTH - 4;
    this.previewHeight = bodyHeight - PANE_HEADER_HEIGHT - LIST_HEIGHT - 4;

    const folders = this.folderPane(bodyHeight);
    this.inboxLabel = folders.inbox;
    folders.view.position.set(0, bodyTop);
    const list = this.messageList();
    list.position.set(FOLDERS_WIDTH + 4, bodyTop);
    this.preview.position.set(FOLDERS_WIDTH + 4, bodyTop + PANE_HEADER_HEIGHT + LIST_HEIGHT + 4);
    this.status.y = clientHeight - STATUS_HEIGHT;

    client.addChild(menuBar(clientWidth, MENUS), this.toolbar(clientWidth), band);
    client.addChild(folders.view, list, this.preview, this.status);
    this.view.addChild(frame.view, client);
    this.refresh();
  }

  destroy(): void {
    this.view.destroy({ children: true });
  }

  /** Redraws what the message's state changes: its row, the preview, the Inbox count and the status bar */
  private refresh(): void {
    const message = this.options.message;
    const unread = message !== null && !this.read;
    this.inboxLabel.text = unread ? 'Inbox (1)' : 'Inbox';
    this.inboxLabel.style.fontWeight = unread ? '700' : '400';

    for (const child of this.row.removeChildren()) child.destroy({ children: true });
    for (const child of this.preview.removeChildren()) child.destroy({ children: true });
    for (const child of this.status.removeChildren()) child.destroy({ children: true });

    const count = message ? `1 message(s), ${unread ? 1 : 0} unread` : '0 message(s), 0 unread';
    this.status.addChild(statusBar(this.clientWidth, count, 'Working Online'));

    if (!message) {
      const empty = xpText('There are no items in this view.', { fill: LUNA.inkDisabled });
      empty.anchor.set(0.5, 0);
      empty.position.set(this.listWidth / 2, 14);
      this.row.addChild(empty);
      this.preview.addChild(sunken(this.listWidth, this.previewHeight));
      return;
    }

    const selected = this.selected;
    const ink = selected ? LUNA.white : LUNA.ink;
    const weight = unread ? '700' : '400';
    const row = new Container({ label: 'row' });
    row.y = 1;
    if (selected) {
      row.addChild(new Graphics().rect(1, 0, this.listWidth - 2, ROW_HEIGHT).fill(LUNA.selection));
    }
    const envelope = iconSprite('email', 16);
    envelope.position.set(COLUMNS[0]!.x + 3, 1);
    row.addChild(envelope);
    const cells = [RICKROLL_MAIL.fromName, RICKROLL_MAIL.subject, RICKROLL_MAIL.received];
    cells.forEach((cell, i) => {
      const text = xpText(cell, { fill: ink, fontWeight: weight });
      text.anchor.set(0, 0.5);
      text.position.set(COLUMNS[i + 1]!.x + 4, ROW_HEIGHT / 2);
      row.addChild(text);
    });
    row.eventMode = 'static';
    row.cursor = 'default';
    row.hitArea = new Rectangle(0, 0, this.listWidth, ROW_HEIGHT);
    row.on('pointertap', () => this.openMessage());
    this.row.addChild(row);

    this.preview.addChild(sunken(this.listWidth, this.previewHeight));
    if (selected) this.preview.addChild(this.previewContent());
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

  /** Header box (From / To / Subject) over the white body with the link */
  private previewContent(): Container {
    const m = RICKROLL_MAIL;
    const view = new Container({ label: 'message' });
    const width = this.listWidth;
    view.addChild(
      new Graphics()
        .rect(1, 1, width - 2, PREVIEW_HEADER_HEIGHT)
        .fill(LUNA.face)
        .rect(1, PREVIEW_HEADER_HEIGHT, width - 2, 1)
        .fill(LUNA.edgeShadow),
    );
    const header = xpText(
      `From: ${m.fromName}    To: ${m.to}\nSubject: ${m.subject}\nDate: ${m.date}`,
      { lineHeight: 14 },
    );
    header.position.set(8, 2);
    view.addChild(header);

    let y = PREVIEW_HEADER_HEIGHT + BODY_PADDING;
    const wrap = width - BODY_PADDING * 2;
    for (const paragraph of m.body) {
      const text = xpText(paragraph, {
        fontFamily: ['Arial', 'sans-serif'],
        fontSize: 13,
        wordWrap: true,
        wordWrapWidth: wrap,
        lineHeight: 17,
      });
      text.position.set(BODY_PADDING, y);
      view.addChild(text);
      y += text.height + 6;
    }
    const link = linkText(THREAD_URL, () => this.options.onOpenLink());
    link.position.set(BODY_PADDING, y);
    view.addChild(link);
    y += link.height + 10;
    const signOff = xpText(m.signOff, { fontFamily: ['Arial', 'sans-serif'], fontSize: 13 });
    signOff.position.set(BODY_PADDING, y);
    view.addChild(signOff);
    return view;
  }

  /** Folder tree under a "Folders" header; returns the Inbox label, whose count changes */
  private folderPane(height: number): { view: Container; inbox: Text } {
    const view = new Container({ label: 'folders' });
    view.addChild(
      paneHeader('Folders', FOLDERS_WIDTH),
      sunken(FOLDERS_WIDTH, height - PANE_HEADER_HEIGHT),
    );
    view.children[1]!.y = PANE_HEADER_HEIGHT;
    const tree: { icon: string; label: string; depth: number }[] = [
      { icon: 'outlook-express', label: 'Outlook Express', depth: 0 },
      { icon: 'folder', label: 'Local Folders', depth: 1 },
      { icon: 'folder-open', label: 'Inbox', depth: 2 },
      { icon: 'folder', label: 'Outbox', depth: 2 },
      { icon: 'folder', label: 'Sent Items', depth: 2 },
      { icon: 'folder', label: 'Deleted Items', depth: 2 },
      { icon: 'folder', label: 'Drafts', depth: 2 },
    ];
    let inbox: Text | null = null;
    tree.forEach(({ icon, label, depth }, i) => {
      const y = PANE_HEADER_HEIGHT + 6 + i * 20;
      const sprite = iconSprite(icon, 16);
      sprite.position.set(6 + depth * 16, y);
      const text = xpText(label);
      text.anchor.set(0, 0.5);
      text.position.set(sprite.x + 20, y + 8);
      view.addChild(sprite, text);
      if (label === 'Inbox') inbox = text;
    });
    if (!inbox) throw new Error('Outlook Express has no Inbox');
    return { view, inbox };
  }

  /** Column headers over the message list */
  private messageList(): Container {
    const view = new Container({ label: 'message-list' });
    const width = this.listWidth;
    const header = new Graphics()
      .rect(0, 0, width, PANE_HEADER_HEIGHT)
      .fill(LUNA.face)
      .rect(0, PANE_HEADER_HEIGHT - 1, width, 1)
      .fill(LUNA.edgeShadow);
    view.addChild(header);
    for (const { x, label } of COLUMNS) {
      if (x > 0) header.rect(x, 3, 1, PANE_HEADER_HEIGHT - 6).fill(LUNA.edgeShadow);
      const text = xpText(label);
      text.anchor.set(0, 0.5);
      text.position.set(x + 5, PANE_HEADER_HEIGHT / 2);
      view.addChild(text);
    }
    const list = sunken(width, LIST_HEIGHT);
    list.y = PANE_HEADER_HEIGHT;
    this.row.y = PANE_HEADER_HEIGHT;
    view.addChild(list, this.row);
    return view;
  }

  /** Create Mail, Print, Delete, Send/Recv, Addresses, Find: decoration */
  private toolbar(width: number): Container {
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
    const buttons: [string, string][] = [
      ['email', 'Create Mail'],
      ['printer', 'Print'],
      ['delete', 'Delete'],
      ['network-global', 'Send/Recv'],
      ['users', 'Addresses'],
      ['search', 'Find'],
    ];
    for (const [icon, label] of buttons) {
      const button = toolbarButton(iconSprite(icon, 24), label, false, null);
      button.view.position.set(x, 3);
      bar.addChild(button.view);
      x += button.width + 2;
    }
    return bar;
  }
}

/** A pane's grey header strip with its title */
function paneHeader(title: string, width: number): Container {
  const view = new Container({ label: `header-${title}` });
  view.addChild(
    new Graphics()
      .rect(0, 0, width, PANE_HEADER_HEIGHT)
      .fill(LUNA.face)
      .rect(0, PANE_HEADER_HEIGHT - 1, width, 1)
      .fill(LUNA.edgeShadow),
  );
  const text = xpText(title);
  text.anchor.set(0, 0.5);
  text.position.set(6, PANE_HEADER_HEIGHT / 2);
  view.addChild(text);
  return view;
}

/** A white pane with the thin blue-grey edge of XP list views */
function sunken(width: number, height: number): Graphics {
  return new Graphics()
    .rect(0, 0, width, height)
    .fill(XP_PROGRAMS.paper)
    .stroke({ width: 1, color: XP_PROGRAMS.sunkenEdge, alignment: 1 });
}

/** Blue underlined link text that responds to clicks */
function linkText(text: string, onTap: () => void): Container {
  const view = new Container({ label: 'link' });
  const label = xpText(text, {
    fontFamily: ['Arial', 'sans-serif'],
    fontSize: 13,
    fill: XP_PROGRAMS.link,
  });
  view.addChild(
    label,
    new Graphics()
      .rect(0, Math.round(label.height) - 2, Math.ceil(label.width), 1)
      .fill(XP_PROGRAMS.link),
  );
  view.eventMode = 'static';
  view.cursor = XP_LINK_CURSOR;
  view.hitArea = new Rectangle(0, 0, label.width, label.height);
  view.on('pointertap', onTap);
  return view;
}
