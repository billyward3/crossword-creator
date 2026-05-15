/**
 * Smoke test: save a puzzle to Redis and load it back.
 *
 * Run via: npx tsx -r dotenv/config scripts/test-puzzle-store.ts dotenv_config_path=.env.development.local
 */

import { getPuzzleStore } from "../src/lib/puzzle/store";
import type { Puzzle } from "../src/lib/puzzle/types";

async function main() {
  const store = getPuzzleStore();

  const puzzle: Puzzle = {
    version: 1,
    grid: [
      ["H", "E", "L", "L", "O"],
      ["", "#", "", "#", ""],
      ["W", "O", "R", "L", "D"],
      ["", "#", "", "#", ""],
      ["S", "M", "I", "L", "E"],
    ],
    clues: {
      "0,0,across": "Common greeting",
      "0,0,down": "Salutation, plus a Beatles song",
      "2,0,across": "Earth, third rock from the sun",
    },
    title: "Smoke test puzzle",
    author: "test",
    userWords: ["HELLO", "WORLD"],
    fillWords: ["SMILE"],
    createdAt: "",
  };

  console.log("Saving...");
  const id = await store.save(puzzle);
  console.log(`  → id: ${id}`);

  console.log("Loading...");
  const loaded = await store.load(id);
  if (!loaded) {
    console.error("FAILED: puzzle not found after save");
    process.exit(1);
  }
  console.log(`  → title: ${loaded.title}`);
  console.log(`  → grid: ${loaded.grid.length}×${loaded.grid[0]?.length}`);
  console.log(`  → clues: ${Object.keys(loaded.clues).length}`);
  console.log(`  → createdAt: ${loaded.createdAt}`);

  // Round-trip equality check (ignoring createdAt which the store sets)
  const matches =
    loaded.grid.flat().join("") === puzzle.grid.flat().join("") &&
    Object.keys(loaded.clues).length === Object.keys(puzzle.clues).length;
  if (!matches) {
    console.error("FAILED: round-trip mismatch");
    process.exit(1);
  }
  console.log("\n✓ Round trip successful");
  process.exit(0);
}

main().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});
