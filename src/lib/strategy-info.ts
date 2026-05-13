
/**
 * Detailed metadata for each freeform placement strategy.
 * Used by both the create page (short summary + link) and the
 * dedicated /about/strategies/[id] pages (full breakdown).
 */
export interface StrategyDetails {
  id: UIStrategy;
  name: string;
  /** One-line summary shown next to the strategy button */
  shortDescription: string;
  /** Multi-paragraph description shown under the puzzle selection */
  summary: string[];
  /** Strengths: when this strategy excels */
  strengths: string[];
  /** Weaknesses: when this strategy struggles */
  weaknesses: string[];
  /** Step-by-step algorithm explanation */
  steps: { title: string; body: string }[];
  /** Pseudocode for the core algorithm */
  pseudocode: string;
  /** Big-O complexity */
  complexity: string;
  /** When you'd want to pick this strategy */
  useWhen: string[];
}

/** Per-scenario benchmark metrics, measured locally with scripts/benchmark-strategies.ts */
export interface BenchmarkMetric {
  bestIntersections: number;
  bestPlaced: number;
  avgIntersections: number;
  avgPlaced: number;
  /** (rows × cols) / placed words. Lower means denser. */
  compactness: number;
  /** 2-letter runs not covered by any placed word (adjacency strategies only) */
  twoLetterFrags: number;
  /** Dictionary fill words in best result (adjacency strategies only) */
  fillWords: number;
  elapsedMs: number;
}

/**
 * Definitions for each benchmark column, shown in the metric glossary
 * on strategy pages.
 */
export const METRIC_DEFINITIONS: { label: string; key: string; description: string }[] = [
  {
    label: "Best ×",
    key: "bestIntersections",
    description:
      "The highest intersection count from the top-ranked layout across 3 independent runs. An intersection is a grid cell shared by two words (one across, one down). Higher is better.",
  },
  {
    label: "Avg ×",
    key: "avgIntersections",
    description:
      "The mean intersection count across all returned layouts (up to 4 per run), averaged over 3 runs. This includes second- through fourth-best layouts, so it reflects consistency rather than peak performance.",
  },
  {
    label: "Placed",
    key: "bestPlaced",
    description:
      "The most words placed on the grid in any top-ranked layout. For Adjacency-Aware, this includes dictionary fill words from Phase 2, so it can exceed the input word count. Shown as placed/input.",
  },
  {
    label: "Compactness",
    key: "compactness",
    description:
      "Grid bounding-box area (rows times columns) divided by the number of placed words. Lower values indicate denser packing. Note that this measures the full bounding box, which includes empty cells between words. Adjacency-Aware's denominator is inflated by fill words.",
  },
  {
    label: "2-Letter Frags",
    key: "twoLetterFrags",
    description:
      "The number of 2-letter contiguous letter runs in the best grid that are not covered by any placed word in that direction. These are perpendicular fragments left behind by parallel placements that Phase 2 could not extend into complete dictionary words. Only applicable to adjacency strategies; always 0 for other strategies since they never place words in parallel.",
  },
  {
    label: "Fill Words",
    key: "fillWords",
    description:
      "The number of dictionary words added in Phase 2 to extend 2-letter gaps into complete words. These are not from the user's word list. Capped at max(3, 75% of user word count). Only applicable to adjacency strategies.",
  },
  {
    label: "Time",
    key: "elapsedMs",
    description:
      "Wall-clock time for one run (16 randomized attempts), averaged across 3 runs. Measured in single-threaded JavaScript without Web Workers. Includes ordering, candidate enumeration, validation, and (for Adjacency-Aware) Phase 2 gap filling.",
  },
];

export interface BenchmarkScenario {
  id: string;
  name: string;
  description: string;
  wordCount: number;
}

export const BENCHMARK_SCENARIOS: BenchmarkScenario[] = [
  {
    id: "themed-small",
    name: "Themed (9 words)",
    description: "Short personal wordlist with low letter overlap, typical of user input.",
    wordCount: 9,
  },
  {
    id: "vocab-medium",
    name: "Vocabulary (40 words)",
    description: "Common 5-letter English words with high letter overlap.",
    wordCount: 40,
  },
  {
    id: "mixed-large",
    name: "Mixed (156 words)",
    description: "Mixed-length English words (3–8 letters), broad coverage.",
    wordCount: 156,
  },
];

/** The four user-facing strategies (excludes benchmark-only variants) */
export type UIStrategy = "adjacency-aware" | "adjacency-seeded" | "graph-guided" | "longest-first" | "balanced";

/** Benchmark results: strategy → scenario id → metric */
export const BENCHMARK_RESULTS: Record<UIStrategy, Record<string, BenchmarkMetric>> = {
  "adjacency-aware": {
    "themed-small": { bestIntersections: 16, bestPlaced: 12, avgIntersections: 15, avgPlaced: 12, compactness: 6, twoLetterFrags: 0, fillWords: 3, elapsedMs: 125.9 },
    "vocab-medium": { bestIntersections: 99, bestPlaced: 69, avgIntersections: 90.25, avgPlaced: 67.5, compactness: 7.71, twoLetterFrags: 10, fillWords: 29, elapsedMs: 781.9 },
    "mixed-large": { bestIntersections: 312, bestPlaced: 228, avgIntersections: 300.5, avgPlaced: 224.25, compactness: 7.01, twoLetterFrags: 35, fillWords: 72, elapsedMs: 5129.8 },
  },
  "adjacency-seeded": {
    "themed-small": { bestIntersections: 20, bestPlaced: 14, avgIntersections: 18.75, avgPlaced: 14, compactness: 5, twoLetterFrags: 2, fillWords: 5, elapsedMs: 128.8 },
    "vocab-medium": { bestIntersections: 96, bestPlaced: 68, avgIntersections: 93.5, avgPlaced: 67.5, compactness: 11.03, twoLetterFrags: 11, fillWords: 28, elapsedMs: 901.6 },
    "mixed-large": { bestIntersections: 306, bestPlaced: 228, avgIntersections: 292.75, avgPlaced: 222.5, compactness: 8.6, twoLetterFrags: 24, fillWords: 72, elapsedMs: 5230.4 },
  },
  "graph-guided": {
    "themed-small": { bestIntersections: 9, bestPlaced: 9, avgIntersections: 8.25, avgPlaced: 9, compactness: 11.56, twoLetterFrags: 0, fillWords: 0, elapsedMs: 1.3 },
    "vocab-medium": { bestIntersections: 41, bestPlaced: 40, avgIntersections: 40.5, avgPlaced: 39.75, compactness: 19.2, twoLetterFrags: 0, fillWords: 0, elapsedMs: 17.6 },
    "mixed-large": { bestIntersections: 157, bestPlaced: 153, avgIntersections: 156.25, avgPlaced: 152.75, compactness: 10, twoLetterFrags: 0, fillWords: 0, elapsedMs: 317.6 },
  },
  "longest-first": {
    "themed-small": { bestIntersections: 8, bestPlaced: 9, avgIntersections: 8, avgPlaced: 9, compactness: 8.56, twoLetterFrags: 0, fillWords: 0, elapsedMs: 1.2 },
    "vocab-medium": { bestIntersections: 42, bestPlaced: 40, avgIntersections: 40.25, avgPlaced: 39.5, compactness: 15.95, twoLetterFrags: 0, fillWords: 0, elapsedMs: 14.8 },
    "mixed-large": { bestIntersections: 158, bestPlaced: 151, avgIntersections: 153.25, avgPlaced: 147.75, compactness: 10.33, twoLetterFrags: 0, fillWords: 0, elapsedMs: 78.6 },
  },
  balanced: {
    "themed-small": { bestIntersections: 9, bestPlaced: 9, avgIntersections: 8.25, avgPlaced: 9, compactness: 15.89, twoLetterFrags: 0, fillWords: 0, elapsedMs: 1.4 },
    "vocab-medium": { bestIntersections: 41, bestPlaced: 40, avgIntersections: 40.5, avgPlaced: 39.75, compactness: 15.6, twoLetterFrags: 0, fillWords: 0, elapsedMs: 19.6 },
    "mixed-large": { bestIntersections: 161, bestPlaced: 156, avgIntersections: 157.25, avgPlaced: 153.5, compactness: 12.38, twoLetterFrags: 0, fillWords: 0, elapsedMs: 306.8 },
  },
};

/** Note shown alongside benchmark tables. Explains what was measured. */
export const BENCHMARK_METHODOLOGY =
  "Each strategy was run 3 times with 16 randomized attempts per run. Adjacency-aware loads the full crossword dictionary (~42K words, filtered to 3-8 letters with score >= 60) for perpendicular validation and gap filling; other strategies use only the scenario's word list. Note that adjacency-aware's \"placed\" count includes dictionary fill words from Phase 2, so its intersection counts are not directly comparable to other strategies, which only place words from the input list.";

export const STRATEGY_DETAILS: Record<UIStrategy, StrategyDetails> = {
  "adjacency-aware": {
    id: "adjacency-aware",
    name: "Adjacency-Aware",
    shortDescription:
      "Two-phase: places your words with parallel adjacencies, then fills perpendicular gaps with real dictionary words.",
    summary: [
      "Standard freeform crossword placement treats the problem as one of finding shared letters between words: two words can cross if they share a letter at compatible positions. The greedy algorithm picks the best crossing it finds and moves on. This produces grids where words intersect but rarely touch side-by-side, since parallel adjacency creates 2-letter perpendicular fragments that cannot be validated as complete words in a single pass.",
      "The Adjacency-Aware strategy addresses this with a two-phase approach. In Phase 1, words are placed using both perpendicular intersections and parallel adjacencies. Parallel placements create 2-letter column pairs that are provisionally accepted if the pair is an attested bigram (consecutive letter pair appearing in at least 0.1% of dictionary words). Phase 2 then scans for those 2-letter fragments and attempts to extend each into a real dictionary word of length 3 to 7.",
      "This two-phase design resolves a chicken-and-egg problem inherent to parallel placement. Two words placed side-by-side always create perpendicular columns of exactly 2 letters, which are too short to validate as real words during placement. Rather than rejecting all such placements (which eliminates parallel adjacency entirely) or accepting them unchecked (which produces gibberish), the algorithm defers final validation to Phase 2, where dictionary words can bridge the gaps.",
      "The resulting grids contain both the user's original words and a set of dictionary fill words. The fill count is capped at 75% of user word count to prevent dictionary-dominated layouts. Because the grid contains more total words than other strategies, its raw intersection count is higher, though some portion of that increase is attributable to the additional fill words rather than more efficient placement of the original words alone.",
    ],
    strengths: [
      "Produces grids with substantially more intersections, though the increase is partly due to additional fill words from the dictionary",
      "Fill words are drawn from a curated crossword dictionary and are validated against perpendicular constraints",
      "Grids exhibit the interlocking aesthetic of newspaper-style crosswords, where words touch side-by-side as well as crossing",
    ],
    weaknesses: [
      "Significantly higher compute cost (5x to 50x slower than other strategies depending on word count), driven by dictionary lookup, parallel candidate enumeration, and Phase 2 gap filling",
      "Introduces dictionary words not from the user's list; the grid is no longer composed exclusively of user-chosen words",
      "Fill quality depends on dictionary coverage and bigram filtering; unusual letter combinations near the grid boundary may not find a valid fill word, leaving some 2-letter fragments unresolved",
    ],
    steps: [
      {
        title: "Build validation sets",
        body: "Combine the user's word list with the built-in crossword dictionary (approximately 42K entries, filtered to words of 3 to 8 letters with a quality score of at least 60). Build two data structures: a valid-word set for verifying that 3+ letter perpendicular runs are real words, and a frequency-filtered bigram set for provisionally accepting 2-letter perpendicular pairs during Phase 1. The bigram frequency threshold is max(3, 0.1% of combined word count).",
      },
      {
        title: "Phase 1: Place user words with parallel adjacency",
        body: "Order words by graph connectivity (same ordering as Densest Crossings). For each word, enumerate both intersection placements (perpendicular to existing words at shared-letter positions) and parallel placements (same direction as an existing word, offset by one row or column). Validate each candidate: 2-letter perpendicular runs must appear in the bigram set; 3+ letter runs must be complete words in the valid-word set. Score candidates by intersections (weight 10), valid 3+ letter perpendicular words formed (weight 8), fillable 2-letter gaps (weight 2), and open anchor cells (weight 1). Place the highest-scoring valid candidate.",
      },
      {
        title: "Phase 2: Fill perpendicular gaps from dictionary",
        body: "Scan the grid for all maximal contiguous letter runs of exactly 2 letters that are not already covered by a placed word in that direction. For each gap, search the dictionary for a word of length 3 to 7 that passes through those existing letters at some alignment offset. The candidate must satisfy the same perpendicular validation as Phase 1. Place the first valid match found. This pass runs once with no cascading (newly placed fill words do not trigger additional gap scans). Total fill words are capped at max(3, 75% of user word count).",
      },
      {
        title: "Score and rank results",
        body: "Across multiple randomized attempts (default 16), collect distinct layouts (deduplicated by word-position signatures) and rank by total intersections, then total words placed, then compactness (grid area divided by placed words). The top layouts are returned.",
      },
    ],
    pseudocode: `// === Phase 1: Place user words ===
validWords = buildSet(userWords ∪ dictionary)
bigrams = buildFrequentBigrams(userWords ∪ dictionary)
// threshold = max(3, floor(|combined| × 0.001))

function isValid(word, row, col, dir, cells):
    for each empty cell with perpendicular neighbors:
        run = walkFullPerpendicularRun(cell)
        if len(run) == 2 and run not in bigrams: return false
        if len(run) >= 3 and run not in validWords: return false
    return true

function score(word, row, col, dir, cells, dict):
    for each 2-letter perp run:
        if canExtendToWord(run, dict): fillableGaps++
        else: unfillableGaps++
    return intersections × 10 + validPerpWords × 8
         + fillableGaps × gw - unfillableGaps × gw × 2
         + openAnchors × 1

for word in graphGuidedOrder(words):
    candidates = intersectionPlacements ∪ parallelPlacements
    best = candidates.filter(isValid).maxBy(score)
    if best: place(word, best)

// === Phase 2: Fill gaps with dictionary ===
gaps = findShortRuns(grid, placed)  // 2-letter fragments only
maxFill = max(3, floor(|placed| × 0.75))
for gap in gaps (until maxFill reached):
    for wordLen in 3..7:
        for alignment of gap within word:
            match = dictionaryLookup(constraints)
            if match and isValid(match):
                place(match, isFill=true); break`,
    complexity:
      "Phase 1: O(W² · L³ · D) for candidate enumeration, where D is the dictionary lookup cost per candidate cell. Each cell in a parallel placement candidate checks whether its 2-letter perpendicular run can be extended into a real dictionary word (length 3 to 7), requiring a scan of the relevant dictionary bucket. Inline fill adds O(G · 5 · D_L) per parallel placement, where G is the gap count, 5 is the word-length range tried, and D_L is the average bucket size (~7K words). Total observed: 126ms for 9 words, 782ms for 40 words, 5.1s for 156 words (measured in single-threaded JS, no Web Workers).",
    useWhen: [
      "You want a dense, interlocking grid and are willing to accept dictionary fill words alongside your own word list",
      "You prefer the newspaper-style crossword aesthetic where words touch side-by-side, not just at perpendicular crossings",
      "Your word list has enough common letters that parallel placements can form plausible bigrams for Phase 2 to resolve",
    ],
  },

  "adjacency-seeded": {
    id: "adjacency-seeded",
    name: "Parallel-Seeded",
    shortDescription:
      "Starts with an optimal parallel word pair, then uses inline gap filling to build dense clusters incrementally.",
    summary: [
      "A variant of Adjacency-Aware that begins by finding the best pair of words to place side-by-side. The pair is selected by scoring all word pairs at every alignment offset, counting how many valid bigram columns each alignment produces. The highest-scoring pair becomes the grid's initial structure.",
      "The key difference from the base strategy is inline gap filling: after each parallel placement, the algorithm immediately scans for 2-letter fragments and fills them while the surrounding grid is still sparse. This produces a virtuous cycle where early fill words provide crossing points for subsequent user words, and the looser constraints at fill time allow more gaps to be resolved.",
      "This approach produces the fewest 2-letter fragments of the adjacency strategies. On a 156-word list, inline filling reduces fragments by roughly 43% compared to deferred filling, while placing the same number of total fill words.",
    ],
    strengths: [
      "Fewest 2-letter fragments among adjacency strategies due to inline gap filling while constraints are still loose",
      "The parallel seed creates a strong initial structure that subsequent placements can build around",
      "The virtuous cycle of fill-then-cross produces consistently dense grids across word list sizes",
    ],
    weaknesses: [
      "Slightly slower than base Adjacency-Aware due to inline fill scans after each parallel placement",
      "Seed pair quality depends on the word list having at least two words with compatible bigram columns",
      "Same general tradeoffs as Adjacency-Aware: introduces dictionary fill words, higher compute cost than user-word-only strategies",
    ],
    steps: [
      {
        title: "Find the best parallel seed pair",
        body: "For every pair of words, try placing them side-by-side (row 0 and row 1) at every column offset where they overlap. Score each alignment by counting valid bigram columns. Select the pair and offset that maximizes valid bigrams.",
      },
      {
        title: "Place remaining words with inline fill",
        body: "After placing the seed pair, continue with graph-guided ordering. For each word, evaluate both perpendicular and parallel placements. After each parallel placement, immediately scan for 2-letter fragments and fill them from the dictionary. This catches gaps early while surrounding constraints are minimal.",
      },
      {
        title: "Final fill pass",
        body: "After all user words are placed, a final gap-filling pass catches any remaining 2-letter fragments from the last few placements. The total fill budget (75% of user word count) is shared across inline fills and this final pass.",
      },
    ],
    pseudocode: `function findBestParallelSeed(words, bigrams):
    bestScore = 0
    for each pair (A, B) in words:
        for shift in range:
            validCols = count columns where A[i]+B[i+shift] in bigrams
            if validCols > bestScore:
                bestPair = (A, B, shift)

// Place seed pair, then for each subsequent word:
for word in graphGuidedOrder(remaining):
    best = maxScore(intersections ∪ parallelPlacements)
    place(word, best)
    if best.isParallel:
        // Inline fill: resolve gaps immediately
        gaps = findShortRuns(grid, placed)
        for gap in gaps:
            fill = dictionaryLookup(gap)
            if fill: place(fill, isFill=true)`,
    complexity:
      "Seed selection: O(W² x L) for all pair/offset combinations. Placement: same as Adjacency-Aware plus O(G x D_L) inline fill per parallel placement. Total observed: 129ms for 9 words, 902ms for 40 words, 5.2s for 156 words.",
    useWhen: [
      "You want the densest possible grid with minimal 2-letter fragments",
      "Your word list has at least two words that share common bigram patterns when placed side-by-side",
      "You're willing to accept slightly longer generation time for better fragment resolution",
    ],
  },

  "graph-guided": {
    id: "graph-guided",
    name: "Densest Crossings",
    shortDescription:
      "Builds a graph of word connections and prioritizes the most interconnected words.",
    summary: [
      "This strategy treats your word list as a graph problem. Each word is a node, and two words are connected by an edge if they share at least one letter, meaning they could potentially cross in the grid.",
      "The placement order is then derived from this graph: start with the most connected word (the one that could cross the most other words), and at each step add the unplaced word that has the most connections to words already on the grid.",
      "By clustering interconnected words together in the placement order, the greedy placer is much more likely to find positions where a new word crosses multiple existing words simultaneously, producing denser layouts than naive ordering.",
    ],
    strengths: [
      "Tends to produce high intersection counts among user-word-only strategies, particularly on word lists with rich letter overlap",
      "Connectivity-aware ordering surfaces non-obvious crossings between words that would be difficult to find manually",
      "Places the most words on average, since highly connected words are tried first and rarely fail to find a valid position",
    ],
    weaknesses: [
      "Less effective when words have few shared letters (sparse compatibility graph), falling back to essentially random ordering for disconnected nodes",
      "Can produce less compact grids than Longest First, since high-degree seed words may be short and create a small initial grid that subsequent words extend outward",
    ],
    steps: [
      {
        title: "Build the compatibility graph",
        body: "For every pair of words (A, B), count how many distinct letter positions could line up if they crossed. If they share at least one letter, add an edge in the graph weighted by the number of crossing options. This is a one-time O(W² × L²) preprocessing step.",
      },
      {
        title: "Pick the seed word",
        body: "Find the word with the highest degree (most edges to other words). On the first attempt, ties are broken by word length. On subsequent attempts, the seed is randomized among the top-third highest-degree nodes to produce diverse layouts.",
      },
      {
        title: "Iteratively add the most connected unplaced word",
        body: "At each step, score every unplaced word by how many edges it has to already-placed words. Pick the highest scorer (with shared-letter count and small randomness as tiebreakers). This naturally builds tight clusters of compatible words.",
      },
      {
        title: "Hand the ordering to the greedy placer",
        body: "Once the order is determined, the standard greedy placer takes over: place each word at the position that maximizes intersections with existing words on the grid. The graph-guided ordering ensures these greedy choices produce denser results than longest-first or random ordering.",
      },
    ],
    pseudocode: `function graphGuidedOrder(words, graph):
    picked = {}
    order = []

    // Step 1: pick seed (highest degree)
    seed = argmax(words, w => degree(w in graph))
    order.append(seed)
    picked.add(seed)

    // Step 2: greedily add most-connected unplaced word
    while picked.size < words.size:
        best = null
        bestScore = -1
        for w in words \\ picked:
            edgesToPicked = count(edge in graph[w] where edge.other in picked)
            score = edgesToPicked × 10000 + sharedLetterTotal(w) × 100
            if score > bestScore:
                best = w
                bestScore = score
        order.append(best)
        picked.add(best)

    return order`,
    complexity:
      "Graph build: O(W² × L²) where W = word count, L = average word length. Ordering: O(W² × E) where E = average edges per word. For typical lists (10–50 words), this is microseconds.",
    useWhen: [
      "Your word list has many shared letters (vowels, common consonants)",
      "You want maximum visual density in the resulting crossword",
      "You're building a themed puzzle where related words tend to share letters",
    ],
  },

  "longest-first": {
    id: "longest-first",
    name: "Longest First",
    shortDescription:
      "Places longer words first as anchors, then fits shorter words around them.",
    summary: [
      "The classic crossword construction approach: long words become the structural backbone of the grid, and shorter words fill in around them.",
      "Long words have more letters, which means more potential crossing points. By placing them first, every subsequent shorter word has a wider variety of intersection options to choose from.",
      "This strategy tends to produce grids shaped around one or two long anchor words. In benchmarks, it often yields favorable compactness ratios (grid area per placed word) since long anchors define a tight bounding box that shorter words pack into. However, it may place fewer total words than connectivity-aware strategies because word ordering ignores the compatibility graph.",
    ],
    strengths: [
      "Long words are guaranteed to be placed (since they go first, they always succeed)",
      "Produces among the most compact grids per placed word, and the fastest execution time of any strategy (no graph computation)",
      "Simple and predictable: word length alone determines ordering, making results easy to reason about",
    ],
    weaknesses: [
      "Does not account for word compatibility, so long words might be placed where they offer few crossing opportunities for shorter words",
      "Can leave more words unplaced than graph-aware strategies, since ordering by length ignores connectivity",
    ],
    steps: [
      {
        title: "Sort words by length descending",
        body: "Word lengths from longest to shortest. Among words of equal length, the order is randomized across attempts to produce different layouts.",
      },
      {
        title: "Place words greedily in order",
        body: "Place the longest word horizontally at origin. For each subsequent word, find the placement that maximizes intersections with already-placed words. Long words placed early give later words more options.",
      },
    ],
    pseudocode: `function longestFirstOrder(words):
    return sort(words, by length descending,
                ties broken randomly per attempt)

function placeWords(orderedWords):
    place orderedWords[0] horizontally at (0, 0)
    for word in orderedWords[1:]:
        bestPlacement = null
        for placedWord in placed:
            for sharedLetter in word ∩ placedWord:
                p = perpendicularPlacement(word, placedWord, sharedLetter)
                if isValid(p):
                    score = countIntersections(p)
                    if score > bestScore:
                        bestPlacement = p
        if bestPlacement:
            place(word, bestPlacement)`,
    complexity:
      "Sort: O(W log W). Placement: O(W² × L²) for the greedy search. Total: O(W² × L²) per attempt.",
    useWhen: [
      "You have one or two long themed entries you want prominently displayed",
      "Your word list has high length variance (mix of 3-letter and 8+ letter words)",
      "You prefer a more traditional, anchor-driven crossword aesthetic",
    ],
  },

  balanced: {
    id: "balanced",
    name: "Balanced",
    shortDescription:
      "Hybrid: starts with the longest word, then prioritizes connected words.",
    summary: [
      "A hybrid approach that combines elements of both Longest First and Densest Crossings. It begins by placing the longest word as an anchor, then switches to graph-guided ordering for all subsequent words.",
      "This gives the visual prominence of a long anchor word while still benefiting from connectivity-aware placement for the bulk of the grid. In benchmarks on larger word lists, this combination tends to place the most total words and can produce the highest intersection counts among user-word-only strategies.",
      "The hybrid ordering appears to benefit from having a long, letter-rich anchor that provides more crossing opportunities for the graph-guided remainder than a short high-degree seed would. When neither pure strategy works well for a given word list, Balanced often provides a reasonable middle ground.",
    ],
    strengths: [
      "Long words are placed early, giving subsequent graph-guided words a letter-rich anchor to cross",
      "On larger word lists, tends to place the most words and achieve competitive intersection counts among user-word-only strategies",
      "Less sensitive to specific word list properties than the pure strategies",
    ],
    weaknesses: [
      "Neither maximally dense nor maximally compact; occupies middle ground on most metrics",
      "First-word choice (longest) may not be the best graph hub, and its position is fixed before connectivity is considered",
    ],
    steps: [
      {
        title: "Pick the longest word as seed",
        body: "Find the longest word and place it first. On subsequent attempts, the seed is jittered slightly so different long words can take the anchor role.",
      },
      {
        title: "Use graph-guided ordering for the rest",
        body: "After the seed is placed, switch to the graph-guided strategy: at each step, pick the unplaced word with the most connections to already-placed words.",
      },
    ],
    pseudocode: `function balancedOrder(words, graph):
    seed = argmax(words, w => length(w))
    picked = { seed }
    order = [seed]

    while picked.size < words.size:
        best = argmax(words \\ picked, w =>
            edgesToPicked(w, graph) × 1000 + length(w))
        order.append(best)
        picked.add(best)

    return order`,
    complexity:
      "Same as graph-guided. Graph build dominates at O(W² × L²). Ordering is also O(W² × E).",
    useWhen: [
      "You're not sure which strategy fits your word list",
      "You want a long anchor word AND a dense grid",
      "Other strategies are producing extreme results (too sparse or too cramped)",
    ],
  },
};

/**
 * Comparative analysis notes for the performance section.
 * Each entry is a paragraph of analysis text. Written to read as an
 * independent section on the strategy page, not tied to any single strategy.
 */
export const PERFORMANCE_ANALYSIS: string[] = [
  "The four strategies share the same underlying greedy placement algorithm but differ in word ordering and, in the case of Adjacency-Aware, in which placements are considered valid. This means performance differences stem from two factors: the cost of computing the ordering, and the size of the candidate set evaluated per word.",
  "Graph-guided, Balanced, and Longest First operate exclusively on the user's word list. Their placement pass considers only perpendicular intersection candidates (positions where a new word crosses an existing word at a shared letter). Longest First skips the graph-build step entirely, making it the fastest strategy in every scenario. Graph-guided and Balanced are similar in cost because they both compute the compatibility graph; Balanced adds a minor constant factor for its hybrid seed selection.",
  "Adjacency-Aware adds two sources of overhead. First, each word's candidate set is larger because parallel placements (same direction, offset by one row or column) are enumerated alongside perpendicular intersections. For a word of length L placed beside an existing word of length P, this adds up to 2 × (L + P - 1) additional candidates per pair. Second, every candidate undergoes perpendicular-run validation against the dictionary, which requires walking the grid in the perpendicular direction at each cell. Phase 2 (gap filling) adds a third cost: scanning for 2-letter fragments and searching dictionary buckets for valid extensions.",
  "The practical impact scales with word count. On a 9-word themed list, the adjacency strategies run in roughly 126-129ms versus 1.2ms for Longest First (approximately 100x slower). On 156 words, the gap narrows to roughly 65x (5.1-5.2s versus 79ms). The overhead comes from dictionary validation of perpendicular runs, parallel candidate enumeration, and gap filling.",
  "An important caveat applies when comparing intersection counts across strategy types. The adjacency strategies' reported intersections include crossings involving dictionary fill words. For the mixed-large scenario, Adjacency-Aware places 228 total words (156 user + 72 fill) and reports 312 intersections, while Densest Crossings places 153 user words and reports 157 intersections. Some portion of the intersection difference is attributable to the additional fill words, not to more efficient placement of the original word list.",
  "The 2-letter fragment count reveals an inherent tradeoff of parallel placement. Every pair of words placed side-by-side creates perpendicular 2-letter runs that must either be extended into dictionary words or left as fragments. Inline gap filling (used by both adjacency strategies) mitigates this by resolving gaps immediately after each parallel placement, while surrounding constraints are still loose. Parallel-Seeded reduces fragments by roughly 43% compared to deferred filling on large word lists, producing 24 fragments versus 35 for base Adjacency-Aware on the mixed-large scenario. The remaining fragments are structurally unfillable due to constraints accumulated during grid construction.",
  "The compactness metric (grid area divided by placed words) also requires careful interpretation. Adjacency-Aware tends to produce grids with lower compactness values, which suggests denser packing. However, the fill words extend existing perpendicular runs rather than expanding the grid boundary, so they reduce compactness partly by inflating the denominator without proportionally increasing the numerator. Among the user-word-only strategies, Longest First tends to produce the most compact grids, likely because long anchor words create a tighter bounding box relative to the words they accommodate.",
];

export function getStrategyDetails(id: UIStrategy): StrategyDetails {
  return STRATEGY_DETAILS[id];
}
