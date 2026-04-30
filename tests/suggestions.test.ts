import { describe, it, expect } from "vitest";
import { analyzeSuggestions } from "@/engine/suggestions";
import { buildWordIndex } from "@/engine/wordindex";
import { gridFromPattern } from "@/engine/grid";

describe("Suggestion system", () => {
  it("reports all slots as flexible when wordlist covers everything", () => {
    const grid = gridFromPattern(
      "...\n" +
      "...\n" +
      "..."
    );

    const words = [
      "ACE", "ACT", "AGE", "AIM", "AIR", "AND", "ANT", "APE",
      "ARC", "ARE", "ARK", "ARM", "ART", "ATE", "AWE",
      "BAD", "BAG", "BAN", "BAR", "BAT", "BED", "BIG",
      "CAB", "CAN", "CAP", "CAR", "CAT", "COP", "COT",
      "DAD", "DAM", "DAY", "DIG", "DIM", "DIP", "DOG",
    ].map((w) => ({ word: w, clue: "" }));

    const wordIndex = buildWordIndex(words);
    const { feasibility, suggestions } = analyzeSuggestions(grid, wordIndex);

    // All slots should have candidates
    for (const f of feasibility) {
      expect(f.domainSize).toBeGreaterThan(0);
      expect(f.status).not.toBe("impossible");
    }

    // No suggestions needed
    expect(suggestions.length).toBe(0);
  });

  it("suggests words needed for impossible slots", () => {
    // Grid with a partially filled row that creates constraints
    // no 3-letter words in wordlist start with "Z"
    const grid = gridFromPattern(
      "Z..\n" +
      "...\n" +
      "..."
    );

    const words = [
      { word: "CAT", clue: "Pet" },
      { word: "DOG", clue: "Pet" },
      { word: "BAT", clue: "Mammal" },
      { word: "HAT", clue: "Headwear" },
      { word: "RAT", clue: "Rodent" },
      { word: "COT", clue: "Bed" },
    ];

    const wordIndex = buildWordIndex(words);
    const { suggestions, feasibility } = analyzeSuggestions(grid, wordIndex);

    // The across slot at row 0 and the down slot at col 0 need words starting with Z
    // which don't exist in our wordlist — they should be flagged as impossible
    const impossibleSlots = feasibility.filter((f) => f.status === "impossible");
    expect(impossibleSlots.length).toBeGreaterThan(0);

    // Should have suggestions for those impossible slots
    expect(suggestions.length).toBeGreaterThan(0);

    // Each suggestion should have a pattern and message
    for (const s of suggestions) {
      expect(s.pattern).toHaveLength(3);
      expect(s.pattern[0]).toBe("Z"); // known letter
      expect(s.message).toBeTruthy();
      expect(["blocking", "helpful"]).toContain(s.urgency);
    }
  });

  it("includes constraint patterns from intersecting letters", () => {
    // Create a grid with some letters already placed
    const grid = gridFromPattern(
      "CAT\n" +
      "...\n" +
      "..."
    );

    // Only provide the placed word — down slots need words starting with C, A, T
    const words = [
      { word: "CAT", clue: "Pet" },
    ];

    const wordIndex = buildWordIndex(words);
    const { suggestions } = analyzeSuggestions(grid, wordIndex);

    // Should suggest words for unfillable slots with known first letters
    const downSuggestions = suggestions.filter((s) => s.direction === "down");
    for (const s of downSuggestions) {
      // The first letter should be known from the placed across word
      expect(s.constraints.length).toBeGreaterThan(0);
      expect(s.pattern[0]).not.toBe("_"); // first letter known from CAT
    }
  });

  it("detects structural gaps", () => {
    // Grid with a 2-letter run (invalid for standard crosswords)
    const grid = gridFromPattern(
      ".#...\n" +
      ".....\n" +
      ".....\n" +
      ".....\n" +
      "...#."
    );

    const wordIndex = buildWordIndex([]);
    const { gaps } = analyzeSuggestions(grid, wordIndex);

    const shortRuns = gaps.filter((g) => g.type === "short_run");
    expect(shortRuns.length).toBeGreaterThan(0);
  });
});
