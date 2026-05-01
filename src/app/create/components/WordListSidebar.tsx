"use client";

import { useState } from "react";
import type { WordEntry } from "@/engine/types";

interface WordListSidebarProps {
  words: WordEntry[];
  onRemoveWord: (word: string) => void;
  onUpdateClue: (word: string, clue: string) => void;
}

export function WordListSidebar({
  words,
  onRemoveWord,
  onUpdateClue,
}: WordListSidebarProps) {
  if (words.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-black">
        Your Words ({words.length})
      </h3>
      <div className="border rounded-lg divide-y max-h-[70vh] overflow-y-auto bg-white">
        {words.map((entry, i) => (
          <WordRow
            key={`${entry.word}-${i}`}
            entry={entry}
            onRemove={() => onRemoveWord(entry.word)}
            onUpdateClue={(clue) => onUpdateClue(entry.word, clue)}
          />
        ))}
      </div>
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
