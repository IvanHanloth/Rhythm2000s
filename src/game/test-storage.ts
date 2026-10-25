// Test-only Web Storage stand-ins for the save slots.

import type { SaveStorage } from './save-slots.ts';

/** An in-memory storage; `data` shows what was written */
export function memoryStorage(initial: Record<string, string> = {}): SaveStorage & {
  data: Map<string, string>;
} {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
    get length() {
      return data.size;
    },
    key: (index) => [...data.keys()][index] ?? null,
  };
}

/** A storage that refuses everything, as in some private modes */
export function brokenStorage(): SaveStorage {
  const refuse = (): never => {
    throw new Error('blocked');
  };
  return {
    getItem: refuse,
    setItem: refuse,
    removeItem: refuse,
    get length(): number {
      return refuse();
    },
    key: refuse,
  };
}
