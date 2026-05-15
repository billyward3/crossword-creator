"use client";

import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Puzzle } from "@/lib/puzzle/types";
import { isMyPuzzle } from "@/lib/puzzle/my-puzzles";

const STORAGE_KEY_EDITOR = "crossword-editor-state";

type Direction = "across" | "down";
interface CellPos {
  row: number;
  col: number;
}
interface DetectedWord {
  number: number;
  word: string; // answer key
  row: number;
  col: number;
  direction: Direction;
  clue: string;
}

function isBlack(v: string): boolean {
  return v === "#";
}

function isLetter(v: string): boolean {
  return /^[A-Z]$/.test(v);
}

/**
 * Scan grid for word starts and assign numbers in standard crossword
 * order: top-to-bottom, left-to-right. Returns the placed words with
 * their numbers and clues.
 */
function detectWords(
  grid: string[][],
  clues: Record<string, string>
): DetectedWord[] {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  const isOpen = (r: number, c: number) =>
    r >= 0 && r < rows && c >= 0 && c < cols && !isBlack(grid[r][c]);

  // Compute number assignments by walking cells in order.
  const numberAt: Record<string, number> = {};
  let nextNum = 1;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!isOpen(r, c)) continue;
      const startsAcross = !isOpen(r, c - 1) && isOpen(r, c + 1);
      const startsDown = !isOpen(r - 1, c) && isOpen(r + 1, c);
      if (startsAcross || startsDown) {
        numberAt[`${r},${c}`] = nextNum++;
      }
    }
  }

  const words: DetectedWord[] = [];
  // Across
  for (let r = 0; r < rows; r++) {
    let runStart = -1;
    let answer = "";
    for (let c = 0; c <= cols; c++) {
      const open = isOpen(r, c);
      if (open) {
        if (runStart === -1) runStart = c;
        answer += grid[r][c] || " ";
      } else {
        if (runStart !== -1 && answer.length >= 2) {
          const number = numberAt[`${r},${runStart}`] ?? 0;
          words.push({
            number,
            word: answer,
            row: r,
            col: runStart,
            direction: "across",
            clue: clues[`${r},${runStart},across`] ?? "",
          });
        }
        runStart = -1;
        answer = "";
      }
    }
  }
  // Down
  for (let c = 0; c < cols; c++) {
    let runStart = -1;
    let answer = "";
    for (let r = 0; r <= rows; r++) {
      const open = isOpen(r, c);
      if (open) {
        if (runStart === -1) runStart = r;
        answer += grid[r][c] || " ";
      } else {
        if (runStart !== -1 && answer.length >= 2) {
          const number = numberAt[`${runStart},${c}`] ?? 0;
          words.push({
            number,
            word: answer,
            row: runStart,
            col: c,
            direction: "down",
            clue: clues[`${runStart},${c},down`] ?? "",
          });
        }
        runStart = -1;
        answer = "";
      }
    }
  }
  // Stable order: across first by number, then down by number
  return words.sort((a, b) => {
    if (a.direction !== b.direction) {
      return a.direction === "across" ? -1 : 1;
    }
    return a.number - b.number;
  });
}

function clueNumberAt(
  grid: string[][],
  r: number,
  c: number
): number | null {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  const isOpen = (rr: number, cc: number) =>
    rr >= 0 && rr < rows && cc >= 0 && cc < cols && !isBlack(grid[rr][cc]);
  let n = 0;
  for (let rr = 0; rr < rows; rr++) {
    for (let cc = 0; cc < cols; cc++) {
      if (!isOpen(rr, cc)) continue;
      const startsAcross = !isOpen(rr, cc - 1) && isOpen(rr, cc + 1);
      const startsDown = !isOpen(rr - 1, cc) && isOpen(rr + 1, cc);
      if (startsAcross || startsDown) {
        n++;
        if (rr === r && cc === c) return n;
      }
    }
  }
  return null;
}

export default function SolvePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** What the solver has typed: 2D grid same shape as puzzle.grid; "" = unfilled. */
  const [entries, setEntries] = useState<string[][]>([]);
  const [selected, setSelected] = useState<CellPos | null>(null);
  const [direction, setDirection] = useState<Direction>("across");
  /** Cells the solver has revealed/checked. Wrong → "wrong" tag styling. */
  const [checked, setChecked] = useState<Record<string, "right" | "wrong">>({});
  /** True if this browser uploaded the puzzle. localStorage check, so it runs
   *  client-side only. */
  const [isCreator, setIsCreator] = useState(false);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const router = useRouter();

  useEffect(() => {
    setIsCreator(isMyPuzzle(id));
  }, [id]);

  /**
   * Load this puzzle into the editor as a starting point. Anyone viewing
   * a public puzzle can "remix" it — their copy lives in their own
   * localStorage, so this doesn't touch the shared version on the server.
   */
  const editPuzzle = useCallback(() => {
    if (!puzzle) return;
    const editorState = {
      grid: puzzle.grid,
      clues: puzzle.clues,
      userWords: puzzle.userWords ?? [],
      fillWords: puzzle.fillWords ?? [],
      title: puzzle.title ?? "",
    };
    localStorage.setItem(STORAGE_KEY_EDITOR, JSON.stringify(editorState));
    router.push("/create/edit");
  }, [puzzle, router]);

  // Fetch the puzzle
  useEffect(() => {
    let alive = true;
    fetch(`/api/puzzles/${id}`)
      .then(async (res) => {
        if (!alive) return;
        if (!res.ok) {
          if (res.status === 404) setError("Puzzle not found");
          else setError("Failed to load puzzle");
          setLoading(false);
          return;
        }
        const data: Puzzle = await res.json();
        if (!alive) return;
        setPuzzle(data);
        // Initialize blank entries grid matching puzzle dimensions
        setEntries(
          data.grid.map((row) =>
            row.map((cell) => (isBlack(cell) ? "#" : ""))
          )
        );
        setLoading(false);
      })
      .catch(() => {
        if (alive) {
          setError("Failed to load puzzle");
          setLoading(false);
        }
      });
    return () => {
      alive = false;
    };
  }, [id]);

  const detected = useMemo(
    () => (puzzle ? detectWords(puzzle.grid, puzzle.clues) : []),
    [puzzle]
  );

  const acrossWords = detected.filter((w) => w.direction === "across");
  const downWords = detected.filter((w) => w.direction === "down");

  /**
   * Determine which word the selected cell belongs to in `dir`.
   * Returns null if the cell isn't part of any 2+ run in that direction.
   */
  const wordAtCell = useCallback(
    (r: number, c: number, dir: Direction): DetectedWord | null => {
      if (!puzzle) return null;
      // Walk back to find the start of the run in `dir`
      const dr = dir === "down" ? 1 : 0;
      const dc = dir === "across" ? 1 : 0;
      let sr = r,
        sc = c;
      while (
        sr - dr >= 0 &&
        sc - dc >= 0 &&
        !isBlack(puzzle.grid[sr - dr][sc - dc])
      ) {
        sr -= dr;
        sc -= dc;
      }
      return (
        detected.find(
          (w) => w.row === sr && w.col === sc && w.direction === dir
        ) ?? null
      );
    },
    [puzzle, detected]
  );

  const activeWord = useMemo(() => {
    if (!selected) return null;
    return wordAtCell(selected.row, selected.col, direction);
  }, [selected, direction, wordAtCell]);

  // Selection helpers
  const selectCell = useCallback(
    (r: number, c: number) => {
      if (!puzzle) return;
      if (isBlack(puzzle.grid[r][c])) return;

      // Freeform puzzles often have cells that only belong to one
      // direction (e.g., a letter with no perpendicular word). Auto-pick
      // the valid direction on click so the user doesn't have to toggle
      // through a "no active word" state.
      const hasAcross = !!wordAtCell(r, c, "across");
      const hasDown = !!wordAtCell(r, c, "down");

      if (selected && selected.row === r && selected.col === c) {
        // Clicking the same cell toggles direction — but only if both
        // exist. Otherwise toggling would land us on a non-word.
        if (hasAcross && hasDown) {
          setDirection((d) => (d === "across" ? "down" : "across"));
        }
        return;
      }

      setSelected({ row: r, col: c });
      if (hasAcross && !hasDown) setDirection("across");
      else if (hasDown && !hasAcross) setDirection("down");
      // If both exist: keep whatever direction was active.
    },
    [puzzle, selected, wordAtCell]
  );

  // Move to next/previous cell in the active direction
  const advance = useCallback(
    (delta: 1 | -1) => {
      if (!puzzle || !selected) return;
      const dr = direction === "down" ? delta : 0;
      const dc = direction === "across" ? delta : 0;
      let r = selected.row + dr;
      let c = selected.col + dc;
      while (
        r >= 0 &&
        r < puzzle.grid.length &&
        c >= 0 &&
        c < puzzle.grid[0].length &&
        isBlack(puzzle.grid[r][c])
      ) {
        r += dr;
        c += dc;
      }
      if (
        r >= 0 &&
        r < puzzle.grid.length &&
        c >= 0 &&
        c < puzzle.grid[0].length
      ) {
        setSelected({ row: r, col: c });
      }
    },
    [puzzle, selected, direction]
  );

  /**
   * Move the cursor physically in (dr, dc) without changing the active
   * word direction. Used when the user presses a perpendicular arrow but
   * the current cell has no word in that direction.
   */
  const moveInDirection = useCallback(
    (dr: number, dc: number) => {
      if (!puzzle || !selected) return;
      let r = selected.row + dr;
      let c = selected.col + dc;
      while (
        r >= 0 &&
        r < puzzle.grid.length &&
        c >= 0 &&
        c < puzzle.grid[0].length &&
        isBlack(puzzle.grid[r][c])
      ) {
        r += dr;
        c += dc;
      }
      if (
        r >= 0 &&
        r < puzzle.grid.length &&
        c >= 0 &&
        c < puzzle.grid[0].length
      ) {
        setSelected({ row: r, col: c });
      }
    },
    [puzzle, selected]
  );

  const setLetter = useCallback(
    (letter: string) => {
      if (!puzzle || !selected) return;
      setEntries((prev) => {
        const next = prev.map((row) => row.slice());
        next[selected.row][selected.col] = letter.toUpperCase();
        return next;
      });
      // Clear the cell's check state when overwritten
      const key = `${selected.row},${selected.col}`;
      setChecked((prev) => {
        if (!(key in prev)) return prev;
        const next = { ...prev };
        delete next[key];
        return next;
      });
      if (letter) advance(1);
    },
    [puzzle, selected, advance]
  );

  // Keyboard handling
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (!puzzle || !selected) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const hasAcross = !!wordAtCell(selected.row, selected.col, "across");
      const hasDown = !!wordAtCell(selected.row, selected.col, "down");
      if (e.key === "ArrowRight") {
        e.preventDefault();
        if (direction === "across") {
          advance(1);
        } else if (hasAcross) {
          // Cell participates in an across word — switch into it
          setDirection("across");
        } else {
          // No across word here; just move physically without changing
          // the active word direction
          moveInDirection(0, 1);
        }
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        if (direction === "across") {
          advance(-1);
        } else if (hasAcross) {
          setDirection("across");
        } else {
          moveInDirection(0, -1);
        }
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        if (direction === "down") {
          advance(1);
        } else if (hasDown) {
          setDirection("down");
        } else {
          moveInDirection(1, 0);
        }
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (direction === "down") {
          advance(-1);
        } else if (hasDown) {
          setDirection("down");
        } else {
          moveInDirection(-1, 0);
        }
      } else if (e.key === " ") {
        e.preventDefault();
        // Only toggle direction if the cell actually has a word in the
        // other direction. Otherwise the spacebar would land the user on
        // an empty active-word state.
        if (hasAcross && hasDown) {
          setDirection((d) => (d === "across" ? "down" : "across"));
        }
      } else if (e.key === "Backspace") {
        e.preventDefault();
        if (entries[selected.row][selected.col]) {
          setLetter("");
        } else {
          advance(-1);
          setTimeout(() => setLetter(""), 0);
        }
      } else if (/^[a-zA-Z]$/.test(e.key)) {
        e.preventDefault();
        setLetter(e.key);
      } else if (e.key === "Tab") {
        e.preventDefault();
        // Jump to next/previous word
        const cur = activeWord;
        if (!cur) return;
        const list = direction === "across" ? acrossWords : downWords;
        const idx = list.findIndex(
          (w) => w.row === cur.row && w.col === cur.col
        );
        const next = e.shiftKey
          ? list[(idx - 1 + list.length) % list.length]
          : list[(idx + 1) % list.length];
        if (next) setSelected({ row: next.row, col: next.col });
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [
    puzzle,
    selected,
    direction,
    advance,
    moveInDirection,
    setLetter,
    entries,
    activeWord,
    acrossWords,
    downWords,
    wordAtCell,
  ]);

  // Detect completion
  const isComplete = useMemo(() => {
    if (!puzzle) return false;
    for (let r = 0; r < puzzle.grid.length; r++) {
      for (let c = 0; c < puzzle.grid[0].length; c++) {
        const sol = puzzle.grid[r][c];
        if (isBlack(sol) || !isLetter(sol)) continue;
        if (entries[r]?.[c]?.toUpperCase() !== sol) return false;
      }
    }
    return true;
  }, [puzzle, entries]);

  // Check / Reveal actions
  const checkPuzzle = useCallback(() => {
    if (!puzzle) return;
    const next: Record<string, "right" | "wrong"> = {};
    for (let r = 0; r < puzzle.grid.length; r++) {
      for (let c = 0; c < puzzle.grid[0].length; c++) {
        const sol = puzzle.grid[r][c];
        if (!isLetter(sol)) continue;
        const filled = entries[r]?.[c]?.toUpperCase();
        if (!filled) continue;
        next[`${r},${c}`] = filled === sol ? "right" : "wrong";
      }
    }
    setChecked(next);
  }, [puzzle, entries]);

  const revealWord = useCallback(() => {
    if (!puzzle || !activeWord) return;
    setEntries((prev) => {
      const next = prev.map((row) => row.slice());
      const dr = activeWord.direction === "down" ? 1 : 0;
      const dc = activeWord.direction === "across" ? 1 : 0;
      for (let i = 0; i < activeWord.word.length; i++) {
        const r = activeWord.row + i * dr;
        const c = activeWord.col + i * dc;
        next[r][c] = puzzle.grid[r][c];
      }
      return next;
    });
  }, [puzzle, activeWord]);

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-white dark:bg-zinc-950 text-black dark:text-zinc-100">
        <p className="text-sm text-gray-700 dark:text-zinc-400">Loading puzzle…</p>
      </main>
    );
  }

  if (error || !puzzle) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-4 bg-white dark:bg-zinc-950 text-black dark:text-zinc-100">
        <p className="text-lg font-semibold">{error ?? "Puzzle not found"}</p>
        <a
          href="/create"
          className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
        >
          Create a new puzzle →
        </a>
      </main>
    );
  }

  const rows = puzzle.grid.length;
  const cols = puzzle.grid[0]?.length ?? 0;
  const cellSize =
    cols <= 10 ? 44 : cols <= 15 ? 38 : cols <= 22 ? 32 : cols <= 30 ? 28 : 24;

  return (
    <main className="min-h-screen bg-white dark:bg-zinc-950 text-black dark:text-zinc-100">
      <header className="bg-white dark:bg-zinc-950 border-b border-gray-200 dark:border-zinc-800 px-6 py-4">
        <div className="max-w-screen-2xl mx-auto flex items-center justify-between pr-12">
          <a href="/" className="text-xl font-bold text-black dark:text-zinc-100">
            Crossword Creator
          </a>
          <div className="flex items-center gap-5 text-sm">
            <a
              href="/about"
              className="text-gray-700 dark:text-zinc-400 hover:text-black dark:hover:text-zinc-100"
            >
              About
            </a>
            <a
              href="/create"
              className="text-gray-700 dark:text-zinc-400 hover:text-black dark:hover:text-zinc-100"
            >
              Create your own
            </a>
            {isCreator && (
              <a
                href={`/create/share/${id}`}
                className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium"
              >
                ← Back to share
              </a>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-screen-2xl mx-auto px-6 py-8 flex flex-col lg:flex-row gap-8">
        <div className="flex-1 min-w-0 flex flex-col gap-4">
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold">{puzzle.title ?? "Untitled puzzle"}</h1>
              {puzzle.author && (
                <p className="text-sm text-gray-700 dark:text-zinc-400">
                  by {puzzle.author}
                </p>
              )}
            </div>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={checkPuzzle}
                className="px-3 py-1.5 text-xs font-medium border border-gray-200 dark:border-zinc-800 rounded-lg text-black dark:text-zinc-100 hover:bg-gray-100 dark:hover:bg-zinc-900 transition-colors"
              >
                Check
              </button>
              <button
                onClick={revealWord}
                disabled={!activeWord}
                className="px-3 py-1.5 text-xs font-medium border border-gray-200 dark:border-zinc-800 rounded-lg text-black dark:text-zinc-100 hover:bg-gray-100 dark:hover:bg-zinc-900 disabled:opacity-30 transition-colors"
              >
                Reveal word
              </button>
              <button
                onClick={editPuzzle}
                className="px-3 py-1.5 text-xs font-medium border border-gray-200 dark:border-zinc-800 rounded-lg text-black dark:text-zinc-100 hover:bg-gray-100 dark:hover:bg-zinc-900 transition-colors"
                title="Load this puzzle into your editor (your changes won't affect the shared version)"
              >
                Edit this puzzle
              </button>
            </div>
          </div>

          {isComplete && (
            <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900 text-sm text-green-800 dark:text-green-200 font-medium">
              ✓ Puzzle complete. Nicely done.
            </div>
          )}

          {activeWord && (
            <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 text-sm">
              <span className="font-semibold">
                {activeWord.number} {activeWord.direction[0].toUpperCase() + activeWord.direction.slice(1)}:
              </span>{" "}
              {activeWord.clue || <em className="text-gray-600 dark:text-zinc-500">No clue provided</em>}
            </div>
          )}

          {/* Grid */}
          <div
            ref={gridRef}
            className="w-fit max-w-full overflow-auto border border-gray-200 dark:border-zinc-800 rounded-lg p-2 bg-gray-50 dark:bg-zinc-900/50"
          >
            <div
              className="inline-grid gap-0"
              style={{
                gridTemplateColumns: `repeat(${cols}, ${cellSize}px)`,
                gridTemplateRows: `repeat(${rows}, ${cellSize}px)`,
              }}
            >
              {Array.from({ length: rows }, (_, r) =>
                Array.from({ length: cols }, (_, c) => {
                  const sol = puzzle.grid[r][c];
                  const black = isBlack(sol);
                  const entry = entries[r]?.[c] ?? "";
                  const isSelected =
                    selected && selected.row === r && selected.col === c;
                  const isInActiveWord =
                    activeWord &&
                    (activeWord.direction === "across"
                      ? r === activeWord.row &&
                        c >= activeWord.col &&
                        c < activeWord.col + activeWord.word.length
                      : c === activeWord.col &&
                        r >= activeWord.row &&
                        r < activeWord.row + activeWord.word.length);
                  const number = !black ? clueNumberAt(puzzle.grid, r, c) : null;
                  const check = checked[`${r},${c}`];

                  return (
                    <button
                      key={`${r}-${c}`}
                      onClick={() => selectCell(r, c)}
                      className={`relative border border-gray-400 dark:border-zinc-600 text-center font-mono font-bold transition-colors ${
                        black
                          ? "bg-black cursor-default"
                          : isSelected
                            ? "bg-yellow-200 dark:bg-yellow-400"
                            : isInActiveWord
                              ? "bg-blue-100 dark:bg-sky-300"
                              : "bg-white dark:bg-zinc-200 hover:bg-gray-100 dark:hover:bg-zinc-100"
                      }`}
                      style={{ width: cellSize, height: cellSize }}
                      tabIndex={-1}
                      disabled={black}
                    >
                      {number !== null && (
                        <span
                          className="absolute top-0.5 left-1 font-normal text-gray-700 dark:text-zinc-700"
                          style={{ fontSize: cellSize * 0.25 }}
                        >
                          {number}
                        </span>
                      )}
                      {!black && (
                        <span
                          style={{ fontSize: cellSize * 0.5 }}
                          className={
                            check === "wrong"
                              ? "text-red-600 dark:text-red-700"
                              : check === "right"
                                ? "text-green-700 dark:text-green-800"
                                : "text-black"
                          }
                        >
                          {entry}
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Clue panel */}
        <div className="w-full lg:w-80 shrink-0 flex flex-col gap-6">
          <ClueList
            title="Across"
            words={acrossWords}
            activeWord={activeWord}
            direction={direction}
            onSelect={(w) => {
              setDirection(w.direction);
              setSelected({ row: w.row, col: w.col });
            }}
          />
          <ClueList
            title="Down"
            words={downWords}
            activeWord={activeWord}
            direction={direction}
            onSelect={(w) => {
              setDirection(w.direction);
              setSelected({ row: w.row, col: w.col });
            }}
          />
        </div>
      </div>
    </main>
  );
}

function ClueList({
  title,
  words,
  activeWord,
  direction,
  onSelect,
}: {
  title: string;
  words: DetectedWord[];
  activeWord: DetectedWord | null;
  direction: Direction;
  onSelect: (w: DetectedWord) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-700 dark:text-zinc-400">
        {title}
      </h3>
      <ol className="border border-gray-200 dark:border-zinc-800 rounded-lg divide-y divide-gray-200 dark:divide-zinc-800 max-h-[60vh] overflow-y-auto bg-white dark:bg-zinc-950">
        {words.length === 0 && (
          <li className="px-3 py-3 text-xs text-gray-600 dark:text-zinc-500">
            No {title.toLowerCase()} clues
          </li>
        )}
        {words.map((w) => {
          const isActive =
            activeWord &&
            activeWord.row === w.row &&
            activeWord.col === w.col &&
            direction === w.direction;
          return (
            <li
              key={`${w.row}-${w.col}-${w.direction}`}
              className={`px-3 py-2 text-sm cursor-pointer transition-colors ${
                isActive
                  ? "bg-blue-50 dark:bg-blue-950/40"
                  : "hover:bg-gray-50 dark:hover:bg-zinc-900/50"
              }`}
              onClick={() => onSelect(w)}
            >
              <span className="font-semibold mr-2">{w.number}.</span>
              <span className="text-gray-800 dark:text-zinc-300">
                {w.clue || (
                  <em className="text-gray-500 dark:text-zinc-500">
                    (no clue)
                  </em>
                )}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
