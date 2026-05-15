/**
 * Engine-internal types for the crossword generation algorithm.
 *
 * These types are optimized for solver performance (typed arrays, flat indices)
 * rather than API ergonomics. The shared types in lib/types.ts are used for
 * the public-facing puzzle representation.
 */

/** Cell values in the grid model */
export const CELL_BLACK = 0;
export const CELL_EMPTY = 255;
// Letters A-Z are stored as 1-26

/** Convert a letter to its cell value (1-26) */
export function letterToCell(letter: string): number {
  return letter.toUpperCase().charCodeAt(0) - 64; // A=1, B=2, ..., Z=26
}

/** Convert a cell value (1-26) back to a letter */
export function cellToLetter(cell: number): string {
  return String.fromCharCode(cell + 64);
}

/**
 * Flat grid representation using a typed array for cache-friendly access.
 * Index = row * cols + col.
 * Values: 0 = black, 1-26 = letter A-Z, 255 = empty white cell.
 */
export interface GridModel {
  rows: number;
  cols: number;
  cells: Uint8Array;
}

/** A word slot in the grid (a contiguous run of white cells in one direction) */
export interface SlotDescriptor {
  /** Unique slot ID */
  id: number;
  /** Across or down */
  direction: "across" | "down";
  /** Row of the first cell */
  startRow: number;
  /** Column of the first cell */
  startCol: number;
  /** Number of cells in this slot */
  length: number;
  /** Flat indices into GridModel.cells for each position in the slot */
  cellIndices: number[];
  /** Intersections with other slots */
  intersections: SlotIntersection[];
}

/** Describes how two slots intersect at a single cell */
export interface SlotIntersection {
  /** Position within this slot (0-indexed) */
  positionInSlot: number;
  /** The other slot's ID */
  otherSlotId: number;
  /** Position within the other slot (0-indexed) */
  positionInOtherSlot: number;
}

/** Solver state for a single slot during generation */
export interface SlotState {
  /** The slot this state tracks */
  slotId: number;
  /** The word assigned to this slot (null if unassigned) */
  assignedWord: string | null;
  /** Indices into the master wordlist of candidate words */
  domain: number[];
}

/**
 * Pre-computed cross-reference index for fast constraint lookups.
 * Key format: "length:position:letter" (e.g., "5:2:A")
 * Value: set of word indices in the master wordlist that match.
 */
export type CrossIndex = Map<string, Set<number>>;

/** A word entry in the wordlist with its clue */
export interface WordEntry {
  word: string;
  clue: string;
  /** When false, the word is excluded from generation. Defaults to true if absent. */
  enabled?: boolean;
}

/** Result from the solver: a complete grid fill */
export interface SolverResult {
  /** The filled grid */
  grid: GridModel;
  /** Word assignments: slot ID → word */
  assignments: Map<number, string>;
  /** Solve time in milliseconds */
  solveTimeMs: number;
}

/** Message types for worker communication */
export type WorkerRequest = {
  type: "solve";
  grid: GridModel;
  wordlist: WordEntry[];
  seed: number;
  maxSolutions: number;
};

export type WorkerResponse =
  | { type: "solution"; result: SolverResult }
  | { type: "progress"; filledSlots: number; totalSlots: number }
  | { type: "done"; solutionCount: number }
  | { type: "error"; message: string };

/** Suggestion from the suggestion system */
export interface PlacementSuggestion {
  /** The slot to fill */
  slotId: number;
  /** Candidate word */
  word: string;
  /** How helpful this placement is (higher = better) */
  cascadeScore: number;
  /** How many neighboring slots remain fillable after this placement */
  neighborFeasibility: number;
}

/** Feasibility report for a single slot */
export interface SlotFeasibility {
  slotId: number;
  /** Number of candidate words that can fit */
  domainSize: number;
  /** "impossible" | "forced" | "constrained" | "flexible" */
  status: "impossible" | "forced" | "constrained" | "flexible";
  /** Top candidate words (up to 10) */
  topCandidates: string[];
}

/** Gap found during grid analysis */
export interface GridGap {
  /** Type of issue */
  type: "unchecked_cell" | "short_run" | "symmetry_violation" | "disconnected";
  /** Position of the issue */
  row: number;
  col: number;
  /** Human-readable description */
  description: string;
}
