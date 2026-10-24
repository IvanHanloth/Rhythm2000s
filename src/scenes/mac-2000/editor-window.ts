// HackerEditor on the Mac (doc/chart-editor.md): a pinstriped Aqua document window with the shared editor panel
// (src/ui/hacker-editor-panel.ts) in Aqua widgets. The editor is dense, so it uses the small control size of the
// original (11 pt Lucida Grande labels, small push buttons) and group boxes with tighter padding than the settings
// window's. As in Mac OS X, the window title is just the document's name (the chart title) and the application's name,
// "HackerEditor", is in the menu bar. Origin at the centre, like every AquaWindow.

import { Container, Graphics, Rectangle } from 'pixi.js';
import type { ActionType } from '@/rhythm/actions.ts';
import type { EditorWindow, EditorWindowOptions } from '@/scenes/shared/level-scene.ts';
import { AQUA, type GelColors } from '@/theme/aqua.ts';
import {
  type EditorButton,
  type EditorKit,
  type FieldWidget,
  HackerEditorPanel,
  type ToggleWidget,
} from '@/ui/hacker-editor-panel.ts';
import { isMacAction, type MacAction } from './action-kinds.ts';
import { appIcon, type AppIconName } from './assets.ts';
import { AquaCheckBox } from './components/check-box.ts';
import {
  drawAppleLogo,
  drawCautionIcon,
  drawDocumentIcon,
  drawTrashIcon,
} from './components/icons.ts';
import { aquaText, drawGelPill, vGradient } from './components/paint.ts';
import { drawSpeakerIcon } from './components/volume-menu.ts';
import { AquaWindow } from './components/window.ts';
import { macPanelText } from './panel-kit.ts';

/** The application's name in the menu bar */
export const EDITOR_TITLE = 'HackerEditor';
/** Aqua's small system font */
const TEXT_SIZE = 11;
const PADDING_X = 10;
const PADDING_Y = 8;
/** Hit radius around the red close button */
const CLOSE_HIT = 9;
/** Buttons and toggles take a 20 px row; the small push button capsule is 18 px of it */
const CONTROL_HEIGHT = 20;
const SMALL_BUTTON_HEIGHT = 18;
const FIELD_HEIGHT = 20;
/** Group box padding: title row at the top, then the contents */
const GROUP_INSET = { x: 16, y: 30 };
const GROUP_TOP = 22;
const GROUP_SIDE = 8;

type IconPick = AppIconName | 'caution' | 'trash' | 'apple' | 'document' | 'speaker';

/**
 * Icon for each Mac action in the palette and lanes (provisional picks): the caution triangle, the Apple, the Trash
 * and the menu bar speaker are the widgets themselves; note and stop alerts show their application's icon in the
 * original, here Software Update's (System Preferences) and the crashed iTunes; Safari bounces when a download ends.
 */
const ACTION_ICONS: Record<MacAction, IconPick> = {
  'alert-note': 'System Preferences',
  'alert-caution': 'caution',
  'alert-stop': 'iTunes',
  'dock-bounce': 'Safari',
  'mail-new': 'Mail',
  'window-miniaturize': 'TextEdit',
  'menu-apple': 'apple',
  'dock-trash': 'trash',
  'sheet-save': 'document',
  'ichat-message': 'iChat',
  'menu-volume': 'speaker',
};

function actionIcon(action: ActionType, size: number): Container {
  if (!isMacAction(action)) throw new Error(`No Mac icon for action ${action}`);
  const pick = ACTION_ICONS[action];
  switch (pick) {
    case 'caution':
      return drawCautionIcon(size);
    case 'trash':
      return drawTrashIcon(size, { full: true });
    case 'document':
      return drawDocumentIcon(size);
    case 'apple': {
      // 20×24 units: centred across the square
      const holder = new Container({ label: 'apple-icon' });
      const logo = drawAppleLogo(size);
      logo.x = (size - (size * 20) / 24) / 2;
      holder.addChild(logo);
      return holder;
    }
    case 'speaker': {
      // About 18×16: centred down the square
      const holder = new Container({ label: 'speaker-icon' });
      const speaker = drawSpeakerIcon();
      speaker.scale.set(size / 18);
      speaker.y = (size - (16 * size) / 18) / 2;
      holder.addChild(speaker);
      return holder;
    }
    default:
      return appIcon(pick, size);
  }
}

/** Aqua group box with the small font's tighter padding: translucent white, thin grey rounded border, bold title */
function groupBox(title: string, width: number, height: number) {
  const view = new Container({ label: `group-${title}` });
  const box = new Graphics()
    .roundRect(0.5, 0.5, width - 1, height - 1, 6)
    .fill({ color: AQUA.white, alpha: 0.4 })
    .stroke({ width: 1, color: AQUA.separator });
  const label = aquaText(title, { size: TEXT_SIZE, bold: true });
  label.position.set(GROUP_SIDE, 5);
  const inner = new Container({ label: 'inner' });
  inner.position.set(GROUP_SIDE, GROUP_TOP);
  view.addChild(box, label, inner);
  return { view, inner };
}

/**
 * Small push button: a white gel capsule with an 11 pt label. Pressing dims it; a disabled one is faded with grey
 * text and ignores clicks.
 */
function button(label: string, onTap: () => void, width?: number): EditorButton {
  const text = aquaText(label, { size: TEXT_SIZE });
  const w = width ?? Math.max(44, Math.ceil(text.width) + 20);
  const view = new Container({ label: `button-${label}` });
  const pill = drawGelPill(
    new Graphics(),
    0,
    (CONTROL_HEIGHT - SMALL_BUTTON_HEIGHT) / 2,
    w,
    SMALL_BUTTON_HEIGHT,
    AQUA.gel.white,
  );
  text.anchor.set(0.5);
  text.position.set(w / 2, CONTROL_HEIGHT / 2);
  view.addChild(pill, text);
  let enabled = true;
  view.eventMode = 'static';
  view.hitArea = new Rectangle(0, 0, w, CONTROL_HEIGHT);
  view.on('pointerdown', () => {
    if (enabled) pill.alpha = 0.75;
  });
  view.on('pointerout', () => {
    if (enabled) pill.alpha = 1;
  });
  view.on('pointertap', () => {
    if (!enabled) return;
    pill.alpha = 1;
    onTap();
  });
  return {
    view,
    width: w,
    height: CONTROL_HEIGHT,
    setEnabled(value) {
      enabled = value;
      pill.alpha = value ? 1 : 0.5;
      text.style.fill = value ? AQUA.ink : AQUA.inkMuted;
    },
  };
}

/** Square-cornered gel, like the original's bevel buttons: white when off, blue while on */
function drawGelBevel(g: Graphics, width: number, colors: GelColors): Graphics {
  const h = CONTROL_HEIGHT;
  return g
    .clear()
    .roundRect(0, 1, width, h, 4)
    .fill({ color: AQUA.shadow, alpha: 0.16 })
    .roundRect(0, 0, width, h, 4)
    .fill(colors.rim)
    .roundRect(1, 1, width - 2, h - 2, 3)
    .fill(
      vGradient([
        [0, colors.top],
        [0.5, colors.mid],
        [1, colors.glow],
      ]),
    )
    .roundRect(3, 1.5, width - 6, h * 0.42, 2)
    .fill({ color: AQUA.white, alpha: 0.55 });
}

/** A bevel button that stays blue while on, its icon and label left-aligned (or the label centred without an icon) */
function toggle(
  label: string,
  icon: Container | null,
  width: number,
  onTap: () => void,
): ToggleWidget {
  const view = new Container({ label: `toggle-${label}` });
  const face = new Graphics();
  const text = aquaText(label, { size: TEXT_SIZE });
  view.addChild(face);
  if (icon) {
    icon.position.set(5, (CONTROL_HEIGHT - 16) / 2);
    text.anchor.set(0, 0.5);
    text.position.set(26, CONTROL_HEIGHT / 2);
    view.addChild(icon);
  } else {
    text.anchor.set(0.5);
    text.position.set(width / 2, CONTROL_HEIGHT / 2);
  }
  view.addChild(text);
  let on: boolean | null = null;
  view.eventMode = 'static';
  view.hitArea = new Rectangle(0, 0, width, CONTROL_HEIGHT);
  view.on('pointerdown', () => (face.alpha = 0.75));
  view.on('pointerout', () => (face.alpha = 1));
  view.on('pointertap', () => {
    face.alpha = 1;
    onTap();
  });
  const widget: ToggleWidget = {
    view,
    width,
    height: CONTROL_HEIGHT,
    setOn(value) {
      if (value === on) return;
      on = value;
      drawGelBevel(face, width, value ? AQUA.gel.blue : AQUA.gel.white);
    },
  };
  widget.setOn(false);
  return widget;
}

/** Bezeled text field: white, grey border darker along the top; the blue focus ring and a black caret while typing */
function field(width: number, onPress: () => void): FieldWidget {
  const view = new Container({ label: 'field' });
  const focus = new Graphics()
    .roundRect(-1.5, -1.5, width + 3, FIELD_HEIGHT + 3, 3)
    .stroke({ width: 3, color: AQUA.edit.focus, alpha: 0.8 });
  const box = new Graphics()
    .rect(0, 0, width, FIELD_HEIGHT)
    .fill(AQUA.edit.side)
    .rect(0, 0, width, 1)
    .fill(AQUA.edit.top)
    .rect(1, 1, width - 2, FIELD_HEIGHT - 2)
    .fill(AQUA.edit.fill);
  const text = aquaText('', { size: TEXT_SIZE });
  text.anchor.set(0, 0.5);
  text.position.set(4, FIELD_HEIGHT / 2);
  const caret = new Graphics().rect(0, 4, 1, FIELD_HEIGHT - 8).fill(AQUA.ink);
  const clip = new Graphics().rect(1, 1, width - 2, FIELD_HEIGHT - 2).fill(AQUA.white);
  text.mask = clip;
  view.addChild(focus, box, clip, text, caret);
  view.eventMode = 'static';
  view.cursor = 'text';
  view.hitArea = new Rectangle(0, 0, width, FIELD_HEIGHT);
  view.on('pointertap', onPress);
  return {
    view,
    height: FIELD_HEIGHT,
    setText(value, editing) {
      text.text = value;
      focus.visible = editing;
      caret.visible = editing;
      caret.x = Math.min(width - 3, text.x + Math.ceil(text.width) + 1);
    },
  };
}

const kit: EditorKit = {
  text: macPanelText,
  groupBox,
  groupInset: GROUP_INSET,
  button,
  toggle,
  checkBox: (label, onToggle) => new AquaCheckBox(label, onToggle),
  field,
  actionIcon,
  colors: {
    window: AQUA.white,
    ink: AQUA.ink,
    muted: AQUA.inkSoft,
    line: AQUA.hackerEditor.line,
    beat: AQUA.hackerEditor.beat,
    selection: AQUA.selection,
    onSelection: AQUA.white,
    call: AQUA.hackerEditor.call,
    response: AQUA.hackerEditor.response,
    problem: AQUA.hackerEditor.problem,
  },
  ellipsis: '…',
  commandKey: '⌘',
  textSize: TEXT_SIZE,
};

export class MacEditorWindow implements EditorWindow {
  readonly view: Container;
  readonly panel: HackerEditorPanel;
  private readonly window: AquaWindow;

  constructor(
    { editor, actions, textEntry, handlers, onClose }: EditorWindowOptions,
    width: number,
    height: number,
  ) {
    this.window = new AquaWindow({
      title: editor.draft.title,
      width,
      height,
      toolbarButton: false,
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

    const window = this.window;
    this.panel = new HackerEditorPanel({
      editor,
      actions,
      width: window.contentWidth - PADDING_X * 2,
      height: window.contentHeight - PADDING_Y * 2,
      kit,
      textEntry,
      handlers,
      onRefresh: () => window.setTitle(editor.draft.title),
    });
    this.panel.view.position.set(PADDING_X, PADDING_Y);
    window.content.addChild(this.panel.view);
  }

  setActive(active: boolean): void {
    this.window.setActive(active);
    this.view.interactiveChildren = active;
  }

  destroy(): void {
    this.panel.destroy();
    this.window.destroy();
  }
}
