"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { WordEntry } from "@/engine/types";
import type { SlotDescriptor } from "@/engine/types";
import { CELL_BLACK, CELL_EMPTY, letterToCell, cellToLetter } from "@/engine/types";
import type { GridModel } from "@/engine/types";
import {
  createGrid,
  toggleCell,
  extractSlots,
  cellIndex,
  isBlack,
} from "@/engine/grid";
import { buildWordIndex, WordIndex } from "@/engine/wordindex";
import { solve, solveBestEffort } from "@/engine/solver";
import {
  loadDictionary,
  dictionaryToWordEntries,
  mergeWithDictionary,
} from "@/engine/dictionary";
import { InteractiveGrid } from "./components/InteractiveGrid";
import { SlotPanel } from "./components/SlotPanel";
import { WordListSidebar } from "../components/WordListSidebar";
import { EditorReturnLink } from "@/components/EditorReturnLink";

const STORAGE_KEY_WORDS = "crossword-creator-words";
const STORAGE_KEY_EDITOR = "crossword-editor-state";

const GRID_SIZES = [
  { label: "5\u00d75", rows: 5, cols: 5 },
  { label: "7\u00d77", rows: 7, cols: 7 },
  { label: "15\u00d715", rows: 15, cols: 15 },
];

type Tool = "select" | "black";

export default function GuidedBuilderPage() {
  const [gridSize, setGridSize] = useState({ rows: 5, cols: 5 });
  const [grid, setGrid] = useState<GridModel>(() => createGrid(5, 5));
  const [userWords, setUserWords] = useState<WordEntry[]>([]);
  const [dictLoaded, setDictLoaded] = useState(false);
  const [dictEntries, setDictEntries] = useState<WordEntry[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<SlotDescriptor | null>(null);
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null);
  const [tool, setTool] = useState<Tool>("select");
  const [symmetric, setSymmetric] = useState(false);
  const [direction, setDirection] = useState<"across" | "down">("across");
  const [history, setHistory] = useState<GridModel[]>([]);
  const [autoFilling, setAutoFilling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const router = useRouter();

  // Load user words from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_WORDS);
      if (stored) setUserWords(JSON.parse(stored));
    } catch {}
    setHydrated(true);
  }, []);

  // Persist user words back to localStorage so edits sync to /create
  useEffect(() => {
    if (hydrated) {
      try {
        localStorage.setItem(STORAGE_KEY_WORDS, JSON.stringify(userWords));
      } catch {}
    }
  }, [userWords, hydrated]);

  // Load dictionary
  useEffect(() => {
    loadDictionary().then((dict) => {
      setDictEntries(dictionaryToWordEntries(dict));
      setDictLoaded(true);
    });
  }, []);

  // Extract slots whenever grid changes
  const slots = extractSlots(grid);
  const slotMap = new Map(slots.map((s) => [s.id, s]));

  // Build word index from user words + dictionary
  const { entries: mergedEntries, userWordSet } = mergeWithDictionary(
    userWords,
    dictEntries
  );
  const wordIndex = dictLoaded ? buildWordIndex(mergedEntries) : null;

  // Find the slot at a given cell and direction
  const findSlotAtCell = useCallback(
    (row: number, col: number, dir: "across" | "down"): SlotDescriptor | null => {
      const ci = cellIndex(grid, row, col);
      return slots.find(
        (s) => s.direction === dir && s.cellIndices.includes(ci)
      ) ?? null;
    },
    [grid, slots]
  );

  // Handle cell click
  const handleCellClick = useCallback(
    (row: number, col: number) => {
      if (tool === "black") {
        setHistory((h) => [...h, grid]);
        if (symmetric) {
          setGrid(toggleCell(grid, row, col));
        } else {
          // Toggle single cell without symmetry
          const newCells = new Uint8Array(grid.cells);
          const idx = cellIndex(grid, row, col);
          newCells[idx] = newCells[idx] === CELL_BLACK ? CELL_EMPTY : CELL_BLACK;
          setGrid({ ...grid, cells: newCells });
        }
        setSelectedSlot(null);
        setSelectedCell(null);
        return;
      }

      // Select tool
      if (isBlack(grid, row, col)) return;

      // If clicking the same cell, toggle direction
      if (selectedCell?.row === row && selectedCell?.col === col) {
        const newDir = direction === "across" ? "down" : "across";
        setDirection(newDir);
        const slot = findSlotAtCell(row, col, newDir);
        setSelectedSlot(slot);
        return;
      }

      setSelectedCell({ row, col });
      const slot = findSlotAtCell(row, col, direction);
      setSelectedSlot(slot);
    },
    [tool, grid, selectedCell, direction, findSlotAtCell]
  );

  // Handle placing a word in the selected slot
  const handlePlaceWord = useCallback(
    (word: string) => {
      if (!selectedSlot) return;
      if (word.length !== selectedSlot.length) return;

      setHistory((h) => [...h, grid]);
      const newCells = new Uint8Array(grid.cells);
      for (let i = 0; i < selectedSlot.cellIndices.length; i++) {
        newCells[selectedSlot.cellIndices[i]] = letterToCell(word[i]);
      }
      setGrid({ ...grid, cells: newCells });
    },
    [selectedSlot, grid]
  );

  // Handle clearing a slot
  const handleClearSlot = useCallback(() => {
    if (!selectedSlot) return;
    setHistory((h) => [...h, grid]);
    const newCells = new Uint8Array(grid.cells);
    for (const ci of selectedSlot.cellIndices) {
      newCells[ci] = CELL_EMPTY;
    }
    setGrid({ ...grid, cells: newCells });
  }, [selectedSlot, grid]);

  // Move the selected cell by one step in the current direction.
  // Skips black cells; stops at the grid boundary.
  const moveSelection = useCallback(
    (step: 1 | -1, dir: "across" | "down" = direction) => {
      if (!selectedCell) return;
      let { row, col } = selectedCell;
      // Try up to grid.rows + grid.cols steps to skip over black cells
      const maxSteps = grid.rows + grid.cols;
      for (let i = 0; i < maxSteps; i++) {
        if (dir === "across") col += step;
        else row += step;
        if (row < 0 || row >= grid.rows || col < 0 || col >= grid.cols) return;
        if (!isBlack(grid, row, col)) {
          setSelectedCell({ row, col });
          const slot = findSlotAtCell(row, col, dir);
          setSelectedSlot(slot);
          return;
        }
      }
    },
    [selectedCell, direction, grid, findSlotAtCell]
  );

  // Type a letter into the selected cell and advance
  const handleTypeLetter = useCallback(
    (letter: string) => {
      if (!selectedCell) return;
      const upper = letter.toUpperCase();
      if (!/^[A-Z]$/.test(upper)) return;
      if (isBlack(grid, selectedCell.row, selectedCell.col)) return;

      setHistory((h) => [...h, grid]);
      const newCells = new Uint8Array(grid.cells);
      newCells[cellIndex(grid, selectedCell.row, selectedCell.col)] =
        letterToCell(upper);
      setGrid({ ...grid, cells: newCells });
      // Advance forward
      moveSelection(1);
    },
    [selectedCell, grid, moveSelection]
  );

  // Backspace: clear the current cell, then move back. If cell is already
  // empty, just move back and clear that one.
  const handleBackspace = useCallback(() => {
    if (!selectedCell) return;
    if (isBlack(grid, selectedCell.row, selectedCell.col)) return;

    const idx = cellIndex(grid, selectedCell.row, selectedCell.col);
    const isEmpty = grid.cells[idx] === CELL_EMPTY;

    setHistory((h) => [...h, grid]);
    if (isEmpty) {
      // Move back, then clear that cell
      moveSelection(-1);
      // We can't read the new selected cell synchronously, so handle clear via a deferred handler
      // Instead: do the move+clear here directly
      // Find the previous cell ourselves:
      let { row, col } = selectedCell;
      const maxSteps = grid.rows + grid.cols;
      for (let i = 0; i < maxSteps; i++) {
        if (direction === "across") col -= 1;
        else row -= 1;
        if (row < 0 || row >= grid.rows || col < 0 || col >= grid.cols) return;
        if (!isBlack(grid, row, col)) {
          const prevIdx = cellIndex(grid, row, col);
          const newCells = new Uint8Array(grid.cells);
          newCells[prevIdx] = CELL_EMPTY;
          setGrid({ ...grid, cells: newCells });
          return;
        }
      }
    } else {
      // Clear current cell and stay
      const newCells = new Uint8Array(grid.cells);
      newCells[idx] = CELL_EMPTY;
      setGrid({ ...grid, cells: newCells });
    }
  }, [selectedCell, grid, direction, moveSelection]);

  // Global keyboard handler when a cell is selected
  useEffect(() => {
    if (tool !== "select" || !selectedCell) return;

    const onKey = (e: KeyboardEvent) => {
      // Don't intercept typing into form fields elsewhere on the page
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.key === "Backspace") {
        e.preventDefault();
        handleBackspace();
        return;
      }
      if (e.key === "Delete") {
        e.preventDefault();
        if (!selectedCell) return;
        const idx = cellIndex(grid, selectedCell.row, selectedCell.col);
        setHistory((h) => [...h, grid]);
        const newCells = new Uint8Array(grid.cells);
        newCells[idx] = CELL_EMPTY;
        setGrid({ ...grid, cells: newCells });
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        moveSelection(-1, "across");
        if (direction !== "across") setDirection("across");
        return;
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        moveSelection(1, "across");
        if (direction !== "across") setDirection("across");
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        moveSelection(-1, "down");
        if (direction !== "down") setDirection("down");
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        moveSelection(1, "down");
        if (direction !== "down") setDirection("down");
        return;
      }
      if (e.key === " " || e.key === "Tab") {
        // Spacebar/Tab toggles direction
        e.preventDefault();
        const newDir = direction === "across" ? "down" : "across";
        setDirection(newDir);
        const slot = findSlotAtCell(selectedCell.row, selectedCell.col, newDir);
        setSelectedSlot(slot);
        return;
      }
      // Letter input
      if (e.key.length === 1 && /^[a-zA-Z]$/.test(e.key)) {
        e.preventDefault();
        handleTypeLetter(e.key);
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    tool,
    selectedCell,
    direction,
    grid,
    handleTypeLetter,
    handleBackspace,
    moveSelection,
    findSlotAtCell,
  ]);

  // Undo
  const handleUndo = useCallback(() => {
    if (history.length === 0) return;
    setGrid(history[history.length - 1]);
    setHistory((h) => h.slice(0, -1));
    setSelectedSlot(null);
    setSelectedCell(null);
  }, [history]);

  // Change grid size
  const handleSizeChange = useCallback((rows: number, cols: number) => {
    setGridSize({ rows, cols });
    setGrid(createGrid(rows, cols));
    setSelectedSlot(null);
    setSelectedCell(null);
    setHistory([]);
  }, []);

  // Auto-fill remaining empty slots.
  //   "auto"  : strict CSP (full dictionary). Falls back to dictionary
  //             best-effort if no perfect solution exists.
  //   "user"  : best-effort using ONLY the user's word list (no dictionary
  //             fill). Slots that can't be filled with a user word are left
  //             empty.
  const handleAutoFill = useCallback(
    (mode: "auto" | "user") => {
      if (!wordIndex) return;
      setAutoFilling(true);
      setError(null);

      setTimeout(() => {
        try {
          // Collect words already placed in the grid so we don't reuse them
          const usedWords = new Set<string>();
          for (const slot of slots) {
            const word = getSlotWord(grid, slot);
            if (word) usedWords.add(word);
          }

          if (mode === "user") {
            // User words only, best-effort
            const userEntries = userWords.filter(
              (e) => e.enabled !== false && !usedWords.has(e.word.toUpperCase())
            );
            if (userEntries.length === 0) {
              setError("Your word list is empty (or all words are already placed/disabled).");
              setAutoFilling(false);
              return;
            }
            const userIndex = buildWordIndex(userEntries);
            // All user words are "preferred" in this mode (no dictionary fallback)
            const preferred = new Set<number>();
            for (let i = 0; i < userIndex.words.length; i++) preferred.add(i);
            const result = solveBestEffort(grid, userIndex, {
              maxSolutions: 1,
              seed: Date.now(),
              preferredWordIndices: preferred,
            });
            setHistory((h) => [...h, grid]);
            setGrid(result.grid);
            setAutoFilling(false);
            return;
          }

          // mode === "auto": try strict full-dictionary fill first
          const availableEntries = mergedEntries.filter(
            (e) => !usedWords.has(e.word.toUpperCase())
          );
          const availableIndex = buildWordIndex(availableEntries);

          // Build preferred word indices so user's words are tried first
          const preferredWordIndices = new Set<number>();
          for (let i = 0; i < availableIndex.words.length; i++) {
            if (userWordSet.has(availableIndex.words[i])) {
              preferredWordIndices.add(i);
            }
          }

          // Strict mode: try multiple seeds before giving up.
          const seedAttempts = gridSize.rows <= 7 ? 30 : 12;
          const baseSeed = Date.now();
          let solved = false;
          for (let i = 0; i < seedAttempts; i++) {
            const results = solve(grid, availableIndex, {
              maxSolutions: 1,
              seed: baseSeed + i * 1009,
              preferredWordIndices,
            });
            if (results.length > 0) {
              setHistory((h) => [...h, grid]);
              setGrid(results[0].grid);
              solved = true;
              break;
            }
          }

          if (!solved) {
            // Strict failed, so fall back to dictionary best-effort.
            // This always produces some grid (filling what it can) rather
            // than leaving the user stuck.
            const result = solveBestEffort(grid, availableIndex, {
              maxSolutions: 1,
              seed: Date.now(),
              preferredWordIndices,
            });
            setHistory((h) => [...h, grid]);
            setGrid(result.grid);
            setError(
              "Couldn't find a perfect fill, so a best-effort fill was used instead. Some slots may be empty."
            );
          }
        } catch (e) {
          setError("Auto-fill failed. Try a different grid layout.");
        }
        setAutoFilling(false);
      }, 50);
    },
    [wordIndex, grid, slots, mergedEntries, userWords, userWordSet, gridSize.rows]
  );

  // Get letters currently in a slot
  const getSlotLetters = useCallback(
    (slot: SlotDescriptor): (string | null)[] => {
      return slot.cellIndices.map((ci) => {
        const v = grid.cells[ci];
        if (v === CELL_EMPTY || v === CELL_BLACK) return null;
        return cellToLetter(v);
      });
    },
    [grid]
  );

  // Get candidates for the selected slot
  const candidates = (() => {
    if (!selectedSlot || !wordIndex) return [];
    const constraints: [number, string][] = [];
    for (let i = 0; i < selectedSlot.cellIndices.length; i++) {
      const v = grid.cells[selectedSlot.cellIndices[i]];
      if (v !== CELL_EMPTY && v !== CELL_BLACK) {
        constraints.push([i, cellToLetter(v)]);
      }
    }

    // Collect already-used words
    const usedWords = new Set<number>();
    for (const slot of slots) {
      if (slot.id === selectedSlot.id) continue;
      const word = getSlotWord(grid, slot);
      if (word) {
        const idx = wordIndex.words.indexOf(word);
        if (idx >= 0) usedWords.add(idx);
      }
    }

    return wordIndex
      .getCandidates(selectedSlot.length, constraints, usedWords)
      .slice(0, 200);
  })();

  // Count filled vs total slots
  const filledCount = slots.filter((s) => getSlotWord(grid, s) !== null).length;
  const emptySlotCount = slots.length - filledCount;

  /**
   * Convert the guided builder's state (GridModel + slot words) into the
   * editor's localStorage format, then navigate to /create/edit. From the
   * editor the user gets the same Share → Solve flow the freeform path
   * has.
   */
  const handleContinueToEditor = useCallback(() => {
    // Convert GridModel cells to the editor's string[][] convention:
    //   BLACK → "#", EMPTY → "", letter byte → letter
    const editorGrid: string[][] = [];
    for (let r = 0; r < grid.rows; r++) {
      const row: string[] = [];
      for (let c = 0; c < grid.cols; c++) {
        const v = grid.cells[cellIndex(grid, r, c)];
        if (v === CELL_BLACK) row.push("#");
        else if (v === CELL_EMPTY) row.push("");
        else row.push(cellToLetter(v));
      }
      editorGrid.push(row);
    }

    // Build clue map: every word currently in the grid gets a slot.
    // For words matching the user's list, carry the clue through.
    const clueByWord = new Map<string, string>();
    for (const e of userWords) {
      if (e.enabled === false) continue;
      clueByWord.set(e.word.toUpperCase(), e.clue || "");
    }
    const clues: Record<string, string> = {};
    for (const slot of slots) {
      const word = getSlotWord(grid, slot);
      if (!word) continue;
      const key = `${slot.startRow},${slot.startCol},${slot.direction}`;
      clues[key] = clueByWord.get(word) ?? "";
    }

    const userWordList = userWords
      .filter((w) => w.enabled !== false)
      .map((w) => w.word.toUpperCase());
    const placedWordSet = new Set<string>();
    for (const slot of slots) {
      const word = getSlotWord(grid, slot);
      if (word) placedWordSet.add(word);
    }
    // Fill words = placed words that aren't in the user list
    const userWordSetForFill = new Set(userWordList);
    const fillWordList = Array.from(placedWordSet).filter(
      (w) => !userWordSetForFill.has(w)
    );

    const editorState = {
      grid: editorGrid,
      clues,
      userWords: userWordList,
      fillWords: fillWordList,
      title: "",
    };
    localStorage.setItem(STORAGE_KEY_EDITOR, JSON.stringify(editorState));
    router.push("/create/edit");
  }, [grid, slots, userWords, router]);

  return (
    <main className="min-h-screen bg-white dark:bg-zinc-950 text-black dark:text-zinc-100">
      <header className="bg-white dark:bg-zinc-950 border-b border-gray-200 dark:border-zinc-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between pr-12">
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
            <EditorReturnLink />
            <a
              href="/create"
              className="text-gray-700 dark:text-zinc-400 hover:text-black dark:hover:text-zinc-100"
            >
              &larr; Back to freeform
            </a>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-xl text-red-700 dark:text-red-300 text-sm">
            {error}
          </div>
        )}

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Left: Grid and controls */}
          <div className="flex flex-col gap-4">
            {/* Toolbar */}
            <div className="flex items-center gap-3 flex-wrap">
              {/* Grid size */}
              <div className="flex gap-1.5">
                {GRID_SIZES.map((s) => (
                  <button
                    key={s.label}
                    onClick={() => handleSizeChange(s.rows, s.cols)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      gridSize.rows === s.rows
                        ? "bg-black dark:bg-zinc-100 text-white dark:text-zinc-900"
                        : "bg-gray-100 dark:bg-zinc-900 text-black dark:text-zinc-100 hover:bg-gray-200 dark:hover:bg-zinc-800"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              <div className="w-px h-6 bg-gray-200 dark:bg-zinc-800" />

              {/* Tools */}
              <div className="flex gap-1.5">
                <button
                  onClick={() => setTool("select")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    tool === "select"
                      ? "bg-blue-600 dark:bg-blue-500 text-white"
                      : "bg-gray-100 dark:bg-zinc-900 text-black dark:text-zinc-100 hover:bg-gray-200 dark:hover:bg-zinc-800"
                  }`}
                >
                  Select
                </button>
                <button
                  onClick={() => setTool("black")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    tool === "black"
                      ? "bg-blue-600 dark:bg-blue-500 text-white"
                      : "bg-gray-100 dark:bg-zinc-900 text-black dark:text-zinc-100 hover:bg-gray-200 dark:hover:bg-zinc-800"
                  }`}
                >
                  Toggle Black
                </button>
              </div>

              {/* Symmetry toggle, only shown when the black tool is active */}
              {tool === "black" && (
                <>
                  <div className="w-px h-6 bg-gray-200 dark:bg-zinc-800" />
                  <label className="flex items-center gap-1.5 text-xs text-gray-800 dark:text-zinc-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={symmetric}
                      onChange={(e) => setSymmetric(e.target.checked)}
                      className="w-3.5 h-3.5 accent-blue-600"
                    />
                    Symmetric
                  </label>
                </>
              )}

              <div className="w-px h-6 bg-gray-200 dark:bg-zinc-800" />

              {/* Actions */}
              <button
                onClick={handleUndo}
                disabled={history.length === 0}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 dark:bg-zinc-900 text-black dark:text-zinc-100 hover:bg-gray-200 dark:hover:bg-zinc-800 disabled:opacity-30"
              >
                Undo
              </button>
              <button
                onClick={() => handleAutoFill("auto")}
                disabled={autoFilling || !dictLoaded || emptySlotCount === 0}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-black dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-gray-800 dark:hover:bg-zinc-300 disabled:opacity-30"
                title="Fill empty slots with your words + dictionary fill. Falls back to best-effort if no perfect fill exists."
              >
                {autoFilling ? "Filling..." : `Auto-fill (${emptySlotCount})`}
              </button>
              <button
                onClick={() => handleAutoFill("user")}
                disabled={autoFilling || emptySlotCount === 0 || userWords.length === 0}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600 dark:bg-blue-500 text-white hover:bg-blue-700 dark:hover:bg-blue-400 disabled:opacity-30"
                title="Place as many of your own words as possible. Slots that don't fit any user word are left empty."
              >
                Fill with my words
              </button>
            </div>

            {/* Status bar */}
            <div className="flex gap-3 text-xs text-gray-700 dark:text-zinc-400">
              <span>{slots.length} slots</span>
              <span>{filledCount} filled</span>
              <span>{emptySlotCount} empty</span>
              {!dictLoaded && <span className="text-amber-600 dark:text-amber-400">Loading dictionary...</span>}
            </div>

            {/* Grid */}
            <InteractiveGrid
              grid={grid}
              selectedCell={selectedCell}
              selectedSlot={selectedSlot}
              direction={direction}
              cellSize={gridSize.rows <= 7 ? 48 : 32}
              onCellClick={handleCellClick}
            />

            {/* Primary action: send the puzzle to the editor */}
            <div className="flex flex-col gap-1">
              <button
                onClick={handleContinueToEditor}
                disabled={filledCount === 0}
                className="self-start px-5 py-2 rounded-lg text-sm font-semibold bg-blue-600 dark:bg-blue-500 text-white hover:bg-blue-700 dark:hover:bg-blue-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                title="Send this puzzle to the editor to add clues, then share it"
              >
                Continue to Editor &rarr;
              </button>
              {filledCount === 0 && (
                <span className="text-xs text-gray-600 dark:text-zinc-500">
                  Place at least one word to continue.
                </span>
              )}
            </div>
          </div>

          {/* Middle: Slot panel */}
          <div className="flex-1 min-w-0">
            <SlotPanel
              slot={selectedSlot}
              candidates={candidates}
              wordIndex={wordIndex}
              userWordSet={userWordSet}
              slotLetters={selectedSlot ? getSlotLetters(selectedSlot) : []}
              onPlaceWord={handlePlaceWord}
              onClearSlot={handleClearSlot}
              currentWord={selectedSlot ? getSlotWord(grid, selectedSlot) : null}
            />

            {/* Typing hint */}
            {tool === "select" && selectedCell && (
              <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 rounded-lg text-xs text-gray-800 dark:text-zinc-300">
                <strong className="text-black dark:text-zinc-100">Tip:</strong>{" "}
                Type letters to fill the selected cell. Backspace to clear, arrow keys to move,
                Space/Tab to toggle across/down.
              </div>
            )}
          </div>

          {/* Right: Word list sidebar */}
          <div className="w-full lg:w-72 shrink-0">
            <div className="lg:sticky lg:top-6">
              <WordListSidebar
                words={userWords}
                onWordsChange={setUserWords}
                onRemoveWord={(word) =>
                  setUserWords(userWords.filter((w) => w.word !== word))
                }
                onUpdateClue={(word, clue) =>
                  setUserWords(
                    userWords.map((w) =>
                      w.word === word ? { ...w, clue } : w
                    )
                  )
                }
              />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

/** Get the complete word in a slot, or null if any cell is empty */
function getSlotWord(grid: GridModel, slot: SlotDescriptor): string | null {
  let word = "";
  for (const ci of slot.cellIndices) {
    const v = grid.cells[ci];
    if (v === CELL_EMPTY || v === CELL_BLACK) return null;
    word += cellToLetter(v);
  }
  return word;
}
