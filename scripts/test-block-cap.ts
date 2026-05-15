/**
 * Verify the maxPlaced cap works in the block builder.
 *
 * Run via: npx tsx scripts/test-block-cap.ts
 */

import { readFileSync } from "fs";
import { buildBlock, walkSlots } from "../src/engine/block-builder";
import type { WordEntry } from "../src/engine/types";

function loadDict(): WordEntry[] {
  const raw = readFileSync("./public/dictionary.json", "utf-8");
  const pairs: [string, number][] = JSON.parse(raw);
  return pairs
    .filter(([w, s]) => w.length >= 3 && w.length <= 7 && s >= 60)
    .map(([word]) => ({ word, clue: "" }));
}

const DICT = loadDict();

// Build a ~100-word user list from common themed words
const BIG_LIST = [
  "OCEAN", "CRANE", "CORAL", "TIGER", "FLAME", "STONE", "DREAM", "LIGHT",
  "TRAIN", "CLOUD", "STORM", "BRAVE", "QUIET", "SHINE", "GLOW", "SPARK",
  "WAVE", "REEF", "TIDE", "MOON", "STAR", "COMET", "ORBIT", "SOLAR",
  "GLOBE", "EARTH", "VINE", "LEAF", "TREE", "ROOT", "GRASS", "PETAL",
  "BLOOM", "ROSE", "DAISY", "TULIP", "ORCHID", "FERN", "PINE", "CEDAR",
  "OAK", "MAPLE", "BIRCH", "ELM", "WILLOW", "BAMBOO", "PALM", "MOSS",
  "WHEAT", "RICE", "CORN", "BEAN", "ONION", "GARLIC", "BASIL", "MINT",
  "SAGE", "THYME", "PEPPER", "GINGER", "LEMON", "LIME", "GRAPE", "PLUM",
  "PEACH", "APPLE", "BERRY", "MELON", "MANGO", "PAPAYA", "GUAVA", "FIG",
  "EAGLE", "HAWK", "OWL", "RAVEN", "SPARROW", "ROBIN", "DOVE", "FINCH",
  "SWAN", "GOOSE", "DUCK", "HERON", "STORK", "CRANE", "PELICAN",
  "FALCON", "PARROT", "CANARY", "MAGPIE", "JAY", "WREN", "MARTIN",
  "BEAR", "WOLF", "FOX", "DEER", "ELK", "MOOSE", "LYNX", "PUMA",
  "OTTER", "BADGER", "RABBIT", "SQUIRREL",
];

// Deduplicate (CRANE appeared twice)
const uniqueWords = Array.from(new Set(BIG_LIST));
const entries: WordEntry[] = uniqueWords.map((w) => ({
  word: w,
  clue: `Clue for ${w}`,
}));

console.log(`User list size: ${entries.length}`);
console.log(`Dictionary size (filtered 3-7 letters): ${DICT.length}\n`);

for (const cap of [10, 20, 30, undefined]) {
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
  // Validity check: every run >= 3 letters must be a dictionary or user word.
  const validWords = new Set<string>();
  for (const e of DICT) validWords.add(e.word);
  for (const e of entries) validWords.add(e.word);
  const slots = walkSlots(result.grid);
  const longRuns = slots.filter((s) => s.word.length >= 3);
  const invalid = longRuns.filter((s) => !validWords.has(s.word));
  console.log(
    `  Grid: ${result.grid.rows}x${result.grid.cols}, User: ${userPlaced}, Fill: ${fillPlaced}, Total: ${result.placedWords.length}, Valid: ${longRuns.length - invalid.length}/${longRuns.length}, Time: ${result.solveTimeMs.toFixed(0)}ms`
  );
  if (invalid.length > 0 && invalid.length <= 5) {
    for (const s of invalid) {
      console.log(`    Invalid: "${s.word}" at (${s.row},${s.col}) ${s.direction}`);
    }
  } else if (invalid.length > 5) {
    console.log(`    First 5 invalid: ${invalid.slice(0, 5).map((s) => `"${s.word}"`).join(", ")}`);
  }
}
