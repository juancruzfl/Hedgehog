// Holdings: what the user owns, from any source. Every source produces Holding[],
// and the forecast/hedge engine never cares where they came from.

export type HoldingSource = "manual" | "gemini" | "solana";

export interface Holding {
  asset: string; // canonical ticker that Gemini lists markets for: BTC, ETH, SOL, XRP
  quantity: number;
  source: HoldingSource;
  /** Where it came from in human terms, e.g. "cbBTC in Solana wallet". */
  detail?: string;
}

/** Assets Gemini currently lists daily price markets for. */
export const HEDGEABLE_ASSETS = ["BTC", "ETH", "SOL", "XRP"] as const;
export type HedgeableAsset = (typeof HEDGEABLE_ASSETS)[number];

export const isHedgeable = (a: string): a is HedgeableAsset =>
  (HEDGEABLE_ASSETS as readonly string[]).includes(a.toUpperCase());

/** Sum holdings per asset across sources (e.g. SOL in Phantom + SOL on Gemini). */
export function combineHoldings(all: Holding[]): { asset: string; quantity: number; parts: Holding[] }[] {
  const byAsset = new Map<string, Holding[]>();
  for (const h of all) {
    if (!(h.quantity > 0)) continue;
    const key = h.asset.toUpperCase();
    byAsset.set(key, [...(byAsset.get(key) ?? []), h]);
  }
  return [...byAsset.entries()]
    .map(([asset, parts]) => ({ asset, quantity: parts.reduce((s, p) => s + p.quantity, 0), parts }))
    .sort((a, b) => a.asset.localeCompare(b.asset));
}
