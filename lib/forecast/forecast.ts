// Risk forecast: turns Gemini strike markets into plain-English odds for a user's holding.
// "$K or above" YES mid = market-implied P(price >= K at expiry), so P(below K) = 1 - mid.
// Pure functions; no I/O.

import type { Contract, Market, Quote } from "@/lib/types";

export interface ForecastPoint {
  symbol: string; // contract used, for history lookup
  strike: number;
  drop: number; // actual fractional drop from spot to strike (0.1 = -10%)
  probBelow: number; // 0..1
  lossAtStrike: number; // USD loss on the holding if price ends exactly at the strike
}

export interface ForecastHorizon {
  marketId: string;
  title: string;
  expiry: string;
  points: ForecastPoint[];
}

export interface AssetForecast {
  asset: string;
  spot: number;
  quantity: number;
  valueUsd: number;
  horizons: ForecastHorizon[];
}

/** Mid price of YES; falls back to whichever side exists, then last trade. */
export function yesMid(q: Pick<Quote, "yesBid" | "yesAsk" | "last">): number | null {
  if (q.yesBid !== null && q.yesAsk !== null) return (q.yesBid + q.yesAsk) / 2;
  return q.yesAsk ?? q.yesBid ?? q.last ?? null;
}

/** Daily "<ASSET> price on <date>" markets with "above" strikes, soonest first. */
export function dailyPriceMarkets(markets: Market[], asset: string, now = new Date()): Market[] {
  const prefix = `${asset.toUpperCase()} price on `;
  return markets
    .filter(
      (m) =>
        m.title.toUpperCase().startsWith(prefix.toUpperCase()) &&
        new Date(m.expiry).getTime() > now.getTime() + 60 * 60 * 1000 &&
        m.contracts.some((c) => c.strike?.type === "above" && c.strike.value !== null),
    )
    .sort((a, b) => a.expiry.localeCompare(b.expiry));
}

/** Contract whose strike is closest to the target price. */
function nearestStrike(contracts: Contract[], target: number): Contract | null {
  let best: Contract | null = null;
  for (const c of contracts) {
    if (c.strike?.type !== "above" || c.strike.value === null || yesMid(c.quote) === null) continue;
    if (!best || Math.abs(c.strike.value - target) < Math.abs(best.strike!.value! - target)) best = c;
  }
  return best;
}

/** Pick up to `max` horizons spread across the available expiries (soonest, middle, furthest). */
function spreadHorizons(markets: Market[], max: number): Market[] {
  if (markets.length <= max) return markets;
  const idx = new Set([0, Math.floor((markets.length - 1) / 2), markets.length - 1]);
  return [...idx].slice(0, max).map((i) => markets[i]);
}

export function buildForecast(opts: {
  asset: string;
  spot: number;
  quantity: number;
  markets: Market[];
  drops?: number[];
  maxHorizons?: number;
  now?: Date;
}): AssetForecast {
  const { asset, spot, quantity } = opts;
  const drops = opts.drops ?? [0.05, 0.1, 0.2];
  const daily = spreadHorizons(dailyPriceMarkets(opts.markets, asset, opts.now), opts.maxHorizons ?? 3);

  const horizons: ForecastHorizon[] = daily.map((m) => {
    const seen = new Set<string>();
    const points: ForecastPoint[] = [];
    for (const d of drops) {
      const c = nearestStrike(m.contracts, spot * (1 - d));
      if (!c || seen.has(c.symbol)) continue;
      // Only report strikes that are actually below spot (it's a downside forecast).
      if (c.strike!.value! >= spot) continue;
      seen.add(c.symbol);
      const k = c.strike!.value!;
      points.push({
        symbol: c.symbol,
        strike: k,
        drop: 1 - k / spot,
        probBelow: Math.min(1, Math.max(0, 1 - yesMid(c.quote)!)),
        lossAtStrike: quantity * (spot - k),
      });
    }
    return { marketId: m.id, title: m.title, expiry: m.expiry, points };
  });

  return { asset, spot, quantity, valueUsd: quantity * spot, horizons: horizons.filter((h) => h.points.length) };
}

/** Convert stored YES quotes into P(below) over time. */
export function probBelowSeries(
  history: { ts: number; yesBid: number | null; yesAsk: number | null; last: number | null }[],
): { ts: number; probBelow: number }[] {
  return history.flatMap((h) => {
    const mid = yesMid(h);
    return mid === null ? [] : [{ ts: h.ts, probBelow: 1 - mid }];
  });
}

/** Change vs ~24h ago (or vs the earliest point if history is shorter). */
export function changeSince(series: { ts: number; probBelow: number }[], hours = 24) {
  if (series.length < 2) return null;
  const latest = series[series.length - 1];
  const target = latest.ts - hours * 3600_000;
  const base = series.find((p) => p.ts >= target) ?? series[0];
  if (base === latest) return null;
  return { from: base.probBelow, to: latest.probBelow, sinceTs: base.ts, delta: latest.probBelow - base.probBelow };
}
