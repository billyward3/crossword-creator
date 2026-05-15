"use client";

import { use, useEffect, useState } from "react";
import type { Puzzle } from "@/lib/puzzle/types";

export default function SharePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    let alive = true;
    fetch(`/api/puzzles/${id}`)
      .then(async (res) => {
        if (!alive) return;
        if (!res.ok) {
          setError(res.status === 404 ? "Puzzle not found" : "Failed to load");
          setLoading(false);
          return;
        }
        const data: Puzzle = await res.json();
        if (alive) {
          setPuzzle(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (alive) {
          setError("Failed to load");
          setLoading(false);
        }
      });
    return () => {
      alive = false;
    };
  }, [id]);

  const solveUrl = origin ? `${origin}/solve/${id}` : `/solve/${id}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(solveUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard may be unavailable (non-https / older browsers)
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-white dark:bg-zinc-950 text-black dark:text-zinc-100">
        <p className="text-sm text-gray-700 dark:text-zinc-400">Preparing share…</p>
      </main>
    );
  }

  if (error || !puzzle) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-4 bg-white dark:bg-zinc-950 text-black dark:text-zinc-100">
        <p className="text-lg font-semibold">{error ?? "Puzzle not found"}</p>
        <a
          href="/create/edit"
          className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
        >
          Back to editor
        </a>
      </main>
    );
  }

  const wordCount = Object.keys(puzzle.clues).length;
  const rows = puzzle.grid.length;
  const cols = puzzle.grid[0]?.length ?? 0;

  return (
    <main className="min-h-screen bg-white dark:bg-zinc-950 text-black dark:text-zinc-100">
      <header className="bg-white dark:bg-zinc-950 border-b border-gray-200 dark:border-zinc-800 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between pr-12">
          <a href="/" className="text-xl font-bold text-black dark:text-zinc-100">
            Crossword Creator
          </a>
          <div className="flex items-center gap-5 text-sm">
            <a
              href="/create/edit"
              className="text-gray-700 dark:text-zinc-400 hover:text-black dark:hover:text-zinc-100"
            >
              ← Back to editor
            </a>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-12 flex flex-col gap-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Puzzle ready to share</h1>
          <p className="text-gray-800 dark:text-zinc-300">
            Anyone with this link can solve your puzzle. The link won't expire
            for 90 days.
          </p>
        </div>

        <div className="p-4 bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl flex flex-col gap-3">
          <p className="text-xs font-semibold text-gray-700 dark:text-zinc-400 uppercase tracking-wide">
            Solve link
          </p>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={solveUrl}
              className="flex-1 px-3 py-2 bg-white dark:bg-zinc-950 border border-gray-300 dark:border-zinc-700 rounded-lg font-mono text-sm text-black dark:text-zinc-100"
              onFocus={(e) => e.currentTarget.select()}
            />
            <button
              onClick={copy}
              className="px-4 py-2 bg-black dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg font-medium text-sm hover:bg-gray-800 dark:hover:bg-zinc-300 transition-colors"
            >
              {copied ? "Copied ✓" : "Copy"}
            </button>
          </div>
        </div>

        <div className="p-4 border border-gray-200 dark:border-zinc-800 rounded-xl flex flex-col gap-2">
          <p className="text-xs font-semibold text-gray-700 dark:text-zinc-400 uppercase tracking-wide">
            Puzzle details
          </p>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
            <div className="text-gray-700 dark:text-zinc-400">Title</div>
            <div className="text-black dark:text-zinc-100">
              {puzzle.title || <em className="text-gray-500">Untitled</em>}
            </div>
            <div className="text-gray-700 dark:text-zinc-400">Grid</div>
            <div className="text-black dark:text-zinc-100">{rows}×{cols}</div>
            <div className="text-gray-700 dark:text-zinc-400">Clues</div>
            <div className="text-black dark:text-zinc-100">{wordCount}</div>
            <div className="text-gray-700 dark:text-zinc-400">Created</div>
            <div className="text-black dark:text-zinc-100">
              {new Date(puzzle.createdAt).toLocaleString()}
            </div>
          </div>
        </div>

        <div className="flex gap-3 flex-wrap">
          <a
            href={`/solve/${id}`}
            className="px-5 py-2.5 bg-blue-600 dark:bg-blue-500 text-white rounded-xl font-medium text-sm hover:bg-blue-700 dark:hover:bg-blue-400 transition-colors"
          >
            Preview as a solver →
          </a>
          <a
            href="/create/edit"
            className="px-5 py-2.5 border border-gray-300 dark:border-zinc-700 rounded-xl font-medium text-sm text-black dark:text-zinc-100 hover:bg-gray-100 dark:hover:bg-zinc-900 transition-colors"
          >
            Keep editing
          </a>
        </div>
      </div>
    </main>
  );
}
