/**
 * Tracks puzzle IDs the current browser has shared. Used to decide
 * whether to show "creator" affordances on the solver page (like a
 * "Back to share" link) versus the plain solver UI a recipient sees.
 *
 * Browser-local; no server identity. A user clearing storage or
 * switching browsers will lose the association.
 */

const STORAGE_KEY = "crossword-my-puzzles";
const MAX_TRACKED = 50;

function readList(): string[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function writeList(ids: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {}
}

/** Record that this browser uploaded the puzzle with the given ID. */
export function markPuzzleAsMine(id: string): void {
  const list = readList().filter((v) => v !== id);
  list.unshift(id);
  while (list.length > MAX_TRACKED) list.pop();
  writeList(list);
}

/** True if this browser has previously uploaded the puzzle. */
export function isMyPuzzle(id: string): boolean {
  return readList().includes(id);
}
