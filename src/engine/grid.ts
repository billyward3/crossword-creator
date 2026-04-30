import {
  CELL_BLACK,
  CELL_EMPTY,
  type GridModel,
  type SlotDescriptor,
  type SlotIntersection,
  type GridGap,
} from "./types";

/** Create a new empty grid (all white cells) */
export function createGrid(rows: number, cols: number): GridModel {
  const cells = new Uint8Array(rows * cols);
  cells.fill(CELL_EMPTY);
  return { rows, cols, cells };
}

/** Get the flat index for a (row, col) position */
export function cellIndex(grid: GridModel, row: number, col: number): number {
  return row * grid.cols + col;
}

/** Get the (row, col) from a flat index */
export function cellPosition(
  grid: GridModel,
  index: number
): { row: number; col: number } {
  return {
    row: Math.floor(index / grid.cols),
    col: index % grid.cols,
  };
}

/** Check if a cell is black */
export function isBlack(grid: GridModel, row: number, col: number): boolean {
  return grid.cells[cellIndex(grid, row, col)] === CELL_BLACK;
}

/** Check if a cell is within grid bounds */
export function inBounds(grid: GridModel, row: number, col: number): boolean {
  return row >= 0 && row < grid.rows && col >= 0 && col < grid.cols;
}

/**
 * Get the 180-degree rotational symmetry partner of a cell.
 * For a grid of size (rows, cols), the partner of (r, c) is (rows-1-r, cols-1-c).
 */
export function symmetryPartner(
  grid: GridModel,
  row: number,
  col: number
): { row: number; col: number } {
  return {
    row: grid.rows - 1 - row,
    col: grid.cols - 1 - col,
  };
}

/**
 * Toggle a cell between black and white, enforcing 180-degree rotational symmetry.
 * Returns a new GridModel (immutable).
 */
export function toggleCell(
  grid: GridModel,
  row: number,
  col: number
): GridModel {
  const newCells = new Uint8Array(grid.cells);
  const idx = cellIndex(grid, row, col);
  const newValue = newCells[idx] === CELL_BLACK ? CELL_EMPTY : CELL_BLACK;

  // Set the cell and its symmetry partner
  newCells[idx] = newValue;
  const partner = symmetryPartner(grid, row, col);
  newCells[cellIndex(grid, partner.row, partner.col)] = newValue;

  return { rows: grid.rows, cols: grid.cols, cells: newCells };
}

/**
 * Set a cell to a specific value without symmetry enforcement.
 * Used internally by the solver.
 */
export function setCell(
  grid: GridModel,
  row: number,
  col: number,
  value: number
): GridModel {
  const newCells = new Uint8Array(grid.cells);
  newCells[cellIndex(grid, row, col)] = value;
  return { rows: grid.rows, cols: grid.cols, cells: newCells };
}

/**
 * Extract all word slots from the grid pattern.
 * A slot is a contiguous run of non-black cells in one direction with length >= minLength.
 */
export function extractSlots(
  grid: GridModel,
  minLength: number = 3
): SlotDescriptor[] {
  const slots: SlotDescriptor[] = [];
  let nextId = 0;

  // Extract across slots
  for (let r = 0; r < grid.rows; r++) {
    let runStart = -1;
    for (let c = 0; c <= grid.cols; c++) {
      const isEnd = c === grid.cols || isBlack(grid, r, c);
      if (isEnd) {
        if (runStart >= 0) {
          const length = c - runStart;
          if (length >= minLength) {
            const cellIndices: number[] = [];
            for (let cc = runStart; cc < c; cc++) {
              cellIndices.push(cellIndex(grid, r, cc));
            }
            slots.push({
              id: nextId++,
              direction: "across",
              startRow: r,
              startCol: runStart,
              length,
              cellIndices,
              intersections: [], // filled in later
            });
          }
          runStart = -1;
        }
      } else if (runStart < 0) {
        runStart = c;
      }
    }
  }

  // Extract down slots
  for (let c = 0; c < grid.cols; c++) {
    let runStart = -1;
    for (let r = 0; r <= grid.rows; r++) {
      const isEnd = r === grid.rows || isBlack(grid, r, c);
      if (isEnd) {
        if (runStart >= 0) {
          const length = r - runStart;
          if (length >= minLength) {
            const cellIndices: number[] = [];
            for (let rr = runStart; rr < r; rr++) {
              cellIndices.push(cellIndex(grid, rr, c));
            }
            slots.push({
              id: nextId++,
              direction: "down",
              startRow: runStart,
              startCol: c,
              length,
              cellIndices,
              intersections: [], // filled in later
            });
          }
          runStart = -1;
        }
      } else if (runStart < 0) {
        runStart = r;
      }
    }
  }

  // Build intersection map
  computeIntersections(slots);

  return slots;
}

/** Compute intersections between all slots (mutates the slots' intersections arrays) */
function computeIntersections(slots: SlotDescriptor[]): void {
  // Build a map: cell flat index → (slot id, position in slot)
  const cellToSlot = new Map<number, { slotId: number; position: number }[]>();

  for (const slot of slots) {
    for (let pos = 0; pos < slot.cellIndices.length; pos++) {
      const ci = slot.cellIndices[pos];
      if (!cellToSlot.has(ci)) {
        cellToSlot.set(ci, []);
      }
      cellToSlot.get(ci)!.push({ slotId: slot.id, position: pos });
    }
  }

  // For each cell that has 2+ slots, create intersection records
  for (const entries of cellToSlot.values()) {
    if (entries.length < 2) continue;
    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        const a = entries[i];
        const b = entries[j];
        const slotA = slots.find((s) => s.id === a.slotId)!;
        const slotB = slots.find((s) => s.id === b.slotId)!;

        slotA.intersections.push({
          positionInSlot: a.position,
          otherSlotId: b.slotId,
          positionInOtherSlot: b.position,
        });
        slotB.intersections.push({
          positionInSlot: b.position,
          otherSlotId: a.slotId,
          positionInOtherSlot: a.position,
        });
      }
    }
  }
}

/**
 * Validate a grid against American-style crossword rules.
 * Returns an array of gaps/issues found.
 */
export function validateGrid(
  grid: GridModel,
  minWordLength: number = 3
): GridGap[] {
  const gaps: GridGap[] = [];

  // Check symmetry
  for (let r = 0; r < grid.rows; r++) {
    for (let c = 0; c < grid.cols; c++) {
      const partner = symmetryPartner(grid, r, c);
      const cellVal = grid.cells[cellIndex(grid, r, c)];
      const partnerVal =
        grid.cells[cellIndex(grid, partner.row, partner.col)];
      const cellIsBlack = cellVal === CELL_BLACK;
      const partnerIsBlack = partnerVal === CELL_BLACK;
      if (cellIsBlack !== partnerIsBlack) {
        gaps.push({
          type: "symmetry_violation",
          row: r,
          col: c,
          description: `Cell (${r},${c}) and its symmetry partner (${partner.row},${partner.col}) have different black/white status`,
        });
      }
    }
  }

  // Check that all white cells are "checked" (part of both an across and down word)
  for (let r = 0; r < grid.rows; r++) {
    for (let c = 0; c < grid.cols; c++) {
      if (isBlack(grid, r, c)) continue;

      const acrossRun = getRunLength(grid, r, c, 0, 1);
      const downRun = getRunLength(grid, r, c, 1, 0);

      if (acrossRun < minWordLength) {
        gaps.push({
          type: "short_run",
          row: r,
          col: c,
          description: `Across run at (${r},${c}) has length ${acrossRun}, minimum is ${minWordLength}`,
        });
      }

      if (downRun < minWordLength) {
        gaps.push({
          type: "short_run",
          row: r,
          col: c,
          description: `Down run at (${r},${c}) has length ${downRun}, minimum is ${minWordLength}`,
        });
      }
    }
  }

  // Check connectivity (all white cells should be reachable from any other white cell)
  const visited = new Set<number>();
  let startIdx = -1;
  for (let i = 0; i < grid.cells.length; i++) {
    if (grid.cells[i] !== CELL_BLACK) {
      startIdx = i;
      break;
    }
  }

  if (startIdx >= 0) {
    // BFS from the first white cell
    const queue = [startIdx];
    visited.add(startIdx);
    while (queue.length > 0) {
      const idx = queue.shift()!;
      const { row, col } = cellPosition(grid, idx);
      const neighbors = [
        [row - 1, col],
        [row + 1, col],
        [row, col - 1],
        [row, col + 1],
      ];
      for (const [nr, nc] of neighbors) {
        if (!inBounds(grid, nr, nc)) continue;
        const ni = cellIndex(grid, nr, nc);
        if (grid.cells[ni] !== CELL_BLACK && !visited.has(ni)) {
          visited.add(ni);
          queue.push(ni);
        }
      }
    }

    // Check if any white cell was not visited
    for (let i = 0; i < grid.cells.length; i++) {
      if (grid.cells[i] !== CELL_BLACK && !visited.has(i)) {
        const { row, col } = cellPosition(grid, i);
        gaps.push({
          type: "disconnected",
          row,
          col,
          description: `White cell (${row},${col}) is disconnected from the main grid`,
        });
      }
    }
  }

  return gaps;
}

/**
 * Get the length of the contiguous run of white cells containing (r, c)
 * in the direction specified by (dr, dc).
 */
function getRunLength(
  grid: GridModel,
  r: number,
  c: number,
  dr: number,
  dc: number
): number {
  // Find the start of the run
  let sr = r;
  let sc = c;
  while (
    inBounds(grid, sr - dr, sc - dc) &&
    !isBlack(grid, sr - dr, sc - dc)
  ) {
    sr -= dr;
    sc -= dc;
  }

  // Count the length
  let length = 0;
  let cr = sr;
  let cc = sc;
  while (inBounds(grid, cr, cc) && !isBlack(grid, cr, cc)) {
    length++;
    cr += dr;
    cc += dc;
  }

  return length;
}

/**
 * Create a grid from a pattern string.
 * '#' = black cell, '.' = empty white cell, letters = filled white cells.
 * Rows are separated by newlines.
 */
export function gridFromPattern(pattern: string): GridModel {
  const lines = pattern
    .trim()
    .split("\n")
    .map((l) => l.trim());
  const rows = lines.length;
  const cols = lines[0].length;
  const grid = createGrid(rows, cols);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const ch = lines[r][c];
      if (ch === "#") {
        grid.cells[cellIndex(grid, r, c)] = CELL_BLACK;
      } else if (ch === ".") {
        grid.cells[cellIndex(grid, r, c)] = CELL_EMPTY;
      } else {
        // Letter
        grid.cells[cellIndex(grid, r, c)] =
          ch.toUpperCase().charCodeAt(0) - 64;
      }
    }
  }

  return grid;
}

/** Convert a grid back to a pattern string for debugging */
export function gridToPattern(grid: GridModel): string {
  const lines: string[] = [];
  for (let r = 0; r < grid.rows; r++) {
    let line = "";
    for (let c = 0; c < grid.cols; c++) {
      const val = grid.cells[cellIndex(grid, r, c)];
      if (val === CELL_BLACK) {
        line += "#";
      } else if (val === CELL_EMPTY) {
        line += ".";
      } else {
        line += String.fromCharCode(val + 64);
      }
    }
    lines.push(line);
  }
  return lines.join("\n");
}
