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
        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          {cards.map((c) => (
            <MarketCard key={c.lines[0]?.key ?? c.question} m={c} />
          ))}
        </div>
      ) : (
        <p className="mt-8 rounded-xl bg-surface-2 px-4 py-6 text-center text-text-2">Couldn&apos;t load Gemini&apos;s markets right now. Try again in a minute.</p>
      )}
    </main>
  );
}
