// Contents of the settings window (doc/settings.md): the current save's difficulty on the left; calibration,
// "Skip tutorial" and "Beat Guide" in the middle; every keyboard shortcut on the right. Changes go straight to
// PlayerSettings and the save; the panel also follows changes made elsewhere (H in a level). Radio buttons, check
// boxes, sliders, group boxes and text come from each scene in its native style, like the results panel
// (src/ui/results-panel.ts). Top-left at (0, 0).

import { Container, type Text } from 'pixi.js';
import { CALIBRATION_LIMIT_MS, type PlayerSettings, type SettingValues } from '@/game/settings.ts';
import { shortcutGroups } from '@/game/shortcuts.ts';
import {
  DIFFICULTIES,
  DIFFICULTY_LABELS,
  DIFFICULTY_SPEEDS,
  formatSpeed,
  type Difficulty,
} from '@/rhythm/difficulty.ts';
import type { PanelTextStyle } from './results-panel.ts';

export interface CheckBoxWidget {
  view: Container;
  height: number;
  setChecked(checked: boolean): void;
}

export interface RadioButtonWidget {
  view: Container;
  height: number;
  setSelected(selected: boolean): void;
}

export interface ButtonWidget {
  view: Container;
  width: number;
  height: number;
}

export interface SliderWidget {
  view: Container;
  height: number;
  /** Thumb position, 0 at the left end to 1 at the right */
  setFraction(fraction: number): void;
}

/** Widgets each scene supplies in its native style */
export interface SettingsKit {
  text(text: string, style: PanelTextStyle): Text;
  /** Titled group box; inner is the content container, top-left at the box's padding */
  groupBox(title: string, width: number, height: number): { view: Container; inner: Container };
  /** Width and height taken by the group box padding (left + right, top + bottom) */
  groupInset: { x: number; y: number };
  /** A labelled check box; onToggle is called on a click */
  checkBox(label: string, onToggle: () => void): CheckBoxWidget;
  /** A labelled radio button; onSelect is called on a click */
  radioButton(label: string, onSelect: () => void): RadioButtonWidget;
  /** A horizontal slider `width` wide; onChange gets the new fraction (0–1) while dragging */
  slider(width: number, onChange: (fraction: number) => void): SliderWidget;
  /** A push button sized to its label */
  button(label: string, onTap: () => void): ButtonWidget;
  /** The latency test button's label, in the system's ellipsis style ("..." on XP, "…" on the Mac) */
  testLatencyLabel: string;
  /** Caption text colour */
  muted: string;
  /** The scene's name for the Enter key in the shortcut list ("Enter" / "Return") */
  enterKey: string;
  /** Base UI text size */
  textSize: number;
}

/** The current save's difficulty (doc/difficulty.md), which the panel shows and sets */
export interface DifficultyControl {
  readonly value: Difficulty;
  set(difficulty: Difficulty): void;
  /** Called after any change to the saves; returns a function that stops listening */
  onChange(listener: () => void): () => void;
}

export interface SettingsPanelOptions {
  settings: PlayerSettings;
  difficulty: DifficultyControl;
  width: number;
  height: number;
  kit: SettingsKit;
  /** "Test Latency…": opens the system's latency test (doc/latency-test.md) */
  onTestLatency: () => void;
}

export interface SettingsPanel {
  view: Container;
  /** ← / → in the window: move the calibration by `deltaMs` */
  nudgeCalibration(deltaMs: number): void;
  /** Stops following the settings; call before destroying the view */
  destroy(): void;
}

/** The Difficulty column */
const DIFFICULTY_WIDTH = 230;
/** The calibration, practice and beat guide column */
const LEFT_WIDTH = 300;
const GAP = 12;
/** Rows of the difficulty radio buttons */
const RADIO_ROW_HEIGHT = 24;
const CALIBRATION_HEIGHT = 166;
const CHECK_GROUP_HEIGHT = 84;
/** Rows of the shortcut table */
const ROW_HEIGHT = 15;
const HEADING_HEIGHT = 18;
const HEADING_GAP = 5;
const KEY_COLUMN = 112;

export function createSettingsPanel({
  settings,
  difficulty,
  width,
  height,
  kit,
  onTestLatency,
}: SettingsPanelOptions): SettingsPanel {
  const panel = new Container({ label: 'settings-panel' });
  const size = kit.textSize;
  const innerLeft = LEFT_WIDTH - kit.groupInset.x;

  // ---- Difficulty ----
  const difficultyGroup = kit.groupBox('Difficulty', DIFFICULTY_WIDTH, height);
  const innerDifficulty = DIFFICULTY_WIDTH - kit.groupInset.x;
  const intro = kit.text('Chart speed for this save:', { size });
  difficultyGroup.inner.addChild(intro);
  const radioTop = Math.ceil(intro.height) + 10;
  const radios = DIFFICULTIES.map((choice, i) => {
    const radio = kit.radioButton(DIFFICULTY_LABELS[choice], () => difficulty.set(choice));
    const top = radioTop + i * RADIO_ROW_HEIGHT;
    radio.view.position.set(4, top);
    const speed = kit.text(formatSpeed(choice), { size, color: kit.muted });
    speed.anchor.set(1, 0.5);
    speed.position.set(innerDifficulty, top + radio.height / 2);
    difficultyGroup.inner.addChild(radio.view, speed);
    return radio;
  });
  const difficultyNote = kit.text('', {
    size: size - 1,
    color: kit.muted,
    wrapWidth: innerDifficulty,
    lineHeight: size + 3,
  });
  difficultyNote.position.set(0, radioTop + DIFFICULTIES.length * RADIO_ROW_HEIGHT + 8);
  difficultyGroup.inner.addChild(difficultyNote);
  panel.addChild(difficultyGroup.view);
  const renderDifficulty = () => {
    const current = difficulty.value;
    DIFFICULTIES.forEach((choice, i) => radios[i]!.setSelected(choice === current));
    const speed = DIFFICULTY_SPEEDS[current];
    const pace =
      speed === 1 ? 'Charts play at their own tempo' : `Charts play at ${speed}× their own tempo`;
    difficultyNote.text =
      `${pace}, and the scores you keep are multiplied by ${speed} and marked ${DIFFICULTY_LABELS[current]}. ` +
      'Other saves keep their own difficulty; a change applies from the next level.';
  };
  renderDifficulty();
  const stopDifficulty = difficulty.onChange(renderDifficulty);

  // ---- The middle column ----
  const middle = new Container({ label: 'middle' });
  middle.x = DIFFICULTY_WIDTH + GAP;
  panel.addChild(middle);

  // ---- Calibration ----
  const calibration = kit.groupBox('Input Latency', LEFT_WIDTH, CALIBRATION_HEIGHT);
  const value = kit.text('', { size, bold: true });
  const valueNote = kit.text('', { size, color: kit.muted });
  const slider = kit.slider(innerLeft, (fraction) => {
    const ms = (fraction * 2 - 1) * CALIBRATION_LIMIT_MS;
    settings.setCalibrationMs(ms);
  });
  const label = kit.text('Calibration:', { size });
  value.position.set(Math.ceil(label.width) + 6, 0);
  const test = kit.button(kit.testLatencyLabel, onTestLatency);
  test.view.position.set(innerLeft - test.width, -3);
  valueNote.position.set(0, 26);
  const sliderTop = 48;
  slider.view.position.set(0, sliderTop);
  const ends = [`−${CALIBRATION_LIMIT_MS} ms`, '0', `+${CALIBRATION_LIMIT_MS} ms`].map(
    (text, i) => {
      const end = kit.text(text, { size: size - 1, color: kit.muted });
      end.anchor.set(i / 2, 0);
      end.position.set((innerLeft * i) / 2, sliderTop + slider.height + 2);
      return end;
    },
  );
  const help = kit.text(
    'Raise it if you press late, lower it if early; ← → change it by 1 ms. Test Latency measures it for you.',
    { size: size - 1, color: kit.muted, wrapWidth: innerLeft, lineHeight: size + 3 },
  );
  help.position.set(0, sliderTop + slider.height + 20);
  calibration.inner.addChild(label, value, test.view, valueNote, slider.view, ...ends, help);
  middle.addChild(calibration.view);

  // ---- Check boxes ----
  const checkGroup = (
    title: string,
    boxLabel: string,
    note: string,
    top: number,
    onToggle: () => void,
  ): CheckBoxWidget => {
    const group = kit.groupBox(title, LEFT_WIDTH, CHECK_GROUP_HEIGHT);
    group.view.y = top;
    const box = kit.checkBox(boxLabel, onToggle);
    const caption = kit.text(note, {
      size: size - 1,
      color: kit.muted,
      wrapWidth: innerLeft,
      lineHeight: size + 3,
    });
    caption.position.set(0, box.height + 6);
    group.inner.addChild(box.view, caption);
    middle.addChild(group.view);
    return box;
  };
  const skipTop = CALIBRATION_HEIGHT + GAP;
  const skip = checkGroup(
    'Practice',
    'Skip tutorial',
    'Play every level without the action demos. Backspace skips the rest of a level’s demos.',
    skipTop,
    () => settings.setSkipTutorial(!settings.values.skipTutorial),
  );
  const guide = checkGroup(
    'Beat Guide',
    'Show the Beat Guide in levels',
    'H turns it on or off in a level too. Scores set with it on are marked.',
    skipTop + CHECK_GROUP_HEIGHT + GAP,
    () => settings.setBeatGuide(!settings.values.beatGuide),
  );

  // ---- Shortcuts ----
  const rightX = middle.x + LEFT_WIDTH + GAP;
  const rightWidth = width - rightX;
  const shortcuts = kit.groupBox('Keyboard Shortcuts', rightWidth, height);
  shortcuts.view.x = rightX;
  let y = 0;
  for (const group of shortcutGroups(kit.enterKey)) {
    if (y > 0) y += HEADING_GAP;
    const heading = kit.text(group.where, { size, bold: true });
    heading.position.set(0, y);
    shortcuts.inner.addChild(heading);
    y += HEADING_HEIGHT;
    for (const { keys, does } of group.shortcuts) {
      const key = kit.text(keys, { size: size - 1 });
      key.position.set(8, y);
      const what = kit.text(does, { size: size - 1, color: kit.muted });
      what.position.set(KEY_COLUMN, y);
      shortcuts.inner.addChild(key, what);
      y += ROW_HEIGHT;
    }
  }
  panel.addChild(shortcuts.view);

  // ---- Follow the settings ----
  const render = ({ calibrationMs, skipTutorial, beatGuide }: SettingValues) => {
    value.text = `${calibrationMs > 0 ? '+' : calibrationMs < 0 ? '−' : ''}${Math.abs(calibrationMs)} ms`;
    valueNote.text =
      calibrationMs === 0
        ? 'Presses count as they arrive.'
        : `Presses count ${Math.abs(calibrationMs)} ms ${calibrationMs > 0 ? 'earlier' : 'later'}.`;
    slider.setFraction((calibrationMs / CALIBRATION_LIMIT_MS + 1) / 2);
    skip.setChecked(skipTutorial);
    guide.setChecked(beatGuide);
  };
  render(settings.values);
  const unsubscribe = settings.onChange(render);

  return {
    view: panel,
    nudgeCalibration: (deltaMs) => {
      settings.setCalibrationMs(settings.values.calibrationMs + deltaMs);
    },
    destroy: () => {
      unsubscribe();
      stopDifficulty();
    },
  };
}
