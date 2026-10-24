// Cheat code (doc/cheat-code.md, ADR 0015): typing "IvanHanloth" anywhere turns on invincible mode and hands the player
// a 10p coin; putting the coin into an arcade machine on the street turns it off. Kept in memory only, so a refresh ends it.

export const CHEAT_CODE = 'ivanhanloth';

/** Matches typed characters against the code, in order; any other character starts the match again */
export class CheatCodeReader {
  private readonly code: string;
  private typed = '';

  constructor(code = CHEAT_CODE) {
    this.code = code;
  }

  /** One typed character (case ignored); true when it completes the code */
  push(char: string): boolean {
    this.typed = (this.typed + char.toLowerCase()).slice(-this.code.length);
    if (this.typed !== this.code) return false;
    this.typed = '';
    return true;
  }
}

/** Whether the cheat is on. While it is, the player holds the coin; using the coin turns it off */
export class CheatMode {
  private on = false;
  private readonly listeners = new Set<(active: boolean) => void>();

  get active(): boolean {
    return this.on;
  }

  /** The code was entered: turns the cheat on. False when it was already on (the coin is already in hand) */
  activate(): boolean {
    if (this.on) return false;
    this.set(true);
    return true;
  }

  /** The coin went into an arcade machine: turns the cheat off. False when there was no coin */
  insertCoin(): boolean {
    if (!this.on) return false;
    this.set(false);
    return true;
  }

  onChange(listener: (active: boolean) => void): void {
    this.listeners.add(listener);
  }

  private set(active: boolean): void {
    this.on = active;
    for (const listener of this.listeners) listener(active);
  }
}

function isTextField(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}

/** Listens for the code anywhere in the game; `onEntered` gets whether it turned the cheat on */
export function listenForCheatCode(cheat: CheatMode, onEntered: (turnedOn: boolean) => void): void {
  const reader = new CheatCodeReader();
  window.addEventListener('keydown', (event) => {
    // Named keys (Shift, Arrow…) are longer than one character and don't break the match
    if (event.key.length !== 1 || event.repeat) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (isTextField(event.target)) return;
    if (reader.push(event.key)) onEntered(cheat.activate());
  });
}
