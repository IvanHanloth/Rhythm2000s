// One save slot's progress (doc/save-slots.md): the difficulty, best scores, finished charts, the Rickroll message
// and the guide booklet. Held in memory; every change calls `changed`, which writes the whole save file.

import type { Difficulty } from '@/rhythm/difficulty.ts';
import { mailState, type MailState } from './mailbox.ts';

export interface BestScore {
  /** The recorded score: the round's score times the difficulty's speed (doc/difficulty.md#scores) */
  score: number;
  /** Set with the beat guide on (doc/beat-guide.md#recording-scores) */
  assisted: boolean;
  /** The difficulty it was set on */
  difficulty: Difficulty;
}

/** What one slot stores */
export interface SaveData {
  /** 1–16 characters, see cleanSaveName */
  name: string;
  /** Local date, YYYY-MM-DD */
  lastPlayed: string;
  /** Every level's speed and score factor (doc/difficulty.md) */
  difficulty: Difficulty;
  /** Best score per chart id */
  best: Record<string, BestScore>;
  /** Chart ids played to their results window, in the order first finished */
  finished: string[];
  rickrollMailRead: boolean;
  bookletRead: boolean;
}

export const SAVE_NAME_MAX_LENGTH = 16;

/** The name trimmed, or null when it is empty or longer than SAVE_NAME_MAX_LENGTH */
export function cleanSaveName(raw: string): string | null {
  const name = raw.trim();
  return name.length > 0 && name.length <= SAVE_NAME_MAX_LENGTH ? name : null;
}

/** A save with no progress yet */
export function emptySave(name: string, today: string, difficulty: Difficulty): SaveData {
  return {
    name,
    lastPlayed: today,
    difficulty,
    best: {},
    finished: [],
    rickrollMailRead: false,
    bookletRead: false,
  };
}

export class SaveProgress {
  private readonly data: SaveData;
  private readonly changed: () => void;
  private readonly today: () => string;

  constructor(data: SaveData, changed: () => void, today: () => string) {
    this.data = data;
    this.changed = changed;
    this.today = today;
  }

  get name(): string {
    return this.data.name;
  }

  get difficulty(): Difficulty {
    return this.data.difficulty;
  }

  /** The settings window's Difficulty group; applies from the next level started */
  setDifficulty(difficulty: Difficulty): void {
    if (difficulty === this.data.difficulty) return;
    this.data.difficulty = difficulty;
    this.changed();
  }

  bestScore(chartId: string): number | null {
    return this.best(chartId)?.score ?? null;
  }

  /** The chart's best score with how it was set (beat guide, difficulty); null without one */
  best(chartId: string): Readonly<BestScore> | null {
    return this.data.best[chartId] ?? null;
  }

  /**
   * Records a round's recorded score; saves and returns true when it is above 0 and beats the previous best (or is
   * the first). Whether the beat guide was on and the difficulty are saved with a new best.
   */
  recordScore(chartId: string, record: BestScore): boolean {
    if (record.score <= 0) return false;
    const best = this.bestScore(chartId);
    if (best !== null && record.score <= best) return false;
    this.data.best[chartId] = { ...record };
    this.changed();
    return true;
  }

  /** A chart was played to its results window (HackerEditor's tests and cheat rounds don't count) */
  recordFinished(chartId: string): void {
    if (!this.data.finished.includes(chartId)) this.data.finished.push(chartId);
    this.data.lastPlayed = this.today();
    this.changed();
  }

  /** The finished chart ids */
  get finished(): readonly string[] {
    return this.data.finished;
  }

  get mailState(): MailState {
    return mailState(this.data.finished.length, this.data.rickrollMailRead);
  }

  /** The player opened the Rickroll message; nothing happens before it has arrived */
  markMailRead(): void {
    if (this.mailState === 'empty' || this.data.rickrollMailRead) return;
    this.data.rickrollMailRead = true;
    this.changed();
  }

  get bookletRead(): boolean {
    return this.data.bookletRead;
  }

  markBookletRead(): void {
    if (this.data.bookletRead) return;
    this.data.bookletRead = true;
    this.changed();
  }
}
