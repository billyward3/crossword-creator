import type { GridModel, SlotDescriptor } from "./types";
import { CELL_BLACK, CELL_EMPTY, cellToLetter } from "./types";
import { WordIndex } from "./wordindex";

/**
 * Solver state tracking domains (candidate word sets) for each slot.
 */
export interface DomainState {
  /** Slot ID → array of candidate word indices */
  domains: Map<number, number[]>;
  /** Set of word indices already used (each word can only appear once) */
  usedWords: Set<number>;
  /** Slot ID → assigned word index (null if unassigned) */
  assignments: Map<number, number | null>;
}

/**
 * Initialize domains for all slots based on their length and existing grid state.
 *
 * If a `grid` is provided, this honors letters already placed in cells:
 *   - Slots that are fully filled are pre-assigned (and that word is marked as used).
 *   - Slots with some letters filled have their domain restricted to words that
 *     match those letters at the corresponding positions.
 *
 * Without a grid, every slot starts with all same-length words as candidates.
 */
export function initializeDomains(
  slots: SlotDescriptor[],
  wordIndex: WordIndex,
  grid?: GridModel
): DomainState {
  const domains = new Map<number, number[]>();
  const assignments = new Map<number, number | null>();
  const usedWords = new Set<number>();

  for (const slot of slots) {
    // Inspect the slot's cells for any pre-filled letters
    const constraints: [number, string][] = [];
    let filledCount = 0;
    let filledWord = "";
    if (grid) {
      for (let i = 0; i < slot.cellIndices.length; i++) {
        const v = grid.cells[slot.cellIndices[i]];
        if (v !== CELL_EMPTY && v !== CELL_BLACK) {
          const letter = cellToLetter(v);
          constraints.push([i, letter]);
          filledWord += letter;
          filledCount++;
        } else {
          filledWord += "?";
        }
      }
    }

    // If the slot is completely filled, treat it as already assigned.
    if (filledCount === slot.length && filledCount > 0) {
      const wordIdx = wordIndex.words.indexOf(filledWord);
      if (wordIdx >= 0) {
        domains.set(slot.id, [wordIdx]);
        assignments.set(slot.id, wordIdx);
        usedWords.add(wordIdx);
      } else {
        // Filled letters don't form a known dictionary word.
        // Use -1 as a "locked" sentinel so the solver skips this slot.
        // buildResult() recognizes -1 and preserves the cells untouched.
        domains.set(slot.id, []);
        assignments.set(slot.id, -1);
      }
      continue;
    }

    // Partial fill: constrain domain to words matching the placed letters
    const candidates = wordIndex.getCandidates(slot.length, constraints);
    domains.set(slot.id, candidates);
    assignments.set(slot.id, null);
  }

  return {
    domains,
    usedWords,
    assignments,
  };
}

/**
 * Assign a word to a slot and propagate constraints using AC-3.
 *
 * Returns the updated domain state, or null if the assignment leads to
 * an inconsistency (some slot's domain becomes empty).
 *
 * This is the core constraint propagation step:
 * 1. Assign the word to the slot
 * 2. For each intersecting slot, narrow its domain to only words
 *    that have the correct letter at the intersection position
 * 3. Propagate: if a domain was narrowed, check all of *its* intersecting
 *    slots for consistency (AC-3 arc queue)
 */
export function assignWord(
  state: DomainState,
  slot: SlotDescriptor,
  wordIdx: number,
  allSlots: Map<number, SlotDescriptor>,
  wordIndex: WordIndex
): DomainState | null {
  // Deep copy the state for backtracking
  const newDomains = new Map<number, number[]>();
  for (const [id, domain] of state.domains) {
    newDomains.set(id, [...domain]);
  }
  const newUsed = new Set(state.usedWords);
  const newAssignments = new Map(state.assignments);

  // Assign
  newAssignments.set(slot.id, wordIdx);
  newUsed.add(wordIdx);
  newDomains.set(slot.id, [wordIdx]);

  // Get the word's letters for intersection checks
  const word = wordIndex.words[wordIdx];

  // AC-3 arc queue: slots whose domains were just narrowed
  const dirtyQueue: number[] = [];

  // Initial narrowing: constrain intersecting slots
  for (const intersection of slot.intersections) {
    const otherSlotId = intersection.otherSlotId;
    if (newAssignments.get(otherSlotId) !== null) continue; // already assigned

    const requiredLetter = word[intersection.positionInSlot];
    const otherPos = intersection.positionInOtherSlot;
    const otherSlot = allSlots.get(otherSlotId)!;

    // Filter the other slot's domain
    const oldDomain = newDomains.get(otherSlotId)!;
    const newDomain = oldDomain.filter((wi) => {
      if (newUsed.has(wi)) return false; // word already used
      return wordIndex.words[wi][otherPos] === requiredLetter;
    });

    if (newDomain.length === 0) return null; // dead end

    if (newDomain.length < oldDomain.length) {
      newDomains.set(otherSlotId, newDomain);
      dirtyQueue.push(otherSlotId);
    }
  }

  // AC-3 propagation loop
  while (dirtyQueue.length > 0) {
    const dirtySlotId = dirtyQueue.shift()!;
    const dirtySlot = allSlots.get(dirtySlotId)!;

    for (const intersection of dirtySlot.intersections) {
      const neighborId = intersection.otherSlotId;
      if (neighborId === slot.id) continue; // skip the slot we just assigned
      if (newAssignments.get(neighborId) !== null) continue;

      const neighborSlot = allSlots.get(neighborId)!;
      const dirtyDomain = newDomains.get(dirtySlotId)!;
      const neighborDomain = newDomains.get(neighborId)!;

      // Collect all letters that the dirty slot can place at the intersection
      const posInDirty = intersection.positionInSlot;
      const posInNeighbor = intersection.positionInOtherSlot;
      const possibleLetters = new Set<string>();
      for (const wi of dirtyDomain) {
        possibleLetters.add(wordIndex.words[wi][posInDirty]);
      }

      // Filter neighbor domain to words compatible with at least one dirty candidate
      const filteredNeighbor = neighborDomain.filter((wi) => {
        if (newUsed.has(wi)) return false;
        return possibleLetters.has(wordIndex.words[wi][posInNeighbor]);
      });

      if (filteredNeighbor.length === 0) return null; // dead end

      if (filteredNeighbor.length < neighborDomain.length) {
        newDomains.set(neighborId, filteredNeighbor);
        // Only re-queue if not already in queue
        if (!dirtyQueue.includes(neighborId)) {
          dirtyQueue.push(neighborId);
        }
      }
    }
  }

  return {
    domains: newDomains,
    usedWords: newUsed,
    assignments: newAssignments,
  };
}

/**
 * Remove used words from all unassigned slot domains.
 * Called after an assignment to ensure no word is used twice.
 */
export function removeUsedFromDomains(state: DomainState): DomainState | null {
  const newDomains = new Map<number, number[]>();

  for (const [id, domain] of state.domains) {
    if (state.assignments.get(id) !== null) {
      newDomains.set(id, domain);
      continue;
    }
    const filtered = domain.filter((wi) => !state.usedWords.has(wi));
    if (filtered.length === 0) return null;
    newDomains.set(id, filtered);
  }

  return { ...state, domains: newDomains };
}
