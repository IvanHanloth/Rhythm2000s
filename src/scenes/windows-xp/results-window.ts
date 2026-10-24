// Results window (doc/results.md): a Luna window around the shared results panel (src/ui/results-panel.ts),
// with clickable "Retry", "Levels" and "Next Level" buttons. Origin at the centre for the pop-up animation.

import { Container } from 'pixi.js';
import { LUNA } from '@/theme/xp-luna.ts';
import type { ResultsWindowOptions } from '@/scenes/shared/level-scene.ts';
import { createResultsPanel, type ResultsKit } from '@/ui/results-panel.ts';
import { BUTTON_HEIGHT, XpButton } from './components/button.ts';
import { CAPTION_HEIGHT, FRAME_WIDTH, XpWindowFrame } from './components/window-frame.ts';
import { xpText } from './components/xp-text.ts';
import {
  wireXpButton,
  XP_GROUP_INSET,
  XP_PANEL_MUTED,
  xpGroupBox,
  xpPanelText,
} from './panel-kit.ts';

export const RESULTS_WIDTH = 688;
export const RESULTS_HEIGHT = 448;
const PADDING = 14;

const kit: ResultsKit = {
  text: xpPanelText,
  groupBox: xpGroupBox,
  groupInset: XP_GROUP_INSET,
  muted: XP_PANEL_MUTED,
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
      if (enabled) wireXpButton(button, onTap);
      else button.view.alpha = 0.45;
      client.addChild(button.view);
    }

    this.view.addChild(this.frame.view, client);
  }

  destroy(): void {
    this.view.destroy({ children: true });
  }
}
