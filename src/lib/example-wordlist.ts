import type { WordEntry } from "@/engine/types";

/**
 * Coastal-themed example wordlist used by the "Use example list" button in
 * the freeform editor. 25 words, lengths 4-7, achieves 100% placement and
 * compactness ~7.9 with the adjacency-aware strategy (the UI default).
 *
 * The theme intentionally matches the CORAL/REEF/TIDE anchors used in the
 * About page demos for continuity.
 */
export const COASTAL_EXAMPLE: WordEntry[] = [
  { word: "CORAL", clue: "Reef-building polyp" },
  { word: "OCEAN", clue: "Vast blue expanse" },
  { word: "WAVE", clue: "Surfer's ride" },
  { word: "REEF", clue: "Underwater ridge" },
  { word: "TIDE", clue: "Rising and falling water" },
  { word: "SHARK", clue: "Cartilaginous predator" },
  { word: "SHELL", clue: "Bivalve's house" },
  { word: "PEARL", clue: "Oyster's gem" },
  { word: "CRAB", clue: "Sideways crawler" },
  { word: "SAND", clue: "Beach grain" },
  { word: "BEACH", clue: "Shore retreat" },
  { word: "SAIL", clue: "Wind catcher" },
  { word: "ANCHOR", clue: "Boat's holdfast" },
  { word: "DOLPHIN", clue: "Playful mammal" },
  { word: "KELP", clue: "Seaweed forest" },
  { word: "SALT", clue: "Briny mineral" },
  { word: "DEPTH", clue: "Measure of profundity" },
  { word: "ISLAND", clue: "Solitary land" },
  { word: "HARBOR", clue: "Safe anchorage" },
  { word: "DIVER", clue: "Underwater explorer" },
  { word: "TROPIC", clue: "Warm latitude" },
  { word: "LAGOON", clue: "Shallow inlet" },
  { word: "SHORE", clue: "Water's edge" },
  { word: "WHALE", clue: "Largest mammal" },
  { word: "PIRATE", clue: "Jolly Roger flier" },
];
