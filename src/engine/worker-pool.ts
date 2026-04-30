import type { GridModel, WordEntry, SolverResult, WorkerResponse } from "./types";

export interface PoolConfig {
  /** Number of workers to spawn (defaults to navigator.hardwareConcurrency or 4) */
  numWorkers?: number;
  /** Maximum solutions to collect across all workers */
  maxSolutions?: number;
}

export interface SolveRequest {
  grid: GridModel;
  wordlist: WordEntry[];
  /** Callback when a solution is found */
  onSolution: (result: SolverResult) => void;
  /** Callback for progress updates */
  onProgress?: (filledSlots: number, totalSlots: number) => void;
  /** Callback when all workers are done */
  onComplete: (totalSolutions: number) => void;
  /** Callback on error */
  onError?: (message: string) => void;
}

/**
 * Pool of Web Workers that run the crossword solver in parallel.
 *
 * Each worker gets a different random seed, producing diverse solutions.
 * Solutions are streamed back via callbacks as they're found.
 */
export class WorkerPool {
  private workers: Worker[] = [];
  private numWorkers: number;
  private maxSolutions: number;
  private solutionCount = 0;
  private completedWorkers = 0;
  private currentRequest: SolveRequest | null = null;

  constructor(config: PoolConfig = {}) {
    this.numWorkers =
      config.numWorkers ??
      (typeof navigator !== "undefined" ? navigator.hardwareConcurrency || 4 : 4);
    this.maxSolutions = config.maxSolutions ?? 4;
  }

  /**
   * Start solving a crossword puzzle across multiple workers.
   * Each worker uses a different random seed for diverse solutions.
   */
  solve(request: SolveRequest): void {
    this.terminate(); // clean up any previous workers
    this.solutionCount = 0;
    this.completedWorkers = 0;
    this.currentRequest = request;

    // Serialize grid data for transfer
    const gridData = {
      rows: request.grid.rows,
      cols: request.grid.cols,
      cells: Array.from(request.grid.cells),
    };

    for (let i = 0; i < this.numWorkers; i++) {
      const worker = new Worker(
        new URL("./solver-worker.ts", import.meta.url),
        { type: "module" }
      );

      worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
        this.handleWorkerMessage(event.data, i);
      };

      worker.onerror = (error) => {
        request.onError?.(`Worker ${i} error: ${error.message}`);
      };

      this.workers.push(worker);

      // Send solve request with a unique seed per worker
      worker.postMessage({
        type: "solve",
        grid: gridData,
        wordlist: request.wordlist,
        seed: i * 1000 + Date.now(),
        maxSolutions: 1, // each worker finds 1 solution, diversity comes from different seeds
      });
    }
  }

  private handleWorkerMessage(response: WorkerResponse, workerIndex: number): void {
    const request = this.currentRequest;
    if (!request) return;

    switch (response.type) {
      case "solution": {
        if (this.solutionCount >= this.maxSolutions) return;
        this.solutionCount++;

        // Reconstruct typed arrays from serialized data
        const result: SolverResult = {
          ...response.result,
          grid: {
            ...response.result.grid,
            cells: new Uint8Array(response.result.grid.cells),
          },
          assignments: response.result.assignments instanceof Map
            ? response.result.assignments
            : new Map(Object.entries(response.result.assignments as Record<string, string>).map(
                ([k, v]) => [Number(k), v]
              )),
        };

        request.onSolution(result);

        // If we have enough solutions, terminate remaining workers
        if (this.solutionCount >= this.maxSolutions) {
          this.terminate();
          request.onComplete(this.solutionCount);
        }
        break;
      }

      case "progress":
        request.onProgress?.(response.filledSlots, response.totalSlots);
        break;

      case "done":
        this.completedWorkers++;
        if (this.completedWorkers >= this.workers.length) {
          request.onComplete(this.solutionCount);
        }
        break;

      case "error":
        request.onError?.(response.message);
        this.completedWorkers++;
        if (this.completedWorkers >= this.workers.length) {
          request.onComplete(this.solutionCount);
        }
        break;
    }
  }

  /** Terminate all workers */
  terminate(): void {
    for (const worker of this.workers) {
      worker.terminate();
    }
    this.workers = [];
    this.completedWorkers = 0;
  }
}
