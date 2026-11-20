import type { Metadata } from "next";
import { lookback, parseLookbackParams, pastEvents } from "@/lib/lookback/data";
import { LookbackForm } from "./LookbackForm";
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
    title: "Past promos · Hedgehog",
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
  const q = parseLookbackParams(sp);
  const result = q ? await lookback(q).catch((e) => ({ error: (e as Error).message })) : null;

  return (
    <main className="mx-auto max-w-6xl px-4 pb-16 pt-10">
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">What would a hedge have saved?</h1>
      <p className="mt-2 max-w-3xl text-text-2">
        Pick a promo you ran on a past game or a hot or cold day. Hedgehog looks up the odds it recorded at the time and Gemini&apos;s final result,
        and shows what offsetting it would have cost and paid back. Every price comes from Hedgehog&apos;s archive, sealed on Solana, so you can check it.
      </p>

      <div className="mt-8 grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)]">
        <LookbackForm events={events} initial={q} />
        <div className="min-w-0">
          {!result && (
            <div className="rounded-2xl border border-dashed border-border bg-surface p-6 text-sm text-text-2">
              <p className="font-medium text-text">How it works</p>
              <ol className="mt-2 list-decimal space-y-1 pl-5">
                <li>Pick the game or day your promo depended on, and what would have made it kick in.</li>
                <li>Say what the promo cost you (or would have) when it kicked in.</li>
                <li>Hedgehog sizes a hedge that pays that cost back, priced at the odds recorded back then.</li>
              </ol>
            </div>
          )}
          {result && "error" in result && <p className="rounded-xl bg-bad-soft px-4 py-3 text-sm text-bad">{result.error}</p>}
          {result && !("error" in result) && <LookbackView r={result} />}
        </div>
      </div>
    </main>
  );
}
