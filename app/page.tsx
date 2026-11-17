import Link from "next/link";
import { buildBoard } from "@/lib/landing/board";
import { getVenue } from "@/lib/venues";
import { MarketExplorer } from "./MarketExplorer";

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
      <div className="pt-12 sm:pt-16">
        <MarketExplorer cards={cards} />
      </div>

      <section className="mt-10 flex flex-col items-start gap-4 rounded-2xl border border-border bg-surface p-6 sm:flex-row sm:items-center">
        <div className="flex-1">
          <h2 className="text-xl font-bold">What could hurt you?</h2>
          <p className="mt-1 text-text-2">Check your crypto in seconds, or describe a business risk in plain words.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/crypto" className="rounded-xl bg-accent px-5 py-3 font-semibold text-accent-ink hover:brightness-110">
            Check my crypto
          </Link>
          <Link href="/business" className="rounded-xl border border-border bg-background px-5 py-3 font-semibold hover:border-text-3">
            Reduce a business risk
          </Link>
        </div>
      </section>

      <section className="mt-14 grid gap-8 border-t border-border pt-10 sm:grid-cols-3">
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
