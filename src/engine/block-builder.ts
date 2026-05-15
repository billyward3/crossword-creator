import type { WordEntry, GridModel } from "./types";
import { CELL_BLACK, CELL_EMPTY, letterToCell, cellToLetter } from "./types";
import {
  createGrid,
  cellIndex,
  cellPosition,
  extractSlots,
  inBounds,
  symmetryPartner,
} from "./grid";
import { buildWordIndex } from "./wordindex";
import { solve, solveBestEffort } from "./solver";
import {
  solveFreeformMultiple,
  type FreeformResult,
  type FreeformStrategy,
  type PlacedWord,
} from "./freeform";

export interface BlockBuilderConfig {
  entries: WordEntry[];
  dictionary: WordEntry[];
  scaffoldStrategy?: FreeformStrategy;
  /** Cells of padding around the scaffold bounding box (default 1) */
  padding?: number;
  seed?: number;
  /** Maximum number of user words to place in the scaffold. Cap the input
   *  to keep the grid compact; the rest of the user list is reported as
   *  unplaced. */
  maxPlaced?: number;
}

export interface BlockPlacedWord {
  word: string;
  clue: string;
  row: number;
  col: number;
  direction: "across" | "down";
  isUser: boolean;
}

export interface BlockBuilderResult {
  grid: GridModel;
  placedWords: BlockPlacedWord[];
  scaffoldResult: FreeformResult;
  solveTimeMs: number;
}

export function buildBlock(
  config: BlockBuilderConfig
): BlockBuilderResult | null {
  const start = performance.now();

  const scaffold = scaffoldPhase(config);
  if (!scaffold) return null;

  const { grid, userWords } = structurePhase(scaffold, config.padding ?? 1);

  // Feasibility pass: walk every slot, check that at least one dictionary
  // word fits the user-letter constraints. Slots with zero candidates will
  // never get a real word from the solver — break them up by blacking out
  // the most-constrained cell. This is what lets `solve()` (full backtrack)
  // succeed downstream, eliminating gibberish at the source.
  ensureFeasibleSlots(grid, config);

  return fillPhase(grid, userWords, scaffold, config, start);
}

/**
 * Test whether blacking out a cell would create any stray 1- or 2-letter
 * run in either direction. Blacking a cell splits its across run into two
 * pieces and its down run into two pieces — every piece must end up either
 * length 0 (the cell was at the run's edge) or length >= 3.
 *
 * This prevents the "stray letter" pattern where breaking a slot leaves a
 * single letter cell with no valid word through it.
 */
function canSafelyBlack(grid: GridModel, r: number, c: number): boolean {
  const idx = cellIndex(grid, r, c);
  if (grid.cells[idx] === CELL_BLACK) return false;
  for (const [dr, dc] of [
    [0, 1],
    [1, 0],
  ] as [number, number][]) {
    let before = 0;
    let cr = r - dr,
      cc = c - dc;
    while (
      inBounds(grid, cr, cc) &&
      grid.cells[cellIndex(grid, cr, cc)] !== CELL_BLACK
    ) {
      before++;
      cr -= dr;
      cc -= dc;
    }
    let after = 0;
    cr = r + dr;
    cc = c + dc;
    while (
      inBounds(grid, cr, cc) &&
      grid.cells[cellIndex(grid, cr, cc)] !== CELL_BLACK
    ) {
      after++;
      cr += dr;
      cc += dc;
    }
    const beforeOk = before === 0 || before >= 3;
    const afterOk = after === 0 || after >= 3;
    if (!beforeOk || !afterOk) return false;
  }
  return true;
}

function ensureFeasibleSlots(
  grid: GridModel,
  config: BlockBuilderConfig
): void {
  const entryMap = new Map<string, WordEntry>();
  for (const e of config.dictionary) entryMap.set(e.word.toUpperCase(), e);
  for (const e of config.entries) entryMap.set(e.word.toUpperCase(), e);
  const allEntries = Array.from(entryMap.values()).map((e) => ({
    ...e,
    word: e.word.toUpperCase(),
  }));
  const wordIndex = buildWordIndex(allEntries);

  for (let pass = 0; pass < 10; pass++) {
    const slots = extractSlots(grid);
    let changed = false;
    for (const slot of slots) {
      const constraints: [number, string][] = [];
      for (let i = 0; i < slot.cellIndices.length; i++) {
        const v = grid.cells[slot.cellIndices[i]];
        if (v !== CELL_EMPTY && v !== CELL_BLACK) {
          constraints.push([i, cellToLetter(v)]);
        }
      }
      const candidates = wordIndex.getCandidates(slot.length, constraints);
      if (candidates.length > 0) continue;

      // No dictionary word fits this slot. Break it by blacking out an
      // EMPTY cell near the middle. The post-solve cleanup handles any
      // strays this creates.
      const mid = Math.floor(slot.length / 2);
      const order: number[] = [mid];
      for (let off = 1; off < slot.length; off++) {
        if (mid - off >= 0) order.push(mid - off);
        if (mid + off < slot.length) order.push(mid + off);
      }
      for (const i of order) {
        const cellIdx = slot.cellIndices[i];
        if (grid.cells[cellIdx] !== CELL_EMPTY) continue;
        grid.cells[cellIdx] = CELL_BLACK;
        changed = true;
        break;
      }
    }
    if (!changed) return;
  }
}

// ── Phase 1: Scaffold ──────────────────────────────────────────────────

function scaffoldPhase(config: BlockBuilderConfig): FreeformResult | null {
  const strategy = config.scaffoldStrategy ?? "adjacency-aware";
  const extra = strategy.startsWith("adjacency")
    ? config.dictionary
    : undefined;
  const results = solveFreeformMultiple(
    config.entries,
    1,
    12,
    strategy,
    config.maxPlaced,
    extra
  );
  return results.length > 0 ? results[0] : null;
}

// ── Phase 2: Structure (Shrink-and-Carve) ──────────────────────────────

interface StructureResult {
  grid: GridModel;
  userWords: PlacedWord[];
}

function structurePhase(
  scaffold: FreeformResult,
  padding: number
): StructureResult {
  const userPlaced = scaffold.placed.filter((pw) => !pw.isFill);
  const rows = scaffold.rows + padding * 2;
  const cols = scaffold.cols + padding * 2;
  let grid = createGrid(rows, cols);

  const letterCells = new Set<number>();
  let offsetPlaced: PlacedWord[] = [];

  for (const pw of userPlaced) {
    const dr = pw.direction === "down" ? 1 : 0;
    const dc = pw.direction === "across" ? 1 : 0;
    const oRow = pw.row + padding;
    const oCol = pw.col + padding;

    for (let i = 0; i < pw.word.length; i++) {
      const r = oRow + i * dr;
      const c = oCol + i * dc;
      const idx = cellIndex(grid, r, c);
      grid.cells[idx] = letterToCell(pw.word[i]);
      letterCells.add(idx);
    }
    offsetPlaced.push({ ...pw, row: oRow, col: oCol });
  }

  // Word boundary enforcement: the cell immediately before/after each user
  // word (in its direction) becomes BLACK when it doesn't already hold a
  // letter. This ensures the CSP solver treats each user word as its own
  // slot boundary. Track these as "protected" so the later repair pass
  // can't un-black them — un-blacking a boundary would merge the user
  // word with adjacent fill (e.g., TIGER becomes TIGERI).
  const protectedBlacks = new Set<number>();
  for (const pw of offsetPlaced) {
    const dr = pw.direction === "down" ? 1 : 0;
    const dc = pw.direction === "across" ? 1 : 0;
    markBoundary(grid, pw.row - dr, pw.col - dc, letterCells, protectedBlacks);
    markBoundary(
      grid,
      pw.row + pw.word.length * dr,
      pw.col + pw.word.length * dc,
      letterCells,
      protectedBlacks
    );
  }

  // Distance seeding: mark cells far from any letter as BLACK. Smaller
  // MAX_DIST = tighter grid = fewer fill slots = puzzle stays closer to
  // the user's word count instead of ballooning with dictionary fill.
  const dist = bfsDistances(grid, letterCells);
  const MAX_DIST = 2;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = cellIndex(grid, r, c);
      if (grid.cells[idx] === CELL_BLACK || letterCells.has(idx)) continue;
      if (dist[idx] > MAX_DIST) {
        markBlackSymmetric(grid, r, c, letterCells);
      }
    }
  }

  // Break up very long runs (> MAX_SLOT) by inserting BLACK cells. The cap
  // matches the dictionary's max word length so every resulting slot has at
  // least one candidate to fill it. These breaks are protected too — if
  // repair un-blacks them, the slot becomes unfillable and shows up as junk
  // letter sequences (e.g., LANESDIBA).
  const MAX_SLOT = 7;
  for (const [dr, dc] of [[0, 1], [1, 0]] as [number, number][]) {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = cellIndex(grid, r, c);
        if (grid.cells[idx] === CELL_BLACK) continue;
        const rl = runLen(grid, r, c, dr, dc);
        if (rl <= MAX_SLOT) continue;
        let sr = r, sc = c;
        while (
          inBounds(grid, sr - dr, sc - dc) &&
          grid.cells[cellIndex(grid, sr - dr, sc - dc)] !== CELL_BLACK
        ) { sr -= dr; sc -= dc; }
        let pos = 0;
        let cr = sr, cc = sc;
        while (inBounds(grid, cr, cc) && grid.cells[cellIndex(grid, cr, cc)] !== CELL_BLACK) {
          if (pos > 0 && pos % MAX_SLOT === 0) {
            const ci = cellIndex(grid, cr, cc);
            if (!letterCells.has(ci)) {
              markBoundary(grid, cr, cc, letterCells, protectedBlacks);
            }
          }
          pos++;
          cr += dr;
          cc += dc;
        }
      }
    }
  }

  // Iterative carving: any non-letter cell whose across or down run is < 3
  // can't participate in a valid crossword word, so mark it BLACK.
  // Symmetry is best-effort: we always carve the violating cell but only
  // carve the symmetric partner if it's safe to do so.
  let changed = true;
  while (changed) {
    changed = false;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = cellIndex(grid, r, c);
        if (grid.cells[idx] === CELL_BLACK || letterCells.has(idx)) continue;
        if (runLen(grid, r, c, 0, 1) < 3 || runLen(grid, r, c, 1, 0) < 3) {
          grid.cells[idx] = CELL_BLACK;
          const p = symmetryPartner(grid, r, c);
          const pi = cellIndex(grid, p.row, p.col);
          if (!letterCells.has(pi) && grid.cells[pi] !== CELL_BLACK) {
            grid.cells[pi] = CELL_BLACK;
          }
          changed = true;
        }
      }
    }
  }

  // Repair: extend runs for any non-black cell still in a run < 3.
  // This handles both letter cells AND empty cells that couldn't be carved
  // because their symmetry partner is a letter cell.
  repairAllShortRuns(grid, letterCells, protectedBlacks);

  // Trim full-black border rows and columns
  const trimResult = trimBlackBorders(grid, letterCells, offsetPlaced);
  grid = trimResult.grid;
  offsetPlaced = trimResult.userWords;

  return { grid, userWords: offsetPlaced };
}

function safeMarkBlack(
  grid: GridModel,
  r: number,
  c: number,
  letterCells: Set<number>
): void {
  if (!inBounds(grid, r, c)) return;
  const idx = cellIndex(grid, r, c);
  if (letterCells.has(idx)) return;
  grid.cells[idx] = CELL_BLACK;
  const p = symmetryPartner(grid, r, c);
  const pi = cellIndex(grid, p.row, p.col);
  if (!letterCells.has(pi)) grid.cells[pi] = CELL_BLACK;
}

/**
 * Like safeMarkBlack but records the cell (and its symmetric partner)
 * as "protected" so the later repair pass won't un-black them. Used
 * for user word boundaries — un-blacking those merges user words with
 * fill.
 */
function markBoundary(
  grid: GridModel,
  r: number,
  c: number,
  letterCells: Set<number>,
  protectedBlacks: Set<number>
): void {
  if (!inBounds(grid, r, c)) return;
  const idx = cellIndex(grid, r, c);
  if (letterCells.has(idx)) return;
  grid.cells[idx] = CELL_BLACK;
  protectedBlacks.add(idx);
  const p = symmetryPartner(grid, r, c);
  const pi = cellIndex(grid, p.row, p.col);
  if (!letterCells.has(pi)) {
    grid.cells[pi] = CELL_BLACK;
    // Don't protect the symmetric partner — only the actual boundary.
    // The symmetric one is just a courtesy for visual symmetry and can
    // be un-blacked if needed elsewhere.
  }
}

function markBlackSymmetric(
  grid: GridModel,
  r: number,
  c: number,
  letterCells: Set<number>
): void {
  grid.cells[cellIndex(grid, r, c)] = CELL_BLACK;
  const p = symmetryPartner(grid, r, c);
  const pi = cellIndex(grid, p.row, p.col);
  if (!letterCells.has(pi)) grid.cells[pi] = CELL_BLACK;
}

function bfsDistances(grid: GridModel, sources: Set<number>): number[] {
  const n = grid.rows * grid.cols;
  const dist = new Array<number>(n).fill(n);
  const queue: number[] = [];
  for (const idx of sources) {
    dist[idx] = 0;
    queue.push(idx);
  }
  let qi = 0;
  while (qi < queue.length) {
    const idx = queue[qi++];
    const { row: r, col: c } = cellPosition(grid, idx);
    const d = dist[idx];
    const neighbors: [number, number][] = [
      [r - 1, c],
      [r + 1, c],
      [r, c - 1],
      [r, c + 1],
    ];
    for (const [nr, nc] of neighbors) {
      if (!inBounds(grid, nr, nc)) continue;
      const ni = cellIndex(grid, nr, nc);
      if (d + 1 < dist[ni]) {
        dist[ni] = d + 1;
        queue.push(ni);
      }
    }
  }
  return dist;
}

function runLen(
  grid: GridModel,
  r: number,
  c: number,
  dr: number,
  dc: number
): number {
  let sr = r,
    sc = c;
  while (
    inBounds(grid, sr - dr, sc - dc) &&
    grid.cells[cellIndex(grid, sr - dr, sc - dc)] !== CELL_BLACK
  ) {
    sr -= dr;
    sc -= dc;
  }
  let len = 0;
  let cr = sr,
    cc = sc;
  while (
    inBounds(grid, cr, cc) &&
    grid.cells[cellIndex(grid, cr, cc)] !== CELL_BLACK
  ) {
    len++;
    cr += dr;
    cc += dc;
  }
  return len;
}

function repairAllShortRuns(
  grid: GridModel,
  letterCells: Set<number>,
  protectedBlacks: Set<number>
): void {
  for (let pass = 0; pass < 5; pass++) {
    let anyRepaired = false;
    for (let r = 0; r < grid.rows; r++) {
      for (let c = 0; c < grid.cols; c++) {
        const idx = cellIndex(grid, r, c);
        if (grid.cells[idx] === CELL_BLACK) continue;
        for (const [dr, dc] of [
          [0, 1],
          [1, 0],
        ] as [number, number][]) {
          if (runLen(grid, r, c, dr, dc) < 3) {
            if (tryExtendRun(grid, r, c, dr, dc, letterCells, protectedBlacks))
              anyRepaired = true;
          }
        }
      }
    }
    if (!anyRepaired) break;
  }
}

function tryExtendRun(
  grid: GridModel,
  r: number,
  c: number,
  dr: number,
  dc: number,
  letterCells: Set<number>,
  protectedBlacks: Set<number>
): boolean {
  // Find current run boundaries
  let sr = r,
    sc = c;
  while (
    inBounds(grid, sr - dr, sc - dc) &&
    grid.cells[cellIndex(grid, sr - dr, sc - dc)] !== CELL_BLACK
  ) {
    sr -= dr;
    sc -= dc;
  }
  let er = r,
    ec = c;
  while (
    inBounds(grid, er + dr, ec + dc) &&
    grid.cells[cellIndex(grid, er + dr, ec + dc)] !== CELL_BLACK
  ) {
    er += dr;
    ec += dc;
  }

  const needed = 3 - runLen(grid, r, c, dr, dc);
  if (needed <= 0) return false;
  let extended = 0;

  // Extend at the start (before sr, sc)
  let pr = sr - dr,
    pc = sc - dc;
  while (extended < needed && inBounds(grid, pr, pc)) {
    const pi = cellIndex(grid, pr, pc);
    if (grid.cells[pi] !== CELL_BLACK) break;
    if (protectedBlacks.has(pi)) break; // user word boundary — don't un-black
    grid.cells[pi] = CELL_EMPTY;
    const sym = symmetryPartner(grid, pr, pc);
    const si = cellIndex(grid, sym.row, sym.col);
    if (
      grid.cells[si] === CELL_BLACK &&
      !letterCells.has(si) &&
      !protectedBlacks.has(si)
    ) {
      grid.cells[si] = CELL_EMPTY;
    }
    extended++;
    pr -= dr;
    pc -= dc;
  }

  // Extend at the end (after er, ec)
  let nr = er + dr,
    nc = ec + dc;
  while (extended < needed && inBounds(grid, nr, nc)) {
    const ni = cellIndex(grid, nr, nc);
    if (grid.cells[ni] !== CELL_BLACK) break;
    if (protectedBlacks.has(ni)) break;
    grid.cells[ni] = CELL_EMPTY;
    const sym = symmetryPartner(grid, nr, nc);
    const si = cellIndex(grid, sym.row, sym.col);
    if (
      grid.cells[si] === CELL_BLACK &&
      !letterCells.has(si) &&
      !protectedBlacks.has(si)
    ) {
      grid.cells[si] = CELL_EMPTY;
    }
    extended++;
    nr += dr;
    nc += dc;
  }

  return extended > 0;
}

function trimBlackBorders(
  grid: GridModel,
  letterCells: Set<number>,
  placed: PlacedWord[]
): { grid: GridModel; userWords: PlacedWord[] } {
  let topTrim = 0;
  let bottomTrim = 0;
  let leftTrim = 0;
  let rightTrim = 0;

  // Count full-black rows from top
  for (let r = 0; r < grid.rows; r++) {
    let allBlack = true;
    for (let c = 0; c < grid.cols; c++) {
      if (grid.cells[cellIndex(grid, r, c)] !== CELL_BLACK) {
        allBlack = false;
        break;
      }
    }
    if (allBlack) topTrim++;
    else break;
  }

  // Count full-black rows from bottom
  for (let r = grid.rows - 1; r >= topTrim; r--) {
    let allBlack = true;
    for (let c = 0; c < grid.cols; c++) {
      if (grid.cells[cellIndex(grid, r, c)] !== CELL_BLACK) {
        allBlack = false;
        break;
      }
    }
    if (allBlack) bottomTrim++;
    else break;
  }

  // Count full-black columns from left
  for (let c = 0; c < grid.cols; c++) {
    let allBlack = true;
    for (let r = topTrim; r < grid.rows - bottomTrim; r++) {
      if (grid.cells[cellIndex(grid, r, c)] !== CELL_BLACK) {
        allBlack = false;
        break;
      }
    }
    if (allBlack) leftTrim++;
    else break;
  }

  // Count full-black columns from right
  for (let c = grid.cols - 1; c >= leftTrim; c--) {
    let allBlack = true;
    for (let r = topTrim; r < grid.rows - bottomTrim; r++) {
      if (grid.cells[cellIndex(grid, r, c)] !== CELL_BLACK) {
        allBlack = false;
        break;
      }
    }
    if (allBlack) rightTrim++;
    else break;
  }

  if (topTrim === 0 && bottomTrim === 0 && leftTrim === 0 && rightTrim === 0) {
    return { grid, userWords: placed };
  }

  const newRows = grid.rows - topTrim - bottomTrim;
  const newCols = grid.cols - leftTrim - rightTrim;
  if (newRows < 3 || newCols < 3) return { grid, userWords: placed };

  const newGrid = createGrid(newRows, newCols);
  for (let r = 0; r < newRows; r++) {
    for (let c = 0; c < newCols; c++) {
      newGrid.cells[cellIndex(newGrid, r, c)] =
        grid.cells[cellIndex(grid, r + topTrim, c + leftTrim)];
    }
  }

  const newPlaced = placed.map((pw) => ({
    ...pw,
    row: pw.row - topTrim,
    col: pw.col - leftTrim,
  }));

  return { grid: newGrid, userWords: newPlaced };
}

/**
 * Walk every contiguous run of letters in the grid (length >= 2) and
 * return the resulting word, position, and direction.
 */
export function walkSlots(
  grid: GridModel
): Array<{ word: string; row: number; col: number; direction: "across" | "down" }> {
  const slots: Array<{ word: string; row: number; col: number; direction: "across" | "down" }> = [];

  for (let r = 0; r < grid.rows; r++) {
    let runStart = -1;
    let runWord = "";
    for (let c = 0; c <= grid.cols; c++) {
      const v = c < grid.cols ? grid.cells[cellIndex(grid, r, c)] : CELL_BLACK;
      if (v !== CELL_BLACK && v !== CELL_EMPTY) {
        if (runStart === -1) runStart = c;
        runWord += cellToLetter(v);
      } else {
        if (runWord.length >= 2) {
          slots.push({ word: runWord, row: r, col: runStart, direction: "across" });
        }
        runStart = -1;
        runWord = "";
      }
    }
  }

  for (let c = 0; c < grid.cols; c++) {
    let runStart = -1;
    let runWord = "";
    for (let r = 0; r <= grid.rows; r++) {
      const v = r < grid.rows ? grid.cells[cellIndex(grid, r, c)] : CELL_BLACK;
      if (v !== CELL_BLACK && v !== CELL_EMPTY) {
        if (runStart === -1) runStart = r;
        runWord += cellToLetter(v);
      } else {
        if (runWord.length >= 2) {
          slots.push({ word: runWord, row: runStart, col: c, direction: "down" });
        }
        runStart = -1;
        runWord = "";
      }
    }
  }

  return slots;
}

/**
 * Read the word formed by the run at (r, c) in the given direction.
 * Returns "" if the cell is BLACK or EMPTY.
 */
function readRun(
  grid: GridModel,
  r: number,
  c: number,
  dr: number,
  dc: number
): { word: string; startRow: number; startCol: number } {
  const v = grid.cells[cellIndex(grid, r, c)];
  if (v === CELL_BLACK || v === CELL_EMPTY) {
    return { word: "", startRow: r, startCol: c };
  }
  let sr = r,
    sc = c;
  while (
    inBounds(grid, sr - dr, sc - dc) &&
    grid.cells[cellIndex(grid, sr - dr, sc - dc)] !== CELL_BLACK &&
    grid.cells[cellIndex(grid, sr - dr, sc - dc)] !== CELL_EMPTY
  ) {
    sr -= dr;
    sc -= dc;
  }
  let word = "";
  let cr = sr,
    cc = sc;
  while (
    inBounds(grid, cr, cc) &&
    grid.cells[cellIndex(grid, cr, cc)] !== CELL_BLACK &&
    grid.cells[cellIndex(grid, cr, cc)] !== CELL_EMPTY
  ) {
    word += cellToLetter(grid.cells[cellIndex(grid, cr, cc)]);
    cr += dr;
    cc += dc;
  }
  return { word, startRow: sr, startCol: sc };
}

/**
 * Walk every slot in the grid and BLACK out cells of any run whose word
 * isn't in `validWords`. Conservative: only black cells whose perpendicular
 * slot is also invalid (or shorter than 2), so we never break a valid word.
 * Stops when no more safe blacks can be made. Some invalid slots may remain
 * if every cell has a valid perpendicular partner — those are flagged but
 * not destroyed.
 */
function cleanupInvalidSlots(
  grid: GridModel,
  validWords: Set<string>,
  userCellKeys: Set<string>
): void {
  // A slot is "valid" if it's at least 3 letters AND in the dictionary
  // (or is a user word). 2-letter runs are never valid crossword entries.
  const isValid = (word: string) => word.length >= 3 && validWords.has(word);

  for (let pass = 0; pass < 30; pass++) {
    const slots = walkSlots(grid);
    const invalid = slots.filter((s) => !isValid(s.word));
    if (invalid.length === 0) return;

    let changed = false;
    for (const invalidSlot of invalid) {
      const dr = invalidSlot.direction === "down" ? 1 : 0;
      const dc = invalidSlot.direction === "across" ? 1 : 0;
      const perpDr = dc;
      const perpDc = dr;

      for (let i = 0; i < invalidSlot.word.length; i++) {
        const r = invalidSlot.row + i * dr;
        const c = invalidSlot.col + i * dc;
        const key = `${r},${c}`;
        if (userCellKeys.has(key)) continue;

        const perp = readRun(grid, r, c, perpDr, perpDc);
        if (!isValid(perp.word)) {
          // Perp is also invalid (or too short / non-existent) — safe to
          // BLACK this cell. We never break a valid word. Also verify the
          // break doesn't strand a neighbor as a 1- or 2-letter run.
          if (!canSafelyBlack(grid, r, c)) continue;
          grid.cells[cellIndex(grid, r, c)] = CELL_BLACK;
          changed = true;
          break;
        }
      }
      if (changed) break;
    }

    if (!changed) return;
  }
}

function postFillCleanup(
  grid: GridModel,
  userCellKeys: Set<string>
): void {
  let changed = true;
  while (changed) {
    changed = false;
    for (let r = 0; r < grid.rows; r++) {
      for (let c = 0; c < grid.cols; c++) {
        const idx = cellIndex(grid, r, c);
        if (grid.cells[idx] === CELL_BLACK) continue;
        if (userCellKeys.has(`${r},${c}`)) continue;
        if (runLen(grid, r, c, 0, 1) < 3 && runLen(grid, r, c, 1, 0) < 3) {
          if (!canSafelyBlack(grid, r, c)) continue;
          grid.cells[idx] = CELL_BLACK;
          changed = true;
        }
      }
    }
  }

  // Eliminate 2-letter cross-runs where safe.
  changed = true;
  while (changed) {
    changed = false;
    for (let r = 0; r < grid.rows; r++) {
      for (let c = 0; c < grid.cols; c++) {
        const idx = cellIndex(grid, r, c);
        if (grid.cells[idx] === CELL_BLACK) continue;
        if (userCellKeys.has(`${r},${c}`)) continue;
        const across = runLen(grid, r, c, 0, 1);
        const down = runLen(grid, r, c, 1, 0);
        if (across !== 2 && down !== 2) continue;
        if (!canSafelyBlack(grid, r, c)) continue;
        grid.cells[idx] = CELL_BLACK;
        changed = true;
      }
    }
  }

}

/**
 * Final stray-cell sweep. If any non-user, non-BLACK cell has a 1-letter
 * run in some direction, black it — this is the "lonely letter up and
 * down" case the article warns against. Iterates because each removal may
 * create new strays that cascade until stable. Also handles 2-letter runs
 * the same way: those are never valid crossword words.
 */
function eliminateStraysAndDoubles(
  grid: GridModel,
  userCellKeys: Set<string>
): void {
  // Cascade-black any non-user cell sitting in a 1-letter run. Targeting
  // strays (length 1) only — cascading 2-letter runs is too aggressive and
  // strands user word letters at the boundaries.
  let changed = true;
  while (changed) {
    changed = false;
    for (let r = 0; r < grid.rows; r++) {
      for (let c = 0; c < grid.cols; c++) {
        const idx = cellIndex(grid, r, c);
        if (grid.cells[idx] === CELL_BLACK) continue;
        if (userCellKeys.has(`${r},${c}`)) continue;
        const across = runLen(grid, r, c, 0, 1);
        const down = runLen(grid, r, c, 1, 0);
        if (across === 1 || down === 1) {
          grid.cells[idx] = CELL_BLACK;
          changed = true;
        }
      }
    }
  }
}

/**
 * Count cells the best-effort solver left EMPTY (slots it skipped). Used
 * to score multiple solver attempts so we keep the one with the fewest
 * holes — fewer holes means less gibberish from crossing-letter fragments.
 */
function countSkippedAssignments(result: { grid: GridModel }): number {
  let count = 0;
  for (let i = 0; i < result.grid.cells.length; i++) {
    if (result.grid.cells[i] === CELL_EMPTY) count++;
  }
  return count;
}

// ── Phase 3: Fill (CSP) ────────────────────────────────────────────────

function fillPhase(
  grid: GridModel,
  userWords: PlacedWord[],
  scaffold: FreeformResult,
  config: BlockBuilderConfig,
  startTime: number
): BlockBuilderResult {
  // Deduplicate: user entries override dictionary entries for same word
  const entryMap = new Map<string, WordEntry>();
  for (const e of config.dictionary) entryMap.set(e.word.toUpperCase(), e);
  for (const e of config.entries) entryMap.set(e.word.toUpperCase(), e);
  const allEntries = Array.from(entryMap.values()).map((e) => ({
    ...e,
    word: e.word.toUpperCase(),
  }));

  const wordIndex = buildWordIndex(allEntries);

  const userWordSet = new Set(
    config.entries.map((e) => e.word.toUpperCase())
  );
  const preferred = new Set<number>();
  for (let i = 0; i < wordIndex.words.length; i++) {
    if (userWordSet.has(wordIndex.words[i])) preferred.add(i);
  }

  // Build user cell positions early — needed for iterative break-and-retry.
  const userCellKeys = new Set<string>();
  for (const pw of userWords) {
    const dr = pw.direction === "down" ? 1 : 0;
    const dc = pw.direction === "across" ? 1 : 0;
    for (let i = 0; i < pw.word.length; i++) {
      userCellKeys.add(`${pw.row + i * dr},${pw.col + i * dc}`);
    }
  }

  // Iterative solve-and-break (the "trial and error" crossword setters
  // describe). Try full backtracking → success means every slot is a real
  // dictionary word. On failure, run best-effort to find which slots got
  // skipped, black out a cell in each, and try again. Batching breaks per
  // iteration converges faster than breaking one slot at a time.
  const baseSeed = config.seed ?? 42;
  let result: { grid: GridModel; assignments: Map<number, string>; solveTimeMs: number } | null = null;
  const MAX_BREAK_ATTEMPTS = 4;

  for (let attempt = 0; attempt < MAX_BREAK_ATTEMPTS; attempt++) {
    const fullSolutions = solve(grid, wordIndex, {
      maxSolutions: 1,
      seed: baseSeed + attempt,
      preferredWordIndices: preferred,
    });
    if (fullSolutions.length > 0) {
      result = fullSolutions[0];
      break;
    }

    // Full solve failed. Find all slots best-effort skipped and break them.
    const beResult = solveBestEffort(grid, wordIndex, {
      maxSolutions: 1,
      seed: baseSeed + attempt,
      preferredWordIndices: preferred,
    });
    const slotsNow = extractSlots(grid);
    const skipped = slotsNow.filter((s) => !beResult.assignments.has(s.id));
    if (skipped.length === 0) {
      result = beResult;
      break;
    }

    let anyBroken = false;
    for (const slot of skipped) {
      const midI = Math.floor(slot.length / 2);
      const order: number[] = [midI];
      for (let off = 1; off < slot.length; off++) {
        if (midI - off >= 0) order.push(midI - off);
        if (midI + off < slot.length) order.push(midI + off);
      }
      for (const i of order) {
        const cellIdx = slot.cellIndices[i];
        const { row: r, col: c } = cellPosition(grid, cellIdx);
        if (userCellKeys.has(`${r},${c}`)) continue;
        if (!canSafelyBlack(grid, r, c)) continue;
        grid.cells[cellIdx] = CELL_BLACK;
        anyBroken = true;
        break;
      }
    }
    if (!anyBroken) {
      result = beResult;
      break;
    }
  }

  if (!result) {
    // Hit the attempt limit — settle for best-effort.
    result = solveBestEffort(grid, wordIndex, {
      maxSolutions: 1,
      seed: baseSeed,
      preferredWordIndices: preferred,
    });
  }

  // Remaining empty cells become BLACK
  const finalCells = new Uint8Array(result.grid.cells);
  for (let i = 0; i < finalCells.length; i++) {
    if (finalCells[i] === CELL_EMPTY) finalCells[i] = CELL_BLACK;
  }
  const finalGrid: GridModel = {
    rows: grid.rows,
    cols: grid.cols,
    cells: finalCells,
  };

  postFillCleanup(finalGrid, userCellKeys);

  // Strip out any letter run whose resulting word isn't valid. This handles
  // slots the best-effort solver skipped — their cells may be filled by
  // crossings, but the resulting letter sequence isn't necessarily a real
  // word. After this pass, every run in finalGrid is in validWords.
  const validWords = new Set<string>();
  for (const e of allEntries) validWords.add(e.word);
  cleanupInvalidSlots(finalGrid, validWords, userCellKeys);

  // Final pass: any cell that isn't part of a 3+ letter word in BOTH
  // directions violates crossword rules ("all cells checked"). Cascade-
  // remove non-user offenders until the rule holds everywhere.
  eliminateStraysAndDoubles(finalGrid, userCellKeys);

  // Build clue lookup (user clues take priority)
  const clueMap = new Map<string, string>();
  for (const e of config.dictionary) clueMap.set(e.word.toUpperCase(), e.clue);
  for (const e of config.entries) clueMap.set(e.word.toUpperCase(), e.clue);

  // Index user word positions for isUser detection
  const userByPos = new Map<string, PlacedWord>();
  for (const pw of userWords) {
    userByPos.set(`${pw.row},${pw.col},${pw.direction}`, pw);
  }

  // Extract placedWords by walking the cleaned final grid. Any run here is
  // guaranteed to be a valid word (user or dictionary).
  const placedWords: BlockPlacedWord[] = [];
  for (const slot of walkSlots(finalGrid)) {
    const key = `${slot.row},${slot.col},${slot.direction}`;
    const userMatch = userByPos.get(key);
    if (userMatch && userMatch.word === slot.word) {
      placedWords.push({
        word: slot.word,
        clue: clueMap.get(slot.word) ?? "",
        row: slot.row,
        col: slot.col,
        direction: slot.direction,
        isUser: true,
      });
    } else {
      placedWords.push({
        word: slot.word,
        clue: clueMap.get(slot.word) ?? "",
        row: slot.row,
        col: slot.col,
        direction: slot.direction,
        isUser: userWordSet.has(slot.word),
      });
    }
  }

  return {
    grid: finalGrid,
    placedWords,
    scaffoldResult: scaffold,
    solveTimeMs: performance.now() - startTime,
  };
}

/**
 * Convert a BlockBuilderResult into a FreeformResult so the existing
 * preview components can render it without changes.
 */
export function blockResultToFreeform(
  result: BlockBuilderResult,
  entries: WordEntry[]
): FreeformResult {
  const grid: string[][] = [];
  for (let r = 0; r < result.grid.rows; r++) {
    const row: string[] = [];
    for (let c = 0; c < result.grid.cols; c++) {
      const v = result.grid.cells[cellIndex(result.grid, r, c)];
      if (v === CELL_BLACK || v === CELL_EMPTY) row.push("#");
      else row.push(cellToLetter(v));
    }
    grid.push(row);
  }

  const placed: PlacedWord[] = result.placedWords.map((pw) => ({
    word: pw.word,
    clue: pw.clue,
    row: pw.row,
    col: pw.col,
    direction: pw.direction,
    isFill: !pw.isUser,
  }));

  const acrossCells = new Set<string>();
  const downCells = new Set<string>();
  for (const pw of placed) {
    const dr = pw.direction === "down" ? 1 : 0;
    const dc = pw.direction === "across" ? 1 : 0;
    for (let i = 0; i < pw.word.length; i++) {
      const key = `${pw.row + i * dr},${pw.col + i * dc}`;
      if (pw.direction === "across") acrossCells.add(key);
      else downCells.add(key);
    }
  }
  let intersections = 0;
  for (const key of acrossCells) {
    if (downCells.has(key)) intersections++;
  }

  const placedUserWords = new Set(
    result.placedWords.filter((pw) => pw.isUser).map((pw) => pw.word)
  );
  const unplaced = entries.filter(
    (e) => !placedUserWords.has(e.word.toUpperCase())
  );

  return {
    placed,
    unplaced,
    grid,
    rows: result.grid.rows,
    cols: result.grid.cols,
    intersections,
  };
}
