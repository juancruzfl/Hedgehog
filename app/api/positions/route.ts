import { NextResponse } from "next/server";
import { executionMode } from "@/lib/hedges/execute";
import { paperPortfolio } from "@/lib/hedges/paper";
import { listHedges } from "@/lib/hedges/store";
import { GeminiClient } from "@/lib/venues/gemini/client";
import { getVenue } from "@/lib/venues";

export async function GET() {
  const mode = executionMode();
  const hedges = listHedges();
  try {
    if (mode === "paper") {
      const p = await paperPortfolio(getVenue(), hedges);
      return NextResponse.json({ mode, hedges, open: p.open, settled: p.settled, outcomes: p.outcomes });
    }
    if (!GeminiClient.fromEnv().hasCredentials) return NextResponse.json({ mode, hedges, open: [], settled: [], outcomes: {}, connected: false });
    const positions = await getVenue().getPositions();
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
