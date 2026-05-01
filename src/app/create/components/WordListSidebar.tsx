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
        <h3 className="text-sm font-semibold text-black">Your Words (0)</h3>
        <button
          onClick={() => setShowImport(true)}
          className="text-sm text-blue-600 hover:text-blue-800"
        >
          Bulk import
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-black">
          Your Words ({words.length})
        </h3>
        <div className="flex items-center gap-2">
          {!selecting && !showImport && words.length > 0 && (
            <>
              <button
                onClick={() => setShowImport(true)}
                className="text-xs text-blue-600 hover:text-blue-800"
              >
                Import
              </button>
              <button
                onClick={() => setSelecting(true)}
                className="text-xs text-gray-700 hover:text-red-600"
              >
                Select
              </button>
              <button
                onClick={() => onWordsChange([])}
                className="text-xs text-red-600 hover:text-red-800"
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
            <p className="text-xs text-red-600">{importError}</p>
          )}
          <textarea
            value={bulkInput}
            onChange={(e) => setBulkInput(e.target.value)}
            placeholder={"WORD - clue\nWORD - clue"}
            className="w-full h-28 px-2 py-1.5 border rounded text-xs font-mono resize-y focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => { setShowImport(false); setBulkInput(""); setImportError(null); }}
              className="px-2 py-1 border rounded text-xs hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              onClick={parseBulk}
              className="px-2 py-1 bg-black text-white rounded text-xs hover:bg-gray-800"
            >
              Import
            </button>
          </div>
        </div>
      )}

      {/* Select toolbar */}
      {selecting && (
        <div className="flex items-center gap-2 text-xs">
          <span className="text-black font-medium">{selected.size} sel.</span>
          <button
            onClick={() => setSelected(new Set(words.map((_, i) => i)))}
            className="text-blue-600 hover:text-blue-800"
          >
            All
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="text-blue-600 hover:text-blue-800"
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
            className="px-2 py-0.5 border rounded text-xs hover:bg-gray-100"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Word list */}
      {words.length > 0 && (
        <div className="border rounded-lg divide-y max-h-[70vh] overflow-y-auto bg-white">
          {words.map((entry, i) => (
            selecting ? (
              <div
                key={`${entry.word}-${i}`}
                className={`flex items-center gap-1.5 px-2 py-1.5 cursor-pointer ${
                  selected.has(i) ? "bg-red-50" : "hover:bg-gray-50"
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
                <span className="font-mono font-semibold text-xs text-black shrink-0">
                  {entry.word}
                </span>
                <span className="text-xs text-gray-600 truncate flex-1 min-w-0">
                  {entry.clue}
                </span>
              </div>
            ) : (
              <WordRow
                key={`${entry.word}-${i}`}
                entry={entry}
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
  onRemove,
  onUpdateClue,
}: {
  entry: WordEntry;
  onRemove: () => void;
  onUpdateClue: (clue: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [clueValue, setClueValue] = useState(entry.clue);

  const handleSave = () => {
    onUpdateClue(clueValue.trim() || `Clue for ${entry.word}`);
    setEditing(false);
  };

  return (
    <div className="flex items-center gap-1.5 px-2 py-1.5 group hover:bg-gray-50">
      <span className="font-mono font-semibold text-xs text-black shrink-0">
        {entry.word}
      </span>
      {editing ? (
        <input
          type="text"
          value={clueValue}
          onChange={(e) => setClueValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
            if (e.key === "Escape") { setClueValue(entry.clue); setEditing(false); }
          }}
          onBlur={handleSave}
          autoFocus
          className="flex-1 text-xs px-1 py-0.5 border rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 min-w-0"
        />
      ) : (
        <span
          className="text-xs text-gray-600 truncate flex-1 cursor-pointer hover:text-black min-w-0"
          onClick={() => setEditing(true)}
          title={`${entry.clue} (click to edit)`}
        >
          {entry.clue}
        </span>
      )}
      <button
        onClick={onRemove}
        className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
        aria-label={`Remove ${entry.word}`}
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
        >
          <line x1="4" y1="4" x2="12" y2="12" />
          <line x1="12" y1="4" x2="4" y2="12" />
        </svg>
      </button>
    </div>
  );
}
