import { describe, it, expect } from "vitest";
import { buildWordIndex } from "@/engine/wordindex";

const TEST_WORDS = [
  { word: "HELLO", clue: "Greeting" },
  { word: "WORLD", clue: "Planet" },
  { word: "HEART", clue: "Organ" },
  { word: "HOUSE", clue: "Building" },
  { word: "HORSE", clue: "Animal" },
  { word: "CAT", clue: "Pet" },
  { word: "DOG", clue: "Pet" },
  { word: "BAT", clue: "Flying mammal" },
  { word: "HAT", clue: "Headwear" },
  { word: "RAT", clue: "Rodent" },
];

describe("WordIndex", () => {
  it("groups words by length", () => {
    const index = buildWordIndex(TEST_WORDS);
    expect(index.wordsByLength.get(5)?.length).toBe(5); // HELLO, WORLD, HEART, HOUSE, HORSE
    expect(index.wordsByLength.get(3)?.length).toBe(5); // CAT, DOG, BAT, HAT, RAT
  });

  it("returns all words of a given length with no constraints", () => {
    const index = buildWordIndex(TEST_WORDS);
    const candidates = index.getCandidates(5, []);
    expect(candidates.length).toBe(5);
  });

  it("filters by single letter constraint", () => {
    const index = buildWordIndex(TEST_WORDS);
    // 5-letter words with H at position 0: HELLO, HEART, HOUSE, HORSE
    const candidates = index.getCandidates(5, [[0, "H"]]);
    expect(candidates.length).toBe(4);
    for (const idx of candidates) {
      expect(index.words[idx][0]).toBe("H");
    }
  });

  it("filters by multiple constraints", () => {
    const index = buildWordIndex(TEST_WORDS);
    // 5-letter words with H at 0 and E at 1: HELLO, HEART
    const candidates = index.getCandidates(5, [[0, "H"], [1, "E"]]);
    expect(candidates.length).toBe(2);
    for (const idx of candidates) {
      expect(index.words[idx][0]).toBe("H");
      expect(index.words[idx][1]).toBe("E");
    }
  });

  it("returns empty array for impossible constraints", () => {
    const index = buildWordIndex(TEST_WORDS);
    // 5-letter words with Z at position 0: none
    const candidates = index.getCandidates(5, [[0, "Z"]]);
    expect(candidates.length).toBe(0);
  });

  it("returns empty array for nonexistent word length", () => {
    const index = buildWordIndex(TEST_WORDS);
    const candidates = index.getCandidates(7, []);
    expect(candidates.length).toBe(0);
  });

  it("excludes used words", () => {
    const index = buildWordIndex(TEST_WORDS);
    const helloIdx = index.words.indexOf("HELLO");
    const candidates = index.getCandidates(5, [], new Set([helloIdx]));
    expect(candidates).not.toContain(helloIdx);
    expect(candidates.length).toBe(4);
  });

  it("generates constraint patterns", () => {
    const index = buildWordIndex(TEST_WORDS);
    const pattern = index.getConstraintPattern(5, [[0, "H"], [3, "L"]]);
    expect(pattern).toBe("H__L_");
  });

  it("handles case-insensitive input", () => {
    const index = buildWordIndex([{ word: "hello", clue: "Hi" }]);
    expect(index.words[0]).toBe("HELLO");
    const candidates = index.getCandidates(5, [[0, "h"]]);
    expect(candidates.length).toBe(1);
  });
});
