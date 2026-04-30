import type { WordEntry, CrossIndex } from "./types";

/**
 * Trie node for prefix-based word lookup.
 * Children are stored in a fixed array[26] for O(1) access.
 */
export interface TrieNode {
  children: (TrieNode | null)[];
  /** Index into the master wordlist if this node terminates a word, -1 otherwise */
  wordIndex: number;
}

function createTrieNode(): TrieNode {
  return { children: new Array(26).fill(null), wordIndex: -1 };
}

/**
 * Pre-computed word index for fast constraint lookups during solving.
 *
 * Two acceleration structures:
 * 1. Tries grouped by word length — for prefix-based pruning
 * 2. CrossIndex — maps "length:position:letter" to sets of matching word indices
 *    for instant domain intersection during constraint propagation
 */
export class WordIndex {
  /** Master word list */
  readonly words: string[];
  /** Original entries with clues */
  readonly entries: WordEntry[];
  /** Words grouped by length */
  readonly wordsByLength: Map<number, number[]>;
  /** Trie per word length */
  readonly trieByLength: Map<number, TrieNode>;
  /** Cross-reference index: "length:position:charCode" → Set<wordIndex> */
  readonly crossIndex: CrossIndex;

  constructor(entries: WordEntry[]) {
    this.entries = entries;
    this.words = entries.map((e) => e.word.toUpperCase());
    this.wordsByLength = new Map();
    this.trieByLength = new Map();
    this.crossIndex = new Map();

    this.buildIndex();
  }

  private buildIndex(): void {
    // Group words by length and build tries
    for (let i = 0; i < this.words.length; i++) {
      const word = this.words[i];
      const len = word.length;

      // Group by length
      if (!this.wordsByLength.has(len)) {
        this.wordsByLength.set(len, []);
      }
      this.wordsByLength.get(len)!.push(i);

      // Insert into length-specific trie
      if (!this.trieByLength.has(len)) {
        this.trieByLength.set(len, createTrieNode());
      }
      this.insertIntoTrie(this.trieByLength.get(len)!, word, i);

      // Build cross index entries
      for (let pos = 0; pos < word.length; pos++) {
        const key = crossIndexKey(len, pos, word[pos]);
        if (!this.crossIndex.has(key)) {
          this.crossIndex.set(key, new Set());
        }
        this.crossIndex.get(key)!.add(i);
      }
    }
  }

  private insertIntoTrie(root: TrieNode, word: string, wordIndex: number): void {
    let node = root;
    for (const ch of word) {
      const idx = ch.charCodeAt(0) - 65; // A=0, B=1, ..., Z=25
      if (!node.children[idx]) {
        node.children[idx] = createTrieNode();
      }
      node = node.children[idx]!;
    }
    node.wordIndex = wordIndex;
  }

  /**
   * Get all word indices of a given length that match a set of letter constraints.
   * Constraints are specified as an array of [position, letter] pairs.
   *
   * Uses the CrossIndex for fast set intersection.
   */
  getCandidates(
    length: number,
    constraints: [number, string][],
    excludeUsed?: Set<number>
  ): number[] {
    // Start with all words of this length
    const allOfLength = this.wordsByLength.get(length);
    if (!allOfLength || allOfLength.length === 0) return [];

    if (constraints.length === 0) {
      if (!excludeUsed) return allOfLength;
      return allOfLength.filter((i) => !excludeUsed.has(i));
    }

    // Intersect constraint sets, starting with the smallest for efficiency
    const sets: Set<number>[] = [];
    for (const [pos, letter] of constraints) {
      const key = crossIndexKey(length, pos, letter.toUpperCase());
      const set = this.crossIndex.get(key);
      if (!set || set.size === 0) return []; // No words match this constraint
      sets.push(set);
    }

    // Sort by size ascending — intersect smallest first
    sets.sort((a, b) => a.size - b.size);

    // Intersect all sets
    let result: number[] = [];
    const smallest = sets[0];
    for (const idx of smallest) {
      if (excludeUsed?.has(idx)) continue;
      let valid = true;
      for (let s = 1; s < sets.length; s++) {
        if (!sets[s].has(idx)) {
          valid = false;
          break;
        }
      }
      if (valid) result.push(idx);
    }

    return result;
  }

  /**
   * Get the constraint pattern for a slot given partial letter fills.
   * Returns a human-readable pattern like "_R__E" for display in suggestions.
   */
  getConstraintPattern(length: number, constraints: [number, string][]): string {
    const pattern = new Array(length).fill("_");
    for (const [pos, letter] of constraints) {
      pattern[pos] = letter.toUpperCase();
    }
    return pattern.join("");
  }
}

/** Build a CrossIndex key */
function crossIndexKey(length: number, position: number, letter: string): string {
  return `${length}:${position}:${letter}`;
}

/**
 * Build a WordIndex from raw word entries.
 * This is the main entry point — call once when the user provides their wordlist.
 */
export function buildWordIndex(entries: WordEntry[]): WordIndex {
  return new WordIndex(entries);
}
