import Link from "next/link";
import { buildBoard } from "@/lib/landing/board";
import { getVenue } from "@/lib/venues";
import { MarketExplorer } from "./MarketExplorer";
import { RiskBoard } from "./RiskBoard";

export const revalidate = 60;

const steps = [
  { n: "01", title: "Tell us what could hurt", body: "Read your wallet, or describe a promo, fuel bill or cold weekend in plain words." },
  { n: "02", title: "See the real odds", body: "Hedgehog finds the Gemini prediction market on that exact event and shows the crowd's odds." },
  { n: "03", title: "Approve, or don't", body: "See the cost, the payout and what isn't covered. Nothing happens until you approve." },
];

export default async function Home() {
  const cards = await buildBoard(getVenue()).catch(() => []);

  return (
    <main className="mx-auto max-w-6xl px-4 pb-16">
      <section className="py-14 sm:py-20">
        <p className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs text-text-2">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" /> Powered by Gemini prediction markets
        </p>
        <h1 className="mt-5 max-w-4xl text-5xl font-extrabold leading-[1.02] tracking-tight sm:text-7xl">
          Know the odds.
          <br />
          <span className="text-accent">Cap the downside.</span>
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-text-2">
          Hedgehog turns live market odds into plain answers: how likely is the bad thing, and what would it cost to soften it? For your crypto,
          and for your business.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/crypto" className="rounded-xl bg-accent px-5 py-3 font-semibold text-accent-ink hover:brightness-110">
            Check my crypto
          </Link>
          <Link href="/business" className="rounded-xl border border-border bg-surface px-5 py-3 font-semibold hover:border-text-3">
            Reduce a business risk
          </Link>
        </div>
      </section>

      <MarketExplorer cards={cards} />

      <div className="mt-16">
        <RiskBoard cards={cards} />
      </div>

      <section className="mt-20 grid gap-8 border-t border-border pt-10 sm:grid-cols-3">
        {steps.map((s) => (
          <div key={s.n}>
            <span className="font-mono text-sm font-bold text-accent">{s.n}</span>
            <h3 className="mt-2 text-lg font-bold">{s.title}</h3>
            <p className="mt-1 text-sm text-text-2">{s.body}</p>
          </div>
        ))}
      </section>

      <section className="mt-12 grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-3">
        {[
          ["No seed phrases", "Wallets are read-only. Hedgehog never moves your crypto."],
          ["Regulated markets", "Hedges use Gemini's CFTC-regulated prediction markets, in dollars."],
          ["You approve everything", "Every order is shown in full, including what it doesn't cover."],
        ].map(([t, b]) => (
          <div key={t} className="bg-surface p-5 text-sm">
            <p className="font-semibold">{t}</p>
            <p className="mt-1 text-text-2">{b}</p>
          </div>
        ))}
      </section>

      <p className="mt-10 text-xs text-text-3">
        Hedgehog is software, not an exchange or an advisor. Trades execute on Gemini in your own account. A hedge reduces, but does not remove,
        losses, and you can lose what you pay for it.
      </p>
    </main>
  );
}
