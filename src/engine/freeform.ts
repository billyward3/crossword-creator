import type { WordEntry } from "./types";

/** A placed word in the freeform grid */
export interface PlacedWord {
  word: string;
  clue: string;
  row: number;
  col: number;
  direction: "across" | "down";
}

/** Result of freeform placement */
export interface FreeformResult {
  /** Words successfully placed */
  placed: PlacedWord[];
  /** Words that couldn't be placed */
  unplaced: WordEntry[];
  /** The grid as a 2D character array (# = empty, letters = filled) */
  grid: string[][];
  /** Grid dimensions */
  rows: number;
  cols: number;
  /** Number of intersections achieved */
  intersections: number;
}

/**
 * Place words into a freeform crossword, maximizing intersections.
 *
 * Algorithm:
 * 1. Sort words longest-first (longer words create more intersection opportunities)
 * 2. Place the first word horizontally at origin
 * 3. For each remaining word, find all valid placements that intersect existing words
 * 4. Score each placement by number of new intersections
 * 5. Place the best-scoring option
 * 6. Repeat with multiple random orderings, keep the best result
 */
/**
 * Run the freeform solver once, returning the single best result.
 */
export function solveFreeform(
  entries: WordEntry[],
  attempts: number = 8
): FreeformResult {
  const results = solveFreeformMultiple(entries, 1, attempts);
  return results[0];
}

/**
 * Run the freeform solver multiple times with different orderings,
 * returning up to `maxResults` distinct layouts sorted by quality.
 */
export function solveFreeformMultiple(
  entries: WordEntry[],
  maxResults: number = 4,
  attempts: number = 16
): FreeformResult[] {
  const results: FreeformResult[] = [];

  for (let attempt = 0; attempt < attempts; attempt++) {
    const ordered = [...entries];
    if (attempt === 0) {
      ordered.sort((a, b) => b.word.length - a.word.length);
    } else {
      shuffleWithBias(ordered, attempt);
    }

    const result = placeWords(ordered);
    if (result.placed.length < 2) continue;

    // Deduplicate: skip if same words placed in same positions
    const signature = resultSignature(result);
    const isDuplicate = results.some((r) => resultSignature(r) === signature);
    if (!isDuplicate) {
      results.push(result);
    }
  }

  // Sort by: most words placed, then most intersections, then most compact
  results.sort((a, b) => {
    if (a.placed.length !== b.placed.length) return b.placed.length - a.placed.length;
    if (a.intersections !== b.intersections) return b.intersections - a.intersections;
    return (a.rows * a.cols) - (b.rows * b.cols);
  });

  return results.slice(0, maxResults);
}

/** Create a string signature of a result for deduplication */
function resultSignature(r: FreeformResult): string {
  return r.placed
    .map((p) => `${p.word}:${p.row},${p.col},${p.direction}`)
    .sort()
    .join("|");
}

/** Core placement algorithm for one ordering of words */
function placeWords(entries: WordEntry[]): FreeformResult {
  const placed: PlacedWord[] = [];
  const unplaced: WordEntry[] = [];

  // Use a sparse grid (Map) during placement, convert to array at the end
  const cells = new Map<string, string>(); // "row,col" → letter

  if (entries.length === 0) {
    return { placed: [], unplaced: [], grid: [], rows: 0, cols: 0, intersections: 0 };
  }

  // Place first word horizontally at row 0
  const first = entries[0];
  const firstWord = first.word.toUpperCase();
  for (let i = 0; i < firstWord.length; i++) {
    cells.set(`0,${i}`, firstWord[i]);
  }
  placed.push({
    word: firstWord,
    clue: first.clue,
    row: 0,
    col: 0,
    direction: "across",
  });

  // Place remaining words
  for (let wi = 1; wi < entries.length; wi++) {
    const entry = entries[wi];
    const word = entry.word.toUpperCase();
    const best = findBestPlacement(word, cells, placed);

    if (best) {
      // Place the word
      for (let i = 0; i < word.length; i++) {
        const r = best.row + (best.direction === "down" ? i : 0);
        const c = best.col + (best.direction === "across" ? i : 0);
        cells.set(`${r},${c}`, word[i]);
      }
      placed.push({
        word,
        clue: entry.clue,
        row: best.row,
        col: best.col,
        direction: best.direction,
      });
    } else {
      unplaced.push(entry);
    }
  }

  // Convert sparse grid to 2D array
  return buildResult(placed, unplaced, cells);
}

interface Placement {
  row: number;
  col: number;
  direction: "across" | "down";
  score: number;
}

/** Find the best placement for a word that intersects existing words */
function findBestPlacement(
  word: string,
  cells: Map<string, string>,
  placed: PlacedWord[]
): Placement | null {
  const candidates: Placement[] = [];

  // For each placed word, find shared letters and try placing perpendicular
  for (const pw of placed) {
    for (let pi = 0; pi < pw.word.length; pi++) {
      for (let wi = 0; wi < word.length; wi++) {
        if (pw.word[pi] !== word[wi]) continue;

        // Shared letter — try placing perpendicular
        const direction: "across" | "down" =
          pw.direction === "across" ? "down" : "across";

        let startRow: number;
        let startCol: number;

        if (direction === "across") {
          // New word goes across, intersecting a down word
          startRow = pw.row + pi;
          startCol = (pw.col) - wi;
        } else {
          // New word goes down, intersecting an across word
          startRow = pw.row - wi;
          startCol = pw.col + pi;
        }

        if (isValidPlacement(word, startRow, startCol, direction, cells)) {
          const score = countIntersections(word, startRow, startCol, direction, cells);
          candidates.push({ row: startRow, col: startCol, direction, score });
        }
      }
    }
  }

  if (candidates.length === 0) return null;

  // Pick the placement with the highest score
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0];
}

/** Check if placing a word at this position is valid (no conflicts) */
function isValidPlacement(
  word: string,
  startRow: number,
  startCol: number,
  direction: "across" | "down",
  cells: Map<string, string>
): boolean {
  const dr = direction === "down" ? 1 : 0;
  const dc = direction === "across" ? 1 : 0;

  // Check cell before the word (must be empty)
  const beforeR = startRow - dr;
  const beforeC = startCol - dc;
  if (cells.has(`${beforeR},${beforeC}`)) return false;

  // Check cell after the word (must be empty)
  const afterR = startRow + word.length * dr;
  const afterC = startCol + word.length * dc;
  if (cells.has(`${afterR},${afterC}`)) return false;

  for (let i = 0; i < word.length; i++) {
    const r = startRow + i * dr;
    const c = startCol + i * dc;
    const key = `${r},${c}`;
    const existing = cells.get(key);

    if (existing) {
      // Cell occupied — must match the letter
      if (existing !== word[i]) return false;
    } else {
      // Cell empty — check that adjacent cells perpendicular to our direction
      // are also empty (to avoid creating unintended words)
      if (direction === "across") {
        // Check above and below
        if (cells.has(`${r - 1},${c}`) || cells.has(`${r + 1},${c}`)) {
          return false;
        }
      } else {
        // Check left and right
        if (cells.has(`${r},${c - 1}`) || cells.has(`${r},${c + 1}`)) {
          return false;
        }
      }
    }
  }

  return true;
}

/** Count how many existing letters this placement intersects */
function countIntersections(
  word: string,
  startRow: number,
  startCol: number,
  direction: "across" | "down",
  cells: Map<string, string>
): number {
  const dr = direction === "down" ? 1 : 0;
  const dc = direction === "across" ? 1 : 0;
  let count = 0;

  for (let i = 0; i < word.length; i++) {
    const r = startRow + i * dr;
    const c = startCol + i * dc;
    if (cells.has(`${r},${c}`)) count++;
  }

  return count;
}

/** Convert placed words + sparse cells to a FreeformResult */
function buildResult(
  placed: PlacedWord[],
  unplaced: WordEntry[],
  cells: Map<string, string>
): FreeformResult {
  if (placed.length === 0) {
    return { placed, unplaced, grid: [], rows: 0, cols: 0, intersections: 0 };
  }

  // Find bounds
  let minR = Infinity, maxR = -Infinity, minC = Infinity, maxC = -Infinity;
  for (const key of cells.keys()) {
    const [r, c] = key.split(",").map(Number);
    minR = Math.min(minR, r);
    maxR = Math.max(maxR, r);
    minC = Math.min(minC, c);
    maxC = Math.max(maxC, c);
  }

  const rows = maxR - minR + 1;
  const cols = maxC - minC + 1;

  // Build grid
  const grid: string[][] = Array.from({ length: rows }, () =>
    Array(cols).fill("#")
  );

  for (const [key, letter] of cells) {
    const [r, c] = key.split(",").map(Number);
    grid[r - minR][c - minC] = letter;
  }

  // Normalize placed word positions
  const normalizedPlaced = placed.map((pw) => ({
    ...pw,
    row: pw.row - minR,
    col: pw.col - minC,
  }));

  // Count total intersections
  let intersections = 0;
  const cellOwners = new Map<string, number>(); // "r,c" → count of words using it
  for (const pw of normalizedPlaced) {
    const dr = pw.direction === "down" ? 1 : 0;
    const dc = pw.direction === "across" ? 1 : 0;
    for (let i = 0; i < pw.word.length; i++) {
      const key = `${pw.row + i * dr},${pw.col + i * dc}`;
      const prev = cellOwners.get(key) || 0;
      cellOwners.set(key, prev + 1);
    }
  }
  for (const count of cellOwners.values()) {
    if (count > 1) intersections++;
  }

  return { placed: normalizedPlaced, unplaced, grid, rows, cols, intersections };
}

/** Shuffle array with bias toward keeping longer words first */
function shuffleWithBias(entries: WordEntry[], seed: number): void {
  // Sort by length descending, then shuffle within similar lengths
  entries.sort((a, b) => {
    const lenDiff = b.word.length - a.word.length;
    if (lenDiff !== 0) return lenDiff;
    // Seeded pseudo-random for same-length words
    return Math.sin(seed * 100 + a.word.charCodeAt(0)) -
           Math.sin(seed * 100 + b.word.charCodeAt(0));
  });
}
