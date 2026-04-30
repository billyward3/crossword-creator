/**
 * Web Worker entry point for crossword solving.
 *
 * Runs the solver in a background thread so the UI stays responsive.
 * Communicates with the main thread via postMessage.
 */

import type { WorkerRequest, WorkerResponse, WordEntry, GridModel } from "./types";
import { buildWordIndex } from "./wordindex";
import { solve } from "./solver";

let cancelled = false;

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const request = event.data;

  if (request.type === "solve") {
    cancelled = false;
    handleSolve(request);
  }
};

function handleSolve(request: WorkerRequest & { type: "solve" }): void {
  try {
    // Reconstruct typed array (it gets serialized as a regular array in postMessage)
    const grid: GridModel = {
      rows: request.grid.rows,
      cols: request.grid.cols,
      cells: new Uint8Array(request.grid.cells),
    };

    // Build word index from the wordlist
    const wordIndex = buildWordIndex(request.wordlist);

    // Run the solver
    const results = solve(grid, wordIndex, {
      maxSolutions: request.maxSolutions,
      seed: request.seed,
      onProgress: (filled, total) => {
        const response: WorkerResponse = {
          type: "progress",
          filledSlots: filled,
          totalSlots: total,
        };
        self.postMessage(response);
      },
      isCancelled: () => cancelled,
    });

    // Send solutions back
    for (const result of results) {
      // Convert Uint8Array to regular array for serialization
      const response: WorkerResponse = {
        type: "solution",
        result: {
          ...result,
          grid: {
            ...result.grid,
            cells: result.grid.cells as unknown as Uint8Array,
          },
          // Convert Map to serializable format
          assignments: result.assignments as unknown as Map<number, string>,
        },
      };
      self.postMessage(response);
    }

    // Signal completion
    const doneResponse: WorkerResponse = {
      type: "done",
      solutionCount: results.length,
    };
    self.postMessage(doneResponse);
  } catch (error) {
    const errorResponse: WorkerResponse = {
      type: "error",
      message: error instanceof Error ? error.message : "Unknown solver error",
    };
    self.postMessage(errorResponse);
  }
}
