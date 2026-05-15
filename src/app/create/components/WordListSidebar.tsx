"use client";

import { useState, useCallback } from "react";
import type { WordEntry } from "@/engine/types";

interface WordListSidebarProps {
  words: WordEntry[];
  onWordsChange: (words: WordEntry[]) => void;
  onRemoveWord: (word: string) => void;
  onUpdateClue: (word: string, clue: string) => void;
}

export function WordListSidebar({
  words,
  onWordsChange,
  onRemoveWord,
  onUpdateClue,
}: WordListSidebarProps) {
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [showImport, setShowImport] = useState(false);
  const [bulkInput, setBulkInput] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const [sortAlpha, setSortAlpha] = useState(false);

  const displayedWords = sortAlpha
    ? [...words]
        .map((entry, originalIndex) => ({ entry, originalIndex }))
        .sort((a, b) => a.entry.word.localeCompare(b.entry.word))
    : words.map((entry, originalIndex) => ({ entry, originalIndex }));

  const toggleSelect = (index: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const deleteSelected = () => {
    onWordsChange(words.filter((_, i) => !selected.has(i)));
    setSelected(new Set());
    setSelecting(false);
  };

  const toggleEnabled = (index: number) => {
    const updated = [...words];
    const cur = updated[index];
    updated[index] = { ...cur, enabled: cur.enabled === false ? true : false };
    onWordsChange(updated);
  };

  const updateWord = (index: number, newWord: string): string | null => {
    const w = newWord.trim().toUpperCase();
    if (!w) return "Empty";
    if (!/^[A-Z]+$/.test(w)) return "A–Z only";
    if (w.length < 3) return "Min 3";
    if (words.some((e, i) => i !== index && e.word.toUpperCase() === w)) {
      return "Duplicate";
    }
    const updated = [...words];
    updated[index] = { ...updated[index], word: w };
    onWordsChange(updated);
    return null;
  };

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
      if (!match) { errors.push(`Can't parse: "${line}"`); continue; }

      const word = match[1].toUpperCase();
      const clue = match[2]?.trim() || `Clue for ${word}`;
      if (word.length < 3) { errors.push(`"${word}" too short`); continue; }
      if (!newWords.some((w) => w.word === word) && !words.some((w) => w.word === word)) {
        newWords.push({ word, clue });
      }
    }

    setImportError(errors.length > 0 ? errors.join("; ") : null);
    if (newWords.length > 0) {
      onWordsChange([...words, ...newWords]);
      setBulkInput("");
      setShowImport(false);
    }
  }, [bulkInput, words, onWordsChange]);

  if (words.length === 0 && !showImport) {
    return (
      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-black dark:text-zinc-100">Your Words (0)</h3>
        <button
          onClick={() => setShowImport(true)}
          className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
        >
          Bulk import
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-black dark:text-zinc-100">
          Your Words ({words.length})
        </h3>
        <div className="flex items-center gap-2">
          {!selecting && !showImport && words.length > 1 && (
            <button
              onClick={() => setSortAlpha(!sortAlpha)}
              className={`text-xs transition-colors ${
                sortAlpha
                  ? "text-blue-600 dark:text-blue-400 font-medium"
                  : "text-gray-700 dark:text-zinc-400 hover:text-black dark:hover:text-zinc-100"
              }`}
              title={sortAlpha ? "Showing alphabetical order" : "Showing original order"}
            >
              {sortAlpha ? "A→Z ✓" : "A→Z"}
            </button>
          )}
          {!selecting && !showImport && words.length > 0 && (
            <>
              <button
                onClick={() => setShowImport(true)}
                className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
              >
                Import
              </button>
              <button
                onClick={() => setSelecting(true)}
                className="text-xs text-gray-700 dark:text-zinc-400 hover:text-red-600 dark:hover:text-red-400"
              >
                Select
              </button>
              <button
                onClick={() => onWordsChange([])}
                className="text-xs text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
              >
                Clear
              </button>
            </>
          )}
        </div>
      </div>

      {/* Bulk import */}
      {showImport && (
        <div className="flex flex-col gap-2">
          {importError && (
            <p className="text-xs text-red-600 dark:text-red-400">{importError}</p>
          )}
          <textarea
            value={bulkInput}
            onChange={(e) => setBulkInput(e.target.value)}
            placeholder={"WORD - clue\nWORD - clue"}
            className="w-full h-28 px-2 py-1.5 border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-black dark:text-zinc-100 placeholder:text-gray-400 dark:placeholder:text-zinc-500 rounded text-xs font-mono resize-y focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => { setShowImport(false); setBulkInput(""); setImportError(null); }}
              className="px-2 py-1 border border-gray-300 dark:border-zinc-700 text-black dark:text-zinc-100 rounded text-xs hover:bg-gray-100 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              onClick={parseBulk}
              className="px-2 py-1 bg-black dark:bg-zinc-100 text-white dark:text-zinc-900 rounded text-xs hover:bg-gray-800 dark:hover:bg-zinc-300"
            >
              Import
            </button>
          </div>
        </div>
      )}

      {/* Select toolbar */}
      {selecting && (
        <div className="flex items-center gap-2 text-xs">
          <span className="text-black dark:text-zinc-100 font-medium">{selected.size} sel.</span>
          <button
            onClick={() => setSelected(new Set(words.map((_, i) => i)))}
            className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
          >
            All
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
          >
            None
          </button>
          <div className="flex-1" />
          <button
            onClick={deleteSelected}
            disabled={selected.size === 0}
            className="px-2 py-0.5 bg-red-600 text-white rounded text-xs hover:bg-red-700 disabled:opacity-30"
          >
            Delete
          </button>
          <button
            onClick={() => { setSelecting(false); setSelected(new Set()); }}
            className="px-2 py-0.5 border border-gray-300 dark:border-zinc-700 text-black dark:text-zinc-100 rounded text-xs hover:bg-gray-100 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Word list */}
      {words.length > 0 && (
        <div className="border border-gray-200 dark:border-zinc-800 rounded-lg divide-y divide-gray-200 dark:divide-zinc-800 max-h-[70vh] overflow-y-auto bg-white dark:bg-zinc-950">
          {displayedWords.map(({ entry, originalIndex: i }) => (
            selecting ? (
              <div
                key={`${entry.word}-${i}`}
                className={`flex items-center gap-1.5 px-2 py-1.5 cursor-pointer ${
                  selected.has(i) ? "bg-red-50 dark:bg-red-950/30" : "hover:bg-gray-50 dark:hover:bg-zinc-900"
                }`}
                onClick={() => toggleSelect(i)}
              >
                <input
                  type="checkbox"
                  checked={selected.has(i)}
                  onChange={() => toggleSelect(i)}
                  className="w-3.5 h-3.5 shrink-0 accent-red-600"
                  onClick={(e) => e.stopPropagation()}
                />
                <span className="font-mono font-semibold text-xs text-black dark:text-zinc-100 shrink-0">
                  {entry.word}
                </span>
                <span className="text-xs text-gray-600 dark:text-zinc-400 truncate flex-1 min-w-0">
                  {entry.clue}
                </span>
              </div>
            ) : (
              <WordRow
                key={`${entry.word}-${i}`}
                entry={entry}
                isEnabled={entry.enabled !== false}
                onToggleEnabled={() => toggleEnabled(i)}
                onUpdateWord={(newWord) => updateWord(i, newWord)}
                onRemove={() => onRemoveWord(entry.word)}
                onUpdateClue={(clue) => onUpdateClue(entry.word, clue)}
              />
            )
          ))}
        </div>
      )}
    </div>
  );
}

function WordRow({
  entry,
  isEnabled,
  onToggleEnabled,
  onUpdateWord,
  onUpdateClue,
  onRemove,
}: {
  entry: WordEntry;
  isEnabled: boolean;
  onToggleEnabled: () => void;
  onUpdateWord: (word: string) => string | null;
  onUpdateClue: (clue: string) => void;
  onRemove: () => void;
}) {
  const [editingWord, setEditingWord] = useState(false);
  const [editingClue, setEditingClue] = useState(false);
  const [wordValue, setWordValue] = useState(entry.word);
  const [clueValue, setClueValue] = useState(entry.clue);
  const [wordError, setWordError] = useState<string | null>(null);

  const saveWord = () => {
    const err = onUpdateWord(wordValue);
    if (err) {
      setWordError(err);
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
      className={`flex items-center gap-1.5 px-2 py-1.5 group hover:bg-gray-50 dark:hover:bg-zinc-900 ${
        !isEnabled ? "opacity-50" : ""
      }`}
    >
      <button
        onClick={onToggleEnabled}
        className={`shrink-0 w-3.5 h-3.5 rounded border transition-colors ${
          isEnabled
            ? "bg-green-500 border-green-500 dark:bg-green-600 dark:border-green-600"
            : "bg-transparent border-gray-300 dark:border-zinc-600 hover:border-gray-500 dark:hover:border-zinc-400"
        }`}
        aria-label={isEnabled ? `Disable ${entry.word}` : `Enable ${entry.word}`}
        title={isEnabled ? "Click to exclude from generation" : "Click to include in generation"}
      >
        {isEnabled && (
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="white" strokeWidth="3" className="m-auto">
            <polyline points="3,8 7,12 13,4" />
          </svg>
        )}
      </button>

      {editingWord ? (
        <div className="flex flex-col gap-0.5 shrink-0">
          <input
            type="text"
            value={wordValue}
            onChange={(e) => { setWordValue(e.target.value); setWordError(null); }}
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
            className="w-20 text-xs px-1 py-0.5 border border-blue-500 rounded bg-white dark:bg-zinc-950 text-black dark:text-zinc-100 font-mono uppercase focus:outline-none"
          />
          {wordError && <span className="text-[9px] text-red-600 dark:text-red-400">{wordError}</span>}
        </div>
      ) : (
        <button
          onClick={() => { setWordValue(entry.word); setEditingWord(true); }}
          className="font-mono font-semibold text-xs text-black dark:text-zinc-100 hover:text-blue-600 dark:hover:text-blue-400 cursor-text shrink-0 text-left"
          title="Click to edit"
        >
          {entry.word}
        </button>
      )}

      {editingClue ? (
        <input
          type="text"
          value={clueValue}
          onChange={(e) => setClueValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") saveClue();
            if (e.key === "Escape") { setClueValue(entry.clue); setEditingClue(false); }
          }}
          onBlur={saveClue}
          autoFocus
          className="flex-1 text-xs px-1 py-0.5 border border-blue-500 rounded bg-white dark:bg-zinc-950 text-black dark:text-zinc-100 focus:outline-none min-w-0"
        />
      ) : (
        <button
          onClick={() => { setClueValue(entry.clue); setEditingClue(true); }}
          className="text-xs text-gray-600 dark:text-zinc-400 truncate flex-1 cursor-text hover:text-black dark:hover:text-zinc-100 min-w-0 text-left"
          title={`${entry.clue} (click to edit)`}
        >
          {entry.clue}
        </button>
      )}

      <button
        onClick={onRemove}
        className="text-gray-400 dark:text-zinc-500 hover:text-red-500 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
        aria-label={`Remove ${entry.word}`}
      >
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5">
          <line x1="4" y1="4" x2="12" y2="12" />
          <line x1="12" y1="4" x2="4" y2="12" />
        </svg>
      </button>
    </div>
  );
}
