// Settings window (doc/settings.md), opened from the Apple menu's "System Preferences…": a pinstriped Aqua window
// around the shared settings panel (src/ui/settings-panel.ts) with a pulsing default "OK" button. The red close
// button closes it too. Changes apply at once. Origin at the centre.

import { Container, Rectangle } from 'pixi.js';
import { AQUA } from '@/theme/aqua.ts';
import type { SettingsWindowOptions } from '@/scenes/shared/level-scene.ts';
import { createSettingsPanel, type SettingsKit, type SettingsPanel } from '@/ui/settings-panel.ts';
import { AquaCheckBox } from './components/check-box.ts';
import { AquaRadioButton } from './components/radio-button.ts';
import { aquaText } from './components/paint.ts';
import { PUSH_BUTTON_HEIGHT, PushButton } from './components/push-button.ts';
import { AquaSlider } from './components/slider.ts';
import { AquaWindow, TITLE_BAR_HEIGHT } from './components/window.ts';
import { MAC_GROUP_INSET, macGroupBox, macPanelText, wirePushButton } from './panel-kit.ts';

export const SETTINGS_TITLE = 'Rhythm 2000s Preferences';
/** Wide enough for the Difficulty column beside the original two (doc/settings.md "Layout") */
const WIDTH = 930;
const HEIGHT = 470;
const PADDING_X = 18;
const PADDING_Y = 14;
/** Hit radius around the red close button */
const CLOSE_HIT = 9;

const kit: SettingsKit = {
  text: macPanelText,
  groupBox: macGroupBox,
  groupInset: MAC_GROUP_INSET,
  checkBox: (label, onToggle) => new AquaCheckBox(label, onToggle),
  radioButton: (label, onSelect) => new AquaRadioButton(label, onSelect),
  slider: (width, onChange) => new AquaSlider(width, onChange),
  button: (label, onTap) => {
    const button = new PushButton({ label });
    wirePushButton(button, onTap);
    return { view: button.view, width: button.width, height: PUSH_BUTTON_HEIGHT };
  },
  testLatencyLabel: 'Test Latency…',
  muted: AQUA.inkSoft,
  enterKey: 'Return',
  textSize: 12,
};

export class MacSettingsWindow {
  readonly view: Container;
  private readonly window: AquaWindow;
  private readonly panel: SettingsPanel;
  private readonly ok: PushButton;
  private readonly onClose: () => void;

  constructor({ settings, difficulty, onClose, onTestLatency }: SettingsWindowOptions) {
    this.onClose = onClose;
    this.window = new AquaWindow({
      title: SETTINGS_TITLE,
      width: WIDTH,
      height: HEIGHT,
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
    close.on('pointertap', onClose);
    this.view.addChild(close);

    const content = this.window.content;
    const contentWidth = WIDTH - PADDING_X * 2;
    const contentHeight = HEIGHT - TITLE_BAR_HEIGHT - PADDING_Y * 2;
    const buttonsTop = PADDING_Y + contentHeight - PUSH_BUTTON_HEIGHT;

    this.panel = createSettingsPanel({
      settings,
      difficulty,
      width: contentWidth,
      height: contentHeight - PUSH_BUTTON_HEIGHT - 14,
      kit,
      onTestLatency,
    });
    this.panel.view.position.set(PADDING_X, PADDING_Y);
    const hint = aquaText('Changes apply at once.    Return / Esc: close', {
      size: 11,
      color: AQUA.inkSoft,
    });
    hint.anchor.set(0, 0.5);
    hint.position.set(PADDING_X, buttonsTop + PUSH_BUTTON_HEIGHT / 2);
    this.ok = new PushButton({ label: 'OK', isDefault: true });
    this.ok.view.position.set(WIDTH - PADDING_X - this.ok.width, buttonsTop);
    wirePushButton(this.ok, onClose);
    content.addChild(this.panel.view, hint, this.ok.view);
  }

  /** Call every frame with the audio time so "OK" pulses */
  update(audioTime: number): void {
    this.ok.update(audioTime);
  }

  /** Return closes; ← → fine-tune the calibration (held keys repeat) */
  onKeyDown(event: KeyboardEvent): void {
    if (event.code === 'Enter' && !event.repeat) this.onClose();
    else if (event.code === 'ArrowLeft') this.panel.nudgeCalibration(-1);
    else if (event.code === 'ArrowRight') this.panel.nudgeCalibration(1);
  }

  destroy(): void {
    this.panel.destroy();
    this.window.destroy();
  }
}
