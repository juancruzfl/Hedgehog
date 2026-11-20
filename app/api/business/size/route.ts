import { NextResponse, type NextRequest } from "next/server";
import { apiSignInRequired } from "@/lib/auth/guard";
import { z } from "zod";
import { impliedMedian } from "@/lib/business/analyze";
import { buildDownsideLadder, buildUpsideLadder, payoffCurve, sizeEventHedge } from "@/lib/engine/sizer";
import type { RiskProfile } from "@/lib/types";
import { getVenue } from "@/lib/venues";

const Body = z.object({
  profile: z.custom<RiskProfile>((v) => typeof v === "object" && v !== null && "kind" in v && "exposureUsd" in v),
  marketId: z.string().min(1),
  symbol: z.string().optional(), // event hedges
  outcome: z.enum(["yes", "no"]).optional(),
  sizeTo: z.enum(["low", "expected", "high"]).default("expected"),
  hedgeRatio: z.number().min(0.1).max(1).default(1),
  startMove: z.number().min(0).max(0.5).default(0.03), // price hedges
  capMove: z.number().min(0.05).max(0.8).default(0.25),
});

// Deterministic sizing against live prices. No AI; safe to call on every slider move.
export async function POST(req: NextRequest) {
  const denied = await apiSignInRequired(req);
  if (denied) return denied;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const b = parsed.data;

  try {
    const market = await getVenue().getMarket(b.marketId);
    if (!market) return NextResponse.json({ error: "That market is no longer listed." }, { status: 404 });

    if (b.profile.kind === "price_rise" || b.profile.kind === "price_drop") {
      const spot = impliedMedian(market.contracts);
      if (spot === null || !b.profile.position) return NextResponse.json({ error: "No live prices for this market." }, { status: 409 });
      const profile: RiskProfile = { ...b.profile, position: { ...b.profile.position, spotPrice: spot } };
      const proposal =
        profile.kind === "price_rise"
          ? buildUpsideLadder(profile, market.contracts, { startRise: b.startMove, capRise: b.capMove })
          : buildDownsideLadder(profile, market.contracts, { startDrop: b.startMove, floorDrop: b.capMove });
      return NextResponse.json({ kind: "price", spot, market: { id: market.id, title: market.title, expiry: market.expiry }, profile, proposal, curve: payoffCurve(profile, proposal, 240) });
    }

    const contract = market.contracts.find((c) => c.symbol === b.symbol);
    if (!contract || !b.outcome) return NextResponse.json({ error: "Pick a contract to hedge with." }, { status: 400 });
    const proposal = sizeEventHedge(b.profile, contract, b.outcome, { sizeTo: b.sizeTo, hedgeRatio: b.hedgeRatio });
    return NextResponse.json({ kind: "event", market: { id: market.id, title: market.title, expiry: market.expiry }, profile: b.profile, proposal });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
