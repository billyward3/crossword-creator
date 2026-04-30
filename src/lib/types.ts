/** Direction of a clue/word in the crossword */
export type Direction = "across" | "down";

/** A single clue with its answer */
export interface Clue {
  /** Clue number as displayed in the grid */
  number: number;
  /** Direction of this clue */
  direction: Direction;
  /** The clue text shown to the solver */
  text: string;
  /** The answer word */
  answer: string;
  /** Row of the first cell */
  startRow: number;
  /** Column of the first cell */
  startCol: number;
}

/** A complete crossword puzzle ready for solving or sharing */
export interface Puzzle {
  /** Grid dimensions */
  rows: number;
  cols: number;
  /** Black cell positions as [row, col] pairs */
  blackCells: [number, number][];
  /** All clues (across and down) */
  clues: Clue[];
  /** Optional metadata */
  title?: string;
  author?: string;
}

/** Cell state in the solver/player UI */
export interface CellState {
  /** Row index */
  row: number;
  /** Column index */
  col: number;
  /** Whether this cell is a black (blocked) cell */
  isBlack: boolean;
  /** The correct solution letter (if not black) */
  solution?: string;
  /** The user's current input (if not black) */
  value?: string;
  /** Clue number displayed in this cell (if it starts a word) */
  number?: number;
  /** Whether this cell has been checked and is correct */
  isChecked?: boolean;
  /** Whether this cell has been revealed */
  isRevealed?: boolean;
  /** Whether this cell is in pencil mode */
  isPencil?: boolean;
}

/** Position in the grid */
export interface Position {
  row: number;
  col: number;
}
