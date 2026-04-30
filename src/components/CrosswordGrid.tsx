"use client";

import { useMemo } from "react";
import type { GridModel } from "@/engine/types";
import { CELL_BLACK, CELL_EMPTY, cellToLetter } from "@/engine/types";
import { cellIndex } from "@/engine/grid";
import { computeClueNumbers } from "@/lib/numbering";

export interface CrosswordGridProps {
  grid: GridModel;
  /** Cell size in pixels */
  cellSize?: number;
  /** Currently selected cell position */
  selectedCell?: { row: number; col: number } | null;
  /** Currently highlighted word cells (flat indices) */
  highlightedCells?: Set<number>;
  /** Cell values to display (overrides grid values, e.g. user input) */
  displayValues?: Map<number, string>;
  /** Cells marked as incorrect after checking */
  incorrectCells?: Set<number>;
  /** Cells marked as revealed */
  revealedCells?: Set<number>;
  /** Cells in pencil mode */
  pencilCells?: Set<number>;
  /** Click handler */
  onCellClick?: (row: number, col: number) => void;
}

export function CrosswordGrid({
  grid,
  cellSize = 40,
  selectedCell = null,
  highlightedCells,
  displayValues,
  incorrectCells,
  revealedCells,
  pencilCells,
  onCellClick,
}: CrosswordGridProps) {
  const clueNumbers = useMemo(() => {
    return computeClueNumbers(grid.rows, grid.cols, (r, c) => {
      return grid.cells[cellIndex(grid, r, c)] === CELL_BLACK;
    });
  }, [grid]);

  const gridWidth = grid.cols * cellSize;
  const gridHeight = grid.rows * cellSize;

  return (
    <svg
      width={gridWidth + 2}
      height={gridHeight + 2}
      viewBox={`-1 -1 ${gridWidth + 2} ${gridHeight + 2}`}
      className="select-none"
      role="grid"
      aria-label="Crossword puzzle grid"
    >
      {/* Outer border */}
      <rect
        x={0}
        y={0}
        width={gridWidth}
        height={gridHeight}
        fill="none"
        stroke="black"
        strokeWidth={2}
      />

      {/* Cells */}
      {Array.from({ length: grid.rows }, (_, r) =>
        Array.from({ length: grid.cols }, (_, c) => {
          const idx = cellIndex(grid, r, c);
          const cellValue = grid.cells[idx];
          const isCellBlack = cellValue === CELL_BLACK;
          const x = c * cellSize;
          const y = r * cellSize;
          const number = clueNumbers.get(`${r},${c}`);

          const isSelected =
            selectedCell?.row === r && selectedCell?.col === c;
          const isHighlighted = highlightedCells?.has(idx) ?? false;
          const isIncorrect = incorrectCells?.has(idx) ?? false;
          const isRevealed = revealedCells?.has(idx) ?? false;
          const isPencil = pencilCells?.has(idx) ?? false;

          // Determine display letter
          let displayLetter = "";
          if (!isCellBlack) {
            if (displayValues?.has(idx)) {
              displayLetter = displayValues.get(idx)!;
            } else if (cellValue !== CELL_EMPTY) {
              displayLetter = cellToLetter(cellValue);
            }
          }

          // Determine fill color
          let fill = "white";
          if (isCellBlack) {
            fill = "black";
          } else if (isSelected) {
            fill = "#FFDA00";
          } else if (isHighlighted) {
            fill = "#A7D8FF";
          }

          return (
            <g
              key={`${r}-${c}`}
              onClick={() => onCellClick?.(r, c)}
              style={{ cursor: onCellClick ? "pointer" : "default" }}
              role="gridcell"
              aria-label={
                isCellBlack
                  ? "Black cell"
                  : `Row ${r + 1}, Column ${c + 1}${number ? `, number ${number}` : ""}${displayLetter ? `, letter ${displayLetter}` : ""}`
              }
            >
              {/* Cell background */}
              <rect
                x={x}
                y={y}
                width={cellSize}
                height={cellSize}
                fill={fill}
                stroke="#333"
                strokeWidth={0.5}
              />

              {/* Incorrect marker */}
              {isIncorrect && !isCellBlack && (
                <line
                  x1={x + 2}
                  y1={y + 2}
                  x2={x + cellSize * 0.3}
                  y2={y + cellSize * 0.3}
                  stroke="red"
                  strokeWidth={1.5}
                />
              )}

              {/* Clue number */}
              {number !== undefined && (
                <text
                  x={x + 2.5}
                  y={y + cellSize * 0.28}
                  fontSize={cellSize * 0.25}
                  fontFamily="Arial, sans-serif"
                  fill="#333"
                  pointerEvents="none"
                >
                  {number}
                </text>
              )}

              {/* Letter */}
              {displayLetter && (
                <text
                  x={x + cellSize / 2}
                  y={y + cellSize * 0.72}
                  fontSize={cellSize * 0.5}
                  fontFamily="Arial, sans-serif"
                  fontWeight={isRevealed ? "normal" : "bold"}
                  fill={isPencil ? "#888" : "#111"}
                  textAnchor="middle"
                  pointerEvents="none"
                >
                  {displayLetter}
                </text>
              )}

              {/* Revealed indicator (small dot) */}
              {isRevealed && !isCellBlack && (
                <circle
                  cx={x + cellSize - 5}
                  cy={y + 5}
                  r={2}
                  fill="#4A90D9"
                />
              )}
            </g>
          );
        })
      )}
    </svg>
  );
}
