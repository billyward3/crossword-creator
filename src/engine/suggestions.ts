import type { GridModel, SlotDescriptor, SlotFeasibility, GridGap } from "./types";
import { CELL_BLACK, CELL_EMPTY, cellToLetter } from "./types";
import { cellIndex, cellPosition, inBounds, isBlack, extractSlots, symmetryPartner } from "./grid";
import { WordIndex } from "./wordindex";
import { initializeDomains, assignWord } from "./constraints";
import { computeClueNumbers } from "@/lib/numbering";

/**
 * A suggestion for the user to add a word to their wordlist.
 * Instead of suggesting specific words (which would require a dictionary),
 * this tells the user what constraints a new word needs to satisfy.
 */
export interface WordNeededSuggestion {
  /** The slot that needs a word */
  slotId: number;
  /** Direction of the slot */
  direction: "across" | "down";
  /** Clue number position (row, col) */
  startRow: number;
  startCol: number;
  /** Required word length */
  length: number;
  /** Pattern showing known letters and blanks, e.g., "_R__E" */
  pattern: string;
  /** Known letter constraints: [position, letter] */
  constraints: [number, string][];
  /** How critical this slot is: "blocking" = prevents other fills, "helpful" = improves density */
  urgency: "blocking" | "helpful";
  /** Human-readable explanation */
  message: string;
}

/**
 * Analyze a grid with partial fills and suggest what words the user should add
 * to their wordlist to make the crossword solvable.
 */
export function analyzeSuggestions(
  grid: GridModel,
  wordIndex: WordIndex
): {
  feasibility: SlotFeasibility[];
  suggestions: WordNeededSuggestion[];
  gaps: GridGap[];
} {
  const slots = extractSlots(grid);
  const slotMap = new Map<number, SlotDescriptor>();
  for (const s of slots) slotMap.set(s.id, s);

  // Compute clue numbers for human-readable messages
  const clueNumbers = computeClueNumbers(grid.rows, grid.cols, (r, c) => {
    return grid.cells[cellIndex(grid, r, c)] === CELL_BLACK;
  });

  // Compute feasibility for each slot
  const state = initializeDomains(slots, wordIndex);
  const feasibility: SlotFeasibility[] = [];

  for (const slot of slots) {
    const constraints = getSlotConstraints(grid, slot);
    const candidates = wordIndex.getCandidates(slot.length, constraints);

    let status: SlotFeasibility["status"];
    if (candidates.length === 0) status = "impossible";
    else if (candidates.length === 1) status = "forced";
    else if (candidates.length <= 10) status = "constrained";
    else status = "flexible";

    feasibility.push({
      slotId: slot.id,
      domainSize: candidates.length,
      status,
      topCandidates: candidates
        .slice(0, 10)
        .map((i) => wordIndex.words[i]),
    });
  }

  // Generate suggestions for impossible/constrained slots
  const suggestions: WordNeededSuggestion[] = [];

  for (const f of feasibility) {
    if (f.status !== "impossible") continue;

    const slot = slotMap.get(f.slotId)!;
    const constraints = getSlotConstraints(grid, slot);
    const pattern = wordIndex.getConstraintPattern(slot.length, constraints);

    const isBlocking = slot.intersections.some((inter) => {
      const neighborFeas = feasibility.find((ff) => ff.slotId === inter.otherSlotId);
      return neighborFeas && neighborFeas.status !== "impossible";
    });

    // Only use clue number if this slot's start cell actually begins a word
    // in this slot's direction (a cell can be numbered for Down but not Across)
    const clueNum = clueNumbers.get(`${slot.startRow},${slot.startCol}`);
    const startsInDirection = slot.direction === "across"
      ? (slot.startCol === 0 || isBlack(grid, slot.startRow, slot.startCol - 1))
      : (slot.startRow === 0 || isBlack(grid, slot.startRow - 1, slot.startCol));
    const validClueNum = clueNum !== undefined && startsInDirection ? clueNum : undefined;

    suggestions.push({
      slotId: slot.id,
      direction: slot.direction,
      startRow: slot.startRow,
      startCol: slot.startCol,
      length: slot.length,
      pattern,
      constraints,
      urgency: isBlocking ? "blocking" : "helpful",
      message: buildSuggestionMessage(slot, pattern, constraints, validClueNum),
    });
  }

  // Sort: blocking suggestions first, then by slot length (shorter = easier to fill)
  suggestions.sort((a, b) => {
    if (a.urgency !== b.urgency) return a.urgency === "blocking" ? -1 : 1;
    return a.length - b.length;
  });

  // Analyze grid gaps
  const gaps = analyzeGaps(grid);

  return { feasibility, suggestions, gaps };
}

/**
 * Get the letter constraints for a slot based on letters already placed in the grid.
 * Returns [position, letter] pairs for each cell that has a letter.
 */
function getSlotConstraints(
  grid: GridModel,
  slot: SlotDescriptor
): [number, string][] {
  const constraints: [number, string][] = [];
  for (let i = 0; i < slot.cellIndices.length; i++) {
    const cellVal = grid.cells[slot.cellIndices[i]];
    if (cellVal !== CELL_EMPTY && cellVal !== CELL_BLACK) {
      constraints.push([i, cellToLetter(cellVal)]);
    }
  }
  return constraints;
}

/** Build a human-readable suggestion message */
function buildSuggestionMessage(
  slot: SlotDescriptor,
  pattern: string,
  constraints: [number, string][],
  clueNumber?: number
): string {
  const dirLabel = slot.direction === "across" ? "Across" : "Down";

  // Only use the clue number if it actually corresponds to this slot's direction.
  // A cell can have a clue number for Down but not Across (or vice versa),
  // so we verify the slot direction matches before using the number.
  let label: string;
  if (clueNumber) {
    label = `${clueNumber} ${dirLabel}`;
  } else {
    label = `${dirLabel} (row ${slot.startRow + 1}, col ${slot.startCol + 1})`;
  }

  if (constraints.length === 0) {
    return `Need a ${slot.length}-letter word for ${label}. Any ${slot.length}-letter word will work!`;
  }

  const knownLetters = constraints
    .map(([pos, letter]) => `${letter} at position ${pos + 1}`)
    .join(", ");

  return `Need a ${slot.length}-letter word matching "${pattern}" for ${label} (${knownLetters}).`;
}

/**
 * Analyze the grid pattern for structural issues.
 */
function analyzeGaps(grid: GridModel): GridGap[] {
  const gaps: GridGap[] = [];

  for (let r = 0; r < grid.rows; r++) {
    for (let c = 0; c < grid.cols; c++) {
      if (isBlack(grid, r, c)) continue;

      // Check symmetry
      const partner = symmetryPartner(grid, r, c);
      if (isBlack(grid, partner.row, partner.col)) {
        gaps.push({
          type: "symmetry_violation",
          row: r,
          col: c,
          description: `Cell (${r + 1},${c + 1}) breaks symmetry with (${partner.row + 1},${partner.col + 1})`,
        });
      }

      // Check minimum run lengths
      const acrossRun = getRunLength(grid, r, c, 0, 1);
      const downRun = getRunLength(grid, r, c, 1, 0);

      if (acrossRun < 3 && acrossRun > 0) {
        // Only report for the start of the run
        if (c === 0 || isBlack(grid, r, c - 1)) {
          gaps.push({
            type: "short_run",
            row: r,
            col: c,
            description: `${acrossRun}-letter across run at (${r + 1},${c + 1}) — minimum is 3`,
          });
        }
      }
      if (downRun < 3 && downRun > 0) {
        if (r === 0 || isBlack(grid, r - 1, c)) {
          gaps.push({
            type: "short_run",
            row: r,
            col: c,
            description: `${downRun}-letter down run at (${r + 1},${c + 1}) — minimum is 3`,
          });
        }
      }
    }
  }

  return gaps;
}

/** Get the length of a run of white cells starting at (r,c) in direction (dr,dc) */
function getRunLength(
  grid: GridModel,
  r: number,
  c: number,
  dr: number,
  dc: number
): number {
  // Find start of run
  let sr = r, sc = c;
  while (inBounds(grid, sr - dr, sc - dc) && !isBlack(grid, sr - dr, sc - dc)) {
    sr -= dr;
    sc -= dc;
  }
  // Count length
  let len = 0;
  let cr = sr, cc = sc;
  while (inBounds(grid, cr, cc) && !isBlack(grid, cr, cc)) {
    len++;
    cr += dr;
    cc += dc;
  }
  return len;
}
