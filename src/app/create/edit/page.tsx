"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import type { WordEntry } from "@/engine/types";

const STORAGE_KEY_EDITOR = "crossword-editor-state";
const STORAGE_KEY_WORDS = "crossword-creator-words";
const GUTTER = 2;

type CellValue = string; // single uppercase letter, "#" for black, "" for empty

interface DetectedWord {
  word: string;
  row: number;
  col: number;
  direction: "across" | "down";
  clue: string;
  isUserWord: boolean;
  isFill: boolean;
}

interface EditorState {
  grid: CellValue[][];
  clues: Record<string, string>;
  userWords: string[];
  fillWords: string[];
}

function createEmptyGrid(rows: number, cols: number): CellValue[][] {
  return Array.from({ length: rows }, () => Array(cols).fill(""));
}

function padGrid(grid: CellValue[][]): {
  grid: CellValue[][];
  rowOffset: number;
  colOffset: number;
} {
  if (grid.length === 0) return { grid: createEmptyGrid(GUTTER * 2 + 1, GUTTER * 2 + 1), rowOffset: GUTTER, colOffset: GUTTER };

  const rows = grid.length;
  const cols = grid[0].length;

  let minR = rows, maxR = -1, minC = cols, maxC = -1;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c] !== "") {
        if (r < minR) minR = r;
        if (r > maxR) maxR = r;
        if (c < minC) minC = c;
        if (c > maxC) maxC = c;
      }
    }
  }

  if (maxR === -1) {
    return { grid: createEmptyGrid(GUTTER * 2 + 1, GUTTER * 2 + 1), rowOffset: GUTTER, colOffset: GUTTER };
  }

  const topPad = Math.max(0, GUTTER - minR);
  const botPad = Math.max(0, GUTTER - (rows - 1 - maxR));
  const leftPad = Math.max(0, GUTTER - minC);
  const rightPad = Math.max(0, GUTTER - (cols - 1 - maxC));

  if (topPad === 0 && botPad === 0 && leftPad === 0 && rightPad === 0) {
    return { grid, rowOffset: 0, colOffset: 0 };
  }

  const newRows = rows + topPad + botPad;
  const newCols = cols + leftPad + rightPad;
  const newGrid = createEmptyGrid(newRows, newCols);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      newGrid[r + topPad][c + leftPad] = grid[r][c];
    }
  }

  return { grid: newGrid, rowOffset: topPad, colOffset: leftPad };
}

function detectWords(grid: CellValue[][]): { word: string; row: number; col: number; direction: "across" | "down" }[] {
  const words: { word: string; row: number; col: number; direction: "across" | "down" }[] = [];
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;

  // Across
  for (let r = 0; r < rows; r++) {
    let runStart = -1;
    let run = "";
    for (let c = 0; c <= cols; c++) {
      const ch = c < cols ? grid[r][c] : "";
      if (ch !== "" && ch !== "#") {
        if (runStart === -1) runStart = c;
        run += ch;
      } else {
        if (run.length >= 2) {
          words.push({ word: run, row: r, col: runStart, direction: "across" });
        }
        runStart = -1;
        run = "";
      }
    }
  }

  // Down
  for (let c = 0; c < cols; c++) {
    let runStart = -1;
    let run = "";
    for (let r = 0; r <= rows; r++) {
      const ch = r < rows ? grid[r][c] : "";
      if (ch !== "" && ch !== "#") {
        if (runStart === -1) runStart = r;
        run += ch;
      } else {
        if (run.length >= 2) {
          words.push({ word: run, row: runStart, col: c, direction: "down" });
        }
        runStart = -1;
        run = "";
      }
    }
  }

  return words;
}

function wordKey(w: { word: string; row: number; col: number; direction: string }): string {
  return `${w.row},${w.col},${w.direction}`;
}

export default function EditPage() {
  const [grid, setGrid] = useState<CellValue[][]>(() => createEmptyGrid(5, 5));
  const [clues, setClues] = useState<Record<string, string>>({});
  const [userWords, setUserWords] = useState<string[]>([]);
  const [fillWords, setFillWords] = useState<string[]>([]);
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null);
  const [direction, setDirection] = useState<"across" | "down">("across");
  const [tool, setTool] = useState<"letter" | "black">("letter");
  const [hydrated, setHydrated] = useState(false);
  const [history, setHistory] = useState<CellValue[][][]>([]);
  const gridRef = useRef<HTMLDivElement>(null);

  // Load state from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_EDITOR);
      if (stored) {
        const state: EditorState = JSON.parse(stored);
        const { grid: padded } = padGrid(state.grid);
        setGrid(padded);
        setClues(state.clues);
        setUserWords(state.userWords);
        setFillWords(state.fillWords ?? []);
      }
    } catch {}
    setHydrated(true);
  }, []);

  // Save state to localStorage on changes
  useEffect(() => {
    if (!hydrated) return;
    const state: EditorState = { grid, clues, userWords, fillWords };
    try {
      localStorage.setItem(STORAGE_KEY_EDITOR, JSON.stringify(state));
    } catch {}
  }, [grid, clues, userWords, fillWords, hydrated]);

  // Ensure grid always has gutter padding around content
  const ensurePadding = useCallback((g: CellValue[][]): CellValue[][] => {
    const { grid: padded, rowOffset, colOffset } = padGrid(g);
    if (rowOffset !== 0 || colOffset !== 0) {
      if (selectedCell) {
        setSelectedCell({ row: selectedCell.row + rowOffset, col: selectedCell.col + colOffset });
      }
    }
    return padded;
  }, [selectedCell]);

  const pushHistory = useCallback(() => {
    setHistory((h) => {
      const next = [...h, grid];
      if (next.length > 50) return next.slice(next.length - 50);
      return next;
    });
  }, [grid]);

  const handleUndo = useCallback(() => {
    if (history.length === 0) return;
    setGrid(history[history.length - 1]);
    setHistory((h) => h.slice(0, -1));
  }, [history]);

  // Cell click
  const handleCellClick = useCallback((row: number, col: number) => {
    if (tool === "black") {
      pushHistory();
      const newGrid = grid.map((r) => [...r]);
      newGrid[row][col] = newGrid[row][col] === "#" ? "" : "#";
      setGrid(ensurePadding(newGrid));
      return;
    }

    if (grid[row][col] === "#") return;

    if (selectedCell?.row === row && selectedCell?.col === col) {
      setDirection((d) => (d === "across" ? "down" : "across"));
      return;
    }
    setSelectedCell({ row, col });
  }, [tool, grid, selectedCell, pushHistory, ensurePadding]);

  // Type letter
  const typeLetter = useCallback((letter: string) => {
    if (!selectedCell) return;
    const upper = letter.toUpperCase();
    if (!/^[A-Z]$/.test(upper)) return;
    if (grid[selectedCell.row][selectedCell.col] === "#") return;

    pushHistory();
    const newGrid = grid.map((r) => [...r]);
    newGrid[selectedCell.row][selectedCell.col] = upper;
    const padded = ensurePadding(newGrid);
    setGrid(padded);

    // Advance cursor
    const dr = direction === "down" ? 1 : 0;
    const dc = direction === "across" ? 1 : 0;
    const nr = selectedCell.row + dr;
    const nc = selectedCell.col + dc;
    if (nr < padded.length && nc < padded[0].length && padded[nr][nc] !== "#") {
      setSelectedCell({ row: nr, col: nc });
    }
  }, [selectedCell, grid, direction, pushHistory, ensurePadding]);

  // Backspace
  const handleBackspace = useCallback(() => {
    if (!selectedCell) return;
    if (grid[selectedCell.row][selectedCell.col] === "#") return;

    pushHistory();
    const newGrid = grid.map((r) => [...r]);
    const cur = newGrid[selectedCell.row][selectedCell.col];

    if (cur === "") {
      // Move back and clear that cell
      const dr = direction === "down" ? 1 : 0;
      const dc = direction === "across" ? 1 : 0;
      const pr = selectedCell.row - dr;
      const pc = selectedCell.col - dc;
      if (pr >= 0 && pc >= 0 && newGrid[pr][pc] !== "#") {
        newGrid[pr][pc] = "";
        setGrid(newGrid);
        setSelectedCell({ row: pr, col: pc });
      }
    } else {
      newGrid[selectedCell.row][selectedCell.col] = "";
      setGrid(newGrid);
    }
  }, [selectedCell, grid, direction, pushHistory]);

  // Move selection
  const moveSelection = useCallback((dr: number, dc: number) => {
    if (!selectedCell) return;
    const nr = selectedCell.row + dr;
    const nc = selectedCell.col + dc;
    if (nr >= 0 && nr < grid.length && nc >= 0 && nc < grid[0].length) {
      if (grid[nr][nc] !== "#") {
        setSelectedCell({ row: nr, col: nc });
      }
    }
  }, [selectedCell, grid]);

  // Keyboard handler
  useEffect(() => {
    if (!selectedCell) return;

    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable) return;

      if (e.key === "Backspace") { e.preventDefault(); handleBackspace(); return; }
      if (e.key === "Delete") {
        e.preventDefault();
        pushHistory();
        const newGrid = grid.map((r) => [...r]);
        newGrid[selectedCell.row][selectedCell.col] = "";
        setGrid(newGrid);
        return;
      }
      if (e.key === "ArrowLeft") { e.preventDefault(); moveSelection(0, -1); if (direction !== "across") setDirection("across"); return; }
      if (e.key === "ArrowRight") { e.preventDefault(); moveSelection(0, 1); if (direction !== "across") setDirection("across"); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); moveSelection(-1, 0); if (direction !== "down") setDirection("down"); return; }
      if (e.key === "ArrowDown") { e.preventDefault(); moveSelection(1, 0); if (direction !== "down") setDirection("down"); return; }
      if (e.key === " " || e.key === "Tab") {
        e.preventDefault();
        setDirection((d) => (d === "across" ? "down" : "across"));
        return;
      }
      if (e.key.length === 1 && /^[a-zA-Z]$/.test(e.key)) {
        e.preventDefault();
        if (tool === "letter") typeLetter(e.key);
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "z") {
        e.preventDefault();
        handleUndo();
        return;
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedCell, grid, direction, tool, typeLetter, handleBackspace, moveSelection, pushHistory, handleUndo]);

  // Derive words from the grid
  const detected = detectWords(grid);
  const userWordSet = new Set(userWords.map((w) => w.toUpperCase()));
  const fillWordSet = new Set(fillWords.map((w) => w.toUpperCase()));
  const detectedWithMeta: DetectedWord[] = detected.map((d) => ({
    ...d,
    clue: clues[wordKey(d)] ?? "",
    isUserWord: userWordSet.has(d.word),
    isFill: fillWordSet.has(d.word) && !userWordSet.has(d.word),
  }));

  // Unplaced user words (words from original list not currently in the grid)
  const placedUserWords = new Set(detectedWithMeta.filter((d) => d.isUserWord).map((d) => d.word));
  const unplacedUserWords = userWords.filter((w) => !placedUserWords.has(w.toUpperCase()));

  const updateClue = useCallback((key: string, clue: string) => {
    setClues((prev) => ({ ...prev, [key]: clue }));
  }, []);

  // Track which cells belong to fill words vs user words
  const fillCells = new Set<string>();
  const userCells = new Set<string>();
  for (const w of detectedWithMeta) {
    const dr = w.direction === "down" ? 1 : 0;
    const dc = w.direction === "across" ? 1 : 0;
    const target = w.isFill ? fillCells : w.isUserWord ? userCells : null;
    if (target) {
      for (let i = 0; i < w.word.length; i++) {
        target.add(`${w.row + i * dr},${w.col + i * dc}`);
      }
    }
  }

  // Highlight cells belonging to the selected word
  const selectedWordCells = new Set<string>();
  if (selectedCell) {
    const word = detectedWithMeta.find((w) => {
      const dr = w.direction === "down" ? 1 : 0;
      const dc = w.direction === "across" ? 1 : 0;
      for (let i = 0; i < w.word.length; i++) {
        if (w.row + i * dr === selectedCell.row && w.col + i * dc === selectedCell.col && w.direction === direction) return true;
      }
      return false;
    });
    if (word) {
      const dr = word.direction === "down" ? 1 : 0;
      const dc = word.direction === "across" ? 1 : 0;
      for (let i = 0; i < word.word.length; i++) {
        selectedWordCells.add(`${word.row + i * dr},${word.col + i * dc}`);
      }
    }
  }

  // Compute visible bounds (content + gutter, but don't show the entire padded grid)
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  let visMinR = rows, visMaxR = -1, visMinC = cols, visMaxC = -1;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c] !== "") {
        if (r < visMinR) visMinR = r;
        if (r > visMaxR) visMaxR = r;
        if (c < visMinC) visMinC = c;
        if (c > visMaxC) visMaxC = c;
      }
    }
  }
  const showMinR = Math.max(0, (visMaxR === -1 ? 0 : visMinR) - GUTTER);
  const showMaxR = Math.min(rows - 1, (visMaxR === -1 ? rows - 1 : visMaxR) + GUTTER);
  const showMinC = Math.max(0, (visMaxC === -1 ? 0 : visMinC) - GUTTER);
  const showMaxC = Math.min(cols - 1, (visMaxC === -1 ? cols - 1 : visMaxC) + GUTTER);

  const cellSize = (showMaxC - showMinC + 1) <= 15 ? 38 : 28;

  return (
    <main className="min-h-screen bg-white dark:bg-zinc-950 text-black dark:text-zinc-100">
      <header className="bg-white dark:bg-zinc-950 border-b border-gray-200 dark:border-zinc-800 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between pr-12">
          <a href="/" className="text-xl font-bold text-black dark:text-zinc-100">
            Crossword Creator
          </a>
          <div className="flex gap-4 text-sm">
            <a href="/create" className="text-gray-700 dark:text-zinc-400 hover:text-black dark:hover:text-zinc-100">
              &larr; Back to layouts
            </a>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col lg:flex-row gap-8">
        {/* Grid + toolbar */}
        <div className="flex-1 min-w-0 flex flex-col gap-4">
          <div>
            <h1 className="text-2xl font-bold text-black dark:text-zinc-100 mb-1">Edit Puzzle</h1>
            <p className="text-sm text-gray-700 dark:text-zinc-400">
              Click any cell to select it, then type to fill. Arrow keys navigate. Space toggles direction. Click beyond the grid to expand it.
            </p>
          </div>

          {/* Toolbar */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex rounded-lg border border-gray-200 dark:border-zinc-800 overflow-hidden">
              <button
                onClick={() => setTool("letter")}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  tool === "letter"
                    ? "bg-black dark:bg-zinc-100 text-white dark:text-zinc-900"
                    : "bg-white dark:bg-zinc-950 text-black dark:text-zinc-100 hover:bg-gray-100 dark:hover:bg-zinc-900"
                }`}
              >
                Letter
              </button>
              <button
                onClick={() => setTool("black")}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  tool === "black"
                    ? "bg-black dark:bg-zinc-100 text-white dark:text-zinc-900"
                    : "bg-white dark:bg-zinc-950 text-black dark:text-zinc-100 hover:bg-gray-100 dark:hover:bg-zinc-900"
                }`}
              >
                Black Square
              </button>
            </div>

            <button
              onClick={handleUndo}
              disabled={history.length === 0}
              className="px-3 py-1.5 text-xs font-medium border border-gray-200 dark:border-zinc-800 rounded-lg text-black dark:text-zinc-100 hover:bg-gray-100 dark:hover:bg-zinc-900 disabled:opacity-30 transition-colors"
            >
              Undo
            </button>

            <span className="text-xs text-gray-600 dark:text-zinc-500 ml-auto">
              {direction === "across" ? "Across" : "Down"} {selectedCell ? `(${selectedCell.row + 1}, ${selectedCell.col + 1})` : ""}
            </span>
          </div>

          {/* Grid */}
          <div
            ref={gridRef}
            className="overflow-auto border border-gray-200 dark:border-zinc-800 rounded-lg p-2 bg-gray-50 dark:bg-zinc-900/50"
            onClick={(e) => {
              // Deselect if clicking the background
              if (e.target === e.currentTarget || e.target === gridRef.current) {
                setSelectedCell(null);
              }
            }}
          >
            <div
              className="inline-grid gap-0"
              style={{
                gridTemplateColumns: `repeat(${showMaxC - showMinC + 1}, ${cellSize}px)`,
                gridTemplateRows: `repeat(${showMaxR - showMinR + 1}, ${cellSize}px)`,
              }}
            >
              {Array.from({ length: showMaxR - showMinR + 1 }, (_, ri) => {
                const r = showMinR + ri;
                return Array.from({ length: showMaxC - showMinC + 1 }, (_, ci) => {
                  const c = showMinC + ci;
                  const val = grid[r]?.[c] ?? "";
                  const isBlack = val === "#";
                  const isLetter = val !== "" && val !== "#";
                  const isSelected = selectedCell?.row === r && selectedCell?.col === c;
                  const isInWord = selectedWordCells.has(`${r},${c}`);
                  const isEmpty = val === "";
                  const cellKey = `${r},${c}`;
                  const isFillCell = fillCells.has(cellKey) && !userCells.has(cellKey);
                  const hasContentNeighbor =
                    (r > 0 && grid[r - 1]?.[c] !== "" && grid[r - 1]?.[c] !== undefined) ||
                    (r < rows - 1 && grid[r + 1]?.[c] !== "" && grid[r + 1]?.[c] !== undefined) ||
                    (c > 0 && grid[r]?.[c - 1] !== "" && grid[r]?.[c - 1] !== undefined) ||
                    (c < cols - 1 && grid[r]?.[c + 1] !== "" && grid[r]?.[c + 1] !== undefined);
                  const isGutter = isEmpty && !hasContentNeighbor;

                  let bgClass: string;
                  if (isBlack) {
                    bgClass = "bg-black dark:bg-zinc-800 border-gray-800 dark:border-zinc-700";
                  } else if (isSelected) {
                    bgClass = "bg-blue-100 dark:bg-blue-800/60 border-blue-500 dark:border-blue-400 z-10";
                  } else if (isInWord) {
                    bgClass = "bg-blue-50 dark:bg-blue-950/40 border-blue-300 dark:border-blue-800";
                  } else if (isLetter) {
                    bgClass = "bg-amber-50 dark:bg-zinc-800 border-gray-300 dark:border-zinc-600";
                  } else if (isGutter) {
                    bgClass = "bg-gray-50 dark:bg-zinc-950 border-gray-100 dark:border-zinc-900 opacity-40";
                  } else {
                    bgClass = "bg-white dark:bg-zinc-950 border-gray-200 dark:border-zinc-800";
                  }

                  const textClass = isFillCell
                    ? "text-gray-400 dark:text-zinc-500"
                    : "text-black dark:text-zinc-100";

                  return (
                    <button
                      key={cellKey}
                      onClick={() => handleCellClick(r, c)}
                      className={`
                        flex items-center justify-center font-mono font-bold text-sm
                        border transition-colors outline-none
                        ${bgClass}
                        ${!isBlack ? "hover:border-blue-400 dark:hover:border-blue-500 cursor-text" : "cursor-pointer"}
                      `}
                      style={{ width: cellSize, height: cellSize }}
                      tabIndex={-1}
                    >
                      {isLetter && (
                        <span className={textClass}>{val}</span>
                      )}
                    </button>
                  );
                });
              })}
            </div>
          </div>

          <div className="text-xs text-gray-600 dark:text-zinc-500">
            {detected.length} words detected &middot; {grid.length}&times;{grid[0]?.length ?? 0} grid
          </div>
        </div>

        {/* Right panel: word list + clues */}
        <div className="w-full lg:w-72 shrink-0 flex flex-col gap-4">
          {/* Puzzle words */}
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold text-black dark:text-zinc-100">
              Puzzle Words ({detectedWithMeta.length})
            </h3>
            <div className="border border-gray-200 dark:border-zinc-800 rounded-lg divide-y divide-gray-200 dark:divide-zinc-800 max-h-[50vh] overflow-y-auto bg-white dark:bg-zinc-950">
              {detectedWithMeta.length === 0 && (
                <p className="px-3 py-4 text-xs text-gray-600 dark:text-zinc-500 text-center">
                  Type letters into the grid to create words
                </p>
              )}
              {detectedWithMeta.map((w) => (
                <WordClueRow
                  key={wordKey(w)}
                  detected={w}
                  onClueChange={(clue) => updateClue(wordKey(w), clue)}
                  onSelect={() => {
                    const dr = w.direction === "down" ? 1 : 0;
                    const dc = w.direction === "across" ? 1 : 0;
                    setSelectedCell({ row: w.row, col: w.col });
                    setDirection(w.direction);
                  }}
                  isActive={
                    selectedCell !== null &&
                    detectedWithMeta.some(
                      (d) =>
                        wordKey(d) === wordKey(w) &&
                        d.direction === direction &&
                        (() => {
                          const dr = d.direction === "down" ? 1 : 0;
                          const dc = d.direction === "across" ? 1 : 0;
                          for (let i = 0; i < d.word.length; i++) {
                            if (d.row + i * dr === selectedCell.row && d.col + i * dc === selectedCell.col) return true;
                          }
                          return false;
                        })()
                    )
                  }
                />
              ))}
            </div>
          </div>

          {/* Unplaced user words */}
          {unplacedUserWords.length > 0 && (
            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold text-black dark:text-zinc-100">
                Not in Puzzle ({unplacedUserWords.length})
              </h3>
              <div className="border border-gray-200 dark:border-zinc-800 rounded-lg divide-y divide-gray-200 dark:divide-zinc-800 max-h-[25vh] overflow-y-auto bg-white dark:bg-zinc-950">
                {unplacedUserWords.map((w) => (
                  <div key={w} className="px-3 py-1.5 flex items-center gap-2">
                    <span className="font-mono font-semibold text-xs text-gray-700 dark:text-zinc-400">
                      {w}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function WordClueRow({
  detected,
  onClueChange,
  onSelect,
  isActive,
}: {
  detected: DetectedWord;
  onClueChange: (clue: string) => void;
  onSelect: () => void;
  isActive: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(detected.clue);

  const save = () => {
    onClueChange(draft.trim());
    setEditing(false);
  };

  return (
    <div
      className={`px-3 py-1.5 flex flex-col gap-0.5 cursor-pointer transition-colors ${
        isActive ? "bg-blue-50 dark:bg-blue-950/30" : "hover:bg-gray-50 dark:hover:bg-zinc-900"
      }`}
      onClick={onSelect}
    >
      <div className="flex items-center gap-2">
        <span className={`font-mono font-semibold text-xs ${
          detected.isFill
            ? "text-gray-600 dark:text-zinc-500"
            : "text-black dark:text-zinc-100"
        }`}>
          {detected.word}
        </span>
        <span className="text-[10px] text-gray-600 dark:text-zinc-500 uppercase">
          {detected.direction === "across" ? "across" : "down"}
        </span>
        {detected.isUserWord && (
          <span className="text-[9px] px-1 py-0.5 bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 rounded">
            yours
          </span>
        )}
        {detected.isFill && (
          <span className="text-[9px] px-1 py-0.5 bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400 rounded">
            fill
          </span>
        )}
      </div>
      {editing ? (
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") { setDraft(detected.clue); setEditing(false); }
            e.stopPropagation();
          }}
          onBlur={save}
          autoFocus
          onClick={(e) => e.stopPropagation()}
          className="text-xs px-1.5 py-0.5 border border-blue-400 rounded bg-white dark:bg-zinc-950 text-black dark:text-zinc-100 focus:outline-none w-full"
          placeholder="Enter clue..."
        />
      ) : (
        <button
          onClick={(e) => { e.stopPropagation(); setDraft(detected.clue); setEditing(true); }}
          className="text-xs text-gray-600 dark:text-zinc-400 hover:text-black dark:hover:text-zinc-100 text-left truncate"
        >
          {detected.clue || "Add clue..."}
        </button>
      )}
    </div>
  );
}
