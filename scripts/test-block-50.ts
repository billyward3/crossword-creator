/**
 * Block-builder test with a 50-word list ranging 3-12 letters, averaging ~7.
 * Distribution: 3×3, 4×4, 6×5, 8×6, 8×7, 8×8, 5×9, 4×10, 2×11, 2×12.
 *
 * Run via: npx tsx scripts/test-block-50.ts
 */

import { readFileSync } from "fs";
import { buildBlock, walkSlots } from "../src/engine/block-builder";
import type { WordEntry } from "../src/engine/types";

function loadDict(): WordEntry[] {
  const raw = readFileSync("./public/dictionary.json", "utf-8");
  const pairs: [string, number][] = JSON.parse(raw);
  return pairs
    .filter(([w, s]) => w.length >= 3 && w.length <= 12 && s >= 60)
    .map(([word]) => ({ word, clue: "" }));
}

const DICT = loadDict();

const WORDS_50: string[] = [
  // 3 letters
  "CAT", "SUN", "ART",
  // 4 letters
  "BOOK", "TIME", "JAZZ", "WAVE",
  // 5 letters
  "OCEAN", "PIANO", "LEMON", "DANCE", "FLAME", "GHOST",
  // 6 letters
  "WINTER", "SILVER", "DRAGON", "PLANET", "CASTLE", "ROCKET", "COFFEE", "TURTLE",
  // 7 letters
  "THUNDER", "DIAMOND", "CRIMSON", "HARMONY", "WHISPER", "COMPASS", "MUSTARD", "STELLAR",
  // 8 letters
  "MOUNTAIN", "TWILIGHT", "AIRPLANE", "SAPPHIRE", "CARNIVAL", "DINOSAUR", "CHESTNUT", "BLUEBIRD",
  // 9 letters
  "ADVENTURE", "LIGHTNING", "SUNFLOWER", "CHOCOLATE", "DELIGHTED",
  // 10 letters
  "BASKETBALL", "LIGHTHOUSE", "MICROPHONE", "WINDSHIELD",
  // 11 letters
  "CHEERLEADER", "ORCHESTRATE",
  // 12 letters
  "THUNDERSTORM", "ARCHITECTURE",
];

const entries: WordEntry[] = WORDS_50.map((w) => ({ word: w, clue: `Clue for ${w}` }));

// Sanity-check the distribution
const totalChars = WORDS_50.reduce((s, w) => s + w.length, 0);
console.log(`List size: ${WORDS_50.length}, total letters: ${totalChars}, average length: ${(totalChars / WORDS_50.length).toFixed(2)}`);
const byLen = new Map<number, number>();
for (const w of WORDS_50) byLen.set(w.length, (byLen.get(w.length) ?? 0) + 1);
const lens = Array.from(byLen.keys()).sort((a, b) => a - b);
console.log(`Distribution: ${lens.map((l) => `${l}:${byLen.get(l)}`).join(", ")}`);
console.log(`Dictionary size (3-12 letters, score≥60): ${DICT.length}\n`);

for (const cap of [10, 15, 20, 30, undefined]) {
  console.log(`────── Cap: ${cap ?? "no limit"} ──────`);
  const result = buildBlock({
    entries,
    dictionary: DICT,
    scaffoldStrategy: "adjacency-aware",
    padding: 1,
    maxPlaced: cap,
  });
  if (!result) {
    console.log("  FAILED");
    continue;
  }
  const userPlaced = result.placedWords.filter((p) => p.isUser).length;
  const fillPlaced = result.placedWords.filter((p) => !p.isUser).length;

  const validWords = new Set<string>();
  for (const e of DICT) validWords.add(e.word);
  for (const e of entries) validWords.add(e.word);
  const slots = walkSlots(result.grid);
  const longRuns = slots.filter((s) => s.word.length >= 3);
  const shortArtifacts = slots.filter((s) => s.word.length < 3);
  const invalid = longRuns.filter((s) => !validWords.has(s.word));

  console.log(
    `  Grid: ${result.grid.rows}×${result.grid.cols}, User: ${userPlaced}, Fill: ${fillPlaced}, Total: ${result.placedWords.length}`
  );
  console.log(
    `  Validity: ${longRuns.length - invalid.length}/${longRuns.length} real words valid, ${shortArtifacts.length} two-letter artifacts, Time: ${result.solveTimeMs.toFixed(0)}ms`
  );
  if (invalid.length > 0) {
    const sample = invalid.slice(0, 5).map((s) => `"${s.word}"`).join(", ");
    console.log(`  Invalid: ${sample}${invalid.length > 5 ? `, +${invalid.length - 5} more` : ""}`);
  }
}
