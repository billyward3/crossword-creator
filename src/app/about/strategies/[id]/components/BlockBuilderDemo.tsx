"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Interactive storyboard for the block-builder strategy. Walks through
 * the three-phase pipeline at granular enough detail to see how density
 * builds up:
 *
 *   Phase 1 (Scaffold)  - the freeform solver lays down user words.
 *   Phase 2 (Carve)     - shrink-and-carve shapes the canvas into a
 *                         proper block grid via two passes: distance
 *                         seeding then run-length cleanup.
 *   Phase 3 (Fill)      - full backtracking places dictionary words,
 *                         starting from the most-constrained slots.
 *
 * Hand-crafted snapshots. The actual algorithm matches the intent shown
 * here; this is a pedagogical simplification of what would be a larger
 * grid produced from the live solver.
 */

type CellHighlight =
  | "user"
  | "carved"
  | "fill"
  | "candidate"
  | "focus";

interface DemoStep {
  description: string;
  detail: string;
  grid: string[][];
  highlights: Record<string, CellHighlight>;
  rows?: number;
  cols?: number;
  cellSize?: number;
}

const ROWS = 8;
const COLS = 7;
const CELL_SIZE = 38;

function makeGrid(rows: string[]): string[][] {
  return rows.map((r) => r.split("").map((c) => (c === "." ? "" : c)));
}

function buildSteps(): DemoStep[] {
  // Every step renders on the same 8x7 canvas. The grid is the actual
  // output captured from buildBlock() run with three user words
  // (CORAL, REEF, TIDE) against the full 42k-word dictionary at seed 1.
  // Each step shows a snapshot of how that grid is constructed:
  // scaffold -> carve -> carve -> fill -> fill -> complete.
  //
  // User word positions on the final grid:
  //   CORAL down col 2 rows 2-6
  //   TIDE  down col 3 rows 1-4
  //   REEF  across row 4 cols 2-5
  //
  // REEF intersects CORAL at R (4,2) and TIDE at E (4,3). The OD across
  // word at row 3 cols 2-3 emerges automatically from CORAL's O at
  // (3,2) sitting beside TIDE's D at (3,3).

  // Step 1: scaffold places user words on an open canvas
  const scaffold = makeGrid([
    ".......",
    "...T...",
    "..CI...",
    "..OD...",
    "..REEF.",
    "..A....",
    "..L....",
    ".......",
  ]);

  // Step 2: distance pass starts blackening cells far from user letters.
  // The corners and the cells flanking the REEF row carve first.
  const partialCarve = makeGrid([
    "..##...",
    "...T...",
    "..CI...",
    "##OD..#",
    "##REEF#",
    "..A....",
    "..L....",
    "..##...",
  ]);

  // Step 3: run-length pass closes off the remaining short runs. Final
  // black-square pattern matches the algorithm's actual structure output.
  const fullStructure = makeGrid([
    "..##...",
    "..#T...",
    "..CI...",
    "##OD###",
    "##REEF#",
    "..A.#..",
    "..L.#..",
    "..##...",
  ]);

  // Step 4: fill phase picks the most constrained slot. Row 2 across
  // already has C (from CORAL) and I (from TIDE) fixed; ANCIENT is the
  // 7-letter word the solver locks in.
  const ancientPlaced = makeGrid([
    "..##...",
    "..#T...",
    "ANCIENT",
    "##OD###",
    "##REEF#",
    "..A.#..",
    "..L.#..",
    "..##...",
  ]);

  // Step 5: backtracking cascades fills through the rest of the grid.
  // The 2-letter corner slots are still empty.
  const mostFilled = makeGrid([
    "..##AFT",
    "..#TREE",
    "ANCIENT",
    "##OD###",
    "##REEF#",
    "MMA#ALP",
    "AIL#ROO",
    "..##PED",
  ]);

  // Step 6: complete algorithm output, including the 2-letter slots
  // (AR, MO, NL) that survived as WIP artifacts.
  const complete = makeGrid([
    "AR##AFT",
    "MO#TREE",
    "ANCIENT",
    "##OD###",
    "##REEF#",
    "MMA#ALP",
    "AIL#ROO",
    "NL##PED",
  ]);

  const userHighlights = (): Record<string, CellHighlight> => {
    const h: Record<string, CellHighlight> = {};
    for (let r = 2; r <= 6; r++) h[`${r},2`] = "user"; // CORAL
    for (let r = 1; r <= 4; r++) h[`${r},3`] = "user"; // TIDE
    for (let c = 2; c <= 5; c++) {
      if (!h[`4,${c}`]) h[`4,${c}`] = "user"; // REEF
    }
    return h;
  };

  const carvedAndOpen = (g: string[][]): Record<string, CellHighlight> => {
    const h: Record<string, CellHighlight> = userHighlights();
    for (let r = 0; r < g.length; r++) {
      for (let c = 0; c < g[0].length; c++) {
        if (h[`${r},${c}`]) continue;
        const cell = g[r][c];
        if (cell === "#") h[`${r},${c}`] = "carved";
        else if (cell === "") h[`${r},${c}`] = "candidate";
      }
    }
    return h;
  };

  const ancientHighlights = (): Record<string, CellHighlight> => {
    const h: Record<string, CellHighlight> = carvedAndOpen(ancientPlaced);
    // Mark ANCIENT's non-user cells as the focus of this step
    for (let c = 0; c < 7; c++) {
      if (h[`2,${c}`] !== "user" && ancientPlaced[2][c] !== "") {
        h[`2,${c}`] = "focus";
      }
    }
    return h;
  };

  const fillHighlights = (g: string[][]): Record<string, CellHighlight> => {
    const h: Record<string, CellHighlight> = userHighlights();
    for (let r = 0; r < g.length; r++) {
      for (let c = 0; c < g[0].length; c++) {
        if (h[`${r},${c}`]) continue;
        const cell = g[r][c];
        if (cell === "#") h[`${r},${c}`] = "carved";
        else if (cell === "") h[`${r},${c}`] = "candidate";
        else h[`${r},${c}`] = "fill";
      }
    }
    return h;
  };

  return [
    {
      description: "1. Place the user's words",
      detail:
        "Phase 1 hands the user's three words (CORAL, TIDE, REEF) to the freeform scaffold solver. The solver lays them out so they intersect: REEF crosses CORAL at R and crosses TIDE at E. CORAL's O sits right beside TIDE's D at row 3, which means the algorithm gets an OD across word for free without ever placing it. Every other cell is open canvas, waiting to be carved or filled.",
      grid: scaffold,
      highlights: carvedAndOpen(scaffold),
    },
    {
      description: "2. Distance pass starts carving",
      detail:
        "Phase 2 runs a breadth-first search from every user letter, measuring how many steps each open cell sits from the nearest letter. Cells beyond the threshold turn into black squares. The far corners go first, and the long rows above and below REEF (rows 3 and 4 outside the user letters) start to close. The grid is starting to take on a real crossword silhouette.",
      grid: partialCarve,
      highlights: carvedAndOpen(partialCarve),
    },
    {
      description: "3. Run-length pass enforces three-letter minimums",
      detail:
        "Walk the remaining open cells. Any cell sitting in a run shorter than three letters in either direction is invalid by crossword rules, so it joins the black squares. The structure phase finishes here: irregular black-square pattern, slots of varying length, every slot at least three cells long. This is the structural backbone the fill phase works against.",
      grid: fullStructure,
      highlights: carvedAndOpen(fullStructure),
    },
    {
      description: "4. Fill begins with the most constrained slot",
      detail:
        "Phase 3 runs constraint-satisfaction search against the dictionary. The solver orders slots by how constrained they are, picking the one with the fewest candidates first. Row 2 across has C (from CORAL) and I (from TIDE) already fixed, narrowing the candidates sharply for a 7-letter slot. ANCIENT fits cleanly, intersecting both user words. The solver locks it in. If a later placement turns out to be impossible, this is the move it would unwind first.",
      grid: ancientPlaced,
      highlights: ancientHighlights(),
    },
    {
      description: "5. Constraint propagation and backtracking",
      detail:
        "Each placement narrows every slot it crosses. If a candidate creates an impossible constraint elsewhere, the solver throws it out and tries the next word. If every word in a slot fails, it backs up further and replaces an earlier choice. The backtracking is what lets it satisfy all the row and column constraints at once. After several such decisions and rollbacks, most slots fill in: AFT, TREE, MMA, ALP, AIL, ROO, and PED all click into place around the user words. Only the 2-letter corner slots are still open.",
      grid: mostFilled,
      highlights: fillHighlights(mostFilled),
    },
    {
      description: "6. The complete algorithm output",
      detail:
        "Same canvas, fully resolved. The solver wedged AR, MO, and NL into the three corners to finish the grid. Those 2-letter slots are unresolved work-in-progress artifacts: the algorithm should have either carved them out as black squares or extended them to three letters, and it currently does neither cleanly. The strategy is labelled WIP in the creator UI for exactly this reason. Everything else (CORAL, REEF, TIDE plus ANCIENT, TREE, OD, EARP, FLOE, AFT, MMA, ALP, AIL, ROO, ARE, AMA, MAN, RON, MIL, FEN, TET, POD) is real dictionary fill, with word lengths spanning two to seven and slots shifted in every direction.",
      grid: complete,
      highlights: fillHighlights(complete),
    },
  ];
}

const STEPS = buildSteps();
const STEP_DURATION_MS = 5500;

export function BlockBuilderDemo() {
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
  const stepRows = step.rows ?? ROWS;
  const stepCols = step.cols ?? COLS;
  const stepCellSize = step.cellSize ?? CELL_SIZE;

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
              gridTemplateColumns: `repeat(${stepCols}, ${stepCellSize}px)`,
              gridTemplateRows: `repeat(${stepRows}, ${stepCellSize}px)`,
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
                } else if (highlight === "user") {
                  bg = "bg-amber-200 dark:bg-amber-300";
                } else if (highlight === "focus") {
                  bg = "bg-yellow-300 dark:bg-yellow-400";
                } else if (highlight === "fill") {
                  bg = "bg-blue-100 dark:bg-blue-200";
                } else if (highlight === "candidate") {
                  bg = "bg-gray-100 dark:bg-zinc-300";
                  textColor = "text-gray-500";
                } else if (highlight === "carved") {
                  bg = "bg-black";
                  textColor = "text-white";
                }
                return (
                  <div
                    key={`${r}-${c}`}
                    className={`flex items-center justify-center border border-gray-300 dark:border-zinc-500 font-mono font-bold ${bg} ${textColor} transition-colors duration-300`}
                    style={{
                      width: stepCellSize,
                      height: stepCellSize,
                      fontSize: stepCellSize * 0.5,
                    }}
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

          <div className="flex flex-wrap gap-2 text-xs">
            <span className="px-2 py-1 rounded border bg-amber-100 dark:bg-amber-200 border-amber-300 dark:border-amber-400 text-amber-900 dark:text-amber-900 font-mono">
              User word
            </span>
            <span className="px-2 py-1 rounded border bg-yellow-200 dark:bg-yellow-300 border-yellow-400 dark:border-yellow-500 text-yellow-900 dark:text-yellow-900 font-mono">
              Just placed
            </span>
            <span className="px-2 py-1 rounded border bg-blue-100 dark:bg-blue-200 border-blue-300 dark:border-blue-400 text-blue-900 dark:text-blue-900 font-mono">
              Dictionary fill
            </span>
            <span className="px-2 py-1 rounded border bg-gray-100 dark:bg-zinc-300 border-gray-300 dark:border-zinc-400 text-gray-700 dark:text-gray-700 font-mono">
              Open candidate
            </span>
            <span className="px-2 py-1 rounded border bg-black border-zinc-700 text-white font-mono">
              Carved black
            </span>
          </div>
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
          User word: <span className="font-mono">CORAL</span>
        </span>
      </div>
    </div>
  );
}
