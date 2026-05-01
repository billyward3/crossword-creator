# How the Crossword Solver Works

## The Problem

Given a user's word list (each word with a clue), arrange as many words as possible into a crossword grid where words intersect at shared letters. The solver has two modes:

1. **Freeform** — build the grid shape around the words, maximizing intersections
2. **Template** — fill a fixed grid pattern (e.g., a standard 5×5 or 15×15 layout) with words from the list

Both modes are NP-hard in the general case. Our approach uses different strategies for each, optimized for the constraints of personalized crosswords (small-to-medium word lists of 10–200 words chosen by the user).

---

## Mode 1: Freeform Solver

### Goal

Place as many words as possible on an unbounded grid, maximizing the number of intersections (cells where an across word and a down word share a letter).

### Algorithm: Greedy Placement with Randomized Restarts

**Step 1 — Sort words.** Start with the longest words first. Longer words expose more letters, creating more opportunities for subsequent words to intersect.

**Step 2 — Place the first word.** Put the longest word horizontally at the origin. This anchors the grid.

**Step 3 — For each remaining word, find the best placement:**

For every already-placed word, scan for shared letters between the placed word and the candidate word. Each shared letter defines a potential crossing point where the candidate can be placed perpendicular to the placed word.

For each potential crossing:
- Compute the candidate's start position so that the shared letter aligns
- Validate the placement: no letter conflicts, no unintended adjacencies, and cells before/after the word are empty (to avoid merging into existing words)
- Score the placement by counting how many existing cells it intersects (more intersections = denser crossword)

Pick the highest-scoring valid placement.

**Step 4 — Repeat** until all words are placed or no valid placements remain.

### Validation Rules

A placement is valid if:
1. **No conflicts** — every cell the word occupies is either empty or already contains the same letter
2. **No accidental adjacency** — cells perpendicular to the word (above/below for across words, left/right for down words) that aren't intersection points must be empty. This prevents the word from accidentally extending or altering an existing word.
3. **Bookend cells are empty** — the cell immediately before and after the word (in its direction) must be empty, so the word doesn't merge with an adjacent word.

### Diversity Through Randomized Restarts

A single greedy pass produces one layout, but different word orderings produce different layouts. The solver runs **20 attempts** with different orderings:

- Attempt 0: strict longest-first ordering
- Attempts 1–19: shuffled orderings with a longest-first bias (longer words are still more likely to be placed early, but the exact order varies)

Each attempt produces a complete layout. Results are deduplicated by comparing word positions, then sorted by quality:
1. Most words placed (primary)
2. Most intersections (secondary)
3. Most compact grid area (tertiary)

The top 6 distinct layouts are returned to the user.

### Complexity

For `W` words with average length `L` and `P` already-placed words, each placement attempt examines `O(P × L × W × L)` potential positions in the worst case. With `W` typically ≤ 200 and `L` ≤ 15, this is fast enough to run 20 complete attempts in under a second on a modern browser.

### Tradeoffs

The greedy approach doesn't guarantee the globally optimal layout (that would require exhaustive search over all possible orderings and positions — factorial complexity). But for personalized crosswords, the randomized restarts produce good-enough diversity, and the user picks the layout they prefer from multiple options.

---

## Mode 2: Template-Based CSP Solver

### Goal

Given a fixed grid pattern (which cells are black, which are white) and a word list, fill every white slot with a word from the list such that all intersecting cells share the same letter. Every word can be used at most once.

This is a **Constraint Satisfaction Problem (CSP)**.

### Problem Formulation

- **Variables**: each slot in the grid (a contiguous horizontal or vertical run of white cells, length ≥ 3). A 5×5 grid might have 6 slots; a 15×15 grid might have 70+.
- **Domains**: for each slot, the set of words from the user's list that have the correct length.
- **Constraints**: at every cell where two slots intersect, the letter at that position in the across word must equal the letter at the corresponding position in the down word. Additionally, no word can be used in more than one slot.

### Data Structures

**CrossIndex** — the key acceleration structure. A map from `"length:position:letter"` to the set of word indices that match. For example, `"5:2:A"` maps to all 5-letter words with 'A' at position 2. This allows instant domain filtering: when a crossing constraint requires a specific letter at a specific position, we intersect the relevant sets from the CrossIndex rather than scanning the entire word list.

**Trie per word length** — used for prefix-based pruning. When partially filling a slot letter by letter, the trie immediately prunes branches where no word starts with the current prefix.

### Algorithm: Backtracking Search with AC-3

**Step 1 — Initialize domains.** For each slot, the domain is all words of matching length from the user's list.

**Step 2 — Select the next slot to fill** using the **Minimum Remaining Values (MRV)** heuristic: pick the slot with the fewest candidate words. This focuses effort on the most constrained slots first, failing fast when a dead end is inevitable. Ties are broken by the **degree heuristic**: prefer slots with the most intersections to unfilled slots, as filling them propagates the most constraints.

**Step 3 — Order candidate words** using **Least Constraining Value (LCV)**: for each candidate word, estimate how many candidates it would eliminate from neighboring slots. Try the word that eliminates the fewest first — this maximizes the chance of finding a valid assignment for the remaining slots.

For large domains (>100 candidates), LCV scoring is expensive, so we skip it and shuffle the candidates instead. This is where the random seed comes in: different seeds produce different shuffle orderings, leading to different solutions.

**Step 4 — Assign the word and propagate constraints** using **AC-3 (Arc Consistency 3)**:

When a word is placed in a slot, its letters are now fixed. For each intersecting slot:
1. Determine the required letter at the intersection position
2. Filter that slot's domain to only words that have the correct letter at that position
3. Also remove the just-used word (no word reuse)
4. If any slot's domain becomes empty → **dead end**, backtrack immediately

AC-3 then propagates further: if slot B's domain was narrowed, check all of B's intersecting slots to see if their domains need narrowing too. This cascade continues until no more domains change or a dead end is found.

This incremental propagation is critical. Without it, the solver would explore deep into the search tree before discovering that an early choice made a distant slot impossible to fill.

**Step 5 — Recurse.** After propagation, if all slots are assigned, we found a solution. Otherwise, go to Step 2 for the next slot.

**Step 6 — Backtrack.** If no candidate works for the current slot (all lead to dead ends after propagation), undo the assignment and try the next candidate in the parent call.

### Multiple Solutions

Rather than stopping at the first solution, the solver continues backtracking after finding one, collecting up to `maxSolutions` distinct solutions. Different random seeds are used across Web Workers (or sequential attempts) to explore different regions of the search space.

### Why This Works for Our Use Case

Personalized crosswords have a key property: the word list is small (10–200 words). This means:

- Slot domains are small, so MRV is very effective at pruning
- AC-3 propagation is fast (few arcs to check)
- The CrossIndex fits easily in memory
- Multiple solutions can often be found within seconds

For a 5×5 grid with ~10 slots and ~50 words, the solver typically finds solutions in <100ms. For a 15×15 grid with ~70 slots and ~200 words, it may take 1–5 seconds. Unsolvable instances are detected quickly because AC-3 empties a domain early.

### When It Fails

The template solver requires an **exact fill** — every slot must have a word. With personalized word lists, this often fails because:

1. **Wrong lengths** — the grid has slots of lengths the user's words don't cover (e.g., 7-letter slots but no 7-letter words)
2. **Too few words** — a 15×15 grid needs ~70 unique words; users often have fewer
3. **Incompatible crossings** — even with enough words of the right lengths, the letter intersections may not work out

When the solver fails, the **suggestion system** analyzes why:
- **Feasibility scoring** checks each slot's domain size (how many words could fit)
- **Shortage analysis** compares word counts per length against slot counts per length
- Slots with zero candidates generate **constraint pattern suggestions** (e.g., "Need a 5-letter word matching _R__E") prompting the user to add words

---

## How the Two Modes Complement Each Other

The freeform solver always produces a result (as long as any two words share a letter), making it the reliable default. The template solver produces the polished, professional look of a standard crossword grid — but requires the right word list. The UI lets users switch between modes: start with freeform to see what's possible, then try a template size to see if a structured grid works with their words.

---

## Key Implementation Files

| File | Purpose |
|------|---------|
| `src/engine/freeform.ts` | Freeform greedy placer with randomized restarts |
| `src/engine/solver.ts` | Template CSP solver with MRV/LCV + backtracking |
| `src/engine/constraints.ts` | AC-3 constraint propagation |
| `src/engine/wordindex.ts` | CrossIndex and trie construction for fast lookups |
| `src/engine/grid.ts` | Grid data structure, slot extraction, validation |
| `src/engine/suggestions.ts` | Feasibility analysis and constraint pattern generation |
| `src/engine/templates.ts` | Pre-defined grid patterns (5×5, 15×15, 21×21) |
