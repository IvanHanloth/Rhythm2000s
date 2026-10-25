// The street's objectives (doc/hub.md#objectives): find the guide booklet, then play a song at a front-row computer.
// Reading the booklet is saved in the browser; when storage fails it only lasts until the page reloads.

const BOOKLET_KEY = 'rhythm2000s.guideBookletRead';

export type Objective = 'booklet' | 'play';

/** The objective text in the top left */
export const OBJECTIVE_TEXT: Record<Objective, string> = {
  booklet: 'Find the guide booklet on the CYBERSPACE CAFÉ front desk',
  play: 'Play a song on one of the two front-row computers',
};

/** The first objective not yet done; null when both are */
export function currentObjective(bookletRead: boolean, playedOnce: boolean): Objective | null {
  if (!bookletRead) return 'booklet';
  if (!playedOnce) return 'play';
  return null;
}

/** The part of Web Storage the objectives use */
export interface ObjectiveStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function browserStorage(): ObjectiveStorage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Whether the guide booklet has been opened */
export class BookletProgress {
  private readonly storage: ObjectiveStorage | null;
  private readThisVisit = false;

  constructor(storage: ObjectiveStorage | null = browserStorage()) {
    this.storage = storage;
  }

  get read(): boolean {
    if (this.readThisVisit) return true;
    try {
      return this.storage?.getItem(BOOKLET_KEY) === '1';
    } catch {
      return false;
    }
  }

  markRead(): void {
    this.readThisVisit = true;
    try {
      this.storage?.setItem(BOOKLET_KEY, '1');
    } catch {
      // Only lasts until the page reloads
    }
  }
}
