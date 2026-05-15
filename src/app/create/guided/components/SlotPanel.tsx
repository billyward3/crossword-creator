"use client";

import { useState } from "react";
import type { SlotDescriptor } from "@/engine/types";
import type { WordIndex } from "@/engine/wordindex";

interface SlotPanelProps {
  slot: SlotDescriptor | null;
  candidates: number[];
  wordIndex: WordIndex | null;
  userWordSet: Set<string>;
  slotLetters: (string | null)[];
  onPlaceWord: (word: string) => void;
  onClearSlot: () => void;
  currentWord: string | null;
}

export function SlotPanel({
  slot,
  candidates,
  wordIndex,
  userWordSet,
  slotLetters,
  onPlaceWord,
  onClearSlot,
  currentWord,
}: SlotPanelProps) {
  const [filter, setFilter] = useState("");

  if (!slot) {
    return (
      <div className="p-6 bg-gray-50 dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 text-center">
        <p className="text-gray-700 dark:text-zinc-300 font-medium mb-2">Select a slot</p>
        <p className="text-sm text-gray-600 dark:text-zinc-400">
          Click a white cell in the grid to see word suggestions.
          Click the same cell again to toggle across/down.
        </p>
        <div className="mt-4 text-xs text-gray-600 dark:text-zinc-400 space-y-1">
          <p><strong className="text-black dark:text-zinc-100">Select tool:</strong> Click cells to pick slots and place words</p>
          <p><strong className="text-black dark:text-zinc-100">Toggle Black tool:</strong> Click cells to add/remove black squares (symmetric)</p>
          <p><strong className="text-black dark:text-zinc-100">Auto-fill:</strong> Fills all empty slots using the dictionary</p>
        </div>
      </div>
    );
  }

  // Pattern display
  const pattern = slotLetters.map((l) => l ?? "_").join("");
  const dirLabel = slot.direction === "across" ? "Across" : "Down";

  // Filter and sort candidates: user words first, then by position in wordIndex
  const filteredCandidates = (() => {
    if (!wordIndex) return [];
    const filterUpper = filter.toUpperCase();
    let list = candidates.map((idx) => ({
      idx,
      word: wordIndex.words[idx],
      isUser: userWordSet.has(wordIndex.words[idx]),
    }));

    if (filterUpper) {
      list = list.filter((c) => c.word.includes(filterUpper));
    }

    // User words first, then dictionary words
    list.sort((a, b) => {
      if (a.isUser !== b.isUser) return a.isUser ? -1 : 1;
      return 0; // preserve original order (by score from wordIndex)
    });

    return list;
  })();

  const userCount = filteredCandidates.filter((c) => c.isUser).length;
  const dictCount = filteredCandidates.length - userCount;

  return (
    <div className="flex flex-col gap-4">
      {/* Slot info */}
      <div className="p-4 bg-gray-50 dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-xl tracking-widest text-black dark:text-zinc-100">
              {currentWord ?? pattern}
            </span>
            <span className="text-sm text-gray-700 dark:text-zinc-400">
              {slot.length} letters, {dirLabel}
            </span>
          </div>
          {currentWord && (
            <button
              onClick={onClearSlot}
              className="px-3 py-1 text-xs text-red-600 dark:text-red-400 border border-red-300 dark:border-red-900 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30"
            >
              Clear
            </button>
          )}
        </div>
        {currentWord ? (
          <p className="text-sm text-green-700 dark:text-green-400">
            This slot is filled with <strong>{currentWord}</strong>.
            {userWordSet.has(currentWord)
              ? " (your word)"
              : " (dictionary word)"}
          </p>
        ) : (
          <p className="text-sm text-gray-700 dark:text-zinc-300">
            {candidates.length === 0
              ? "No words match the current constraints. Try changing crossing words or black cell layout."
              : `${candidates.length} words can fit here.`}
            {userCount > 0 && ` ${userCount} from your list.`}
          </p>
        )}
      </div>

      {/* Candidate list */}
      {!currentWord && candidates.length > 0 && (
        <>
          {/* Filter */}
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter words..."
            className="px-3 py-2 border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-black dark:text-zinc-100 placeholder:text-gray-400 dark:placeholder:text-zinc-500 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          {/* Stats */}
          <div className="flex gap-3 text-xs text-gray-700 dark:text-zinc-400">
            {userCount > 0 && (
              <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-950/50 text-blue-800 dark:text-blue-300 rounded-full">
                {userCount} your words
              </span>
            )}
            <span className="px-2 py-0.5 bg-gray-100 dark:bg-zinc-800 text-black dark:text-zinc-300 rounded-full">
              {dictCount} dictionary
            </span>
          </div>

          {/* Word list */}
          <div className="border border-gray-200 dark:border-zinc-800 rounded-xl divide-y divide-gray-200 dark:divide-zinc-800 max-h-[60vh] overflow-y-auto bg-white dark:bg-zinc-950">
            {filteredCandidates.slice(0, 100).map((c) => (
              <button
                key={c.idx}
                onClick={() => onPlaceWord(c.word)}
                className={`w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors ${
                  c.isUser ? "bg-blue-50/50 dark:bg-blue-950/20" : ""
                }`}
              >
                <span className="font-mono font-semibold text-sm text-black dark:text-zinc-100">
                  {c.word}
                </span>
                {c.isUser && (
                  <span className="text-[10px] text-blue-600 dark:text-blue-300 bg-blue-100 dark:bg-blue-950/50 px-1.5 py-0.5 rounded-full">
                    yours
                  </span>
                )}
              </button>
            ))}
            {filteredCandidates.length > 100 && (
              <div className="px-3 py-2 text-xs text-gray-600 dark:text-zinc-400 text-center">
                {filteredCandidates.length - 100} more &mdash; use the filter to narrow down
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
