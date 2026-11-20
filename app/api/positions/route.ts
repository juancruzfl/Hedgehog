import { NextResponse, type NextRequest } from "next/server";
import { apiSignInRequired } from "@/lib/auth/guard";
import { geminiClientFor } from "@/lib/auth/session";
import { executionMode } from "@/lib/hedges/execute";
import { paperPortfolio } from "@/lib/hedges/paper";
import { listHedges } from "@/lib/hedges/store";
import { GeminiAdapter } from "@/lib/venues/gemini/adapter";
import { getVenue } from "@/lib/venues";

export async function GET(req: NextRequest) {
  const denied = await apiSignInRequired(req);
  if (denied) return denied;
  const mode = executionMode();
  const hedges = listHedges();
  try {
    if (mode === "paper") {
      const p = await paperPortfolio(getVenue(), hedges);
      return NextResponse.json({ mode, hedges, open: p.open, settled: p.settled, outcomes: p.outcomes });
    }
    const client = await geminiClientFor(req);
    if (!client) return NextResponse.json({ mode, hedges, open: [], settled: [], outcomes: {}, connected: false });
    const positions = await new GeminiAdapter(client).getPositions();
    return NextResponse.json({
      mode,
      hedges,
      open: positions.filter((p) => !p.resolutionSide),
      settled: positions.filter((p) => p.resolutionSide).map((p) => ({ ...p, payout: p.resolutionSide === p.outcome ? p.quantity : 0 })),
      outcomes: {},
      connected: true,
    });
  } catch (e) {
    return NextResponse.json({ mode, hedges, open: [], settled: [], outcomes: {}, error: (e as Error).message });
  }
}
