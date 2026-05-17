/**
 * Evaluate one or more wordlists on the freeform engine.
 *
 * For each list, runs every freeform strategy with N attempts and reports
 * the best result's: placement rate, intersection count, compactness, frags,
 * fill words, and elapsed time. Useful for tuning a demo-ready wordlist.
 *
 * Usage:
 *   npx tsx scripts/eval-wordlist.ts wordlists/mixed-50-3to12.txt
 *   npx tsx scripts/eval-wordlist.ts wordlists/foo.txt wordlists/bar.txt
 */

import { readFileSync } from "fs";
import { basename } from "path";
import {
  solveFreeformMultiple,
  type FreeformStrategy,
  type FreeformResult,
} from "../src/engine/freeform";
import type { WordEntry } from "../src/engine/types";

const STRATEGIES: FreeformStrategy[] = [
  "adjacency-aware",
  "adjacency-seeded",
  "graph-guided",
  "longest-first",
  "balanced",
];

const ATTEMPTS = 16;
const TARGET_LENGTH_RANGE = [3, 8] as const;

function loadDict(): WordEntry[] {
  const raw = readFileSync("./public/dictionary.json", "utf-8");
  const pairs: [string, number][] = JSON.parse(raw);
  return pairs
    .filter(
      ([w, s]) =>
        w.length >= TARGET_LENGTH_RANGE[0] &&
        w.length <= TARGET_LENGTH_RANGE[1] &&
        s >= 60
    )
    .map(([word]) => ({ word, clue: "" }));
}

function loadList(path: string): WordEntry[] {
  return readFileSync(path, "utf-8")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"))
    .map((line) => {
      const word = line.split(/\s|-/, 1)[0].toUpperCase();
      return { word, clue: "" };
    });
}

function countTwoLetterFrags(grid: string[][], placed: { word: string; row: number; col: number; direction: "across" | "down" }[]) {
  // Cover all cells that belong to any placed word
  const covered = new Set<string>();
  for (const p of placed) {
    for (let i = 0; i < p.word.length; i++) {
      const r = p.direction === "down" ? p.row + i : p.row;
      const c = p.direction === "across" ? p.col + i : p.col;
      covered.add(`${r},${c}:${p.direction}`);
    }
  }
  // Scan for 2-cell runs in each direction that aren't fully covered as part of a placed word
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  let frags = 0;
  for (let r = 0; r < rows; r++) {
    let runStart = -1;
    for (let c = 0; c <= cols; c++) {
      const filled = c < cols && grid[r][c] !== "" && grid[r][c] !== "#";
      if (filled && runStart === -1) runStart = c;
      if ((!filled || c === cols) && runStart !== -1) {
        const len = c - runStart;
        if (len === 2) {
          // Check this run isn't part of a placed across word
          let coveredByAcross = false;
          for (const p of placed) {
            if (p.direction === "across" && p.row === r && p.col <= runStart && p.col + p.word.length >= runStart + len) {
              coveredByAcross = true;
              break;
            }
          }
          if (!coveredByAcross) frags++;
        }
        runStart = -1;
      }
    }
  }
  for (let c = 0; c < cols; c++) {
    let runStart = -1;
    for (let r = 0; r <= rows; r++) {
      const filled = r < rows && grid[r]?.[c] !== "" && grid[r]?.[c] !== "#";
      if (filled && runStart === -1) runStart = r;
      if ((!filled || r === rows) && runStart !== -1) {
        const len = r - runStart;
        if (len === 2) {
          let coveredByDown = false;
          for (const p of placed) {
            if (p.direction === "down" && p.col === c && p.row <= runStart && p.row + p.word.length >= runStart + len) {
              coveredByDown = true;
              break;
            }
          }
          if (!coveredByDown) frags++;
        }
        runStart = -1;
      }
    }
  }
  return frags;
}

function buildGrid(rows: number, cols: number, placed: { word: string; row: number; col: number; direction: "across" | "down" }[]) {
  const g = Array.from({ length: rows }, () => Array.from({ length: cols }, () => ""));
  for (const p of placed) {
    for (let i = 0; i < p.word.length; i++) {
      const r = p.direction === "down" ? p.row + i : p.row;
      const c = p.direction === "across" ? p.col + i : p.col;
      g[r][c] = p.word[i];
    }
  }
  return g;
}

function score(result: FreeformResult | null, totalWords: number) {
  if (!result) {
    return { placed: 0, placementRate: 0, intersections: 0, compactness: Infinity, frags: 0, fills: 0, area: 0 };
  }
  const userPlaced = result.placed.filter((p) => !p.isFill);
  const fillPlaced = result.placed.filter((p) => p.isFill);
  const placed = userPlaced.length;
  const placementRate = placed / totalWords;
  const area = result.rows * result.cols;
  const compactness = area / (userPlaced.length + fillPlaced.length || 1);

  const grid = buildGrid(result.rows, result.cols, result.placed);
  const frags = countTwoLetterFrags(grid, result.placed);

  return {
    placed,
    placementRate,
    intersections: result.intersections ?? 0,
    compactness: Number(compactness.toFixed(2)),
    frags,
    fills: fillPlaced.length,
    area,
  };
}

async function evalList(path: string, dict: WordEntry[]) {
  const list = loadList(path);
  const wordSet = list.map((e) => e.word);
  const lengths = wordSet.map((w) => w.length);
  const avgLen = (lengths.reduce((a, b) => a + b, 0) / lengths.length).toFixed(1);

  console.log(`\n=== ${basename(path)} (${list.length} words, avg len ${avgLen}, range ${Math.min(...lengths)}-${Math.max(...lengths)}) ===`);
  console.log("Sample:", wordSet.slice(0, 8).join(", "), "...");

  for (const strategy of STRATEGIES) {
    const start = performance.now();
    const extra = strategy.startsWith("adjacency") ? dict : undefined;
    const results = solveFreeformMultiple(list, 1, ATTEMPTS, strategy, undefined, extra);
    const elapsed = performance.now() - start;
    const best = results[0] ?? null;
    const s = score(best, list.length);
    console.log(
      `  ${strategy.padEnd(18)} placed=${String(s.placed).padStart(3)}/${list.length} (${(s.placementRate * 100).toFixed(0)}%)  inter=${String(s.intersections).padStart(3)}  area=${String(s.area).padStart(4)}  compact=${s.compactness.toString().padStart(6)}  frags=${String(s.frags).padStart(2)}  fills=${String(s.fills).padStart(2)}  ${elapsed.toFixed(0)}ms`
    );
  }
}

async function main() {
  const paths = process.argv.slice(2);
  if (paths.length === 0) {
    console.error("Usage: npx tsx scripts/eval-wordlist.ts <wordlist.txt> [more.txt ...]");
    process.exit(1);
  }
  const dict = loadDict();
  console.log(`Dictionary: ${dict.length} words (length ${TARGET_LENGTH_RANGE[0]}-${TARGET_LENGTH_RANGE[1]}, score >= 60)`);
  for (const path of paths) {
    await evalList(path, dict);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
