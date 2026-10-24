// HackerEditor on XP (doc/chart-editor.md): a Luna program window with the shared editor panel
// (src/ui/hacker-editor-panel.ts) in Luna buttons, check boxes and edit controls. The title follows the chart,
// "Untitled - HackerEditor" like Notepad. Origin at the top left.

import { Container, Graphics, Rectangle, Sprite } from 'pixi.js';
import type { ActionType } from '@/rhythm/actions.ts';
import type { EditorWindow, EditorWindowOptions } from '@/scenes/shared/level-scene.ts';
import { LUNA } from '@/theme/xp-luna.ts';
import {
  type EditorButton,
  type EditorKit,
  type FieldWidget,
  HackerEditorPanel,
  type ToggleWidget,
} from '@/ui/hacker-editor-panel.ts';
import { xpAssets } from './assets.ts';
import { XpButton } from './components/button.ts';
import { XpCheckBox } from './components/check-box.ts';
import { CAPTION_HEIGHT, FRAME_WIDTH, XpWindowFrame } from './components/window-frame.ts';
import { XP_FONT_SIZE, xpText } from './components/xp-text.ts';
import { XP_GROUP_INSET, XP_PANEL_MUTED, xpGroupBox, xpPanelText } from './panel-kit.ts';

export const EDITOR_TITLE = 'HackerEditor';
/** Taskbar and title bar icon */
export const EDITOR_ICON = 'command-prompt';
const PADDING = 10;
const FIELD_HEIGHT = 20;

/** Icon for each XP action in the palette and lanes (provisional picks from the original icon set) */
const ACTION_ICONS: Partial<Record<ActionType, string>> = {
  'dialog-info': 'dialog-info',
  'dialog-warning': 'dialog-warning',
  'dialog-error': 'dialog-error',
  'dialog-question': 'dialog-question',
  'desktop-refresh': 'my-computer',
  'balloon-info': 'network',
  'window-minimize': 'program-window',
  'start-menu': 'windows-logo',
  'recycle-bin': 'recycle-bin-full',
  'progress-download': 'internet-explorer',
  'volume-mute': 'speaker',
  // 3D Pinball, XP's own 3D game, for the cutaway to the 3D café (doc/cross-dimension.md)
  'chair-swivel': 'pinball',
};

function iconOf(action: ActionType, size: number): Container {
  const name = ACTION_ICONS[action];
  if (!name) throw new Error(`No XP icon for action ${action}`);
  const sprite = new Sprite(xpAssets().icon(name));
  sprite.setSize(size);
  return sprite;
}

/** Hover turns the border orange; a disabled button ignores clicks */
function button(label: string, onTap: () => void, width?: number): EditorButton {
  const probe = xpText(label);
  const button = new XpButton({
    label,
    width: width ?? Math.max(44, Math.ceil(probe.width) + 16),
    height: 22,
  });
  probe.destroy();
  let enabled = true;
  const view = button.view;
  view.eventMode = 'static';
  view.on('pointerover', () => button.setHot(enabled));
  view.on('pointerout', () => {
    button.setHot(false);
    button.setPressed(false);
  });
  view.on('pointerdown', () => button.setPressed(enabled));
  view.on('pointertap', () => {
    button.setPressed(false);
    if (enabled) onTap();
  });
  return {
    view,
    width: button.width,
    height: button.height,
    setEnabled(value) {
      enabled = value;
      button.setEnabled(value);
    },
  };
}

/** A push button that stays pressed while on, its icon and label left-aligned */
function toggle(
  label: string,
  icon: Container | null,
  width: number,
  onTap: () => void,
): ToggleWidget {
  const button = new XpButton({ label: icon ? '' : label, width, height: 22 });
  if (icon) {
    icon.position.set(5, 3);
    const text = xpText(label);
    text.anchor.set(0, 0.5);
    text.position.set(26, 11);
    button.view.addChild(icon, text);
  }
  let on = false;
  const view = button.view;
  view.eventMode = 'static';
  view.on('pointerover', () => button.setHot(!on));
  view.on('pointerout', () => {
    button.setHot(false);
    button.setPressed(on);
  });
  view.on('pointerdown', () => button.setPressed(true));
  view.on('pointertap', onTap);
  return {
    view,
    width,
    height: button.height,
    setOn(value) {
      on = value;
      button.setPressed(value);
      if (value) button.setHot(false);
    },
  };
}

/** Luna edit control: a white field in a thin blue-grey border, with a caret while typing */
function field(width: number, onPress: () => void): FieldWidget {
  const view = new Container({ label: 'field' });
  const box = new Graphics()
    .rect(0, 0, width, FIELD_HEIGHT)
    .fill(LUNA.edit.border)
    .rect(1, 1, width - 2, FIELD_HEIGHT - 2)
    .fill(LUNA.edit.fill);
  const text = xpText('');
  text.anchor.set(0, 0.5);
  text.position.set(4, FIELD_HEIGHT / 2);
  const caret = new Graphics().rect(0, 4, 1, FIELD_HEIGHT - 8).fill(LUNA.ink);
  const clip = new Graphics().rect(1, 1, width - 2, FIELD_HEIGHT - 2).fill(LUNA.white);
  text.mask = clip;
  view.addChild(box, clip, text, caret);
  view.eventMode = 'static';
  view.cursor = 'text';
  view.hitArea = new Rectangle(0, 0, width, FIELD_HEIGHT);
  view.on('pointertap', onPress);
  return {
    view,
    height: FIELD_HEIGHT,
    setText(value, editing) {
      text.text = value;
      caret.visible = editing;
      caret.x = Math.min(width - 3, text.x + Math.ceil(text.width) + 1);
    },
  };
}

const kit: EditorKit = {
  text: xpPanelText,
  groupBox: xpGroupBox,
  groupInset: XP_GROUP_INSET,
  button,
  toggle,
  checkBox: (label, onToggle) => new XpCheckBox(label, onToggle),
  field,
  actionIcon: iconOf,
  colors: {
    window: LUNA.white,
    ink: LUNA.ink,
    muted: XP_PANEL_MUTED,
    line: LUNA.hackerEditor.line,
    beat: LUNA.hackerEditor.beat,
    selection: LUNA.selection,
    onSelection: LUNA.white,
    call: LUNA.hackerEditor.call,
    response: LUNA.hackerEditor.response,
    problem: LUNA.hackerEditor.problem,
  },
  ellipsis: '...',
  commandKey: 'Ctrl',
  textSize: XP_FONT_SIZE,
};

export class XpEditorWindow implements EditorWindow {
  readonly view = new Container({ label: 'hacker-editor-window' });
  readonly panel: HackerEditorPanel;
  private readonly frame: XpWindowFrame;

  constructor(
    { editor, actions, textEntry, handlers, onClose }: EditorWindowOptions,
    width: number,
    height: number,
  ) {
    this.frame = new XpWindowFrame({
      title: EDITOR_TITLE,
      width,
      height,
      icon: EDITOR_ICON,
      controls: 'all',
    });
    const face = new Graphics()
      .rect(
        FRAME_WIDTH,
        CAPTION_HEIGHT,
        width - FRAME_WIDTH * 2,
        height - CAPTION_HEIGHT - FRAME_WIDTH,
      )
      .fill(LUNA.face);
    this.frame.closeButton.view.eventMode = 'static';
    this.frame.closeButton.view.on('pointertap', onClose);
    this.panel = new HackerEditorPanel({
      editor,
      actions,
      width: width - FRAME_WIDTH * 2 - PADDING * 2,
      height: height - CAPTION_HEIGHT - FRAME_WIDTH - PADDING * 2,
      kit,
      textEntry,
      handlers,
      onRefresh: () => this.frame.setTitle(`${editor.draft.title} - ${EDITOR_TITLE}`),
    });
    this.panel.view.position.set(FRAME_WIDTH + PADDING, CAPTION_HEIGHT + PADDING);
    this.view.addChild(face, this.frame.view, this.panel.view);
  }

  setActive(active: boolean): void {
    this.frame.setActive(active);
    this.view.interactiveChildren = active;
  }

  destroy(): void {
    this.panel.destroy();
    this.view.destroy({ children: true });
  }
}
