"use client";

import { useState, useCallback, useEffect } from "react";
import type { WordEntry, SolverResult, GridModel, SlotFeasibility } from "@/engine/types";
import type { WordNeededSuggestion } from "@/engine/suggestions";
import { solveFreeformMultiple, type FreeformResult } from "@/engine/freeform";
import { gridFromPattern, extractSlots } from "@/engine/grid";
import { buildWordIndex } from "@/engine/wordindex";
import { solve } from "@/engine/solver";
import { analyzeSuggestions } from "@/engine/suggestions";
import { getTemplatesForSize } from "@/engine/templates";
import { WordlistInput } from "./components/WordlistInput";
import { WordListSidebar } from "./components/WordListSidebar";
import { FreeformPreview } from "./components/FreeformPreview";
import { CrosswordGrid } from "@/components/CrosswordGrid";
import { GapVisualization } from "./components/GapVisualization";
import { SuggestionPanel } from "./components/SuggestionPanel";

type CreatorStep = "input" | "generating" | "results";
type GridMode = "freeform" | "5x5" | "15x15" | "21x21";

const GRID_MODES: { mode: GridMode; label: string; rows: number; cols: number }[] = [
  { mode: "freeform", label: "Freeform", rows: 0, cols: 0 },
  { mode: "5x5", label: "5\u00d75", rows: 5, cols: 5 },
  { mode: "15x15", label: "15\u00d715", rows: 15, cols: 15 },
  { mode: "21x21", label: "21\u00d721", rows: 21, cols: 21 },
];

const STORAGE_KEY_WORDS = "crossword-creator-words";

interface TemplateResult {
  solutions: SolverResult[];
  suggestions: WordNeededSuggestion[];
  feasibility: SlotFeasibility[];
  grid: GridModel | null;
  shortage: { length: number; needed: number; have: number }[] | null;
}

export default function CreatePage() {
  const [words, setWords] = useState<WordEntry[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [step, setStep] = useState<CreatorStep>("input");
  const [gridMode, setGridMode] = useState<GridMode>("freeform");
  const [freeformResults, setFreeformResults] = useState<FreeformResult[]>([]);
  const [selectedFreeform, setSelectedFreeform] = useState<number | null>(null);
  const [templateResult, setTemplateResult] = useState<TemplateResult | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const storedWords = localStorage.getItem(STORAGE_KEY_WORDS);
      if (storedWords) setWords(JSON.parse(storedWords));
    } catch {}
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem(STORAGE_KEY_WORDS, JSON.stringify(words));
  }, [words, hydrated]);

  const runFreeform = useCallback(() => {
    const results = solveFreeformMultiple(words, 6, 20);
    setFreeformResults(results);
    setSelectedFreeform(results.length > 0 ? 0 : null);
  }, [words]);

  const runTemplate = useCallback((rows: number, cols: number) => {
    const templates = getTemplatesForSize(rows, cols);
    if (templates.length === 0) {
      setTemplateResult({ solutions: [], suggestions: [], feasibility: [], grid: null, shortage: null });
      return;
    }

    const wordIndex = buildWordIndex(words);
    const allSolutions: SolverResult[] = [];

    for (const template of templates) {
      const grid = gridFromPattern(template.pattern);
      for (let seed = 0; seed < 4; seed++) {
        const results = solve(grid, wordIndex, {
          maxSolutions: 1,
          seed: seed * 1000 + Date.now(),
        });
        for (const result of results) {
          const isDuplicate = allSolutions.some((ex) =>
            ex.grid.cells.every((v, i) => v === result.grid.cells[i])
          );
          if (!isDuplicate) allSolutions.push(result);
        }
        if (allSolutions.length >= 6) break;
      }
      if (allSolutions.length >= 6) break;
    }

    if (allSolutions.length > 0) {
      setTemplateResult({ solutions: allSolutions, suggestions: [], feasibility: [], grid: null, shortage: null });
      setSelectedTemplate(0);
      return;
    }

    // No solutions — analyze the first template
    const grid = gridFromPattern(templates[0].pattern);
    const analysis = analyzeSuggestions(grid, wordIndex);
    const slots = extractSlots(grid);

    // Compute shortage
    const slotsPerLength = new Map<number, number>();
    for (const s of slots) slotsPerLength.set(s.length, (slotsPerLength.get(s.length) || 0) + 1);
    const wordsPerLength = new Map<number, number>();
    for (const w of words) {
      const len = w.word.length;
      wordsPerLength.set(len, (wordsPerLength.get(len) || 0) + 1);
    }
    const shortage: { length: number; needed: number; have: number }[] = [];
    for (const [len, needed] of slotsPerLength) {
      const have = wordsPerLength.get(len) || 0;
      if (have < needed) shortage.push({ length: len, needed, have });
    }

    setTemplateResult({
      solutions: [],
      suggestions: analysis.suggestions,
      feasibility: analysis.feasibility,
      grid,
      shortage: shortage.length > 0 ? shortage : null,
    });
    setSelectedTemplate(null);
  }, [words]);

  const handleGenerate = useCallback(() => {
    if (words.length < 2) {
      setError("Add at least 2 words to generate a puzzle");
      return;
    }

    setError(null);
    setStep("generating");
    setFreeformResults([]);
    setSelectedFreeform(null);
    setTemplateResult(null);
    setSelectedTemplate(null);
    setGridMode("freeform");

    setTimeout(() => {
      try {
        runFreeform();
        setStep("results");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Generation failed");
        setStep("input");
      }
    }, 50);
  }, [words, runFreeform]);

  const handleModeChange = useCallback((mode: GridMode) => {
    setGridMode(mode);
    if (mode === "freeform") {
      if (freeformResults.length === 0) runFreeform();
    } else {
      const cfg = GRID_MODES.find((m) => m.mode === mode)!;
      setTemplateResult(null);
      setSelectedTemplate(null);
      setTimeout(() => runTemplate(cfg.rows, cfg.cols), 10);
    }
  }, [freeformResults, runFreeform, runTemplate]);

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
    setSelectedFreeform(null);
    setTemplateResult(null);
    setSelectedTemplate(null);
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
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
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
              className="self-start px-8 py-3 bg-black text-white rounded-xl font-medium hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
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
          <div className="flex flex-col lg:flex-row gap-8">
            <div className="flex-1 min-w-0 flex flex-col gap-8">
              <div>
                <h1 className="text-3xl font-bold text-black mb-2">Your Puzzle</h1>
                <p className="text-gray-800">
                  Choose a layout mode and pick the arrangement you like best.
                </p>
              </div>

              {/* Grid mode selector */}
              <div className="flex gap-2 flex-wrap">
                {GRID_MODES.map(({ mode, label }) => (
                  <button
                    key={mode}
                    onClick={() => handleModeChange(mode)}
                    className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      gridMode === mode
                        ? "bg-black text-white shadow-md"
                        : "bg-gray-100 text-black hover:bg-gray-200 border border-gray-200"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Freeform mode */}
              {gridMode === "freeform" && (
                <FreeformView
                  results={freeformResults}
                  selectedIndex={selectedFreeform}
                  onSelect={setSelectedFreeform}
                />
              )}

              {/* Template mode */}
              {gridMode !== "freeform" && (
                <TemplateView
                  result={templateResult}
                  selectedIndex={selectedTemplate}
                  onSelect={setSelectedTemplate}
                  words={words}
                  onAddWord={handleAddWord}
                  onRemoveWord={handleRemoveWord}
                  modeName={GRID_MODES.find((m) => m.mode === gridMode)!.label}
                />
              )}

              {/* Add more words */}
              <AddWordWidget
                words={words}
                onAddWord={handleAddWord}
                onWordsChange={setWords}
              />

              <button
                onClick={handleGenerate}
                className="self-start px-8 py-3 bg-black text-white rounded-xl font-medium hover:bg-gray-800 transition-colors"
              >
                Re-generate
              </button>
            </div>

            <div className="w-full lg:w-56 shrink-0">
              <div className="lg:sticky lg:top-6">
                <WordListSidebar
                  words={words}
                  onWordsChange={setWords}
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

/* ─── Freeform results view ─── */

function FreeformView({
  results,
  selectedIndex,
  onSelect,
}: {
  results: FreeformResult[];
  selectedIndex: number | null;
  onSelect: (i: number) => void;
}) {
  if (results.length === 0) {
    return (
      <div className="p-5 bg-amber-50 border border-amber-200 rounded-xl text-sm text-gray-800">
        Couldn't create a crossword &mdash; your words don't share enough letters to intersect.
        Try adding words with common letters (A, E, R, S, T).
      </div>
    );
  }

  return (
    <>
      {results.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {results.map((result, i) => (
            <button
              key={i}
              onClick={() => onSelect(i)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                selectedIndex === i
                  ? "bg-gray-800 text-white shadow-sm"
                  : "bg-gray-50 text-black hover:bg-gray-100 border border-gray-200"
              }`}
            >
              Layout {i + 1}
              <span className={`ml-2 text-xs ${selectedIndex === i ? "text-gray-400" : "text-gray-600"}`}>
                {result.placed.length} words &middot; {result.intersections} crosses
              </span>
            </button>
          ))}
        </div>
      )}

      {selectedIndex !== null && results[selectedIndex] && (
        <FreeformPreview
          result={results[selectedIndex]}
          cellSize={results[selectedIndex].cols <= 10 ? 40 : 28}
        />
      )}
    </>
  );
}

/* ─── Template results view ─── */

function TemplateView({
  result,
  selectedIndex,
  onSelect,
  words,
  onAddWord,
  onRemoveWord,
  modeName,
}: {
  result: TemplateResult | null;
  selectedIndex: number | null;
  onSelect: (i: number) => void;
  words: WordEntry[];
  onAddWord: (entry: WordEntry) => void;
  onRemoveWord: (word: string) => void;
  modeName: string;
}) {
  if (!result) {
    return (
      <div className="flex items-center gap-3 py-8">
        <div className="w-6 h-6 border-3 border-gray-200 border-t-black rounded-full animate-spin" />
        <span className="text-sm text-gray-700">Solving {modeName} grid...</span>
      </div>
    );
  }

  // Solutions found
  if (result.solutions.length > 0) {
    return (
      <>
        <p className="text-sm text-gray-800">
          Found {result.solutions.length} solution{result.solutions.length !== 1 ? "s" : ""} for {modeName}.
        </p>

        {result.solutions.length > 1 && (
          <div className="flex gap-2 flex-wrap">
            {result.solutions.map((_, i) => (
              <button
                key={i}
                onClick={() => onSelect(i)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  selectedIndex === i
                    ? "bg-gray-800 text-white shadow-sm"
                    : "bg-gray-50 text-black hover:bg-gray-100 border border-gray-200"
                }`}
              >
                Solution {i + 1}
              </button>
            ))}
          </div>
        )}

        {selectedIndex !== null && result.solutions[selectedIndex] && (
          <div className="flex flex-col items-center gap-3">
            <CrosswordGrid
              grid={result.solutions[selectedIndex].grid}
              cellSize={result.solutions[selectedIndex].grid.cols <= 5 ? 48 : 32}
            />
          </div>
        )}
      </>
    );
  }

  // No solutions — show analysis
  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-gray-800">
        Couldn't fill a {modeName} grid with your current words.
      </p>

      {/* Shortage info */}
      {result.shortage && result.shortage.length > 0 && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm">
          <p className="text-black font-semibold mb-2">You need more words for {modeName}:</p>
          <ul className="flex flex-col gap-1">
            {result.shortage.map(({ length, needed, have }) => (
              <li key={length} className="text-gray-800">
                <strong>{length}-letter words:</strong> you have {have}, need at least {needed}
                {" "}&mdash; add {needed - have} more
              </li>
            ))}
          </ul>
        </div>
      )}

      {!result.shortage && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm">
          <p className="text-black font-semibold mb-1">Almost there!</p>
          <p className="text-gray-800">
            You have enough words of each length, but the solver couldn't find an
            arrangement where all crossing letters match. Try adding more words to
            give the solver more options.
          </p>
        </div>
      )}

      {/* Gap visualization */}
      {result.grid && result.feasibility.length > 0 && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-gray-800">
            Green slots can be filled. Red slots need words you haven't added yet.
          </p>
          <GapVisualization
            grid={result.grid}
            feasibility={result.feasibility}
            cellSize={result.grid.cols <= 5 ? 44 : 24}
          />
        </div>
      )}

      {/* Slot-specific suggestions */}
      {result.suggestions.length > 0 && (
        <SuggestionPanel
          suggestions={result.suggestions}
          onAddWord={onAddWord}
          onRemoveWord={onRemoveWord}
        />
      )}
    </div>
  );
}

/* ─── Add word widget ─── */

function AddWordWidget({
  words,
  onAddWord,
  onWordsChange,
}: {
  words: WordEntry[];
  onAddWord: (entry: WordEntry) => void;
  onWordsChange: (words: WordEntry[]) => void;
}) {
  const [word, setWord] = useState("");
  const [clue, setClue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"single" | "bulk">("single");
  const [bulkInput, setBulkInput] = useState("");

  const handleAdd = () => {
    const w = word.trim().toUpperCase();
    if (!w) { setError("Enter a word"); return; }
    if (!/^[A-Z]+$/.test(w)) { setError("Words can only contain letters A\u2013Z"); return; }
    if (w.length < 3) { setError("Words must be at least 3 letters"); return; }
    if (words.some((e) => e.word.toUpperCase() === w)) { setError("This word is already in your list"); return; }
    onAddWord({ word: w, clue: clue.trim() || `Clue for ${w}` });
    setWord("");
    setClue("");
    setError(null);
  };

  const handleBulkImport = () => {
    const lines = bulkInput
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const newWords: WordEntry[] = [];
    const errors: string[] = [];

    for (const line of lines) {
      const match = line.match(/^([A-Za-z]+)\s*[-:,\t]\s*(.*)$/) ||
                    line.match(/^([A-Za-z]+)$/);
      if (!match) { errors.push(`Couldn't parse: "${line}"`); continue; }
      const w = match[1].toUpperCase();
      const c = match[2]?.trim() || `Clue for ${w}`;
      if (w.length < 3) { errors.push(`"${w}" is too short (min 3 letters)`); continue; }
      if (!newWords.some((nw) => nw.word === w) && !words.some((ew) => ew.word === w)) {
        newWords.push({ word: w, clue: c });
      }
    }

    setError(errors.length > 0 ? errors.join("; ") : null);
    if (newWords.length > 0) {
      onWordsChange([...words, ...newWords]);
      setBulkInput("");
      setMode("single");
    }
  };

  return (
    <div className="p-5 bg-gray-50 border border-gray-200 rounded-xl flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-black font-semibold">Add Words</p>
        <button
          onClick={() => { setMode(mode === "single" ? "bulk" : "single"); setError(null); }}
          className="text-xs text-blue-600 hover:text-blue-800 font-medium"
        >
          {mode === "single" ? "Bulk import" : "Single entry"}
        </button>
      </div>

      {error && (
        <p className="text-xs text-red-600 bg-red-50 px-3 py-1.5 rounded-lg">{error}</p>
      )}

      {mode === "single" ? (
        <div className="flex gap-2">
          <input
            type="text"
            value={word}
            onChange={(e) => setWord(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder="Word"
            className="w-36 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono uppercase bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <input
            type="text"
            value={clue}
            onChange={(e) => setClue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder="Clue (optional)"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            onClick={handleAdd}
            className="px-4 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
          >
            Add
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <textarea
            value={bulkInput}
            onChange={(e) => setBulkInput(e.target.value)}
            placeholder={"WORD - clue\nWORD - clue\nor just one word per line"}
            className="w-full h-32 px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm resize-y bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            onClick={handleBulkImport}
            disabled={!bulkInput.trim()}
            className="self-end px-4 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Import Words
          </button>
        </div>
      )}
    </div>
  );
}
