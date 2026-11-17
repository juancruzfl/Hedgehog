import { NextResponse, type NextRequest } from "next/server";
import { getSpot } from "@/lib/chain/hyperliquid";
import { buildDownsideLadder, payoffCurve } from "@/lib/engine/sizer";
import type { Market, RiskProfile } from "@/lib/types";
import { getVenue } from "@/lib/venues";

// Preview a downside hedge for a crypto holding (no orders placed).
// GET /api/hedge/crypto?asset=BTC&quantity=1.5&startDrop=0.05&floorDrop=0.3
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const asset = (p.get("asset") ?? "BTC").toUpperCase();
  const quantity = Number(p.get("quantity") ?? 1);
  const startDrop = Number(p.get("startDrop") ?? 0.05);
  const floorDrop = Number(p.get("floorDrop") ?? 0.3);

  try {
    const [spot, markets] = await Promise.all([
      getSpot(asset),
      getVenue().listMarkets({ category: ["Crypto"], search: asset, limit: 100 }),
    ]);

    // Use the furthest-dated price-strike market for this asset (most room to fall).
    const priceMarkets = markets
      .filter((m: Market) => m.title.toUpperCase().startsWith(asset) && m.contracts.some((c) => c.strike?.type === "above"))
      .sort((a, b) => b.expiry.localeCompare(a.expiry));
    const market = priceMarkets[0];
    if (!market) return NextResponse.json({ error: `No ${asset} price markets listed` }, { status: 404 });

    const profile: RiskProfile = {
      id: `crypto-${asset}-${Date.now()}`,
      segment: "crypto",
      kind: "price_drop",
      underlying: { type: "crypto", ref: asset },
      condition: `${asset} falls more than ${Math.round(startDrop * 100)}% by ${market.expiry}`,
      exposureUsd: {
        low: quantity * spot * startDrop,
        expected: quantity * spot * floorDrop,
        high: quantity * spot * floorDrop,
      },
      window: { start: new Date().toISOString(), end: market.expiry },
      source: "manual",
      position: { asset, quantity, spotPrice: spot },
    };

    const proposal = buildDownsideLadder(profile, market.contracts, { startDrop, floorDrop });
    return NextResponse.json({ spot, market: { title: market.title, expiry: market.expiry }, profile, proposal, curve: payoffCurve(profile, proposal) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
