// Latency test window (doc/latency-test.md), opened from the settings window's "Test Latency...": a Luna dialog
// around the shared latency test panel (src/ui/latency-test-panel.ts), with "Start" / "Measure Again",
// "Use Suggested Value" and "Back". Origin at the centre.

import { Container } from 'pixi.js';
import type { LatencyTestWindowOptions } from '@/scenes/shared/level-scene.ts';
import { LUNA } from '@/theme/xp-luna.ts';
import { LatencyTestPanel, type LatencyTestKit } from '@/ui/latency-test-panel.ts';
import { BUTTON_HEIGHT, type XpButton } from './components/button.ts';
import { CAPTION_HEIGHT, FRAME_WIDTH, XpWindowFrame } from './components/window-frame.ts';
import { XP_FONT_SIZE, xpText } from './components/xp-text.ts';
import {
  wireXpButton,
  XP_GROUP_INSET,
  XP_PANEL_MUTED,
  xpGroupBox,
  xpLabelButton,
  xpPanelText,
} from './panel-kit.ts';

export const LATENCY_TEST_TITLE = 'Latency Test';
const WIDTH = 520;
const PADDING = 14;

const kit: LatencyTestKit = {
  text: xpPanelText,
  groupBox: xpGroupBox,
  groupInset: XP_GROUP_INSET,
  muted: XP_PANEL_MUTED,
  textSize: XP_FONT_SIZE,
  colors: LUNA.latencyTest,
};

export class XpLatencyTestWindow {
  readonly view = new Container({ label: 'latency-test' });
  private readonly panel: LatencyTestPanel;
  private readonly start: XpButton;
  private readonly again: XpButton;
  private readonly use: XpButton;
  private readonly options: LatencyTestWindowOptions;

  constructor(options: LatencyTestWindowOptions) {
    this.options = options;
    const clientWidth = WIDTH - FRAME_WIDTH * 2 - PADDING * 2;
    this.panel = new LatencyTestPanel({
      clock: options.clock,
      settings: options.settings,
      width: clientWidth,
      kit,
      onChange: () => this.refresh(),
    });
    const buttonsTop = this.panel.height + 14;
    const height = CAPTION_HEIGHT + PADDING + buttonsTop + BUTTON_HEIGHT + PADDING + FRAME_WIDTH;
    this.view.pivot.set(WIDTH / 2, height / 2);

    const frame = new XpWindowFrame({ title: LATENCY_TEST_TITLE, width: WIDTH, height });
    frame.closeButton.view.eventMode = 'static';
    frame.closeButton.view.on('pointertap', () => this.back());

    const client = new Container({ label: 'client' });
    client.position.set(FRAME_WIDTH + PADDING, CAPTION_HEIGHT + PADDING);

    this.start = xpLabelButton('Start', true);
    this.again = xpLabelButton('Measure Again', true);
    this.use = xpLabelButton('Use Suggested Value');
    const back = xpLabelButton('Back');
    wireXpButton(this.start, () => this.measure());
    wireXpButton(this.again, () => this.measure());
    wireXpButton(this.use, () => this.useSuggestion());
    wireXpButton(back, () => this.back());
    // Right to left: Back, Use Suggested Value, then Start / Measure Again in the same place
    let right = clientWidth;
    for (const button of [back, this.use]) {
      right -= button.width;
      button.view.position.set(right, buttonsTop);
      right -= 6;
    }
    for (const button of [this.start, this.again]) {
      button.view.position.set(right - button.width, buttonsTop);
    }
    const hint = xpText('R: measure again    Esc: back', { fill: XP_PANEL_MUTED });
    hint.anchor.set(0, 0.5);
    hint.position.set(0, buttonsTop + BUTTON_HEIGHT / 2);

    client.addChild(
      this.panel.view,
      hint,
      this.start.view,
      this.again.view,
      this.use.view,
      back.view,
    );
    this.view.addChild(frame.view, client);
    this.refresh();
  }

  update(audioTime: number): void {
    this.panel.update(audioTime);
  }

  onTap(audioTime: number): void {
    this.panel.press(audioTime);
  }

  /** Enter presses the default button (Start / Measure Again); R measures again */
  onKeyDown(event: KeyboardEvent): void {
    if (event.repeat) return;
    if (event.code === 'Enter' || event.code === 'KeyR') this.measure();
  }

  onEscape(): void {
    this.back();
  }

  destroy(): void {
    this.panel.destroy();
    this.view.destroy({ children: true });
  }

  private measure(): void {
    const state = this.panel.state;
    if (state === 'starting' || state === 'running') return;
    void this.panel.start();
  }

  private useSuggestion(): void {
    const suggestion = this.panel.suggestionMs;
    if (this.panel.state !== 'done' || suggestion === null) return;
    this.options.settings.setCalibrationMs(suggestion);
    this.options.onBack();
  }

  private back(): void {
    this.panel.cancel();
    this.options.onBack();
  }

  /** "Start" before the first run, "Measure Again" after; disabled while a run is on */
  private refresh(): void {
    const state = this.panel.state;
    const busy = state === 'starting' || state === 'running';
    const first = state === 'idle' && this.panel.suggestionMs === null;
    this.start.view.visible = first;
    this.again.view.visible = !first;
    this.again.setEnabled(!busy);
    this.use.setEnabled(state === 'done' && this.panel.suggestionMs !== null);
  }
}
