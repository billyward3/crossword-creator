import type { Position } from "./types";

/**
 * Compute clue numbers for a crossword grid.
 *
 * A cell gets a clue number if it is white and starts an across word
 * (left neighbor is black or edge) or a down word (top neighbor is black or edge),
 * provided the run length is >= minWordLength.
 */
export function computeClueNumbers(
  rows: number,
  cols: number,
  isBlack: (row: number, col: number) => boolean,
  minWordLength: number = 3
): Map<string, number> {
  const numbers = new Map<string, number>();
  let num = 1;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (isBlack(r, c)) continue;

      const startsAcross = (c === 0 || isBlack(r, c - 1)) && hasRunLength(r, c, 0, 1, rows, cols, isBlack, minWordLength);
      const startsDown = (r === 0 || isBlack(r - 1, c)) && hasRunLength(r, c, 1, 0, rows, cols, isBlack, minWordLength);

      if (startsAcross || startsDown) {
        numbers.set(`${r},${c}`, num);
        num++;
      }
    }
  }

  return numbers;
}

/** Check if a run of white cells starting at (r, c) in direction (dr, dc) has at least minLength cells */
function hasRunLength(
  r: number,
  c: number,
  dr: number,
  dc: number,
  rows: number,
  cols: number,
  isBlack: (row: number, col: number) => boolean,
  minLength: number
): boolean {
  let count = 0;
  let cr = r;
  let cc = c;
  while (cr >= 0 && cr < rows && cc >= 0 && cc < cols && !isBlack(cr, cc)) {
    count++;
    if (count >= minLength) return true;
    cr += dr;
    cc += dc;
  }
  return false;
}

/**
 * Get all numbered positions sorted by number.
 */
export function getNumberedPositions(
  clueNumbers: Map<string, number>
): { position: Position; number: number }[] {
  const result: { position: Position; number: number }[] = [];
  for (const [key, num] of clueNumbers) {
    const [row, col] = key.split(",").map(Number);
    result.push({ position: { row, col }, number: num });
  }
  return result.sort((a, b) => a.number - b.number);
}
