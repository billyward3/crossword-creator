# Crossword Creator

A web-based crossword puzzle creator and solver with a dense-intersection generation engine. Create personalized crossword puzzles from your own word list and share them with a link.

## Features

- **Dense crossword generation** — CSP solver with AC-3 constraint propagation that maximizes word intersections, unlike typical sparse crossword makers
- **Multiple solutions** — generates several layout options to choose from
- **Intelligent suggestions** — when the engine can't fill a slot, it tells you what pattern a new word needs to match so you can add one
- **NYT-quality solver UI** — keyboard navigation, check/reveal, timer, pencil mode (coming soon)
- **Shareable puzzles** — URL-encoded puzzles that can be shared with a link (coming soon)

## Tech Stack

- **Next.js** + **TypeScript** + **Tailwind CSS**
- **Crossword engine**: constraint satisfaction solver with trie-indexed word lookup, AC-3 propagation, MRV/LCV heuristics
- **Web Workers** for parallel generation without blocking the UI

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

## Scripts

- `npm run dev` — start dev server
- `npm run build` — production build
- `npm test` — run tests
- `npm run lint` — lint check
