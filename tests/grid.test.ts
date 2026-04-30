import { describe, it, expect } from "vitest";
import {
  createGrid,
  gridFromPattern,
  gridToPattern,
  toggleCell,
  extractSlots,
  validateGrid,
  isBlack,
  symmetryPartner,
  cellIndex,
} from "@/engine/grid";
import { CELL_BLACK, CELL_EMPTY } from "@/engine/types";

describe("Grid creation", () => {
  it("creates an empty grid with all white cells", () => {
    const grid = createGrid(5, 5);
    expect(grid.rows).toBe(5);
    expect(grid.cols).toBe(5);
    expect(grid.cells.length).toBe(25);
    for (let i = 0; i < 25; i++) {
      expect(grid.cells[i]).toBe(CELL_EMPTY);
    }
  });

  it("parses a pattern string into a grid", () => {
    const grid = gridFromPattern(
      "#...\n" +
      "....\n" +
      "....\n" +
      "...#"
    );
    expect(grid.rows).toBe(4);
    expect(grid.cols).toBe(4);
    expect(isBlack(grid, 0, 0)).toBe(true);
    expect(isBlack(grid, 3, 3)).toBe(true);
    expect(isBlack(grid, 1, 1)).toBe(false);
  });

  it("round-trips pattern → grid → pattern", () => {
    const pattern = "#...#\n.....\n.....\n.....\n#...#";
    const grid = gridFromPattern(pattern);
    expect(gridToPattern(grid)).toBe(pattern);
  });

  it("parses letters from a pattern", () => {
    const grid = gridFromPattern("HELLO\n#.#.#");
    expect(gridToPattern(grid)).toBe("HELLO\n#.#.#");
  });
});

describe("Symmetry", () => {
  it("computes correct 180-degree symmetry partner", () => {
    const grid = createGrid(5, 5);
    expect(symmetryPartner(grid, 0, 0)).toEqual({ row: 4, col: 4 });
    expect(symmetryPartner(grid, 0, 4)).toEqual({ row: 4, col: 0 });
    expect(symmetryPartner(grid, 2, 2)).toEqual({ row: 2, col: 2 }); // center
  });

  it("toggleCell enforces symmetry", () => {
    const grid = createGrid(5, 5);
    const toggled = toggleCell(grid, 0, 0);

    expect(isBlack(toggled, 0, 0)).toBe(true);
    expect(isBlack(toggled, 4, 4)).toBe(true); // symmetry partner

    // Toggle back
    const unToggled = toggleCell(toggled, 0, 0);
    expect(isBlack(unToggled, 0, 0)).toBe(false);
    expect(isBlack(unToggled, 4, 4)).toBe(false);
  });

  it("toggling center cell only affects one cell", () => {
    const grid = createGrid(5, 5);
    const toggled = toggleCell(grid, 2, 2);
    expect(isBlack(toggled, 2, 2)).toBe(true);

    // Count total black cells — should be 1 (center is its own partner)
    let blackCount = 0;
    for (let i = 0; i < toggled.cells.length; i++) {
      if (toggled.cells[i] === CELL_BLACK) blackCount++;
    }
    expect(blackCount).toBe(1);
  });
});

describe("Slot extraction", () => {
  it("extracts across and down slots from a simple grid", () => {
    const grid = gridFromPattern(
      ".....\n" +
      ".....\n" +
      ".....\n" +
      ".....\n" +
      "....."
    );
    const slots = extractSlots(grid);

    const acrossSlots = slots.filter((s) => s.direction === "across");
    const downSlots = slots.filter((s) => s.direction === "down");

    expect(acrossSlots.length).toBe(5); // one per row
    expect(downSlots.length).toBe(5); // one per column
    expect(acrossSlots[0].length).toBe(5);
  });

  it("skips runs shorter than minLength", () => {
    const grid = gridFromPattern(
      "..#..\n" +
      ".....\n" +
      ".....\n" +
      ".....\n" +
      "..#.."
    );
    const slots = extractSlots(grid, 3);

    // The across runs split by the black cell at (0,2) are length 2 and 2
    // Both are too short (< 3), so no across slot for row 0
    const row0Across = slots.filter(
      (s) => s.direction === "across" && s.startRow === 0
    );
    expect(row0Across.length).toBe(0);
  });

  it("computes intersections between crossing slots", () => {
    const grid = gridFromPattern(
      "...\n" +
      "...\n" +
      "..."
    );
    const slots = extractSlots(grid);

    // 3 across + 3 down = 6 slots, each across intersects all 3 downs
    expect(slots.length).toBe(6);

    const firstAcross = slots.find(
      (s) => s.direction === "across" && s.startRow === 0
    )!;
    expect(firstAcross.intersections.length).toBe(3);
  });
});

describe("Grid validation", () => {
  it("returns no gaps for a valid symmetric grid", () => {
    const grid = gridFromPattern(
      "#...#\n" +
      ".....\n" +
      ".....\n" +
      ".....\n" +
      "#...#"
    );
    const gaps = validateGrid(grid);
    expect(gaps.length).toBe(0);
  });

  it("detects symmetry violations", () => {
    const grid = createGrid(5, 5);
    // Manually set one cell to black without its partner
    grid.cells[cellIndex(grid, 0, 0)] = CELL_BLACK;

    const gaps = validateGrid(grid);
    const symmetryGaps = gaps.filter((g) => g.type === "symmetry_violation");
    expect(symmetryGaps.length).toBeGreaterThan(0);
  });

  it("detects short runs", () => {
    // Create a grid where a black cell creates a 2-letter run
    const grid = gridFromPattern(
      ".#...\n" +
      ".....\n" +
      ".....\n" +
      ".....\n" +
      "...#."
    );
    const gaps = validateGrid(grid);
    const shortRuns = gaps.filter((g) => g.type === "short_run");
    expect(shortRuns.length).toBeGreaterThan(0);
  });

  it("detects disconnected regions", () => {
    const grid = gridFromPattern(
      "..#..\n" +
      "..#..\n" +
      "#####\n" +
      "..#..\n" +
      "..#.."
    );
    const gaps = validateGrid(grid);
    const disconnected = gaps.filter((g) => g.type === "disconnected");
    expect(disconnected.length).toBeGreaterThan(0);
  });
});
