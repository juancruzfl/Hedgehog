import Link from "next/link";
import { usd } from "@/lib/format";
import { buildBoard, type BoardCard } from "@/lib/landing/board";
import { getVenue } from "@/lib/venues";
import { MarketCarousel } from "./MarketCarousel";

export const revalidate = 60;

const PROMO = 3000; // 500 orders x $6 off

/** How-it-works steps, illustrated with the live game market when one is listed. */
function steps(cards: BoardCard[]) {
  const game = cards.find((c) => c.badge === "NFL" && c.cost !== null);
  const team = game ? game.title.split(" beats ")[0] : "the home team";
  const cost = game?.cost ?? 0.2;
  const pay = Math.round(cost * PROMO);
  return [
    {
      title: "Tell us the worry",
      body: "Type it the way you'd say it. Rough numbers are fine. Crypto holders can just paste a wallet.",
      example: `“Half-price wings if ${team} wins. About 500 orders at $6 off.”`,
    },
    {
      title: "We find the market",
      body: "Hedgehog matches it to a live Gemini market on the same event and reads the fine print for you.",
      example: game ? `${game.question} ${Math.round(game.prob * 100)}% chance, ${Math.round(cost * 100)}¢ per $1` : "A market on the same game, with its live odds",
    },
    {
      title: "You decide",
      body: "See what you pay, what you get back and what isn't covered. Nothing happens until you approve.",
      example: `Pay ${usd(pay)} now. The promo costs you ${usd(pay)} whether ${team} wins or not.`,
    },
  ];
}

const paths = [
  {
    href: "/crypto",
    eyebrow: "For crypto holders",
    title: "Know your coins' downside",
    points: ["Paste a wallet or type what you hold", "See the daily odds of a 5%, 10% or 20% drop", "Cushion a fall in a few taps"],
    example: "“I hold 20 SOL and 0.5 BTC.”",
    cta: "Check my crypto",
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M9.5 9h4a1.75 1.75 0 0 1 0 3.5h-4m0 0h4.5a1.75 1.75 0 0 1 0 3.5H9.5M9.5 9v7M11 7.5V9m0 7v1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/business",
    eyebrow: "For small businesses",
    title: "Turn a risky week into a known cost",
    points: ["Describe a promo, fuel bill or weather worry", "We find the matching market and check the fine print", "See your cost either way before you commit"],
    example: "“Half-price wings if the home team wins.”",
    cta: "Reduce a business risk",
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden>
        <path d="M3.5 9.5 5 4.5h14l1.5 5" />
        <path d="M3.5 9.5h17" />
        <path d="M5 12.5v7h14v-7M10 19.5v-4h4v4" />
      </svg>
    ),
  },
];

const honest = [
  { yes: true, text: "Finds the closest live market and tells you how close it really is" },
  { yes: true, text: "Shows what you pay, what you get back and what isn't covered" },
  { yes: true, text: "Says so plainly when no market fits your risk" },
  { yes: false, text: "Never moves your crypto or asks for a seed phrase" },
  { yes: false, text: "Never places an order without your approval" },
];

export default async function Home() {
  const cards = await buildBoard(getVenue()).catch(() => []);

  return (
    <main className="mx-auto max-w-6xl px-4 pb-16">
      {/* Hero: one market, many risks */}
      <section className="pt-8 text-center sm:pt-10">
        <p className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs text-text-2">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" /> Live odds from Gemini prediction markets
        </p>
        <h1 className="mx-auto mt-5 max-w-4xl text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">
          One market.
          <br />
          <span className="text-accent">Many real-world risks.</span>
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-lg text-text-2">
          A prediction market pays out if something happens. If that same thing would cost you money, the payout softens the hit. Hover any
          risk to see the numbers.
        </p>
      </section>

      <div className="mt-4">
        <MarketCarousel cards={cards} />
      </div>

      {/* Where to start */}
      <section className="mt-20" aria-labelledby="start-title">
        <div className="text-center">
          <h2 id="start-title" className="text-3xl font-bold tracking-tight sm:text-4xl">
            What could hurt you?
          </h2>
          <p className="mt-2 text-text-2">Pick where to start. It takes about a minute, and nothing happens without your OK.</p>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {paths.map((p) => (
            <article key={p.href} className="flex flex-col rounded-2xl border border-border bg-surface p-6">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent-soft text-accent">{p.icon}</span>
                <p className="text-sm font-semibold text-text-2">{p.eyebrow}</p>
              </div>
              <h3 className="mt-4 text-2xl font-bold leading-tight">{p.title}</h3>
              <ul className="mt-4 space-y-2.5">
                {p.points.map((pt) => (
                  <li key={pt} className="flex items-start gap-2.5 text-[15px]">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-good-soft text-xs font-bold text-good" aria-hidden>
                      ✓
                    </span>
                    {pt}
                  </li>
                ))}
              </ul>
              <p className="mt-5 rounded-xl bg-surface-2 px-4 py-3 text-sm text-text-2">
                <span className="text-text-3">Example: </span>
                {p.example}
              </p>
              <Link
                href={p.href}
                className="mt-5 rounded-xl bg-accent py-3 text-center font-semibold text-accent-ink transition hover:brightness-110 md:mt-auto"
              >
                {p.cta} →
              </Link>
            </article>
          ))}
        </div>
      </section>

      {/* How it works, with a real example */}
      <section className="mt-20" aria-labelledby="how-title">
        <h2 id="how-title" className="text-center text-3xl font-bold tracking-tight sm:text-4xl">
          How it works
        </h2>
        <p className="mt-2 text-center text-text-2">One real example, start to finish.</p>
        <ol className="relative mt-10 grid gap-6 md:grid-cols-3">
          <span className="absolute left-[16.6%] right-[16.6%] top-5 hidden h-px bg-border md:block" aria-hidden />
          {steps(cards).map((s, k) => (
            <li key={s.title} className="relative flex flex-col items-center text-center">
              <span className="relative z-10 flex h-10 w-10 items-center justify-center rounded-full bg-accent text-sm font-bold text-accent-ink">
                {k + 1}
              </span>
              <h3 className="mt-4 text-lg font-bold">{s.title}</h3>
              <p className="mt-1 max-w-xs text-sm text-text-2">{s.body}</p>
              <p className="mt-4 w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm font-medium tabular-nums">{s.example}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Honest by design */}
      <section className="mt-20 grid items-start gap-8 rounded-2xl border border-border bg-surface p-6 sm:p-8 lg:grid-cols-5" aria-labelledby="honest-title">
        <div className="lg:col-span-2">
          <h2 id="honest-title" className="text-2xl font-bold tracking-tight sm:text-3xl">
            Honest by design
          </h2>
          <p className="mt-2 text-text-2">
            A hedge softens a loss. It doesn&apos;t erase it, and it costs money up front. Hedgehog shows you all of that before you decide.
          </p>
        </div>
        <ul className="space-y-3 lg:col-span-3">
          {honest.map((h) => (
            <li key={h.text} className="flex items-start gap-3 text-[15px]">
              <span
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  h.yes ? "bg-good-soft text-good" : "bg-bad-soft text-bad"
                }`}
              >
                <span className="sr-only">{h.yes ? "Does: " : "Never: "}</span>
                <span aria-hidden>{h.yes ? "✓" : "✕"}</span>
              </span>
              {h.text}
            </li>
          ))}
        </ul>
      </section>

      <footer className="mt-12 border-t border-border pt-6 text-xs text-text-3">
        Hedgehog is software, not an exchange or an advisor. Orders go to Gemini in your own account, and prices change. Check the current price,
        fees and contract rules before you approve. A hedge reduces, but does not remove, losses, and you can lose what you pay for it.
      </footer>
    </main>
  );
}
