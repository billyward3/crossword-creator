import type { WordEntry } from "./types";

/**
 * Crossword fill dictionary sourced from the Collaborative Word List
 * (MIT License, https://github.com/Crossword-Nexus/collaborative-word-list).
 *
 * The dictionary is loaded on demand from /dictionary.json and cached.
 * Each entry has a quality score (higher = more common/desirable as fill).
 */

export interface DictionaryEntry {
  word: string;
  score: number;
}

let cachedDictionary: DictionaryEntry[] | null = null;
let loadingPromise: Promise<DictionaryEntry[]> | null = null;

/**
 * Load the crossword dictionary. Returns cached data on subsequent calls.
 * The dictionary is a JSON array of [word, score] pairs sorted by score descending.
 */
export async function loadDictionary(): Promise<DictionaryEntry[]> {
  if (cachedDictionary) return cachedDictionary;
  if (loadingPromise) return loadingPromise;

  loadingPromise = fetch("/dictionary.json")
    .then((res) => {
      if (!res.ok) throw new Error(`Failed to load dictionary: ${res.status}`);
      return res.json();
    })
    .then((data: [string, number][]) => {
      cachedDictionary = data.map(([word, score]) => ({ word, score }));
      loadingPromise = null;
      return cachedDictionary;
    });

  return loadingPromise;
}

/**
 * Convert dictionary entries to WordEntry format for use with the solver.
 * Filters by length range and minimum score.
 * Clues are left blank because the user fills these in or they're marked as dictionary fill.
 */
export function dictionaryToWordEntries(
  dictionary: DictionaryEntry[],
  options?: {
    minLength?: number;
    maxLength?: number;
    minScore?: number;
    maxEntries?: number;
  }
): WordEntry[] {
  const minLen = options?.minLength ?? 3;
  const maxLen = options?.maxLength ?? 15;
  const minScore = options?.minScore ?? 60;
  const maxEntries = options?.maxEntries ?? 50000;

  let filtered = dictionary.filter(
    (e) => e.word.length >= minLen && e.word.length <= maxLen && e.score >= minScore
  );

  // Already sorted by score descending from the JSON file
  if (filtered.length > maxEntries) {
    filtered = filtered.slice(0, maxEntries);
  }

  return filtered.map((e) => ({
    word: e.word,
    clue: "", // dictionary words don't have clues; the user fills these in
  }));
}

/**
 * Merge user's themed words with dictionary words.
 * User words take priority, and dictionary words are only used for fill.
 * Returns the merged list with user words first.
 */
export function mergeWithDictionary(
  userWords: WordEntry[],
  dictionaryEntries: WordEntry[]
): { entries: WordEntry[]; userWordSet: Set<string> } {
  const userWordSet = new Set(userWords.map((w) => w.word.toUpperCase()));

  // User words first (these are the themed entries)
  const merged: WordEntry[] = [...userWords];

  // Add dictionary words that aren't already in the user's list
  for (const entry of dictionaryEntries) {
    if (!userWordSet.has(entry.word.toUpperCase())) {
      merged.push(entry);
    }
  }

  return { entries: merged, userWordSet };
}

/** Check if the dictionary is loaded */
export function isDictionaryLoaded(): boolean {
  return cachedDictionary !== null;
}

/** Get the cached dictionary (null if not loaded) */
export function getCachedDictionary(): DictionaryEntry[] | null {
  return cachedDictionary;
}
