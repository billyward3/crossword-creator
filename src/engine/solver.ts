import type { GridModel, SlotDescriptor, SolverResult } from "./types";
import { letterToCell } from "./types";
import { cellIndex, extractSlots } from "./grid";
import { WordIndex } from "./wordindex";
import {
  type DomainState,
  initializeDomains,
  assignWord,
} from "./constraints";

export interface SolverConfig {
  /** Maximum number of solutions to find */
  maxSolutions: number;
  /** Random seed for value ordering (different seeds → different solutions) */
  seed: number;
  /** Callback for progress updates */
  onProgress?: (filledSlots: number, totalSlots: number) => void;
  /** Check if solving should be cancelled */
  isCancelled?: () => boolean;
}

/**
 * Solve a crossword grid: fill all slots with words from the index.
 *
 * Uses backtracking search with:
 * - MRV (Minimum Remaining Values) for slot ordering
 * - Degree heuristic for tie-breaking
 * - LCV (Least Constraining Value) for word selection
 * - AC-3 constraint propagation after each assignment
 *
 * Returns up to maxSolutions distinct solutions.
 */
export function solve(
  grid: GridModel,
  wordIndex: WordIndex,
  config: SolverConfig
): SolverResult[] {
  const slots = extractSlots(grid);
  if (slots.length === 0) return [];

  // Build slot lookup map
  const slotMap = new Map<number, SlotDescriptor>();
  for (const slot of slots) {
    slotMap.set(slot.id, slot);
  }

  // Initialize domains
  const initialState = initializeDomains(slots, wordIndex);

  // Check if any slot has an empty initial domain
  for (const [slotId, domain] of initialState.domains) {
    if (domain.length === 0) return []; // unsolvable
  }

  // Create seeded RNG for shuffling
  const rng = createRng(config.seed);

  // Collect solutions
  const solutions: SolverResult[] = [];
  const startTime = performance.now();

  backtrack(
    initialState,
    slots,
    slotMap,
    wordIndex,
    grid,
    rng,
    config,
    solutions,
    startTime
  );

  return solutions;
}

/**
 * Recursive backtracking with constraint propagation.
 */
function backtrack(
  state: DomainState,
  slots: SlotDescriptor[],
  slotMap: Map<number, SlotDescriptor>,
  wordIndex: WordIndex,
  grid: GridModel,
  rng: () => number,
  config: SolverConfig,
  solutions: SolverResult[],
  startTime: number
): boolean {
  // Check cancellation
  if (config.isCancelled?.()) return true;

  // Check if all slots are assigned
  const unassigned = slots.filter((s) => state.assignments.get(s.id) === null);
  if (unassigned.length === 0) {
    // Found a solution
    solutions.push(buildResult(state, slots, slotMap, wordIndex, grid, startTime));
    config.onProgress?.(slots.length, slots.length);
    return solutions.length >= config.maxSolutions;
  }

  // Report progress
  config.onProgress?.(slots.length - unassigned.length, slots.length);

  // MRV: pick the unassigned slot with the smallest domain
  const selectedSlot = selectSlot(unassigned, state, slotMap);

  // Get candidates ordered by LCV (least constraining value)
  const domain = state.domains.get(selectedSlot.id)!;
  const orderedCandidates = orderByLCV(
    domain,
    selectedSlot,
    state,
    slotMap,
    wordIndex,
    rng
  );

  // Try each candidate
  for (const wordIdx of orderedCandidates) {
    if (config.isCancelled?.()) return true;

    // Assign and propagate constraints
    const newState = assignWord(state, selectedSlot, wordIdx, slotMap, wordIndex);

    if (newState === null) continue; // constraint violation, try next word

    // Recurse
    const shouldStop = backtrack(
      newState,
      slots,
      slotMap,
      wordIndex,
      grid,
      rng,
      config,
      solutions,
      startTime
    );

    if (shouldStop) return true;
  }

  return false; // no solution found in this branch, backtrack
}

/**
 * MRV (Minimum Remaining Values) with degree heuristic tie-breaking.
 * Select the unassigned slot with the fewest candidates.
 * On ties, prefer the slot with the most intersections to unassigned slots.
 */
function selectSlot(
  unassigned: SlotDescriptor[],
  state: DomainState,
  slotMap: Map<number, SlotDescriptor>
): SlotDescriptor {
  let best = unassigned[0];
  let bestDomainSize = state.domains.get(best.id)!.length;
  let bestDegree = countUnassignedIntersections(best, state);

  for (let i = 1; i < unassigned.length; i++) {
    const slot = unassigned[i];
    const domainSize = state.domains.get(slot.id)!.length;

    if (
      domainSize < bestDomainSize ||
      (domainSize === bestDomainSize &&
        countUnassignedIntersections(slot, state) > bestDegree)
    ) {
      best = slot;
      bestDomainSize = domainSize;
      bestDegree = countUnassignedIntersections(slot, state);
    }
  }

  return best;
}

/** Count how many of a slot's intersecting slots are still unassigned */
function countUnassignedIntersections(
  slot: SlotDescriptor,
  state: DomainState
): number {
  let count = 0;
  for (const intersection of slot.intersections) {
    if (state.assignments.get(intersection.otherSlotId) === null) {
      count++;
    }
  }
  return count;
}

/**
 * LCV (Least Constraining Value) ordering with randomized tie-breaking.
 *
 * For each candidate word, estimate how many total candidates remain
 * across all intersecting slots if this word is placed. Prefer words
 * that leave the most options open.
 *
 * The random seed adds diversity — different seeds produce different
 * orderings among equally-constraining words, leading to different solutions.
 */
function orderByLCV(
  domain: number[],
  slot: SlotDescriptor,
  state: DomainState,
  slotMap: Map<number, SlotDescriptor>,
  wordIndex: WordIndex,
  rng: () => number
): number[] {
  if (domain.length <= 1) return domain;

  // For large domains, skip expensive LCV scoring and just shuffle
  // This keeps performance manageable on early, unconstrained slots
  if (domain.length > 100) {
    const shuffled = [...domain];
    shuffleArray(shuffled, rng);
    return shuffled;
  }

  // Score each candidate by how many options it leaves for neighbors
  const scored: { wordIdx: number; score: number }[] = [];

  for (const wordIdx of domain) {
    const word = wordIndex.words[wordIdx];
    let totalRemaining = 0;

    for (const intersection of slot.intersections) {
      if (state.assignments.get(intersection.otherSlotId) !== null) continue;

      const requiredLetter = word[intersection.positionInSlot];
      const neighborDomain = state.domains.get(intersection.otherSlotId)!;
      const otherPos = intersection.positionInOtherSlot;

      // Count how many neighbor candidates are compatible
      let compatible = 0;
      for (const ni of neighborDomain) {
        if (ni === wordIdx) continue; // can't reuse the same word
        if (wordIndex.words[ni][otherPos] === requiredLetter) {
          compatible++;
        }
      }
      totalRemaining += compatible;
    }

    // Add small random noise for diversity
    scored.push({
      wordIdx,
      score: totalRemaining + rng() * 0.5,
    });
  }

  // Sort descending by score (most remaining = least constraining)
  scored.sort((a, b) => b.score - a.score);

  return scored.map((s) => s.wordIdx);
}

/** Build a SolverResult from a completed assignment */
function buildResult(
  state: DomainState,
  slots: SlotDescriptor[],
  slotMap: Map<number, SlotDescriptor>,
  wordIndex: WordIndex,
  templateGrid: GridModel,
  startTime: number
): SolverResult {
  // Create a copy of the grid with letters filled in
  const filledCells = new Uint8Array(templateGrid.cells);
  const assignments = new Map<number, string>();

  for (const slot of slots) {
    const wordIdx = state.assignments.get(slot.id)!;
    const word = wordIndex.words[wordIdx];
    assignments.set(slot.id, word);

    for (let i = 0; i < slot.cellIndices.length; i++) {
      filledCells[slot.cellIndices[i]] = letterToCell(word[i]);
    }
  }

  return {
    grid: {
      rows: templateGrid.rows,
      cols: templateGrid.cols,
      cells: filledCells,
    },
    assignments,
    solveTimeMs: performance.now() - startTime,
  };
}

/**
 * Simple seeded PRNG (mulberry32).
 * Produces deterministic sequences for reproducible results.
 */
function createRng(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher-Yates shuffle using a seeded RNG */
function shuffleArray<T>(arr: T[], rng: () => number): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}
