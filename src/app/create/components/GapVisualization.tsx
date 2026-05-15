"use client";

import { useMemo } from "react";
import type { GridModel, SlotFeasibility } from "@/engine/types";
import { CELL_BLACK, CELL_EMPTY } from "@/engine/types";
import { cellIndex, extractSlots } from "@/engine/grid";
import { computeClueNumbers } from "@/lib/numbering";

interface GapVisualizationProps {
  grid: GridModel;
  feasibility: SlotFeasibility[];
  /** Currently hovered suggestion slot ID */
  highlightedSlotId?: number | null;
  onSlotClick?: (slotId: number) => void;
  cellSize?: number;
}

/**
 * Renders the grid template with slots colored by feasibility:
 * - Green: flexible (many candidates)
 * - Yellow: constrained (few candidates)
 * - Orange: forced (only 1 candidate)
 * - Red: impossible (no candidates, needs a new word)
 * - White: not part of any slot / black
 */
export function GapVisualization({
  grid,
  feasibility,
  highlightedSlotId = null,
  onSlotClick,
  cellSize = 36,
}: GapVisualizationProps) {
  const slots = useMemo(() => extractSlots(grid), [grid]);

  // Build a map: cell flat index → worst feasibility status affecting it
  const cellColors = useMemo(() => {
    const feasMap = new Map<number, SlotFeasibility>();
    for (const f of feasibility) {
      feasMap.set(f.slotId, f);
    }

    const colors = new Map<number, { fill: string; slotId: number }>();

    for (const slot of slots) {
      const feas = feasMap.get(slot.id);
      if (!feas) continue;

      const fill = statusToColor(feas.status);

      for (const ci of slot.cellIndices) {
        const existing = colors.get(ci);
        // Keep the worst status (impossible > forced > constrained > flexible)
        if (!existing || statusPriority(feas.status) > statusPriority(statusFromColor(existing.fill))) {
          colors.set(ci, { fill, slotId: slot.id });
        }
      }
    }

    return colors;
  }, [slots, feasibility]);

  // Highlighted slot cells
  const highlightedCells = useMemo(() => {
    if (highlightedSlotId === null) return new Set<number>();
    const slot = slots.find((s) => s.id === highlightedSlotId);
    if (!slot) return new Set<number>();
    return new Set(slot.cellIndices);
  }, [slots, highlightedSlotId]);

  const clueNumbers = useMemo(() => {
    return computeClueNumbers(grid.rows, grid.cols, (r, c) => {
      return grid.cells[cellIndex(grid, r, c)] === CELL_BLACK;
    });
  }, [grid]);

  const gridWidth = grid.cols * cellSize;
  const gridHeight = grid.rows * cellSize;

  return (
    <div className="flex flex-col items-center gap-3">
      <svg
        width={gridWidth + 2}
        height={gridHeight + 2}
        viewBox={`-1 -1 ${gridWidth + 2} ${gridHeight + 2}`}
        className="select-none"
      >
        <rect
          x={0} y={0}
          width={gridWidth} height={gridHeight}
          fill="none" stroke="black" strokeWidth={2}
        />

        {Array.from({ length: grid.rows }, (_, r) =>
          Array.from({ length: grid.cols }, (_, c) => {
            const idx = cellIndex(grid, r, c);
            const isCellBlack = grid.cells[idx] === CELL_BLACK;
            const x = c * cellSize;
            const y = r * cellSize;
            const number = clueNumbers.get(`${r},${c}`);
            const colorInfo = cellColors.get(idx);
            const isHighlighted = highlightedCells.has(idx);

            let fill = "white";
            if (isCellBlack) {
              fill = "black";
            } else if (isHighlighted) {
              fill = "#FDE68A"; // bright yellow highlight
            } else if (colorInfo) {
              fill = colorInfo.fill;
            }

            return (
              <g
                key={`${r}-${c}`}
                onClick={() => {
                  if (colorInfo && onSlotClick) onSlotClick(colorInfo.slotId);
                }}
                style={{ cursor: colorInfo && onSlotClick ? "pointer" : "default" }}
              >
                <rect
                  x={x} y={y}
                  width={cellSize} height={cellSize}
                  fill={fill}
                  stroke="#333"
                  strokeWidth={0.5}
                />
                {isHighlighted && !isCellBlack && (
                  <rect
                    x={x + 1} y={y + 1}
                    width={cellSize - 2} height={cellSize - 2}
                    fill="none"
                    stroke="#B45309"
                    strokeWidth={2}
                  />
                )}
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
              </g>
            );
          })
        )}
      </svg>

      {/* Legend */}
      <div className="flex gap-4 text-xs text-gray-800">
        <LegendItem color="#DCFCE7" label="Fillable" />
        <LegendItem color="#FEF9C3" label="Constrained" />
        <LegendItem color="#FED7AA" label="Forced (1 option)" />
        <LegendItem color="#FECACA" label="Needs word" />
      </div>
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div
        className="w-3 h-3 rounded border border-gray-300"
        style={{ backgroundColor: color }}
      />
      <span>{label}</span>
    </div>
  );
}

function statusToColor(status: SlotFeasibility["status"]): string {
  switch (status) {
    case "flexible": return "#DCFCE7";    // green-100
    case "constrained": return "#FEF9C3"; // yellow-100
    case "forced": return "#FED7AA";      // orange-200
    case "impossible": return "#FECACA";  // red-200
  }
}

function statusPriority(status: SlotFeasibility["status"]): number {
  switch (status) {
    case "flexible": return 0;
    case "constrained": return 1;
    case "forced": return 2;
    case "impossible": return 3;
  }
}

function statusFromColor(color: string): SlotFeasibility["status"] {
  switch (color) {
    case "#DCFCE7": return "flexible";
    case "#FEF9C3": return "constrained";
    case "#FED7AA": return "forced";
    case "#FECACA": return "impossible";
    default: return "flexible";
  }
}
