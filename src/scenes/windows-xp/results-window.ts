// 结算窗口（doc/results.md）：Luna 窗口，里面是共用的结算内容（src/ui/results-panel.ts），
// 底部「Retry」「Levels」「Next Level」三个按钮可以用鼠标点。原点在窗口中心，方便做弹出动画。

import { Container, Graphics } from 'pixi.js';
import { LUNA } from '@/theme/xp-luna.ts';
import type { ResultsWindowOptions } from '@/scenes/shared/level-scene.ts';
import { createResultsPanel, type ResultsKit } from '@/ui/results-panel.ts';
import { BUTTON_HEIGHT, XpButton } from './components/button.ts';
import { CAPTION_HEIGHT, FRAME_WIDTH, XpWindowFrame } from './components/window-frame.ts';
import { xpText } from './components/xp-text.ts';

export const RESULTS_WIDTH = 688;
export const RESULTS_HEIGHT = 448;
const PADDING = 14;
/** Luna 分组框（GroupBox）：浅灰细边圆角框，蓝色标题压在上边线上 */
const GROUP_BORDER = '#d0d0bf';
const GROUP_TITLE = '#0046d5';

const kit: ResultsKit = {
  text: (text, { size, bold, color, wrapWidth, lineHeight }) =>
    xpText(text, {
      fontSize: size,
      fontWeight: bold ? '700' : '400',
      fill: color ?? LUNA.ink,
      ...(lineHeight !== undefined && { lineHeight }),
      ...(wrapWidth !== undefined && {
        wordWrap: true,
        wordWrapWidth: wrapWidth,
        breakWords: true,
      }),
    }),
  groupBox(title, width, height) {
    const view = new Container({ label: `group-${title}` });
    const label = xpText(title, { fill: GROUP_TITLE });
    const top = Math.round(label.height / 2);
    const box = new Graphics()
      .roundRect(0.5, top + 0.5, width - 1, height - top - 1, 3)
      .stroke({ width: 1, color: GROUP_BORDER })
      // 标题背后垫一块窗口底色，把边线断开
      .rect(6, 0, Math.ceil(label.width) + 6, label.height)
      .fill(LUNA.face);
    label.position.set(9, 0);
    const inner = new Container({ label: 'inner' });
    inner.position.set(10, top + 14);
    view.addChild(box, label, inner);
    return { view, inner };
  },
  groupInset: { x: 20, y: 30 },
  muted: '#57533f',
  accent: LUNA.selection,
};

export class XpResultsWindow {
  readonly view = new Container({ label: 'results' });
  readonly frame: XpWindowFrame;

  constructor(options: ResultsWindowOptions) {
    const width = RESULTS_WIDTH;
    const height = RESULTS_HEIGHT;
    this.view.pivot.set(width / 2, height / 2);
    this.frame = new XpWindowFrame({ title: `Results — ${options.title}`, width, height });
    this.frame.closeButton.view.eventMode = 'static';
    this.frame.closeButton.view.on('pointertap', options.onList);

    const client = new Container({ label: 'client' });
    client.position.set(FRAME_WIDTH + PADDING, CAPTION_HEIGHT + PADDING);
    const clientWidth = width - FRAME_WIDTH * 2 - PADDING * 2;
    const clientHeight = height - CAPTION_HEIGHT - FRAME_WIDTH - PADDING * 2;
    const buttonsTop = clientHeight - BUTTON_HEIGHT;

    const panel = createResultsPanel({
      summary: options.summary,
      newRecord: options.newRecord,
      assisted: options.assisted,
      width: clientWidth,
      height: buttonsTop - 12,
      kit,
    });

    const hint = xpText(
      `Enter: ${options.hasNext ? 'Next Level' : 'Retry'} · R: Retry · Esc: Levels`,
      {
        fill: kit.muted,
      },
    );
    hint.anchor.set(0, 0.5);
    hint.position.set(0, buttonsTop + BUTTON_HEIGHT / 2);
    client.addChild(panel, hint);

    const buttons: [string, () => void, boolean][] = [
      ['Retry', options.onRetry, !options.hasNext],
      ['Levels', options.onList, false],
      ['Next Level', options.onNext, options.hasNext],
    ];
    let right = clientWidth;
    for (const [label, onTap, isDefault] of buttons.reverse()) {
      const button = new XpButton({ label, isDefault });
      right -= button.width;
      button.view.position.set(right, buttonsTop);
      right -= 6;
      const enabled = label !== 'Next Level' || options.hasNext;
      if (enabled) wireButton(button, onTap);
      else button.view.alpha = 0.45;
      client.addChild(button.view);
    }

    this.view.addChild(this.frame.view, client);
  }

  destroy(): void {
    this.view.destroy({ children: true });
  }
}

/** 悬停变橙、按下变暗，和原版一样 */
function wireButton(button: XpButton, onTap: () => void): void {
  button.view.eventMode = 'static';
  button.view.on('pointerover', () => button.setHot(true));
  button.view.on('pointerout', () => {
    button.setHot(false);
    button.setPressed(false);
  });
  button.view.on('pointerdown', () => button.setPressed(true));
  button.view.on('pointertap', onTap);
}
