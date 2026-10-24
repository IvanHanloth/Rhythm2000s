// Typing into canvas text fields (HackerEditor's title, file name and numbers): a hidden DOM input takes the keys, so
// keyboard layouts, IME and paste work, and the field on the canvas mirrors its text. One field is edited at a time.
// Keys typed there stay out of the game: the input is a form control, which the Space and H shortcuts skip, and its
// own key handler stops Esc and Enter from reaching the page.

export interface TextEntryHandlers {
  /** The text changed while typing */
  onInput(text: string): void;
  /** Enter, or the field lost focus: keep `text` */
  onCommit(text: string): void;
  /** Esc: drop the typing and keep the old text */
  onCancel(): void;
}

export class TextEntry {
  private readonly input = document.createElement('input');
  private handlers: TextEntryHandlers | null = null;

  constructor() {
    const input = this.input;
    input.type = 'text';
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.setAttribute('aria-hidden', 'true');
    Object.assign(input.style, {
      position: 'fixed',
      left: '0',
      top: '0',
      width: '1px',
      height: '1px',
      opacity: '0',
      pointerEvents: 'none',
    });
    input.addEventListener('input', () => this.handlers?.onInput(input.value));
    input.addEventListener('keydown', (event) => {
      // Editing keys belong to the field, not the game's shortcuts
      event.stopPropagation();
      if (event.key === 'Enter') {
        event.preventDefault();
        this.finish('commit');
      } else if (event.key === 'Escape') {
        event.preventDefault();
        this.finish('cancel');
      }
    });
    input.addEventListener('blur', () => this.finish('commit'));
    document.body.append(input);
  }

  get active(): boolean {
    return this.handlers !== null;
  }

  /** Starts editing `text` (all selected, so typing replaces it); ends any other edit first */
  begin(text: string, handlers: TextEntryHandlers, maxLength: number): void {
    this.finish('commit');
    this.handlers = handlers;
    this.input.maxLength = maxLength;
    this.input.value = text;
    this.input.focus({ preventScroll: true });
    this.input.select();
  }

  /** Ends the current edit, keeping what was typed */
  commit(): void {
    this.finish('commit');
  }

  destroy(): void {
    this.handlers = null;
    this.input.remove();
  }

  private finish(how: 'commit' | 'cancel'): void {
    const handlers = this.handlers;
    if (!handlers) return;
    this.handlers = null;
    if (document.activeElement === this.input) this.input.blur();
    if (how === 'commit') handlers.onCommit(this.input.value);
    else handlers.onCancel();
  }
}
