// Results window (doc/results.md): a pinstriped Aqua window around the shared results panel (src/ui/results-panel.ts),
// with clickable "Retry", "Levels" and "Next Level" push buttons at the bottom right; the default is blue and pulses. Origin at the centre.

import type { Container } from 'pixi.js';
import { AQUA } from '@/theme/aqua.ts';
import type { ResultsWindowOptions } from '@/scenes/shared/level-scene.ts';
import { createResultsPanel, type ResultsKit } from '@/ui/results-panel.ts';
import { aquaText } from './components/paint.ts';
import { PUSH_BUTTON_HEIGHT, PushButton } from './components/push-button.ts';
import { AquaWindow, TITLE_BAR_HEIGHT } from './components/window.ts';
import { MAC_GROUP_INSET, macGroupBox, macPanelText, wirePushButton } from './panel-kit.ts';

export const RESULTS_WIDTH = 688;
export const RESULTS_HEIGHT = 448;
const PADDING_X = 18;
const PADDING_Y = 14;

const kit: ResultsKit = {
  text: macPanelText,
  groupBox: macGroupBox,
  groupInset: MAC_GROUP_INSET,
  muted: AQUA.inkSoft,
  accent: AQUA.selection,
};

export class MacResultsWindow {
  readonly view: Container;
  private readonly window: AquaWindow;
  private readonly buttons: PushButton[] = [];

  constructor(options: ResultsWindowOptions) {
    const width = RESULTS_WIDTH;
    const height = RESULTS_HEIGHT;
    this.window = new AquaWindow({
      title: `Results — ${options.title}`,
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
      difficulty: options.difficulty,
      newRecord: options.newRecord,
      assisted: options.assisted,
      cheat: options.cheat,
      width: contentWidth,
      height: contentHeight - PUSH_BUTTON_HEIGHT - 14,
      kit,
    });
    panel.position.set(PADDING_X, PADDING_Y);

    const hint = aquaText(
      `Return: ${options.hasNext ? 'Next Level' : 'Retry'} · R: Retry · Esc: Levels`,
      {
        size: 11,
        color: AQUA.inkSoft,
      },
    );
    hint.anchor.set(0, 0.5);
    hint.position.set(PADDING_X, buttonsTop + PUSH_BUTTON_HEIGHT / 2);
    content.addChild(panel, hint);

    // Laid out right to left, default rightmost (the Aqua convention)
    const specs: [string, () => void, boolean, boolean][] = [
      ['Next Level', options.onNext, options.hasNext, options.hasNext],
      ['Levels', options.onList, false, true],
      ['Retry', options.onRetry, !options.hasNext, true],
    ];
    let right = width - PADDING_X;
    for (const [label, onTap, isDefault, enabled] of specs) {
      const button = new PushButton({ label, isDefault });
      right -= button.width;
      button.view.position.set(right, buttonsTop);
      right -= 12;
      if (enabled) wirePushButton(button, onTap);
      else button.view.alpha = 0.45;
      this.buttons.push(button);
      content.addChild(button.view);
    }
  }

  /** Call every frame with the audio time so the default button pulses */
  update(audioTime: number): void {
    for (const button of this.buttons) button.update(audioTime);
  }

  destroy(): void {
    this.window.destroy();
  }
}
