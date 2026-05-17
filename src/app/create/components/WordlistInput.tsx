"use client";

import { useState, useCallback } from "react";
import type { WordEntry } from "@/engine/types";
import { COASTAL_EXAMPLE } from "@/lib/example-wordlist";

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
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [sortAlpha, setSortAlpha] = useState(false);

  // When sorting alphabetically, we display a sorted view but keep the original
  // word indices around so edit/remove/toggle operations target the right entry.
  const displayedWords = sortAlpha
    ? [...words]
        .map((entry, originalIndex) => ({ entry, originalIndex }))
        .sort((a, b) => a.entry.word.localeCompare(b.entry.word))
    : words.map((entry, originalIndex) => ({ entry, originalIndex }));

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

  const loadExample = useCallback(() => {
    if (words.length > 0) {
      const ok = window.confirm(
        "Replace the current word list with the coastal example list (25 words)?"
      );
      if (!ok) return;
    }
    onWordsChange([...COASTAL_EXAMPLE]);
    setError(null);
    setShowBulk(false);
  }, [words.length, onWordsChange]);

  const parseBulk = useCallback(() => {
    const lines = bulkInput
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const newWords: WordEntry[] = [];
    const errors: string[] = [];

    for (const line of lines) {
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

  const updateWord = useCallback(
    (index: number, newWord: string): string | null => {
      const w = newWord.trim().toUpperCase();
      if (!w) return "Word can't be empty";
      if (!/^[A-Z]+$/.test(w)) return "Letters A–Z only";
      if (w.length < 3) return "Min 3 letters";
      if (words.some((e, i) => i !== index && e.word.toUpperCase() === w)) {
        return "Already in list";
      }
      const updated = [...words];
      updated[index] = { ...updated[index], word: w };
      onWordsChange(updated);
      return null;
    },
    [words, onWordsChange]
  );

  const toggleEnabled = useCallback(
    (index: number) => {
      const updated = [...words];
      const current = updated[index];
      const isEnabled = current.enabled !== false;
      updated[index] = { ...current, enabled: !isEnabled };
      onWordsChange(updated);
    },
    [words, onWordsChange]
  );

  const toggleSelect = (index: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const selectAll = () => {
    setSelected(new Set(words.map((_, i) => i)));
  };

  const selectNone = () => {
    setSelected(new Set());
  };

  const deleteSelected = () => {
    onWordsChange(words.filter((_, i) => !selected.has(i)));
    setSelected(new Set());
    setSelecting(false);
  };

  const cancelSelect = () => {
    setSelected(new Set());
    setSelecting(false);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-black dark:text-zinc-100">
          Word List ({words.length} word{words.length !== 1 ? "s" : ""})
        </h2>
        <div className="flex items-center gap-3">
          {words.length > 1 && !selecting && (
            <button
              onClick={() => setSortAlpha(!sortAlpha)}
              className={`text-sm transition-colors ${
                sortAlpha
                  ? "text-blue-600 dark:text-blue-400 font-medium"
                  : "text-gray-700 dark:text-zinc-400 hover:text-black dark:hover:text-zinc-100"
              }`}
              title={sortAlpha ? "Showing alphabetical order" : "Showing original order"}
            >
              {sortAlpha ? "A→Z ✓" : "A→Z"}
            </button>
          )}
          {words.length > 0 && !selecting && (
            <button
              onClick={() => setSelecting(true)}
              className="text-sm text-gray-700 dark:text-zinc-400 hover:text-red-600 dark:hover:text-red-400"
            >
              Select
            </button>
          )}
          {words.length > 0 && !selecting && (
            <button
              onClick={() => onWordsChange([])}
              className="text-sm text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
            >
              Clear all
            </button>
          )}
          <button
            onClick={() => setShowBulk(!showBulk)}
            className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
          >
            {showBulk ? "Single entry" : "Bulk import"}
          </button>
          <button
            onClick={loadExample}
            className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
          >
            Use example list
          </button>
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 px-3 py-2 rounded">
          {error}
        </p>
      )}

      {showBulk ? (
        <div className="flex flex-col gap-2">
          <textarea
            value={bulkInput}
            onChange={(e) => setBulkInput(e.target.value)}
            placeholder={"WORD - clue\nWORD - clue\nor just one word per line"}
            className="w-full h-40 px-3 py-2 border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-black dark:text-zinc-100 placeholder:text-gray-400 dark:placeholder:text-zinc-500 rounded-lg font-mono text-sm resize-y focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={parseBulk}
            className="self-end px-4 py-2 bg-black dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg text-sm hover:bg-gray-800 dark:hover:bg-zinc-300"
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
            className="w-32 px-3 py-2 border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-black dark:text-zinc-100 placeholder:text-gray-400 dark:placeholder:text-zinc-500 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="text"
            value={newClue}
            onChange={(e) => setNewClue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addWord()}
            placeholder="Clue (optional)"
            className="flex-1 px-3 py-2 border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-black dark:text-zinc-100 placeholder:text-gray-400 dark:placeholder:text-zinc-500 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={addWord}
            className="px-4 py-2 bg-black dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg text-sm hover:bg-gray-800 dark:hover:bg-zinc-300"
          >
            Add
          </button>
        </div>
      )}

      {/* Select mode toolbar */}
      {selecting && (
        <div className="flex items-center gap-3 px-3 py-2 bg-gray-100 dark:bg-zinc-900 rounded-lg text-sm">
          <span className="text-black dark:text-zinc-100 font-medium">
            {selected.size} selected
          </span>
          <button onClick={selectAll} className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300">
            All
          </button>
          <button onClick={selectNone} className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300">
            None
          </button>
          <div className="flex-1" />
          <button
            onClick={deleteSelected}
            disabled={selected.size === 0}
            className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Delete ({selected.size})
          </button>
          <button
            onClick={cancelSelect}
            className="px-3 py-1 border border-gray-300 dark:border-zinc-700 text-black dark:text-zinc-100 rounded text-sm hover:bg-gray-200 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Word list */}
      {words.length > 0 && (
        <div className="border border-gray-200 dark:border-zinc-800 rounded-lg divide-y divide-gray-200 dark:divide-zinc-800 max-h-[60vh] min-h-[24rem] overflow-y-auto bg-white dark:bg-zinc-950">
          {displayedWords.map(({ entry, originalIndex: i }) => {
            const isEnabled = entry.enabled !== false;
            if (selecting) {
              return (
                <div
                  key={`${entry.word}-${i}`}
                  className={`flex items-center gap-3 px-3 py-2 cursor-pointer ${
                    selected.has(i)
                      ? "bg-red-50 dark:bg-red-950/30"
                      : "hover:bg-gray-50 dark:hover:bg-zinc-900"
                  }`}
                  onClick={() => toggleSelect(i)}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(i)}
                    onChange={() => toggleSelect(i)}
                    className="w-4 h-4 shrink-0 accent-red-600"
                    onClick={(e) => e.stopPropagation()}
                  />
                  <span className="font-mono font-semibold text-sm w-24 shrink-0 text-black dark:text-zinc-100">
                    {entry.word}
                  </span>
                  <span className="flex-1 text-sm text-gray-700 dark:text-zinc-300 truncate">
                    {entry.clue}
                  </span>
                </div>
              );
            }
            return (
              <WordRow
                key={`${entry.word}-${i}`}
                entry={entry}
                isEnabled={isEnabled}
                onToggleEnabled={() => toggleEnabled(i)}
                onUpdateWord={(newWord) => updateWord(i, newWord)}
                onUpdateClue={(newClue) => updateClue(i, newClue)}
                onRemove={() => removeWord(i)}
              />
            );
          })}
        </div>
      )}

      {words.length === 0 && (
        <p className="text-sm text-gray-700 dark:text-zinc-400 text-center py-8">
          Add words to get started. You'll need enough words to fill the grid.
        </p>
      )}
    </div>
  );
}

interface WordRowProps {
  entry: WordEntry;
  isEnabled: boolean;
  onToggleEnabled: () => void;
  onUpdateWord: (word: string) => string | null; // returns error or null on success
  onUpdateClue: (clue: string) => void;
  onRemove: () => void;
}

function WordRow({
  entry,
  isEnabled,
  onToggleEnabled,
  onUpdateWord,
  onUpdateClue,
  onRemove,
}: WordRowProps) {
  const [editingWord, setEditingWord] = useState(false);
  const [editingClue, setEditingClue] = useState(false);
  const [wordValue, setWordValue] = useState(entry.word);
  const [clueValue, setClueValue] = useState(entry.clue);
  const [wordError, setWordError] = useState<string | null>(null);

  const saveWord = () => {
    const err = onUpdateWord(wordValue);
    if (err) {
      setWordError(err);
      // keep editing
    } else {
      setWordError(null);
      setEditingWord(false);
    }
  };

  const saveClue = () => {
    onUpdateClue(clueValue.trim() || `Clue for ${entry.word}`);
    setEditingClue(false);
  };

  return (
    <div
      className={`flex items-center gap-3 px-3 py-2 group hover:bg-gray-50 dark:hover:bg-zinc-900 ${
        !isEnabled ? "opacity-50" : ""
      }`}
    >
      <button
        onClick={onToggleEnabled}
        className={`shrink-0 w-4 h-4 rounded border transition-colors ${
          isEnabled
            ? "bg-green-500 border-green-500 dark:bg-green-600 dark:border-green-600"
            : "bg-transparent border-gray-300 dark:border-zinc-600 hover:border-gray-500 dark:hover:border-zinc-400"
        }`}
        aria-label={isEnabled ? `Disable ${entry.word}` : `Enable ${entry.word}`}
        title={isEnabled ? "Click to exclude from generation" : "Click to include in generation"}
      >
        {isEnabled && (
          <svg
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="none"
            stroke="white"
            strokeWidth="3"
            className="m-auto"
          >
            <polyline points="3,8 7,12 13,4" />
          </svg>
        )}
      </button>

      <div className="w-28 shrink-0">
        {editingWord ? (
          <div className="flex flex-col gap-0.5">
            <input
              type="text"
              value={wordValue}
              onChange={(e) => {
                setWordValue(e.target.value);
                setWordError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveWord();
                if (e.key === "Escape") {
                  setWordValue(entry.word);
                  setEditingWord(false);
                  setWordError(null);
                }
              }}
              onBlur={saveWord}
              autoFocus
              className="w-full font-mono font-semibold text-sm px-1.5 py-0.5 border border-blue-500 rounded bg-white dark:bg-zinc-950 text-black dark:text-zinc-100 uppercase focus:outline-none"
            />
            {wordError && (
              <span className="text-[10px] text-red-600 dark:text-red-400">
                {wordError}
              </span>
            )}
          </div>
        ) : (
          <button
            onClick={() => {
              setWordValue(entry.word);
              setEditingWord(true);
            }}
            className="font-mono font-semibold text-sm text-black dark:text-zinc-100 hover:text-blue-600 dark:hover:text-blue-400 cursor-text text-left w-full"
            title="Click to edit"
          >
            {entry.word}
          </button>
        )}
      </div>

      {editingClue ? (
        <input
          type="text"
          value={clueValue}
          onChange={(e) => setClueValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") saveClue();
            if (e.key === "Escape") {
              setClueValue(entry.clue);
              setEditingClue(false);
            }
          }}
          onBlur={saveClue}
          autoFocus
          className="flex-1 text-sm px-1.5 py-0.5 border border-blue-500 rounded bg-white dark:bg-zinc-950 text-black dark:text-zinc-100 focus:outline-none min-w-0"
        />
      ) : (
        <button
          onClick={() => {
            setClueValue(entry.clue);
            setEditingClue(true);
          }}
          className="flex-1 text-sm text-gray-700 dark:text-zinc-300 hover:text-black dark:hover:text-zinc-100 cursor-text text-left truncate min-w-0 px-1 py-0.5"
          title="Click to edit"
        >
          {entry.clue}
        </button>
      )}

      <button
        onClick={onRemove}
        className="text-gray-500 dark:text-zinc-500 hover:text-red-500 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
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
  );
}
