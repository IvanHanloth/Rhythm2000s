// The title screen's save slots (doc/save-slots.md#title-screen): the Continue / Load Game / New Game menu items and
// the Load Game and New Game windows, XP-style DOM windows over the street like the café's level card.

import { cleanSaveName, SAVE_NAME_MAX_LENGTH, type SaveData } from '@/game/save-progress.ts';
import { SLOT_NUMBERS, type SaveSlots, type SlotNumber } from '@/game/save-slots.ts';
import {
  DEFAULT_DIFFICULTY,
  DIFFICULTIES,
  DIFFICULTY_LABELS,
  formatSpeed,
  type Difficulty,
} from '@/rhythm/difficulty.ts';
import { button, el } from './dom.ts';
import { slotDetails, SLOTS_FULL_NOTE, titleMenuState, type FinishedLevels } from './save-menu.ts';

export interface SaveWindowOptions {
  saves: SaveSlots;
  /** How many of the device's levels a save has finished */
  finishedLevels(save: Readonly<SaveData>): FinishedLevels;
  /** A save was loaded or created: leave the title screen for the street */
  onStart(): void;
  /** A window opened: anything else over the title (the credits) closes */
  onOpenWindow(): void;
}

/** What a Load Game row is doing besides showing the save */
type RowMode = { slot: SlotNumber; kind: 'rename' | 'delete' } | null;

export class SaveWindows {
  /** The menu items before "Credits" */
  readonly menuItems: HTMLElement[];
  /** Shown under the menu while all slots are full */
  readonly fullNote = el('p', 'hub-menu-note', SLOTS_FULL_NOTE);
  readonly loadWindow = el('section', 'hub-window hub-saves');
  readonly newWindow = el('section', 'hub-window hub-new-save');
  private readonly options: SaveWindowOptions;
  private readonly continueButton: HTMLButtonElement;
  private readonly loadButton: HTMLButtonElement;
  private readonly newButton: HTMLButtonElement;
  private readonly list = el('ol', 'hub-save-list');
  private readonly nameField = el('input', 'hub-save-input');
  private readonly newSlotLine = el('p', 'hub-save-hint');
  /** New Game's difficulty radio buttons (doc/difficulty.md#choosing-it) */
  private readonly difficultyInputs = new Map<Difficulty, HTMLInputElement>();
  private readonly startButton: HTMLButtonElement;
  private rowMode: RowMode = null;

  constructor(options: SaveWindowOptions) {
    this.options = options;
    this.continueButton = button('Continue', 'hub-button hub-button-primary', () =>
      this.continueCurrent(),
    );
    this.loadButton = button('Load Game', 'hub-button', () => this.openLoad());
    this.newButton = button('New Game', 'hub-button', () => this.openNew());
    this.menuItems = [this.continueButton, this.loadButton, this.newButton];

    this.loadWindow.setAttribute('aria-label', 'Load Game');
    const loadActions = el('div', 'hub-card-actions');
    loadActions.append(button('Close', 'hub-button', () => this.close()));
    this.loadWindow.append(el('div', 'hub-card-titlebar', 'Load Game'), this.list, loadActions);

    this.newWindow.setAttribute('aria-label', 'New Game');
    const form = el('form', 'hub-save-form');
    const label = el('label', 'hub-save-label', 'Name your save');
    this.nameField.type = 'text';
    this.nameField.maxLength = SAVE_NAME_MAX_LENGTH;
    this.nameField.spellcheck = false;
    this.nameField.autocomplete = 'off';
    this.nameField.addEventListener('input', () => {
      this.startButton.disabled = cleanSaveName(this.nameField.value) === null;
    });
    this.nameField.addEventListener('keydown', (event) => {
      if (event.code === 'Escape') this.close();
    });
    label.append(this.nameField);
    this.startButton = el('button', 'hub-button hub-button-primary', 'Start');
    this.startButton.type = 'submit';
    const newActions = el('div', 'hub-card-actions');
    newActions.append(
      this.startButton,
      button('Cancel', 'hub-button', () => this.close()),
    );
    form.append(label, this.newSlotLine, this.difficultyChoice(), newActions);
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      this.createNew();
    });
    this.newWindow.append(el('div', 'hub-card-titlebar', 'New Game'), form);

    this.close();
    options.saves.onChange(() => this.refresh());
  }

  /** New Game's five difficulties, slowest first, each with its speed */
  private difficultyChoice(): HTMLFieldSetElement {
    const choice = el('fieldset', 'hub-save-difficulty');
    choice.append(el('legend', 'hub-save-label', 'Difficulty'));
    const options = el('div', 'hub-save-options');
    for (const difficulty of DIFFICULTIES) {
      const option = el('label', 'hub-save-option');
      const input = el('input', '');
      input.type = 'radio';
      input.name = 'new-game-difficulty';
      input.value = difficulty;
      input.addEventListener('keydown', (event) => {
        if (event.code === 'Escape') this.close();
      });
      this.difficultyInputs.set(difficulty, input);
      option.append(
        input,
        el('span', 'hub-save-option-name', DIFFICULTY_LABELS[difficulty]),
        el('span', 'hub-save-option-speed', formatSpeed(difficulty)),
      );
      options.append(option);
    }
    choice.append(
      options,
      el(
        'p',
        'hub-save-hint',
        'How fast charts play. Scores you keep are multiplied by the speed. You can change it later in the settings.',
      ),
    );
    return choice;
  }

  /** The difficulty picked in New Game */
  private pickedDifficulty(): Difficulty {
    for (const [difficulty, input] of this.difficultyInputs) {
      if (input.checked) return difficulty;
    }
    throw new Error('No difficulty is picked in New Game');
  }

  /** A Load Game or New Game window is open */
  get windowOpen(): boolean {
    return !this.loadWindow.hidden || !this.newWindow.hidden;
  }

  /** Closes the open window; false when none was */
  close(): boolean {
    const was = this.windowOpen;
    this.loadWindow.hidden = true;
    this.newWindow.hidden = true;
    this.rowMode = null;
    this.refresh();
    return was;
  }

  /** Enter or Space on the title screen: the first item shown and enabled */
  pickDefault(): void {
    const item = titleMenuState(this.options.saves).defaultItem;
    if (item === 'continue') this.continueCurrent();
    else if (item === 'new') this.openNew();
    else this.openLoad();
  }

  /** Brings the menu items and the open list up to date with the saves */
  refresh(): void {
    const state = titleMenuState(this.options.saves);
    this.continueButton.hidden = state.continueName === null;
    if (state.continueName !== null)
      this.continueButton.textContent = `Continue: ${state.continueName}`;
    this.loadButton.disabled = !state.loadEnabled;
    this.newButton.disabled = !state.newEnabled;
    this.newButton.title = state.newEnabled ? '' : SLOTS_FULL_NOTE;
    this.fullNote.hidden = state.newEnabled;
    if (!this.loadWindow.hidden) this.renderList();
  }

  private continueCurrent(): void {
    const slot = this.options.saves.currentSlot;
    if (slot === null) return;
    this.start(slot);
  }

  private start(slot: SlotNumber): void {
    this.options.saves.load(slot);
    this.close();
    this.options.onStart();
  }

  private openLoad(): void {
    if (!this.options.saves.hasSaves) return;
    this.options.onOpenWindow();
    this.newWindow.hidden = true;
    this.loadWindow.hidden = false;
    this.rowMode = null;
    this.renderList();
  }

  private openNew(): void {
    const slot = this.options.saves.firstEmptySlot;
    if (slot === null) return;
    this.options.onOpenWindow();
    this.loadWindow.hidden = true;
    this.newWindow.hidden = false;
    this.nameField.value = `Save ${slot}`;
    this.startButton.disabled = false;
    this.newSlotLine.textContent = `Goes into save slot ${slot}.`;
    for (const [difficulty, input] of this.difficultyInputs) {
      input.checked = difficulty === DEFAULT_DIFFICULTY;
    }
    this.nameField.focus();
    this.nameField.select();
  }

  private createNew(): void {
    const slot = this.options.saves.firstEmptySlot;
    const name = cleanSaveName(this.nameField.value);
    if (slot === null || name === null) return;
    this.nameField.blur();
    this.options.saves.create(slot, name, this.pickedDifficulty());
    this.close();
    this.options.onStart();
  }

  private renderList(): void {
    this.list.replaceChildren(...SLOT_NUMBERS.map((slot) => this.renderRow(slot)));
    const field = this.list.querySelector<HTMLInputElement>('input');
    if (field) {
      field.focus();
      field.select();
    }
  }

  private renderRow(slot: SlotNumber): HTMLLIElement {
    const row = el('li', 'hub-save-slot');
    row.append(el('span', 'hub-save-number', String(slot)));
    const save = this.options.saves.slot(slot);
    if (!save) {
      row.classList.add('is-empty');
      row.append(el('div', 'hub-save-info', 'Empty slot'));
      return row;
    }
    const info = el('div', 'hub-save-info');
    const actions = el('div', 'hub-save-actions');
    const mode = this.rowMode?.slot === slot ? this.rowMode.kind : null;
    const setMode = (next: RowMode) => {
      this.rowMode = next;
      this.renderList();
    };

    if (mode === 'rename') {
      const form = el('form', 'hub-save-rename');
      const field = el('input', 'hub-save-input');
      field.type = 'text';
      field.maxLength = SAVE_NAME_MAX_LENGTH;
      field.spellcheck = false;
      field.autocomplete = 'off';
      field.value = save.name;
      field.setAttribute('aria-label', `New name for save ${slot}`);
      const ok = el('button', 'hub-button hub-button-primary hub-button-small', 'OK');
      ok.type = 'submit';
      field.addEventListener('input', () => {
        ok.disabled = cleanSaveName(field.value) === null;
      });
      field.addEventListener('keydown', (event) => {
        if (event.code !== 'Escape') return;
        event.stopPropagation();
        setMode(null);
      });
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        if (cleanSaveName(field.value) === null) return;
        this.rowMode = null;
        // The saves' change listener redraws the list
        this.options.saves.rename(slot, field.value);
      });
      form.append(
        field,
        ok,
        button('Cancel', 'hub-button hub-button-small', () => setMode(null)),
      );
      info.append(form);
      row.append(info);
      return row;
    }

    const [finished, played] = slotDetails(save, this.options.finishedLevels(save));
    info.append(
      el('b', 'hub-save-name', save.name),
      el('span', 'hub-save-line', finished),
      el('span', 'hub-save-line', played),
    );
    if (mode === 'delete') {
      row.classList.add('is-confirming');
      info.append(el('span', 'hub-save-confirm', `Delete "${save.name}"? This can't be undone.`));
      actions.append(
        button('Delete', 'hub-button hub-button-danger hub-button-small', () => {
          this.rowMode = null;
          this.options.saves.delete(slot);
          if (!this.options.saves.hasSaves) this.close();
        }),
        button('Cancel', 'hub-button hub-button-small', () => setMode(null)),
      );
    } else {
      actions.append(
        button('Load', 'hub-button hub-button-primary hub-button-small', () => this.start(slot)),
        button('Rename', 'hub-button hub-button-small', () => setMode({ slot, kind: 'rename' })),
        button('Delete', 'hub-button hub-button-small', () => setMode({ slot, kind: 'delete' })),
      );
    }
    row.append(info, actions);
    return row;
  }
}
