// Save slots (doc/save-slots.md, ADR 0017): three named saves of the player's progress, all kept in one versioned
// local-storage entry. The save loaded last is the current one; scenes and the street read and write its progress.
// Settings and imported charts are shared by the device and live elsewhere (settings.ts, chart-library.ts).

import { DEFAULT_DIFFICULTY, isDifficulty, type Difficulty } from '@/rhythm/difficulty.ts';
import {
  cleanSaveName,
  emptySave,
  SaveProgress,
  type BestScore,
  type SaveData,
} from './save-progress.ts';

export type SlotNumber = 1 | 2 | 3;
export const SLOT_NUMBERS: readonly SlotNumber[] = [1, 2, 3];

export const SAVES_KEY = 'rhythm2000s.saves';
/** Where an entry that can't be read is copied before it is replaced */
export const UNREADABLE_KEY = 'rhythm2000s.saves.unreadable';

/** Storage entries from before save slots; migrateLegacy moves them into slot 1 */
const LEGACY_BEST_PREFIX = 'rhythm2000s.best.';
const LEGACY_ASSIST_PREFIX = 'rhythm2000s.bestAssist.';
const LEGACY_FINISHED_KEY = 'rhythm2000s.finishedCharts';
const LEGACY_MAIL_READ_KEY = 'rhythm2000s.rickrollMailRead';
const LEGACY_BOOKLET_KEY = 'rhythm2000s.guideBookletRead';

/** Version 2 added the difficulty (doc/difficulty.md); version 1 files are read as Normal throughout */
export const SAVE_FILE_VERSION = 2;

export interface SaveFile {
  version: typeof SAVE_FILE_VERSION;
  /** The save loaded last; null when none is (never loaded, or deleted) */
  current: SlotNumber | null;
  slots: [SaveData | null, SaveData | null, SaveData | null];
}

/** The part of Web Storage the saves use */
export interface SaveStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  readonly length: number;
  key(index: number): string | null;
}

function browserStorage(): SaveStorage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** The local date as YYYY-MM-DD */
export function todayString(date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** YYYY-MM-DD as "25 Oct 2026", the same in every browser language */
export function formatSaveDate(date: string): string {
  const match = DATE_PATTERN.exec(date);
  if (!match) throw new Error(`Not a save date: ${date}`);
  const [, year, month, day] = match;
  return `${Number(day)} ${MONTHS[Number(month) - 1]} ${year}`;
}

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function emptyFile(): SaveFile {
  return { version: SAVE_FILE_VERSION, current: null, slots: [null, null, null] };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** A difficulty field; version 1 files have none and were all Normal */
function parseDifficulty(value: unknown, version: 1 | 2, where: string): Difficulty {
  if (version === 1) return DEFAULT_DIFFICULTY;
  if (!isDifficulty(value)) throw new Error(`${where} is not a difficulty`);
  return value;
}

function parseBest(value: unknown, version: 1 | 2, where: string): BestScore {
  if (!isRecord(value)) throw new Error(`${where} is not an object`);
  const { score, assisted } = value;
  if (typeof score !== 'number' || !Number.isFinite(score))
    throw new Error(`${where}.score is not a number`);
  if (typeof assisted !== 'boolean') throw new Error(`${where}.assisted is not true or false`);
  const difficulty = parseDifficulty(value.difficulty, version, `${where}.difficulty`);
  return { score, assisted, difficulty };
}

function parseSave(value: unknown, version: 1 | 2, where: string): SaveData | null {
  if (value === null) return null;
  if (!isRecord(value)) throw new Error(`${where} is not an object`);
  const { name, lastPlayed, best, finished, rickrollMailRead, bookletRead } = value;
  const difficulty = parseDifficulty(value.difficulty, version, `${where}.difficulty`);
  if (typeof name !== 'string' || cleanSaveName(name) !== name)
    throw new Error(`${where}.name is not a save name`);
  if (typeof lastPlayed !== 'string' || !DATE_PATTERN.test(lastPlayed))
    throw new Error(`${where}.lastPlayed is not a YYYY-MM-DD date`);
  if (!isRecord(best)) throw new Error(`${where}.best is not an object`);
  if (!Array.isArray(finished) || !finished.every((id) => typeof id === 'string'))
    throw new Error(`${where}.finished is not a list of chart ids`);
  if (typeof rickrollMailRead !== 'boolean')
    throw new Error(`${where}.rickrollMailRead is not true or false`);
  if (typeof bookletRead !== 'boolean')
    throw new Error(`${where}.bookletRead is not true or false`);
  const scores: Record<string, BestScore> = {};
  for (const [chartId, entry] of Object.entries(best)) {
    scores[chartId] = parseBest(entry, version, `${where}.best.${chartId}`);
  }
  return {
    name,
    lastPlayed,
    difficulty,
    best: scores,
    finished: [...new Set(finished)],
    rickrollMailRead,
    bookletRead,
  };
}

/** Reads the saves entry, version 1 or 2, as the current version; throws an Error saying what is wrong */
export function parseSaveFile(text: string): SaveFile {
  const value: unknown = JSON.parse(text);
  if (!isRecord(value)) throw new Error('the save file is not an object');
  const { version } = value;
  if (version !== 1 && version !== 2)
    throw new Error(`unknown save file version ${String(version)}`);
  const { current, slots } = value;
  if (!Array.isArray(slots) || slots.length !== SLOT_NUMBERS.length)
    throw new Error(`slots is not a list of ${SLOT_NUMBERS.length}`);
  const parsed: SaveFile['slots'] = [
    parseSave(slots[0], version, 'slots[0]'),
    parseSave(slots[1], version, 'slots[1]'),
    parseSave(slots[2], version, 'slots[2]'),
  ];
  let slot: SlotNumber | null = null;
  if (current !== null) {
    const found = SLOT_NUMBERS.find((n) => n === current);
    if (found === undefined) throw new Error('current is not a slot number');
    // A current slot that is empty means no current save
    slot = parsed[found - 1] ? found : null;
  }
  return { version: SAVE_FILE_VERSION, current: slot, slots: parsed };
}

/** Every key in the storage */
function storageKeys(storage: SaveStorage): string[] {
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key !== null) keys.push(key);
  }
  return keys;
}

/**
 * Progress saved before save slots, moved into slot 1 "Save 1" as the current save; null when there is none.
 * `keys` are the old entries, to delete once the new file is written.
 */
export function migrateLegacy(
  storage: SaveStorage,
  today: string,
): { file: SaveFile; keys: string[] } | null {
  const keys = storageKeys(storage).filter(
    (key) =>
      key.startsWith(LEGACY_BEST_PREFIX) ||
      key.startsWith(LEGACY_ASSIST_PREFIX) ||
      key === LEGACY_FINISHED_KEY ||
      key === LEGACY_MAIL_READ_KEY ||
      key === LEGACY_BOOKLET_KEY,
  );
  if (keys.length === 0) return null;

  const save = emptySave('Save 1', today, DEFAULT_DIFFICULTY);
  for (const key of keys) {
    if (!key.startsWith(LEGACY_BEST_PREFIX)) continue;
    const chartId = key.slice(LEGACY_BEST_PREFIX.length);
    const score = Number(storage.getItem(key));
    if (!Number.isFinite(score)) continue;
    save.best[chartId] = {
      score,
      assisted: storage.getItem(LEGACY_ASSIST_PREFIX + chartId) === '1',
      difficulty: DEFAULT_DIFFICULTY,
    };
  }
  save.finished = parseLegacyFinished(storage.getItem(LEGACY_FINISHED_KEY));
  save.rickrollMailRead = storage.getItem(LEGACY_MAIL_READ_KEY) === '1';
  save.bookletRead = storage.getItem(LEGACY_BOOKLET_KEY) === '1';
  return { file: { version: SAVE_FILE_VERSION, current: 1, slots: [save, null, null] }, keys };
}

/** The old finished-charts entry: a JSON list of chart ids; anything else counted as none, as it did then */
function parseLegacyFinished(value: string | null): string[] {
  if (value === null) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) && parsed.every((id) => typeof id === 'string')
      ? [...new Set(parsed)]
      : [];
  } catch {
    return [];
  }
}

export class SaveSlots {
  private readonly storage: SaveStorage | null;
  private readonly today: () => string;
  private file: SaveFile;
  private progress: SaveProgress | null = null;
  private readonly listeners = new Set<() => void>();
  private warnedWrite = false;

  constructor(storage: SaveStorage | null = browserStorage(), today: () => string = todayString) {
    this.storage = storage;
    this.today = today;
    this.file = this.readFile();
    if (this.file.current !== null) this.progress = this.progressFor(this.file.current);
  }

  /** A slot's save, or null when it is empty */
  slot(slot: SlotNumber): Readonly<SaveData> | null {
    return this.file.slots[slot - 1];
  }

  get currentSlot(): SlotNumber | null {
    return this.file.current;
  }

  /** The save loaded last; null when none is */
  get current(): SaveProgress | null {
    return this.progress;
  }

  /** The current save, for code that only runs with one (a scene or level) */
  requireCurrent(): SaveProgress {
    if (!this.progress) throw new Error('No save is loaded');
    return this.progress;
  }

  /** The lowest empty slot, where New Game goes; null when all are full */
  get firstEmptySlot(): SlotNumber | null {
    return SLOT_NUMBERS.find((slot) => this.slot(slot) === null) ?? null;
  }

  get hasSaves(): boolean {
    return SLOT_NUMBERS.some((slot) => this.slot(slot) !== null);
  }

  /** Creates a save in an empty slot and makes it current */
  create(slot: SlotNumber, rawName: string, difficulty: Difficulty): SaveProgress {
    if (this.slot(slot)) throw new Error(`Save slot ${slot} is not empty`);
    this.file.slots[slot - 1] = emptySave(this.requireName(rawName), this.today(), difficulty);
    return this.load(slot);
  }

  /** Makes a filled slot the current save, played today */
  load(slot: SlotNumber): SaveProgress {
    const save = this.requireSlot(slot);
    save.lastPlayed = this.today();
    this.file.current = slot;
    this.progress = this.progressFor(slot);
    this.changed();
    return this.progress;
  }

  rename(slot: SlotNumber, rawName: string): void {
    this.requireSlot(slot).name = this.requireName(rawName);
    this.changed();
  }

  /** Empties a slot; deleting the current save leaves none current */
  delete(slot: SlotNumber): void {
    this.requireSlot(slot);
    this.file.slots[slot - 1] = null;
    if (this.file.current === slot) {
      this.file.current = null;
      this.progress = null;
    }
    this.changed();
  }

  /** Called after every change to any save; returns a function that stops listening */
  onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private requireSlot(slot: SlotNumber): SaveData {
    const save = this.file.slots[slot - 1];
    if (!save) throw new Error(`Save slot ${slot} is empty`);
    return save;
  }

  private requireName(rawName: string): string {
    const name = cleanSaveName(rawName);
    if (name === null) throw new Error(`Not a save name: "${rawName}"`);
    return name;
  }

  private progressFor(slot: SlotNumber): SaveProgress {
    return new SaveProgress(this.requireSlot(slot), () => this.changed(), this.today);
  }

  private changed(): void {
    this.write();
    for (const listener of this.listeners) listener();
  }

  /** The stored file; migrates older progress on the first visit, starts empty when there is nothing to read */
  private readFile(): SaveFile {
    const { storage } = this;
    if (!storage) return emptyFile();
    let text: string | null;
    try {
      text = storage.getItem(SAVES_KEY);
    } catch (error) {
      console.warn('Saves could not be read from browser storage:', error);
      return emptyFile();
    }
    if (text === null) return this.migrate(storage);
    try {
      return parseSaveFile(text);
    } catch (error) {
      console.error(
        `The saves in browser storage can't be read; kept as ${UNREADABLE_KEY}:`,
        error,
      );
      try {
        storage.setItem(UNREADABLE_KEY, text);
      } catch (copyError) {
        console.error('Copying the unreadable saves failed:', copyError);
      }
      return emptyFile();
    }
  }

  private migrate(storage: SaveStorage): SaveFile {
    let legacy: ReturnType<typeof migrateLegacy>;
    try {
      legacy = migrateLegacy(storage, this.today());
    } catch (error) {
      console.warn('Older progress could not be read from browser storage:', error);
      return emptyFile();
    }
    if (!legacy) return emptyFile();
    try {
      storage.setItem(SAVES_KEY, JSON.stringify(legacy.file));
      for (const key of legacy.keys) storage.removeItem(key);
    } catch (error) {
      // The old entries stay, so the move is tried again on the next visit
      console.warn('Moving older progress into save slot 1 could not be saved:', error);
    }
    return legacy.file;
  }

  private write(): void {
    try {
      this.storage?.setItem(SAVES_KEY, JSON.stringify(this.file));
    } catch (error) {
      // The saves still work until the page is reloaded
      if (!this.warnedWrite) console.warn('Saves could not be written to browser storage:', error);
      this.warnedWrite = true;
    }
  }
}
