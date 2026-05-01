"use client";

import { useState, useCallback } from "react";
import type { WordEntry } from "@/engine/types";

interface WordlistInputProps {
  words: WordEntry[];
  onWordsChange: (words: WordEntry[]) => void;
}

export function WordlistInput({ words, onWordsChange }: WordlistInputProps) {
  const [newWord, setNewWord] = useState("");
  const [newClue, setNewClue] = useState("");
  const [bulkInput, setBulkInput] = useState("");
  const [showBulk, setShowBulk] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addWord = useCallback(() => {
    const word = newWord.trim().toUpperCase();
    const clue = newClue.trim();

    if (!word) {
      setError("Enter a word");
      return;
    }
    if (!/^[A-Z]+$/.test(word)) {
      setError("Words can only contain letters A-Z");
      return;
    }
    if (word.length < 3) {
      setError("Words must be at least 3 letters");
      return;
    }
    if (words.some((w) => w.word.toUpperCase() === word)) {
      setError("Word already in list");
      return;
    }

    onWordsChange([...words, { word, clue: clue || `Clue for ${word}` }]);
    setNewWord("");
    setNewClue("");
    setError(null);
  }, [newWord, newClue, words, onWordsChange]);

  const parseBulk = useCallback(() => {
    const lines = bulkInput
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const newWords: WordEntry[] = [];
    const errors: string[] = [];

    for (const line of lines) {
      // Support formats: "WORD - clue", "WORD: clue", "WORD, clue", "WORD\tclue", or just "WORD"
      const match = line.match(/^([A-Za-z]+)\s*[-:,\t]\s*(.*)$/) ||
                    line.match(/^([A-Za-z]+)$/);

      if (!match) {
        errors.push(`Couldn't parse: "${line}"`);
        continue;
      }

      const word = match[1].toUpperCase();
      const clue = match[2]?.trim() || `Clue for ${word}`;

      if (word.length < 3) {
        errors.push(`"${word}" is too short (min 3 letters)`);
        continue;
      }

      if (!newWords.some((w) => w.word === word) && !words.some((w) => w.word.toUpperCase() === word)) {
        newWords.push({ word, clue });
      }
    }

    if (errors.length > 0) {
      setError(errors.join("; "));
    } else {
      setError(null);
    }

    if (newWords.length > 0) {
      onWordsChange([...words, ...newWords]);
      setBulkInput("");
      setShowBulk(false);
    }
  }, [bulkInput, words, onWordsChange]);

  const removeWord = useCallback(
    (index: number) => {
      onWordsChange(words.filter((_, i) => i !== index));
    },
    [words, onWordsChange]
  );

  const updateClue = useCallback(
    (index: number, clue: string) => {
      const updated = [...words];
      updated[index] = { ...updated[index], clue };
      onWordsChange(updated);
    },
    [words, onWordsChange]
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-black">
          Word List ({words.length} word{words.length !== 1 ? "s" : ""})
        </h2>
        <button
          onClick={() => setShowBulk(!showBulk)}
          className="text-sm text-blue-600 hover:text-blue-800"
        >
          {showBulk ? "Single entry" : "Bulk import"}
        </button>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">
          {error}
        </p>
      )}

      {showBulk ? (
        <div className="flex flex-col gap-2">
          <textarea
            value={bulkInput}
            onChange={(e) => setBulkInput(e.target.value)}
            placeholder={"WORD - clue\nWORD - clue\nor just one word per line"}
            className="w-full h-40 px-3 py-2 border rounded-lg font-mono text-sm resize-y focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={parseBulk}
            className="self-end px-4 py-2 bg-black text-white rounded-lg text-sm hover:bg-gray-800"
          >
            Import Words
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          <input
            type="text"
            value={newWord}
            onChange={(e) => setNewWord(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addWord()}
            placeholder="Word"
            className="w-32 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="text"
            value={newClue}
            onChange={(e) => setNewClue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addWord()}
            placeholder="Clue (optional)"
            className="flex-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={addWord}
            className="px-4 py-2 bg-black text-white rounded-lg text-sm hover:bg-gray-800"
          >
            Add
          </button>
        </div>
      )}

      {/* Word list */}
      {words.length > 0 && (
        <div className="border rounded-lg divide-y max-h-80 overflow-y-auto">
          {words.map((entry, i) => (
            <div
              key={`${entry.word}-${i}`}
              className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 group"
            >
              <span className="font-mono font-semibold text-sm w-24 shrink-0">
                {entry.word}
              </span>
              <input
                type="text"
                value={entry.clue}
                onChange={(e) => updateClue(i, e.target.value)}
                className="flex-1 text-sm text-gray-600 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none px-1 py-0.5"
              />
              <button
                onClick={() => removeWord(i)}
                className="text-gray-500 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label={`Remove ${entry.word}`}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <line x1="4" y1="4" x2="12" y2="12" />
                  <line x1="12" y1="4" x2="4" y2="12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {words.length === 0 && (
        <p className="text-sm text-gray-600 text-center py-8">
          Add words to get started. You'll need enough words to fill the grid.
        </p>
      )}
    </div>
  );
}
