import type { WordEntry } from "./types";

/** A placed word in the freeform grid */
export interface PlacedWord {
  word: string;
  clue: string;
  row: number;
  col: number;
  direction: "across" | "down";
  /** True for words inserted by the dictionary fill pass, not from the user's list */
  isFill?: boolean;
}

/** Result of freeform placement */
export interface FreeformResult {
  /** Words successfully placed */
  placed: PlacedWord[];
  /** Words that couldn't be placed */
  unplaced: WordEntry[];
  /** The grid as a 2D character array (# = empty, letters = filled) */
  grid: string[][];
  /** Grid dimensions */
  rows: number;
  cols: number;
  /** Number of intersections achieved */
  intersections: number;
}

/**
 * Run the freeform solver once, returning the single best result.
 */
export function solveFreeform(
  entries: WordEntry[],
  attempts: number = 8
): FreeformResult {
  const results = solveFreeformMultiple(entries, 1, attempts);
  return results[0];
}

/**
 * Available ordering strategies for the freeform placer.
 * Each strategy produces different layouts by changing how words are ordered.
 */
export type FreeformStrategy =
  | "adjacency-aware"        // Two-phase: bigram-validated parallel + dictionary fill
  | "adjacency-seeded"       // Variant: parallel seed pair + standard gap weight
  | "adjacency-biased"       // Variant: standard seed + higher gap weight (6)
  | "adjacency-seeded-biased" // Variant: parallel seed + higher gap weight (6)
  | "graph-guided"           // Connectivity-based ordering (densest crossings)
  | "longest-first"          // Place longest words first (anchors)
  | "balanced";              // Mix of both approaches

export interface FreeformStrategyInfo {
  id: FreeformStrategy;
  name: string;
  description: string;
}

export const FREEFORM_STRATEGIES: FreeformStrategyInfo[] = [
  {
    id: "adjacency-aware",
    name: "Adjacency-Aware",
    description:
      "Two-phase: places words via intersections and parallel adjacency, then fills gaps with dictionary words.",
  },
  {
    id: "adjacency-seeded",
    name: "Parallel-Seeded",
    description:
      "Starts with the best pair of words placed side-by-side, then continues with standard adjacency-aware placement and gap filling.",
  },
  {
    id: "adjacency-biased",
    name: "Parallel-Biased",
    description:
      "Adjacency-aware with higher scoring weight for parallel placements, making them competitive earlier. Places more fill words.",
  },
  {
    id: "adjacency-seeded-biased",
    name: "Seeded + Biased",
    description:
      "Combines parallel seeding with biased scoring. Starts with a parallel pair and favors parallel placements throughout.",
  },
  {
    id: "graph-guided",
    name: "Densest Crossings",
    description:
      "Builds a graph of word connections, then places words in order of most connections to already-placed words. Tends to maximize total intersections.",
  },
  {
    id: "longest-first",
    name: "Longest First",
    description:
      "Places longer words first as anchors, then fits shorter words around them. Often produces wider, more spread-out layouts with prominent long words.",
  },
  {
    id: "balanced",
    name: "Balanced",
    description:
      "Hybrid approach: starts with the longest word, then prioritizes connected words. Good middle ground when other strategies struggle.",
  },
];

/**
 * Run the freeform solver multiple times with different strategies,
 * returning up to `maxResults` distinct layouts sorted by quality.
 *
 * @param maxPlaced  When set, the solver stops placing after this many words
 *                   succeed. The algorithm sees the full word list and chooses
 *                   the best subset (rather than the caller pre-slicing).
 */
export function solveFreeformMultiple(
  entries: WordEntry[],
  maxResults: number = 4,
  attempts: number = 16,
  strategy: FreeformStrategy = "graph-guided",
  maxPlaced?: number,
  /**
   * Adjacency-aware-only: additional words (e.g. a dictionary) that count as
   * valid perpendicular completions. The user's `entries` are always included.
   * If this is empty/undefined, only the user's words can be formed.
   */
  extraValidWords?: WordEntry[],
): FreeformResult[] {
  if (entries.length === 0) return [];

  const words = entries.map((e) => ({
    ...e,
    word: e.word.toUpperCase(),
  }));

  // Build the compatibility graph once
  const graph = buildCompatibilityGraph(words);
  // Pre-compute validation sets for adjacency-aware variants.
  const isAdjacency = strategy.startsWith("adjacency");
  const allWords = isAdjacency
    ? [...words, ...(extraValidWords ?? [])]
    : null;
  const validWords =
    allWords ? buildValidWordSet(allWords) : null;
  const validBigrams =
    allWords ? buildBigramSet(allWords) : null;
  const results: FreeformResult[] = [];

  for (let attempt = 0; attempt < attempts; attempt++) {
    // Generate ordering based on the chosen strategy
    let ordered: WordEntry[];
    switch (strategy) {
      case "longest-first":
        ordered = longestFirstOrder(words, attempt);
        break;
      case "balanced":
        ordered = balancedOrder(words, graph, attempt);
        break;
      case "adjacency-aware":
      case "adjacency-seeded":
      case "adjacency-biased":
      case "adjacency-seeded-biased":
        ordered = graphGuidedOrder(words, graph, attempt);
        break;
      case "graph-guided":
      default:
        ordered = graphGuidedOrder(words, graph, attempt);
        break;
    }

    const useParallelSeed = strategy === "adjacency-seeded" || strategy === "adjacency-seeded-biased";
    const useGapWeight = (strategy === "adjacency-biased" || strategy === "adjacency-seeded-biased") ? 6 : undefined;
    const result = placeWords(ordered, maxPlaced, validWords ?? undefined, validBigrams ?? undefined, useParallelSeed, useGapWeight);
    if (result.placed.length < 2) continue;

    const signature = resultSignature(result);
    const isDuplicate = results.some((r) => resultSignature(r) === signature);
    if (!isDuplicate) {
      results.push(result);
    }
  }

  // Sort by: most intersections first, then most words placed, then most compact
  results.sort((a, b) => {
    if (a.intersections !== b.intersections) return b.intersections - a.intersections;
    if (a.placed.length !== b.placed.length) return b.placed.length - a.placed.length;
    return (a.rows * a.cols) - (b.rows * b.cols);
  });

  return results.slice(0, maxResults);
}

/** Longest-first ordering: sort by word length descending, with randomized ties for diversity */
function longestFirstOrder(words: WordEntry[], attempt: number): WordEntry[] {
  const rng = createRng(attempt);
  const indexed = words.map((w, i) => ({ w, i }));
  indexed.sort((a, b) => {
    const lenDiff = b.w.word.length - a.w.word.length;
    if (lenDiff !== 0) return lenDiff;
    return attempt === 0 ? 0 : rng() - 0.5;
  });
  return indexed.map((x) => x.w);
}

/** Balanced ordering: longest word first, then graph-guided for the rest */
function balancedOrder(
  words: WordEntry[],
  graph: CompatGraph,
  attempt: number
): WordEntry[] {
  const n = words.length;
  if (n === 0) return [];

  const rng = createRng(attempt + 1000);
  const picked = new Set<number>();

  // Start with longest word (with attempt-based tie breaking)
  let startIdx = 0;
  let bestLen = words[0].word.length;
  for (let i = 1; i < n; i++) {
    const len = words[i].word.length;
    if (len > bestLen || (attempt > 0 && len === bestLen && rng() < 0.3)) {
      bestLen = len;
      startIdx = i;
    }
  }

  const order = [startIdx];
  picked.add(startIdx);

  // Then graph-guided for the rest
  while (order.length < n) {
    let bestIdx = -1;
    let bestScore = -1;
    for (let i = 0; i < n; i++) {
      if (picked.has(i)) continue;
      let edgesToPicked = 0;
      for (const edge of graph[i]) {
        if (picked.has(edge.other)) edgesToPicked++;
      }
      const score = edgesToPicked * 1000 + words[i].word.length + rng() * 5;
      if (score > bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }
    if (bestIdx >= 0) {
      order.push(bestIdx);
      picked.add(bestIdx);
    } else break;
  }

  for (let i = 0; i < n; i++) {
    if (!picked.has(i)) order.push(i);
  }

  return order.map((i) => words[i]);
}

// ─── Compatibility Graph ───

/** An edge in the compatibility graph: two words that share at least one letter */
interface CompatEdge {
  /** Index of the other word */
  other: number;
  /** Number of distinct shared letters (how many ways they could cross) */
  sharedLetters: number;
}

/** Compatibility graph: for each word, which other words it could cross */
type CompatGraph = CompatEdge[][];

/** Build the compatibility graph. O(W² × L²) but fast for small word lists. */
function buildCompatibilityGraph(words: WordEntry[]): CompatGraph {
  const graph: CompatEdge[][] = words.map(() => []);

  for (let i = 0; i < words.length; i++) {
    const wi = words[i].word.toUpperCase();
    for (let j = i + 1; j < words.length; j++) {
      const wj = words[j].word.toUpperCase();

      // Count distinct shared letter positions
      let shared = 0;
      const seen = new Set<string>();
      for (let pi = 0; pi < wi.length; pi++) {
        for (let pj = 0; pj < wj.length; pj++) {
          if (wi[pi] === wj[pj]) {
            const key = `${pi},${pj}`;
            if (!seen.has(key)) {
              seen.add(key);
              shared++;
            }
          }
        }
      }

      if (shared > 0) {
        graph[i].push({ other: j, sharedLetters: shared });
        graph[j].push({ other: i, sharedLetters: shared });
      }
    }
  }

  return graph;
}

/**
 * Generate a word ordering guided by the compatibility graph.
 *
 * Strategy: start with the highest-degree word (most compatible neighbors),
 * then greedily pick the unplaced word with the most edges to already-picked
 * words. This clusters highly interconnected words together in the ordering,
 * giving the placer the best chance of finding multi-word crossings.
 *
 * The `attempt` parameter introduces variation by changing the starting word
 * and adding randomness to tie-breaking.
 */
function graphGuidedOrder(
  words: WordEntry[],
  graph: CompatGraph,
  attempt: number
): WordEntry[] {
  const n = words.length;
  const picked = new Set<number>();
  const order: number[] = [];
  const rng = createRng(attempt);

  // Pick starting word
  if (attempt === 0) {
    // Attempt 0: start with highest degree (most connections), break ties by word length
    let bestIdx = 0;
    let bestScore = -1;
    for (let i = 0; i < n; i++) {
      const score = graph[i].length * 1000 + words[i].word.length;
      if (score > bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }
    order.push(bestIdx);
    picked.add(bestIdx);
  } else {
    // Other attempts: pick a random high-degree word as start
    const degrees = words.map((_, i) => ({ i, deg: graph[i].length }));
    degrees.sort((a, b) => b.deg - a.deg);
    // Pick from top third with randomness
    const topN = Math.max(1, Math.floor(n / 3));
    const startIdx = degrees[Math.floor(rng() * topN)].i;
    order.push(startIdx);
    picked.add(startIdx);
  }

  // Greedily pick remaining words by connectivity to already-picked words
  while (order.length < n) {
    let bestIdx = -1;
    let bestScore = -1;

    for (let i = 0; i < n; i++) {
      if (picked.has(i)) continue;

      // Score = number of edges to already-picked words
      // (weighted by shared letter count for richer connections)
      let edgesToPicked = 0;
      let totalShared = 0;
      for (const edge of graph[i]) {
        if (picked.has(edge.other)) {
          edgesToPicked++;
          totalShared += edge.sharedLetters;
        }
      }

      // Primary: edges to picked words
      // Secondary: total shared letter positions (more crossing options)
      // Tertiary: small random noise for diversity across attempts
      const score = edgesToPicked * 10000 + totalShared * 100 + rng() * 10;

      if (score > bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }

    if (bestIdx >= 0) {
      order.push(bestIdx);
      picked.add(bestIdx);
    } else {
      break;
    }
  }

  // Add any remaining words (disconnected from the graph)
  for (let i = 0; i < n; i++) {
    if (!picked.has(i)) order.push(i);
  }

  return order.map((i) => words[i]);
}

// ─── Parallel Seed Selection ───

interface ParallelSeed {
  wordA: string;
  wordB: string;
  idxA: number;
  idxB: number;
  shift: number;
  score: number;
}

/**
 * Find the best pair of words to place side-by-side as the initial seed.
 * Scores pairs by how many valid bigram columns they produce when aligned
 * at each possible shift offset.
 */
function findBestParallelSeed(
  entries: WordEntry[],
  validBigrams: Set<string>,
): ParallelSeed | null {
  let best: ParallelSeed | null = null;

  for (let i = 0; i < entries.length; i++) {
    const wA = entries[i].word.toUpperCase();
    for (let j = i + 1; j < entries.length; j++) {
      const wB = entries[j].word.toUpperCase();

      // Try all shift offsets where the two words overlap by at least 2 columns
      const minShift = -(wB.length - 2);
      const maxShift = wA.length - 2;

      for (let shift = minShift; shift <= maxShift; shift++) {
        let validBigramCount = 0;
        let invalidBigram = false;

        // Count valid bigram columns in the overlap region
        const overlapStart = Math.max(0, shift);
        const overlapEnd = Math.min(wA.length, shift + wB.length);

        for (let col = overlapStart; col < overlapEnd; col++) {
          const letterA = wA[col];
          const letterB = wB[col - shift];
          const bigram = letterA + letterB;
          if (validBigrams.has(bigram)) {
            validBigramCount++;
          } else {
            invalidBigram = true;
            break;
          }
        }

        if (invalidBigram || validBigramCount < 2) continue;

        // Prefer more overlap columns, break ties by combined word length
        const score = validBigramCount * 100 + (wA.length + wB.length);
        if (!best || score > best.score) {
          best = { wordA: wA, wordB: wB, idxA: i, idxB: j, shift, score };
        }
      }
    }
  }

  return best;
}

// ─── Placement Algorithm ───

interface PlacementOptions {
  maxPlaced?: number;
  validWords?: Set<string>;
  validBigrams?: Set<string>;
  parallelSeed?: boolean;
  gapWeight?: number;
}

/**
 * Core placement algorithm for one ordering of words.
 *
 * @param maxPlaced  When set, the loop stops trying once this many words have
 *                   been successfully placed. Words that were never attempted
 *                   are NOT reported as unplaced because they were intentionally
 *                   skipped because the cap was reached.
 */
function placeWords(
  entries: WordEntry[],
  maxPlaced?: number,
  validWords?: Set<string>,
  validBigrams?: Set<string>,
  parallelSeed?: boolean,
  gapWeight?: number,
): FreeformResult {
  const placed: PlacedWord[] = [];
  const unplaced: WordEntry[] = [];
  const cells = new Map<string, string>(); // "row,col" → letter
  const cap = maxPlaced ?? Infinity;

  if (entries.length === 0 || cap < 1) {
    return { placed: [], unplaced: [], grid: [], rows: 0, cols: 0, intersections: 0 };
  }

  // Try parallel seeding: find the best pair of words to place side-by-side
  let startIdx = 0;
  if (parallelSeed && validBigrams && entries.length >= 2) {
    const seed = findBestParallelSeed(entries, validBigrams);
    if (seed) {
      const { wordA, wordB, shift, idxA, idxB } = seed;
      for (let i = 0; i < wordA.length; i++) cells.set(`0,${i}`, wordA[i]);
      placed.push({ word: wordA, clue: entries[idxA].clue, row: 0, col: 0, direction: "across" });
      for (let i = 0; i < wordB.length; i++) cells.set(`1,${shift + i}`, wordB[i]);
      placed.push({ word: wordB, clue: entries[idxB].clue, row: 1, col: shift, direction: "across" });
      startIdx = -1; // signal to skip both seeded words
    }
  }

  // Fallback: place first word horizontally at row 0
  if (startIdx === 0) {
    const first = entries[0];
    const firstWord = first.word.toUpperCase();
    for (let i = 0; i < firstWord.length; i++) {
      cells.set(`0,${i}`, firstWord[i]);
    }
    placed.push({
      word: firstWord,
      clue: first.clue,
      row: 0,
      col: 0,
      direction: "across",
    });
  }

  if (placed.length >= cap) {
    return buildResult(placed, unplaced, cells);
  }

  // Pre-build word-by-length index for fill feasibility checks during scoring
  let wordsByLength: Map<number, string[]> | undefined;
  if (validWords) {
    wordsByLength = new Map();
    for (const w of validWords) {
      if (w.length < 3 || w.length > 7) continue;
      const arr = wordsByLength.get(w.length);
      if (arr) arr.push(w);
      else wordsByLength.set(w.length, [w]);
    }
  }

  // Indices of seeded words to skip
  const seededWords = startIdx === -1
    ? new Set(placed.map((p) => p.word))
    : new Set([entries[0].word.toUpperCase()]);

  // Place remaining words
  for (let wi = 0; wi < entries.length; wi++) {
    if (seededWords.has(entries[wi].word.toUpperCase())) continue;
    const entry = entries[wi];
    const word = entry.word.toUpperCase();
    const best = findBestPlacement(word, cells, placed, validWords, validBigrams, gapWeight, wordsByLength);

    if (best) {
      for (let i = 0; i < word.length; i++) {
        const r = best.row + (best.direction === "down" ? i : 0);
        const c = best.col + (best.direction === "across" ? i : 0);
        cells.set(`${r},${c}`, word[i]);
      }
      placed.push({
        word,
        clue: entry.clue,
        row: best.row,
        col: best.col,
        direction: best.direction,
      });

      // Cap reached, so stop here. Remaining words weren't *unplaced*,
      // they were intentionally skipped, so don't report them.
      if (placed.length >= cap) break;
    } else {
      unplaced.push(entry);
    }
  }

  // Phase 2: fill perpendicular gaps created by parallel placements
  if (validWords && validBigrams) {
    const fillWords = fillPerpendicularGaps(cells, placed, validWords, validBigrams);
    placed.push(...fillWords);
  }

  return buildResult(placed, unplaced, cells);
}

interface Placement {
  row: number;
  col: number;
  direction: "across" | "down";
  score: number;
}

/**
 * Find the best placement for a word.
 *
 * Without `validWords`: only perpendicular intersection placements are
 * considered, and validation rejects any incidental adjacency (legacy
 * behavior).
 *
 * With `validWords`: both perpendicular intersection AND parallel placements
 * are considered. Adjacencies are allowed only when the resulting full
 * perpendicular run is a real word from the set. Scoring rewards
 * intersections, valid perpendicular completions, and "open" perpendicular
 * cells that future words can grow through.
 */
function findBestPlacement(
  word: string,
  cells: Map<string, string>,
  placed: PlacedWord[],
  validWords?: Set<string>,
  validBigrams?: Set<string>,
  gapWeight?: number,
  wordsByLength?: Map<number, string[]>,
): Placement | null {
  const candidates: Placement[] = [];
  const adjacencyMode = validWords !== undefined;

  // ── Perpendicular intersection placements ──
  for (const pw of placed) {
    for (let pi = 0; pi < pw.word.length; pi++) {
      for (let wi = 0; wi < word.length; wi++) {
        if (pw.word[pi] !== word[wi]) continue;

        const direction: "across" | "down" =
          pw.direction === "across" ? "down" : "across";

        let startRow: number;
        let startCol: number;
        if (direction === "across") {
          startRow = pw.row + pi;
          startCol = pw.col - wi;
        } else {
          startRow = pw.row - wi;
          startCol = pw.col + pi;
        }

        if (
          isValidPlacement(word, startRow, startCol, direction, cells, validWords, validBigrams)
        ) {
          const score = scorePlacement(
            word,
            startRow,
            startCol,
            direction,
            cells,
            validWords,
            gapWeight,
            wordsByLength,
          );
          candidates.push({ row: startRow, col: startCol, direction, score });
        }
      }
    }
  }

  // ── Parallel adjacent placements (adjacency-aware only) ──
  // Try placing this word in the same direction as each existing word,
  // one row/col above or below, at every valid shift offset.
  if (adjacencyMode) {
    for (const pw of placed) {
      const direction = pw.direction; // same direction = parallel
      const wLen = word.length;
      const pLen = pw.word.length;

      // Shifts: range of starting offsets where the new word overlaps the
      // placed word's window. We allow some non-overlap on either side, but
      // only by up to wLen-1 so there's at least one column of comparison.
      const minShift = -(wLen - 1);
      const maxShift = pLen - 1;

      for (let shift = minShift; shift <= maxShift; shift++) {
        // Try both sides (one cell above/below, or left/right)
        for (const sideOffset of [-1, 1] as const) {
          let startRow: number;
          let startCol: number;
          if (direction === "across") {
            startRow = pw.row + sideOffset;
            startCol = pw.col + shift;
          } else {
            startRow = pw.row + shift;
            startCol = pw.col + sideOffset;
          }

          if (
            !isValidPlacement(
              word,
              startRow,
              startCol,
              direction,
              cells,
              validWords,
              validBigrams,
            )
          ) {
            continue;
          }
          const score = scorePlacement(
            word,
            startRow,
            startCol,
            direction,
            cells,
            validWords,
            gapWeight,
            wordsByLength,
          );
          candidates.push({ row: startRow, col: startCol, direction, score });
        }
      }
    }
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0];
}

/**
 * Validate a placement.
 *
 * Without `validWords`: strict mode, where any incidental letter adjacency (a new
 * letter touching a perpendicular existing letter at a non-intersection cell)
 * is rejected outright. This is the safe default.
 *
 * With `validWords`: adjacency-aware mode. For each empty cell of the new
 * word that has perpendicular neighbors, we compute the FULL perpendicular
 * run. Runs of 3+ letters must be a real word in `validWords`. Runs of
 * exactly 2 letters are allowed if the pair is a valid bigram (appears as
 * consecutive letters in a dictionary word). This hybrid lets parallel
 * placements succeed (which always create 2-letter column pairs initially)
 * while still catching gibberish in longer runs.
 */
function isValidPlacement(
  word: string,
  startRow: number,
  startCol: number,
  direction: "across" | "down",
  cells: Map<string, string>,
  validWords?: Set<string>,
  validBigrams?: Set<string>,
): boolean {
  const dr = direction === "down" ? 1 : 0;
  const dc = direction === "across" ? 1 : 0;

  // Cell before/after the word must be empty (don't extend an existing word)
  if (cells.has(`${startRow - dr},${startCol - dc}`)) return false;
  if (
    cells.has(
      `${startRow + word.length * dr},${startCol + word.length * dc}`,
    )
  ) {
    return false;
  }

  for (let i = 0; i < word.length; i++) {
    const r = startRow + i * dr;
    const c = startCol + i * dc;
    const existing = cells.get(`${r},${c}`);

    if (existing) {
      if (existing !== word[i]) return false;
      continue;
    }

    const perpDir = direction === "across" ? "down" : "across";
    const pdr = perpDir === "down" ? 1 : 0;
    const pdc = perpDir === "across" ? 1 : 0;

    const hasPrev = cells.has(`${r - pdr},${c - pdc}`);
    const hasNext = cells.has(`${r + pdr},${c + pdc}`);
    if (!hasPrev && !hasNext) continue;

    if (!validWords) return false;

    let prefix = "";
    let pr = r - pdr;
    let pc = c - pdc;
    while (cells.has(`${pr},${pc}`)) {
      prefix = cells.get(`${pr},${pc}`)! + prefix;
      pr -= pdr;
      pc -= pdc;
    }
    let suffix = "";
    let nr = r + pdr;
    let nc = c + pdc;
    while (cells.has(`${nr},${nc}`)) {
      suffix += cells.get(`${nr},${nc}`)!;
      nr += pdr;
      nc += pdc;
    }
    const perpRun = prefix + word[i] + suffix;

    if (perpRun.length === 1) continue;

    if (perpRun.length === 2) {
      // Allow 2-letter pairs only if the bigram is attested in the dictionary.
      // This is the key to enabling parallel placements: two words side-by-side
      // create columns of 2-letter pairs. Requiring full words here would block
      // ALL parallel placements since no valid crossword word is 2 letters.
      if (!validBigrams || !validBigrams.has(perpRun)) return false;
      continue;
    }

    // 3+ letter run must be a complete valid word
    if (!validWords.has(perpRun)) return false;
  }

  return true;
}

/**
 * Check whether a 2-letter perpendicular run can actually be extended into a
 * real dictionary word (length 3-7). This replaces the old unconditional
 * fillableGaps++ by verifying that Phase 2 will be able to fill the gap.
 *
 * Walks the perpendicular direction to collect existing-cell constraints and
 * boundary conditions, then checks the wordsByLength index for at least one
 * matching candidate.
 */
function canFillGap(
  gapRow: number,
  gapCol: number,
  gapLetter: string,
  perpDir: "across" | "down",
  cells: Map<string, string>,
  wordsByLength: Map<number, string[]>,
): boolean {
  const pdr = perpDir === "down" ? 1 : 0;
  const pdc = perpDir === "across" ? 1 : 0;

  // Collect the full run: walk backward and forward from the gap cell
  const runCells: { r: number; c: number; letter: string }[] = [];

  // Walk backward
  let pr = gapRow - pdr, pc = gapCol - pdc;
  while (cells.has(`${pr},${pc}`)) {
    runCells.unshift({ r: pr, c: pc, letter: cells.get(`${pr},${pc}`)! });
    pr -= pdr;
    pc -= pdc;
  }
  const gapOffset = runCells.length;
  runCells.push({ r: gapRow, c: gapCol, letter: gapLetter });
  // Walk forward
  let nr = gapRow + pdr, nc = gapCol + pdc;
  while (cells.has(`${nr},${nc}`)) {
    runCells.push({ r: nr, c: nc, letter: cells.get(`${nr},${nc}`)! });
    nr += pdr;
    nc += pdc;
  }

  const runLen = runCells.length;
  // The run start/end in grid coordinates
  const runStartR = runCells[0].r;
  const runStartC = runCells[0].c;

  for (let wordLen = 3; wordLen <= 7; wordLen++) {
    const candidates = wordsByLength.get(wordLen);
    if (!candidates) continue;

    // Try each alignment: the run starts at position `offset` in the word
    for (let offset = 0; offset <= wordLen - runLen; offset++) {
      const wStartR = runStartR - offset * pdr;
      const wStartC = runStartC - offset * pdc;

      // Word boundaries must be clear
      if (cells.has(`${wStartR - pdr},${wStartC - pdc}`)) continue;
      if (cells.has(`${wStartR + wordLen * pdr},${wStartC + wordLen * pdc}`)) continue;

      // Build constraint array from existing cells in the word's full path
      const constraints: (string | null)[] = new Array(wordLen).fill(null);
      let conflict = false;
      for (let j = 0; j < wordLen; j++) {
        const cr = wStartR + j * pdr;
        const cc = wStartC + j * pdc;
        const existing = cells.get(`${cr},${cc}`);
        if (existing) constraints[j] = existing;
      }
      // Apply run letters as constraints
      for (let j = 0; j < runLen; j++) {
        const pos = offset + j;
        if (constraints[pos] !== null && constraints[pos] !== runCells[j].letter) {
          conflict = true;
          break;
        }
        constraints[pos] = runCells[j].letter;
      }
      if (conflict) continue;

      // Check if any candidate word matches
      for (const w of candidates) {
        let matches = true;
        for (let j = 0; j < wordLen; j++) {
          if (constraints[j] !== null && w[j] !== constraints[j]) {
            matches = false;
            break;
          }
        }
        if (matches) return true;
      }
    }
  }

  return false;
}

/**
 * Score a candidate placement.
 *
 * Components:
 *   - intersections: cells where the new word reuses an existing letter (×10)
 *   - valid 3+ letter perp words: real dictionary words formed perpendicularly (×8)
 *   - fillable 2-letter gaps: verified that Phase 2 can extend into real words (×gw)
 *   - open anchors: empty perpendicular neighbors for future crossings (×1)
 */
function scorePlacement(
  word: string,
  startRow: number,
  startCol: number,
  direction: "across" | "down",
  cells: Map<string, string>,
  validWords?: Set<string>,
  gapWeight?: number,
  wordsByLength?: Map<number, string[]>,
): number {
  const dr = direction === "down" ? 1 : 0;
  const dc = direction === "across" ? 1 : 0;
  let intersections = 0;
  let validPerpWords = 0;
  let fillableGaps = 0;
  let unfillableGaps = 0;
  let openAnchors = 0;

  const perpDir = direction === "across" ? "down" : "across";
  const pdr = perpDir === "down" ? 1 : 0;
  const pdc = perpDir === "across" ? 1 : 0;

  for (let i = 0; i < word.length; i++) {
    const r = startRow + i * dr;
    const c = startCol + i * dc;
    if (cells.has(`${r},${c}`)) {
      intersections++;
      continue;
    }

    const hasPrev = cells.has(`${r - pdr},${c - pdc}`);
    const hasNext = cells.has(`${r + pdr},${c + pdc}`);

    if (hasPrev || hasNext) {
      if (validWords) {
        let runLen = 1;
        let pr = r - pdr, pc = c - pdc;
        while (cells.has(`${pr},${pc}`)) { runLen++; pr -= pdr; pc -= pdc; }
        let nr = r + pdr, nc = c + pdc;
        while (cells.has(`${nr},${nc}`)) { runLen++; nr += pdr; nc += pdc; }

        if (runLen >= 3) {
          validPerpWords++;
        } else if (wordsByLength && canFillGap(r, c, word[i], perpDir, cells, wordsByLength)) {
          fillableGaps++;
        } else if (wordsByLength) {
          unfillableGaps++;
        }
      }
    } else {
      openAnchors += 2;
    }
  }

  const gw = gapWeight ?? 2;
  return intersections * 10 + validPerpWords * 8 + fillableGaps * gw - unfillableGaps * gw * 2 + openAnchors;
}

/**
 * Build a set of valid (uppercase) words from a list of entries.
 * Used by adjacency-aware validation to verify that any perpendicular run
 * created by a placement is a real word.
 */
function buildValidWordSet(words: WordEntry[]): Set<string> {
  const set = new Set<string>();
  for (const { word } of words) set.add(word.toUpperCase());
  return set;
}

/**
 * Build a set of 2-letter bigrams from words, filtered by frequency.
 * Only bigrams appearing in at least 0.1% of the wordlist are kept,
 * filtering out rare/implausible letter pairs like QJ or ZX.
 */
function buildBigramSet(words: WordEntry[]): Set<string> {
  const counts = new Map<string, number>();
  for (const { word } of words) {
    const w = word.toUpperCase();
    for (let i = 0; i < w.length - 1; i++) {
      const bg = w[i] + w[i + 1];
      counts.set(bg, (counts.get(bg) || 0) + 1);
    }
  }
  const threshold = Math.max(3, Math.floor(words.length * 0.001));
  const set = new Set<string>();
  for (const [bg, count] of counts) {
    if (count >= threshold) set.add(bg);
  }
  return set;
}

// ─── Phase 2: Dictionary Gap Fill ───

interface ShortRun {
  startRow: number;
  startCol: number;
  direction: "across" | "down";
  letters: string[];
}

/**
 * Find all maximal contiguous letter runs of length 1–2 that aren't covered
 * by any placed word in that direction. These are the "gaps" created by
 * parallel placements that Phase 2 needs to extend into real words.
 */
function findShortRuns(
  cells: Map<string, string>,
  placedWords: PlacedWord[],
): ShortRun[] {
  const coveredDown = new Set<string>();
  const coveredAcross = new Set<string>();
  for (const pw of placedWords) {
    const dr = pw.direction === "down" ? 1 : 0;
    const dc = pw.direction === "across" ? 1 : 0;
    for (let i = 0; i < pw.word.length; i++) {
      const key = `${pw.row + i * dr},${pw.col + i * dc}`;
      if (pw.direction === "down") coveredDown.add(key);
      else coveredAcross.add(key);
    }
  }

  let minR = Infinity, maxR = -Infinity, minC = Infinity, maxC = -Infinity;
  for (const key of cells.keys()) {
    const [r, c] = key.split(",").map(Number);
    if (r < minR) minR = r;
    if (r > maxR) maxR = r;
    if (c < minC) minC = c;
    if (c > maxC) maxC = c;
  }

  const runs: ShortRun[] = [];

  // Vertical (down) runs
  for (let c = minC; c <= maxC; c++) {
    let runStart = -1;
    const runLetters: string[] = [];
    for (let r = minR; r <= maxR + 1; r++) {
      const letter = cells.get(`${r},${c}`);
      if (letter) {
        if (runStart === -1) runStart = r;
        runLetters.push(letter);
      } else {
        if (runStart !== -1 && runLetters.length >= 1 && runLetters.length <= 2) {
          let allCovered = true;
          for (let i = 0; i < runLetters.length; i++) {
            if (!coveredDown.has(`${runStart + i},${c}`)) { allCovered = false; break; }
          }
          if (!allCovered) {
            runs.push({ startRow: runStart, startCol: c, direction: "down", letters: [...runLetters] });
          }
        }
        runStart = -1;
        runLetters.length = 0;
      }
    }
  }

  // Horizontal (across) runs
  for (let r = minR; r <= maxR; r++) {
    let runStart = -1;
    const runLetters: string[] = [];
    for (let c = minC; c <= maxC + 1; c++) {
      const letter = cells.get(`${r},${c}`);
      if (letter) {
        if (runStart === -1) runStart = c;
        runLetters.push(letter);
      } else {
        if (runStart !== -1 && runLetters.length >= 1 && runLetters.length <= 2) {
          let allCovered = true;
          for (let i = 0; i < runLetters.length; i++) {
            if (!coveredAcross.has(`${r},${runStart + i}`)) { allCovered = false; break; }
          }
          if (!allCovered) {
            runs.push({ startRow: r, startCol: runStart, direction: "across", letters: [...runLetters] });
          }
        }
        runStart = -1;
        runLetters.length = 0;
      }
    }
  }

  return runs;
}

/**
 * Try to find a dictionary word that extends a short perpendicular run into
 * a valid 3+ letter word. Returns the fill word placement or null.
 */
function tryFillGap(
  gap: ShortRun,
  cells: Map<string, string>,
  wordsByLength: Map<number, string[]>,
  validWords: Set<string>,
  validBigrams: Set<string>,
  placedSet: Set<string>,
): PlacedWord | null {
  const dr = gap.direction === "down" ? 1 : 0;
  const dc = gap.direction === "across" ? 1 : 0;
  const gapLen = gap.letters.length;

  // Try word lengths 3–7 (prefer shorter fill words)
  for (let wordLen = 3; wordLen <= 7; wordLen++) {
    const candidates = wordsByLength.get(wordLen);
    if (!candidates) continue;

    // For each alignment: the gap letters start at position `offset` in the word
    for (let offset = 0; offset <= wordLen - gapLen; offset++) {
      const wStartRow = gap.startRow - offset * dr;
      const wStartCol = gap.startCol - offset * dc;

      // Cell before word start and after word end must be empty
      if (cells.has(`${wStartRow - dr},${wStartCol - dc}`)) continue;
      if (cells.has(`${wStartRow + wordLen * dr},${wStartCol + wordLen * dc}`)) continue;

      // Build constraints from existing cells in the word's path
      const constraints: (string | null)[] = new Array(wordLen).fill(null);
      let conflict = false;
      for (let i = 0; i < wordLen; i++) {
        const r = wStartRow + i * dr;
        const c = wStartCol + i * dc;
        const existing = cells.get(`${r},${c}`);
        if (existing) constraints[i] = existing;
      }

      // The gap letters must match
      for (let i = 0; i < gapLen; i++) {
        const pos = offset + i;
        if (constraints[pos] !== null && constraints[pos] !== gap.letters[i]) { conflict = true; break; }
        constraints[pos] = gap.letters[i];
      }
      if (conflict) continue;

      // Search candidates for a match
      for (const word of candidates) {
        if (placedSet.has(word)) continue;
        let matches = true;
        for (let i = 0; i < wordLen; i++) {
          if (constraints[i] !== null && word[i] !== constraints[i]) { matches = false; break; }
        }
        if (!matches) continue;

        // Validate: new cells must not create invalid perpendicular adjacencies
        if (isValidPlacement(word, wStartRow, wStartCol, gap.direction, cells, validWords, validBigrams)) {
          return {
            word,
            clue: "",
            row: wStartRow,
            col: wStartCol,
            direction: gap.direction,
            isFill: true,
          };
        }
      }
    }
  }

  return null;
}

/**
 * Phase 2: scan the grid for 2-letter perpendicular fragments left by
 * parallel placements and fill them with dictionary words.
 *
 * Uses MRV ordering (most constrained gaps first) and multiple passes so
 * that filling one gap can enable others by extending short runs or adding
 * new constraint-satisfying cells.
 */
function fillPerpendicularGaps(
  cells: Map<string, string>,
  placed: PlacedWord[],
  validWords: Set<string>,
  validBigrams: Set<string>,
): PlacedWord[] {
  const wordsByLength = new Map<number, string[]>();
  for (const word of validWords) {
    if (word.length < 3 || word.length > 7) continue;
    const arr = wordsByLength.get(word.length);
    if (arr) arr.push(word);
    else wordsByLength.set(word.length, [word]);
  }

  const placedSet = new Set(placed.map((p) => p.word));
  const fillPlaced: PlacedWord[] = [];
  const maxFill = Math.max(3, Math.floor(placed.length * 0.75));

  const gaps = findShortRuns(cells, placed).filter((g) => g.letters.length === 2);

  for (const gap of gaps) {
    if (fillPlaced.length >= maxFill) break;
    const fill = tryFillGap(gap, cells, wordsByLength, validWords, validBigrams, placedSet);
    if (fill) {
      for (let i = 0; i < fill.word.length; i++) {
        const r = fill.row + (fill.direction === "down" ? i : 0);
        const c = fill.col + (fill.direction === "across" ? i : 0);
        cells.set(`${r},${c}`, fill.word[i]);
      }
      fillPlaced.push(fill);
      placedSet.add(fill.word);
    }
  }

  return fillPlaced;
}

// ─── Result building ───

function buildResult(
  placed: PlacedWord[],
  unplaced: WordEntry[],
  cells: Map<string, string>
): FreeformResult {
  if (placed.length === 0) {
    return { placed, unplaced, grid: [], rows: 0, cols: 0, intersections: 0 };
  }

  let minR = Infinity, maxR = -Infinity, minC = Infinity, maxC = -Infinity;
  for (const key of cells.keys()) {
    const [r, c] = key.split(",").map(Number);
    minR = Math.min(minR, r);
    maxR = Math.max(maxR, r);
    minC = Math.min(minC, c);
    maxC = Math.max(maxC, c);
  }

  const rows = maxR - minR + 1;
  const cols = maxC - minC + 1;

  const grid: string[][] = Array.from({ length: rows }, () =>
    Array(cols).fill("#")
  );

  for (const [key, letter] of cells) {
    const [r, c] = key.split(",").map(Number);
    grid[r - minR][c - minC] = letter;
  }

  const normalizedPlaced = placed.map((pw) => ({
    ...pw,
    row: pw.row - minR,
    col: pw.col - minC,
  }));

  // Count intersections: cells used by more than one word
  let intersections = 0;
  const cellOwners = new Map<string, number>();
  for (const pw of normalizedPlaced) {
    const dr = pw.direction === "down" ? 1 : 0;
    const dc = pw.direction === "across" ? 1 : 0;
    for (let i = 0; i < pw.word.length; i++) {
      const key = `${pw.row + i * dr},${pw.col + i * dc}`;
      cellOwners.set(key, (cellOwners.get(key) || 0) + 1);
    }
  }
  for (const count of cellOwners.values()) {
    if (count > 1) intersections++;
  }

  return { placed: normalizedPlaced, unplaced, grid, rows, cols, intersections };
}

/** Create a string signature of a result for deduplication */
function resultSignature(r: FreeformResult): string {
  return r.placed
    .map((p) => `${p.word}:${p.row},${p.col},${p.direction}`)
    .sort()
    .join("|");
}

/** Simple seeded PRNG (mulberry32) */
function createRng(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
