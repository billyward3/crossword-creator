import { STRATEGY_DETAILS } from "@/lib/strategy-info";

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-white dark:bg-zinc-950 text-black dark:text-zinc-100">
      <header className="bg-white dark:bg-zinc-950 border-b border-gray-200 dark:border-zinc-800 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between pr-12">
          <a href="/" className="text-xl font-bold text-black dark:text-zinc-100">
            Crossword Creator
          </a>
          <a
            href="/create"
            className="text-sm text-gray-700 dark:text-zinc-400 hover:text-black dark:hover:text-zinc-100"
          >
            Create &rarr;
          </a>
        </div>
      </header>

      <article className="max-w-4xl mx-auto px-6 py-10 flex flex-col gap-12">
        <header className="flex flex-col gap-3">
          <h1 className="text-4xl font-bold text-black dark:text-zinc-100 tracking-tight">
            How It Works
          </h1>
          <p className="text-lg text-gray-800 dark:text-zinc-300">
            The engineering behind a personalized crossword constructor.
          </p>
        </header>

        {/* Freeform Strategies */}
        <section id="strategies" className="flex flex-col gap-4 scroll-mt-24">
          <h2 className="text-2xl font-bold text-black dark:text-zinc-100">
            Freeform Strategies
          </h2>
          <p className="text-gray-800 dark:text-zinc-300 leading-relaxed">
            When you generate a crossword, you can pick from three different
            placement strategies. Each one orders your words differently before
            handing them to the greedy placer, producing layouts with different
            characteristics.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
            {Object.values(STRATEGY_DETAILS).map((s) => (
              <a
                key={s.id}
                href={`/about/strategies/${s.id}`}
                className="p-5 border border-gray-200 dark:border-zinc-800 rounded-xl hover:border-black dark:hover:border-zinc-500 bg-white dark:bg-zinc-900 transition-colors flex flex-col gap-2"
              >
                <h3 className="font-semibold text-black dark:text-zinc-100">
                  {s.name}
                </h3>
                <p className="text-sm text-gray-700 dark:text-zinc-400 flex-1">
                  {s.shortDescription}
                </p>
                <span className="text-sm text-blue-600 dark:text-blue-400 font-medium">
                  Read more &rarr;
                </span>
              </a>
            ))}
          </div>
        </section>

        {/* Guided Builder */}
        <section id="guided-builder" className="flex flex-col gap-4 scroll-mt-24">
          <h2 className="text-2xl font-bold text-black dark:text-zinc-100">
            The Guided Builder
          </h2>
          <p className="text-gray-800 dark:text-zinc-300 leading-relaxed">
            Freeform mode builds the grid <em>around</em> your words. The Guided
            Builder works the opposite way: you start with a fixed grid pattern
            (5×5, 7×7, or 15×15), and the engine helps you place words slot by
            slot. It's the right tool when you want a traditional NYT-style
            crossword shape.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
            <div className="p-5 border border-gray-200 dark:border-zinc-800 rounded-xl bg-gray-50 dark:bg-zinc-900 flex flex-col gap-2">
              <h3 className="font-semibold text-black dark:text-zinc-100">
                Two-Layer Word Source
              </h3>
              <p className="text-sm text-gray-700 dark:text-zinc-400">
                Your themed words are prioritized because they're the answers
                you care about. A built-in 42K-word crossword dictionary
                (Collaborative Word List, MIT-licensed) handles the structural
                fill.
              </p>
            </div>
            <div className="p-5 border border-gray-200 dark:border-zinc-800 rounded-xl bg-gray-50 dark:bg-zinc-900 flex flex-col gap-2">
              <h3 className="font-semibold text-black dark:text-zinc-100">
                Real-Time Constraint Propagation
              </h3>
              <p className="text-sm text-gray-700 dark:text-zinc-400">
                Click any slot to see every word that could fit, given the
                letters already placed at crossing points. Pick one, and all
                intersecting slots update instantly using AC-3 arc consistency.
              </p>
            </div>
            <div className="p-5 border border-gray-200 dark:border-zinc-800 rounded-xl bg-gray-50 dark:bg-zinc-900 flex flex-col gap-2">
              <h3 className="font-semibold text-black dark:text-zinc-100">
                Editable Grid Pattern
              </h3>
              <p className="text-sm text-gray-700 dark:text-zinc-400">
                Toggle any cell black or white to shape the grid. Optional
                180° rotational symmetry mimics the standard NYT layout, or
                turn it off for fully custom shapes.
              </p>
            </div>
            <div className="p-5 border border-gray-200 dark:border-zinc-800 rounded-xl bg-gray-50 dark:bg-zinc-900 flex flex-col gap-2">
              <h3 className="font-semibold text-black dark:text-zinc-100">
                Auto-Fill the Remainder
              </h3>
              <p className="text-sm text-gray-700 dark:text-zinc-400">
                Place a few key answers manually, then let the CSP solver fill
                the rest. The solver prioritizes your themed words and uses the
                dictionary for the structural fill.
              </p>
            </div>
          </div>

          <a
            href="/create/guided"
            className="self-start mt-2 px-6 py-2.5 bg-black dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-xl text-sm font-medium hover:bg-gray-800 dark:hover:bg-zinc-300 transition-colors"
          >
            Open the Guided Builder &rarr;
          </a>
        </section>
      </article>
    </main>
  );
}
