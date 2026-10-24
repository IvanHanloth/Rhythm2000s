// The computers' inbox for the Rickroll easter egg (doc/easter-eggs.md): the charts the player has finished and
// whether the 4chan message has been read, kept in browser storage and shared by both computers.
// Read / write failures (private mode etc.) count as nothing finished and don't affect play.

const FINISHED_KEY = 'rhythm2000s.finishedCharts';
const READ_KEY = 'rhythm2000s.rickrollMailRead';

/** Different charts to finish before the message arrives */
export const MAIL_UNLOCK_CHARTS = 3;

/** empty: not unlocked yet; unread / read: the message is in the inbox */
export type MailState = 'empty' | 'unread' | 'read';

/** The part of Web Storage the mailbox uses */
export interface MailStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** localStorage, or null where the browser refuses it */
function browserStorage(): MailStorage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** The stored list of finished chart ids; anything that isn't a list of strings counts as none */
export function parseFinished(value: string | null): string[] {
  if (value === null) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) && parsed.every((id) => typeof id === 'string') ? parsed : [];
  } catch {
    return [];
  }
}

export class Mailbox {
  private readonly storage: MailStorage | null;

  constructor(storage: MailStorage | null = browserStorage()) {
    this.storage = storage;
  }

  /** A chart was played to its results window (HackerEditor's tests don't count) */
  recordFinished(chartId: string): void {
    const finished = this.finished();
    if (finished.includes(chartId)) return;
    this.write(FINISHED_KEY, JSON.stringify([...finished, chartId]));
  }

  get state(): MailState {
    if (this.finished().length < MAIL_UNLOCK_CHARTS) return 'empty';
    return this.read(READ_KEY) === '1' ? 'read' : 'unread';
  }

  /** The player opened the message */
  markRead(): void {
    if (this.state === 'empty') return;
    this.write(READ_KEY, '1');
  }

  private finished(): string[] {
    return parseFinished(this.read(FINISHED_KEY));
  }

  private read(key: string): string | null {
    try {
      return this.storage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  }

  private write(key: string, value: string): void {
    try {
      this.storage?.setItem(key, value);
    } catch {
      // A failed save only means the message arrives later
    }
  }
}
