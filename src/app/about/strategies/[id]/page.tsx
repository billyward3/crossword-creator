import { notFound } from "next/navigation";
import {
  STRATEGY_DETAILS,
  BENCHMARK_RESULTS,
  BENCHMARK_SCENARIOS,
  BENCHMARK_METHODOLOGY,
  PERFORMANCE_ANALYSIS,
  METRIC_DEFINITIONS,
} from "@/lib/strategy-info";
import type { UIStrategy } from "@/lib/strategy-info";

export function generateStaticParams() {
  return Object.keys(STRATEGY_DETAILS).map((id) => ({ id }));
}

export default async function StrategyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const strategy = STRATEGY_DETAILS[id as UIStrategy];
  if (!strategy) notFound();

  return (
    <main className="min-h-screen bg-white dark:bg-zinc-950 text-black dark:text-zinc-100">
      <header className="bg-white dark:bg-zinc-950 border-b border-gray-200 dark:border-zinc-800 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between pr-12">
          <a href="/" className="text-xl font-bold text-black dark:text-zinc-100">
            Crossword Creator
          </a>
          <div className="flex gap-4 text-sm">
            <a
              href="/about"
              className="text-gray-700 dark:text-zinc-400 hover:text-black dark:hover:text-zinc-100"
            >
              About
            </a>
            <a
              href="/create"
              className="text-gray-700 dark:text-zinc-400 hover:text-black dark:hover:text-zinc-100"
            >
              Create
            </a>
          </div>
        </div>
      </header>

      <article className="max-w-4xl mx-auto px-6 py-10 flex flex-col gap-10">
        {/* Breadcrumb */}
        <nav className="text-sm text-gray-700 dark:text-zinc-400">
          <a
            href="/about"
            className="hover:text-black dark:hover:text-zinc-100 underline-offset-2 hover:underline"
          >
            About
          </a>
          <span className="mx-2 text-gray-400 dark:text-zinc-600">/</span>
          <a
            href="/about#strategies"
            className="hover:text-black dark:hover:text-zinc-100 underline-offset-2 hover:underline"
          >
            Strategies
          </a>
          <span className="mx-2 text-gray-400 dark:text-zinc-600">/</span>
          <span className="text-black dark:text-zinc-100 font-medium">
            {strategy.name}
          </span>
        </nav>

        {/* Title */}
        <header className="flex flex-col gap-3">
          <p className="text-sm font-mono text-blue-600 dark:text-blue-400 uppercase tracking-wider">
            Freeform Strategy
          </p>
          <h1 className="text-4xl font-bold text-black dark:text-zinc-100 tracking-tight">
            {strategy.name}
          </h1>
          <p className="text-lg text-gray-800 dark:text-zinc-300">
            {strategy.shortDescription}
          </p>
        </header>

        {/* Summary */}
        <section className="flex flex-col gap-4">
          {strategy.summary.map((p, i) => (
            <p
              key={i}
              className="text-base text-gray-800 dark:text-zinc-300 leading-relaxed"
            >
              {p}
            </p>
          ))}
        </section>

        {/* Strengths & Weaknesses */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-5 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900 rounded-xl">
            <h2 className="text-sm font-semibold text-black dark:text-zinc-100 mb-3 uppercase tracking-wide">
              Strengths
            </h2>
            <ul className="flex flex-col gap-2">
              {strategy.strengths.map((s, i) => (
                <li
                  key={i}
                  className="text-sm text-gray-800 dark:text-zinc-300 flex gap-2"
                >
                  <span className="text-green-700 dark:text-green-400 shrink-0">
                    ✓
                  </span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="p-5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-xl">
            <h2 className="text-sm font-semibold text-black dark:text-zinc-100 mb-3 uppercase tracking-wide">
              Weaknesses
            </h2>
            <ul className="flex flex-col gap-2">
              {strategy.weaknesses.map((w, i) => (
                <li
                  key={i}
                  className="text-sm text-gray-800 dark:text-zinc-300 flex gap-2"
                >
                  <span className="text-amber-700 dark:text-amber-400 shrink-0">
                    !
                  </span>
                  <span>{w}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Algorithm steps */}
        <section className="flex flex-col gap-4">
          <h2 className="text-2xl font-bold text-black dark:text-zinc-100">
            How It Works
          </h2>
          <ol className="flex flex-col gap-4">
            {strategy.steps.map((step, i) => (
              <li key={i} className="flex gap-4">
                <div className="shrink-0 w-8 h-8 rounded-full bg-black dark:bg-zinc-100 text-white dark:text-zinc-900 flex items-center justify-center text-sm font-bold">
                  {i + 1}
                </div>
                <div className="flex flex-col gap-1 pt-1">
                  <h3 className="font-semibold text-black dark:text-zinc-100">
                    {step.title}
                  </h3>
                  <p className="text-gray-800 dark:text-zinc-300 leading-relaxed">
                    {step.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* Pseudocode */}
        <section className="flex flex-col gap-3">
          <h2 className="text-2xl font-bold text-black dark:text-zinc-100">
            Pseudocode
          </h2>
          <pre className="p-5 bg-gray-900 dark:bg-zinc-900 border border-transparent dark:border-zinc-800 text-gray-100 rounded-xl text-sm font-mono overflow-x-auto leading-relaxed">
            {strategy.pseudocode}
          </pre>
        </section>

        {/* Complexity */}
        <section className="flex flex-col gap-3">
          <h2 className="text-2xl font-bold text-black dark:text-zinc-100">
            Complexity
          </h2>
          <p className="text-gray-800 dark:text-zinc-300 leading-relaxed">
            {strategy.complexity}
          </p>
        </section>

        {/* Benchmarks */}
        <BenchmarkSection strategyId={strategy.id} />

        {/* Metric glossary */}
        <MetricGlossary />

        {/* Comparative Performance */}
        <PerformanceComparisonSection currentStrategy={strategy.id} />

        {/* When to use */}
        <section className="flex flex-col gap-3">
          <h2 className="text-2xl font-bold text-black dark:text-zinc-100">
            When to Use This
          </h2>
          <ul className="flex flex-col gap-2">
            {strategy.useWhen.map((u, i) => (
              <li
                key={i}
                className="text-gray-800 dark:text-zinc-300 flex gap-2"
              >
                <span className="text-gray-400 dark:text-zinc-600 shrink-0">
                  •
                </span>
                <span>{u}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* CTA */}
        <section className="p-6 bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl flex flex-col gap-3 items-start">
          <h2 className="text-xl font-semibold text-black dark:text-zinc-100">
            Try it
          </h2>
          <p className="text-sm text-gray-800 dark:text-zinc-300">
            Open the creator with this strategy pre-selected.
          </p>
          <a
            href={`/create?strategy=${strategy.id}`}
            className="px-6 py-2.5 bg-black dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-xl text-sm font-medium hover:bg-gray-800 dark:hover:bg-zinc-300 transition-colors"
          >
            Try {strategy.name} &rarr;
          </a>
        </section>

        {/* Other strategies */}
        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold text-black dark:text-zinc-100">
            Other Strategies
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {Object.values(STRATEGY_DETAILS)
              .filter((s) => s.id !== strategy.id)
              .map((s) => (
                <a
                  key={s.id}
                  href={`/about/strategies/${s.id}`}
                  className="p-4 border border-gray-200 dark:border-zinc-800 rounded-xl hover:border-black dark:hover:border-zinc-500 bg-white dark:bg-zinc-900 transition-colors"
                >
                  <h3 className="font-semibold text-black dark:text-zinc-100">
                    {s.name}
                  </h3>
                  <p className="text-sm text-gray-700 dark:text-zinc-400 mt-1">
                    {s.shortDescription}
                  </p>
                </a>
              ))}
          </div>
        </section>
      </article>
    </main>
  );
}

function BenchmarkSection({ strategyId }: { strategyId: UIStrategy }) {
  const myResults = BENCHMARK_RESULTS[strategyId];
  const isAdjacency = strategyId === "adjacency-aware";

  // For each scenario, find the best result across strategies to highlight wins
  const winners: Record<string, { intersections: UIStrategy; compactness: UIStrategy }> = {};
  for (const scenario of BENCHMARK_SCENARIOS) {
    let bestInter: UIStrategy = "adjacency-aware";
    let bestInterVal = -1;
    let bestCompact: UIStrategy = "adjacency-aware";
    let bestCompactVal = Infinity;
    for (const sid of Object.keys(BENCHMARK_RESULTS) as UIStrategy[]) {
      const m = BENCHMARK_RESULTS[sid][scenario.id];
      if (m.bestIntersections > bestInterVal) {
        bestInterVal = m.bestIntersections;
        bestInter = sid;
      }
      if (m.compactness < bestCompactVal) {
        bestCompactVal = m.compactness;
        bestCompact = sid;
      }
    }
    winners[scenario.id] = { intersections: bestInter, compactness: bestCompact };
  }

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-2xl font-bold text-black dark:text-zinc-100">
          Benchmark Results
        </h2>
        <p className="text-sm text-gray-700 dark:text-zinc-400 mt-1">
          Measured locally on three wordlist scenarios. Each cell is averaged
          across 3 runs of 16 attempts each. <strong>Best</strong> = top
          layout&apos;s metric. <strong>Compactness</strong> = grid area per
          placed word (lower is denser).
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-zinc-800">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-zinc-900">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-semibold text-black dark:text-zinc-100 uppercase tracking-wide">
                Scenario
              </th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-black dark:text-zinc-100 uppercase tracking-wide">
                Best ×
              </th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-black dark:text-zinc-100 uppercase tracking-wide">
                Avg ×
              </th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-black dark:text-zinc-100 uppercase tracking-wide">
                Placed
              </th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-black dark:text-zinc-100 uppercase tracking-wide">
                Compactness
              </th>
              {isAdjacency && (
                <>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-black dark:text-zinc-100 uppercase tracking-wide">
                    2-Ltr Frags
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-black dark:text-zinc-100 uppercase tracking-wide">
                    Fill Words
                  </th>
                </>
              )}
              <th className="text-right px-4 py-3 text-xs font-semibold text-black dark:text-zinc-100 uppercase tracking-wide">
                Time
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-zinc-800">
            {BENCHMARK_SCENARIOS.map((scenario) => {
              const m = myResults[scenario.id];
              const winInter = winners[scenario.id].intersections === strategyId;
              const winCompact = winners[scenario.id].compactness === strategyId;
              return (
                <tr key={scenario.id} className="bg-white dark:bg-zinc-950">
                  <td className="px-4 py-3">
                    <div className="font-medium text-black dark:text-zinc-100">
                      {scenario.name}
                    </div>
                    <div className="text-xs text-gray-600 dark:text-zinc-400 mt-0.5">
                      {scenario.description}
                    </div>
                  </td>
                  <td
                    className={`px-4 py-3 text-right font-mono ${
                      winInter
                        ? "text-green-700 dark:text-green-400 font-semibold"
                        : "text-gray-800 dark:text-zinc-300"
                    }`}
                  >
                    {m.bestIntersections}
                    {winInter && <span className="ml-1 text-xs">★</span>}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-gray-800 dark:text-zinc-300">
                    {m.avgIntersections}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-gray-800 dark:text-zinc-300">
                    {m.bestPlaced}/{scenario.wordCount}
                  </td>
                  <td
                    className={`px-4 py-3 text-right font-mono ${
                      winCompact
                        ? "text-green-700 dark:text-green-400 font-semibold"
                        : "text-gray-800 dark:text-zinc-300"
                    }`}
                  >
                    {m.compactness}
                    {winCompact && <span className="ml-1 text-xs">★</span>}
                  </td>
                  {isAdjacency && (
                    <>
                      <td className="px-4 py-3 text-right font-mono text-gray-800 dark:text-zinc-300">
                        {m.twoLetterFrags}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-gray-800 dark:text-zinc-300">
                        {m.fillWords}
                      </td>
                    </>
                  )}
                  <td className="px-4 py-3 text-right font-mono text-gray-800 dark:text-zinc-300">
                    {m.elapsedMs}ms
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-600 dark:text-zinc-500">
        ★ Best across all four strategies on this scenario. Reproducible via{" "}
        <code className="font-mono">scripts/benchmark-strategies.ts</code>.
      </p>
    </section>
  );
}

function PerformanceComparisonSection({
  currentStrategy,
}: {
  currentStrategy: UIStrategy;
}) {
  const strategies = Object.keys(BENCHMARK_RESULTS) as UIStrategy[];

  return (
    <section className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-bold text-black dark:text-zinc-100">
          Comparative Performance
        </h2>
        <p className="text-sm text-gray-700 dark:text-zinc-400 mt-1">
          All four strategies measured side-by-side on the same word lists and
          hardware. Rows highlighted in blue indicate the strategy being viewed.
        </p>
      </div>

      {BENCHMARK_SCENARIOS.map((scenario) => {
        const bestInter = Math.max(
          ...strategies.map((s) => BENCHMARK_RESULTS[s][scenario.id].bestIntersections),
        );
        const bestCompact = Math.min(
          ...strategies.map((s) => BENCHMARK_RESULTS[s][scenario.id].compactness),
        );
        const bestTime = Math.min(
          ...strategies.map((s) => BENCHMARK_RESULTS[s][scenario.id].elapsedMs),
        );

        return (
          <div key={scenario.id} className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold text-black dark:text-zinc-100">
              {scenario.name}
              <span className="font-normal text-gray-700 dark:text-zinc-400 ml-2">
                {scenario.description}
              </span>
            </h3>
            <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-zinc-800">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-zinc-900">
                  <tr>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-black dark:text-zinc-100 uppercase tracking-wide">
                      Strategy
                    </th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-black dark:text-zinc-100 uppercase tracking-wide">
                      Best ×
                    </th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-black dark:text-zinc-100 uppercase tracking-wide">
                      Avg ×
                    </th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-black dark:text-zinc-100 uppercase tracking-wide">
                      Placed
                    </th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-black dark:text-zinc-100 uppercase tracking-wide">
                      Compact
                    </th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-black dark:text-zinc-100 uppercase tracking-wide">
                      Frags
                    </th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-black dark:text-zinc-100 uppercase tracking-wide">
                      Fill
                    </th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-black dark:text-zinc-100 uppercase tracking-wide">
                      Time
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-zinc-800">
                  {strategies.map((sid) => {
                    const m = BENCHMARK_RESULTS[sid][scenario.id];
                    const isCurrent = sid === currentStrategy;
                    const details = STRATEGY_DETAILS[sid];
                    return (
                      <tr
                        key={sid}
                        className={
                          isCurrent
                            ? "bg-blue-50 dark:bg-blue-950/30"
                            : "bg-white dark:bg-zinc-950"
                        }
                      >
                        <td className="px-4 py-2.5">
                          <span
                            className={`font-medium ${
                              isCurrent
                                ? "text-blue-700 dark:text-blue-400"
                                : "text-black dark:text-zinc-100"
                            }`}
                          >
                            {details.name}
                          </span>
                        </td>
                        <td
                          className={`px-4 py-2.5 text-right font-mono ${
                            m.bestIntersections === bestInter
                              ? "text-green-700 dark:text-green-400 font-semibold"
                              : "text-gray-800 dark:text-zinc-300"
                          }`}
                        >
                          {m.bestIntersections}
                          {m.bestIntersections === bestInter && (
                            <span className="ml-1 text-xs">★</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-gray-800 dark:text-zinc-300">
                          {m.avgIntersections}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-gray-800 dark:text-zinc-300">
                          {m.bestPlaced}/{scenario.wordCount}
                        </td>
                        <td
                          className={`px-4 py-2.5 text-right font-mono ${
                            m.compactness === bestCompact
                              ? "text-green-700 dark:text-green-400 font-semibold"
                              : "text-gray-800 dark:text-zinc-300"
                          }`}
                        >
                          {m.compactness}
                          {m.compactness === bestCompact && (
                            <span className="ml-1 text-xs">★</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-gray-800 dark:text-zinc-300">
                          {m.twoLetterFrags || "—"}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-gray-800 dark:text-zinc-300">
                          {m.fillWords || "—"}
                        </td>
                        <td
                          className={`px-4 py-2.5 text-right font-mono ${
                            m.elapsedMs === bestTime
                              ? "text-green-700 dark:text-green-400 font-semibold"
                              : "text-gray-800 dark:text-zinc-300"
                          }`}
                        >
                          {m.elapsedMs}ms
                          {m.elapsedMs === bestTime && (
                            <span className="ml-1 text-xs">★</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}

      {/* Analysis */}
      <div className="flex flex-col gap-4 p-6 bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl">
        <h3 className="text-sm font-semibold text-black dark:text-zinc-100 uppercase tracking-wide">
          Analysis
        </h3>
        {PERFORMANCE_ANALYSIS.map((p, i) => (
          <p
            key={i}
            className="text-sm text-gray-800 dark:text-zinc-300 leading-relaxed"
          >
            {p}
          </p>
        ))}
        <p className="text-xs text-gray-600 dark:text-zinc-500 mt-2">
          {BENCHMARK_METHODOLOGY}
        </p>
      </div>
    </section>
  );
}

function MetricGlossary() {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-2xl font-bold text-black dark:text-zinc-100">
        Metric Definitions
      </h2>
      <p className="text-sm text-gray-700 dark:text-zinc-400">
        Each benchmark run executes 16 randomized attempts of the strategy and
        returns up to 4 distinct layouts, sorted by quality. This process is
        repeated 3 times to reduce variance. The metrics below describe how each
        column is derived from those runs.
      </p>
      <dl className="flex flex-col gap-3">
        {METRIC_DEFINITIONS.map((def) => (
          <div
            key={def.key}
            className="p-4 bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl"
          >
            <dt className="text-sm font-semibold text-black dark:text-zinc-100 font-mono">
              {def.label}
            </dt>
            <dd className="text-sm text-gray-800 dark:text-zinc-300 mt-1 leading-relaxed">
              {def.description}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
