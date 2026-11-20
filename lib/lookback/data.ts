// Server side of the past-promo look-back: which past games and weather days Hedgehog has
// odds for (its own archive), and what actually happened (Gemini's settlement).

import { swr } from "@/lib/cache";
import { getBatch, HOUR } from "@/lib/archive/store";
import { yesMid } from "@/lib/forecast/forecast";
import { historyForSymbol, oddsDb } from "@/lib/odds/store";
import type { Outcome } from "@/lib/types";
import { getVenue } from "@/lib/venues";
import {
  eventName,
  hedgeCutoff,
  leagueOf,
  lookbackMath,
  pickReading,
  triggerPhrase,
  type HedgeWhen,
  type LookbackCategory,
  type LookbackMath,
} from "./lookback";

export interface PastEvent {
  id: string;
  category: LookbackCategory;
  name: string; // "Indianapolis vs Houston", "Austin high temperature"
  badge: string; // "NFL", "WEATHER"
  cutoff: number; // last moment a hedge could have been bought (ms)
  contracts: { symbol: string; label: string }[];
}

interface Row {
  marketId: string;
  title: string;
  category: LookbackCategory;
  symbol: string;
  label: string;
  strikeValue: number | null;
}

/** Past game winners and weather days in the archive, newest first. Cached for a few minutes. */
export function pastEvents(): Promise<PastEvent[]> {
  return swr("lookback-events", 5 * 60_000, async () => {
    const rows = oddsDb()
      .prepare(
        `SELECT market_id AS marketId, MAX(market_title) AS title, category, symbol, MAX(label) AS label, MAX(strike_value) AS strikeValue
         FROM odds
         WHERE (category = 'Sports' AND market_id LIKE '%-M') OR category = 'Weather'
         GROUP BY market_id, symbol`,
      )
      .all() as unknown as Row[];
    const byMarket = new Map<string, PastEvent & { order: Map<string, number> }>();
    for (const r of rows) {
      const cutoff = hedgeCutoff(r.marketId, r.category);
      if (cutoff === null || cutoff > Date.now()) continue;
      const ev: PastEvent & { order: Map<string, number> } = byMarket.get(r.marketId) ?? {
        id: r.marketId,
        category: r.category,
        name: eventName(r.category, r.title),
        badge: r.category === "Weather" ? "WEATHER" : leagueOf(r.marketId),
        cutoff,
        contracts: [],
        order: new Map(),
      };
      ev.contracts.push({ symbol: r.symbol, label: r.label });
      ev.order.set(r.symbol, r.strikeValue ?? (/(-?\d+)/.exec(r.label) ? Number(/(-?\d+)/.exec(r.label)![1]) : 0));
      byMarket.set(r.marketId, ev);
    }
    return [...byMarket.values()]
      .map(({ order, ...ev }) => ({
        ...ev,
        // Weather: coldest to hottest. Games: as listed.
        contracts: ev.category === "Weather" ? ev.contracts.sort((a, b) => order.get(a.symbol)! - order.get(b.symbol)!) : ev.contracts,
      }))
      .sort((a, b) => b.cutoff - a.cutoff);
  });
}

export interface LookbackQuery {
  marketId: string;
  symbol: string;
  promoCost: number;
  when: HedgeWhen;
  promo: string; // what the business gave away, e.g. "Half-price wings"
}

export interface LookbackResult {
  event: PastEvent;
  symbol: string;
  label: string; // the contract that triggers the promo, e.g. "Indianapolis"
  trigger: string; // "Indianapolis won"
  promo: string;
  promoCost: number;
  when: HedgeWhen;
  boughtAt: number; // ts of the archived reading used
  chance: number | null; // market-implied chance at that time (mid)
  math: LookbackMath;
  resolution: Outcome | null; // YES/NO once Gemini settles the market
  /** YES odds over the record, for the chart. */
  series: { ts: number; yes: number }[];
  /** Whether the reading used is sealed on Solana yet (the "check it yourself" proof). */
  sealed: boolean;
}

export type LookbackError = { error: string };

/** Gemini's settlement for a market. Settled results never change, so they're cached long. */
async function resolutionOf(marketId: string, symbol: string) {
  const market = await swr(`lookback-market:${marketId}`, 2 * 60_000, () => getVenue().getMarket(marketId));
  const c = market?.contracts.find((x) => x.symbol === symbol);
  return { resolution: c?.resolutionSide ?? null, increment: c?.increments.quantityIncrement ?? 1 };
}

export async function lookback(q: LookbackQuery): Promise<LookbackResult | LookbackError> {
  const event = (await pastEvents()).find((e) => e.id === q.marketId);
  if (!event) return { error: "That game or day isn't in Hedgehog's odds archive." };
  const contract = event.contracts.find((c) => c.symbol === q.symbol);
  if (!contract) return { error: "Pick what would have triggered the promo." };

  const points = historyForSymbol(q.symbol);
  const reading = pickReading(points, event.cutoff, q.when);
  if (!reading) return { error: "Hedgehog has no price on record for that before it started." };

  const { resolution, increment } = await resolutionOf(event.id, q.symbol);
  const triggered = resolution === null ? null : resolution === "yes";
  const math = lookbackMath({ promoCost: q.promoCost, price: reading.yesAsk, triggered, quantityIncrement: increment });

  return {
    event,
    symbol: q.symbol,
    label: contract.label,
    trigger: triggerPhrase(event.category, contract.label),
    promo: q.promo,
    promoCost: q.promoCost,
    when: q.when,
    boughtAt: reading.ts,
    chance: yesMid(reading),
    math,
    resolution,
    series: points.flatMap((p) => {
      const y = yesMid(p);
      return y === null ? [] : [{ ts: p.ts, yes: y }];
    }),
    sealed: !!getBatch(Math.floor(reading.ts / HOUR) * HOUR)?.signature,
  };
}

/** Reads and cleans the share-link parameters. Used by the page and the share image alike. */
export function parseLookbackParams(sp: Record<string, string | string[] | undefined>): LookbackQuery | null {
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k][0] : sp[k]) ?? "";
  const marketId = one("m");
  const symbol = one("c");
  if (!marketId || !symbol) return null;
  const cost = Number(one("cost"));
  const w = one("at");
  return {
    marketId,
    symbol,
    promoCost: Number.isFinite(cost) && cost >= 1 ? Math.min(Math.round(cost), 1_000_000) : 1000,
    when: w === "early" || w === "day" || w === "last" ? w : "day",
    promo: one("promo").replace(/\s+/g, " ").trim().slice(0, 60),
  };
}

/**
 * The page's opening example, so it makes its case before anyone touches a control: the most
 * recent game where hedging a $3,000 half-price-wings promo the day before would have paid
 * off, or else the most recent result on record. Cached for ten minutes.
 */
export function featuredExample(): Promise<{ q: LookbackQuery; r: LookbackResult } | null> {
  return swr("lookback-featured", 10 * 60_000, async () => {
    const games = (await pastEvents()).filter((e) => e.category === "Sports").slice(0, 10);
    let fallback: { q: LookbackQuery; r: LookbackResult } | null = null;
    for (const e of games) {
      for (const c of e.contracts) {
        const q: LookbackQuery = { marketId: e.id, symbol: c.symbol, promoCost: 3000, when: "day", promo: "Half-price wings" };
        const r = await lookback(q).catch(() => null);
        if (!r || "error" in r) continue;
        if (r.resolution === "yes" && (r.math.saved ?? 0) > 0) return { q, r };
        fallback ??= { q, r };
      }
    }
    return fallback;
  });
}
