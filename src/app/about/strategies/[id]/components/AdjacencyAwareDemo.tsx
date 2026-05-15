"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Interactive storyboard demonstrating adjacency-aware's distinguishing
 * move: placing words side-by-side when no letter intersection exists.
 *
 * Hard-coded sequence of grid snapshots and narration rather than running
 * the real solver. Gives precise control over what's emphasized at each
 * beat. The actual algorithm matches the logic shown here (see
 * `findBestParallelSeed` and `isValidPlacement` in src/engine/freeform.ts):
 * every 2-letter cross-run between adjacent words must be an attested
 * bigram, or the entire shift is rejected. The solver tries each shift
 * position in turn and accepts the first one that passes.
 */

type CellHighlight =
  | "anchor"
  | "candidate"
  | "valid-pair"
  | "invalid-pair"
  | "placed"
  | "rejected";

interface DemoStep {
  description: string;
  detail: string;
  grid: string[][];
  highlights: Record<string, CellHighlight>;
  bigramChecks?: { pair: string; valid: boolean }[];
  resultBanner?: { kind: "reject" | "accept"; text: string };
}

const ROWS = 7;
const COLS = 7;
const CELL_SIZE = 44;

function emptyGrid(): string[][] {
  return Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => ""));
}

function placeWord(
  grid: string[][],
  word: string,
  row: number,
  col: number,
  direction: "across" | "down"
): string[][] {
  const next = grid.map((r) => r.slice());
  for (let i = 0; i < word.length; i++) {
    const r = direction === "down" ? row + i : row;
    const c = direction === "across" ? col + i : col;
    next[r][c] = word[i];
  }
  return next;
}

function wordCells(
  word: string,
  row: number,
  col: number,
  direction: "across" | "down",
  highlight: CellHighlight,
  out: Record<string, CellHighlight> = {}
): Record<string, CellHighlight> {
  for (let i = 0; i < word.length; i++) {
    const r = direction === "down" ? row + i : row;
    const c = direction === "across" ? col + i : col;
    out[`${r},${c}`] = highlight;
  }
  return out;
}

function buildSteps(): DemoStep[] {
  // Anchor: CORAL placed down at column 2, rows 0 to 4
  const anchor = "CORAL";
  const candidate = "FLAME";

  const empty = emptyGrid();
  const gridAnchored = placeWord(empty, anchor, 0, 2, "down");

  // Shift 0 attempt: FLAME at column 3, rows 0 to 4 (aligned with CORAL)
  const gridShiftZero = placeWord(gridAnchored, candidate, 0, 3, "down");

  // Shift -2 attempt: FLAME shifted up 2 relative to CORAL.
  // Visualized by sliding CORAL down 2 rows and putting FLAME at the top
  // so both fit on the grid.
  const gridShift2_anchorMoved = placeWord(empty, anchor, 2, 2, "down");
  const gridShift2_both = placeWord(gridShift2_anchorMoved, candidate, 0, 3, "down");

  const bigramsShiftZero = [
    { pair: "CF", valid: false },
    { pair: "OL", valid: true },
    { pair: "RA", valid: true },
    { pair: "AM", valid: true },
    { pair: "LE", valid: true },
  ];
  const bigramsShiftMinusTwo = [
    { pair: "CA", valid: true },
    { pair: "OM", valid: true },
    { pair: "RE", valid: true },
  ];

  return [
    {
      description: "1. Place the anchor word",
      detail:
        "Start by dropping the first word into the grid. CORAL is our anchor; every subsequent placement has to attach to it (or to a word that attaches to it).",
      grid: gridAnchored,
      highlights: wordCells(anchor, 0, 2, "down", "anchor"),
    },
    {
      description: "2. Look for letter intersections",
      detail:
        "A traditional crossword filler requires the next word to share a letter with one already on the grid. CORAL and FLAME share zero letters, so no intersection placement is possible.",
      grid: gridAnchored,
      highlights: wordCells(anchor, 0, 2, "down", "anchor"),
    },
    {
      description: "3. Try parallel placement, aligned",
      detail:
        "When intersection fails, adjacency-aware tries placing FLAME directly alongside CORAL. With both words starting at row 0, each row produces a 2-letter cross-run between the two columns.",
      grid: gridShiftZero,
      highlights: {
        ...wordCells(anchor, 0, 2, "down", "anchor"),
        ...wordCells(candidate, 0, 3, "down", "candidate"),
      },
      bigramChecks: bigramsShiftZero,
    },
    {
      description: "4. Reject the alignment",
      detail:
        "Every cross-run must be an attested bigram, or the whole placement is rejected. CF is not a real English letter pair, so this alignment is thrown out. Four of five being valid is not enough.",
      grid: gridShiftZero,
      highlights: {
        ...wordCells(anchor, 0, 2, "down", "rejected"),
        ...wordCells(candidate, 0, 3, "down", "rejected"),
        "0,2": "invalid-pair",
        "0,3": "invalid-pair",
      },
      bigramChecks: bigramsShiftZero,
      resultBanner: {
        kind: "reject",
        text: "Rejected: CF is not a valid bigram",
      },
    },
    {
      description: "5. Shift FLAME and try a new alignment",
      detail:
        "The algorithm walks through every shift offset where the two words overlap by at least 2 columns. Shifting FLAME up by 2 rows makes only the first 3 letters of CORAL line up with the last 3 letters of FLAME. The pairs now check are CA, OM, and RE.",
      grid: gridShift2_both,
      highlights: {
        ...wordCells(anchor, 2, 2, "down", "anchor"),
        ...wordCells(candidate, 0, 3, "down", "candidate"),
      },
      bigramChecks: bigramsShiftMinusTwo,
    },
    {
      description: "6. Accept and commit",
      detail:
        "All three pairs at this shift are attested bigrams, so the placement passes validation and FLAME is committed. The standalone tails of each word (the parts that don't sit beside another word) get filled by real dictionary words in the gap-fill phase.",
      grid: gridShift2_both,
      highlights: {
        ...wordCells(anchor, 2, 2, "down", "placed"),
        ...wordCells(candidate, 0, 3, "down", "placed"),
      },
      bigramChecks: bigramsShiftMinusTwo,
      resultBanner: {
        kind: "accept",
        text: "Accepted: every cross-pair is a valid bigram",
      },
    },
  ];
}

const STEPS = buildSteps();
const STEP_DURATION_MS = 5000;

export function AdjacencyAwareDemo() {
  const [stepIndex, setStepIndex] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!playing) return;
    if (stepIndex >= STEPS.length - 1) {
      setPlaying(false);
      return;
    }
    const t = setTimeout(() => {
      setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
    }, STEP_DURATION_MS);
    return () => clearTimeout(t);
  }, [playing, stepIndex]);

  const restart = useCallback(() => {
    setStepIndex(0);
    setPlaying(true);
  }, []);

  const step = STEPS[stepIndex];

  return (
    <div className="not-prose flex flex-col gap-4 p-5 bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl">
      <div className="flex items-baseline justify-between gap-4">
        <h3 className="text-lg font-bold text-black dark:text-zinc-100">
          {step.description}
        </h3>
        <span className="text-xs text-gray-600 dark:text-zinc-500 font-mono">
          {stepIndex + 1} / {STEPS.length}
        </span>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 items-start">
        <div className="flex justify-center w-full lg:w-auto">
          <div
            className="inline-grid gap-0 border-2 border-gray-300 dark:border-zinc-600"
            style={{
              gridTemplateColumns: `repeat(${COLS}, ${CELL_SIZE}px)`,
              gridTemplateRows: `repeat(${ROWS}, ${CELL_SIZE}px)`,
            }}
          >
            {step.grid.flatMap((row, r) =>
              row.map((cell, c) => {
                const highlight = step.highlights[`${r},${c}`];
                const isBlack = cell === "#";
                const isLetter = cell && !isBlack;
                let bg = "bg-white dark:bg-zinc-200";
                let textColor = "text-black";
                if (isBlack) {
                  bg = "bg-black";
                  textColor = "text-white";
                } else if (highlight === "anchor") {
                  bg = "bg-amber-100 dark:bg-amber-200";
                } else if (highlight === "candidate") {
                  bg = "bg-blue-100 dark:bg-blue-200";
                } else if (highlight === "valid-pair") {
                  bg = "bg-green-200 dark:bg-green-300";
                } else if (highlight === "invalid-pair") {
                  bg = "bg-red-300 dark:bg-red-400";
                } else if (highlight === "placed") {
                  bg = "bg-emerald-100 dark:bg-emerald-200";
                } else if (highlight === "rejected") {
                  bg = "bg-red-50 dark:bg-red-100";
                  textColor = "text-red-900";
                }
                return (
                  <div
                    key={`${r}-${c}`}
                    className={`flex items-center justify-center border border-gray-300 dark:border-zinc-500 font-mono font-bold ${bg} ${textColor} transition-colors duration-300`}
                    style={{ width: CELL_SIZE, height: CELL_SIZE, fontSize: CELL_SIZE * 0.5 }}
                  >
                    {isLetter && cell}
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="flex-1 flex flex-col gap-4 min-w-0">
          <p className="text-sm text-gray-800 dark:text-zinc-300 leading-relaxed">
            {step.detail}
          </p>

          {step.resultBanner && (
            <div
              className={`p-3 rounded-lg border text-sm font-semibold ${
                step.resultBanner.kind === "accept"
                  ? "bg-green-50 dark:bg-green-950/30 border-green-300 dark:border-green-700 text-green-800 dark:text-green-200"
                  : "bg-red-50 dark:bg-red-950/30 border-red-300 dark:border-red-700 text-red-800 dark:text-red-200"
              }`}
            >
              {step.resultBanner.text}
            </div>
          )}

          {step.bigramChecks && (
            <div className="flex flex-col gap-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-zinc-500">
                Letter pairs at this shift
              </p>
              <div className="flex flex-wrap gap-2">
                {step.bigramChecks.map((b) => (
                  <span
                    key={b.pair}
                    className={`px-2 py-1 rounded text-xs font-mono font-semibold border ${
                      b.valid
                        ? "bg-green-100 dark:bg-green-950/40 border-green-300 dark:border-green-700 text-green-800 dark:text-green-300"
                        : "bg-red-100 dark:bg-red-950/40 border-red-300 dark:border-red-700 text-red-800 dark:text-red-300"
                    }`}
                  >
                    {b.pair}
                    <span className="ml-1.5 text-[10px] opacity-75">
                      {b.valid ? "✓ valid bigram" : "✗ not a bigram"}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-gray-200 dark:border-zinc-800">
        <button
          onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
          disabled={stepIndex === 0}
          className="px-3 py-1.5 text-xs font-medium border border-gray-300 dark:border-zinc-700 rounded-lg text-black dark:text-zinc-100 hover:bg-gray-100 dark:hover:bg-zinc-800 disabled:opacity-30 transition-colors"
        >
          ← Step back
        </button>
        <button
          onClick={() => setPlaying((p) => !p)}
          disabled={stepIndex >= STEPS.length - 1 && !playing}
          className="px-4 py-1.5 text-xs font-semibold bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-400 disabled:opacity-40 transition-colors"
        >
          {playing ? "Pause" : stepIndex >= STEPS.length - 1 ? "Done" : "Play"}
        </button>
        <button
          onClick={() => setStepIndex((i) => Math.min(STEPS.length - 1, i + 1))}
          disabled={stepIndex >= STEPS.length - 1}
          className="px-3 py-1.5 text-xs font-medium border border-gray-300 dark:border-zinc-700 rounded-lg text-black dark:text-zinc-100 hover:bg-gray-100 dark:hover:bg-zinc-800 disabled:opacity-30 transition-colors"
        >
          Step forward →
        </button>
        <button
          onClick={restart}
          className="px-3 py-1.5 text-xs font-medium border border-gray-300 dark:border-zinc-700 rounded-lg text-black dark:text-zinc-100 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
        >
          Restart
        </button>
        <span className="ml-auto text-xs text-gray-600 dark:text-zinc-500">
          Words: <span className="font-mono">CORAL</span>,{" "}
          <span className="font-mono">FLAME</span>
        </span>
      </div>
    </div>
  );
}
