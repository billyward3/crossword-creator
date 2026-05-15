/**
 * Quick smoke test for the block-builder algorithm.
 *
 * Run via: npx tsx scripts/test-block-builder.ts
 */

import { readFileSync } from "fs";
import {
  buildBlock,
  walkSlots,
  type BlockBuilderConfig,
} from "../src/engine/block-builder";
import { gridToPattern, validateGrid } from "../src/engine/grid";
import type { WordEntry } from "../src/engine/types";

function loadDict(): WordEntry[] {
  const raw = readFileSync("./public/dictionary.json", "utf-8");
  const pairs: [string, number][] = JSON.parse(raw);
  // Match the UI's block-builder filter: 3-7 letter crossword words.
  return pairs
    .filter(([w, s]) => w.length >= 3 && w.length <= 7 && s >= 60)
    .map(([word]) => ({ word, clue: "" }));
}

const DICT = loadDict();
console.log(`Dictionary: ${DICT.length} words`);

const THEMED: WordEntry[] = [
  "OCEAN",
  "CRANE",
  "CORAL",
  "TIGER",
  "FLAME",
  "STONE",
  "DREAM",
  "LIGHT",
  "TRAIN",
].map((w) => ({ word: w, clue: `Clue for ${w}` }));

console.log(`\nUser words: ${THEMED.map((e) => e.word).join(", ")}`);
console.log("Running block builder...\n");

const config: BlockBuilderConfig = {
  entries: THEMED,
  dictionary: DICT,
  scaffoldStrategy: "adjacency-aware",
  padding: 1,
  seed: 42,
};

const result = buildBlock(config);

if (!result) {
  console.log("Block builder returned null (scaffold failed)");
  process.exit(1);
}

console.log("=== Phase 1: Scaffold ===");
console.log(`Placed: ${result.scaffoldResult.placed.length} words`);
console.log(`Intersections: ${result.scaffoldResult.intersections}`);
console.log(`Size: ${result.scaffoldResult.rows}x${result.scaffoldResult.cols}`);
const userInScaffold = result.scaffoldResult.placed.filter((p) => !p.isFill);
const fillInScaffold = result.scaffoldResult.placed.filter((p) => p.isFill);
console.log(`  User words placed: ${userInScaffold.length}`);
console.log(`  Fill words: ${fillInScaffold.length}`);
console.log(`\nScaffold grid:`);
for (const row of result.scaffoldResult.grid) {
  console.log("  " + row.map((c) => (c === "#" ? "." : c)).join(""));
}
console.log(`\nScaffold user words:`);
for (const pw of userInScaffold) {
  console.log(`  ${pw.word} at (${pw.row},${pw.col}) ${pw.direction}`);
}

console.log("\n=== Phase 2+3: Structure + Fill ===");
console.log(`Grid size: ${result.grid.rows}x${result.grid.cols}`);
console.log(`\nGrid pattern:`);
console.log(gridToPattern(result.grid));

console.log(`\nPlaced words: ${result.placedWords.length}`);
const userWords = result.placedWords.filter((p) => p.isUser);
const fillWords = result.placedWords.filter((p) => !p.isUser);
console.log(`  User: ${userWords.length}`);
console.log(`  Fill: ${fillWords.length}`);

console.log("\nUser words:");
for (const pw of userWords) {
  console.log(`  ${pw.word} at (${pw.row},${pw.col}) ${pw.direction}`);
}

console.log("\nFill words:");
for (const pw of fillWords.slice(0, 20)) {
  console.log(`  ${pw.word} at (${pw.row},${pw.col}) ${pw.direction}`);
}
if (fillWords.length > 20) {
  console.log(`  ... and ${fillWords.length - 20} more`);
}

// Basic validation
let blackCount = 0;
let letterCount = 0;
let emptyCount = 0;
for (let i = 0; i < result.grid.cells.length; i++) {
  const v = result.grid.cells[i];
  if (v === 0) blackCount++;
  else if (v === 255) emptyCount++;
  else letterCount++;
}
const total = result.grid.rows * result.grid.cols;
console.log(`\nGrid stats:`);
console.log(`  Total cells: ${total}`);
console.log(`  Letters: ${letterCount} (${((letterCount / total) * 100).toFixed(1)}%)`);
console.log(`  Black: ${blackCount} (${((blackCount / total) * 100).toFixed(1)}%)`);
console.log(`  Empty: ${emptyCount} (should be 0)`);
// Grid validation
const gaps = validateGrid(result.grid);
const shortRuns = gaps.filter((g) => g.type === "short_run");
const disconnected = gaps.filter((g) => g.type === "disconnected");
const symViolations = gaps.filter((g) => g.type === "symmetry_violation");
console.log(`\nValidation:`);
console.log(`  Short runs (< 3): ${shortRuns.length}`);
console.log(`  Disconnected cells: ${disconnected.length}`);
console.log(`  Symmetry violations: ${symViolations.length}`);
if (shortRuns.length > 0) {
  for (const g of shortRuns.slice(0, 10)) {
    console.log(`    ${g.description}`);
  }
  if (shortRuns.length > 10) console.log(`    ... and ${shortRuns.length - 10} more`);
}

console.log(`\nTime: ${result.solveTimeMs.toFixed(0)}ms`);

// Word validity check: every run >= 3 letters in the final grid must be in
// the dictionary OR be one of the user's words. 2-letter runs are reported
// separately as structural artifacts (short_runs), not invalid words.
// Also count "stray" cells: letter cells whose across OR down run length
// is just 1 (no real word in that direction).
{
  const validWords = new Set<string>();
  for (const e of DICT) validWords.add(e.word);
  for (const e of THEMED) validWords.add(e.word);
  const slots = walkSlots(result.grid);
  const tooShort = slots.filter((s) => s.word.length < 3);
  const longerSlots = slots.filter((s) => s.word.length >= 3);
  const invalid = longerSlots.filter((s) => !validWords.has(s.word));

  let strayCells = 0;
  for (let r = 0; r < result.grid.rows; r++) {
    for (let c = 0; c < result.grid.cols; c++) {
      const v = result.grid.cells[r * result.grid.cols + c];
      if (v === 0 || v === 255) continue; // BLACK or EMPTY
      const acrossRun = countRunAt(result.grid, r, c, 0, 1);
      const downRun = countRunAt(result.grid, r, c, 1, 0);
      if (acrossRun === 1 || downRun === 1) strayCells++;
    }
  }

  console.log(`\nWord validity:`);
  console.log(`  Total runs >= 2 letters: ${slots.length}`);
  console.log(`  2-letter runs (artifacts): ${tooShort.length}`);
  console.log(`  Real words (>= 3 letters): ${longerSlots.length}`);
  console.log(`    Valid: ${longerSlots.length - invalid.length}`);
  console.log(`    Invalid: ${invalid.length}`);
  console.log(`  Stray 1-letter cells: ${strayCells}`);
  if (invalid.length > 0) {
    console.log(`  Invalid entries:`);
    for (const s of invalid.slice(0, 10)) {
      console.log(`    "${s.word}" at (${s.row},${s.col}) ${s.direction}`);
    }
  }
}

function countRunAt(grid: { rows: number; cols: number; cells: Uint8Array }, r: number, c: number, dr: number, dc: number): number {
  // Walk back to start of run
  let sr = r, sc = c;
  while (sr - dr >= 0 && sc - dc >= 0 && sr - dr < grid.rows && sc - dc < grid.cols) {
    const v = grid.cells[(sr - dr) * grid.cols + (sc - dc)];
    if (v === 0 || v === 255) break;
    sr -= dr;
    sc -= dc;
  }
  let len = 0;
  let cr = sr, cc = sc;
  while (cr >= 0 && cc >= 0 && cr < grid.rows && cc < grid.cols) {
    const v = grid.cells[cr * grid.cols + cc];
    if (v === 0 || v === 255) break;
    len++;
    cr += dr;
    cc += dc;
  }
  return len;
}

// ── Second test: different word list ──
console.log("\n\n════════════════════════════════════════════════");
console.log("Test 2: Smaller themed list");
console.log("════════════════════════════════════════════════\n");

const THEMED2: WordEntry[] = [
  "PYTHON",
  "RUST",
  "CODE",
  "DEBUG",
  "STACK",
].map((w) => ({ word: w, clue: `Clue for ${w}` }));

const config2: BlockBuilderConfig = {
  entries: THEMED2,
  dictionary: DICT,
  scaffoldStrategy: "graph-guided",
  padding: 1,
  seed: 42,
};

const result2 = buildBlock(config2);
if (result2) {
  console.log(`Grid size: ${result2.grid.rows}x${result2.grid.cols}`);
  console.log(`Grid:\n${gridToPattern(result2.grid)}`);
  const uw2 = result2.placedWords.filter((p) => p.isUser);
  const fw2 = result2.placedWords.filter((p) => !p.isUser);
  console.log(`\nUser: ${uw2.length}/${THEMED2.length}, Fill: ${fw2.length}`);
  for (const pw of uw2) console.log(`  ${pw.word} at (${pw.row},${pw.col}) ${pw.direction}`);
  const gaps2 = validateGrid(result2.grid);
  console.log(`Short runs: ${gaps2.filter((g) => g.type === "short_run").length}`);
  const validWords2 = new Set<string>();
  for (const e of DICT) validWords2.add(e.word);
  for (const e of THEMED2) validWords2.add(e.word);
  const slots2 = walkSlots(result2.grid);
  const invalid2 = slots2.filter((s) => !validWords2.has(s.word));
  console.log(`Word validity: ${slots2.length - invalid2.length}/${slots2.length} valid`);
  if (invalid2.length > 0) {
    for (const s of invalid2) {
      console.log(`  Invalid: "${s.word}" at (${s.row},${s.col}) ${s.direction}`);
    }
  }
  console.log(`Time: ${result2.solveTimeMs.toFixed(0)}ms`);
} else {
  console.log("FAILED");
}
