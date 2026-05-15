/**
 * Shared puzzle types. These match the editor's saved state plus
 * metadata used for sharing and solving.
 *
 * Grid cells are strings: "" (empty), "#" (black), or a single uppercase
 * letter A-Z. This matches the editor's CellValue convention.
 */

export interface PuzzleClue {
  /** "row,col,direction" — same key shape the editor uses */
  position: string;
  clue: string;
}

export interface Puzzle {
  /** Schema version for forward compatibility */
  version: 1;
  /** 2D grid: "" empty, "#" black, letters are the *answer key* (solution) */
  grid: string[][];
  /** Map "row,col,direction" → clue text */
  clues: Record<string, string>;
  /** Optional puzzle title */
  title?: string;
  /** Optional author display name */
  author?: string;
  /** Words flagged as the creator's themed entries (for highlighting) */
  userWords?: string[];
  /** Words pulled from the dictionary fill (no special UI treatment) */
  fillWords?: string[];
  /** ISO timestamp when the puzzle was first stored */
  createdAt: string;
}

/**
 * Lightweight runtime check that a parsed value looks like a Puzzle.
 * Defensive against malformed JSON from clients or older stored versions.
 */
export function isPuzzle(value: unknown): value is Puzzle {
  if (!value || typeof value !== "object") return false;
  const p = value as Partial<Puzzle>;
  if (p.version !== 1) return false;
  if (!Array.isArray(p.grid)) return false;
  if (!p.clues || typeof p.clues !== "object") return false;
  if (typeof p.createdAt !== "string") return false;
  for (const row of p.grid) {
    if (!Array.isArray(row)) return false;
    for (const cell of row) {
      if (typeof cell !== "string") return false;
    }
  }
  return true;
}
