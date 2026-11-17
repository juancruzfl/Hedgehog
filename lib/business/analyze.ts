// Business risk pipeline: plain English -> RiskProfile -> Gemini markets -> hedge.
// AI does interpretation (parse, search plan, match + fine-print check).
// Everything involving money (spot, sizing) is deterministic code.

import type { AIProvider, MarketMatch } from "@/lib/ai/types";
import { yesMid } from "@/lib/forecast/forecast";
import type { Contract, Market, RiskProfile } from "@/lib/types";
import type { VenueAdapter } from "@/lib/venues/types";

/** Title prefixes for price markets, keyed by the underlying the AI extracts. */
const PRICE_TITLES: Record<string, string> = {
  WTI: "Oil (WTI) price on",
  BRENT: "Oil (Brent) price on",
  "NATURAL GAS": "Natural Gas price on",
  GOLD: "Gold price on",
  SILVER: "Silver price on",
  COPPER: "Copper price on",
  BTC: "BTC price on",
  ETH: "ETH price on",
  SOL: "SOL price on",
  XRP: "XRP price on",
};

export const priceTitleFor = (ref: string) => PRICE_TITLES[ref.trim().toUpperCase()] ?? null;

export interface EventMatch extends MarketMatch {
  contract: Contract;
}

export type Analysis =
  | { type: "event"; matches: EventMatch[] }
  | { type: "price"; marketId: string; marketTitle: string; expiry: string; spot: number; notes: string[] }
  | { type: "none"; reason: string };

/** Price where the market's YES odds cross 50% (market-implied median at expiry). */
export function impliedMedian(contracts: Contract[]): number | null {
  const pts = contracts
    .filter((c) => c.strike?.type === "above" && c.strike.value !== null)
    .map((c) => ({ k: c.strike!.value!, p: yesMid(c.quote) }))
    .filter((x): x is { k: number; p: number } => x.p !== null)
    .sort((a, b) => a.k - b.k);
  if (pts.length === 0) return null;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    if (a.p >= 0.5 && b.p <= 0.5) {
      if (a.p === b.p) return (a.k + b.k) / 2;
      return a.k + ((a.p - 0.5) / (a.p - b.p)) * (b.k - a.k);
    }
  }
  return pts[0].p < 0.5 ? pts[0].k : pts[pts.length - 1].k;
}

/** The price market whose expiry best covers the risk window. */
export function pickPriceMarket(markets: Market[], titlePrefix: string, windowEnd: string, now = new Date()): { market: Market; covers: boolean } | null {
  const live = markets
    .filter((m) => m.title.toLowerCase().startsWith(titlePrefix.toLowerCase()) && new Date(m.expiry) > now)
    .sort((a, b) => a.expiry.localeCompare(b.expiry));
  if (!live.length) return null;
  const covering = live.find((m) => m.expiry >= windowEnd);
  return covering ? { market: covering, covers: true } : { market: live[live.length - 1], covers: false };
}

const hasQuote = (c: Contract) => c.quote.yesAsk !== null || c.quote.noAsk !== null;

export async function analyzeRisk(
  profile: RiskProfile,
  deps: { venue: VenueAdapter; ai: AIProvider; now?: Date },
): Promise<Analysis> {
  const { venue, ai } = deps;
  const now = deps.now ?? new Date();

  // Price risks: deterministic market lookup, spot implied by the market itself.
  if (profile.kind === "price_rise" || profile.kind === "price_drop") {
    const prefix = priceTitleFor(profile.underlying.ref);
    if (!prefix) return { type: "none", reason: `Gemini doesn't list price markets for ${profile.underlying.ref}.` };
    const category = profile.underlying.type === "crypto" ? "Crypto" : "Commodities";
    const markets = await venue.listMarkets({ category: [category], search: prefix.split(" price")[0], limit: 100 });
    const pick = pickPriceMarket(markets, prefix, profile.window.end, now);
    if (!pick) return { type: "none", reason: `No open ${prefix.replace(" price on", "")} markets right now.` };
    const spot = impliedMedian(pick.market.contracts);
    if (spot === null) return { type: "none", reason: `${pick.market.title} has no live prices right now.` };
    const notes = [
      `Hedgehog uses ${pick.market.title.replace("?", "")} as a stand-in for your cost. Your actual price won't move exactly with it.`,
    ];
    if (!pick.covers) notes.push(`Gemini's latest market settles ${pick.market.expiry.slice(0, 10)}, before your window ends. You'd need to renew the hedge.`);
    return { type: "price", marketId: pick.market.id, marketTitle: pick.market.title, expiry: pick.market.expiry, spot, notes };
  }

  // Event and threshold risks: AI search plan -> candidates -> AI match + fine-print check.
  const plan = await ai.searchPlan(profile);
  const terms = plan.terms.length ? plan.terms : [profile.underlying.ref];
  const seen = new Map<string, Market>();
  for (const term of terms.slice(0, 4)) {
    const found = await venue.listMarkets({ category: plan.categories.length ? plan.categories : undefined, search: term, limit: 50 });
    for (const m of found) if (!seen.has(m.id)) seen.set(m.id, m);
  }

  const latest = new Date(new Date(profile.window.end).getTime() + 3 * 24 * 3600_000);
  const candidates = [...seen.values()]
    .filter((m) => new Date(m.expiry) > now && new Date(m.expiry) <= latest)
    .flatMap((m) => m.contracts)
    .filter((c) => c.tradable && hasQuote(c))
    .slice(0, 60);
  if (!candidates.length) {
    return { type: "none", reason: "Gemini doesn't list a market for this event right now." };
  }

  const ranked = await ai.rankMarkets(profile, candidates);
  const bySymbol = new Map(candidates.map((c) => [c.symbol, c]));
  const matches = ranked.map((m) => ({ ...m, contract: bySymbol.get(m.symbol)! })).filter((m) => m.contract);
  if (!matches.length) return { type: "none", reason: "None of Gemini's current markets line up with this risk." };
  return { type: "event", matches };
}
