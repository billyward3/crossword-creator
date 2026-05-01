"use client";

import { useState, useCallback, useEffect } from "react";
import type { WordEntry } from "@/engine/types";
import { solveFreeformMultiple, type FreeformResult } from "@/engine/freeform";
import { WordlistInput } from "./components/WordlistInput";
import { WordListSidebar } from "./components/WordListSidebar";
import { FreeformPreview } from "./components/FreeformPreview";

type CreatorStep = "input" | "generating" | "results";

const STORAGE_KEY_WORDS = "crossword-creator-words";

export default function CreatePage() {
  const [words, setWords] = useState<WordEntry[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [step, setStep] = useState<CreatorStep>("input");
  const [freeformResults, setFreeformResults] = useState<FreeformResult[]>([]);
  const [selectedResult, setSelectedResult] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load from localStorage after hydration
  useEffect(() => {
    try {
      const storedWords = localStorage.getItem(STORAGE_KEY_WORDS);
      if (storedWords) setWords(JSON.parse(storedWords));
    } catch {}
    setHydrated(true);
  }, []);

  // Persist words to localStorage
  useEffect(() => {
    if (hydrated) localStorage.setItem(STORAGE_KEY_WORDS, JSON.stringify(words));
  }, [words, hydrated]);

  const handleGenerate = useCallback(() => {
    if (words.length < 2) {
      setError("Add at least 2 words to generate a puzzle");
      return;
    }

    setError(null);
    setStep("generating");
    setFreeformResults([]);
    setSelectedResult(null);

    setTimeout(() => {
      try {
        const results = solveFreeformMultiple(words, 6, 20);

        if (results.length === 0) {
          setError(
            "Couldn't create a crossword — your words don't share enough letters to intersect. Try adding words with common letters."
          );
          setStep("input");
          return;
        }

        setFreeformResults(results);
        setSelectedResult(0);
        setStep("results");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Generation failed");
        setStep("input");
      }
    }, 50);
  }, [words]);

  const handleAddWord = useCallback(
    (entry: WordEntry) => {
      if (!words.some((w) => w.word === entry.word)) {
        setWords([...words, entry]);
      }
    },
    [words]
  );

  const handleRemoveWord = useCallback(
    (word: string) => {
      setWords(words.filter((w) => w.word !== word));
    },
    [words]
  );

  const handleUpdateClue = useCallback(
    (word: string, clue: string) => {
      setWords(words.map((w) => w.word === word ? { ...w, clue } : w));
    },
    [words]
  );

  const handleBack = useCallback(() => {
    setStep("input");
    setFreeformResults([]);
    setSelectedResult(null);
  }, []);

  return (
    <main className="min-h-screen bg-white text-black">
      <header className="bg-white border-b px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <a href="/" className="text-xl font-bold text-black">
            Crossword Creator
          </a>
          {step !== "input" && (
            <button
              onClick={handleBack}
              className="text-sm text-gray-700 hover:text-black"
            >
              &larr; Back to editor
            </button>
          )}
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {step === "input" && (
          <div className="flex flex-col gap-8 max-w-3xl">
            <div>
              <h1 className="text-3xl font-bold text-black mb-2">Create a Crossword</h1>
              <p className="text-gray-800">
                Add your words and clues, then generate your puzzle. The engine
                will arrange them into the densest crossword it can.
              </p>
            </div>

            <WordlistInput words={words} onWordsChange={setWords} />

            <button
              onClick={handleGenerate}
              disabled={words.length < 2}
              className="self-start px-8 py-3 bg-black text-white rounded-lg font-medium hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              Generate Puzzle
            </button>
          </div>
        )}

        {step === "generating" && (
          <div className="flex flex-col items-center justify-center gap-6 py-20">
            <div className="w-10 h-10 border-4 border-gray-200 border-t-black rounded-full animate-spin" />
            <p className="text-lg font-medium">Generating layouts...</p>
          </div>
        )}

        {step === "results" && (
          <div className="flex gap-8">
            <div className="flex-1 flex flex-col gap-8">
              <div>
                <h1 className="text-3xl font-bold text-black mb-2">
                  {freeformResults.length} Layout{freeformResults.length !== 1 ? "s" : ""} Generated
                </h1>
                <p className="text-gray-800">
                  Pick the layout you like best. Each arranges your words differently.
                </p>
              </div>

              {/* Layout selector tabs */}
              {freeformResults.length > 1 && (
                <div className="flex gap-2 flex-wrap">
                  {freeformResults.map((result, i) => (
                    <button
                      key={i}
                      onClick={() => setSelectedResult(i)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        selectedResult === i
                          ? "bg-black text-white"
                          : "bg-gray-100 text-black hover:bg-gray-200"
                      }`}
                    >
                      Layout {i + 1}
                      <span className="ml-1.5 text-xs opacity-70">
                        {result.placed.length} words &middot; {result.intersections} crosses
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* Selected layout preview */}
              {selectedResult !== null && freeformResults[selectedResult] && (
                <FreeformPreview
                  result={freeformResults[selectedResult]}
                  cellSize={freeformResults[selectedResult].cols <= 10 ? 40 : 28}
                />
              )}

              {/* Add more words */}
              <AddWordWidget
                words={words}
                onAddWord={handleAddWord}
              />

              <button
                onClick={handleGenerate}
                className="self-start px-6 py-3 bg-black text-white rounded-lg font-medium hover:bg-gray-800 transition-colors"
              >
                Re-generate
              </button>
            </div>

            {/* Word list sidebar */}
            <div className="hidden lg:block w-56 shrink-0">
              <div className="sticky top-6">
                <WordListSidebar
                  words={words}
                  onRemoveWord={handleRemoveWord}
                  onUpdateClue={handleUpdateClue}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function AddWordWidget({
  words,
  onAddWord,
}: {
  words: WordEntry[];
  onAddWord: (entry: WordEntry) => void;
}) {
  const [word, setWord] = useState("");
  const [clue, setClue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleAdd = () => {
    const w = word.trim().toUpperCase();
    if (!w) { setError("Enter a word"); return; }
    if (!/^[A-Z]+$/.test(w)) { setError("Letters only"); return; }
    if (w.length < 3) { setError("Min 3 letters"); return; }
    if (words.some((e) => e.word.toUpperCase() === w)) { setError("Already in list"); return; }
    onAddWord({ word: w, clue: clue.trim() || `Clue for ${w}` });
    setWord("");
    setClue("");
    setError(null);
  };

  return (
    <div className="p-4 bg-gray-50 border rounded-lg flex flex-col gap-2">
      <p className="text-sm text-black font-medium">Add more words to improve your puzzle</p>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <input
          type="text"
          value={word}
          onChange={(e) => setWord(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          placeholder="Word"
          className="w-36 px-2 py-1.5 border rounded text-sm font-mono uppercase bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <input
          type="text"
          value={clue}
          onChange={(e) => setClue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          placeholder="Clue"
          className="flex-1 px-2 py-1.5 border rounded text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={handleAdd}
          className="px-3 py-1.5 bg-black text-white rounded text-sm hover:bg-gray-800"
        >
          Add
        </button>
      </div>
    </div>
  );
}
