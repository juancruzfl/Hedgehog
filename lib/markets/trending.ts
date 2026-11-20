import { swr } from "@/lib/cache";
import { yesMid } from "@/lib/forecast/forecast";
import { historyForSymbol, watchMarkets } from "@/lib/odds/store";
import type { MarketCardData } from "@/components/MarketCard";
import type { Contract } from "@/lib/types";
import { GeminiClient } from "@/lib/venues/gemini/client";
import { toMarkets, type GeminiEvent } from "@/lib/venues/gemini/normalize";

// Trending markets: the product's home for signed-in users. Gemini's most-traded markets
// over the last 24 hours, as landing-page market cards.

export type TrendingEvent = GeminiEvent & { subcategory?: { name?: string } };

const SHORT: Record<string, string> = {
  "College Basketball": "NCAA",
  "Pro Basketball": "NBA",
  "Pro Football": "NFL",
  "College Football": "CFB",
  "Pro Hockey": "NHL",
  "Pro Baseball": "MLB",
  Soccer: "SOC",
  Golf: "GOLF",
  Bitcoin: "BTC",
  Ethereum: "ETH",
  Solana: "SOL",
  Gold: "AU",
  Oil: "OIL",
  "Oil (Brent)": "OIL",
  "Oil (WTI)": "OIL",
  "Daily Temperature": "TEMP",
  "Natural Gas": "GAS",
};
const badgeFor = (e: TrendingEvent) =>
  SHORT[e.subcategory?.name ?? ""] ?? (e.ticker.match(/^[A-Z]+/)?.[0] ?? e.category ?? "MKT").slice(0, 4);

/** A game's sub-markets (": Total Points") share its ticker prefix; they count as the same game. */
const groupKey = (e: TrendingEvent) => (e.category === "Sports" ? e.ticker.replace(/-[^-]+$/, "") : e.ticker);
const priced = (e: TrendingEvent): Contract[] => (toMarkets(e)[0]?.contracts ?? []).filter((c) => yesMid(c.quote) !== null);
const closesAt = (e: TrendingEvent) => Date.parse((e.category === "Sports" ? e.startTime : null) ?? e.expiryDate ?? "");

/**
 * The most-traded markets by 24-hour volume: one per game, at most `perCategory` from any
 * category (so it isn't all college basketball), skipping ones that close within the hour
 * or have no prices. Games already under way stay in.
 */
export function pickTrending(events: TrendingEvent[], now: number, { limit = 12, perCategory = 5 } = {}): TrendingEvent[] {
  const vol = (e: TrendingEvent) => Number(e.volume24h ?? 0) || 0;
  // One entry per game: its volume summed over all its markets, shown as the game itself
  // (not its totals or spreads) when that's listed, otherwise its busiest market.
  const games = new Map<string, { show: TrendingEvent; volume: number }>();
  for (const e of events) {
    if (!priced(e).length) continue;
    const ends = Date.parse(e.expiryDate ?? "");
    if (Number.isFinite(ends) && ends < now + 3600_000) continue;
    const g = games.get(groupKey(e));
    if (!g) {
      games.set(groupKey(e), { show: e, volume: vol(e) });
      continue;
    }
    g.volume += vol(e);
    const isGame = (x: TrendingEvent) => !x.title.includes(": ");
    if ((isGame(e) && !isGame(g.show)) || (isGame(e) === isGame(g.show) && vol(e) > vol(g.show))) g.show = e;
  }
  const perCat = new Map<string, number>();
  const out: TrendingEvent[] = [];
  for (const { show: e } of [...games.values()].sort((a, b) => b.volume - a.volume)) {
    const c = e.category ?? "Other";
    if ((perCat.get(c) ?? 0) >= perCategory) continue;
    perCat.set(c, (perCat.get(c) ?? 0) + 1);
    out.push(e);
    if (out.length >= limit) break;
  }
  return out;
}

const SINCE = () => Date.now() - 3 * 24 * 3600_000;
function history(symbol: string) {
  try {
    return historyForSymbol(symbol, SINCE()).flatMap((h) => {
      const m = yesMid(h);
      return m === null ? [] : [{ ts: h.ts, p: m }];
    });
  } catch {
    return [];
  }
}

/** One trending market as a card: a price ladder shows the level nearest even odds and its neighbors; anything else, its leading outcomes. */
export function toCard(e: TrendingEvent): MarketCardData {
  const contracts = priced(e);
  const strikes = contracts.filter((c) => c.strike?.type === "above" && c.strike.value != null).sort((a, b) => a.strike!.value! - b.strike!.value!);
  let picks: Contract[];
  let featured: Contract;
  if (strikes.length >= 3) {
    const i = strikes.reduce((best, c, k) => (Math.abs(yesMid(c.quote)! - 0.5) < Math.abs(yesMid(strikes[best].quote)! - 0.5) ? k : best), 0);
    featured = strikes[i];
    picks = [strikes[i + 1], strikes[i], strikes[i - 1]].filter((c): c is Contract => !!c);
  } else {
    picks = [...contracts].sort((a, b) => yesMid(b.quote)! - yesMid(a.quote)!).slice(0, 3);
    featured = picks[0];
  }
  const isGame = e.category === "Sports";
  // A two-team game, even when only one side has a price right now.
  const twoSided = isGame && !strikes.length && (toMarkets(e)[0]?.contracts.length ?? 0) === 2;
  const title = e.title.replace(/\?$/, "");
  return {
    category: e.category ?? "Other",
    badge: badgeFor(e),
    tabLabel: e.subcategory?.name ?? e.category ?? "Market",
    question: twoSided ? `Who wins, ${title}?` : `${title}?`,
    closes: new Date(closesAt(e)).toISOString(),
    lines: picks.map((c) => {
      const p = yesMid(c.quote)!;
      return { key: c.symbol, label: c.label, prob: p, history: [...history(c.symbol), { ts: Date.now(), p }], featured: c === featured };
    }),
    spot: null,
    prob: yesMid(featured.quote)!,
    cost: featured.quote.yesAsk,
    lead: twoSided ? `${featured.label} wins` : featured.label,
  };
}

async function allEvents(): Promise<TrendingEvent[]> {
  const client = GeminiClient.fromEnv();
  const out: TrendingEvent[] = [];
  for (let offset = 0; offset < 5000; offset += 100) {
    const page = await client.publicGet<{ data: TrendingEvent[]; pagination?: { total?: number } }>("/v1/prediction-markets/events", { status: "active", limit: 100, offset });
    out.push(...page.data);
    if (page.data.length < 100 || offset + 100 >= (page.pagination?.total ?? 0)) break;
  }
  return out;
}

/** Cached for two minutes (listing every market takes several seconds). */
export function trendingMarkets(): Promise<MarketCardData[]> {
  return swr("trending-markets", 120_000, async () => {
    const picks = pickTrending(await allEvents(), Date.now());
    // Keep recording these, so their charts fill in.
    try {
      watchMarkets(picks.map((e) => e.ticker));
    } catch {}
    return picks.map(toCard);
  });
}
