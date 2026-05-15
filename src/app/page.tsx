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
    <main className="flex min-h-screen flex-col items-center justify-center gap-16 p-8 bg-white dark:bg-zinc-950">
      <div className="text-center max-w-2xl">
        <h1 className="text-6xl font-bold tracking-tight text-black dark:text-zinc-100">
          Crossword Creator
        </h1>
        <p className="mt-5 text-xl text-gray-800 dark:text-zinc-300 leading-relaxed">
          Build personalized crossword puzzles from your own words.
          An intelligent engine arranges them into dense, interconnected grids.
        </p>
      </div>

      <div className="flex flex-col items-center gap-3">
        <CrosswordGrid grid={demoGrid} cellSize={52} />
      </div>

      <div className="flex gap-4">
        <a
          href="/create"
          className="rounded-xl bg-black dark:bg-zinc-100 px-8 py-3.5 text-white dark:text-zinc-900 font-medium hover:bg-gray-800 dark:hover:bg-zinc-300 transition-colors shadow-sm"
        >
          Create a Puzzle
        </a>
        <a
          href="/about"
          className="rounded-xl border border-gray-300 dark:border-zinc-700 px-8 py-3.5 font-medium text-black dark:text-zinc-100 hover:bg-gray-50 dark:hover:bg-zinc-900 transition-colors"
        >
          How It Works
        </a>
      </div>
    </main>
  );
}
