// IE6 file download window (doc/scenes/windows-xp-levels.md "Waits and holds"): the globe-to-folder animation,
// file name and green block progress bar, time left, destination and speed, then "Open", "Open Folder" and
// "Cancel". Both Open buttons stay disabled until done; then the title reads "Download complete",
// Open becomes the default button and Cancel turns into Close.
// Origin at the window centre for the open and close scaling.

import { Container, Graphics, Sprite } from 'pixi.js';
import { LUNA } from '@/theme/xp-luna.ts';
import { xpAssets } from '@/scenes/windows-xp/assets.ts';
import { BUTTON_HEIGHT, BUTTON_WIDTH, XpButton } from './button.ts';
import { verticalGradient } from './draw.ts';
import { CAPTION_HEIGHT, FRAME_WIDTH, XpWindowFrame } from './window-frame.ts';
import { xpText } from './xp-text.ts';

const CLIENT_WIDTH = 354;
const PADDING = 11;
const ANIMATION_HEIGHT = 40;
const BAR_HEIGHT = 15;
const CHUNK_WIDTH = 6;
const CHUNK_GAP = 2;
const BUTTON_GAP = 6;
const OPEN_FOLDER_WIDTH = 88;
/** Width of the left-hand labels ("Estimated time left:" etc.) */
const LABEL_WIDTH = 120;
const ROW_HEIGHT = 17;

export interface XpDownloadDialogOptions {
  /** File being downloaded, e.g. setup.exe */
  fileName: string;
  /** File size (KB), for "xx KB of yy KB copied" */
  sizeKb: number;
  /** Site it comes from */
  host: string;
}

export class XpDownloadDialog {
  readonly view: Container;
  readonly width: number;
  readonly height: number;
  readonly frame: XpWindowFrame;
  private readonly options: XpDownloadDialogOptions;
  private readonly bar = new Graphics();
  private readonly barWidth: number;
  private readonly paper: Sprite;
  private readonly heading = xpText('');
  private readonly timeLeft = xpText('');
  private readonly timeLeftLabel = xpText('Estimated time left:');
  private readonly open = new XpButton({ label: 'Open' });
  private readonly openFolder = new XpButton({ label: 'Open Folder', width: OPEN_FOLDER_WIDTH });
  private readonly cancel = new XpButton({ label: 'Cancel' });
  private readonly close = new XpButton({ label: 'Close' });
  /** XpButton fixes its default look when built, so completion swaps in a default Open button */
  private readonly openDefault = new XpButton({ label: 'Open', isDefault: true });
  private progress = -1;

  constructor(options: XpDownloadDialogOptions) {
    this.options = options;
    const client = new Container({ label: 'client' });
    client.position.set(FRAME_WIDTH, CAPTION_HEIGHT);

    // Flying paper: globe on the left, open folder on the right, a page flying between them
    const globe = icon('internet', 32);
    globe.position.set(PADDING + 4, PADDING);
    const folder = icon('folder-open', 32);
    folder.position.set(CLIENT_WIDTH - PADDING - 36, PADDING);
    this.paper = icon('text-document', 16);
    this.paper.anchor.set(0.5);

    let y = PADDING + ANIMATION_HEIGHT;
    this.heading.position.set(PADDING, y);
    y += ROW_HEIGHT + 2;

    this.barWidth = CLIENT_WIDTH - PADDING * 2;
    this.bar.position.set(PADDING, y);
    y += BAR_HEIGHT + 8;

    const rows: [Container, Container][] = [
      [this.timeLeftLabel, this.timeLeft],
      // The folder, not the file: with a file name the path runs past the window's right edge
      [xpText('Download to:'), xpText('C:\\Documents and Settings\\...\\Desktop')],
      [xpText('Transfer rate:'), xpText('48.0 KB/Sec')],
    ];
    const rowViews: Container[] = [];
    for (const [left, value] of rows) {
      left.position.set(PADDING, y);
      value.position.set(PADDING + LABEL_WIDTH, y);
      rowViews.push(left, value);
      y += ROW_HEIGHT;
    }
    y += 10;

    // Buttons on the right: Open, Open Folder, Cancel / Close
    const buttons = [this.open, this.openFolder, this.cancel];
    const buttonsWidth = BUTTON_WIDTH * 2 + OPEN_FOLDER_WIDTH + BUTTON_GAP * 2;
    let x = CLIENT_WIDTH - PADDING - buttonsWidth;
    for (const button of buttons) {
      button.view.position.set(x, y);
      x += button.width + BUTTON_GAP;
    }
    this.openDefault.view.position.copyFrom(this.open.view.position);
    this.close.view.position.copyFrom(this.cancel.view.position);
    y += BUTTON_HEIGHT + PADDING;

    this.width = CLIENT_WIDTH + FRAME_WIDTH * 2;
    this.height = CAPTION_HEIGHT + y + FRAME_WIDTH;
    this.view = new Container({ label: `download-${options.fileName}` });
    this.view.pivot.set(Math.round(this.width / 2), Math.round(this.height / 2));
    this.frame = new XpWindowFrame({
      title: '',
      width: this.width,
      height: this.height,
      icon: 'internet-explorer',
    });

    client.addChild(
      globe,
      folder,
      this.paper,
      this.heading,
      this.bar,
      ...rowViews,
      ...[this.open, this.openDefault, this.openFolder, this.cancel, this.close].map((b) => b.view),
    );
    this.view.addChild(this.frame.view, client);
    this.setProgress(0);
  }

  /** Progress 0–1; at 1 it switches to the completed look */
  setProgress(progress: number): void {
    const p = Math.min(1, Math.max(0, progress));
    if (p === this.progress) return;
    this.progress = p;
    const done = p >= 1;
    const { fileName, sizeKb, host } = this.options;

    this.frame.setTitle(
      done ? 'Download complete' : `${Math.floor(p * 100)}% of ${fileName} Completed`,
    );
    this.heading.text = done ? 'Download Complete' : `${fileName} from ${host}`;
    const copied = Math.round(sizeKb * p);
    this.timeLeftLabel.text = done ? 'Downloaded:' : 'Estimated time left:';
    this.timeLeft.text = done
      ? `${sizeKb} KB in 1 sec`
      : `${Math.max(1, Math.ceil((1 - p) * 2))} sec (${copied} KB of ${sizeKb} KB copied)`;

    this.open.view.visible = !done;
    this.openDefault.view.visible = done;
    this.open.setEnabled(false);
    this.openFolder.setEnabled(done);
    this.cancel.view.visible = !done;
    this.close.view.visible = done;
    // Once complete the page rests inside the folder, out of sight
    this.paper.visible = !done;
    if (!done) {
      const fly = (p * 3) % 1;
      const fromX = PADDING + 20;
      const toX = CLIENT_WIDTH - PADDING - 20;
      this.paper.position.set(
        fromX + (toX - fromX) * fly,
        PADDING + 16 - Math.sin(Math.PI * fly) * 12,
      );
    }
    this.drawBar(p);
  }

  /** The player (or the virtual mouse) clicked Open */
  setOpenPressed(pressed: boolean): void {
    this.openDefault.setPressed(pressed);
  }

  setActive(active: boolean): void {
    this.frame.setActive(active);
  }

  /** Open button centre relative to the window centre, for the virtual mouse */
  openCenter(): { x: number; y: number } {
    const button = this.open;
    return {
      x: FRAME_WIDTH + button.view.x + button.width / 2 - this.view.pivot.x,
      y: CAPTION_HEIGHT + button.view.y + button.height / 2 - this.view.pivot.y,
    };
  }

  destroy(): void {
    this.view.destroy({ children: true });
  }

  /** Thin grey rounded border, white track, green blocks filling left to right */
  private drawBar(progress: number): void {
    const { progress: style } = LUNA;
    const w = this.barWidth;
    const g = this.bar.clear();
    g.roundRect(0, 0, w, BAR_HEIGHT, 3).fill(style.border);
    g.roundRect(1, 1, w - 2, BAR_HEIGHT - 2, 2).fill(style.track);
    const inner = w - 6;
    const filled = Math.round(inner * progress);
    const chunk = verticalGradient(style.chunk);
    for (let x = 0; x + CHUNK_WIDTH <= filled; x += CHUNK_WIDTH + CHUNK_GAP) {
      g.rect(3 + x, 3, CHUNK_WIDTH, BAR_HEIGHT - 6).fill(chunk);
    }
  }
}

function icon(name: string, size: number): Sprite {
  const sprite = new Sprite(xpAssets().icon(name));
  sprite.setSize(size);
  return sprite;
}
