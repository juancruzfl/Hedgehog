import { FitScale } from "@/components/FitScale";
import { MarketCard } from "@/components/MarketCard";
import { trendingMarkets } from "@/lib/markets/trending";

export const metadata = { title: "Trending markets · Hedgehog" };
export const revalidate = 60;

// The product's home for signed-in users (for now): Gemini's most-traded markets today,
// in the same cards as the landing page.
export default async function MarketsPage() {
  const cards = await trendingMarkets().catch(() => []);
  return (
    <main className="mx-auto max-w-6xl px-4 pb-16 pt-8 sm:pt-10">
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Trending markets</h1>
      <p className="mt-2 max-w-2xl text-text-2">The most-traded prediction markets on Gemini over the last 24 hours.</p>
      {cards.length ? (
        // Three across on wide screens, two on phones; each card keeps the landing page's
        // layout and is scaled to its column (drawn narrower on phones so it shrinks less).
        <div className="mt-6 grid grid-cols-2 items-start gap-2.5 sm:mt-8 sm:gap-3 lg:grid-cols-3 lg:gap-4">
          {cards.map((c) => (
            <FitScale key={c.lines[0]?.key ?? c.question} width={340} wideWidth={440} hideUntilFit>
              <MarketCard m={c} uniform />
            </FitScale>
          ))}
        </div>
      ) : (
        <p className="mt-8 rounded-xl bg-surface-2 px-4 py-6 text-center text-text-2">Couldn&apos;t load Gemini&apos;s markets right now. Try again in a minute.</p>
      )}
    </main>
  );
}
