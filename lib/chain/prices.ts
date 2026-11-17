// Live spot prices. Primary: Gemini's public exchange ticker (same venue as the
// markets). Fallback: Hyperliquid, only for coins Gemini didn't return.

import { getMids } from "./hyperliquid";

const GEMINI_TICKER = "https://api.gemini.com/v1/pubticker";

async function geminiSpot(asset: string): Promise<number | null> {
  try {
    const res = await fetch(`${GEMINI_TICKER}/${asset.toLowerCase()}usd`, { cache: "no-store", signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const t = (await res.json()) as { bid?: string; ask?: string; last?: string };
    const bid = Number(t.bid);
    const ask = Number(t.ask);
    const px = bid > 0 && ask > 0 ? (bid + ask) / 2 : Number(t.last);
    return px > 0 ? px : null;
  } catch {
    return null;
  }
}

/** Spot price per asset (e.g. { SOL: 73.9 }). Assets with no price from any source are omitted. */
export async function getSpots(assets: string[]): Promise<Record<string, number>> {
  const wanted = [...new Set(assets.map((a) => a.toUpperCase()))];
  const out: Record<string, number> = {};
  await Promise.all(
    wanted.map(async (a) => {
      const px = await geminiSpot(a);
      if (px) out[a] = px;
    }),
  );
  const missing = wanted.filter((a) => !(a in out));
  if (missing.length) {
    try {
      const mids = await getMids();
      for (const a of missing) if (mids[a]) out[a] = mids[a];
    } catch {
      // both sources down for these coins; callers handle a missing price
    }
  }
  return out;
}

export async function getSpotPrice(asset: string): Promise<number> {
  const px = (await getSpots([asset]))[asset.toUpperCase()];
  if (!px) throw new Error(`No live price for ${asset} right now`);
  return px;
}
