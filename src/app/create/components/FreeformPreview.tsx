"use client";

import type { FreeformResult } from "@/engine/freeform";

interface FreeformPreviewProps {
  result: FreeformResult;
  cellSize?: number;
  /** When true, suppress the "couldn't be placed" widget (e.g., a word cap is active). */
  hideUnplaced?: boolean;
}

export function FreeformPreview({
  result,
  cellSize = 36,
  hideUnplaced = false,
}: FreeformPreviewProps) {
  const { grid, rows, cols, placed, unplaced, intersections } = result;

  if (placed.length === 0) return null;

  const gridWidth = cols * cellSize;
  const gridHeight = rows * cellSize;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col items-center gap-2">
        <svg
          viewBox={`-1 -1 ${gridWidth + 2} ${gridHeight + 2}`}
          className="select-none w-full"
          style={{ maxWidth: gridWidth + 2, maxHeight: gridHeight + 2 }}
        >
          <rect
            x={0} y={0}
            width={gridWidth} height={gridHeight}
            fill="none" stroke="black" strokeWidth={2}
          />

          {grid.map((row, r) =>
            row.map((cell, c) => {
              const x = c * cellSize;
              const y = r * cellSize;
              const isBlack = cell === "#";

              // Find clue number for this cell
              const number = getClueNumber(r, c, placed);

              return (
                <g key={`${r}-${c}`}>
                  <rect
                    x={x} y={y}
                    width={cellSize} height={cellSize}
                    fill={isBlack ? "#f3f4f6" : "white"}
                    stroke={isBlack ? "none" : "#333"}
                    strokeWidth={isBlack ? 0 : 0.5}
                  />
                  {number !== null && (
                    <text
                      x={x + 2.5}
                      y={y + cellSize * 0.28}
                      fontSize={cellSize * 0.25}
                      fontFamily="Arial, sans-serif"
                      fill="#333"
                    >
                      {number}
                    </text>
                  )}
                  {!isBlack && (
                    <text
                      x={x + cellSize / 2}
                      y={y + cellSize * 0.72}
                      fontSize={cellSize * 0.5}
                      fontFamily="Arial, sans-serif"
                      fontWeight="bold"
                      fill="#111"
                      textAnchor="middle"
                    >
                      {cell}
                    </text>
                  )}
                </g>
              );
            })
          )}
        </svg>

        <div className="flex gap-3 text-xs text-gray-700 dark:text-zinc-300">
          <span className="px-2.5 py-1 bg-gray-100 dark:bg-zinc-800 rounded-full">
            {placed.length} word{placed.length !== 1 ? "s" : ""} placed
          </span>
          <span className="px-2.5 py-1 bg-gray-100 dark:bg-zinc-800 rounded-full">
            {intersections} intersection{intersections !== 1 ? "s" : ""}
          </span>
          <span className="px-2.5 py-1 bg-gray-100 dark:bg-zinc-800 rounded-full">
            {rows}&times;{cols} grid
          </span>
        </div>
      </div>

      {!hideUnplaced && unplaced.length > 0 && (
        <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-xl text-sm">
          <p className="font-semibold text-black dark:text-zinc-100 mb-1">
            {unplaced.length} word{unplaced.length !== 1 ? "s" : ""} couldn't be placed
          </p>
          <p className="text-gray-800 dark:text-zinc-300 mb-1">
            {unplaced.map((w) => w.word).join(", ")}
          </p>
          <p className="text-gray-700 dark:text-zinc-400 text-xs">
            These words don't share enough letters with the placed words to create crossings.
            Adding words with common letters (A, E, R, S, T) helps.
          </p>
        </div>
      )}
    </div>
  );
}

/** Compute clue number for a cell (if it starts a placed word) */
function getClueNumber(
  row: number,
  col: number,
  placed: FreeformResult["placed"]
): number | null {
  // Collect all cells that start a word, sorted by position
  const starts: { row: number; col: number }[] = [];
  for (const pw of placed) {
    const key = `${pw.row},${pw.col}`;
    if (!starts.some((s) => s.row === pw.row && s.col === pw.col)) {
      starts.push({ row: pw.row, col: pw.col });
    }
  }
  starts.sort((a, b) => a.row !== b.row ? a.row - b.row : a.col - b.col);

  const idx = starts.findIndex((s) => s.row === row && s.col === col);
  return idx >= 0 ? idx + 1 : null;
}
