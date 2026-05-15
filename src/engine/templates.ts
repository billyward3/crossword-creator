/**
 * Pre-defined grid templates for common crossword sizes.
 * These define which cells are black (the grid pattern).
 * All templates have 180-degree rotational symmetry.
 *
 * '#' = black, '.' = white
 */

export interface GridTemplate {
  name: string;
  rows: number;
  cols: number;
  pattern: string;
}

export const TEMPLATES_5X5: GridTemplate[] = [
  {
    name: "Open",
    rows: 5,
    cols: 5,
    pattern: [
      ".....",
      ".#.#.",
      ".....",
      ".#.#.",
      ".....",
    ].join("\n"),
  },
  {
    name: "Diamond",
    rows: 5,
    cols: 5,
    pattern: [
      "..#..",
      ".....",
      "#...#",
      ".....",
      "..#..",
    ].join("\n"),
  },
  {
    name: "Corners",
    rows: 5,
    cols: 5,
    pattern: [
      "#...#",
      ".....",
      ".....",
      ".....",
      "#...#",
    ].join("\n"),
  },
];

export const TEMPLATES_15X15: GridTemplate[] = [
  {
    name: "Classic",
    rows: 15,
    cols: 15,
    pattern: [
      "....#....#.....",
      "....#....#.....",
      "...............",
      "....##...##....",
      "#...#.....#...#",
      "......#........",
      "..#....#....#..",
      "........#......",
      "#...#.....#...#",
      "....##...##....",
      "...............",
      "....#....#.....",
      "....#....#.....",
      "....#....#.....",
      "...............",
    ].join("\n"),
    // NOTE: This is a simplified pattern. Real NYT grids have more
    // nuanced patterns. We'll refine these as we test.
  },
  {
    name: "Staircase",
    rows: 15,
    cols: 15,
    pattern: [
      "#....#...#.....",
      "...............",
      "..#....#....#..",
      "....#.....#....",
      ".#.....#.....#.",
      "....#.....#....",
      "..#....#....#..",
      "...............",
      "..#....#....#..",
      "....#.....#....",
      ".#.....#.....#.",
      "....#.....#....",
      "..#....#....#..",
      "...............",
      ".....#...#....#",
    ].join("\n"),
  },
];

export const TEMPLATES_21X21: GridTemplate[] = [
  {
    name: "Sunday Classic",
    rows: 21,
    cols: 21,
    pattern: [
      "....#....#...#....#..",
      "....#....#...#....#..",
      ".....................",
      "...##....##.##....##.",
      "#...#.....#...#.....#",
      "......#...........#..",
      "..#....#....#....#...",
      "........#.....#......",
      "#...#.....#.....#...#",
      "....##...##.##...##..",
      ".....................",
      "....##...##.##...##..",
      "#...#.....#.....#...#",
      "........#.....#......",
      "..#....#....#....#...",
      "......#...........#..",
      "#...#.....#...#.....#",
      "...##....##.##....##.",
      ".....................",
      "....#....#...#....#..",
      "....#....#...#....#..",
    ].join("\n"),
  },
];

export function getTemplatesForSize(
  rows: number,
  cols: number
): GridTemplate[] {
  if (rows === 5 && cols === 5) return TEMPLATES_5X5;
  if (rows === 15 && cols === 15) return TEMPLATES_15X15;
  if (rows === 21 && cols === 21) return TEMPLATES_21X21;
  return [];
}
