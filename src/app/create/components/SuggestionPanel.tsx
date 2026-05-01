"use client";

import { useState, useCallback } from "react";
import type { WordEntry } from "@/engine/types";
import type { WordNeededSuggestion } from "@/engine/suggestions";

interface SuggestionPanelProps {
  suggestions: WordNeededSuggestion[];
  onAddWord: (entry: WordEntry) => void;
  onRemoveWord: (word: string) => void;
}

export function SuggestionPanel({
  suggestions,
  onAddWord,
  onRemoveWord,
}: SuggestionPanelProps) {
  if (suggestions.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold text-black">Words Needed</h2>
      <p className="text-sm text-gray-700">
        The generator couldn't fill some slots with your current word list.
        Add words matching these patterns to improve your puzzle.
      </p>
      <div className="flex flex-col gap-2">
        {suggestions.map((suggestion) => (
          <SuggestionCard
            key={suggestion.slotId}
            suggestion={suggestion}
            onAddWord={onAddWord}
            onRemoveWord={onRemoveWord}
          />
        ))}
      </div>
    </div>
  );
}

function SuggestionCard({
  suggestion,
  onAddWord,
  onRemoveWord,
}: {
  suggestion: WordNeededSuggestion;
  onAddWord: (entry: WordEntry) => void;
  onRemoveWord: (word: string) => void;
}) {
  const [word, setWord] = useState("");
  const [clue, setClue] = useState("");
  const [addedWord, setAddedWord] = useState<string | null>(null);

  const handleAdd = useCallback(() => {
    const w = word.trim().toUpperCase();
    if (!w || w.length !== suggestion.length) return;

    for (const [pos, letter] of suggestion.constraints) {
      if (w[pos] !== letter.toUpperCase()) return;
    }

    onAddWord({ word: w, clue: clue.trim() || `Clue for ${w}` });
    setAddedWord(w);
  }, [word, clue, suggestion, onAddWord]);

  const handleUndo = useCallback(() => {
    if (!addedWord) return;
    onRemoveWord(addedWord);
    setAddedWord(null);
  }, [addedWord, onRemoveWord]);

  const isValid = (() => {
    if (addedWord) return false;
    const w = word.trim().toUpperCase();
    if (w.length !== suggestion.length) return false;
    if (!/^[A-Z]+$/.test(w)) return false;
    for (const [pos, letter] of suggestion.constraints) {
      if (w[pos] !== letter.toUpperCase()) return false;
    }
    return true;
  })();

  const isAdded = addedWord !== null;

  return (
    <div
      className={`p-3 rounded-lg border transition-colors ${
        isAdded
          ? "border-green-400 bg-green-50"
          : suggestion.urgency === "blocking"
            ? "border-amber-300 bg-amber-50"
            : "border-gray-200 bg-gray-50"
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="font-mono font-bold text-lg tracking-widest text-black">
          {isAdded ? addedWord : suggestion.pattern}
        </span>
        <span className="text-xs text-gray-600">
          {suggestion.length} letters, {suggestion.direction}
        </span>
        {isAdded ? (
          <span className="text-xs bg-green-200 text-green-800 px-1.5 py-0.5 rounded">
            Added
          </span>
        ) : suggestion.urgency === "blocking" ? (
          <span className="text-xs bg-amber-200 text-amber-800 px-1.5 py-0.5 rounded">
            Blocking
          </span>
        ) : null}
      </div>
      <p className="text-sm text-gray-700 mb-2">
        {isAdded
          ? `"${addedWord}" added to your word list.`
          : suggestion.message}
      </p>
      <div className="flex gap-2">
        <input
          type="text"
          value={word}
          onChange={(e) => setWord(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && isValid && handleAdd()}
          placeholder={suggestion.pattern}
          maxLength={suggestion.length}
          disabled={isAdded}
          className={`w-28 px-2 py-1.5 border rounded text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            isAdded ? "bg-green-100 border-green-300 text-green-800" : ""
          }`}
        />
        <input
          type="text"
          value={clue}
          onChange={(e) => setClue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && isValid && handleAdd()}
          placeholder="Clue"
          disabled={isAdded}
          className={`flex-1 px-2 py-1.5 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            isAdded ? "bg-green-100 border-green-300 text-green-800" : ""
          }`}
        />
        {isAdded ? (
          <button
            onClick={handleUndo}
            className="px-3 py-1.5 bg-white text-red-600 border border-red-300 rounded text-sm hover:bg-red-50"
          >
            Undo
          </button>
        ) : (
          <button
            onClick={handleAdd}
            disabled={!isValid}
            className="px-3 py-1.5 bg-black text-white rounded text-sm hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Add
          </button>
        )}
      </div>
    </div>
  );
}
