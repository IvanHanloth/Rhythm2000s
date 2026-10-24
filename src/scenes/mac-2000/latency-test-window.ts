// Latency test window (doc/latency-test.md), opened from the preferences window's "Test Latency…": a pinstriped
// Aqua window around the shared latency test panel (src/ui/latency-test-panel.ts), with "Back",
// "Use Suggested Value" and a pulsing default "Start" / "Measure Again" at the bottom right. Origin at the centre.

import { Container, Rectangle } from 'pixi.js';
import type { LatencyTestWindowOptions } from '@/scenes/shared/level-scene.ts';
import { AQUA } from '@/theme/aqua.ts';
import { LatencyTestPanel, type LatencyTestKit } from '@/ui/latency-test-panel.ts';
import { aquaText } from './components/paint.ts';
import { PUSH_BUTTON_HEIGHT, PushButton } from './components/push-button.ts';
import { AquaWindow, TITLE_BAR_HEIGHT } from './components/window.ts';
import { MAC_GROUP_INSET, macGroupBox, macPanelText, wirePushButton } from './panel-kit.ts';

export const LATENCY_TEST_TITLE = 'Latency Test';
const WIDTH = 600;
const PADDING_X = 18;
const PADDING_Y = 14;
/** Hit radius around the red close button */
const CLOSE_HIT = 9;
/** Opacity of a button that can't be pressed yet */
const DISABLED_ALPHA = 0.45;

const kit: LatencyTestKit = {
  text: macPanelText,
  groupBox: macGroupBox,
  groupInset: MAC_GROUP_INSET,
  muted: AQUA.inkSoft,
  textSize: 12,
  colors: AQUA.latencyTest,
};

export class MacLatencyTestWindow {
  readonly view: Container;
  private readonly window: AquaWindow;
  private readonly panel: LatencyTestPanel;
  private readonly start: PushButton;
  private readonly again: PushButton;
  private readonly use: PushButton;
  private readonly options: LatencyTestWindowOptions;

  constructor(options: LatencyTestWindowOptions) {
    this.options = options;
    const contentWidth = WIDTH - PADDING_X * 2;
    this.panel = new LatencyTestPanel({
      clock: options.clock,
      settings: options.settings,
      width: contentWidth,
      kit,
      onChange: () => this.refresh(),
    });
    const buttonsTop = PADDING_Y + this.panel.height + 14;
    const height = TITLE_BAR_HEIGHT + buttonsTop + PUSH_BUTTON_HEIGHT + PADDING_Y;
    this.window = new AquaWindow({
      title: LATENCY_TEST_TITLE,
      width: WIDTH,
      height,
      toolbarButton: false,
      growBox: false,
    });
    this.view = this.window.view;

    const close = new Container({ label: 'close-hit' });
    close.eventMode = 'static';
    const { x, y } = this.window.closeCenter;
    close.hitArea = new Rectangle(
      x + this.view.pivot.x - CLOSE_HIT,
      y + this.view.pivot.y - CLOSE_HIT,
      CLOSE_HIT * 2,
      CLOSE_HIT * 2,
    );
    close.on('pointertap', () => this.back());
    this.view.addChild(close);

    this.start = new PushButton({ label: 'Start', isDefault: true });
    this.again = new PushButton({ label: 'Measure Again', isDefault: true });
    this.use = new PushButton({ label: 'Use Suggested Value' });
    const back = new PushButton({ label: 'Back' });
    wirePushButton(this.start, () => this.measure());
    wirePushButton(this.again, () => this.measure());
    wirePushButton(this.use, () => this.useSuggestion());
    wirePushButton(back, () => this.back());
    // Right to left, default rightmost (the Aqua convention): Start / Measure Again, Use Suggested Value, Back
    let right = WIDTH - PADDING_X;
    for (const button of [this.start, this.again]) {
      button.view.position.set(right - button.width, buttonsTop);
    }
    right -= this.again.width + 12;
    for (const button of [this.use, back]) {
      right -= button.width;
      button.view.position.set(right, buttonsTop);
      right -= 12;
    }

    this.panel.view.position.set(PADDING_X, PADDING_Y);
    const hint = aquaText('R: measure again · Esc: back', { size: 11, color: AQUA.inkSoft });
    hint.anchor.set(0, 0.5);
    hint.position.set(PADDING_X, buttonsTop + PUSH_BUTTON_HEIGHT / 2);
    this.window.content.addChild(
      this.panel.view,
      hint,
      back.view,
      this.use.view,
      this.start.view,
      this.again.view,
    );
    this.refresh();
  }

  /** Every frame: the run follows the heard audio time and the default button pulses */
  update(audioTime: number): void {
    this.panel.update(audioTime);
    this.start.update(audioTime);
    this.again.update(audioTime);
  }

  onTap(audioTime: number): void {
    this.panel.press(audioTime);
  }

  /** Return presses the default button (Start / Measure Again); R measures again */
  onKeyDown(event: KeyboardEvent): void {
    if (event.repeat) return;
    if (event.code === 'Enter' || event.code === 'KeyR') this.measure();
  }

  onEscape(): void {
    this.back();
  }

  destroy(): void {
    this.panel.destroy();
    this.window.destroy();
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

  /** "Start" before the first run, "Measure Again" after; dimmed while they can't be pressed */
  private refresh(): void {
    const state = this.panel.state;
    const busy = state === 'starting' || state === 'running';
    const first = state === 'idle' && this.panel.suggestionMs === null;
    this.start.view.visible = first;
    this.again.view.visible = !first;
    this.again.view.alpha = busy ? DISABLED_ALPHA : 1;
    this.use.view.alpha = state === 'done' && this.panel.suggestionMs !== null ? 1 : DISABLED_ALPHA;
  }
}
