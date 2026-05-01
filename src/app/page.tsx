"use client";

import { useMemo } from "react";
import { CrosswordGrid } from "@/components/CrosswordGrid";
import { gridFromPattern } from "@/engine/grid";

const DEMO_PATTERN = [
  "HELLO",
  ".#.#.",
  "WORLD",
  ".#.#.",
  "SMILE",
].join("\n");

export default function Home() {
  const demoGrid = useMemo(() => gridFromPattern(DEMO_PATTERN), []);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-12 p-8">
      <div className="text-center">
        <h1 className="text-5xl font-bold tracking-tight">
          Crossword Creator
        </h1>
        <p className="mt-4 text-lg text-gray-700 max-w-xl">
          Create dense, professional-quality crossword puzzles with an
          intelligent generation engine. Share them with a link.
        </p>
      </div>

      <div className="flex flex-col items-center gap-4">
        <CrosswordGrid grid={demoGrid} cellSize={48} />
        <p className="text-sm text-gray-700">Sample 5x5 mini grid</p>
      </div>

      <div className="flex gap-4">
        <a
          href="/create"
          className="rounded-lg bg-black px-6 py-3 text-white font-medium hover:bg-gray-800 transition-colors"
        >
          Create a Puzzle
        </a>
        <a
          href="/about"
          className="rounded-lg border border-gray-300 px-6 py-3 font-medium hover:bg-gray-50 transition-colors"
        >
          How It Works
        </a>
      </div>
    </main>
  );
}
