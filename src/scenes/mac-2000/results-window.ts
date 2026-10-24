// 结算窗口（doc/results.md）：Aqua 细条纹窗口，里面是共用的结算内容（src/ui/results-panel.ts），
// 右下「重试」「选关」「下一关」三个推按钮可以用鼠标点，默认按钮是蓝色并会呼吸。原点在窗口中心。

import { Container, Graphics } from 'pixi.js';
import type { ResultSummary } from '../../rhythm/result-summary.ts';
import { AQUA } from '../../theme/aqua.ts';
import { createResultsPanel, type ResultsKit } from '../../ui/results-panel.ts';
import { aquaText } from './components/paint.ts';
import { PUSH_BUTTON_HEIGHT, PushButton } from './components/push-button.ts';
import { AquaWindow, TITLE_BAR_HEIGHT } from './components/window.ts';

export const RESULTS_WIDTH = 688;
export const RESULTS_HEIGHT = 448;
const PADDING_X = 18;
const PADDING_Y = 14;

export interface MacResultsOptions {
  title: string;
  summary: ResultSummary;
  newRecord: boolean;
  /** 列表里还有下一关；没有时「下一关」灰掉，默认按钮换成「重试」 */
  hasNext: boolean;
  onRetry: () => void;
  onList: () => void;
  onNext: () => void;
}

/** Aqua 分组框：半透明白底、灰色细边的圆角框，粗体标题写在框里左上角 */
const kit: ResultsKit = {
  text: (text, { size, bold, color, wrapWidth, lineHeight }) =>
    aquaText(text, {
      size,
      ...(bold !== undefined && { bold }),
      ...(color !== undefined && { color }),
      ...(wrapWidth !== undefined && { wrapWidth }),
      ...(lineHeight !== undefined && { lineHeight }),
    }),
  groupBox(title, width, height) {
    const view = new Container({ label: `group-${title}` });
    const box = new Graphics()
      .roundRect(0.5, 0.5, width - 1, height - 1, 6)
      .fill({ color: AQUA.white, alpha: 0.4 })
      .stroke({ width: 1, color: AQUA.separator });
    const label = aquaText(title, { size: 12, bold: true });
    label.position.set(10, 7);
    const inner = new Container({ label: 'inner' });
    inner.position.set(10, 30);
    view.addChild(box, label, inner);
    return { view, inner };
  },
  groupInset: { x: 20, y: 40 },
  muted: AQUA.inkSoft,
  accent: AQUA.selection,
};

export class MacResultsWindow {
  readonly view: Container;
  private readonly window: AquaWindow;
  private readonly buttons: PushButton[] = [];

  constructor(options: MacResultsOptions) {
    const width = RESULTS_WIDTH;
    const height = RESULTS_HEIGHT;
    this.window = new AquaWindow({
      title: `结算 — ${options.title}`,
      width,
      height,
      toolbarButton: false,
      growBox: false,
    });
    this.view = this.window.view;

    const content = this.window.content;
    const contentWidth = width - PADDING_X * 2;
    const contentHeight = height - TITLE_BAR_HEIGHT - PADDING_Y * 2;
    const buttonsTop = PADDING_Y + contentHeight - PUSH_BUTTON_HEIGHT;

    const panel = createResultsPanel({
      summary: options.summary,
      newRecord: options.newRecord,
      width: contentWidth,
      height: contentHeight - PUSH_BUTTON_HEIGHT - 14,
      kit,
    });
    panel.position.set(PADDING_X, PADDING_Y);

    const hint = aquaText(`回车 ${options.hasNext ? '下一关' : '重试'} · R 重试 · Esc 选关`, {
      size: 11,
      color: AQUA.inkSoft,
    });
    hint.anchor.set(0, 0.5);
    hint.position.set(PADDING_X, buttonsTop + PUSH_BUTTON_HEIGHT / 2);
    content.addChild(panel, hint);

    // 从右往左排，默认按钮在最右（Aqua 的规矩）
    const specs: [string, () => void, boolean, boolean][] = [
      ['下一关', options.onNext, options.hasNext, options.hasNext],
      ['选关', options.onList, false, true],
      ['重试', options.onRetry, !options.hasNext, true],
    ];
    let right = width - PADDING_X;
    for (const [label, onTap, isDefault, enabled] of specs) {
      const button = new PushButton({ label, isDefault });
      right -= button.width;
      button.view.position.set(right, buttonsTop);
      right -= 12;
      if (enabled) {
        button.view.eventMode = 'static';
        button.view.on('pointerdown', () => (button.view.alpha = 0.75));
        button.view.on('pointerout', () => (button.view.alpha = 1));
        button.view.on('pointertap', () => {
          button.view.alpha = 1;
          onTap();
        });
      } else {
        button.view.alpha = 0.45;
      }
      this.buttons.push(button);
      content.addChild(button.view);
    }
  }

  /** 每帧传入音频时间，让默认按钮呼吸 */
  update(audioTime: number): void {
    for (const button of this.buttons) button.update(audioTime);
  }

  destroy(): void {
    this.window.destroy();
  }
}
