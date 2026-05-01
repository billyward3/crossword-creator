"use client";

import type { SolverResult } from "@/engine/types";
import { CrosswordGrid } from "@/components/CrosswordGrid";

interface SolutionCardsProps {
  solutions: SolverResult[];
  selectedIndex: number | null;
  onSelect: (index: number) => void;
}

export function SolutionCards({
  solutions,
  selectedIndex,
  onSelect,
}: SolutionCardsProps) {
  if (solutions.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold text-black">
        Solutions ({solutions.length} found)
      </h2>
      <p className="text-sm text-gray-700">
        Click a solution to select it for your puzzle.
      </p>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {solutions.map((result, i) => (
          <button
            key={i}
            onClick={() => onSelect(i)}
            className={`flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all ${
              selectedIndex === i
                ? "border-black bg-gray-50 shadow-md"
                : "border-gray-200 hover:border-gray-400"
            }`}
          >
            <CrosswordGrid
              grid={result.grid}
              cellSize={
                result.grid.cols <= 5
                  ? 32
                  : result.grid.cols <= 15
                    ? 16
                    : 12
              }
            />
            <span className="text-xs text-gray-700">
              Option {i + 1} &middot; {Math.round(result.solveTimeMs)}ms
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
