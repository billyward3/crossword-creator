"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import type { WordEntry } from "@/engine/types";
import {
  solveFreeformMultiple,
  type FreeformResult,
  type FreeformStrategy,
  FREEFORM_STRATEGIES,
} from "@/engine/freeform";
import { buildBlock, blockResultToFreeform } from "@/engine/block-builder";
import { STRATEGY_DETAILS } from "@/lib/strategy-info";
import {
  loadDictionary,
  dictionaryToWordEntries,
} from "@/engine/dictionary";

type GenerationMode = FreeformStrategy | "block-builder";
import { useRouter } from "next/navigation";
import { WordlistInput } from "./components/WordlistInput";
import { WordListSidebar } from "./components/WordListSidebar";
import { FreeformPreview } from "./components/FreeformPreview";
import { EditorReturnLink } from "@/components/EditorReturnLink";

type CreatorStep = "input" | "generating" | "results";

const STORAGE_KEY_WORDS = "crossword-creator-words";
const STORAGE_KEY_STRATEGY = "crossword-creator-strategy";
const STORAGE_KEY_MAX_WORDS = "crossword-creator-max-words";
const STORAGE_KEY_EDITOR = "crossword-editor-state";

const GRID_SIZE_PROMPTS: { label: string; size: string }[] = [
  { label: "5×5", size: "5x5" },
  { label: "15×15", size: "15x15" },
  { label: "21×21", size: "21x21" },
];

export default function CreatePage() {
  const [words, setWords] = useState<WordEntry[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [step, setStep] = useState<CreatorStep>("input");
  const [strategy, setStrategy] = useState<GenerationMode>("graph-guided");
  const [freeformResults, setFreeformResults] = useState<FreeformResult[]>([]);
  const [selectedFreeform, setSelectedFreeform] = useState<number | null>(null);
  const [maxWords, setMaxWords] = useState<number | null>(null); // null = no limit
  const [dictionaryWords, setDictionaryWords] = useState<WordEntry[]>([]);
  const [dictionaryLoading, setDictionaryLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    try {
      const storedWords = localStorage.getItem(STORAGE_KEY_WORDS);
      if (storedWords) setWords(JSON.parse(storedWords));

      // URL query param can override the default strategy (e.g. from strategy pages)
      const params = new URLSearchParams(window.location.search);
      const queryStrategy = params.get("strategy");
      if (queryStrategy && queryStrategy in STRATEGY_DETAILS) {
        setStrategy(queryStrategy as FreeformStrategy);
      }

      const storedMax = localStorage.getItem(STORAGE_KEY_MAX_WORDS);
      if (storedMax) {
        const parsed = JSON.parse(storedMax);
        setMaxWords(parsed === null ? null : Number(parsed));
      }
    } catch {}
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem(STORAGE_KEY_MAX_WORDS, JSON.stringify(maxWords));
  }, [maxWords, hydrated]);

  useEffect(() => {
    if (hydrated) localStorage.setItem(STORAGE_KEY_WORDS, JSON.stringify(words));
  }, [words, hydrated]);

  // Strategy is not persisted. It always defaults to graph-guided unless
  // overridden by a ?strategy= query param.

  // Eagerly load the dictionary on mount. It's used by the adjacency-aware
  // strategy to validate perpendicular completions; loading it up front
  // ensures the first generation has access to it without a race.
  useEffect(() => {
    if (dictionaryWords.length > 0 || dictionaryLoading) return;
    setDictionaryLoading(true);
    loadDictionary()
      .then((dict) => {
        setDictionaryWords(dictionaryToWordEntries(dict));
        setDictionaryLoading(false);
      })
      .catch(() => setDictionaryLoading(false));
    // Only fire once on mount; the guard above prevents duplicate loads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dictionaryReady = dictionaryWords.length > 0;
  const needsDict =
    (strategy.startsWith("adjacency") || strategy === "block-builder") &&
    !dictionaryReady;

  // Words actually used by the solver: enabled-only, capped to maxWords
  const eligibleWords = words.filter((w) => w.enabled !== false);
  // Regenerate using freshly-passed inputs (no closure on parent state),
  // so callers like the slider can pass the just-committed cap directly.
  // The cap is passed to the solver as `maxPlaced`. The solver still sees the
  // full word list and chooses the best subset of `cap` words, instead of us
  // pre-slicing and locking it into a fixed prefix.
  const runFreeformWith = useCallback(
    (s: GenerationMode, cap: number | null) => {
      const enabled = words.filter((w) => w.enabled !== false);

      if (s === "block-builder") {
        const maxPlaced =
          cap !== null && cap < enabled.length ? cap : undefined;
        // Filter dictionary to crossword-friendly lengths (3-7) to avoid
        // compound junk like LIGHTRED. The general dictionary is already
        // filtered to score >= 60, but we drop the longer entries that
        // tend to be brand names and compounds.
        const blockDict = dictionaryWords.filter(
          (e) => e.word.length >= 3 && e.word.length <= 7
        );
        const result = buildBlock({
          entries: enabled,
          dictionary: blockDict,
          scaffoldStrategy: "adjacency-aware",
          padding: 1,
          maxPlaced,
        });
        if (result) {
          const converted = blockResultToFreeform(result, enabled);
          setFreeformResults([converted]);
          setSelectedFreeform(0);
        } else {
          setFreeformResults([]);
          setSelectedFreeform(null);
        }
        return;
      }

      const maxPlaced = cap !== null && cap < enabled.length ? cap : undefined;
      const extraValid =
        s.startsWith("adjacency") ? dictionaryWords : undefined;
      const results = solveFreeformMultiple(
        enabled,
        6,
        20,
        s,
        maxPlaced,
        extraValid,
      );
      setFreeformResults(results);
      setSelectedFreeform(results.length > 0 ? 0 : null);
    },
    [words, dictionaryWords]
  );

  const runFreeform = useCallback(
    (s: GenerationMode) => runFreeformWith(s, maxWords),
    [runFreeformWith, maxWords]
  );

  // Track whether we've already re-run because the dictionary finished loading,
  // so we don't trigger an infinite loop.
  const hasRerunForDictRef = useRef(false);

  // If the dictionary finishes loading while results are already on screen
  // and adjacency-aware is the active strategy, re-run once with the dictionary.
  useEffect(() => {
    if (!dictionaryReady) {
      hasRerunForDictRef.current = false;
      return;
    }
    if (
      (strategy.startsWith("adjacency") || strategy === "block-builder") &&
      step === "results" &&
      !hasRerunForDictRef.current
    ) {
      hasRerunForDictRef.current = true;
      runFreeform(strategy);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strategy, step, dictionaryReady]);

  const handleGenerate = useCallback(() => {
    if (eligibleWords.length < 2) {
      setError("Enable at least 2 words to generate a puzzle");
      return;
    }

    setError(null);
    setStep("generating");
    setFreeformResults([]);
    setSelectedFreeform(null);

    setTimeout(() => {
      try {
        runFreeform(strategy);
        setStep("results");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Generation failed");
        setStep("input");
      }
    }, 50);
  }, [eligibleWords.length, strategy, runFreeform]);

  const handleStrategyChange = useCallback(
    (newStrategy: GenerationMode) => {
      setStrategy(newStrategy);
      if (step === "results") {
        runFreeform(newStrategy);
      }
    },
    [step, runFreeform]
  );

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
      setWords(words.map((w) => (w.word === word ? { ...w, clue } : w)));
    },
    [words]
  );

  const handleBack = useCallback(() => {
    setStep("input");
    setFreeformResults([]);
    setSelectedFreeform(null);
  }, []);

  const handleContinueToEditor = useCallback(() => {
    if (selectedFreeform === null || !freeformResults[selectedFreeform]) return;
    const result = freeformResults[selectedFreeform];

    // Convert FreeformResult.grid ("#" = empty) to editor grid ("" = empty, "#" = black)
    const editorGrid = result.grid.map((row) =>
      row.map((cell) => (cell === "#" ? "" : cell))
    );

    const userWordList = words
      .filter((w) => w.enabled !== false)
      .map((w) => w.word.toUpperCase());
    const fillWordList = result.placed
      .filter((p) => p.isFill)
      .map((p) => p.word.toUpperCase());

    // Build clue map keyed by "row,col,direction"
    const clues: Record<string, string> = {};
    for (const p of result.placed) {
      clues[`${p.row},${p.col},${p.direction}`] = p.clue || "";
    }

    const editorState = {
      grid: editorGrid,
      clues,
      userWords: userWordList,
      fillWords: fillWordList,
    };

    localStorage.setItem(STORAGE_KEY_EDITOR, JSON.stringify(editorState));
    router.push("/create/edit");
  }, [selectedFreeform, freeformResults, words, router]);

  return (
    <main className="min-h-screen bg-white dark:bg-zinc-950 text-black dark:text-zinc-100">
      <header className="bg-white dark:bg-zinc-950 border-b border-gray-200 dark:border-zinc-800 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between pr-12">
          <a href="/" className="text-xl font-bold text-black dark:text-zinc-100">
            Crossword Creator
          </a>
          <div className="flex items-center gap-5 text-sm">
            <a
              href="/about"
              className="text-gray-700 dark:text-zinc-400 hover:text-black dark:hover:text-zinc-100"
            >
              About
            </a>
            <EditorReturnLink />
            {step !== "input" && (
              <button
                onClick={handleBack}
                className="text-gray-700 dark:text-zinc-400 hover:text-black dark:hover:text-zinc-100"
              >
                &larr; Back to editor
              </button>
            )}
          </div>
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
              <h1 className="text-3xl font-bold text-black dark:text-zinc-100 mb-2">Create a Crossword</h1>
              <p className="text-gray-800 dark:text-zinc-300">
                Add your words and clues, then generate your puzzle. The engine
                will arrange them into the densest crossword it can.
              </p>
            </div>

            <WordlistInput words={words} onWordsChange={setWords} />

            <div className="flex gap-4 flex-wrap items-center">
              <button
                onClick={handleGenerate}
                disabled={eligibleWords.length < 2 || needsDict}
                className="px-8 py-3 bg-black dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-xl font-medium hover:bg-gray-800 dark:hover:bg-zinc-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                Generate Puzzle
              </button>
              {needsDict && (
                <span className="text-sm text-gray-700 dark:text-zinc-400">
                  Loading dictionary…
                </span>
              )}
              <a
                href="/create/guided"
                className="px-8 py-3 border border-gray-300 dark:border-zinc-700 rounded-xl font-medium text-black dark:text-zinc-100 hover:bg-gray-50 dark:hover:bg-zinc-900 transition-colors"
              >
                Guided Builder
              </a>
            </div>
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
            <div className="flex-1 min-w-0 flex flex-col gap-6">
              <div>
                <h1 className="text-3xl font-bold text-black dark:text-zinc-100 mb-2">Your Puzzle</h1>
                <p className="text-gray-800 dark:text-zinc-300">
                  Pick a strategy and choose the layout you like best.
                </p>
              </div>

              {/* Strategy selector buttons */}
              <StrategySelector
                strategy={strategy}
                onChange={handleStrategyChange}
              />

              {/* Max-words slider */}
              <MaxWordsSlider
                eligibleCount={eligibleWords.length}
                value={maxWords}
                onChange={(v) => {
                  setMaxWords(v);
                  // Re-run with the just-committed cap (don't rely on stale runFreeform)
                  runFreeformWith(strategy, v);
                }}
              />

              {/* Want a fixed grid size? Suggest guided builder */}
              <div className="p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 rounded-xl flex flex-col gap-2">
                <p className="text-sm font-semibold text-black dark:text-zinc-100">
                  Want a fixed grid size?
                </p>
                <p className="text-sm text-gray-800 dark:text-zinc-300">
                  Freeform builds the grid around your words. For a standard {" "}
                  {GRID_SIZE_PROMPTS.map((g, i) => (
                    <span key={g.size}>
                      {i > 0 && (i === GRID_SIZE_PROMPTS.length - 1 ? ", or " : ", ")}
                      <span className="font-mono">{g.label}</span>
                    </span>
                  ))}{" "}
                  grid, the guided builder lets you place words on a fixed grid
                  pattern with dictionary-powered fill suggestions.
                </p>
                <a
                  href="/create/guided"
                  className="self-start mt-1 px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-700 dark:hover:bg-blue-400 transition-colors"
                >
                  Open Guided Builder &rarr;
                </a>
              </div>

              <FreeformView
                results={freeformResults}
                selectedIndex={selectedFreeform}
                onSelect={setSelectedFreeform}
                hideUnplaced={maxWords !== null && maxWords < eligibleWords.length}
              />

              {selectedFreeform !== null && freeformResults[selectedFreeform] && (
                <button
                  onClick={handleContinueToEditor}
                  className="self-start px-8 py-3 bg-blue-600 dark:bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-700 dark:hover:bg-blue-400 transition-colors shadow-sm"
                >
                  Continue to Editor &rarr;
                </button>
              )}

              {/* Detailed strategy description with link to full page */}
              <StrategyDetailCard strategy={strategy} />

              <AddWordWidget
                words={words}
                onAddWord={handleAddWord}
                onWordsChange={setWords}
              />

              <button
                onClick={handleGenerate}
                className="self-start px-8 py-3 bg-black dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-xl font-medium hover:bg-gray-800 dark:hover:bg-zinc-300 transition-colors"
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

/* ─── Max Words Slider ─── */

function MaxWordsSlider({
  eligibleCount,
  value,
  onChange,
}: {
  eligibleCount: number;
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  const max = Math.max(eligibleCount, 2);
  const committedSliderValue =
    value === null ? eligibleCount : Math.min(value, max);

  // Local value while dragging. Updates on every input but doesn't trigger regeneration.
  const [draftValue, setDraftValue] = useState(committedSliderValue);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Sync the draft when the committed value changes externally
  useEffect(() => {
    setDraftValue(committedSliderValue);
  }, [committedSliderValue]);

  // Stable ref to the latest commit callback so the listener doesn't get re-attached
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  // Attach a native `change` listener, which fires when the user releases the slider
  // (unlike React's `onChange` which is mapped to the `input` event for range inputs).
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;

    const handleChange = () => {
      const v = Number(el.value);
      onChangeRef.current(v >= eligibleCount ? null : v);
    };

    el.addEventListener("change", handleChange);
    return () => el.removeEventListener("change", handleChange);
  }, [eligibleCount]);

  const isLimited = value !== null && value < eligibleCount;
  const isDirty = draftValue !== committedSliderValue;

  return (
    <div className="flex flex-col gap-2 p-4 bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-black dark:text-zinc-100">
          Word Cap
        </p>
        <span className="text-xs text-gray-700 dark:text-zinc-400">
          {isDirty
            ? `${draftValue} (release to apply)`
            : isLimited
              ? `Using up to ${value} of ${eligibleCount} eligible words`
              : `Using all ${eligibleCount} eligible words`}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <input
          ref={inputRef}
          type="range"
          min={2}
          max={max}
          step={1}
          value={draftValue}
          // React's onChange maps to the `input` event and fires continuously during drag
          onChange={(e) => setDraftValue(Number(e.target.value))}
          className="flex-1 accent-black dark:accent-zinc-100"
          disabled={eligibleCount < 2}
        />
        <span className="font-mono text-sm font-semibold text-black dark:text-zinc-100 w-12 text-right">
          {draftValue}
        </span>
        {isLimited && (
          <button
            onClick={() => onChange(null)}
            className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 shrink-0"
          >
            Use all
          </button>
        )}
      </div>
    </div>
  );
}

/* ─── Strategy Selector ─── */

function StrategySelector({
  strategy,
  onChange,
}: {
  strategy: GenerationMode;
  onChange: (s: GenerationMode) => void;
}) {
  const userListStrategies = FREEFORM_STRATEGIES.filter(
    (s) => !s.id.startsWith("adjacency"),
  );
  const adjacencyStrategies = FREEFORM_STRATEGIES.filter(
    (s) => s.id.startsWith("adjacency"),
  );

  const buttonClass = (id: GenerationMode) =>
    `px-4 py-2 rounded-xl text-sm font-medium transition-all ${
      strategy === id
        ? "bg-black dark:bg-zinc-100 text-white dark:text-zinc-900 shadow-md"
        : "bg-gray-100 dark:bg-zinc-900 text-black dark:text-zinc-100 hover:bg-gray-200 dark:hover:bg-zinc-800 border border-gray-200 dark:border-zinc-800"
    }`;

  return (
    <div className="flex flex-col gap-3">
      {/* User-list-only strategies */}
      <div>
        <p className="text-xs font-semibold text-gray-700 dark:text-zinc-400 uppercase tracking-wide mb-1.5">
          Your words only
        </p>
        <div className="flex gap-2 flex-wrap">
          {userListStrategies.map((s) => (
            <button
              key={s.id}
              onClick={() => onChange(s.id)}
              className={buttonClass(s.id)}
            >
              {s.name}
            </button>
          ))}
        </div>
      </div>

      {/* Adjacency variants (all use the dictionary) */}
      <div>
        <p className="text-xs font-semibold text-gray-700 dark:text-zinc-400 uppercase tracking-wide mb-1.5">
          Uses dictionary fill
        </p>
        <div className="flex gap-2 flex-wrap">
          {adjacencyStrategies.map((s) => (
            <button
              key={s.id}
              onClick={() => onChange(s.id)}
              className={buttonClass(s.id)}
            >
              {s.name}
            </button>
          ))}
        </div>
      </div>

      {/* Block builder (newspaper-style) */}
      <div>
        <p className="text-xs font-semibold text-gray-700 dark:text-zinc-400 uppercase tracking-wide mb-1.5">
          Newspaper-style
        </p>
        <div className="flex gap-2 flex-wrap items-center">
          <button
            onClick={() => onChange("block-builder")}
            className={buttonClass("block-builder")}
          >
            Block Builder
          </button>
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
            Work in Progress
          </span>
        </div>
        {strategy === "block-builder" && (
          <div className="mt-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 flex flex-col gap-2 text-xs text-gray-800 dark:text-zinc-300">
            <p>
              <span className="font-semibold text-black dark:text-zinc-100">
                Proof of concept.
              </span>{" "}
              Builds a dense newspaper-style grid with black squares and
              dictionary fill. Your words are scaffolded first, then the grid
              is carved into blocks and the empty slots are filled.
            </p>
            <p className="font-semibold text-black dark:text-zinc-100 mt-1">
              Known challenges:
            </p>
            <ul className="list-disc list-inside flex flex-col gap-1">
              <li>
                <span className="font-semibold">Fill quality:</span> the
                dictionary contains compound words and obscure entries
                (LIGHTRED, ERSATZ). Higher-quality fills require a curated
                word list.
              </li>
              <li>
                <span className="font-semibold">Solver completeness:</span>{" "}
                full backtracking can't always find a complete solution on
                dense grids. The best-effort fallback may leave a handful of
                non-dictionary letter sequences.
              </li>
              <li>
                <span className="font-semibold">Stray cells:</span> a user
                word placed near the grid edge may end up with one direction
                only 1 letter long. The scaffold doesn't yet score for edge
                spacing.
              </li>
              <li>
                <span className="font-semibold">Cap behavior:</span> the
                word cap limits scaffold placements; total puzzle words
                (user + dictionary fill) is typically 3-5× that number.
              </li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Strategy Detail Card ─── */

function StrategyDetailCard({ strategy }: { strategy: GenerationMode }) {
  if (strategy === "block-builder") return null;
  const details = STRATEGY_DETAILS[strategy as import("@/lib/strategy-info").UIStrategy];
  if (!details) return null;

  return (
    <div className="border border-gray-200 dark:border-zinc-800 rounded-xl p-6 flex flex-col gap-4 bg-gray-50/50 dark:bg-zinc-900/50">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex flex-col gap-1">
          <p className="text-xs font-mono text-gray-600 dark:text-zinc-400 uppercase tracking-wider">
            Active Strategy
          </p>
          <h3 className="text-xl font-bold text-black dark:text-zinc-100">{details.name}</h3>
        </div>
        <a
          href={`/about/strategies/${details.id}`}
          className="px-4 py-2 border border-gray-300 dark:border-zinc-700 rounded-lg text-sm font-medium text-black dark:text-zinc-100 hover:bg-white dark:hover:bg-zinc-800 transition-colors"
        >
          Full breakdown &rarr;
        </a>
      </div>

      <div className="flex flex-col gap-3">
        {details.summary.map((p, i) => (
          <p key={i} className="text-sm text-gray-800 dark:text-zinc-300 leading-relaxed">
            {p}
          </p>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
        <div>
          <p className="text-xs font-semibold text-black dark:text-zinc-100 mb-1.5 uppercase tracking-wide">
            Strengths
          </p>
          <ul className="text-xs text-gray-700 dark:text-zinc-400 flex flex-col gap-1">
            {details.strengths.slice(0, 3).map((s, i) => (
              <li key={i} className="flex gap-1.5">
                <span className="text-green-700 dark:text-green-400 shrink-0">✓</span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-xs font-semibold text-black dark:text-zinc-100 mb-1.5 uppercase tracking-wide">
            Weaknesses
          </p>
          <ul className="text-xs text-gray-700 dark:text-zinc-400 flex flex-col gap-1">
            {details.weaknesses.slice(0, 3).map((w, i) => (
              <li key={i} className="flex gap-1.5">
                <span className="text-amber-700 dark:text-amber-400 shrink-0">!</span>
                <span>{w}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

/* ─── Freeform results view ─── */

function FreeformView({
  results,
  selectedIndex,
  onSelect,
  hideUnplaced,
}: {
  results: FreeformResult[];
  selectedIndex: number | null;
  onSelect: (i: number) => void;
  hideUnplaced?: boolean;
}) {
  if (results.length === 0) {
    return (
      <div className="p-5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-xl text-sm text-gray-800 dark:text-zinc-300">
        Couldn't create a crossword &mdash; your words don't share enough letters
        to intersect. Try adding words with common letters (A, E, R, S, T).
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
                  ? "bg-gray-800 dark:bg-zinc-200 text-white dark:text-zinc-900 shadow-sm"
                  : "bg-gray-50 dark:bg-zinc-900 text-black dark:text-zinc-100 hover:bg-gray-100 dark:hover:bg-zinc-800 border border-gray-200 dark:border-zinc-800"
              }`}
            >
              Layout {i + 1}
              <span className={`ml-2 text-xs ${selectedIndex === i ? "text-gray-400 dark:text-zinc-500" : "text-gray-600 dark:text-zinc-400"}`}>
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
          hideUnplaced={hideUnplaced}
        />
      )}
    </>
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
    if (!w) {
      setError("Enter a word");
      return;
    }
    if (!/^[A-Z]+$/.test(w)) {
      setError("Words can only contain letters A–Z");
      return;
    }
    if (w.length < 3) {
      setError("Words must be at least 3 letters");
      return;
    }
    if (words.some((e) => e.word.toUpperCase() === w)) {
      setError("This word is already in your list");
      return;
    }
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
      const match =
        line.match(/^([A-Za-z]+)\s*[-:,\t]\s*(.*)$/) ||
        line.match(/^([A-Za-z]+)$/);
      if (!match) {
        errors.push(`Couldn't parse: "${line}"`);
        continue;
      }
      const w = match[1].toUpperCase();
      const c = match[2]?.trim() || `Clue for ${w}`;
      if (w.length < 3) {
        errors.push(`"${w}" is too short (min 3 letters)`);
        continue;
      }
      if (
        !newWords.some((nw) => nw.word === w) &&
        !words.some((ew) => ew.word === w)
      ) {
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
    <div className="p-5 bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-black dark:text-zinc-100 font-semibold">Add Words</p>
        <button
          onClick={() => {
            setMode(mode === "single" ? "bulk" : "single");
            setError(null);
          }}
          className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium"
        >
          {mode === "single" ? "Bulk import" : "Single entry"}
        </button>
      </div>

      {error && (
        <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 px-3 py-1.5 rounded-lg">{error}</p>
      )}

      {mode === "single" ? (
        <div className="flex gap-2">
          <input
            type="text"
            value={word}
            onChange={(e) => setWord(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder="Word"
            className="w-36 px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-lg text-sm font-mono uppercase bg-white dark:bg-zinc-950 text-black dark:text-zinc-100 placeholder:text-gray-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <input
            type="text"
            value={clue}
            onChange={(e) => setClue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder="Clue (optional)"
            className="flex-1 px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-lg text-sm bg-white dark:bg-zinc-950 text-black dark:text-zinc-100 placeholder:text-gray-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            onClick={handleAdd}
            className="px-4 py-2 bg-black dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg text-sm font-medium hover:bg-gray-800 dark:hover:bg-zinc-300 transition-colors"
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
            className="w-full h-32 px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-lg font-mono text-sm resize-y bg-white dark:bg-zinc-950 text-black dark:text-zinc-100 placeholder:text-gray-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            onClick={handleBulkImport}
            disabled={!bulkInput.trim()}
            className="self-end px-4 py-2 bg-black dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg text-sm font-medium hover:bg-gray-800 dark:hover:bg-zinc-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Import Words
          </button>
        </div>
      )}
    </div>
  );
}
