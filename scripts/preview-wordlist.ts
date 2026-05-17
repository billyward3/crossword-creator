/**
 * Print the best adjacency-aware grid for a given wordlist.
 * Used to eyeball whether a candidate example wordlist looks good.
 *
 * Usage: npx tsx scripts/preview-wordlist.ts wordlists/example-coastal.txt
 */

import { readFileSync } from "fs";
import { solveFreeformMultiple } from "../src/engine/freeform";
import type { WordEntry } from "../src/engine/types";

function loadDict(): WordEntry[] {
  const raw = readFileSync("./public/dictionary.json", "utf-8");
  const pairs: [string, number][] = JSON.parse(raw);
  return pairs
    .filter(([w, s]) => w.length >= 3 && w.length <= 8 && s >= 60)
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

const path = process.argv[2];
if (!path) {
  console.error("Usage: npx tsx scripts/preview-wordlist.ts <wordlist.txt>");
  process.exit(1);
}

const list = loadList(path);
const dict = loadDict();
const results = solveFreeformMultiple(list, 1, 16, "adjacency-aware", undefined, dict);
const best = results[0];

if (!best) {
  console.log("No solution.");
  process.exit(0);
}

const grid: string[][] = Array.from({ length: best.rows }, () =>
  Array.from({ length: best.cols }, () => ".")
);

for (const p of best.placed) {
  for (let i = 0; i < p.word.length; i++) {
    const r = p.direction === "down" ? p.row + i : p.row;
    const c = p.direction === "across" ? p.col + i : p.col;
    grid[r][c] = p.word[i];
  }
}

console.log(`${best.rows}x${best.cols}, ${best.placed.length} placed, ${best.intersections ?? "?"} intersections\n`);
for (const row of grid) {
  console.log("  " + row.map((c) => (c === "." ? "·" : c)).join(" "));
}
console.log("\nUser words:", best.placed.filter((p) => !p.isFill).map((p) => p.word).join(", "));
console.log("Fill words:", best.placed.filter((p) => p.isFill).map((p) => p.word).join(", "));
