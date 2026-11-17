import Link from "next/link";
import { getMids } from "@/lib/chain/hyperliquid";
import { buildForecast } from "@/lib/forecast/forecast";
import { pct, shortDate, usd } from "@/lib/format";
import { getVenue } from "@/lib/venues";

export const revalidate = 60;

/** A live example from Gemini: the market's odds of a ~10% drop, about a week out. */
async function liveExample() {
  try {
    const [mids, markets] = await Promise.all([getMids(), getVenue().listMarkets({ category: ["Crypto"], search: "SOL", limit: 100 })]);
    const f = buildForecast({ asset: "SOL", spot: mids.SOL, quantity: 1, markets, drops: [0.1] });
    const h = f.horizons[Math.min(1, f.horizons.length - 1)];
    const p = h?.points[0];
    return p ? { asset: "SOL", spot: f.spot, strike: p.strike, prob: p.probBelow, expiry: h.expiry } : null;
  } catch {
    return null;
  }
}

const steps = [
  { n: "1", title: "Tell us what could hurt", body: "Your crypto, a promo, fuel costs, the weather. In your own words, or read straight from your wallet." },
  { n: "2", title: "See the real odds", body: "Hedgehog finds Gemini prediction markets on the same event and shows what the crowd thinks will happen." },
  { n: "3", title: "Decide, then approve", body: "See exactly what it costs and what it pays. Nothing happens until you approve it." },
];

export default async function Home() {
  const ex = await liveExample();

  return (
    <main className="mx-auto max-w-4xl px-4 py-14">
      <section>
        <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
          Know the odds of a bad day.
          <br />
          <span className="text-text-2">Shrink the cost if you want.</span>
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-text-2">
          Hedgehog turns live prediction-market odds into plain answers: how likely is the thing you&apos;re worried about, and what would it cost to
          soften the blow?
        </p>

        {ex && (
          <div className="mt-8 inline-flex flex-col gap-1 rounded-2xl border border-border bg-surface px-5 py-4">
            <span className="text-xs font-medium uppercase tracking-wide text-text-3">Live from Gemini right now</span>
            <span className="text-xl font-semibold tabular-nums">
              {pct(ex.prob)} chance {ex.asset} drops below {usd(ex.strike)} by {shortDate(ex.expiry)}
            </span>
            <span className="text-sm text-text-2 tabular-nums">It&apos;s {usd(ex.spot)} today.</span>
          </div>
        )}
      </section>

      <section className="mt-12 grid gap-4 sm:grid-cols-2">
        <Link href="/crypto" className="group rounded-2xl border border-border bg-surface p-6 transition hover:border-accent">
          <p className="text-xs font-medium uppercase tracking-wide text-text-3">For crypto holders</p>
          <h2 className="mt-2 text-xl font-semibold">See your downside, daily</h2>
          <p className="mt-2 text-sm text-text-2">
            Paste a wallet address or type what you hold. Get a daily forecast of how likely a drop is, and cushion it in a few taps.
          </p>
          <p className="mt-4 text-sm font-medium text-accent">Check my crypto →</p>
        </Link>
        <Link href="/business" className="group rounded-2xl border border-border bg-surface p-6 transition hover:border-accent">
          <p className="text-xs font-medium uppercase tracking-wide text-text-3">For small businesses</p>
          <h2 className="mt-2 text-xl font-semibold">Turn surprise costs into known ones</h2>
          <p className="mt-2 text-sm text-text-2">
            &ldquo;Half-price wings if the home team wins.&rdquo; &ldquo;Diesel keeps climbing.&rdquo; Describe it, and Hedgehog finds a market that pays out when it
            happens.
          </p>
          <p className="mt-4 text-sm font-medium text-accent">Reduce a business risk →</p>
        </Link>
      </section>

      <section className="mt-14">
        <h2 className="text-lg font-semibold">How it works</h2>
        <ol className="mt-4 grid gap-6 sm:grid-cols-3">
          {steps.map((s) => (
            <li key={s.n}>
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-ink">{s.n}</span>
              <h3 className="mt-3 font-medium">{s.title}</h3>
              <p className="mt-1 text-sm text-text-2">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-14 grid gap-4 rounded-2xl border border-border bg-surface p-6 text-sm sm:grid-cols-3">
        <div>
          <p className="font-medium">No seed phrases, no signing</p>
          <p className="mt-1 text-text-2">Wallets are read-only. Hedgehog never moves your crypto.</p>
        </div>
        <div>
          <p className="font-medium">Regulated markets</p>
          <p className="mt-1 text-text-2">Hedges are placed on Gemini&apos;s CFTC-regulated prediction markets, in dollars.</p>
        </div>
        <div>
          <p className="font-medium">You approve everything</p>
          <p className="mt-1 text-text-2">Every order is shown in full, including what it doesn&apos;t cover, before you say yes.</p>
        </div>
      </section>

      <p className="mt-10 text-xs text-text-3">
        Hedgehog is software, not an exchange or an advisor. Trades execute on Gemini in your own account. A hedge reduces, but does not remove,
        losses, and you can lose what you pay for it.
      </p>
    </main>
  );
}
