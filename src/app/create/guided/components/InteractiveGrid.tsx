"use client";

import { useMemo } from "react";
import type { GridModel, SlotDescriptor } from "@/engine/types";
import { CELL_BLACK, CELL_EMPTY, cellToLetter } from "@/engine/types";
import { cellIndex } from "@/engine/grid";
import { computeClueNumbers } from "@/lib/numbering";

interface InteractiveGridProps {
  grid: GridModel;
  selectedCell: { row: number; col: number } | null;
  selectedSlot: SlotDescriptor | null;
  direction: "across" | "down";
  cellSize: number;
  onCellClick: (row: number, col: number) => void;
}

export function InteractiveGrid({
  grid,
  selectedCell,
  selectedSlot,
  direction,
  cellSize,
  onCellClick,
}: InteractiveGridProps) {
  const clueNumbers = useMemo(() => {
    return computeClueNumbers(grid.rows, grid.cols, (r, c) => {
      return grid.cells[cellIndex(grid, r, c)] === CELL_BLACK;
    });
  }, [grid]);

  const highlightedCells = useMemo(() => {
    if (!selectedSlot) return new Set<number>();
    return new Set(selectedSlot.cellIndices);
  }, [selectedSlot]);

  const gridWidth = grid.cols * cellSize;
  const gridHeight = grid.rows * cellSize;

  return (
    <svg
      viewBox={`-1 -1 ${gridWidth + 2} ${gridHeight + 2}`}
      className="select-none"
      style={{ maxWidth: gridWidth + 2, maxHeight: gridHeight + 2, width: "100%" }}
    >
      <rect
        x={0} y={0}
        width={gridWidth} height={gridHeight}
        fill="none" stroke="black" strokeWidth={2}
      />

      {Array.from({ length: grid.rows }, (_, r) =>
        Array.from({ length: grid.cols }, (_, c) => {
          const idx = cellIndex(grid, r, c);
          const cellValue = grid.cells[idx];
          const isCellBlack = cellValue === CELL_BLACK;
          const x = c * cellSize;
          const y = r * cellSize;
          const number = clueNumbers.get(`${r},${c}`);

          const isSelected = selectedCell?.row === r && selectedCell?.col === c;
          const isHighlighted = highlightedCells.has(idx);

          let fill = "white";
          if (isCellBlack) {
            fill = "#111";
          } else if (isSelected) {
            fill = "#FFDA00";
          } else if (isHighlighted) {
            fill = "#A7D8FF";
          }

          const displayLetter =
            !isCellBlack && cellValue !== CELL_EMPTY
              ? cellToLetter(cellValue)
              : "";

          return (
            <g
              key={`${r}-${c}`}
              onClick={() => onCellClick(r, c)}
              style={{ cursor: "pointer" }}
            >
              <rect
                x={x} y={y}
                width={cellSize} height={cellSize}
                fill={fill}
                stroke="#333"
                strokeWidth={0.5}
              />
              {number !== undefined && (
                <text
                  x={x + 2.5}
                  y={y + cellSize * 0.28}
                  fontSize={cellSize * 0.25}
                  fontFamily="Arial, sans-serif"
                  fill="#555"
                  pointerEvents="none"
                >
                  {number}
                </text>
              )}
              {displayLetter && (
                <text
                  x={x + cellSize / 2}
                  y={y + cellSize * 0.72}
                  fontSize={cellSize * 0.5}
                  fontFamily="Arial, sans-serif"
                  fontWeight="bold"
                  fill="#111"
                  textAnchor="middle"
                  pointerEvents="none"
                >
                  {displayLetter}
                </text>
              )}
            </g>
          );
        })
      )}
    </svg>
  );
}
