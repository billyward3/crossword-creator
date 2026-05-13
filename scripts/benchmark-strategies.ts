/**
 * Benchmark the four freeform strategies across several wordlist profiles.
 *
 * Run via: npx tsx scripts/benchmark-strategies.ts
 *
 * Outputs JSON to stdout that can be copy-pasted into src/lib/strategy-info.ts
 * as the `benchmarks` field on each strategy.
 */

import { readFileSync } from "fs";
import {
  solveFreeformMultiple,
  type FreeformStrategy,
  type FreeformResult,
} from "../src/engine/freeform";
import type { WordEntry } from "../src/engine/types";

// Load the bundled crossword dictionary so adjacency-aware can validate
// perpendicular completions against real words.
function loadDict(): WordEntry[] {
  const raw = readFileSync("./public/dictionary.json", "utf-8");
  const pairs: [string, number][] = JSON.parse(raw);
  return pairs
    .filter(([w, s]) => w.length >= 3 && w.length <= 8 && s >= 60)
    .map(([word]) => ({ word, clue: "" }));
}
const DICT = loadDict();

const STRATEGIES: FreeformStrategy[] = [
  "adjacency-aware",
  "adjacency-seeded",
  "graph-guided",
  "longest-first",
  "balanced",
];

// ─── Wordlist scenarios ───

// Personal/themed list: short, low letter overlap (typical user input)
const THEMED = [
  "SFPD",
  "EULER",
  "SNORE",
  "ENOKI",
  "IDS",
  "SUNNI",
  "FLOODS",
  "PERKS",
  "DREI",
];

// Medium English vocabulary with high letter overlap
const MEDIUM = [
  "OCEAN", "CANOE", "CRANE", "DANCE", "ACORN", "CORAL", "LEMON", "MELON",
  "MOTEL", "TOWEL", "STONE", "NOTES", "ONSET", "GHOST", "TIGER", "REIGN",
  "GRILL", "LIGHT", "NIGHT", "THING", "PIANO", "PAINT", "TRAIN", "GRAIN",
  "PLANT", "APPLE", "MAPLE", "FLAME", "REALM", "CREAM", "BREAD", "DREAM",
  "STARE", "TEARS", "EARTH", "HEART", "STORM", "ROAST", "COAST", "STAMP",
];

// Larger mixed-length list
const LARGE = [
  "ACE", "ARC", "AWE", "BAT", "CUP", "DEN", "ELF", "FIG", "GEM", "HOP",
  "ICE", "INK", "JAM", "JOG", "NAP", "NET", "OAK", "OWL", "PEA", "RUG",
  "SKI", "SPA", "TAN", "VET", "WEB", "ZEN", "ARCH", "BARK", "BELL",
  "BONE", "CAPE", "CAVE", "CLUE", "COAL", "CONE", "DART", "DAWN", "DEER",
  "DOCK", "DOME", "DRUM", "ECHO", "FERN", "FOAM", "FORK", "GATE", "GLOW",
  "GOLD", "HARP", "HAZE", "HERB", "HIKE", "HOOK", "IRON", "JADE", "KELP",
  "KITE", "LAVA", "LEAF", "LIME", "LION", "MARE", "MAZE", "MINT", "MOAT",
  "MOTH", "NEST", "OPAL", "ORCA", "PALM", "PEAK", "PIER", "PINE", "PLUM",
  "POLE", "POND", "RAFT", "REED", "REEF", "ROBE", "SAGE", "SAIL", "SEAL",
  "SEED", "SILK", "SLED", "SOAP", "STEM", "SURF", "SWAN", "TALE", "TIDE",
  "TOAD", "TOMB", "TREK", "TUNA", "TWIG", "VEIL", "VINE", "WADE", "WAND",
  "WICK", "WING", "ACORN", "AMBER", "BLAZE", "BRINE", "CEDAR", "CHARM",
  "CLIFF", "CORAL", "CRANE", "CRUST", "DRIFT", "EMBER", "FEAST", "FLINT",
  "FROST", "GLEAM", "GOURD", "GRAPE", "HAVEN", "IVORY", "JEWEL", "KAYAK",
  "LATCH", "LEDGE", "MARSH", "MIRTH", "NOBLE", "OCEAN", "OLIVE", "ORBIT",
  "PEARL", "PLAZA", "PRISM", "QUILL", "RAVEN", "RIDGE", "SCARF", "SIREN",
  "SLATE", "SOLAR", "SPICE", "SPINE", "STARE", "STEAM", "STONE", "SWAMP",
  "THORN", "TIGER", "TORCH", "TROUT", "TULIP", "VAULT", "WHEAT",
];

const SCENARIOS = [
  { name: "themed-small", description: "9 themed words (typical user input)", words: THEMED },
  { name: "vocab-medium", description: "40 common 5-letter words", words: MEDIUM },
  { name: "mixed-large", description: "150 mixed-length common words", words: LARGE },
];

// ─── Metrics ───

interface RunMetric {
  bestIntersections: number;
  bestPlaced: number;
  avgIntersections: number;
  avgPlaced: number;
  compactness: number; // best result's (rows × cols) / placed words, lower = denser
  twoLetterFrags: number; // 2-letter runs in best grid not covered by any placed word
  fillWords: number; // dictionary fill words in best grid
  elapsedMs: number;
}

/**
 * Count 2-letter contiguous runs in the grid that aren't part of any
 * placed word in that direction. These are the unfilled fragments left
 * behind by parallel placements.
 */
function countTwoLetterFragments(result: FreeformResult): number {
  const { grid, placed, rows, cols } = result;
  // Build coverage sets
  const coveredAcross = new Set<string>();
  const coveredDown = new Set<string>();
  for (const pw of placed) {
    const dr = pw.direction === "down" ? 1 : 0;
    const dc = pw.direction === "across" ? 1 : 0;
    for (let i = 0; i < pw.word.length; i++) {
      const key = `${pw.row + i * dr},${pw.col + i * dc}`;
      if (pw.direction === "across") coveredAcross.add(key);
      else coveredDown.add(key);
    }
  }

  let count = 0;

  // Across runs
  for (let r = 0; r < rows; r++) {
    let runStart = -1;
    let runLen = 0;
    for (let c = 0; c <= cols; c++) {
      const ch = c < cols ? grid[r][c] : "#";
      if (ch !== "#") {
        if (runStart === -1) runStart = c;
        runLen++;
      } else {
        if (runLen === 2) {
          const allCovered = coveredAcross.has(`${r},${runStart}`) && coveredAcross.has(`${r},${runStart + 1}`);
          if (!allCovered) count++;
        }
        runStart = -1;
        runLen = 0;
      }
    }
  }

  // Down runs
  for (let c = 0; c < cols; c++) {
    let runStart = -1;
    let runLen = 0;
    for (let r = 0; r <= rows; r++) {
      const ch = r < rows ? grid[r][c] : "#";
      if (ch !== "#") {
        if (runStart === -1) runStart = r;
        runLen++;
      } else {
        if (runLen === 2) {
          const allCovered = coveredDown.has(`${runStart},${c}`) && coveredDown.has(`${runStart + 1},${c}`);
          if (!allCovered) count++;
        }
        runStart = -1;
        runLen = 0;
      }
    }
  }

  return count;
}

function evaluateStrategy(
  strategy: FreeformStrategy,
  wordList: string[],
  iters: number = 3,
): RunMetric {
  const entries = wordList.map((w) => ({ word: w, clue: "" }));
  let totalIntersections = 0;
  let totalPlaced = 0;
  let bestIntersections = 0;
  let bestPlaced = 0;
  let bestCompactness = Infinity;
  let bestTwoLetterFrags = Infinity;
  let bestFillWords = 0;
  const start = performance.now();

  for (let i = 0; i < iters; i++) {
    const extra = strategy.startsWith("adjacency") ? DICT : undefined;
    const results = solveFreeformMultiple(entries, 4, 16, strategy, undefined, extra);
    if (results.length === 0) continue;
    let runIntersections = 0;
    let runPlaced = 0;
    for (const r of results) {
      runIntersections += r.intersections;
      runPlaced += r.placed.length;
    }
    runIntersections /= results.length;
    runPlaced /= results.length;
    totalIntersections += runIntersections;
    totalPlaced += runPlaced;

    const best = results[0];
    if (best.intersections > bestIntersections) {
      bestIntersections = best.intersections;
      bestTwoLetterFrags = countTwoLetterFragments(best);
      bestFillWords = best.placed.filter((p) => p.isFill).length;
    }
    if (best.placed.length > bestPlaced) bestPlaced = best.placed.length;
    const compact = (best.rows * best.cols) / best.placed.length;
    if (compact < bestCompactness) bestCompactness = compact;
  }

  return {
    bestIntersections,
    bestPlaced,
    avgIntersections: +(totalIntersections / iters).toFixed(2),
    avgPlaced: +(totalPlaced / iters).toFixed(2),
    compactness: +bestCompactness.toFixed(2),
    twoLetterFrags: bestTwoLetterFrags === Infinity ? 0 : bestTwoLetterFrags,
    fillWords: bestFillWords,
    elapsedMs: +((performance.now() - start) / iters).toFixed(1),
  };
}

// ─── Main ───

const allResults: Partial<Record<FreeformStrategy, Record<string, RunMetric>>> = {};
for (const s of STRATEGIES) allResults[s] = {};

for (const scenario of SCENARIOS) {
  for (const strategy of STRATEGIES) {
    allResults[strategy]![scenario.name] = evaluateStrategy(strategy, scenario.words);
  }
}

// Pretty print
console.log("\n=== BENCHMARK RESULTS ===\n");
for (const scenario of SCENARIOS) {
  console.log(`\n--- ${scenario.name}: ${scenario.description} (${scenario.words.length} words) ---`);
  console.log(
    `Strategy                    | Best ×  | Avg ×   | Best Placed | Compactness | 2-Ltr Frags | Fill Words | Time (ms)`,
  );
  console.log(
    `----------------------------|---------|---------|-------------|-------------|-------------|------------|----------`,
  );
  for (const strategy of STRATEGIES) {
    const m = allResults[strategy]![scenario.name];
    console.log(
      `${strategy.padEnd(28)}| ${String(m.bestIntersections).padEnd(8)}| ${String(m.avgIntersections).padEnd(8)}| ${String(m.bestPlaced).padEnd(12)}| ${String(m.compactness).padEnd(12)}| ${String(m.twoLetterFrags).padEnd(12)}| ${String(m.fillWords).padEnd(11)}| ${m.elapsedMs}`,
    );
  }
}

console.log("\n=== JSON (copy into strategy-info.ts) ===\n");
console.log(JSON.stringify(allResults, null, 2));
