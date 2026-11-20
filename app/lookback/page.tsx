import type { Metadata } from "next";
import { featuredExample, lookback, parseLookbackParams, pastEvents } from "@/lib/lookback/data";
import { LookbackControls } from "./LookbackControls";
import { LookbackView } from "./LookbackView";
import { headline } from "./copy";

// Past-promo look-back. Everything lives in the URL (?m=market&c=contract&cost=&at=&promo=),
// so a result is a link a business owner can share, with its own preview image.

export const dynamic = "force-dynamic";

type SP = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({ searchParams }: { searchParams: SP }): Promise<Metadata> {
  const sp = await searchParams;
  const q = parseLookbackParams(sp);
  const base: Metadata = {
    title: "Were the odds in your favor? · Hedgehog",
    description: "See what hedging a past promo would have saved, using odds recorded by Hedgehog and sealed on Solana.",
  };
  if (!q) return base;
  const r = await lookback(q).catch(() => null);
  if (!r || "error" in r) return base;
  const h = headline(r);
  const qs = new URLSearchParams({ m: q.marketId, c: q.symbol, cost: String(q.promoCost), at: q.when, promo: q.promo }).toString();
  const image = `/api/lookback/card?${qs}`;
  return {
    title: `${h.title} · Hedgehog`,
    description: `${h.big}. ${h.line}`,
    openGraph: { title: h.title, description: `${h.big}. ${h.line}`, images: [{ url: image, width: 1200, height: 630 }] },
    twitter: { card: "summary_large_image", title: h.title, description: `${h.big}. ${h.line}`, images: [image] },
  };
}

export default async function LookbackPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const events = await pastEvents().catch(() => []);
  const asked = parseLookbackParams(sp);
  // Nothing picked yet: open on a ready-made example instead of an empty form.
  const featured = asked ? null : await featuredExample().catch(() => null);
  const q = asked ?? featured?.q ?? null;
  const result = asked ? await lookback(asked).catch((e) => ({ error: (e as Error).message })) : (featured?.r ?? null);

  return (
    <main className="mx-auto max-w-6xl px-4 pb-16 pt-8 sm:pt-10">
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Were the odds in your favor?</h1>
      <p className="mt-2 max-w-3xl text-text-2">
        See what hedging a promo on a past game or a hot or cold day would have cost and paid back, at the odds Hedgehog recorded at the time. Every price is
        sealed on Solana, so you can check it.
      </p>

      {/* Phones: the answer first, the controls under it. Wider screens: controls across the top. */}
      <div className="mt-6 flex flex-col gap-4 sm:mt-8 sm:gap-6">
        <div className="order-2 sm:order-1">
          <LookbackControls events={events} initial={q} />
        </div>
        <div className="order-1 min-w-0 sm:order-2">
          {result && "error" in result && <p className="rounded-xl bg-bad-soft px-4 py-3 text-sm text-bad">{result.error}</p>}
          {result && !("error" in result) && <LookbackView r={result} example={!asked} />}
          {!result && (
            <p className="rounded-2xl border border-dashed border-border bg-surface p-6 text-sm text-text-2">
              Pick a game or day above to see what a hedge would have done.
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
