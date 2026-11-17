import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getMids } from "@/lib/chain/hyperliquid";
import { buildForecast, changeSince, probBelowSeries } from "@/lib/forecast/forecast";
import { isHedgeable } from "@/lib/holdings";
import { historyForSymbol } from "@/lib/odds/store";
import { getVenue } from "@/lib/venues";

const Body = z.object({
  holdings: z.array(z.object({ asset: z.string(), quantity: z.number().positive() })).min(1).max(10),
});

// POST /api/forecast  { holdings: [{ asset: "SOL", quantity: 20 }] }
export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid holdings" }, { status: 400 });

  try {
    const mids = await getMids();
    const venue = getVenue();
    const since = Date.now() - 3 * 24 * 3600_000;

    const forecasts = await Promise.all(
      parsed.data.holdings
        .filter((h) => isHedgeable(h.asset))
        .map(async (h) => {
          const asset = h.asset.toUpperCase();
          const spot = mids[asset];
          if (!spot) return null;
          const markets = await venue.listMarkets({ category: ["Crypto"], search: asset, limit: 100 });
          const f = buildForecast({ asset, spot, quantity: h.quantity, markets });
          return {
            ...f,
            horizons: f.horizons.map((hz) => ({
              ...hz,
              points: hz.points.map((p) => {
                const series = probBelowSeries(historyForSymbol(p.symbol, since));
                return { ...p, history: series, change: changeSince(series) };
              }),
            })),
          };
        }),
    );
    return NextResponse.json({ forecasts: forecasts.filter(Boolean), asOf: new Date().toISOString() });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
