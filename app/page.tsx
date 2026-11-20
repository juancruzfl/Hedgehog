import { swr } from "@/lib/cache";
import { GeminiLogo } from "@/components/GeminiLogo";
import { usd } from "@/lib/format";
import { buildBoard, type BoardCard } from "@/lib/landing/board";
import { getVenue } from "@/lib/venues";
import { MarketCarousel } from "./MarketCarousel";
import { RiskTiles, type CoinRow } from "./RiskTiles";
import { HowItWorks } from "./HowItWorks";
import { SolanaPanel, type Seal } from "./SolanaPanel";
import { Honest } from "./Honest";
import { Faq } from "./Faq";
import { HOUR, listBatches } from "@/lib/archive/store";
import { listKickoffSeals } from "@/lib/archive/kickoff-store";
import { latestSealedReceipts } from "@/lib/hedges/store";

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
      body: "Hedgehog matches it to a live prediction market on the same event and reads the fine print for you.",
      example: game ? `${game.question} ${Math.round(game.prob * 100)}% chance, ${Math.round(cost * 100)}¢ per $1` : "A market on the same game, with its live odds",
    },
    {
      title: "You decide",
      body: "See what you pay, what you get back and what isn't covered. Nothing happens until you approve.",
      example: `Pay ${usd(pay)} now. The promo costs you ${usd(pay)} whether ${team} wins or not.`,
    },
  ];
}

const COIN_NAMES: Record<string, string> = { BTC: "Bitcoin", ETH: "Ethereum", SOL: "Solana" };

/** The crypto tile: each coin's price now and its −5/−10/−20% ladder, from the live board. */
function coinRows(cards: BoardCard[]): CoinRow[] {
  return cards
    .filter((c) => c.category === "Crypto" && c.ladder?.length)
    .map((c) => ({
      asset: c.badge,
      name: COIN_NAMES[c.badge] ?? c.badge,
      spot: c.spot?.value ?? "",
      by: new Date(c.closes).toLocaleDateString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric" }),
      ladder: c.ladder!,
    }));
}

/**
 * How it works, last step: recent seals on Solana, one of each kind when there is one (a
 * hedge receipt, a kickoff, an hour of odds), topped up with the latest hours. Hedge
 * receipts show only when and their fingerprint, never what was hedged.
 */
function recentSeals(): Seal[] {
  const f = (ms: number, o: Intl.DateTimeFormatOptions) => new Date(ms).toLocaleString("en-US", { timeZone: "America/New_York", ...o });
  const short = (h: string) => `${h.slice(0, 6)}…${h.slice(-4)}`;
  const seals: Seal[] = [];
  try {
    const [r] = latestSealedReceipts(1);
    if (r) seals.push({ kind: "hedge", label: `${f(r.sealedAt, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} ET`, detail: "An approved hedge", fingerprint: short(r.sha256) });
  } catch {}
  try {
    const [k] = listKickoffSeals(1);
    if (k) seals.push({ kind: "kickoff", label: k.title, detail: `${k.count.toLocaleString("en-US")} readings before the start`, fingerprint: short(k.root) });
  } catch {}
  try {
    for (const b of listBatches(10).filter((x) => x.signature)) {
      if (seals.length >= 3) break;
      seals.push({
        kind: "hour",
        label: `${f(b.hourStart, { month: "short", day: "numeric", hour: "numeric" })}–${f(b.hourStart + HOUR, { hour: "numeric" })} ET`,
        detail: `${b.count.toLocaleString("en-US")} readings`,
        fingerprint: short(b.root),
      });
    }
  } catch {}
  return seals;
}

export default async function Home() {
  // Served from a server cache that refreshes in the background, so the page never waits on Gemini once warm.
  const cards = await swr("landing-board", 60_000, () => buildBoard(getVenue())).catch(() => []);

  return (
    <main>
      <div className="mx-auto max-w-6xl px-4">
      {/* Hero: one market, many risks. Fills the window below the nav (57px). */}
      <section className="flex flex-col justify-center pb-6 pt-8 md:min-h-[calc(100svh-57px)] md:pt-4">
        <div className="text-center">
        <p className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs text-text-2">
          {/* The one place the landing page names the market venue */}
          Powered by <GeminiLogo className="h-3.5 w-auto text-text" /> prediction markets
        </p>
        <h1 className="mx-auto mt-5 max-w-4xl text-4xl font-medium leading-[1.05] tracking-[-0.025em] sm:text-6xl">
          Are the odds
          <br />
          in your favor?
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-base text-text-2 sm:text-lg">
          See how likely the things that could cost you are, and cushion the hit before it happens. Pick any risk to see the numbers.
        </p>
        </div>
        <div className="mt-4">
          <MarketCarousel cards={cards} />
        </div>
      </section>

      {/* Where to start: three tiles, Ramp-style */}
      <section className="flex flex-col justify-center py-12 md:min-h-svh md:py-16" aria-labelledby="start-title">
        <div className="text-center">
          <h2 id="start-title" className="text-3xl font-medium tracking-[-0.02em] sm:text-[44px] sm:leading-tight">
            What could hurt you?
          </h2>
          <p className="mt-2 text-text-2">Pick where to start. It takes about a minute, and nothing happens without your OK.</p>
        </div>
        <div className="mt-6 sm:mt-10">
          <RiskTiles coins={coinRows(cards)} />
        </div>
      </section>

      {/* How it works, with a real example */}
      <section className="flex flex-col justify-center py-12 md:min-h-svh md:py-16" aria-labelledby="how-title">
        <h2 id="how-title" className="text-center text-3xl font-medium tracking-[-0.02em] sm:text-[44px] sm:leading-tight">
          How it works
        </h2>
        <p className="mt-2 text-center text-text-2">One real example, start to finish.</p>
        <HowItWorks steps={steps(cards)} />

        {/* Every price is checkable: the Solana archive, as the last part of how it works */}
        <SolanaPanel seals={recentSeals()} />
      </section>

      </div>

      {/* Honest by design: full-width band */}
      <Honest />

      {/* Questions people new to all this tend to have */}
      <Faq />
    </main>
  );
}
