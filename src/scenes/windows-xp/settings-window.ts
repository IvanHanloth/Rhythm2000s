// Settings window (doc/settings.md), opened from "start" → "Control Panel": a Luna dialog around the shared
// settings panel (src/ui/settings-panel.ts) with an "OK" button. Changes apply at once. Origin at the centre.

import { Container } from 'pixi.js';
import type { SettingsWindowOptions } from '@/scenes/shared/level-scene.ts';
import { createSettingsPanel, type SettingsKit, type SettingsPanel } from '@/ui/settings-panel.ts';
import { BUTTON_HEIGHT, XpButton } from './components/button.ts';
import { XpCheckBox } from './components/check-box.ts';
import { XpTrackbar } from './components/trackbar.ts';
import { CAPTION_HEIGHT, FRAME_WIDTH, XpWindowFrame } from './components/window-frame.ts';
import { XP_FONT_SIZE, xpText } from './components/xp-text.ts';
import {
  wireXpButton,
  XP_GROUP_INSET,
  XP_PANEL_MUTED,
  xpGroupBox,
  xpPanelText,
} from './panel-kit.ts';

export const SETTINGS_TITLE = 'Rhythm 2000s Settings';
const WIDTH = 688;
const HEIGHT = 470;
const PADDING = 14;
/** Calibration ticks every 50 ms across ±300 ms */
const TICKS = 13;

const kit: SettingsKit = {
  text: xpPanelText,
  groupBox: xpGroupBox,
  groupInset: XP_GROUP_INSET,
  checkBox: (label, onToggle) => new XpCheckBox(label, onToggle),
  slider: (width, onChange) => new XpTrackbar(width, TICKS, onChange),
  muted: XP_PANEL_MUTED,
  enterKey: 'Enter',
  textSize: XP_FONT_SIZE,
};

export class XpSettingsWindow {
  readonly view = new Container({ label: 'settings' });
  private readonly frame: XpWindowFrame;
  private readonly panel: SettingsPanel;
  private readonly onClose: () => void;

  constructor({ settings, onClose }: SettingsWindowOptions) {
    this.onClose = onClose;
    this.view.pivot.set(WIDTH / 2, HEIGHT / 2);
    this.frame = new XpWindowFrame({ title: SETTINGS_TITLE, width: WIDTH, height: HEIGHT });
    this.frame.closeButton.view.eventMode = 'static';
    this.frame.closeButton.view.on('pointertap', onClose);

    const client = new Container({ label: 'client' });
    client.position.set(FRAME_WIDTH + PADDING, CAPTION_HEIGHT + PADDING);
    const clientWidth = WIDTH - FRAME_WIDTH * 2 - PADDING * 2;
    const clientHeight = HEIGHT - CAPTION_HEIGHT - FRAME_WIDTH - PADDING * 2;
    const buttonsTop = clientHeight - BUTTON_HEIGHT;

    this.panel = createSettingsPanel({
      settings,
      width: clientWidth,
      height: buttonsTop - 12,
      kit,
    });
    const hint = xpText('Changes apply at once.    Enter / Esc: close', { fill: XP_PANEL_MUTED });
    hint.anchor.set(0, 0.5);
    hint.position.set(0, buttonsTop + BUTTON_HEIGHT / 2);
    const ok = new XpButton({ label: 'OK', isDefault: true });
    ok.view.position.set(clientWidth - ok.width, buttonsTop);
    wireXpButton(ok, onClose);
    client.addChild(this.panel.view, hint, ok.view);
    this.view.addChild(this.frame.view, client);
  }

  /** Enter closes; ← → fine-tune the calibration (held keys repeat) */
  onKeyDown(event: KeyboardEvent): void {
    if (event.code === 'Enter' && !event.repeat) this.onClose();
    else if (event.code === 'ArrowLeft') this.panel.nudgeCalibration(-1);
    else if (event.code === 'ArrowRight') this.panel.nudgeCalibration(1);
  }

  destroy(): void {
    this.panel.destroy();
    this.view.destroy({ children: true });
  }
}
